"""Gemini service (Nodes 10, 12) — structured classification + LLM reasoning + PDF processing.

Uses Gemini 3 Flash for classification/OCR (cheaper, faster) and Gemini 2.5 Pro for reasoning.
All Gemini calls use tenacity retry with exponential backoff and proper error logging.
No exceptions are silently swallowed — failures are logged and surfaced.
"""

import json
import logging
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable, DeadlineExceeded

from backend.app.core.config import settings
from backend.app.models.enquiry import Enquiry
from backend.app.services.rules import RulesOutput

logger = logging.getLogger("aries.gemini")

# --- Models ---
CLASSIFY_MODEL = "gemini-3-flash-preview"       # Fast, cheap — classification, OCR, extraction
REASONING_MODEL = "gemini-3.1-pro-preview"      # Most intelligent — proposal drafting, report writing
OCR_MODEL = "gemini-3-flash-preview"            # Fast, cheap — document vision, OCR
IMAGE_MODEL = "gemini-3.1-flash-image-preview"  # Image generation + editing
TTS_MODEL = "gemini-3.1-flash-tts-preview"      # Text-to-speech audio output

# --- Rate limit retry config ---
RETRYABLE_EXCEPTIONS = (ResourceExhausted, ServiceUnavailable, DeadlineExceeded)


# --- Structured output schemas ---

class EnquiryClassification(BaseModel):
    category: str = Field(description="One of: consulting, implementation, support, training, audit")
    subdivision: str = Field(description="Relevant business subdivision")
    complexity: str = Field(description="One of: low, medium, high, critical")
    required_documents: list[str] = Field(description="List of required documents")
    resource_profile: str = Field(description="Brief description of team/resources needed")


class ProposalPricingItem(BaseModel):
    item: str
    amount: float


class ProposalPricing(BaseModel):
    total: float
    currency: str = "USD"
    breakdown: list[ProposalPricingItem]


class StructuredProposal(BaseModel):
    executive_summary: str
    scope_of_work: str
    deliverables: list[str]
    assumptions: list[str]
    pricing: ProposalPricing
    timeline_weeks: int
    terms: list[str]


class GeminiError(Exception):
    """Raised when a Gemini API call fails after retries."""
    def __init__(self, operation: str, cause: Exception):
        self.operation = operation
        self.cause = cause
        super().__init__(f"Gemini '{operation}' failed: {cause}")


def _gemini_retry():
    """Common retry decorator for Gemini calls: 3 attempts, exponential backoff on rate limits."""
    return retry(
        retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        before_sleep=lambda rs: logger.warning(
            "Gemini rate limit hit on attempt %d for %s, retrying in %ss",
            rs.attempt_number,
            rs.fn.__name__ if rs.fn else "unknown",
            rs.next_action.sleep if rs.next_action else 0,
        ),
        reraise=True,
    )


