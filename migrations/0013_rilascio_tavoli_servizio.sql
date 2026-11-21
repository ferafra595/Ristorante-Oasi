-- Archivio permanente degli abbinamenti tavolo delle prenotazioni concluse/assenti.
-- Le assegnazioni attive restano in reservation_tables (uniche per tavolo/data/servizio).
-- Quando la prenotazione termina, il tavolo si libera senza perdere il suo storico.
CREATE TABLE IF NOT EXISTS oasi_released_table_assignments (
 reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
 table_id INTEGER NOT NULL REFERENCES tables(id),
 table_code TEXT NOT NULL,
 book_date TEXT NOT NULL,
 service TEXT NOT NULL,
 released_state TEXT NOT NULL CHECK(released_state IN ('finished','no_show')),
 released_at TEXT NOT NULL,
 PRIMARY KEY(reservation_id,table_id)
);
CREATE INDEX IF NOT EXISTS idx_oasi_released_by_date ON oasi_released_table_assignments(book_date,service);
INSERT OR IGNORE INTO oasi_schema_versions(version) VALUES(13);
