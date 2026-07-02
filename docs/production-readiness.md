# AI PPT 上线硬化清单

## 运行观测

- 结构化日志：HTTP 请求完成后输出 `request_completed`，包含 `requestId`、`method`、`route`、`status`、`latencyMs`，敏感 query 参数会被脱敏。
- 错误日志：请求失败输出 `request_failed`，包含请求 ID、HTTP 方法、脱敏 URL、错误码。
- 指标端点：`GET /metrics` 输出 Prometheus 文本指标。
- 关键指标：
  - `http_requests_total{route,status}`：按路由和状态码统计请求量。
  - `http_request_duration_ms_count/sum{route,status}`：按路由和状态码统计请求耗时。
  - `llm_calls_total{operation}`：按模型调用场景统计 LLM 调用次数。
  - `llm_prompt_chars_total{operation}` 和 `llm_prompt_chars_count/sum{operation}`：统计 prompt 长度。
  - `alerts_total{type,...}`：记录 5xx 和 prompt 超限等需要告警的事件。

## 成本和滥用护栏

- 单用户固定窗口限流由 `RATE_LIMIT_MAX_REQUESTS` 和 `RATE_LIMIT_WINDOW_MS` 控制，超限返回 `RATE_LIMIT_EXCEEDED`。
- JSON 请求体超过 1 MiB 返回 `REQUEST_BODY_TOO_LARGE`。
- 文件上传大小由 `MAX_UPLOAD_BYTES` 控制，超限请求必须在存储前拒绝。
- LLM prompt 超过 5000 字符返回 `PROMPT_TOO_LONG`，并且不会调用 AI provider。
- 生成 PPT 使用 reserve -> settle/release，重试和失败路径通过幂等键避免重复扣费。
- 同一用户同一 outline 同时生成时，只允许一个任务进入扣费流程，其余请求返回 `GENERATION_ALREADY_RUNNING`。

## 权限和数据隔离

- 所有文件、outline、deck、asset、task、个人模板读取和变更必须带 `ownerUserId` 过滤。
- 文件下载 token 包含 `fileId`、`ownerUserId`、过期时间和 HMAC 签名，且响应 `Cache-Control: no-store`。
- 禁用用户的已存在 session 在恢复时会被拒绝。
- `.env`、密钥、导出文件、本地数据、`node_modules` 不允许提交。

## 上线验收命令

在 `ppt-ai-app/` 下运行：

```bash
npm test -- test/production-hardening.test.js
npm test
npm run acceptance:production
```

如果服务不在默认端口，设置：

```bash
ACCEPTANCE_BASE_URL=http://127.0.0.1:5177 npm run acceptance:production
```

验收必须确认：

- `/api/health` 返回 `{"status":"ok"}`。
- `/metrics` 返回 `http_requests_total`。
- 超限请求被拒绝，且不会进入昂贵的模型调用或扣费流程。
- 并发生成同一 outline 不会重复 reserve。
- 跨用户资产、模板、下载访问被测试覆盖并拒绝。
