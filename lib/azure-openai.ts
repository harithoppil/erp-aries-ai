import { OpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;

if (!endpoint || !apiKey) {
  throw new Error(
    "Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY env vars"
  );
}

export const azureOpenAI = new OpenAI({
  baseURL: endpoint,
  apiKey,
});

export type ModelKey = "gpt-5.4-nano" | "deepseek-v4-flash";

export const MODELS: Record<ModelKey, { name: string; deployment: string; pricing: { inputPer1M: number; cachedInputPer1M?: number; outputPer1M: number } }> = {
  "gpt-5.4-nano": {
    name: "GPT-5.4 Nano",
    deployment: process.env.AZURE_OPENAI_MODEL ?? "gpt-5.4-nano",
    pricing: { inputPer1M: 0.20, cachedInputPer1M: 0.02, outputPer1M: 1.25 },
  },
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash",
    deployment: process.env.AZURE_DEEPSEEK_MODEL ?? "DeepSeek-V4-Flash",
    pricing: { inputPer1M: 0.19, outputPer1M: 0.51 },
  },
};

export const DEFAULT_MODEL: ModelKey = "gpt-5.4-nano";

export async function chat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts?: {
    model?: ModelKey;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const modelKey = opts?.model ?? DEFAULT_MODEL;
  const model = MODELS[modelKey];

  const completion = await azureOpenAI.chat.completions.create({
    model: model.deployment,
    messages,
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens,
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const usage = completion.usage;

  return {
    content,
    usage,
    model: modelKey,
    cost: usage
      ? {
          input: (usage.prompt_tokens / 1e6) * model.pricing.inputPer1M,
          output: (usage.completion_tokens / 1e6) * model.pricing.outputPer1M,
          total:
            (usage.prompt_tokens / 1e6) * model.pricing.inputPer1M +
            (usage.completion_tokens / 1e6) * model.pricing.outputPer1M,
        }
      : null,
  };
}
