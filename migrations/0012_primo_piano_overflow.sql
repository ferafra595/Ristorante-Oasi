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
    NEW.party_size+(SELECT COALESCE(SUM(party_size),0) FROM reservations WHERE room_id=2 AND book_date=NEW.book_date AND service=NEW.service AND status='confirmed')
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
        NEW.party_size+(SELECT COALESCE(SUM(party_size),0) FROM reservations WHERE room_id=2 AND book_date=NEW.book_date AND service=NEW.service AND status='confirmed' AND id<>NEW.id)
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
DROP TRIGGER IF EXISTS oasi_f7_event_room_guard;
CREATE TRIGGER oasi_f7_event_room_guard
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
  WHERE e.id=NEW.event_id AND r.room_id=NEW.room_id AND r.status='confirmed' AND (e.service='both' OR e.service=r.service)
 ) THEN RAISE(ABORT,'oasi_event_existing_reservations') END;
END;
INSERT OR IGNORE INTO oasi_schema_versions(version) VALUES(12);
