---
name: release-verification
description: Run final pre-release and post-deployment verification before declaring work complete or releasing.
---
# Release Verification
Confirm intended branch/commit, understood diff, dependencies/lockfile, build, typecheck/lint, relevant tests, migration safety, secrets configuration without exposure, security review, and rollback path as applicable. For UI use `browser-ui-verification`. Production promotion requires explicit authorization. After deployment open the exact URL, confirm health, execute the critical path, verify the expected change, and inspect immediate errors. Only claim complete/fixed/deployed/working when evidence supports it.
