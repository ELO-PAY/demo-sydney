# Project Catalog

## Stack (already installed and wired — record the values)
- GitHub repo: ELO-PAY/demo-sydney (https://github.com/ELO-PAY/demo-sydney) — connected, default branch main
- Vercel project: demo-sydney (connected to GitHub, auto-deploys on push to main)
- Domain: https://demo-sydney.vercel.app (Vercel default URL)
- Supabase project: vhjikdnqngemqgnkjvuu
- Supabase URL: https://vhjikdnqngemqgnkjvuu.supabase.co
- Supabase service key: stored in .env.local (SUPABASE_SERVICE_ROLE_KEY) — never commit
- Resend account: [pending] — Build 2 only, not needed for Build 1

## Build (filled as we go)
- Plan written: [done]
- Build 1 (small) status: ✅ code complete + fully verified locally (form → dedup →
  attributes → admin login → leads page all pass). GO-LIVE needs two owner steps:
  (1) add env vars to Vercel, (2) git push to main (auto-deploys). See README-BUILD1.md.
- Admin account seeded: ✅ emma-lee@austpayroll.com.au (created + sign-in verified)
- Build 2 (all) status: [pending]
- Resend domain verified: [pending] — Build 2

# How to use this catalog

You are my engineering partner. Before any task or /goal command:
1. Read this entire CLAUDE.md AND Working Files/product-plan.md.
2. Identify which catalog + plan items the task requires.
3. If any required item is [pending] or empty, STOP and tell me what to
   fill in. Use plain English: "I need X to do this. Please Y."
4. Don't proceed until every required item is filled.
5. After the task succeeds, update the catalog with new state.

Required items by task:
- /goal build 1 (small) → product-plan.md complete
- /goal build 2 (all) → product-plan.md + Build 1 complete + Resend domain verified
- Any deploy → GitHub + Vercel + Domain confirmed
