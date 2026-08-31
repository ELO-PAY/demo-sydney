# Build 1 — LIVE ✅

**Live at https://demo-sydney.vercel.app** — deployed to Vercel and verified
end-to-end on the real domain.

Done during deploy:
- Env vars set in Vercel for Production, Preview, and Development:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. (Not set, by design:
  `SUPABASE_PASSWORD` — local scripts only; `RESEND_API_KEY` — Build 2.)
- Framework preset pinned to Next.js via `vercel.json`.
- Repo connected to Vercel; every push to `main` auto-deploys.

## Test the loop yourself (your Definition of Done)

1. Open `https://demo-sydney.vercel.app/` and submit the contact form.
2. Open `https://demo-sydney.vercel.app/admin` → you'll be sent to the login.
3. Sign in with the admin account (email `emma-lee@austpayroll.com.au`;
   password was shown in the terminal when it was seeded).
4. Your submission appears at the top of the leads list.

## Re-seed or change the admin login later

```bash
ADMIN_EMAIL=you@example.com npm run db:seed-admin
```

Add `ADMIN_PASSWORD=...` before the command to set your own; omit it to get a
generated one printed once. Re-running updates the existing account.

## Handy scripts

- `npm run db:migrate` — apply `supabase/migrations/*.sql` (idempotent)
- `npm run db:seed-admin` — create/reset + verify the admin account
- `npm run dev` — run locally at http://localhost:3000
