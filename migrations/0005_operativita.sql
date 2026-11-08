-- OASI: Fase 1 - Stati di servizio e blocchi disponibilita
-- Non modifica prenotazioni e tavoli esistenti.
CREATE TABLE IF NOT EXISTS service_visits (
  reservation_id INTEGER PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'expected' CHECK(state IN ('expected','arrived','seated','finished','no_show')),
  updated_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS service_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_date TEXT NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('lunch','dinner')),
  scope TEXT NOT NULL CHECK(scope IN ('service','room','table')),
  target_id INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(book_date,service,scope,target_id)
);
CREATE INDEX IF NOT EXISTS idx_service_blocks_lookup ON service_blocks(book_date,service,scope,target_id);
