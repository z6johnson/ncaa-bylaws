"use client";

import { useEffect, useState } from "react";

// Ambient status (style guide section 9): manual version, AI-in-use indicator,
// and data provenance, persistent in the footer, not a modal or toast. Maximizes
// transparency by surfacing where the data came from, when it was last refreshed,
// and when it was last checked for a newer manual.
interface Health {
  seeded: boolean;
  model: string;
  manualVersion: string | null;
  sourceUrl?: string;
  effectiveDate?: string | null;
  contentSha256?: string;
  retrievedAt?: string;
  chunkCount?: number;
  mockEmbeddings?: boolean;
  lastCheckedAt?: string | null;
  lastCheckResult?: "up-to-date" | "new-manual-detected" | null;
  lastCheckMatched?: boolean | null;
}

// Human-readable date (e.g. "Jun 2, 2026") with the full ISO timestamp on hover
// for anyone who needs the exact moment. UTC so the rendered date is stable.
function fmtDate(iso?: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default function FooterStatus() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const newManual = health?.lastCheckResult === "new-manual-detected";

  return (
    <footer className="border-t border-gray-3 mt-12">
      <div className="mx-auto w-full max-w-prose px-4 py-4 flex flex-col gap-2 text-meta text-gray-7">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            {health?.seeded
              ? `Source: ${health.manualVersion}`
              : "Manual not loaded"}
          </span>
          <span>AI-assisted &middot; model: {health?.model ?? "unknown"}</span>
          {health?.mockEmbeddings && (
            <span className="font-bold uppercase tracking-wide text-caution">
              Fixture data, not real rules
            </span>
          )}
          <span className="ml-auto">UC San Diego Athletics</span>
        </div>

        {health?.seeded && (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Data refreshed:{" "}
              <time dateTime={health.retrievedAt} title={health.retrievedAt}>
                {fmtDate(health.retrievedAt)}
              </time>
            </span>
            <span>
              Manual last checked:{" "}
              <time
                dateTime={health.lastCheckedAt ?? undefined}
                title={health.lastCheckedAt ?? undefined}
              >
                {fmtDate(health.lastCheckedAt)}
              </time>
              {health.lastCheckedAt && (
                <span className={newManual ? "text-caution font-semibold" : ""}>
                  {" "}
                  &middot;{" "}
                  {newManual ? "newer manual available" : "up to date"}
                </span>
              )}
            </span>
            {health.effectiveDate && (
              <span>Effective: {fmtDate(health.effectiveDate)}</span>
            )}
            {typeof health.chunkCount === "number" && (
              <span>{health.chunkCount.toLocaleString()} bylaws indexed</span>
            )}
            {health.contentSha256 && (
              <span className="font-mono" title="SHA-256 of the source PDF (version of record)">
                sha {health.contentSha256}
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
