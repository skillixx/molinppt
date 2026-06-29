# PPT Service Module

The PPT service orchestrates the complete AI PPT workflow.

Current implementation:

- `src/ppt-service.js`
- topic-to-outline generation
- uploaded-document-to-outline generation
- outline editing
- deck generation with template, theme, and page count
- balance check, reserve, settle, release, and consume billing calls
- failed generation retry
- single-slide regeneration
- online preview
- PPTX and PDF export storage
- owner-scoped call logs

Design notes:

- Outline generation is separated from deck generation so users can edit before chargeable work.
- Full deck generation uses reserve -> settle/release because it is expensive and failure-prone.
- Single-slide regeneration uses consume because the current operation has known cost.
- The current exporter produces a minimal Office Open XML PPTX ZIP package and a minimal PDF with xref/trailer without external dependencies. A richer production renderer can replace `PptExportService` behind the same interface.
