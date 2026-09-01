# DANA AI Production Studio Repository Operating Rules

## Release integrity is mandatory

For any work involving deployment status, production freshness, release links, or whether a fix is actually live, use `.agents/skills/release-integrity/SKILL.md` and the repository release-integrity system.

Release status is **fail-closed**. Never describe a build or URL as latest, current, live, deployed, fixed in production, production ready, or **PROVEN PRODUCTION** unless the target-specific `release-proof*.json` for the exact intended Git SHA and environment has verdict `PROVEN` and all mandatory gates are satisfied.

The required chain is:

`exact Git SHA -> CCGROUP Release CI success for same SHA -> live /api/release same SHA -> stable release health -> mandatory smoke checks -> target-specific release proof verdict PROVEN`

This repository deploys to more than one production target. Each target must be independently proven for the same intended SHA. Never use a proof from one domain to authorize another domain.

Never silently substitute an older deployment or old file when the newest intended revision is unproven. An older verified version may only be identified as **LAST KNOWN WORKING**, with the unresolved gate for the newer revision stated explicitly.

Use only these release labels when status matters: **LATEST CODE**, **VERIFIED PREVIEW**, **PROVEN PRODUCTION**, and **LAST KNOWN WORKING**.
