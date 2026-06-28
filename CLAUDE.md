# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is a workspace for building a **PPT AI generator application that plugs into the Moling (魔灵) platform**. It contains three distinct kinds of content:

- `ppt-ai-app/` — the **actual code under active development**. A small Node.js (ESM, no deps) integration shell that connects the PPT AI app to the Moling platform's billing/SSO. This is the thing you usually edit, run, and test.
- `app/` and `docs/` — design specs and the platform-integration contract (all Markdown). These are the source of truth for *how* the app must talk to Moling. Read them before changing integration behavior.
- `presenton/` — a **vendored upstream open-source project** (Presenton: AI presentation generator, FastAPI + Next.js + Electron). It is the reference/engine for actual PPT generation, which `ppt-ai-app` does not yet implement (it currently mocks generation). Treat as third-party; don't refactor it as if it were our code. `presenton-analysis.md` is our analysis of it.

## ppt-ai-app — commands

Requires Node >= 20. Run from `ppt-ai-app/`:

```bash
npm start          # start the HTTP server (src/server.js)
npm test           # run all tests (node --test, no framework)
node --test test/platform-client.test.js   # run a single test file
node --test --test-name-pattern "releases reserved credits"  # run tests matching a name
```

Required env vars (see `.env.example`; never commit real tokens):
`MOLING_API_BASE_URL`, `INTERNAL_API_TOKEN` are mandatory. `PPT_APP_ID` (default 15), `PPT_PRODUCT_ID` (73), `PPT_DEFAULT_ENTITLEMENT_ID` (62, dev-only), `PORT` (5177) are optional.

## ppt-ai-app — architecture

The boundary that drives everything: **Moling sells and keeps the ledger; this app provides the feature and calls Moling's internal billing APIs at the right moments.** Don't push billing logic into the platform or generation logic into the platform.

Layers (each `src/` file is one responsibility):

- `server.js` — entrypoint: loads config, builds a `PlatformClient`, starts the HTTP server.
- `config.js` — env parsing/validation. Numeric IDs are validated as positive integers here.
- `platform-client.js` — the **only** place that talks HTTP to Moling. All business code must go through this class; never scatter raw `fetch` calls. It wraps the `{ code, message, data }` envelope, throws `PlatformError` on `code !== 0` or non-2xx, and returns `envelope.data` on success.
- `http-app.js` — the app's own HTTP surface and session handling (in-memory `Map`, `ppt_ai_session` cookie). Routes: `/enter` (SSO ticket exchange), `/dashboard` (HTML), `/api/me`, `/api/entitlement-balance`, `/api/mock-generate`.
- `mock-generation.js` — placeholder for real PPT generation; demonstrates the reserve→settle / reserve→release flow.

Two flows you must preserve:

1. **SSO launch.** Moling redirects to `/enter?ticket=lt_xxx`. The app calls `verifyLaunchTicket`, asserts the returned `app_id`/`product_id` match this app's config, then creates its own session and redirects to `/dashboard`. The ticket is one-time — never retry the same ticket.
2. **Prepaid credit billing.** Expensive/fallible operations use `reserve → settle` (success) or `reserve → release` (failure). Cheap operations use `consume`. Every billing call carries a stable idempotency key formatted `{taskId}:{action}` (e.g. `task_abc:ppt_generate:reserve`); reuse the same key on retries, never regenerate.

Two non-obvious contract rules enforced by `PlatformClient` (Moling rejects violations with `code 40000`):

- `user_id`, `entitlement_id`, `hold_id` must be sent as **JSON numbers**, not strings — `toPositiveInteger()` coerces UI-supplied strings.
- `amount` / quota quantities are sent as **decimal strings** (e.g. `"6"`).

The authoritative field-level contract, error codes, and platform-side setup live in `docs/moling-app-integration-guide.md` and `app/billing-integration-spec.md`. Consult them when adding or changing any platform interaction.
