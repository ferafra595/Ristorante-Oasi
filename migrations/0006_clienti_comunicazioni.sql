-- Oasi Fase 2: clienti, notifiche e registro email
-- Non modifica o elimina prenotazioni e tavoli esistenti.
CREATE TABLE IF NOT EXISTS oasi_customers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 staff_note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oasi_customers_phone ON oasi_customers(phone);
CREATE TABLE IF NOT EXISTS oasi_email_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_key TEXT NOT NULL UNIQUE,
 reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
 recipient TEXT NOT NULL,
 email_type TEXT NOT NULL,
 subject TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','unconfigured')) DEFAULT 'pending',
 error TEXT NOT NULL DEFAULT '',
 provider_id TEXT NOT NULL DEFAULT '',
 attempted_at TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oasi_email_log_reservation ON oasi_email_log(reservation_id,created_at);
CREATE TABLE IF NOT EXISTS oasi_staff_notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
 event_type TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 seen INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oasi_staff_notifications_recent ON oasi_staff_notifications(seen,created_at DESC);
-- Recupera anagrafiche dalle prenotazioni pregresse che hanno un'email valida.
INSERT OR IGNORE INTO oasi_customers(email,name,phone,created_at,updated_at)
SELECT lower(trim(r.email)),r.name,r.phone,datetime('now'),datetime('now')
FROM reservations r
WHERE instr(r.email,'@')>1 AND instr(substr(r.email,instr(r.email,'@')+1),'.')>0
ORDER BY r.id DESC;
