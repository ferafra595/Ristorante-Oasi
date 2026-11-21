# Ristorante Oasi — Sito e gestionale prenotazioni

Progetto in produzione su **Cloudflare Workers, D1 e R2** (JavaScript senza framework frontend). Include il sito pubblico, il pannello amministrativo e i sistemi di prenotazione e gestione delle sale.

## Documentazione aggiornata
- [CONSEGNA_OASI.md](CONSEGNA_OASI.md): guida ufficiale di pubblicazione, credenziali, email, backup e collaudo prima della consegna.
- [COLLAUDO_OPERATIVO_FASI_1_2.md](COLLAUDO_OPERATIVO_FASI_1_2.md): matrice di test per prenotazioni, banchetti, blocchi, sala, agenda e stampa.

**Attenzione:** il vecchio endpoint `/api/setup` è intenzionalmente disabilitato. L'ADMIN usa `ADMIN_PASSWORD` come Secret Cloudflare e accesso con password; non è necessario creare un account tramite richieste API.

## Sito pubblico
Home, Chi siamo, Menù PDF, Galleria, Eventi e cerimonie, Contatti, FAQ e Prenota. Le prenotazioni online sono limitate a 9 persone, secondo disponibilità e configurazione del servizio. I tavoli vengono assegnati dal backend e sono impegnati per l'intero pranzo o cena.

## Gestionale
- Panoramica, Calendario, Agenda, Sala e piantina interattiva.
- Gestione tavoli (capienza, forma e posizione), connessioni verticali e blocchi di tavoli/sale/servizio.
- Prenotazioni staff per gruppi, ricerca clienti, modifica, cancellazione e stati di arrivo.
- Banchetti con sala condivisa e più gruppi di tavoli, fino a 20 tavoli nello stesso evento.
- Eventi e cerimonie con riserva esclusiva di una o più sale.
- Stampa A4 della piantina, prenotazioni e riferimento P1/P2 per gruppi.
- Anagrafiche clienti, statistiche, notifiche, registro email, sicurezza e registro operazioni.
- Gestione galleria R2, testi, impostazioni, FAQ e Menù PDF.

## Dati e disponibilità
D1 gestisce l'unicità di tavolo/data/servizio per impedire doppie assegnazioni; le verifiche avvengono sul server. I tavoli collegabili non vengono occupati automaticamente: sono riservati soltanto quelli esplicitamente assegnati a una prenotazione.

## Promemoria
Il Worker definisce un handler `scheduled()` per i promemoria del giorno successivo alle 17:00 italiane. Nel file `wrangler.toml` è presente il trigger `0 15,16 * * *` per il cambio ora legale/solare. **La sola presenza nel repository non significa che il trigger sia già attivo sul Worker pubblicato.** Verificare nel pannello Cloudflare dopo il deployment.

Le email richiedono `RESEND_API_KEY` come Secret e `EMAIL_FROM` come mittente verificato; senza configurazione, la prenotazione può essere salvata ma la consegna email non è garantita.

## Comandi
```bash
npm run build
npm run dev
npm run deploy
npm run db:local
npm run db:remote
```
Per un backup SQL D1 remoto:
```bash
npx wrangler d1 export oasi-db --remote --output=./oasi-backup.sql
```
Eseguire l'export in uno spazio privato; il backup contiene dati personali. Il restore va provato prima su un database separato.

## Prima della consegna
**Non dichiarare pronto il ristorante soltanto perché GitHub Actions è verde.** Servono il test sul sito Cloudflare con prenotazioni e banchetti, prova email reale, stampa A4, prova mobile, verifica del dominio e dei Cron Trigger, backup D1 con recuperabilità verificata e informativa privacy definitiva.

La procedura completa si trova in [CONSEGNA_OASI.md](CONSEGNA_OASI.md).

## Sicurezza
Non pubblicare mai file `.dev.vars`, credenziali, file SQL di backup o esportazioni clienti nel repository. L'accesso ADMIN è singolo: la separazione dei permessi per diversi dipendenti non è presente in questa versione.
