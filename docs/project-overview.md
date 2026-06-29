# Project Overview

## Goal

Build a production-ready AI PPT tool as a Moling platform application. Users enter from Moling, generate high-quality presentations with AI, manage generated files, and consume Moling prepaid credits through the platform billing system.

## Product Scope

The product experience references Presenton for interaction patterns such as topic input, outline confirmation, slide generation, editing, and export. Presenton source code is not used as the implementation base.

Core user capabilities for later phases:

- create a PPT from a topic, prompt, document, or selected template
- review and edit outline before generation
- generate slide content, layouts, and optional images
- preview generated PPT in the browser
- export PPTX and PDF files
- view credit balance and generation history

## First-Stage Scope

This stage is limited to architecture design and project initialization. It must not include business logic, platform API calls, billing code, AI generation code, or real user flows.

Deliverables:

- initialized application workspace
- environment variable example
- project README
- architecture, database, API, workflow, billing, deployment, directory, and module design documents

## Non-Goals

- no working PPT generation
- no SSO implementation
- no billing implementation
- no database migration execution
- no Presenton code refactor
- no production deployment

## Success Criteria

- all required design topics are documented
- all configuration is expressed as environment variables
- no real token, account, password, or platform host is committed
- application workspace remains a skeleton without business logic
