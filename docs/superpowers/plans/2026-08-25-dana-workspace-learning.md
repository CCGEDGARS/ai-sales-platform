# DANA AI Workspace Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every uploaded DANA source automatically become verified, persistent, workspace-wide production learning that is reused across transcription, voice-over and all current production activities.

**Architecture:** Persist learning in the dedicated Neon Postgres project through Neon Data API, authenticated with Vercel's short-lived OIDC token rather than a static database secret. Documents are extracted once; videos use the existing Gemini upload/transcription path. A background OpenAI learning job distills each complete source into a verified DANA Learning Profile, stores source truth and provenance, creates retrieval chunks, and exposes one shared server-side learning-context builder consumed by AI routes.

**Tech Stack:** Next.js 16.3.2 App Router, TypeScript 5.9, Vercel Functions/OIDC, Neon Postgres Data API, Gemini 3.6 Flash video transcription, OpenAI Responses background jobs, existing mammoth/pdf-parse ingestion, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-dana-workspace-learning-design.md`

## Global Constraints

- Every newly uploaded source defaults to workspace-wide `Use for learning = ON`.
- Mandatory authority order: TV-channel rules → DANA Master Production System → Canonical references → Strong → Supporting → Experimental.
- The `piektā vakariņotāja` rule cannot be disabled by learned material.
- Never mark a source `Learned ✓` until source truth is persisted and profile verification passes.
- Large video bytes are transient; retain transcript, profile, fingerprint and provenance, not raw multi-gigabyte media.
- Source-specific facts remain source-bound and cannot leak into another episode without confirmation from current material.
- Long AI analysis uses background/polling architecture; no single long Vercel request.
- Existing transcription, Lepers, editorial-tone, ratio and fifth-diner behavior must remain regression-green.

---

### Task 1: Persistent learning store and secure Vercel→Neon access

**Files:**
- Create: `app/lib/learning-types.ts`
- Create: `app/lib/learning-data-api.ts`
- Create: `tests/workspace-learning.test.mjs`
- Database: dedicated Neon `DANA AI Production Learning` project, `neondb`

**Interfaces:**
- Produces `LearningSource`, `LearningProfile`, `LearningAuthority`, `LearningStatus` types.
- Produces `learningApiFetch(request, path, init)` and `requireVercelOidc(request)`.
- Neon access uses `x-vercel-oidc-token` on runtime requests and the public Neon Data API URL; no database password is stored in the repo or browser.

- [ ] Write failing tests requiring persistent learning types, Vercel OIDC forwarding, production-only access guard, and no `DATABASE_URL`/hard-coded Postgres password.
- [ ] Run `npm test` and confirm those tests fail for missing learning files.
- [ ] Create Neon tables `learning_sources`, `learning_source_content`, `learning_profiles`, `learning_chunks`, `learning_events`; add FK/indexes; enable RLS; grant only authenticated Data API role; allow the DANA Studio production Vercel subject.
- [ ] Implement `learning-types.ts` and `learning-data-api.ts` with the Neon Data API base URL, Vercel OIDC header forwarding, strict error parsing and no secret persistence.
- [ ] Run `npm test` and confirm Task 1 tests pass.

### Task 2: Source repository API, fingerprints, duplicate/version handling

**Files:**
- Create: `app/api/learning-sources/route.ts`
- Create: `app/api/learning-sources/[id]/route.ts`
- Create: `app/lib/learning-repository.ts`
- Modify: `tests/workspace-learning.test.mjs`

**Interfaces:**
- `registerLearningSource(request, input)` returns `{ source, duplicate }`.
- `saveLearningSourceContent(request, sourceId, content)` persists full extracted text/transcript before analysis completion.
- `updateLearningSource`, `deleteLearningSource`, `listLearningSources` operate through Neon Data API.

- [ ] Add failing tests for source fingerprint, default `active=true`, default `authority='supporting'`, duplicate detection, same-name/new-bytes versioning, list/toggle/remove APIs and provenance fields.
- [ ] Run tests and confirm RED.
- [ ] Implement browser-compatible SHA-256 fingerprint helper using filename/size/full bytes before source registration.
- [ ] Implement repository and API routes; deleting/toggling a source must immediately affect future retrieval.
- [ ] Run tests and confirm GREEN.

### Task 3: Deep learning analyzer with background OpenAI job and verification

**Files:**
- Create: `app/api/learn-source/route.ts`
- Create: `app/lib/learning-contract.ts`
- Create: `app/lib/learning-profile.ts`
- Modify: `tests/workspace-learning.test.mjs`

**Interfaces:**
- POST `/api/learn-source` receives source metadata + persisted source truth and starts a background OpenAI Responses job.
- GET `/api/learn-source?responseId=...&sourceId=...` polls the durable job, validates structured output, persists profile/chunks/events, then marks the source learned.
- `verifyLearningProfile(profile)` returns coverage/completeness/conflicts/verified.

- [ ] Add failing tests requiring background Responses usage, explicit editorial-learning contract, source-bound evidence, authority-conflict reporting, required profile sections and `Learned` gating.
- [ ] Run tests and confirm RED.
- [ ] Implement the learning contract: narrator role, humour, sentence rhythm, VO density, structure, character treatment, pacing, escalation, callbacks, transitions, editing/reaction logic, promo, language patterns, works/weakens/avoid/rules, representative evidence and tags.
- [ ] Implement background POST/GET with stored OpenAI HTTP-only credentials, JSON extraction/repair, profile verification and event persistence.
- [ ] Persist full source truth before profile status can move to `learned`.
- [ ] Create categorized `learning_chunks` from verified profile only.
- [ ] Run tests and confirm GREEN.

### Task 4: Shared workspace learning retrieval service

**Files:**
- Create: `app/lib/workspace-learning.ts`
- Modify: `app/api/generate-voiceover/route.ts`
- Modify: `app/api/transcribe/route.ts`
- Modify: `app/api/transcribe-uploaded/route.ts`
- Modify: `tests/workspace-learning.test.mjs`

**Interfaces:**
- `buildWorkspaceLearningContext(request, { activity, query, tone, currentTranscript, maxCharacters })` returns provenance-labelled context.

- [ ] Add failing tests for authority ordering, inactive exclusion, verified-only retrieval, canonical Lepers weighting, fifth-diner invariant and current-episode fact boundary.
- [ ] Run tests and confirm RED.
- [ ] Implement retrieval ranking by governing authority → canonical → relevance/tags → recency, with context budget and provenance labels.
- [ ] Inject retrieved learning into voice-over generation and transcription context without replacing current transcript/reference truth.
- [ ] Preserve Lepers canonical contract as governing content even when learned sources disagree.
- [ ] Run tests and confirm GREEN.

### Task 5: Automatic document and MKV/video learning pipeline

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/ingest-reference/route.ts`
- Modify: `tests/source-ingestion.test.mjs`
- Modify: `tests/workspace-learning.test.mjs`

