# Repository Guidelines

## Project Structure & Module Organization
This workspace supports a Moling (魔灵) platform PPT AI application. The active code lives in `ppt-ai-app/`, a dependency-light Node.js ESM integration shell. Its source is in `ppt-ai-app/src/` and tests are in `ppt-ai-app/test/`. Platform and product specs live in `app/` and `docs/`; read these before changing billing, SSO, or entitlement behavior. `presenton/` is a vendored upstream AI presentation generator used as the reference engine; avoid broad refactors there unless the task explicitly targets Presenton.

## Build, Test, and Development Commands
Run active app commands from `ppt-ai-app/`:
- `npm start` — starts `src/server.js` on the configured `PORT`.
- `npm test` — runs all Node built-in test files.
- `node --test test/platform-client.test.js` — runs one test file.
For Presenton-specific work, use the relevant subproject commands, such as `npm run lint` or `npm run build` in `presenton/servers/nextjs/`, and `uv run pytest` in `presenton/servers/fastapi/`.

## Coding Style & Naming Conventions
Use Node.js >= 20 and ESM imports. Follow existing JavaScript style: two-space indentation, double quotes, semicolons omitted, small functions, and explicit named exports. Keep boundaries clear: `platform-client.js` is the only place for Moling HTTP calls, `config.js` owns env parsing, and `http-app.js` owns routes/session handling. Use kebab-case for branch slugs and descriptive lower-case file names.

## Testing Guidelines
Add or update tests beside the area changed. In `ppt-ai-app/`, use Node’s `node:test` and name files `*.test.js`. Cover success and failure paths for SSO, billing, idempotency keys, numeric ID coercion, and reserve→settle/release flows. Run `npm test` before opening a PR.

## Commit & Pull Request Guidelines
Follow `app/branching-convention.md`: branch from `master`, use `<type>/<task-id>-<slug>` such as `feat/p2-5-slide-json-schema`, and avoid direct commits to `master`. Commit messages follow `<type>(<task-id>): <简短说明>`, preferably in Chinese, for example `fix(p1-5): 修复扣费重试幂等键`. PRs should link the roadmap task, list acceptance checks, include test results, describe risks/rollback, and use screenshots for UI changes.

## Security & Configuration Tips
Never commit `.env`, tokens, generated exports, or `node_modules`. Use `ppt-ai-app/.env.example` for required variables. Keep billing quantities as decimal strings and IDs as JSON numbers, matching the Moling contract.

## Agent-Specific Instructions
Respond in Chinese (中文) by default. Keep code, identifiers, commands, file paths, and log messages in their original language, but write all explanations, summaries, and PR/commit descriptions in Chinese unless the user explicitly requests another language.
