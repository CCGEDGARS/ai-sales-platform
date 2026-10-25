# Audio Transcription Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute inline in this session.

**Goal:** Accept common audio and WhatsApp recordings through the existing video upload flow.
**Architecture:** Shared MIME resolver for browser and API validation, native temporary FLAC normalization in the secure upload worker, audio-aware client processing and exports.
**Tech Stack:** Next.js, TypeScript, Gemini Files API, FastAPI, FFmpeg.
**Spec:** docs/superpowers/specs/2026-10-25-audio-transcription.md

## Global Constraints

- Preserve originals and existing video behavior.
- Never send audio to visual analysis.
- Preserve actual source duration and timeline offsets.
- Require exact-SHA release proofs before claiming production success.

## Review Focus

- WhatsApp OPUS with blank or generic MIME must be accepted.
- Contradictory MIME/extension and unsupported files must not silently become MP4.
- Audio-only and mixed batches need correct duration and visual-pass behavior.
- Browser metadata errors or Infinity must terminate safely.
- Temporary conversion artifacts must be removed after success and failure.

### Task 1: Media contracts and server routes
- [x] Write and run failing MIME/route tests, then implement shared media helpers and update both upload/transcription routes.
- [x] Run the media tests and repository suite.

### Task 2: Audio preparation and client integration
- [x] Write failing worker tests, including real FFmpeg audio fixtures.
- [x] Normalize audio derivatives and return source duration; update client selection, labels, metadata, cumulative offsets and visual gating.
- [x] Run worker tests, repository tests, TypeScript and production build.

### Task 3: Review and release
- [x] Review the final diff and test input classes listed above.
- [ ] Publish the verified commit to the existing deployment branch; monitor both web targets and the worker.
- [ ] Exercise audio upload/transcription and produce exact-SHA release proof; report any unresolved gate honestly.

## Verified implementation

110 JavaScript tests passed; six Python worker tests passed (real FFmpeg fixtures); Next production build passed. Independent review found native short-source truncation and missing executable orchestration coverage. The truncation regression was reproduced (75-second source returned only 60 seconds), fixed, and verified. Added real client-function tests for mixed timelines and visual-pass suppression, plus proxy-level misleading WebM MIME and cleanup-failure coverage. No deferred important findings. Release proof is generated independently for the exact published commit.
