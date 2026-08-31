# Build 1 — Go live (two owner steps)

Everything is built, committed, and verified locally. Two steps remain, and
both need your account access (I can't do either for you).

## Step 1 — Add environment variables in Vercel

Vercel → project **demo-sydney** → **Settings → Environment Variables**.
Add these **four** for all environments (Production, Preview, Development).
Copy the values from your local `.env.local` file (git-ignored — the real
keys live only there):

| Name | Where to copy the value from |
|------|------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`         | `.env.local` line: `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE` | `.env.local` line: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE` |
| `SUPABASE_SERVICE_ROLE_KEY`        | `.env.local` line: `SUPABASE_SERVICE_ROLE_KEY` (secret — server only) |
| `NEXT_PUBLIC_SITE_URL`             | `https://demo-sydney.vercel.app` |

Do **not** add `SUPABASE_PASSWORD` (only used by local DB scripts) or
`RESEND_API_KEY` (that's Build 2).

## Step 2 — Push to deploy

The repo is connected to Vercel and auto-deploys on push to `main`. The
commit is already made locally; just push it:

```bash
git push origin main
```

If you set the env vars *after* the first deploy, trigger one more deploy so
they take effect (Vercel → Deployments → ⋯ → Redeploy).

## Then test the loop (your Definition of Done)

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
