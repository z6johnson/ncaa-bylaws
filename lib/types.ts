// Shared contract between the seed pipeline, the API route, and the UI.

/** One bylaw section parsed from the Division I Manual. Verbatim text is the
 *  authoritative quotation shown to users; it is never paraphrased. */
export interface BylawChunk {
  /** Stable id: bylaw number + short content hash. */
  chunkId: string;
  /** Exact dotted-decimal cite, e.g. "11.1.1.1". */
  bylawNumber: string;
  /** Ancestor numbers, e.g. ["11", "11.1", "11.1.1"]. */
  parentPath: string[];
  /** Section heading as printed in the manual. */
  title: string;
  /** Verbatim rule text. Quoted source: exempt from the no-em-dash output rule. */
  verbatimText: string;
  /** Other bylaw numbers referenced within this section. */
  crossRefs: string[];
  /** Deterministic salient terms (TF-IDF/RAKE), used for lexical boost. */
  keywords: string[];
  pageStart?: number;
  pageEnd?: number;
}

/** Provenance for the seeded corpus. Shown in the ambient footer. */
export interface Manifest {
  sourceUrl: string;
  retrievedAt: string;
  /** Immutable content fingerprint of the source PDF — the version of record. */
  contentSha256: string;
  manualTitle: string;
  academicYear: string;
  effectiveDate?: string;
  embedModel: string;
  embedDim: number;
  chunkCount: number;
  buildCommit?: string;
  /** True when the index was built with the offline mock embedder (dev/CI only). */
  mockEmbeddings?: boolean;
}

/** Result of the most recent freshness check against the live source manual.
 *  Persisted to data/freshness.json so the footer can show when the manual was
 *  last verified current, independent of when the data was last refreshed. */
export interface Freshness {
  /** When the live source was last checked against the committed manual. */
  checkedAt: string;
  /** Outcome of that check. */
  result: "up-to-date" | "new-manual-detected";
  /** True when the live source matched the committed content hash. */
  matchesCommitted: boolean;
  /** Content hash of the live source at check time. */
  liveSha256: string;
  /** Content hash committed in the manifest at check time. */
  committedSha256: string;
  /** What ran the check: the seed pipeline or the scheduled freshness job. */
  checkedBy: "seed" | "freshness-check";
}

export type Coverage = "covered" | "partial" | "uncovered";

export interface Citation {
  bylawNumber: string;
  title: string;
  verbatimText: string;
  parentPath: string[];
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  coverage: Coverage;
  manualVersion: string;
  modelUsed: string;
  /** True when generation failed and we degraded to retrieval-only. */
  fallbackUsed: boolean;
  disclaimer: string;
}

export const DISCLAIMER =
  "Research aid, not a compliance ruling. Confirm with the UC San Diego Athletics compliance office before acting.";
