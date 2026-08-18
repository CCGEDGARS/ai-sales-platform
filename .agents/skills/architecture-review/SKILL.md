---
name: architecture-review
description: Review structural quality and maintainability for large features, refactors, duplicated logic, cross-cutting changes, data-model changes, or technical debt.
---
# Architecture Review
Review cohesion/responsibility, boundaries, dependency direction, duplication, state ownership, API contracts/failure modes, testability/observability/deployability/rollback, and avoidable network/database work. Do not add abstractions merely to look clean. Classify findings: Keep, Improve now, Improve later, Remove; explain the concrete cost prevented by every Improve now item.
