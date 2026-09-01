---
name: devops-git-guardrails
description: >-
  Adds safety rules that block the most dangerous git commands — force-pushing to main, accidentally staging all files at once, and bypassing commit checks. Prevents the most common ways work gets accidentally lost or overwritten.
  Use when the operator says "git hooks", "protect main", or "guardrails", or after an incident involving force-push or lost work.
credits: |
  Adapted from mattpocock/skills (git-guardrails-claude-code)
  Source: https://github.com/mattpocock/skills
  License: MIT — Copyright (c) 2026 Matt Pocock
---

# DevOps Git Guardrails

Claude Code hooks that block dangerous git commands before they execute.

## What Gets Blocked

| Command Pattern | Why |
|---|---|
| `git push --force` / `git push -f` | Overwrites remote history — can destroy teammates' work |
| `git reset --hard` | Discards uncommitted changes without recovery |
| `git branch -D main` / `git branch -D master` | Deletes the main branch |
| `git add .` / `git add -A` | Stages everything including secrets and generated files |
| `git commit --amend` on a pushed commit | Rewrites published history |

## Installation

**Project-scoped only.** Write to the project's `.claude/settings.json` — never to
`~/.claude/settings.json`. Nothing in this system installs globally, and a global hook
would fire in every unrelated repo on the machine.

**Merge, don't overwrite.** `.claude/settings.json` usually already holds other keys
(`permissions` especially). Read it first and add the `hooks` entry; a blind write
destroys whatever was there:

```bash
mkdir -p .claude/hooks
python3 - <<'PY'
import json, os, pathlib
p = pathlib.Path(".claude/settings.json")
cfg = json.loads(p.read_text()) if p.exists() and p.read_text().strip() else {}
entry = {"matcher": "Bash",
         "hooks": [{"type": "command", "command": "bash .claude/hooks/git-guardrails.sh"}]}
pre = cfg.setdefault("hooks", {}).setdefault("PreToolUse", [])
if not any(h.get("hooks", [{}])[0].get("command", "").endswith("git-guardrails.sh")
           for h in pre if h.get("hooks")):
    pre.append(entry)
p.write_text(json.dumps(cfg, indent=2) + "\n")
print("hook registered in .claude/settings.json")
PY
```

Never touch the `permissions` key while doing this — granting permissions is not this
skill's job.

Create `.claude/hooks/git-guardrails.sh`:

```bash
#!/usr/bin/env bash
# Git guardrails for Claude Code
# PreToolUse hook: reads the tool call from stdin as JSON, blocks dangerous patterns.
#
# Blocking contract: exit 2 with the reason on stderr. Claude Code treats a
# PreToolUse exit-2 as "deny this call" and shows stderr to the model. Exit 0
# means "no opinion" — the normal permission flow continues. Do not print a
# JSON allow verdict: that is not this hook's decision to make.

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | python3 -c \
  "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

[ -z "$COMMAND" ] && exit 0

block() { echo "BLOCKED by git-guardrails: $1" >&2; exit 2; }

# Force push — covers --force, --force-with-lease, and -f as a standalone flag
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+push.*(--force|[[:space:]]-f([[:space:]]|$))'; then
  block "Force push is not allowed. Use a PR and merge instead."
fi

# Hard reset
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard'; then
  block "git reset --hard discards uncommitted work. Use git restore, or commit to a scratch branch first."
fi

# Deleting the trunk branch
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+branch[[:space:]]+-D[[:space:]]+(main|master)([[:space:]]|$)'; then
  block "Deleting the main/master branch is not allowed."
fi

# Bulk staging
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+add[[:space:]]+(\.|-A|--all)([[:space:]]|$)'; then
  block "git add . / -A stages everything including secrets. Stage files by name."
fi

# Amend: block ONLY when HEAD is provably already published.
# A missing upstream means the branch was never pushed, so the amend is safe —
# the old version of this check blocked that case, which is backwards.
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+commit.*--amend'; then
  UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)
  if [ -n "$UPSTREAM" ]; then
    # Unpushed commits present? Then HEAD is local-only and amending is fine.
    if [ -z "$(git rev-list "$UPSTREAM..HEAD" 2>/dev/null)" ]; then
      block "git commit --amend on a pushed commit rewrites public history. Create a new commit instead."
    fi
  fi
  # No upstream (or not a git repo) => nothing published => allow.
fi

exit 0
```

Make executable:

```bash
chmod +x .claude/hooks/git-guardrails.sh
```

## Verify

Check both directions — a hook that blocks everything is as broken as one that blocks
nothing:

```bash
# should BLOCK (exit 2, reason on stderr)
echo '{"tool_input":{"command":"git push --force origin main"}}' | bash .claude/hooks/git-guardrails.sh; echo "exit=$?"

# should ALLOW (exit 0, no output)
echo '{"tool_input":{"command":"git push origin feat/x"}}' | bash .claude/hooks/git-guardrails.sh; echo "exit=$?"
```

Expected: `exit=2` with a `BLOCKED by git-guardrails:` line, then `exit=0` silent.

## Hand off — do not commit

Stage the two files and tell the operator what to review; committing is theirs to
authorise (`.claude/rules/global-engineering.md`: never create a commit unless
explicitly instructed).

```bash
git add .claude/hooks/git-guardrails.sh .claude/settings.json
git status --short
```

Suggested message if they ask you to commit: `chore: add Claude Code git guardrail hooks`

---

## Credits

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) — `git-guardrails-claude-code`  
License: MIT — Copyright (c) 2026 Matt Pocock
