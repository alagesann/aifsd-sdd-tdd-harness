# Orders API: run-along for "AI-First Software Delivery"

This is the Orders API as it stands **before** the blog's worked example: one `GET /orders` route, no rate limiting.
You build everything else yourself by following the blog.

## What's already here

| Item | Notes |
|---|---|
| `src/app.ts`, `src/server.ts` | The Fastify app. `npm start` serves it on port 3000 |
| `test/orders.test.ts` | One existing test, so explore can see the testing conventions |
| `openspec/` and `.claude/` | From `openspec init --tools claude` (OpenSpec 1.14.3) |
| `openspec/config.yaml` | Context and rules from blog section 3.1. The apply guidance is left for step 4 |
| `package.json` | Dependencies installed, including Stryker. `npm run check` matches the blog |

## What you'll create, and when

| Blog step | You create |
|---|---|
| 1. Explore, 2. Propose | `openspec/changes/add-rate-limiting/` (the agent drafts it) |
| 3. Review | Edits to the spec and design until you'd sign them |
| 4. Apply | `operations.apply.guidance` in `config.yaml`, `test/fake-clock.ts`, `test/rate-limit.test.ts`, `src/rate-limit/*` |
| 5. Verify | `scripts/spec-coverage.mjs` and `stryker.config.json` (both shown in section 3.2). `npm run check` fails until the script exists |
| 6. Archive | Nothing new: archive updates `openspec/specs/` |
| Section 3 | `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/*.sh`, `.claude/agents/spec-reviewer.md`, CI and CODEOWNERS |

## Start

```bash
npm test          # 1 passed
claude            # then: /opsx:explore ... (blog step 1)
```

Commit after each step. The Stop hook in section 3.2 uses `git diff HEAD` to tell planning turns from coding turns.
