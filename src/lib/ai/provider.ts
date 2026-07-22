import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

import { getAiEnv } from "@/lib/env/server";

let provider: ReturnType<typeof createOpenAI> | null = null;
let providerKey: string | null = null;

export function getAiModel() {
  const env = getAiEnv();

  if (!provider || providerKey !== env.aiApiKey) {
    provider = createOpenAI({ apiKey: env.aiApiKey });
    providerKey = env.aiApiKey;
  }

  const modelId = env.aiModel.replace(/^openai\//, "");
  return { model: provider(modelId), modelId };
}
