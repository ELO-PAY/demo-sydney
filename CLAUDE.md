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
- Build 1 (small) status: ✅ LIVE at https://demo-sydney.vercel.app — deployed to
  Vercel (env vars set for prod/preview/dev), full loop verified end-to-end on the
  real domain (submit → dedup by email → custom attributes → admin login → leads
  page, newest first). DB cleared of test data. See README-BUILD1.md.
- Admin account seeded: ✅ emma-lee@austpayroll.com.au (created + sign-in verified,
  incl. a live login on production). Password was shown once in terminal at seed time.
- Build 2 (all) status: ⏳ MOSTLY LIVE — the full /admin back end is deployed
  and verified at https://demo-sydney.vercel.app: nav across Pipeline / People /
  Orders / Newsletter; move each inquiry through stages (every real change writes
  one activity_log row, verified end-to-end); searchable People directory with
  custom attributes; person record showing full history (inquiries + status
  timeline + orders) with an add-order form; Orders list; Newsletter list
  (ok_to_contact = true). All of /admin sits behind login (from Build 1).
  Migration 0002 applied (orders, activity_log, set_contact_status()).
  Plus a weekly dashboard at /admin (KPIs vs prev 7d, "needs attention"
  action list with inline stage-move, pipeline funnel, 8-week trend);
  Pipeline moved to /admin/pipeline.
  NOTE: the DB currently holds ~100 SAMPLE records (people tagged
  source_site='sample_seed') for the dashboard demo. Remove with
  `npm run db:clear-samples` before real use; reseed with db:seed-samples.
  NOT DONE: Resend / confirmation email — deferred by choice until a sending
  domain is verified (see below). So Build 2's DoD is not fully met yet.
- Front Door MVP status: ✅ LIVE at https://demo-sydney.vercel.app (deployed
  2026-09-01, commit 9091e94). Integrates the Front Door onboarding vision onto
  the app as the deal-record spine (NOT HubSpot). No DB migration — call detail
  in contacts.metadata, new form fields in people.attributes. Shipped: enquiry
  form urgency+award; post-call checklist capture on the person record
  (auto-advances to discovery_call); proposal gate (scope+headcount+value);
  in-app printable proposal at /admin/proposal/[contactId]; 24h-SLA-aware call
  queue on the dashboard; new_lead relabelled "New submission". Decisions +
  roadmap: docs/product/front-door-integration-plan.md. Pending: end-to-end run
  on a live admin login. Pricing still manual Excel → value typed onto the deal
  (migrate native = 30-day job). Kantata handoff manual for now.
- Resend domain verified: [pending] — DEFERRED. The site is on demo-sydney.vercel.app,
  a Vercel subdomain that cannot be verified in Resend (no DNS control). Needs a
  real owned domain + DNS records before email can be wired. When ready: add the
  domain in Resend, put RESEND_API_KEY in .env.local + Vercel, confirm the sender,
  then build the confirmation + notification emails on form submit.

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

<!-- BEGIN: AGENT-DELEGATION (managed by infiniteleverage skills — do not delete this block) -->
## Agent delegation (auto-routing)

When you receive a request, **delegate to the right specialist agent** before doing the work yourself. The 4 agents and their triggers:

| Agent | Delegate when the request involves… |
|---|---|
| **product-manager** | roadmap, vision, epics, daily plan, project-status.html, scope changes, approval triage, stakeholder updates |
| **developer** | writing/changing code, fixing bugs, refactoring, scaffolding pages, API endpoints, Supabase migrations, env-vars wiring, **publishing posts to the live site** |
| **qa** | testing, regression checks, browser matrix, accessibility, QA plans, "verify this works" |
| **devops** | CI/CD, deployments, secret management, infra escalations, Vercel/GitHub workflow issues |

**Delegation rules:**
1. Pick exactly **one** agent per turn — don't run two in parallel unless the operator explicitly says so.
2. If a request spans agents (e.g., "build it *and* verify it"), call them **in sequence**: developer → qa.
3. If unclear which agent fits, **ask the operator** before assuming.
4. Cross-cutting engineering rules live in `.claude/rules/global-engineering.md` — every agent honors them.
5. Project-level persona overrides for each agent live in `agents/<name>/context/persona.md` — read these on first invocation.
6. Trigger phrases: `@product-manager`, `@developer`, etc. — but auto-route even without the `@` when intent is clear.
<!-- END: AGENT-DELEGATION -->
