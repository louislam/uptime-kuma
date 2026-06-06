CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'operator', 'viewer')),
    password_json TEXT NOT NULL,
    totp_json TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT,
    user_agent TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_audit_log_user_id ON user_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_actor_user_id ON user_audit_log(actor_user_id, created_at DESC);

INSERT INTO users (username, role, password_json, totp_json, active, created_at, updated_at)
SELECT
    json_extract(auth.value, '$.username'),
    'admin',
    json_extract(auth.value, '$.password'),
    totp.value,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM app_settings auth
LEFT JOIN app_settings totp ON totp.key = 'workerAuthTotp'
WHERE auth.key = 'workerAuthUser'
  AND json_extract(auth.value, '$.username') IS NOT NULL
  AND json_extract(auth.value, '$.password') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users);
