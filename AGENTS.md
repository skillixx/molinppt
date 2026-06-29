# Repository Guidelines

## Project Structure & Module Organization
This workspace supports a Moling (魔灵) platform AI PPT application. The active foundation code lives in `ppt-ai-app/`, a dependency-light Node.js ESM application shell. Product and platform specs live in `app/` and `docs/`; read these before changing billing, SSO, entitlement, file, permission, or workflow behavior. Module design docs live in `docs/modules/`. `presenton/` is a vendored upstream AI presentation generator used only as a product-experience reference; avoid broad refactors there unless the task explicitly targets Presenton.

## Build, Test, and Development Commands
Run active app commands from `ppt-ai-app/`:
- `npm test` — runs all Node built-in test files.
- `npm run migrate` — initializes the local JSON-file database.
- `npm start` — starts `src/server.js` on the configured `APP_PORT`.
For Presenton-specific work, use the relevant subproject commands, such as `npm run lint` or `npm run build` in `presenton/servers/nextjs/`, and `uv run pytest` in `presenton/servers/fastapi/`.

## Coding Style & Naming Conventions
Use Node.js >= 20 and ESM imports. Keep boundaries clear: Moling HTTP calls belong in `moling-client.js`, env parsing belongs in `config.js`, routes/session handling belong in `app.js`, billing operations belong in `billing.js`, and file operations belong in `files.js`. All exported classes and methods should have JSDoc comments. Use kebab-case for branch slugs and descriptive lower-case file names.

## Testing Guidelines
Add or update tests beside the area changed. In `ppt-ai-app/`, use Node’s `node:test` and name files `*.test.js`. Cover success and failure paths for SSO, billing, idempotency keys, numeric ID coercion, reserve→settle/release, file ownership, task ownership, configuration, and error mapping.

## Commit & Pull Request Guidelines
Follow `app/branching-convention.md`: branch from `master`, use `<type>/<task-id>-<slug>` such as `feat/p2-5-slide-json-schema`, and avoid direct commits to `master`. Commit messages follow `<type>(<task-id>): <简短说明>`, preferably in Chinese, for example `fix(p1-5): 修复扣费重试幂等键`. PRs should link the roadmap task, list acceptance checks, include test results, describe risks/rollback, and use screenshots for UI changes.

## Security & Configuration Tips
Never commit `.env`, tokens, generated exports, local data, or `node_modules`. Use `.env.example` and `ppt-ai-app/.env.example` for required variables. All runtime configuration must come from environment variables. Keep billing quantities as decimal strings and IDs as JSON numbers, matching the Moling contract.

## Agent-Specific Instructions
Respond in Chinese (中文) by default. Keep code, identifiers, commands, file paths, and log messages in their original language, but write all explanations, summaries, and PR/commit descriptions in Chinese unless the user explicitly requests another language.
