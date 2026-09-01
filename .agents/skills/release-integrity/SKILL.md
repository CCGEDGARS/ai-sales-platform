---
name: release-integrity
description: Enforce exact-SHA, fail-closed release status before calling this CCGROUP application latest, current, live, deployed, fixed in production, or proven.
---

# Release Integrity

Use this skill whenever work concerns release freshness, deployment status, production links, or whether a fix is actually live.

## Fixed status vocabulary

- **LATEST CODE** — newest intended source revision; deployment is not proven.
- **VERIFIED PREVIEW** — preview artifact proven for its exact SHA with applicable checks.
- **PROVEN PRODUCTION** — production artifact proven for its exact SHA with every mandatory gate satisfied.
- **LAST KNOWN WORKING** — older production known to work; never a substitute for current/latest.

## Fail-closed rule

Release status is fail-closed. Missing evidence, stale evidence, pending or failed CI, SHA mismatch, inaccessible production, failed health, skipped mandatory smoke checks, timeout, or unavailable verification is not success.

Never silently substitute an older deployment or old file and call it current or latest. If the newest intended revision is not proven, state the unresolved gate explicitly.

## Required proof chain

Before using latest/current/live/deployed/fixed-in-production/proven language for a production target:

1. Resolve the exact intended 40-character Git SHA.
2. Require `CCGROUP Release CI` success for that exact SHA.
3. Require a target-specific `release-proof*.json` for that exact SHA and environment.
4. Require live `/api/release` evidence to report that exact SHA, expected ref, and service.
5. Require stable release health and every configured mandatory smoke check to pass.
6. Require proof verdict `PROVEN`.

This repository has multiple production targets. Each target requires its own proof; success on one target never proves another.

Never place secrets, API keys, cookies, authorization values, private provider responses, or credentials in proof records or status reports.
