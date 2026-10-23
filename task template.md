Task: <one sentence>

Read first:
- AGENTS.md
- CONTEXT.md
- <exact relevant files only, e.g. src/lib/x.ts, src/lib/x.test.ts>

Do not read:
- PLAN.md unless historical phase details are needed
- .next/, node_modules/, DB dumps, lockfiles

Constraints:
- Minimal targeted change
- Follow existing patterns/tests
- Update CONTEXT.md with a dated delta if behavior changes

Validation:
- <exact commands, e.g. npm test, npm run lint, npm run build>

Expected output:
- Summary of changed files
- Commands run and results
- Any assumptions/limitations
