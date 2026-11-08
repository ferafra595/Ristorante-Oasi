-- Oasi fase 5: audit minimalista e protezione accessi (un unico account ADMIN).
CREATE TABLE IF NOT EXISTS oasi_login_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ip_hash TEXT NOT NULL,
 success INTEGER NOT NULL CHECK(success IN (0,1)),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oasi_login_attempts_ip_time ON oasi_login_attempts(ip_hash,created_at);
CREATE TABLE IF NOT EXISTS oasi_admin_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 method TEXT NOT NULL,
 resource TEXT NOT NULL,
 resource_id TEXT NOT NULL DEFAULT '',
 http_status INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oasi_admin_audit_time ON oasi_admin_audit(created_at);
