# Files Module

The files foundation supports owner-scoped local uploads and downloads.

Current implementation:

- `src/files.js`
- local storage directory from environment configuration
- file metadata persisted through the database adapter
- owner checks before download

Future work:

- object storage adapter
- pre-signed upload URLs
- antivirus or content scanning
- retention cleanup
