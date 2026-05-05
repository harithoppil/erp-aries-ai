"""Media MCP Server — AI-generated images and speech.

Tools:
- generate_image: Generate an image from a text prompt
- generate_speech: Convert text to speech audio
"""

import asyncio
import logging

from backend.app.mcp_servers.gateway import gateway, MCPTool

logger = logging.getLogger("aries.mcp.media")


async def _generate_image(prompt: str, aspect_ratio: str = "auto",
                           image_size: str = "1K") -> dict:
    """Generate an image using Gemini image model.

    Args:
        prompt: Description of the image to generate.
        aspect_ratio: "auto", "1:1", "16:9", "9:16", "4:3", "3:4"
        image_size: "1K" or "2K"

    Returns:
        Dict with image_id and metadata.
    """
    from backend.app.services.gemini import GeminiService
    gemini = GeminiService()
    image_bytes = await gemini.generate_image(
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        image_size=image_size,
    )
    # Store the image and return reference
    import uuid
    image_id = str(uuid.uuid4())

    # Save to disk for serving
    from pathlib import Path
    media_dir = Path("media/generated")
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / f"{image_id}.png").write_bytes(image_bytes)

    logger.info("Generated image %s: %.1fKB", image_id, len(image_bytes) / 1024)
    return {
        "image_id": image_id,
        "url": f"/api/v1/ai/media/{image_id}.png",
        "size_bytes": len(image_bytes),
        "format": "png",
        "prompt": prompt[:200],
    }


async def _generate_speech(text: str, voice_name: str = "Achernar") -> dict:
    """Convert text to speech audio using Gemini TTS model.

    Args:
        text: Text to convert to speech.
        voice_name: Voice name (Achernar, Aoede, Charon, Fenrir, Kore, Puck).

    Returns:
        Dict with audio_id and metadata.
    """
    from backend.app.services.gemini import GeminiService
    gemini = GeminiService()
    audio_bytes = await gemini.generate_speech(
        text=text,
        voice_name=voice_name,
    )
    # Store the audio and return reference
    import uuid
    audio_id = str(uuid.uuid4())

    from pathlib import Path
    media_dir = Path("media/generated")
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / f"{audio_id}.wav").write_bytes(audio_bytes)

    logger.info("Generated speech %s: %.1fKB, voice=%s", audio_id, len(audio_bytes) / 1024, voice_name)
    return {
        "audio_id": audio_id,
        "url": f"/api/v1/ai/media/{audio_id}.wav",
        "size_bytes": len(audio_bytes),
        "format": "wav",
        "voice": voice_name,
        "text_preview": text[:200],
    }


def register_media_server():
    """Register media generation tools with the MCP gateway."""
    gateway.register_tool("media", MCPTool(
        name="generate_image",
        description="Generate an image from a text description. Use for proposal covers, diagrams, visualizations.",
        server="media",
        handler=_generate_image,
        requires_auth=True,
    ))
    gateway.register_tool("media", MCPTool(
        name="generate_speech",
        description="Convert text to speech audio. Use for voice messages on WhatsApp/Telegram, audio summaries.",
        server="media",
        handler=_generate_speech,
        requires_auth=True,
    ))
    logger.info("Registered media MCP tools: generate_image, generate_speech")
