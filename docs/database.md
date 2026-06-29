# Database Design

## Database Choice

Use PostgreSQL for production. The domain has relational data, billing consistency requirements, task state transitions, and audit records that benefit from transactions and constraints.

The second-stage framework uses a dependency-light JSON-file database adapter for local initialization and unit tests. It is an adapter boundary, not the production database choice.

## Core Entities

The local framework initializes these collections: `users`, `sessions`, `files`, `tasks`, `billing_events`, `templates`, `audit_logs`, `outlines`, `decks`, `generation_tasks`, and `call_logs`.

### users

Stores Moling identity references, not passwords.

Fields: `id`, `moling_user_id`, `display_name`, `created_at`, `updated_at`.

### projects

Groups user decks.

Fields: `id`, `owner_user_id`, `title`, `status`, `created_at`, `updated_at`.

### decks

Represents one generated or uploaded presentation.

Fields: `id`, `project_id`, `owner_user_id`, `title`, `source_type`, `template_id`, `status`, `created_at`, `updated_at`.

### slides

Stores normalized slide content for editing and regeneration.

Fields: `id`, `deck_id`, `sort_order`, `title`, `content_json`, `layout_json`, `speaker_notes`, `created_at`, `updated_at`.

### generation_tasks

Tracks asynchronous AI jobs and billing state.

Fields: `id`, `owner_user_id`, `deck_id`, `task_type`, `status`, `input_json`, `result_json`, `error_code`, `error_message`, `billing_hold_id`, `idempotency_key`, `created_at`, `updated_at`.

### outlines

Stores editable AI-generated outlines before full deck generation.

Fields: `id`, `owner_user_id`, `topic`, `template_id`, `theme`, `status`, `input`, `slides`, `created_at`, `updated_at`.

### billing_events

Stores application-side billing attempts for reconciliation.

Fields: `id`, `owner_user_id`, `moling_entitlement_id`, `task_id`, `event_type`, `amount`, `status`, `hold_id`, `idempotency_key`, `platform_response_json`, `created_at`, `updated_at`.

### files

Stores metadata for uploads and generated exports.

Fields: `id`, `owner_user_id`, `deck_id`, `storage_key`, `file_type`, `mime_type`, `size_bytes`, `checksum`, `visibility`, `status`, `created_at`, `updated_at`.

### call_logs

Stores user-scoped application actions for audit and troubleshooting.

Fields: `id`, `owner_user_id`, `action`, `resource_type`, `resource_id`, `metadata`, `created_at`.

### audit_logs

Records security and important business events.

Fields: `id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata_json`, `created_at`.

## Consistency Rules

- Credit reservation and task creation are persisted before a worker starts generation.
- Billing idempotency keys are unique.
- Users can only access rows where ownership resolves to their Moling user identity.
- Failed generation after a successful reserve must produce a release event.
- Successful generation after a reserve must produce a settle event.

## Indexes

- `users.moling_user_id`
- `projects.owner_user_id`
- `decks.owner_user_id`
- `slides.deck_id, sort_order`
- `generation_tasks.owner_user_id, status`
- `generation_tasks.idempotency_key`
- `billing_events.idempotency_key`
- `files.owner_user_id, deck_id`
