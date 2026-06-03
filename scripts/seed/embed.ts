// Embed bylaw chunks via the hub embeddings model (or the offline mock embedder
// for dev/CI). Batches requests; the embed input includes the bylaw number and
// title to enrich the semantic signal.

import type { BylawChunk } from "../../lib/types";
import { embedTexts } from "../../lib/embeddings";

const DEFAULT_BATCH = 64;

export async function embedChunks(
  chunks: BylawChunk[],
  opts: { mock?: boolean } = {},
): Promise<{ vectors: number[][]; model: string; dim: number; mock: boolean }> {
  const batchSize = Number(process.env.EMBED_BATCH_SIZE ?? DEFAULT_BATCH);
  const inputs = chunks.map(
    (c) => `Bylaw ${c.bylawNumber}: ${c.title}\n${c.verbatimText}`,
  );
  const vectors: number[][] = [];
  let model = "";
  let dim = 0;
  let mock = !!opts.mock;
  const total = Math.ceil(inputs.length / batchSize);
  for (let i = 0; i < inputs.length; i += batchSize) {
    const slice = inputs.slice(i, i + batchSize);
    const res = await embedTexts(slice, { mock: opts.mock });
    vectors.push(...res.vectors);
    model = res.model;
    dim = res.dim;
    mock = res.mock;
    // Progress so a long real-embed run shows life and a failure points at a batch.
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`[embed] batch ${batchNum}/${total} done (${vectors.length}/${inputs.length} chunks)`);
  }
  return { vectors, model, dim, mock };
}
