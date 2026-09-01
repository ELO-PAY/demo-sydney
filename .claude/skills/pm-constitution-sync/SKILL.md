---
name: pm-constitution-sync
description: >-
  Creates or updates the project constitution (versioned principles, KPIs, governance) at .specify/memory/constitution.md and syncs it to docs/product/constitution.md where every agent can find it. Use when the operator says "constitution", "project principles", "sync the constitution", or once during project setup after the client interview.
---

# PM Constitution — Create & Sync

The constitution is the project's versioned principles: what the project
believes, its KPIs, and its governance rules. It lives at
`.specify/memory/constitution.md` and is mirrored to
`docs/product/constitution.md` so agents and humans find it beside
`product.md` without knowing the `.specify/` layout.

## Step 1 — Create or update the source

If `.specify/memory/constitution.md` is missing, create it (copy
`.specify/templates/constitution-template.md` if present, else from scratch):

- **Header**: project name, 1-sentence description, semver version (start
  1.0.0), ISO date
- **Principles** (respect the operator's requested count; default 3–5): each
  with a name, a **declarative, testable statement** (MUST/SHOULD language —
  never "should try to"), a why, and concrete examples
- **KPIs**: the measurable definition of project success
- **Governance**: how principles get amended (version bump + date)

Derive values from `docs/product/product.md`, the README, and existing specs;
ask the operator only for what cannot be inferred. On update: bump the semver,
never silently rewrite history.

## Step 2 — Check consistency

Scan existing specs in `.specify/features/*/spec.md` for conflicts with the
principles; list any found — the operator decides whether spec or constitution
moves.

## Step 3 — Sync and stage

Mirror the source, stage both copies, and stop. Committing is the operator's call
(`.claude/rules/global-engineering.md`: never create a commit unless explicitly
instructed).

```bash
cp .specify/memory/constitution.md docs/product/constitution.md
git add .specify/memory/constitution.md docs/product/constitution.md
git status --short
```

Suggested message if they ask you to commit:
`docs(constitution): establish project constitution v{version}`

## Step 4 — Confirm

```
✅ Constitution v{version}
   Source : .specify/memory/constitution.md
   Copy   : docs/product/constitution.md
```
