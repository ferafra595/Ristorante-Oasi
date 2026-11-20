-- Fase 7. Idempotente; nessuna cancellazione o modifica dei record esistenti.
-- Protezioni applicate anche quando due richieste superano contemporaneamente i controlli preliminari.
CREATE TRIGGER IF NOT EXISTS oasi_f7_booking_room_insert
BEFORE INSERT ON reservations WHEN NEW.status='confirmed'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id AND ((NEW.source='web' AND public_enabled=1) OR (NEW.source<>'web' AND internal_enabled=1))) THEN RAISE(ABORT,'oasi_room_disabled') END;
END;
CREATE TRIGGER IF NOT EXISTS oasi_f7_assignment_guard
BEFORE INSERT ON reservation_tables
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reservations r JOIN tables t ON t.id=NEW.table_id WHERE r.id=NEW.reservation_id AND r.status='confirmed' AND r.book_date=NEW.book_date AND r.service=NEW.service AND r.room_id=t.room_id) THEN RAISE(ABORT,'oasi_assignment_invalid') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tables WHERE id=NEW.table_id AND enabled=1) THEN RAISE(ABORT,'oasi_table_disabled') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM service_blocks b JOIN tables t ON t.id=NEW.table_id WHERE b.book_date=NEW.book_date AND b.service=NEW.service AND (b.scope='service' OR (b.scope='room' AND b.target_id=t.room_id) OR (b.scope='table' AND b.target_id=t.id))) THEN RAISE(ABORT,'oasi_manual_block') END;
END;
CREATE TRIGGER IF NOT EXISTS oasi_f7_no_reactivation
BEFORE UPDATE OF status ON reservations WHEN OLD.status='cancelled' AND NEW.status<>'cancelled'
BEGIN SELECT RAISE(ABORT,'oasi_cancelled_booking'); END;
CREATE TRIGGER IF NOT EXISTS oasi_f7_move_room
BEFORE UPDATE OF room_id ON reservations WHEN NEW.status='confirmed'
BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id AND internal_enabled=1) THEN RAISE(ABORT,'oasi_room_disabled') END; END;
-- Richiamato alla fine del batch di creazione/spostamento, oltre che durante la modifica dei coperti.
CREATE TRIGGER IF NOT EXISTS oasi_f7_capacity_guard
BEFORE UPDATE OF party_size ON reservations WHEN NEW.status='confirmed'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reservation_tables WHERE reservation_id=NEW.id) OR EXISTS(SELECT 1 FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id WHERE rt.reservation_id=NEW.id AND (t.room_id<>NEW.room_id OR rt.book_date<>NEW.book_date OR rt.service<>NEW.service)) THEN RAISE(ABORT,'oasi_assignment_invalid') END;
 SELECT CASE WHEN NEW.party_size NOT BETWEEN (SELECT SUM(COALESCE(d.min_seats,1)) FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id LEFT JOIN table_details d ON d.table_id=t.id WHERE rt.reservation_id=NEW.id) AND (SELECT SUM(t.seats) FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id WHERE rt.reservation_id=NEW.id) THEN RAISE(ABORT,'oasi_capacity_invalid') END;
END;
-- Conservativo: le caratteristiche operative dei tavoli con prenotazioni presenti/future
-- non si cambiano finché queste non sono spostate/annullate. La geometria resta modificabile.
-- Un giorno di margine evita problemi di fuso orario attorno alla mezzanotte.
CREATE TRIGGER IF NOT EXISTS oasi_f7_protect_reserved_table
BEFORE UPDATE OF seats,enabled,room_id ON tables
WHEN (NEW.seats<>OLD.seats OR NEW.enabled<>OLD.enabled OR NEW.room_id<>OLD.room_id)
 AND EXISTS(SELECT 1 FROM reservation_tables rt JOIN reservations r ON r.id=rt.reservation_id WHERE rt.table_id=OLD.id AND r.status='confirmed' AND r.book_date>=date('now','-1 day'))
BEGIN SELECT RAISE(ABORT,'oasi_reserved_table_configuration'); END;
CREATE TRIGGER IF NOT EXISTS oasi_f7_protect_min_seats
BEFORE UPDATE OF min_seats ON table_details
WHEN NEW.min_seats<>OLD.min_seats AND EXISTS(SELECT 1 FROM reservation_tables rt JOIN reservations r ON r.id=rt.reservation_id WHERE rt.table_id=OLD.table_id AND r.status='confirmed' AND r.book_date>=date('now','-1 day'))
BEGIN SELECT RAISE(ABORT,'oasi_reserved_table_configuration'); END;
CREATE TRIGGER IF NOT EXISTS oasi_f7_protect_new_min_seats
BEFORE INSERT ON table_details
WHEN NEW.min_seats<>COALESCE((SELECT min_seats FROM table_details WHERE table_id=NEW.table_id),1) AND EXISTS(SELECT 1 FROM reservation_tables rt JOIN reservations r ON r.id=rt.reservation_id WHERE rt.table_id=NEW.table_id AND r.status='confirmed' AND r.book_date>=date('now','-1 day'))
BEGIN SELECT RAISE(ABORT,'oasi_reserved_table_configuration'); END;
-- Anche una cerimonia preesistente senza slot materializzati deve restare autorevole.
CREATE TRIGGER IF NOT EXISTS oasi_f7_event_room_guard
BEFORE INSERT ON oasi_event_rooms
WHEN EXISTS(SELECT 1 FROM oasi_private_events WHERE id=NEW.event_id AND status<>'cancelled')
BEGIN
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM oasi_private_events e JOIN oasi_event_rooms er ON er.room_id=NEW.room_id
 JOIN oasi_private_events other ON other.id=er.event_id
 WHERE e.id=NEW.event_id AND other.id<>e.id AND other.status<>'cancelled'
 AND other.start_date<=e.end_date AND other.end_date>=e.start_date
 AND (other.service=e.service OR other.service='both' OR e.service='both')
 ) THEN RAISE(ABORT,'oasi_event_slot_conflict') END;
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM oasi_private_events e JOIN reservations r ON r.book_date BETWEEN e.start_date AND e.end_date
 JOIN reservation_tables rt ON rt.reservation_id=r.id JOIN tables t ON t.id=rt.table_id
 WHERE e.id=NEW.event_id AND t.room_id=NEW.room_id AND r.status='confirmed' AND (e.service='both' OR e.service=r.service)
 ) THEN RAISE(ABORT,'oasi_event_existing_reservations') END;
END;
CREATE TABLE IF NOT EXISTS oasi_schema_versions(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO oasi_schema_versions(version) VALUES(11);
