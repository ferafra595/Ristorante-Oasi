-- Fase 4 Oasi: eventi privati gestiti esclusivamente dall'ADMIN.
-- Eseguire prima di pubblicare server/api.js e server/phase4.js.
CREATE TABLE IF NOT EXISTS oasi_private_events (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'Evento privato',
 contact_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL,
 service TEXT NOT NULL CHECK(service IN ('lunch','dinner','both')),
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('provisional','confirmed','completed','cancelled')),
 guests INTEGER NOT NULL DEFAULT 0,
 estimated_cents INTEGER NOT NULL DEFAULT 0,
 deposit_cents INTEGER NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oasi_event_rooms (
 event_id TEXT NOT NULL REFERENCES oasi_private_events(id) ON DELETE CASCADE,
 room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
 PRIMARY KEY(event_id,room_id)
);
CREATE TABLE IF NOT EXISTS oasi_event_room_slots (
 event_id TEXT NOT NULL REFERENCES oasi_private_events(id) ON DELETE CASCADE,
 room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
 book_date TEXT NOT NULL,
 service TEXT NOT NULL CHECK(service IN ('lunch','dinner')),
 PRIMARY KEY(book_date,service,room_id)
);
CREATE INDEX IF NOT EXISTS idx_oasi_event_slots_event ON oasi_event_room_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_oasi_event_dates ON oasi_private_events(start_date,end_date);
-- Guard: atomicamente impedisce che una nuova prenotazione occupi la sala riservata a eventi.
CREATE TRIGGER IF NOT EXISTS oasi_booking_event_room_guard
BEFORE INSERT ON reservation_tables
WHEN EXISTS (
 SELECT 1 FROM tables t JOIN oasi_event_room_slots slot ON slot.room_id=t.room_id
 WHERE t.id=NEW.table_id AND slot.book_date=NEW.book_date AND slot.service=NEW.service
)
BEGIN SELECT RAISE(ABORT,'oasi_event_room_reserved'); END;
-- Guard reciproco: non è possibile bloccare una sala già prenotata.
CREATE TRIGGER IF NOT EXISTS oasi_event_existing_reservations_guard
BEFORE INSERT ON oasi_event_room_slots
WHEN EXISTS (
 SELECT 1 FROM tables t JOIN reservation_tables rt ON rt.table_id=t.id
 JOIN reservations r ON r.id=rt.reservation_id
 WHERE t.room_id=NEW.room_id AND rt.book_date=NEW.book_date AND rt.service=NEW.service AND r.status='confirmed'
)
BEGIN SELECT RAISE(ABORT,'oasi_event_existing_reservations'); END;
