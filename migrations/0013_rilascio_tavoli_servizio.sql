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
-- La capienza del primo piano considera soltanto le prenotazioni ancora attive.
-- OASI: inverno, primo piano senza piantina/tavoli. Il limite è espresso in coperti,
-- configurato dal personale (0 = non abilitato). Mai accettare overflow illimitato.
-- Nessun intervento su prenotazioni esistenti.
DROP TRIGGER IF EXISTS oasi_f7_booking_room_insert;
CREATE TRIGGER oasi_f7_booking_room_insert
BEFORE INSERT ON reservations WHEN NEW.status='confirmed'
BEGIN
 SELECT CASE WHEN NOT EXISTS(
   SELECT 1 FROM rooms WHERE id=NEW.room_id AND (
     (NEW.source='web' AND public_enabled=1)
     OR (NEW.source<>'web' AND internal_enabled=1)
     OR (NEW.room_id=2 AND internal_enabled=1
       AND json_extract((SELECT value FROM settings WHERE key='booking'),'$.seasonMode')='winter'
       AND json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowEnabled')=1
       AND COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowCapacity'),0)>0)
   )
 ) THEN RAISE(ABORT,'oasi_room_disabled') END;
 SELECT CASE WHEN NEW.room_id=2 AND NEW.source='web' AND EXISTS(
  SELECT 1 FROM rooms WHERE id=2 AND public_enabled=0
 ) AND (
   json_extract((SELECT value FROM settings WHERE key='booking'),'$.seasonMode')<>'winter'
   OR COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowCapacity'),0)<=0
   OR COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowEnabled'),0)<>1
 ) THEN RAISE(ABORT,'oasi_overflow_closed') END;
 SELECT CASE WHEN NEW.room_id=2
 AND (SELECT COUNT(*) FROM tables WHERE room_id=2 AND enabled=1)=0
 AND (
  COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowEnabled'),0)<>1
  OR COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.seasonMode'),'')<>'winter'
  OR COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowCapacity'),0)<
    NEW.party_size+(SELECT COALESCE(SUM(party_size),0) FROM reservations r WHERE r.room_id=2 AND r.book_date=NEW.book_date AND r.service=NEW.service AND r.status='confirmed' AND NOT EXISTS(SELECT 1 FROM service_visits v WHERE v.reservation_id=r.id AND v.state IN ('finished','no_show')))
  OR EXISTS(SELECT 1 FROM service_blocks WHERE book_date=NEW.book_date AND service=NEW.service AND (scope='service' OR (scope='room' AND target_id=2)))
  OR EXISTS(SELECT 1 FROM oasi_private_events e JOIN oasi_event_rooms er ON er.event_id=e.id
    WHERE er.room_id=2 AND e.status<>'cancelled' AND NEW.book_date BETWEEN e.start_date AND e.end_date
    AND (e.service='both' OR e.service=NEW.service))
 ) THEN RAISE(ABORT,'oasi_overflow_capacity') END;
END;

DROP TRIGGER IF EXISTS oasi_f7_capacity_guard;
CREATE TRIGGER oasi_f7_capacity_guard
BEFORE UPDATE OF party_size ON reservations WHEN NEW.status='confirmed'
BEGIN
 SELECT CASE WHEN
   NEW.room_id=2 AND NOT EXISTS(SELECT 1 FROM reservation_tables WHERE reservation_id=NEW.id)
   AND (
     COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowEnabled'),0)<>1
     OR COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.seasonMode'),'')<>'winter'
     OR COALESCE(json_extract((SELECT value FROM settings WHERE key='booking'),'$.firstFloorOverflowCapacity'),0)<
        NEW.party_size+(SELECT COALESCE(SUM(party_size),0) FROM reservations r WHERE r.room_id=2 AND r.book_date=NEW.book_date AND r.service=NEW.service AND r.status='confirmed' AND NOT EXISTS(SELECT 1 FROM service_visits v WHERE v.reservation_id=r.id AND v.state IN ('finished','no_show')) AND r.id<>NEW.id)
   ) THEN RAISE(ABORT,'oasi_overflow_capacity') END;
 SELECT CASE WHEN
   NOT (NEW.room_id=2 AND NOT EXISTS(SELECT 1 FROM reservation_tables WHERE reservation_id=NEW.id))
   AND (NOT EXISTS(SELECT 1 FROM reservation_tables WHERE reservation_id=NEW.id)
     OR EXISTS(SELECT 1 FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id WHERE rt.reservation_id=NEW.id AND (t.room_id<>NEW.room_id OR rt.book_date<>NEW.book_date OR rt.service<>NEW.service)))
 THEN RAISE(ABORT,'oasi_assignment_invalid') END;
 SELECT CASE WHEN
   EXISTS(SELECT 1 FROM reservation_tables WHERE reservation_id=NEW.id)
   AND NEW.party_size NOT BETWEEN
     (SELECT SUM(COALESCE(d.min_seats,1)) FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id LEFT JOIN table_details d ON d.table_id=t.id WHERE rt.reservation_id=NEW.id)
     AND (SELECT SUM(t.seats) FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id WHERE rt.reservation_id=NEW.id)
 THEN RAISE(ABORT,'oasi_capacity_invalid') END;
END;

INSERT OR IGNORE INTO oasi_schema_versions(version) VALUES(13);
