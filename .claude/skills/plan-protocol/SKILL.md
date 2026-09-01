---
name: plan-protocol
description: >-
  Installs, upgrades, and diagnoses the Plan Protocol in any repository — the plan registry, the blast-radius guard, and the runtime-agnostic pre-push hook that stops undeclared mega-PRs. Use when setting up a new client project, when asked to add plan/scope enforcement, when `plans:*` or `plan.mjs` commands are missing or failing, when the pre-push guard is not firing, or when a fresh clone or worktree needs the protocol activated. Works in any stack — Node, Rails, Django, static — because the engine has no dependencies.
---

# Plan Protocol — installer

This skill **installs** the protocol. It is never the protocol itself.

That distinction is load-bearing: skills only fire in Claude Code. If enforcement lived in
a skill, Codex, Cursor and Windsurf would ignore it entirely — the exact single-runtime gap
the protocol was written to close. So the teeth are a **git hook** plus a **dependency-free
engine**, both committed to the repo, and this skill is how they get there.

## What the protocol is

**No plan on `main`, no code.** Every task declares, in `meta.yaml` merged to the base
branch, which paths it will touch. `guard` then fails any push or gate run that changes a
path outside that declaration. Scope growth becomes a visible edit to the plan instead of
silent PR bloat. Full protocol: `AGENTS.md` at the repo root.

## The engine

One file, `.specify/extensions/plan-protocol/plan.mjs`. `node:` builtins only — no `tsx`,
no build step, no `npm install`, no `package.json` required anywhere. Plain `node` is
present on every machine already running a coding agent; a devDependency in one
subdirectory of one repo is not.

```bash
node .specify/extensions/plan-protocol/plan.mjs <verb>
```

| Verb | Does |
|---|---|
| `index` | regenerate the registry from every `meta.yaml` |
| `check` | validate metas + registry freshness (gate step) |
| `sync` | SYNC: overlap and migration-number conflicts vs the base ref |
| `guard` | blast-radius cap (gate step + pre-push hook) |
| `submit` | plan-only fast lane: push, PR, merge |
| `premerge` | merge the base ref, then run the gate on the **result** |
| `init` | install into this repo |
| `doctor` | diagnose; `--heal` repairs what it can |

All policy lives in `config.json` beside the engine: `plansDir`, `registryFile`, `baseRef`,
`exempt`, `hotZones`, `components`, `trivialFixMaxFiles`, `staleWarnDays`, `claimExpiryDays`,
`verifyCmd`, `verifyCwd`. Hot zones differ between two Next apps, never mind a Rails one — so
they are data, and the engine never changes per project.

`components` is the plan taxonomy. It ships **empty**, meaning any non-empty `component`
string is valid — the engine imposes no domain vocabulary, because "billing" and "learner"
cannot both be right. Fill the list in to enforce a fixed set:
`"components": ["web", "api", "platform"]`. A missing `component` is always an error.

## Mode: init — a project with no protocol

1. Locate the engine, in this order:
   - `<this skill dir>/assets/plan.mjs` (present in template installs), or
   - `.specify/extensions/plan-protocol/plan.mjs` (already installed — go to `doctor`).

   If neither exists, copy it from a repo that has it; do not rewrite it from memory.
2. Copy `plan.mjs` and `plan.test.mjs` to `.specify/extensions/plan-protocol/`.
3. Run `node .specify/extensions/plan-protocol/plan.mjs init`. It writes `config.json`,
   scaffolds `.githooks/pre-push` (mode 755), creates the plans dir, sets
   `core.hooksPath`, and finishes with `doctor --heal`.
4. **Review the detected `hotZones` with the operator.** `init` infers them from the tree
   (migrations dirs, shared component dirs, lockfiles, CI config) and always adds the
   protocol's own surfaces. They are the blast-radius cap — wrong ones make the guard
   either toothless or unbearable, so this is the one step worth a human glance.
5. Install the protocol doc: copy `assets/AGENTS-template.md` to the repo root as
   `AGENTS.md` — or, if one already exists, append its sections. **Copy the asset; do not
   write the protocol from memory**, or every project ends up with a slightly different
   protocol. `AGENTS.md` is the cross-tool standard Codex, Cursor and Windsurf load
   natively, which is the whole reason the rules live there. Then point `CLAUDE.md` at it
   (`@AGENTS.md`) rather than duplicating the text.
6. Where a `package.json` exists, add aliases and put `check` + `guard` **first** in the
   gate, cheapest-first:
   ```
   "plans:check": "node <engine> check", "plans:guard": "node <engine> guard",
   "plans:sync": "node <engine> sync", "plans:test": "node --test <engine-dir>/plan.test.mjs",
   "premerge": "node <engine> premerge",
   "prepare": "git -C . config core.hooksPath .githooks 2>/dev/null || true"
   ```
7. Verify before reporting success: `node --test .../plan.test.mjs` (32 tests, no
   framework or install needed), then `plan.mjs guard`, then confirm the hook actually
   fires:
   ```bash
   git -c core.hooksPath=.githooks hook run pre-push
   ```
   A hook that is present but **not executable is silently ignored by git** — it looks
   installed and does nothing. `doctor --heal` fixes the mode; commit it as `100755`.
8. Commit `.githooks/`, the engine, and `config.json`. Uncommitted, teammates inherit
   nothing.

## Mode: upgrade — protocol already installed

1. Diff the newer `assets/plan.mjs` against the installed engine; copy it over.
   `config.json` is **never** overwritten — it is the project's own policy.
2. Run `doctor`. A `protocolVersion` behind `ENGINE_VERSION` is what it reports; bump the
   field once the new engine is in place.
3. Re-run `plan.mjs check`, `guard`, and `node --test`. Registry format changes make
   `check` fail until `index` is re-run — regenerate and commit.

## Mode: doctor — "it isn't firing"

```bash
node .specify/extensions/plan-protocol/plan.mjs doctor        # report
node .specify/extensions/plan-protocol/plan.mjs doctor --heal # repair
```

Checks `core.hooksPath`, hook presence **and executability**, config presence and version,
`hotZones` non-empty, meta validity, and expired claims.

Two failure modes worth knowing, because both look like working enforcement:

- **A non-executable hook is ignored silently.** Git prints only a hint, exits 0, and the
  push sails through. `--heal` chmods it.
- **Enforcement is not retroactive.** `core.hooksPath` is per-clone config, but the hook
  *file* is per-branch content. A branch cut before the protocol landed has no
  `.githooks/pre-push` in its tree, so nothing runs there until it merges the base branch.
  This is a graceful rollout, not a bug — but do not tell an operator a branch is guarded
  when it is not. Check with `git -C <worktree> hook run pre-push`.

## Fresh clone or worktree

Hooks are per-clone, so a new clone starts unenforced:

```bash
node .specify/extensions/plan-protocol/plan.mjs doctor --heal
```

Where a `prepare` script exists, `npm install` does this too.

## Guardrails

- Never widen `exempt` to silence the guard, and never exempt the engine's own directory —
  it is the one file that can switch enforcement off, so it belongs in `hotZones`.
- Never add engine paths to the `submit` fast lane: that lane auto-merges without review.
- Never `--no-verify`. If the guard is wrong, fix the plan's `touches` or the config.
- Out-of-scope path? Widen `touches` in `meta.yaml` and re-run `index`, in the same PR.
  Declared, never silent — that is the entire point.
