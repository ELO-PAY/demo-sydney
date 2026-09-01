---
name: devops-cicd
description: >-
  Creates a GitHub Actions pipeline that automatically runs quality checks on every pull request: checks code style, verifies TypeScript types, runs tests, and confirms the app builds successfully. This prevents broken code from reaching the main branch.
  Use when the operator says "ci/cd", "pipeline", "github actions", or a repo has no checks running on pull requests.
---

# DevOps: CI/CD Pipeline

## What this builds

A GitHub Actions workflow that runs automatically on every PR and push to `main`:
1. **Install** — clean dependency install
2. **Lint** — ESLint code quality checks
3. **Type check** — TypeScript strict checks
4. **Test** — Vitest unit and integration tests (the canonical scaffold ships Vitest;
   on a Jest project use `npx jest --ci --passWithNoTests` instead — `--ci` is a Jest
   flag and Vitest rejects it)
5. **Build** — Next.js production build (catches build-time errors before they reach Vercel)

Vercel handles preview and production deployments automatically via its GitHub integration — this CI is the code quality gate that protects `main`.

---

> **Layout note** — the workflow below assumes the canonical scaffold, where the app
> lives in `website/`. On a repo with the app at the root, drop the `defaults.run.working-directory`
> block and change `cache-dependency-path` to `package-lock.json`. Check before you write:
> `ls website/package.json 2>/dev/null || echo "app is at the repo root"`.

## Step 1 — Check what already exists

```bash
ls .github/workflows/ 2>/dev/null || echo "No workflows yet"
```

If a CI file exists, read it before making changes. Don't overwrite working configuration.

---

## Step 2 — Create the workflow

Write `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint, type-check, test, build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: website

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: website/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npx vitest run --passWithNoTests

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
```

---

## Step 3 — Add GitHub Secrets for the build step

The build step needs environment variables. Tell the operator:

> "To finish CI setup, go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, and add:
> - `NEXT_PUBLIC_SUPABASE_URL` — copy from your `.env.local` file
> - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — copy from your `.env.local` file
>
> These are safe to add here — they are public-facing keys, sent to the browser anyway. Never add `SUPABASE_SECRET_KEY` to GitHub secrets; it bypasses row-level security and CI does not need it to build."

---

## Step 4 — Enable branch protection (strongly recommended)

Tell the operator:

> "Go to GitHub → **Settings** → **Branches** → **Add branch protection rule** → Branch name pattern: `main` → check **Require status checks to pass before merging** → select the `quality` job → Save.
>
> This ensures no broken code can accidentally land in main."

---

## Step 5 — Verify

Stage the workflow on a feature branch and hand it to the operator — they commit and
push (`.claude/rules/global-engineering.md`: never commit unless instructed, never push
to `main`).

```bash
git switch -c feat/add-ci
git add .github/workflows/ci.yml
git status --short
```

Suggested message: `ci: add GitHub Actions quality pipeline`. Once they push and open a
PR, confirm the Actions tab shows the `quality` job running; all steps should pass
before merging.

---

## Output

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | CI pipeline — runs on every PR and push to main |
