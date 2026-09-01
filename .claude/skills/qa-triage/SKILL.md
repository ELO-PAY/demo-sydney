---
name: qa-triage
description: >-
  Classifies every incoming bug by severity (P0 = site completely down, P1 = major feature broken, P2 = significant issue, P3 = minor cosmetic), scores its priority, and routes it to the right person. Always run this first for any new bug report — nothing gets worked on without being triaged. Output goes to docs/qa/ and the project status dashboard.
  Use for every new bug report, or when the operator says "triage", "classify this bug", or "prioritise this bug".
credits: |
  Adapted from mattpocock/skills (triage)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# QA Triage

Bug triage state machine. Classify → score → route.

## Step 1 — Classify

Assign exactly one classification to the bug:

| Class | Definition |
|---|---|
| `regression` | Previously working behaviour that is now broken |
| `new-defect` | Never worked correctly — bug in new code |
| `performance` | Correct output but unacceptably slow |
| `ux-degradation` | Works technically but creates a poor user experience |
| `data-integrity` | Incorrect data stored, returned, or lost |
| `security` | Potential data exposure, auth bypass, or injection |

## Step 2 — Priority Score

Score on three axes (1–5 each):

```
Severity  = how bad is the user impact when it happens?
Frequency = how often does it occur?
Blast     = how many users / features does it affect?

Score = Severity × Frequency × Blast
```

Priority mapping:

| Score | Priority |
|---|---|
| 75–125 | P0 — drop everything |
| 30–74  | P1 — fix this sprint |
| 10–29  | P2 — fix next sprint |
| 1–9    | P3 — backlog |

**Severity floors — these override the score, never the other way round.**
A multiplicative score under-rates the rare-but-catastrophic: a live auth bypass
nobody has hit yet scores 5 × 1 × 5 = 25 and would otherwise land in P2.

| Condition | Minimum priority |
|---|---|
| `security` — data exposure, auth bypass, injection | **P0** |
| `data-integrity` — data incorrectly stored, returned, or lost | **P1** (P0 if the loss is unrecoverable) |
| Production is down or the site cannot load | **P0** |

Record the raw score alongside the floored priority so the override is visible:
`P0 (Score: 25 — raised by security floor)`.

## Step 3 — Route

| Classification | Route to |
|---|---|
| `security` | P0 by floor → escalate to the operator immediately, before any sprint planning |
| `data-integrity` | Developer (P0/P1) → QA validates fix |
| `regression` | Developer → fix on same branch that caused it |
| `new-defect` | Developer → fix on feature branch |
| `performance` | Developer → profile before fixing |
| `ux-degradation` | PM review → developer |

## Step 4 — Output

Write a triage report to `docs/qa/{YYYY-MM-DD}-{slug}-triage.md`:

```markdown
# Triage: {bug title}

**Date:** {date}
**Reporter:** {who found it}
**Classification:** {class}
**Priority:** P{n} (Score: {score})
**Assigned to:** {agent/person}

## Reproduction

{exact steps to reproduce}

## Expected vs Actual

**Expected:** {what should happen}
**Actual:** {what happens}

## Impact Assessment

- Severity: {1-5} — {reason}
- Frequency: {1-5} — {reason}
- Blast radius: {1-5} — {reason}

## Route Decision

{who is fixing this and why}
```

## Step 5 — Update Project Files

After writing the report:

1. Update `docs/product/epic-status.md`:
   - **At a glance** table — increment the epic's `Open bugs` count.
   - **Drilldown** — under that epic's heading (create `### E{N} · {Epic Name}` if it has
     no drilldown entry yet), append a line:
     `- P{n} · {classification} · {bug title} → docs/qa/{YYYY-MM-DD}-{slug}-triage.md`

   Those are the only sections the file has — do not invent a "Known Issues" heading;
   `pm-project-status` keys on the existing structure and will miss anything else.
2. Update `docs/project-status.html` — add to the "Bugs" table with priority,
   classification, and assignee.

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `triage`  
License: MIT — Copyright (c) 2026 Matt Pocock
