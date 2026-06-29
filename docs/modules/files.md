# Files Module

The files foundation supports owner-scoped local uploads and downloads.

Current implementation:

- `src/files.js`
- local storage directory from environment configuration
- file metadata persisted through the database adapter
- owner checks before download
- upload validation rejects empty files, files over 2 MiB, unsupported MIME types, and invalid API payloads

Allowed MIME types:

- `text/plain`
- `text/markdown`
- `application/json`
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`

Future work:

- object storage adapter
- pre-signed upload URLs
- antivirus or content scanning
- retention cleanup
