// Health + provenance endpoint. Powers the ambient footer (manual version,
// AI-in-use indicator) and lets monitoring confirm the index is loaded.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { tryLoadIndex } from "@/lib/index-loader";
import type { Freshness } from "@/lib/types";

export const runtime = "nodejs";

/** Best-effort load of the committed freshness record. Absent on indexes seeded
 *  before freshness tracking existed, so callers must tolerate null. */
async function tryLoadFreshness(): Promise<Freshness | null> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "freshness.json"),
      "utf8",
    );
    return JSON.parse(raw) as Freshness;
  } catch {
    return null;
  }
}

export async function GET() {
  const [index, freshness] = await Promise.all([
    tryLoadIndex(),
    tryLoadFreshness(),
  ]);
  const model = process.env.CHAT_MODEL_PRIMARY ?? "gpt-oss-120b";
  if (!index) {
    return NextResponse.json(
      { seeded: false, model, manualVersion: null },
      { status: 200 },
    );
  }
  const { manifest } = index;
  return NextResponse.json({
    seeded: true,
    model,
    manualVersion: `${manifest.academicYear} Division I Manual`,
    sourceUrl: manifest.sourceUrl,
    effectiveDate: manifest.effectiveDate ?? null,
    contentSha256: manifest.contentSha256.slice(0, 12),
    // Latest time the underlying data was refreshed (re-seeded from source).
    retrievedAt: manifest.retrievedAt,
    chunkCount: manifest.chunkCount,
    mockEmbeddings: !!manifest.mockEmbeddings,
    // Last time the live source was checked for a newer manual.
    lastCheckedAt: freshness?.checkedAt ?? null,
    lastCheckResult: freshness?.result ?? null,
    lastCheckMatched: freshness?.matchesCommitted ?? null,
  });
}
