-- Fase 4 hotfix: controllo delle sale occupate direttamente sull'evento,
-- senza dipendere soltanto dalla tabella dei singoli slot.
-- ESEGUIRE DOPO 0008_eventi_privati.sql. Idempotente.

-- 1. Verifica prenotazione già al momento della creazione della testata.
CREATE TRIGGER IF NOT EXISTS oasi_reservation_event_room_guard_v2
BEFORE INSERT ON reservations
WHEN NEW.room_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM oasi_private_events e
 JOIN oasi_event_rooms er ON er.event_id=e.id
 WHERE er.room_id=NEW.room_id AND e.status<>'cancelled'
 AND NEW.book_date BETWEEN e.start_date AND e.end_date
 AND (e.service='both' OR e.service=NEW.service)
)
BEGIN SELECT RAISE(ABORT,'oasi_event_room_reserved'); END;

-- 2. Protezione anche quando una prenotazione preesistente viene riassegnata.
CREATE TRIGGER IF NOT EXISTS oasi_reservation_event_move_guard_v2
BEFORE UPDATE OF room_id, book_date, service ON reservations
WHEN NEW.status='confirmed' AND NEW.room_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM oasi_private_events e
 JOIN oasi_event_rooms er ON er.event_id=e.id
 WHERE er.room_id=NEW.room_id AND e.status<>'cancelled'
 AND NEW.book_date BETWEEN e.start_date AND e.end_date
 AND (e.service='both' OR e.service=NEW.service)
)
BEGIN SELECT RAISE(ABORT,'oasi_event_room_reserved'); END;

-- 3. Protezione del singolo tavolo, anche su vecchie prenotazioni o
--    se la testata riporta una sala differente da quella del tavolo.
CREATE TRIGGER IF NOT EXISTS oasi_reservation_table_event_guard_v2
BEFORE INSERT ON reservation_tables
WHEN EXISTS (
 SELECT 1 FROM tables t
 JOIN oasi_event_rooms er ON er.room_id=t.room_id
 JOIN oasi_private_events e ON e.id=er.event_id
 WHERE t.id=NEW.table_id AND e.status<>'cancelled'
 AND NEW.book_date BETWEEN e.start_date AND e.end_date
 AND (e.service='both' OR e.service=NEW.service)
)
BEGIN SELECT RAISE(ABORT,'oasi_event_room_reserved'); END;

CREATE TRIGGER IF NOT EXISTS oasi_reservation_table_update_guard_v2
BEFORE UPDATE OF table_id, book_date, service ON reservation_tables
WHEN EXISTS (
 SELECT 1 FROM tables t
 JOIN oasi_event_rooms er ON er.room_id=t.room_id
 JOIN oasi_private_events e ON e.id=er.event_id
 WHERE t.id=NEW.table_id AND e.status<>'cancelled'
 AND NEW.book_date BETWEEN e.start_date AND e.end_date
 AND (e.service='both' OR e.service=NEW.service)
)
BEGIN SELECT RAISE(ABORT,'oasi_event_room_reserved'); END;
