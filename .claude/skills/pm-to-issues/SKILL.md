---
name: pm-to-issues
description: >-
  Breaks an approved spec or a generated tasks.md into dependency-ordered GitHub Issues via gh. Each issue is a vertical slice delivering user-visible value. Use when the operator says "to issues", "create issues", or "break this into tickets", or after a plan has been approved.
---

# PM To Issues

Turn approved work into GitHub Issues. Two sources, one rule: **every issue is
a complete vertical slice** — user-visible value from input to output, never
horizontal layers ("build the model layer"). Any developer can pick up one
issue and ship it independently.

## Safety gate (always first)

```bash
git config --get remote.origin.url
```

**Only proceed if the remote is a GitHub URL, and only ever create issues in
the repository that remote points to.** No remote or non-GitHub → stop and
tell the operator.

## Source A — a generated tasks.md exists (`.specify/features/{slug}/tasks.md`)

1. Parse the tasks with their IDs, descriptions, acceptance criteria, and dependencies.
2. Create one issue per task (format below), **dependencies first**, so
   earlier issue numbers can be referenced by later ones.
3. Write the created issue numbers back into `tasks.md` next to each task.

## Source B — spec only

Slice the spec yourself: for each distinct piece of user-visible behaviour —
`SLICE` (one-sentence outcome), `SCOPE` (files/components), `DEPENDS ON`,
`SIZE` (S/M — split anything L).

## Issue format

```markdown
## What
{1–2 sentences of user-visible behaviour}
## Why
{which epic this belongs to and why it matters}
## Acceptance Criteria
- [ ] {specific, testable}
## Notes
{constraints the developer needs — never prescriptive implementation}
## Dependencies
{issue numbers that must merge first, if any}
```

Create with `gh issue create --title … --body … --label {epic-label} --assignee "@me"`.

## Close out

Update `docs/product/epic-status.md` with the issue numbers under the epic, then report:

```
ISSUES CREATED: {n} · EPIC: {name}
ISSUES: #{n}, #{n}, … · ORDER: {dependency pickup order}
```

---
## Credits
Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `to-issues` (MIT, © 2026 Matt Pocock)
