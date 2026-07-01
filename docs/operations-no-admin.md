# 无后台运维规范

本项目不建设用户管理后台和数据管理后台。少量用户和数据问题通过受控脚本处理，所有变更必须留下备份、执行记录和回滚方式。

## 账号分离

生产数据库至少准备两个账号：

```sql
CREATE USER 'ppt_readonly'@'%' IDENTIFIED BY 'change-me-readonly';
CREATE USER 'ppt_operator'@'%' IDENTIFIED BY 'change-me-operator';

GRANT SELECT ON ppt_ai_app.* TO 'ppt_readonly'@'%';

GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.users TO 'ppt_operator'@'%';
GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.sessions TO 'ppt_operator'@'%';
GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.ppt_assets TO 'ppt_operator'@'%';
GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.templates TO 'ppt_operator'@'%';
GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.files TO 'ppt_operator'@'%';
GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.storage_objects TO 'ppt_operator'@'%';
GRANT SELECT, INSERT, UPDATE ON ppt_ai_app.user_usage_counters TO 'ppt_operator'@'%';
GRANT SELECT, INSERT ON ppt_ai_app.admin_change_logs TO 'ppt_operator'@'%';
```

约束：

- 日常排查只使用 `ppt_readonly`。
- 执行脚本只使用 `ppt_operator`。
- 不给运维账号 `DROP`、`ALTER`、`DELETE` 权限。
- 不暴露 `/api/admin/users`、`/api/admin/ppt-assets`、`/api/admin/templates`。

## 变更前备份

批量变更前必须先备份目标行。推荐用独立备份表：

```sql
CREATE TABLE IF NOT EXISTS ops_row_backups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  change_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(64) NOT NULL,
  row_id VARCHAR(191) NOT NULL,
  row_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
```

备份示例：

```sql
SET @change_id = 'chg_20260630_disable_user_7';

INSERT INTO ops_row_backups(change_id, table_name, row_id, row_json)
SELECT @change_id, 'users', id, JSON_OBJECT('id', id, 'data', data, 'created_at', created_at, 'updated_at', updated_at)
FROM users
WHERE JSON_EXTRACT(data, '$.moling_user_id') = 7;
```

脚本会额外写入 `admin_change_logs`，包含：

- `actor`
- `operation`
- `targetType`
- `targetId`
- `before`
- `after`
- `reason`
- `rollbackSql`
- `executed_at`

## 运维命令

从 `ppt-ai-app/` 执行：

```bash
npm run admin:disable-user -- --user-id=7 --actor=ops --reason=risk
npm run admin:restore-user -- --user-id=7 --actor=ops --reason=resolved
npm run admin:recalculate-usage -- --owner-user-id=7 --actor=ops
npm run admin:soft-delete-ppt-asset -- --owner-user-id=7 --asset-id=asset_id --actor=ops --reason=bad_export
npm run admin:soft-delete-personal-template -- --owner-user-id=7 --template-id=template_id --actor=ops --reason=broken_template
npm run admin:cleanup-storage -- --actor=ops --limit=100
```

所有脚本输出 JSON，执行后必须保存到工单或事故记录。

## 回滚规范

优先使用 `admin_change_logs.rollbackSql` 中的单条回滚语句。批量场景使用 `ops_row_backups`：

```sql
-- 示例：从备份恢复 users.data
UPDATE users u
JOIN ops_row_backups b ON b.row_id = u.id
SET u.data = JSON_EXTRACT(b.row_json, '$.data'),
    u.updated_at = CURRENT_TIMESTAMP(3)
WHERE b.change_id = 'chg_20260630_disable_user_7'
  AND b.table_name = 'users';
```

回滚后必须：

1. 重新执行只读查询确认状态。
2. 在工单中记录回滚 SQL、执行人和时间。
3. 如涉及对象存储清理，确认文件是否已物理删除；已删除文件只能从对象存储备份恢复。

## 常用只读排查 SQL

```sql
SELECT id, JSON_EXTRACT(data, '$.moling_user_id') AS moling_user_id, JSON_EXTRACT(data, '$.status') AS status
FROM users
WHERE JSON_EXTRACT(data, '$.moling_user_id') = 7;

SELECT id, JSON_EXTRACT(data, '$.status') AS status, JSON_EXTRACT(data, '$.ownerUserId') AS owner_user_id
FROM ppt_assets
WHERE JSON_EXTRACT(data, '$.ownerUserId') = 7;

SELECT id, JSON_EXTRACT(data, '$.status') AS status, JSON_EXTRACT(data, '$.scope') AS scope
FROM templates
WHERE JSON_EXTRACT(data, '$.ownerUserId') = 7;

SELECT id, JSON_EXTRACT(data, '$.status') AS status, JSON_EXTRACT(data, '$.storageKey') AS storage_key
FROM storage_objects
WHERE JSON_EXTRACT(data, '$.ownerUserId') = 7;
```

