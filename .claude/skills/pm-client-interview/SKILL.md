---
name: pm-client-interview
description: >-
  Guides a structured two-round interview with the business owner to understand their goals, their customers, and what success looks like. Run once at the very start of a new project — this conversation becomes the foundation that everything else is built on. Output feeds directly into the product strategy document.
  Use when the operator says "client interview", "kick off the project", or "understand the business", or docs/product/product.md is still a placeholder.
---

# PM: Client Interview

Run when `docs/product/product.md` does not exist. Ask in two rounds — do not proceed to scaffolding until both are complete.

## Round 1 — Core Story (ask all at once)

1. **The problem** — What is broken in the world that this product fixes? Include real numbers or evidence if available.
2. **The user** — Who specifically suffers from this problem? Age, context, what they've already tried and rejected?
3. **The solution** — In one sentence, what does this product do for them?
4. **Values delivered** — List 4–6 concrete things this product does for the user. Each starts with a verb ("Saves X from Y", "Gives X the ability to Y").
5. **Jobs to be done** — What does the user hire this product to do? What do they fire when they adopt it?

## Round 2 — Business Frame (ask after Round 1)

1. **Market** — Rough size of the addressable market. Growing or shrinking? Any timing window ("why now")?
2. **Business model** — How does the product make money? Pricing structure, unit economics intuition?
3. **Load-bearing assumptions** — What are the 2–3 things that, if false, would sink the strategy? How could each be falsified within 90 days?
4. **First epic** — What is the single most important thing to build first, and why before anything else?
5. **Top 2 metrics** — One leading (early signal), one trailing (retention/revenue). Not signups, MAU, or session length.

## Synthesis

After both rounds, pass all answers to `pm-documentation` to scaffold the product docs.

## Edge Cases
- Stakeholder gives vague answers: ask "Can you give me a concrete example?"
- Stakeholder has no business model: note "to be determined" — do not block
- Competition unknown: note the gap, suggest competitive analysis as a follow-up
