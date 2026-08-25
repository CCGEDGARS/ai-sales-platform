# Lepers Golden Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lepers mode produce consistently reference-matched production packages by enforcing a deterministic Golden Master fingerprint, 95/100 minimum conformance score, and automatic corrective regeneration.

**Architecture:** Add a focused `lepers-golden-master.ts` scoring module derived from the approved Rihards Lepers reference. Generation remains transcript-grounded, but Lepers outputs are measured after each model pass against structural, depth, VO amount, fifth-diner humour, pacing, production-usefulness, promo, character-insight and formatting criteria. Any result below 95/100 is automatically revised before it can be returned to the user.

**Tech Stack:** Next.js 16, TypeScript, OpenAI Responses background jobs, Node test runner, existing DOCX export.

**Spec:** Approved conversation design: Lepers Golden Master · locked 10/10 benchmark.

## Global Constraints

- TV-channel fifth-diner rule remains mandatory and higher priority than style matching.
- DANA Master Production System remains governing source.
- Current transcript remains factual source of truth.
- Golden Master controls production standard, not episode facts.
- Editorial brief remains a global scene directive beneath the locked rules.
- Golden Master threshold is 95/100.
- Voice-over ratio remains 16.67%, preferred 16.17%–17.17% at 130 Latvian WPM.
- Variation is allowed in content, never in production standard.

---

### Task 1: Golden Master fingerprint and scoring

**Files:**
- Create: `app/lib/lepers-golden-master.ts`
- Test: `tests/lepers-golden-master.test.mjs`

**Interfaces:**
- Produces: `LEPERS_GOLDEN_MASTER_NAME`, `LEPERS_GOLDEN_MASTER_THRESHOLD`, `LEPERS_GOLDEN_MASTER_FINGERPRINT`, `scoreLepersGoldenMaster(text, runtimeSeconds)`.

- [ ] Write failing test asserting the Golden Master constants, 95 threshold, nine weighted dimensions totaling 100, seven-act reference architecture, five teaser beats, four social hooks, 16-page reference provenance and score function.
- [ ] Verify RED.
- [ ] Implement deterministic scoring with named dimension scores and actionable deficiencies.
- [ ] Verify GREEN.

### Task 2: Generation and automatic correction integration

**Files:**
- Modify: `app/api/generate-voiceover/route.ts`
- Modify: `app/lib/lepers-standard.ts`
- Test: `tests/lepers-golden-master.test.mjs`

**Interfaces:**
- Consumes `scoreLepersGoldenMaster()`.
- Returns `goldenMaster` metrics in completed Lepers responses.

- [ ] Add failing assertions for Golden Master import, locked benchmark instructions, threshold correction and conformance payload.
- [ ] Verify RED.
- [ ] Inject the fingerprint into Lepers generation and corrective prompts.
- [ ] Trigger correction when score <95, not just on ratio/format failure.
- [ ] Preserve the global editorial brief during correction through previous-response context and explicit instruction.
- [ ] Reject Lepers output after correction ceiling if Golden Master score still <95.
- [ ] Verify GREEN.

### Task 3: UI clarity and regression verification

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/lepers-golden-master.test.mjs`

- [ ] Add failing assertion that the UI names the mode `Lepers Golden Master · locked 10/10 benchmark` and exposes Golden Master match when returned.
- [ ] Verify RED.
- [ ] Preserve compatibility with saved old Lepers tone values while presenting the Golden Master label.
- [ ] Display `Golden Master Match: NN/100` with dimension breakdown after generation.
- [ ] Run full `npm test`.
- [ ] Run `npm run build` and TypeScript.
- [ ] Run production dependency audit.
- [ ] Merge only after preview and production verification pass.
