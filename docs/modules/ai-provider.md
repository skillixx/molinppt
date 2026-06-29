# AI Provider Module

The AI provider foundation defines the provider boundary without coupling the app to a specific vendor.

Current implementation:

- `src/ai-provider.js`
- mock outline generation
- mock slide JSON generation
- single-slide regeneration
- HTTP provider adapter selected with `LLM_PROVIDER=http`

Future work:

- image provider adapters
- prompt templates
- cost and rate-limit controls
