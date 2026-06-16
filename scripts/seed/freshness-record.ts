// Persists the result of a freshness check to data/freshness.json. Written both
// by the seed pipeline (at seed time the live source was fetched, so the manual
// was confirmed current) and by the scheduled freshness check. The committed
// record is what the ambient footer reads to show "manual last checked".

import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Freshness } from "../../lib/types";

export async function writeFreshness(
  dataDir: string,
  record: Freshness,
): Promise<void> {
  await writeFile(
    path.join(dataDir, "freshness.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
}
