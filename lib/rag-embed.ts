import { errorMessage } from '@/lib/utils';
/**
 * Gemini Embedding helper for RAG — calls Vertex AI directly from Node.js.
 *
 * Uses @google/genai SDK (already installed) with service account (GCA_KEY).
 * Two routes:
 * - v2 (default): gemini-embedding-2 — multimodal, prompt-based, auto-normalized
 * - v1: gemini-embedding-001 — text-only, task_type based, manual normalization
 *
 * Both truncate to 768 dimensions via output_dimensionality.
 */

import { GoogleGenAI, type EmbedContentResponse } from '@google/genai';

// ── Config ──────────────────────────────────────────────────────────────────

const GCA_KEY = process.env.GCA_KEY;
const API_KEY = process.env.GOOGLE_CLOUD_API_KEY;

const EMBEDDING_MODEL_V2 = 'gemini-embedding-2';
const EMBEDDING_MODEL_V1 = 'gemini-embedding-001';
export const EMBEDDING_DIM = 768;

// ── Prompt-based helpers (v2) ──────────────────────────────────────────────

function prepareDocumentV2(title: string, content: string): string {
  return `title: ${title || 'none'} | text: ${content}`;
}

function prepareQueryV2(query: string): string {
  return `task: search result | query: ${query}`;
}

// ── Client factory ─────────────────────────────────────────────────────────

function getClient(route: 'v1' | 'v2'): GoogleGenAI {
  if (route === 'v2') {
    // v2 uses service account (GCA_KEY) + location='us'
    if (!GCA_KEY) throw new Error('GCA_KEY env var not set — required for v2 embedding route');
    const sa = JSON.parse(GCA_KEY);
    return new GoogleGenAI({
      vertexai: true,
      project: sa.project_id,
      location: 'us',
    });
  }
  // v1 uses API key (no location)
  if (!API_KEY) throw new Error('GOOGLE_CLOUD_API_KEY env var not set — required for v1 embedding route');
  return new GoogleGenAI({ apiKey: API_KEY });
}

// ── Embedding functions ────────────────────────────────────────────────────

/** Embed a list of document texts for indexing (stores into rag_chunks). */
export async function embedDocuments(
  texts: string[],
  titles: (string | null)[] = [],
  route: 'v1' | 'v2' = 'v2',
): Promise<number[][]> {
  if (!texts.length) return [];

  const client = getClient(route);
  const model = route === 'v2' ? EMBEDDING_MODEL_V2 : EMBEDDING_MODEL_V1;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const title = titles[i] || null;

    try {
      let result: EmbedContentResponse;

      if (route === 'v2') {
        // v2: prompt-based, individual call, auto-normalized
        const prepared = prepareDocumentV2(title || 'none', texts[i]);
        result = await client.models.embedContent({
          model,
          contents: prepared,
          config: { outputDimensionality: EMBEDDING_DIM },
        });
      } else {
        // v1: task_type=RETRIEVAL_DOCUMENT, manual normalization
        result = await client.models.embedContent({
          model,
          contents: [texts[i]],
          config: {
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: EMBEDDING_DIM,
          },
        });
      }

      const values = result.embeddings?.[0]?.values;
      if (!values || values.length === 0) {
        console.error(`[rag-embed] Empty embedding for doc ${i}`);
        embeddings.push(new Array(EMBEDDING_DIM).fill(0));
        continue;
      }

      if (route === 'v1') {
        // v1: manual L2 normalization
        const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
        embeddings.push(norm > 0 ? values.map(v => v / norm) : values);
      } else {
        embeddings.push(values);
      }
    } catch (e) {
      console.error(`[rag-embed] Embedding failed for doc ${i}:`, errorMessage(e));
      embeddings.push(new Array(EMBEDDING_DIM).fill(0));
    }
  }

  return embeddings;
}

/** Embed a single query for search (semantic / hybrid). */
export async function embedQuery(
  query: string,
  route: 'v1' | 'v2' = 'v2',
): Promise<number[]> {
  const client = getClient(route);
  const model = route === 'v2' ? EMBEDDING_MODEL_V2 : EMBEDDING_MODEL_V1;

  try {
    let result: EmbedContentResponse;

    if (route === 'v2') {
      const prepared = prepareQueryV2(query);
      result = await client.models.embedContent({
        model,
        contents: prepared,
        config: { outputDimensionality: EMBEDDING_DIM },
      });
    } else {
      result = await client.models.embedContent({
        model,
        contents: [query],
        config: {
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: EMBEDDING_DIM,
        },
      });
    }

    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      console.error('[rag-embed] Empty query embedding');
      return new Array(EMBEDDING_DIM).fill(0);
    }

    if (route === 'v1') {
      const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
      return norm > 0 ? values.map(v => v / norm) : values;
    }
    return values;
  } catch (e) {
    console.error('[rag-embed] Query embedding failed:', errorMessage(e));
    return new Array(EMBEDDING_DIM).fill(0);
  }
}

/** Embed an image for cross-modal search (v2 only — multimodal). */
export async function embedImage(
  imageBytes: Buffer | Uint8Array,
  mimeType: string = 'image/jpeg',
  title: string = 'none',
): Promise<number[]> {
  if (!GCA_KEY) throw new Error('GCA_KEY env var not set — required for image embedding');
  const sa = JSON.parse(GCA_KEY);
  const client = new GoogleGenAI({
    vertexai: true,
    project: sa.project_id,
    location: 'us',
  });

  try {
    const preparedText = prepareDocumentV2(title, 'invoice image');
    // Gemini multimodal embedding: combine text + image
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL_V2,
      contents: [
        preparedText,
        { inlineData: { data: Buffer.from(imageBytes).toString('base64'), mimeType } },
      ],
      config: { outputDimensionality: EMBEDDING_DIM },
    });

    return result.embeddings?.[0]?.values || new Array(EMBEDDING_DIM).fill(0);
  } catch (e) {
    console.error('[rag-embed] Image embedding failed:', errorMessage(e));
    return new Array(EMBEDDING_DIM).fill(0);
  }
}
