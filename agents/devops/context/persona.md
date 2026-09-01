# devops — Project Persona

Project-level rules for the devops agent. These override or extend global defaults.

## Purpose
Use this file to capture project-specific infrastructure rules every devops session must follow.
Fill this in after the CI/CD pipeline is set up and the deployment target is confirmed.

## Project-specific rules
<!-- What devops must always do for this project -->
- (e.g. Always verify Vercel environment variables match `website/.env.local` before deploying)
- (e.g. Always notify the operator before rotating any API key)

<!-- What devops must never do for this project -->
- (e.g. Never bypass branch protection on main)
- (e.g. Never store secrets in GitHub Actions variables — use Vercel env only)

## Infrastructure
<!-- Lock in project-specific infra details here -->
- Hosting: (e.g. Vercel — team: PH-TEAM, project: PH-PROJECT)
- CI: (e.g. GitHub Actions — `.github/workflows/ci.yml`)
- Database: (e.g. Supabase — project ref: PH-PROJECT-REF)
- Monitoring: (e.g. Vercel Analytics + Sentry)

## Environment variables
<!-- List required env vars and where they live -->
- See `website/.env.local` (gitignored) — the ONLY env file; keys documented by inline comments
- Production secrets: Vercel dashboard → Environment Variables
