-- Oasi Fase 2 plus: identità cliente stabile per lo storico; conservare backup D1.
-- Non cancella né modifica prenotazioni, tavoli, note o email inviate.
CREATE TABLE IF NOT EXISTS oasi_customer_reservations (
 reservation_id INTEGER PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
 customer_id INTEGER NOT NULL REFERENCES oasi_customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_oasi_customer_res_customer ON oasi_customer_reservations(customer_id);
-- Collega le prenotazioni pregresse ai clienti già registrati per email.
INSERT OR IGNORE INTO oasi_customer_reservations(reservation_id,customer_id)
SELECT r.id,c.id FROM reservations r
JOIN oasi_customers c ON lower(trim(r.email))=lower(trim(c.email))
WHERE r.email IS NOT NULL AND trim(r.email)<>'';
