# NCAA Rules Assistant

Ask NCAA Division I rules questions in plain English and get the answer with the
exact bylaw cite and the verbatim rule text to verify. A fast research aid for
UC San Diego Triton Athletics coaches and staff. **Not a compliance ruling:
confirm with the Athletics compliance office before acting.**

A lightweight Next.js app (deployed on Vercel) that grounds every answer in the
official Division I Manual using build-time retrieval (RAG): the manual is parsed
into per-bylaw chunks, embedded, and committed as an in-memory index. At query
time it retrieves the relevant bylaws and the model answers **only** from that
closed set, so it never invents rules or cites. Citations are validated against
the retrieved set and the verbatim text is re-attached from the corpus, never
from the model. On a model failure the app degrades to retrieval-only results.

Models run on the TritonAI hub (`gpt-oss-120b` primary, `gpt-5.5` fallback,
`api-tgpt-embeddings` for embeddings).

## What's in `data/`

The repo ships with a real, committed index of the **2025-26 Division I Manual**
(3,256 bylaw chunks), so the app works out of the box once the hub credentials
are set. Provenance lives in `data/manifest.json` (source URL, content hash,
academic year, embed model, chunk count). Re-seeding is only needed when the NCAA
publishes a new manual — see below.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in TRITONAI_BASE_URL and TRITONAI_API_KEY
```

Only `TRITONAI_BASE_URL` and `TRITONAI_API_KEY` are required to run against the
committed index. Model names and call limits have sane defaults in
`.env.example`.

## Develop

```bash
npm run dev        # http://localhost:3000
npm run typecheck
npm test           # parser/QA unit tests
npm run evals      # retrieval recall gate (uses whatever index is in data/)
npm run lint
npm run build
```

`GET /api/health` reports whether the index is loaded plus the manual version,
content hash, and chunk count. `POST /api/ask` is the grounded answer endpoint.

## Re-seeding the manual

You only need this when the NCAA publishes a new Division I Manual. Re-seeding
rebuilds the three committed artifacts in `data/`:

- `index.meta.json` — chunk text + metadata (git-diffable)
- `index.vectors.bin` — packed float32 embedding matrix
- `manifest.json` — provenance (source, content hash, embed model, counts)

```bash
# Real index (needs hub creds and network access to the LSDBi source host):
npm run seed
# or from a manually downloaded PDF (use when the source host is firewalled):
npm run seed -- --pdf path/to/division-i-manual.pdf

# Offline demo/CI index from a SYNTHETIC fixture (no creds, no network):
npm run seed:mock
```

You can also trigger a re-seed from the GitHub Actions UI via the `manual-seed`
workflow, which opens a PR with the regenerated index for review.

> Network note: the LSDBi source host must be reachable from where `npm run seed`
> runs. Some managed/CI networks block it (`Host not in allowlist`); in that case
> download the PDF and use `--pdf`. The synthetic fixture is clearly labeled in
> the UI footer ("Fixture data, not real rules") and is never authoritative.

## How it stays current

`npm run seed:check-freshness` compares the live manual's content hash to the
committed `data/manifest.json`. The weekly `manual-freshness` GitHub Action runs
it and fails loudly on a new manual so a maintainer re-seeds and reviews the
`data/index.meta.json` diff in a PR. Legal text is never rewritten automatically.

## Project layout

```
app/            Next.js routes + UI (page, layout, /api/ask, /api/health)
components/     SearchBox, AnswerCard, CitationBlock, Disclaimer, FooterStatus, ...
lib/            retrieval, embeddings, chat, prompt, index-loader, audit, vectors
scripts/seed/   fetch → parse → enrich → embed → build-index, plus check-freshness
data/           committed index + manifest (see above)
evals/          retrieval recall gate (run-evals.ts + grounded-citation eval)
tests/          parser/QA unit tests
docs/           design notes, accessibility statement, AI feature inventory, rights/appeal
```

## Governance

This repo follows two binding documents: `seed-style-guide.md` (International
Typographic Style + WCAG 2.1 AA) and `responsible-ai-seed-principles.md` (UC
Responsible AI). See `docs/` for the design notes, accessibility statement, AI
feature inventory, and the rights/appeal path.
</content>
</invoke>
