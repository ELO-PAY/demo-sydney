---
name: dev-feature-plan
description: >-
  Turns an approved feature spec into a concrete build plan and task checklist — validates the feature branch, resolves dev-layer findings, writes impl-plan.md (phases, decisions, risks, estimates) and tasks.md (dependency-ordered checklist with acceptance criteria). Self-contained: no other skills are invoked. Use when the operator says "plan this feature" or "how do we build this", or when pm-epic-writing hands off a completed spec.
---

# Dev Feature Plan

Translates a completed, analyzed feature spec into an implementation plan and
task list. Requires no client input after handoff.

## Inputs

- **Spec**: `.specify/features/{slug}/spec.md` (required)
- **Dev findings**: `.specify/features/{slug}/dev-findings.md` (optional, from pm-epic-writing)

## Step 1 — Validate the branch

```bash
git rev-parse --abbrev-ref HEAD
```

A feature branch matches `^[0-9]{3,}-` (sequential, `001-feature-name`) or
`^[0-9]{8}-[0-9]{6}-` (timestamp). On a feature branch → confirm and check the
matching `.specify/features/{prefix}-*` directory exists. Not on one → warn
("Feature branches look like 001-feature-name") and recommend creating one,
but **do not block** — the developer may proceed deliberately. No git repo →
skip with a warning.

## Step 2 — Load context

Read the spec, `dev-findings.md` (if present), and the corresponding epic
entry in `docs/product/epics.md`.

## Step 3 — Phase 0: resolve dev findings

For each HIGH finding in `dev-findings.md`: propose a concrete resolution
(data model definition, technical constraint, threshold) and document it in a
**Phase 0: Pre-Planning Decisions** section of the plan. A finding that needs
human input gets flagged explicitly — never silently skipped.

## Step 4 — Write the implementation plan

Write `.specify/features/{slug}/impl-plan.md` — implementation-agnostic
(*what* and *why*; the *how* happens during the build):

- **Phase 0 — Outline & research**: what's in Phase 1, what's deferred, what
  needs a prototype first, risks & assumptions (with mitigations)
- **Phase 1 — Design & contracts**: system architecture and component
  interactions, API contracts (endpoints, schemas, errors), data model,
  UI/UX flow, testing strategy
- **Phase 2+**: later milestones, each mapped to the spec requirements it
  delivers

Rules: number phases MVP-first; T-shirt effort (S/M/L/XL) per phase; call out
cross-phase dependencies; every risk carries a mitigation.

## Step 5 — Generate the task checklist (immediately, no pause)

Write `.specify/features/{slug}/tasks.md`. Every task is specific enough to
start without re-reading the spec — verb-first title, 1–2 sentence
description, testable acceptance criteria, grouped by phase:

```markdown
## Phase {N}: {Phase Name}

### Task {N}.{M}: {Verb + object}
**Description**: {1–2 sentences}
**Acceptance Criteria**:
- [ ] {testable criterion — cites the spec criterion it satisfies}
**Effort**: {S/M/L/XL}
**Dependencies**: {Task N.M, …} or "None"
```

Mark `[P]` on tasks that can run in parallel. Order by dependency.

## Step 6 — Summary

```
FEATURE PLAN COMPLETE
─────────────────────
Feature : {slug}
Spec    : .specify/features/{slug}/spec.md
Plan    : .specify/features/{slug}/impl-plan.md
Tasks   : .specify/features/{slug}/tasks.md
Dev findings resolved : {n}/{total} (unresolved: {IDs or "none"})

NEXT: review impl-plan.md, then start dev-tdd on Task 1.1 — each test cites
the acceptance criterion from spec.md it validates.
```
