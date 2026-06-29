# Logging and Observability Design

## Structured Logs

Use JSON logs with consistent fields:

- `timestamp`
- `level`
- `request_id`
- `user_id`
- `task_id`
- `module`
- `event`
- `duration_ms`
- `error_code`

## Redaction

Logs must redact:

- internal tokens
- passwords
- AI provider keys
- storage credentials
- launch tickets
- uploaded document content

## Metrics

Track:

- request latency and error rate
- generation task duration
- queue depth
- reserve, settle, release, and reconciliation counts
- AI provider latency, failures, and cost estimates
- export duration and failure rate

## Tracing

Use request IDs across API, queue job, worker, billing call, and storage operation. A task should be traceable from user request to final file export.

## Alerts

Alert on:

- repeated billing reconciliation failures
- high generation failure rate
- queue backlog
- provider outage
- abnormal credit reserve without settlement or release
