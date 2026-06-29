CREATE TABLE ppt_app_sessions (
  id TEXT PRIMARY KEY,
  platform_user_id INTEGER NOT NULL,
  platform_app_id INTEGER NOT NULL,
  platform_product_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_ppt_app_sessions_platform_user_id
  ON ppt_app_sessions (platform_user_id);

CREATE INDEX idx_ppt_app_sessions_expires_at
  ON ppt_app_sessions (expires_at);

CREATE TABLE presentations (
  id TEXT PRIMARY KEY,
  platform_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  language TEXT NOT NULL,
  slide_count INTEGER NOT NULL,
  template_id TEXT,
  outline_json TEXT,
  structure_json TEXT,
  theme_json TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_presentations_platform_user_id
  ON presentations (platform_user_id);

CREATE INDEX idx_presentations_status
  ON presentations (status);

CREATE TABLE slides (
  id TEXT PRIMARY KEY,
  presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  "index" INTEGER NOT NULL,
  layout_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  speaker_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (presentation_id, "index")
);

CREATE INDEX idx_slides_presentation_id
  ON slides (presentation_id);

CREATE TABLE generation_tasks (
  id TEXT PRIMARY KEY,
  platform_user_id INTEGER NOT NULL,
  presentation_id TEXT REFERENCES presentations(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL,
  entitlement_id INTEGER,
  hold_id TEXT,
  reserved_amount TEXT,
  settled_amount TEXT,
  idempotency_key TEXT UNIQUE,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_generation_tasks_platform_user_id
  ON generation_tasks (platform_user_id);

CREATE INDEX idx_generation_tasks_presentation_id
  ON generation_tasks (presentation_id);

CREATE INDEX idx_generation_tasks_status
  ON generation_tasks (status);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  platform_user_id INTEGER NOT NULL,
  presentation_id TEXT REFERENCES presentations(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL,
  path TEXT NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_assets_platform_user_id
  ON assets (platform_user_id);

CREATE INDEX idx_assets_presentation_id
  ON assets (presentation_id);