**Interfaces:**
- `onSources()` becomes: fingerprint → register → extract/transcribe → persist source truth → start learning → poll → refresh Learning Library.
- Video path reuses `uploadVideoDirectlyToGemini`, `waitForGeminiVideo`, `/api/transcribe-uploaded`.

- [ ] Add failing tests requiring MKV/MP4/MOV/WEBM/AVI/M4V to enter the automatic transcript→learning pipeline rather than filename-only registration.
- [ ] Add failing tests requiring DOCX/PDF/TXT/SRT/VTT/MD/CSV to auto-start learning immediately after extraction.
- [ ] Run tests and confirm RED.
- [ ] Implement automatic document flow with no extra activation click.
- [ ] Implement automatic video flow through Gemini, persisting complete timecoded transcript before OpenAI analysis.
- [ ] Implement duplicate `Already learned` and `Re-analyze` behavior.
- [ ] Keep raw video transient after successful learning.
- [ ] Run tests and confirm GREEN.

### Task 6: Learning Library UI and inspectability

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/modules.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/workspace-learning.test.mjs`

**Interfaces:**
- Library row displays source, lifecycle status, authority, learning toggle, learned time, View learning, Remove/Re-analyze.
- Profile inspector shows distilled learning, evidence, tags, conflicts and verification.

- [ ] Add failing tests for lifecycle labels `Uploading`, `Extracting / Transcribing`, `Analyzing`, `Extracting learning`, `Verifying`, `Learned ✓`, `Needs attention`, `Retry available`.
- [ ] Add failing tests for `Use for learning` toggle and `View learning` inspector.
- [ ] Run tests and confirm RED.
- [ ] Implement server-backed Learning Library hydration on page load with device-local legacy source migration preserved as a compatibility layer.
- [ ] Implement lifecycle status card, profile inspector, toggle, authority badge, re-analyze and remove actions.
- [ ] Run tests and confirm GREEN.

### Task 7: Production DB verification and migration of governing source behavior

**Files:**
- Modify: `docs/superpowers/specs/2026-08-25-dana-workspace-learning-design.md`
- Modify: `tests/workspace-learning.test.mjs`

**Interfaces:**
- Document the secure Neon Data API + Vercel OIDC implementation refinement.
- Existing code-level TV channel and Lepers invariants remain authoritative even before any learned profile exists.

- [ ] Verify Neon schema directly: all five tables, RLS enabled, production project subject policy, no anonymous writes.
- [ ] Verify Data API rejects unauthenticated calls and accepts a production Vercel OIDC-backed API request.
- [ ] Verify a test source can be created, content saved, profile verified, retrieved, disabled and excluded, then removed.
- [ ] Update architecture doc from Drizzle connection-string recommendation to implemented Neon Data API + Vercel OIDC transport while preserving PostgreSQL schema contract.

### Task 8: Full regression, release and live end-to-end verification

**Files:**
- All touched implementation files and tests.

- [ ] Run `npm test`; require 0 failures.
- [ ] Run `npm run build`; require Next.js compilation + TypeScript pass.
- [ ] Run `npm audit --omit=dev --audit-level=high`; require no high/critical production vulnerabilities.
- [ ] Remove all one-shot implementation scripts/workflows before merge.
- [ ] Review final diff against the approved spec requirement-by-requirement.
- [ ] Open PR to `main`, review changed files, merge only after verified branch build.
- [ ] Wait for Vercel production deployment `READY` and confirm commit SHA matches merge commit.
- [ ] Fetch live production page and learning API health.
- [ ] Perform live source smoke test using a small supported document; verify `Learned ✓` is reached and survives refresh.
- [ ] Confirm production runtime logs show no learning-route errors.
