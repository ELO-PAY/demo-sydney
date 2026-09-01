---
name: web-publisher-publish
description: >-
  Takes a finished blog post all the way to production — writes the App Router page, updates the blog index, commits on a publish branch, opens a PR, and confirms the Vercel deployment is healthy. Never commits or pushes on main. The post is not done until the build is green. Owned by the developer agent. Use when the operator says "publish", "push the post live", or "build the page", or a finished post + hero image are waiting.
---

# Web Publisher: Publish Post

## Discovery
```bash
ls -1t content/topics/   # newest first
```
Find the first folder that has both `blog.md` AND `{slug}-hero.webp` but NO published page.

## Steps per Run

### Phase 1 — Content assembly
1. Read `blog.md` and `seo.md` — full content + front matter + SEO metadata
2. Read the project's web style guide for component conventions
3. Copy `{slug}-hero.webp` to `website/public/images/blog/`

### Phase 2 — Code
4. Write the page at `website/app/blog/{slug}/page.tsx` (App Router):
   - `export const metadata` (or `generateMetadata`) with title, description, OG/Twitter, canonical
   - `next/image` for all images; read-time estimate in post header; category tag from style guide; Tailwind classes (no inline styles)
   - Follow the patterns of existing posts under `website/app/blog/`
5. Confirm `npm run build` passes clean

### Phase 3 — Index update
6. Add the post card at the top of the blog index (`website/app/blog/page.tsx`) — follow the existing card pattern exactly

### Phase 4 — Quality gate (run before commit)
- [ ] Page renders — correct TSX, no missing imports
- [ ] All images use `next/image` with correct `src`, `alt`, `width`, `height`
- [ ] `metadata` includes title, meta description, OG/Twitter tags
- [ ] Category tag matches a valid blog category
- [ ] Post card at top of blog index grid
- [ ] Read-time estimate in post header

### Phase 5 — Branch, commit, push the branch

Never commit or push on `main` — `.claude/rules/global-engineering.md` forbids it, and
the branch is what gives you a Vercel preview to check before the post goes live.

7. Start from fresh `main` and cut the publish branch:
   ```bash
   git switch main && git pull
   git switch -c publish/{slug}
   ```
8. Stage explicitly (never `git add .` / `-A`):
   ```bash
   git add website/app/blog/{slug}/page.tsx \
           website/public/images/blog/{slug}-hero.webp \
           website/app/blog/page.tsx
   ```
9. Commit: `git commit -m "publish: {Post Title}"`
10. Push the branch: `git push -u origin publish/{slug}`

### Phase 6 — Open the PR, then let the merge rule decide

11. Open the PR:
    ```bash
    gh pr create --title "publish: {Post Title}" --body "Publishes {slug}"
    ```
12. Merge only under the **auto-merge eligibility** rules in `.claude/agents/developer.md`
    — a content-only post (new blog route + hero image + index card, no new deps, no
    schema/auth/env/API change) on a clean branch with green CI qualifies:
    ```bash
    gh pr merge --squash --delete-branch
    ```
    Anything beyond that — a component change, a new dependency, a layout edit — stops
    here: leave the PR open with a one-paragraph plain-English summary and tell the
    operator it needs their approval. Never merge on red CI.

    Log an auto-merge in the daily plan: `[auto-merged] PR #N — publish {slug} — content-only`.

### Phase 7 — Vercel build verification
13. Wait ~60 seconds, then check the latest deployment:
    ```bash
    vercel ls --limit 1   # get deployment URL
    vercel inspect <deployment-url>   # confirm status = READY
    ```
    Or use the Vercel MCP tool `list_deployments` and confirm `state: READY`.

    If the PR is still open (Phase 6 stopped for approval), verify the **preview**
    deployment instead and hand the preview URL to the operator — the post is not
    live until they merge.
14. If the build fails, immediately brief the Developer with the build log and do not append to `publish-log.md` until fixed.
15. On success, append to `context/general-project-agent-context/publish-log.md`:
    ```
    {YYYY-MM-DD} — published: {Post Title} → {deployment-url}
    ```
