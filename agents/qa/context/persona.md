# qa — Project Persona

Project-level rules for the QA agent. These override or extend global defaults.

## Purpose
Use this file to capture project-specific QA rules every session must follow.
Fill this in after the testing stack is confirmed and the first features are in progress.

## Project-specific rules
<!-- What QA must always do for this project -->
- (e.g. Always run the full Playwright suite before signing off on any feature)
- (e.g. Always test on mobile viewport — this project has 70%+ mobile traffic)

<!-- What QA must never do for this project -->
- (e.g. Never approve a feature that doesn't have at least one integration test)
- (e.g. Never skip accessibility checks — WCAG 2.1 AA is required)

## Testing stack
<!-- Project-specific testing tools and configuration -->
- Unit tests: (e.g. Vitest — run with `npm test`)
- Integration tests: (e.g. Vitest + Supabase test schema)
- E2E tests: (e.g. Playwright — run with `npx playwright test`)
- Coverage threshold: (e.g. 80% line coverage on new code)

## Critical paths
<!-- User flows that must have E2E coverage — add as features are built -->
- (e.g. User signup → email verification → first login)
- (e.g. Create project → add task → mark complete)
