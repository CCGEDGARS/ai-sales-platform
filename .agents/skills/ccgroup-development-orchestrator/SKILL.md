---
name: ccgroup-development-orchestrator
description: Orchestrate substantial software work from inspection through specification, implementation, testing, security review, browser verification, and final evidence. Use for new features, non-trivial fixes, refactors, upgrades, or multi-file work.
---
# CCGROUP Development Orchestrator
Do not declare work complete because code was written. Completion requires evidence.
1. Inspect instructions, docs, config, tests, current behavior, branch, and environment before editing.
2. Define observable outcome and acceptance criteria; use `spec-driven-development` for non-trivial work.
3. Make the smallest coherent root-cause fix and preserve existing behavior unless explicitly changed.
4. Use `test-driven-development` and `systematic-debugging` as applicable.
5. Use `architecture-review`, `security-review`, and `browser-ui-verification` where relevant.
6. Never promote/deploy/overwrite/delete production without explicit authorization.
7. Use `release-verification` before claiming completion and report evidence plus anything unverified.