class GeminiService:
    def __init__(self):
        self.client = settings.get_genai_client()
        # Image/TTS models need SA + global location
        self._media_client = None

    def _get_media_client(self):
        """Get a client for media generation (image/TTS) — SA + global."""
        if self._media_client is None:
            from google.oauth2 import service_account
            import json
            sa_info = json.loads(settings.gca_key)
            creds = service_account.Credentials.from_service_account_info(
                sa_info, scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            project = settings.gcp_project_id or sa_info.get("project_id", "")
            self._media_client = genai.Client(
                vertexai=True, project=project, location="global", credentials=creds,
            )
        return self._media_client

    @_gemini_retry()
    def _generate(self, model: str, contents, config: dict | None = None):
        """Core Gemini call with retry on rate limits."""
        return self.client.models.generate_content(model=model, contents=contents, config=config or {})

    async def classify_enquiry(self, enquiry: Enquiry, wiki_context: str) -> dict:
        """Node 10: Classify enquiry using Gemini 3 Flash structured outputs."""
        prompt = f"""Classify this pre-sales enquiry:

Client: {enquiry.client_name}
Industry: {enquiry.industry or 'Unknown'}
Description: {enquiry.description}

Relevant wiki context:
{wiki_context[:3000]}"""

        try:
            response = self._generate(
                model=CLASSIFY_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": EnquiryClassification.model_json_schema(),
                },
            )
            result = EnquiryClassification.model_validate_json(response.text)
            return result.model_dump()
        except RETRYABLE_EXCEPTIONS as e:
            logger.error("Gemini classify rate-limited after retries: %s", e)
            raise GeminiError("classify_enquiry", e)
        except Exception as e:
            logger.error("Gemini classify failed: %s", e, exc_info=True)
            raise GeminiError("classify_enquiry", e)

    async def draft_proposal(
        self,
        enquiry: Enquiry,
        wiki_context: str,
        rules_output: RulesOutput,
        classification: dict,
    ) -> str:
        """Node 12: Draft proposal using Gemini 2.5 Pro (1M context)."""
        prompt = f"""You are a senior pre-sales consultant. Draft a professional proposal.

## RULES (deterministic — must be respected):
- Minimum margin: {rules_output.min_margin_pct}%
- Template: {rules_output.suggested_template}
- Two-person approval required: {rules_output.requires_two_person_approval}
- Policy violations: {rules_output.policy_violations or 'None'}

## CLASSIFICATION:
{json.dumps(classification, indent=2)}

## ENQUIRY:
- Client: {enquiry.client_name}
- Industry: {enquiry.industry or 'Unknown'}
- Description: {enquiry.description}
- Estimated value: {enquiry.estimated_value or 'TBD'}
- Estimated cost: {enquiry.estimated_cost or 'TBD'}

## WIKI CONTEXT (past cases, entity info, concepts):
{wiki_context[:50000]}

Draft a complete proposal including:
1. Executive Summary
2. Scope of Work
3. Deliverables
4. Assumptions & Exclusions
5. Pricing / Quotation
6. Timeline
7. Terms & Conditions

Use the rules above for pricing and margin guidance. Reference relevant past cases from the wiki context where applicable."""

        try:
            response = self._generate(model=REASONING_MODEL, contents=prompt)
            if not response.text:
                raise GeminiError("draft_proposal", ValueError("Empty response from Gemini"))
            return response.text
        except RETRYABLE_EXCEPTIONS as e:
            logger.error("Gemini draft rate-limited after retries: %s", e)
            raise GeminiError("draft_proposal", e)
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini draft failed: %s", e, exc_info=True)
            raise GeminiError("draft_proposal", e)

    async def draft_proposal_structured(
        self,
        enquiry: Enquiry,
        wiki_context: str,
        rules_output: RulesOutput,
        classification: dict,
    ) -> dict:
        """Node 12: Draft proposal as structured JSON using Gemini structured outputs."""
        prompt = f"""Draft a proposal based on:

Client: {enquiry.client_name}
Industry: {enquiry.industry or 'Unknown'}
Description: {enquiry.description}
Rules: min margin {rules_output.min_margin_pct}%, template {rules_output.suggested_template}
Classification: {json.dumps(classification)}
Wiki context: {wiki_context[:30000]}"""

        try:
            response = self._generate(
                model=REASONING_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": StructuredProposal.model_json_schema(),
                },
            )
            result = StructuredProposal.model_validate_json(response.text)
            return result.model_dump()
        except Exception as e:
            logger.error("Gemini structured draft failed: %s", e, exc_info=True)
            raise GeminiError("draft_proposal_structured", e)

    async def answer_query(self, query: str, wiki_context: str) -> str:
        """General query against the wiki."""
        prompt = f"""Answer the following question using the wiki context provided.
If the wiki doesn't contain enough information, say so clearly.

## Wiki Context:
{wiki_context[:50000]}

## Question:
{query}

Provide a clear, concise answer with citations to specific wiki pages where possible."""

        try:
            response = self._generate(model=REASONING_MODEL, contents=prompt)
            if not response.text:
                raise GeminiError("answer_query", ValueError("Empty response"))
            return response.text
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini query failed: %s", e, exc_info=True)
            raise GeminiError("answer_query", e)

    async def process_pdf(self, pdf_bytes: bytes, prompt: str) -> str:
        """Process a PDF document using Gemini 3 Flash native vision (cheaper, great for OCR).
        Supports up to 1000 pages, 50MB per document."""
        try:
            response = self._generate(
                model=OCR_MODEL,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    prompt,
                ],
            )
            if not response.text:
                raise GeminiError("process_pdf", ValueError("Empty response"))
            return response.text
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini PDF processing failed: %s", e, exc_info=True)
            raise GeminiError("process_pdf", e)

    async def process_pdf_structured(self, pdf_bytes: bytes, prompt: str, schema: dict) -> dict:
        """Process a PDF and extract structured data (e.g. invoice line items, contract terms)."""
        try:
            response = self._generate(
                model=OCR_MODEL,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    prompt,
                ],
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": schema,
                },
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error("Gemini structured PDF extraction failed: %s", e, exc_info=True)
            raise GeminiError("process_pdf_structured", e)

    async def process_multiple_pdfs(self, pdf_bytes_list: list[bytes], prompt: str) -> str:
        """Process multiple PDFs in a single request (up to context window limit)."""
        parts = []
        for pdf_bytes in pdf_bytes_list:
            parts.append(types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"))
        parts.append(prompt)

        try:
            response = self._generate(model=REASONING_MODEL, contents=parts)
            if not response.text:
                raise GeminiError("process_multiple_pdfs", ValueError("Empty response"))
            return response.text
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini multi-PDF processing failed: %s", e, exc_info=True)
            raise GeminiError("process_multiple_pdfs", e)

    # --- Image Generation ---

    @_gemini_retry()
    def _generate_image(self, prompt: str, aspect_ratio: str = "auto",
                         image_size: str = "1K") -> bytes | None:
        """Generate an image using gemini-3.1-flash-image-preview.

        Returns PNG image bytes, or None if no image was generated.
        """
        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
            ],
            image_config=types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=image_size,
                output_mime_type="image/png",
            ),
        )
        response = self._get_media_client().models.generate_content(
            model=IMAGE_MODEL,
            contents=prompt,
            config=config,
        )
        # Extract image from response
        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.data:
                    import base64
                    return base64.b64decode(part.inline_data.data)
        return None

    async def generate_image(self, prompt: str, aspect_ratio: str = "auto",
                              image_size: str = "1K") -> bytes:
        """Generate an image from a text prompt.

        Args:
            prompt: Description of the image to generate.
            aspect_ratio: "auto", "1:1", "16:9", "9:16", "4:3", "3:4"
            image_size: "1K" or "2K"

        Returns:
            PNG image bytes.

        Raises:
            GeminiError if generation fails.
        """
        try:
            result = self._generate_image(prompt, aspect_ratio=aspect_ratio, image_size=image_size)
            if not result:
                raise GeminiError("generate_image", ValueError("No image in response"))
            return result
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Image generation failed: %s", e, exc_info=True)
            raise GeminiError("generate_image", e)

    # --- Text-to-Speech ---

    async def generate_speech(self, text: str, voice_name: str = "Achernar",
                               temperature: float = 1.0) -> bytes:
        """Generate speech audio from text using gemini-3.1-flash-tts-preview.

        Args:
            text: Text to convert to speech.
            voice_name: Prebuilt voice name (e.g. "Achernar", "Aoede", "Charon", "Fenrir", "Kore").
            temperature: Generation temperature (0.0–2.0).

        Returns:
            WAV audio bytes.
        """
        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        ),
                    ),
                ),
            )
            response = self.client.models.generate_content(
                model=TTS_MODEL,
                contents=text,
                config=config,
            )
            # Extract audio from response
            if response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.data:
                        import base64
                        audio_data = base64.b64decode(part.inline_data.data)
                        mime = part.inline_data.mime_type or "audio/mp3"
                        # Convert to WAV if raw PCM
                        if "L" in mime:
                            return self._convert_to_wav(audio_data, mime)
                        return audio_data
            raise GeminiError("generate_speech", ValueError("No audio in response"))
        except GeminiError:
            raise
        except Exception as e:
            logger.error("TTS generation failed: %s", e, exc_info=True)
            raise GeminiError("generate_speech", e)

    @staticmethod
    def _convert_to_wav(raw_audio: bytes, mime_type: str) -> bytes:
        """Convert raw PCM audio bytes to WAV format with proper header."""
        import struct
        # Parse MIME: e.g. "audio/L16;rate=24000"
        parts = mime_type.split(";")
        format_part = parts[0]  # e.g. "audio/L16"
        bits_per_sample = 16  # L16 = 16-bit
        sample_rate = 24000
        num_channels = 1

        for p in parts[1:]:
            if "rate=" in p:
                sample_rate = int(p.split("=")[1].strip())
            if "channels=" in p:
                num_channels = int(p.split("=")[1].strip())

        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8
        data_length = len(raw_audio)

        # WAV header (44 bytes)
        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + data_length,
            b'WAVE',
            b'fmt ',
            16,  # Subchunk1Size
            1,   # AudioFormat (PCM)
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            data_length,
        )
        return header + raw_audio
