# File Management Design

## File Categories

- user uploads: documents, outlines, source PPT files
- generated assets: images, charts, thumbnails
- generated exports: PPTX and PDF
- temporary worker artifacts

## Storage

Use object storage for binary files and PostgreSQL for metadata.

Metadata includes:

- owner user ID
- deck ID
- storage key
- file type
- MIME type
- size
- checksum
- visibility
- lifecycle status

## Access Model

- Users can access only files they own.
- Download URLs are short-lived.
- Uploads use constrained pre-signed URLs when direct upload is introduced.
- Internal worker files are not user-downloadable unless promoted to generated assets or exports.

## Lifecycle

- Uploaded source files are retained while linked to an active project.
- Temporary artifacts expire automatically.
- Generated exports can be regenerated from deck data.
- Deleting a deck marks related files for asynchronous cleanup.

## Security

- Validate MIME type and size before accepting uploads.
- Scan or reject unsupported file types.
- Never expose raw storage credentials to the browser.
- Use unpredictable storage keys and avoid user-controlled paths.
