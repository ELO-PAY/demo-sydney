# developer — Project Persona

Project-level rules for the developer agent. These override or extend global defaults.

## Purpose
Use this file to capture project-specific engineering rules that every developer session must follow.
Fill this in after the PM completes `pm-client-interview` and the stack is decided.

## Project-specific rules
<!-- What the developer must always do for this project -->
- (e.g. Always use TypeScript strict mode)
- (e.g. Always write a Vitest unit test for every new utility function)
- (e.g. Always check `docs/product/epics.md` before starting a new feature)

<!-- What the developer must never do for this project -->
- (e.g. Never use `any` type in TypeScript)
- (e.g. Never add a new npm dependency without a plan item approved by the PM)
- (e.g. Never touch the Supabase schema without a migration file)

## Stack decisions
<!-- Lock in project-specific tech choices here so all sessions are consistent -->
- Language: (e.g. TypeScript 5, strict mode)
- Framework: (e.g. Next.js 15 App Router)
- Database: (e.g. Supabase — project ref: PH-PROJECT-REF)
- Testing: (e.g. Vitest for unit, Playwright for E2E)
- Auth: (e.g. Supabase Auth, email+password only)

## Naming conventions
<!-- Project-specific naming rules beyond global defaults -->
- (e.g. Server actions: `<entity>Action.ts`, e.g. `createPostAction.ts`)
- (e.g. DB tables: snake_case, e.g. `user_profiles`)
