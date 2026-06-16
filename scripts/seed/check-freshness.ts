// Freshness check, run on a schedule by .github/workflows/manual-freshness.yml.
// Re-fetches the source manual, compares its content SHA-256 to the committed
// manifest, and exits non-zero when a newer manual is detected so the workflow
// can open a re-seed PR for human review. It never rewrites legal text silently.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchManual } from "./fetch-manual";
import { writeFreshness } from "./freshness-record";
import type { Manifest } from "../../lib/types";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const manifest = JSON.parse(
    await readFile(path.join(dataDir, "manifest.json"), "utf8"),
  ) as Manifest;

  const fetched = await fetchManual({});
  const matches = fetched.contentSha256 === manifest.contentSha256;

  // Record the check before signalling its result, so the committed
  // data/freshness.json always reflects this run's timestamp.
  await writeFreshness(dataDir, {
    checkedAt: new Date().toISOString(),
    result: matches ? "up-to-date" : "new-manual-detected",
    matchesCommitted: matches,
    liveSha256: fetched.contentSha256,
    committedSha256: manifest.contentSha256,
    checkedBy: "freshness-check",
  });

  if (matches) {
    console.log(`[freshness] up to date (sha256 ${manifest.contentSha256.slice(0, 12)})`);
    return;
  }
  console.error("[freshness] NEW MANUAL DETECTED");
  console.error(`  committed: ${manifest.contentSha256}`);
  console.error(`  current:   ${fetched.contentSha256}`);
  console.error("  Run `npm run seed` and review the data/index.meta.json diff.");
  process.exit(2);
}

main().catch((err) => {
  console.error("[freshness] check failed:", err);
  // Exit 1 (error) is distinct from exit 2 (new manual) so the workflow can tell
  // a transient fetch failure from an actual update.
  process.exit(1);
});
