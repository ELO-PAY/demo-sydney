---
name: devops-ops
description: >-
  Monitors the health of the live site and CI/CD pipeline — checks deployment status, reads build and error logs, confirms all environment variables are correctly set. Also includes the step-by-step procedure to roll back a broken production deployment in under 60 seconds without writing any code.
  Use when the operator says "is the site up", "deployment failed", "check the logs", "roll back", or anything about production health.
---

# DevOps: Operations

## Scope

**In scope:**
- GitHub CI/CD: Actions workflows, branch protection, PR checks
- Vercel: deployment status, build logs, runtime logs, environment variables
- Production health monitoring via vercel CLI

**Out of scope:**
- Writing or reviewing application code (Developer owns this)
- Content pipeline (the Developer's `web-publisher-publish` owns this)
- Database schema changes (escalate to human engineer)

## Vercel CLI — Read-Only Monitoring
```bash
vercel ls                                    # list recent deployments + status
vercel inspect <deployment-url>              # deployment details + build info
vercel logs <deployment-url>                 # runtime logs
vercel env ls production                     # confirm all env vars present
```

## Vercel CLI — Management (require explicit user confirmation)
```bash
vercel env add KEY production    # add environment variable
vercel link --project {slug}     # link local dir to Vercel project
```
Never run `vercel deploy` or `vercel --prod`. All deployments through `git push` → CI/CD only.

## Deployment Model
- All deployments flow through GitHub → Vercel CI/CD only
- Never run `vercel deploy` or `vercel --prod` directly
- Never push to `main` — all changes through PRs
- Vercel CLI for read-only operations only; writes through CI/CD

## Production Rollback (when a deployment breaks the live site)

This is the fastest fix. Tell the operator these exact steps:

1. Go to **vercel.com** → open the project → click **Deployments**
2. Find the last deployment that was working (green checkmark, before the broken one)
3. Click the three-dot menu on that deployment → **Promote to Production**
4. The site is back in ~30 seconds

After the site is restored, investigate the cause on a branch — never push a fix directly to main under pressure.

If the operator cannot access the Vercel dashboard, you can also roll back via CLI (requires explicit operator confirmation first):
```bash
vercel rollback --yes   # reverts production to the previous successful deployment
```

## Escalation Triggers (call a human engineer)
- CI/CD pipeline broken and not resolvable in 2 attempts
- Database schema changes affecting production data
- Security vulnerability in a dependency
- Supabase edge function deployment failures

## Best Practices Principle
Before configuring any pipeline, environment, or deployment:
- Search top GitHub repos for current CI/CD patterns
- Reference DevOps practitioners and well-maintained workflow templates
- Apply current security and deployment patterns — never improvise credentials or pipeline logic
