# The Front Door — Company OS Integration Plan

*How the standardised client-onboarding vision (2026-08-31 handoff) integrates into
the company OS, hosted on the live custom app rather than HubSpot. Decisions locked
2026-09-01. Written build-small-and-compound: ship the thinnest useful spine, prove
clean data, then compound.*

---

## The reframe

The handoff assumed HubSpot. We're not doing that. The **live custom app**
(`demo-sydney`, Next.js/Supabase) is the **single deal record** — the spine of the
whole OS. It already ships most of that spine: People (dedup by email), a pipeline
with an activity log, Orders, and a weekly dashboard with a "needs attention" list.

So this isn't a rebuild. It's **completing** the spine and wiring the Four Offices
to work from it:

```
   REVENUE office            OPERATIONS backbone            DELIVERY office
  (public enquiry form)   (the app = the deal record)     (Kantata, manual for now)
        │                          │                              │
   Enquiry ──────────────►  ONE deal record  ◄──── pricing ──►  Kickoff handoff
   (public, lean-8)        (form + call + price)               (built by hand on Won)
```

Three things are genuinely missing from what's built, and the MVP adds exactly those:
a **lean public enquiry form**, a **call-flag** (the dashboard "needs attention"
queue), and **structured post-call detail** captured back onto the deal.

## Locked decisions

| Area | Decision |
|---|---|
| System of record | The custom app is the spine. HubSpot dropped. |
| "Company OS" | Infinite Leverage Four Offices — Front Door serves Revenue with an Operations backbone. |
| Pricing | Excel calculator for the MVP; migrate price drivers native into the app at 30 days. |
| Sequencing | MVP-first. |
| Enquiry fields | Lean-8 reconciled with existing columns; add `urgency` and `award`; keep jsonb attributes. |
| Call flag | In-app "needs attention" dashboard queue. No new integrations. |
| Form access | Public on the marketing site. |
| Pipeline stages | Keep DB enum (`new_lead → contacted → discovery_call → proposal → won/lost`); relabel in the UI to front-door language. |
| Ownership | Emma-Lee works the queue for the MVP, then hands orchestration to Ross & Adrienne. |
| First-call SLA | Within 24 hours of enquiry. |
| Post-call capture | Structured fields (the checklist below) + a free-text notes box. |
| Proposal v1 | Generated in-app from the deal record. |
| Kantata handoff | Manual for now; automate later if volume justifies it. |
| SLA metrics | Extend the existing dashboard with SLA tracking at 30 days. |

---

## Roadmap

### Now — the MVP (Phase 1 + start of Phase 2) — ✅ BUILT (2026-09-01)

Complete the spine so a real enquiry runs cleanly from the site to a priced,
in-app proposal.

**Status:** built and passing `next build` / type-check. No DB migration was
needed — call detail lives in the existing `contacts.metadata` jsonb and the new
form fields in `people.attributes`. Files touched: `app/ContactForm.tsx`,
`app/actions.ts`, `lib/constants.ts`, `app/admin/(dashboard)/actions.ts`,
`app/admin/(dashboard)/page.tsx`, `app/admin/(dashboard)/people/[id]/page.tsx`,
`app/globals.css`, and new `app/admin/proposal/[contactId]/` (page + PrintButton).
Pending: manual end-to-end run on a live login + a real submit, then deploy.

- **Public enquiry form** on the marketing site — lean-8 reconciled fields:
  company, contact, email, phone, headcount, award, industry, free-text ask,
  urgency. Reuse existing columns; add `urgency` + `award`; headcount/industry/
  start-date stay in the jsonb `attributes`. Upsert person by email (already the rule).
- **Call flag** — a new enquiry surfaces in the dashboard "needs attention" queue
  with enquiry detail attached, so no one calls blind. 24h first-call SLA is the
  target this queue exists to protect.
- **Structured post-call capture** — the consultant logs the checklist fields
  (below) plus a notes box back onto the same deal, then moves the stage forward.
  A complete checklist is the gate to `proposal`.
- **Pricing (Excel, manual)** — after the call the consultant prices the agreed
  scope in the Excel calculator and writes the value onto the deal.
- **In-app proposal** — a proposal view renders from the deal (client, scope,
  price), consistent every time, no copy-paste.
- **Stage relabelling** — UI shows front-door language over the existing enum.

**Definition of done (MVP):** a stranger submits an enquiry on the live site → a
deal lands and appears in the "needs attention" queue → the call happens within
24h → structured detail + notes land on the same deal → the scope is priced in
Excel and written onto the deal → a proposal is generated in-app off that record.

### First 30 days — harden + make it native

- Harden intake for real-client volume; formalise the relabelled stages.
- **Migrate the pricing calculator's price drivers into the app** so pricing
  auto-populates the deal (removes the Excel round-trip). Pin the drivers first.
- Enforce the **required-fields checklist** as a hard gate before `proposal`.
- **Add SLA tracking to the dashboard**: first-call-within-24h compliance and
  time-in-stage, alongside the existing KPIs and funnel.
- Start the **SOW** as a fill-in template so Phase 3 has a running start.
- Confirm the 24h SLA (and any per-stage targets) with Ross & Adrienne.

### First 90 days — the wider ecosystem

- Move the proposal from generated-view toward richer self-population; automate
  **SOW** generation from the deal + proposal data.
- Wire stage progression cleanly through to Won with the activity log as the audit.
- **Kantata handoff** — keep it *manual* (a person creates the project from a Won
  deal) until volume justifies automation; then build app→Kantata as the heaviest,
  last piece.
- Hand pipeline orchestration to **Ross & Adrienne**; the SLA dashboard becomes
  their orchestration view.

---

## Post-call required-fields checklist

Structured fields on the deal; also the gate before a deal can move to `proposal`.
Items marked ⚙ are what the calculator needs to price — a complete checklist is a
priceable deal.

1. **Verified scope** — compliance review / remediation / system review / tech procurement
2. **Headcount** ⚙
3. **Award(s) / industrial instrument(s)**
4. **Industry**
5. **Payroll system(s) in use** ⚙
6. **Pay frequency & pay-run complexity** ⚙
7. **Complexity flags** ⚙ — multi-state, multi-entity, EBA vs award, historical underpayment risk
8. **Effort driver** ⚙ — estimated hours / scope size
9. **Deadline / ideal start / urgency**
10. **Decision-maker & budget authority confirmed**

*(Trim or extend on the build pass.)*

---

## Watch list

- **Proposal & SOW generation** are the classic scope-blowers — keep them
  fill-from-deal until the underlying data is genuinely clean.
- **Kantata** stays manual until volume forces automation; it's the heaviest seam.
- **The separate Database lane is already resolved** — the app *is* the database,
  so don't stand up a second one.
- **Single-threaded ownership** — protect the Ross & Adrienne clarity as the
  system grows past the MVP.
- **Every integration seam is where the single picture can fracture** — hold the
  "one source of truth per data domain" rule hard.

## Open items to confirm

- 24h SLA (and any per-stage targets) — confirm with Ross & Adrienne.
- Final trim of the post-call checklist.
- Email/Slack notification on new enquiry — deferred (no verified sending domain
  yet); the in-app queue covers the MVP.
