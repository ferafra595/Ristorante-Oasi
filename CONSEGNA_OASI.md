# Ristorante Oasi — Procedura di consegna e attivazione

## Stato della consegna
Il repository contiene sito, pannello ADMIN, database D1, immagini R2, gestione prenotazioni, sale, tavoli, eventi e notifiche. I test automatici verificano sintassi, API, regole D1 e compilazione. **Non equivalgono al collaudo del sito pubblicato**. Tutti i punti marcati come prova reale vanno eseguiti nell'account Cloudflare del ristorante.

## 1. Preparazione: backup PRIMA di distribuire modifiche
1. Accedi al progetto Cloudflare corretto, verifica il binding D1 `oasi-db` e R2 `oasi-media`.
2. Esporta una copia del database in una cartella privata, fuori da GitHub e dalla cartella pubblica. Da terminale autenticato:
   ```bash
   npx wrangler d1 export oasi-db --remote --output=./oasi-backup-prima-consegna.sql
   ```
3. Verifica che il file sia stato creato, non sia vuoto, contenga schema e dati. Conservane una copia cifrata e prova il ripristino su **un database D1 separato**, mai direttamente su produzione.
4. Controlla anche la disponibilità e conservazione del ripristino Point-in-Time (Time Travel) dal pannello Cloudflare.

## 2. Segreti e variabili
Da terminale, nell'account Cloudflare giusto:
```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put RESEND_API_KEY
```
Non inserire le chiavi nel repository, nei test, nei messaggi o nelle variabili pubbliche del browser.

Nel pannello Worker Cloudflare imposta:
- `EMAIL_FROM`: casella mittente **già verificata in Resend**, ad esempio `Prenotazioni Oasi <prenotazioni@dominio-verificato.it>`.
- `ADMIN_NOTIFY_EMAIL`: indirizzo reale del ristorante al quale notificare le prenotazioni (opzionale ma consigliato).
- `PUBLIC_URL`: URL HTTPS definitivo, con eventuale dominio personalizzato (oggi il repository contiene un URL workers.dev).
- `ADMIN_PASSWORD`: deve essere una password robusta salvata come Secret, non in chiaro nel progetto.

## 3. Pubblicazione
Dopo aver verificato backup e configurazione:
```bash
npm run build
npx wrangler deploy
```
Il progetto contiene la configurazione di cron `0 15,16 * * *`: Cloudflare esegue il Worker alle 15 e alle 16 UTC, il Worker prosegue soltanto quando sono le 17 in Italia. Questo copre l'ora solare e legale. Controlla **Workers → Triggers → Cron Triggers** per accertare che il nuovo deploy abbia applicato la pianificazione. La propagazione può richiedere alcuni minuti.

## 4. Verifica ADMIN, dopo il deploy
Apri `/admin` e accedi con la password. Vai in **Sicurezza e registro → Verifica prima della consegna**:
- D1 e versione schema devono risultare configurati.
- Bucket R2 deve essere collegato.
- Almeno una sala e almeno un tavolo devono essere abilitati.
- Email configurata deve risultare attiva **solo se** il Secret Resend e il mittente sono presenti. Ciò non garantisce che le email vengano consegnate: occorre inviarne una di prova.
- Il controllo indica quante email risultano fallite o senza configurazione. Correggerle dalla sezione **Email**.
- Il backup e il Cron Trigger restano controlli da confermare **manualmente** in Cloudflare.

## 5. Test operativo di accettazione
Con una data di prova concordata col ristorante e con dati sintetici:
1. Prenota dal sito per 2 persone e verifica disponibilità, conferma e messaggio/email.
2. Riprova sullo stesso tavolo e servizio: non deve esserci doppia assegnazione.
3. Crea una prenotazione ADMIN da 12 persone con i tavoli 4+2, se realmente collegati e liberi.
4. Crea un banchetto a sala condivisa usando 4+2 e 3+5+6 nello stesso servizio, purché i tavoli siano liberi e la capacità sia adeguata.
5. Aggiungi una prenotazione normale su un tavolo non compreso nel banchetto.
6. Modifica una prenotazione, conferma che i tavoli occupati non siano selezionabili e che non si generino duplicati.
7. Cambia lo stato ospite: atteso → arrivato → al tavolo → terminato. Il tavolo deve restare occupato fino alla fine del servizio.
8. Verifica annullamento prenotazione, rilascio dei soli tavoli relativi e aggiornamento della Sala.
9. Applica e rimuovi blocco di tavolo, sala e servizio, mantenendo valide le prenotazioni esistenti.
10. Stampa piantina A4: numeri visibili, gruppi verticali uniti, riferimento P1/P2 coerente con elenco, nessuna linea diagonale verso un altro gruppo.
11. Verifica il comportamento da almeno un dispositivo mobile e un computer, con due browser diversi.
12. Controlla email conferma, modifica/annullamento, e un promemoria effettivo; verifica la sezione log email e le notifiche al ristorante.

**Non lasciare nel database di produzione prenotazioni sintetiche.** Annullale dopo la prova e verifica che siano riconoscibili e che non interferiscano con il servizio.

## 6. Privacy e sicurezza
Prima dell'uso reale è indispensabile:
- Sostituire eventuali testi privacy provvisori con informative GDPR specifiche, verificate per il titolare del trattamento.
- Definire accessi e responsabilità dei dipendenti. L'ADMIN attuale ha **un unico accesso**, quindi non esiste una separazione di permessi per dipendente.
- Valutare protezioni antispam e rate limiting a livello Cloudflare per `/api/book`, `/api/availability` e `/api/admin/login` secondo il traffico reale.
- Verificare gestione e cancellazione dei dati personali, conservazione dei backup e accessi al database.
- Definire una procedura di recupero del sistema e un referente per gli incidenti.

## 7. Accettazione
Registrare: data e ora, commit GitHub pubblicato, URL definitivo, esito backup/ripristino, test email (conferma e promemoria), test prenotazioni multiple, test banchetti, stampa A4 e prova mobile. Solo dopo questi risultati dichiarare **CONSEGNATO E COLLAUDATO**.

## Note operative
- La configurazione cron in GitHub **non attiva il trigger finché il Worker non è distribuito**.
- Le email fallite non annullano una prenotazione registrata: verificare i log e contattare il cliente.
- Non eseguire le migrazioni su un database diverso da quello collegato al Worker.
- Non modificare manualmente tavoli prenotati durante il servizio senza ricollocare le prenotazioni.
- Per ora non sono previste fatturazione, comande o pagamenti integrati: il progetto rimane un sito con gestionale di prenotazioni e sale.
