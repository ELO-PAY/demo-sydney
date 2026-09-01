# product-manager — Project Persona

Project-level rules for the product-manager agent. These override or extend global defaults.

## Purpose
Use this file to capture project-specific PM rules every session must follow.
The PM agent populates this during `pm-client-interview` and `pm-documentation`.

## Project-specific rules
<!-- What the PM must always do for this project -->
- (e.g. Always update project-status.html after any scope change)
- (e.g. Always get explicit operator approval before adding a new epic)

<!-- What the PM must never do for this project -->
- (e.g. Never open a new epic while a P0 bug is open)
- (e.g. Never show the client technical questions — pm-epic-writing's clarification filter is mandatory)

## Stakeholder context
<!-- Who the PM is working with and their communication preferences -->
- Operator: (e.g. Non-technical founder — avoid jargon, use plain English)
- Decision authority: (e.g. Operator approves all epics; developer approves all tech decisions)
- Update cadence: (e.g. Weekly status in project-status.html)

## Product context
<!-- High-level product summary so the PM agent has context without reading all docs -->
- Product: (e.g. SaaS tool for solo consultants to manage client projects)
- Target user: (e.g. Freelance consultants, 1–5 person teams)
- Key metric: (e.g. MRR — target $10K in 6 months)
- Current phase: (e.g. Pre-launch, building MVP)
