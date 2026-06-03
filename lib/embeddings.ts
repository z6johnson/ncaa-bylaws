// Embeddings client. Real embeddings come from the TritonAI model hub
// (api-tgpt-embeddings) via the LiteLLM OpenAI-compatible proxy.
//
// Data path: text in -> hub /embeddings -> vectors out. No PII is sent: inputs
// are bylaw text (seed) or rule questions (query). retention/training disabled.
//
// A deterministic local "mock" embedder is provided for offline dev/CI only. It
// is NEVER an authoritative source; it lets the pipeline and retrieval math run
// without network or credentials. Manifest records which embedder built an index
// so query-time uses the SAME one (a mismatch silently destroys retrieval).

import { createHash } from "node:crypto";

export const MOCK_EMBED_MODEL = "mock-local-hash";
export const MOCK_EMBED_DIM = 256;

export interface EmbedResult {
  vectors: number[][];
  model: string;
  dim: number;
  mock: boolean;
}

/** Deterministic bag-of-features hashing embedder. Offline use only. */
export function mockEmbed(texts: string[]): number[][] {
  return texts.map((text) => {
    const vec = new Array<number>(MOCK_EMBED_DIM).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9.]+/g) ?? [];
    for (const tok of tokens) {
      const h = createHash("md5").update(tok).digest();
      const idx = h.readUInt32LE(0) % MOCK_EMBED_DIM;
      const sign = (h[4] & 1) === 0 ? 1 : -1;
      vec[idx] += sign;
    }
    const norm = Math.hypot(...vec) || 1;
    return vec.map((v) => v / norm);
  });
}

async function hubEmbedOnce(
  texts: string[],
  baseUrl: string,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: texts }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // 429 (rate limit) and 5xx (server) are transient; tag so the caller retries.
      const transient = res.status === 429 || res.status >= 500;
      const err = new Error(`embeddings hub error ${res.status}: ${await res.text()}`);
      (err as { transient?: boolean }).transient = transient;
      throw err;
    }
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  } finally {
    clearTimeout(timer);
  }
}

/** Is this error worth retrying (timeout / network blip / 429 / 5xx)? */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    if ((err as { transient?: boolean }).transient) return true;
    // AbortError = our timeout fired; TypeError = fetch network failure (ECONNRESET, etc).
    if (err.name === "AbortError" || err.name === "TypeError") return true;
  }
  return false;
}

async function hubEmbed(texts: string[]): Promise<number[][]> {
  const baseUrl = requireEnv("TRITONAI_BASE_URL");
  const apiKey = requireEnv("TRITONAI_API_KEY");
  const model = process.env.EMBED_MODEL ?? "api-tgpt-embeddings";
  const timeoutMs = Number(process.env.MODEL_TIMEOUT_MS ?? 30000);
  const maxRetries = Number(process.env.EMBED_MAX_RETRIES ?? 4);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await hubEmbedOnce(texts, baseUrl, apiKey, model, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries || !isRetryable(err)) break;
      // Exponential backoff with jitter: 1s, 2s, 4s, 8s (+/- up to 1s).
      const backoff = 1000 * 2 ** attempt + Math.floor(Math.random() * 1000);
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[embed] batch attempt ${attempt + 1}/${maxRetries + 1} failed (${reason}); retrying in ${backoff}ms`,
      );
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/** Embed a batch of texts. Set `mock` for offline dev/CI. */
export async function embedTexts(texts: string[], opts: { mock?: boolean } = {}): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], model: "", dim: 0, mock: !!opts.mock };
  if (opts.mock) {
    const vectors = mockEmbed(texts);
    return { vectors, model: MOCK_EMBED_MODEL, dim: MOCK_EMBED_DIM, mock: true };
  }
  const vectors = await hubEmbed(texts);
  return {
    vectors,
    model: process.env.EMBED_MODEL ?? "api-tgpt-embeddings",
    dim: vectors[0]?.length ?? 0,
    mock: false,
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
