# Acceptance Criteria

## First-Stage Acceptance

The architecture phase is accepted when:

- `docs/` contains the required core documents.
- Requirements, project overview, architecture, technology, database, API, workflow, user flow, Moling integration, billing, file management, permission, logging, error handling, deployment, modules, development plan, testing, and acceptance designs are documented.
- Root `README.md` explains the project and current phase limits.
- Root `.env.example` lists required configuration variables without real values.
- `ppt-ai-app/` is initialized but contains no business logic.
- No committed file contains real Moling internal tokens, test passwords, or production platform URLs.
- Work stops after documentation and project initialization.

## Future Production Acceptance

Later implementation phases must prove:

- Moling users can enter with SSO.
- users can see the active entitlement balance after entering AI PPT.
- users can generate a PPT from topic/template/source input.
- users can generate a PPT from uploaded source documents (`/api/files` + `source_file_id`).
- users can generate uploaded-document outlines and paid deck generation for different users without cross-user entitlement mixing.
- users can edit outline JSON before generation.
- users can regenerate one generated slide.
- retryable failures return a task ID that the workspace can retry.
- each user uses the entitlement returned by Moling launch verification before falling back to configured defaults.
- credit reserve, settle, and release are correct and idempotent.
- failed generation does not consume credits.
- exported PPTX/PDF files are downloaded by the owner, return filename headers, and create `file_downloaded` logs.
- logs, metrics, and reconciliation alerts are available.
- access control prevents cross-user data access.

## Third-Stage Acceptance Commands

Local deterministic acceptance uses the in-process Moling mock and verifies the full export-download-log path plus credit deduction:

```bash
npm run acceptance
```

Real Moling acceptance requires a one-time launch ticket from the platform:

```bash
ACCEPTANCE_BASE_URL=http://127.0.0.1:5177 \
ACCEPTANCE_LAUNCH_TICKET=<real_launch_ticket> \
ACCEPTANCE_ENTITLEMENT_ID=<optional_entitlement_id> \
npm run acceptance:moling
```

The real command is the acceptance evidence for platform login, entitlement resolution, balance lookup, reserve/settle billing, slide regeneration consumption, generated file ownership, real PPTX/PDF downloads, call-log persistence, and the expected balance decrease after paid operations. Local mock success is necessary for regression coverage but is not sufficient to claim full Moling联调完成.

## 手动验收清单（本地）

推荐在本地环境（`npm start`）执行一次完整流程：

- 打开主页并通过 `ticket=local_ticket` 进入（或平台真实票据）。
- 在页面点击“生成大纲”，确认返回大纲 ID。
- 编辑大纲后点击“生成演示文稿”，确认按钮状态切换到“任务中”，并持续显示：
  - `running` 过程中的状态/进度
  - `succeeded` 后显示 `deckId`
  - 失败返回 `retryable` 标识
- 生成成功后：调用预览接口确认可见内容。
- 点击导出 PPTX/PDF，确认返回 `file.id`，并能在 `/api/files/{fileId}` 下载成功。
- 再执行一次同一用户登出/重登场景验证：`session` 恢复后可继续查看同一轮任务状态。
- 切换到另一用户 `user_id`，重复上述流程，确认无法查看或下载对方文件、调用日志与余额独立。
