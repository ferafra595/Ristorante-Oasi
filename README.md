# Ristorante Oasi — sito e gestionale prenotazioni

Pacchetto sorgente 1.0 per **Cloudflare Workers + Static Assets + D1 + R2**. Frontend vanilla JavaScript responsive, senza librerie frontend. Logo ufficiale incluso. Nome/immagini di esempio presenti solo finché non inserisci le foto reali.

## Funzioni incluse
- Sito: Home, Chi siamo modificabile, Menù (piatti/pizze/vini), Galleria, Contatti, Prenota e privacy provvisoria.
- Prenotazioni web: date, fasce di arrivo libere in configurazione pranzo/cena, massimo 9, chiusura lunedì, sala piano terra pubblica, giardino pubblicabile dall'ADMIN, assegnazione del tavolo libero più piccolo adatto, occupazione per intero servizio, link di cancellazione.
- ADMIN: accesso con password PBKDF2 e cookie HttpOnly; dashboard, prenotazioni telefoniche, cancellazione e spostamento tavoli, gestione sale e tavoli, editor piantina drag-and-drop, menù, foto (R2), testi e impostazioni orari.
- D1 blocca con vincolo UNIQUE lo stesso tavolo/data/servizio anche in caso di richieste contemporanee. Niente doppia assegnazione dello stesso tavolo.

## Prerequisiti
Account Cloudflare con accesso a D1, Workers e R2; Node.js >= 20; npm; Wrangler; dominio facoltativo. **Non è una pubblicazione pronta per accettare clienti senza configurazione e collaudi**.

## Installazione
1. Estrai la ZIP, apri il terminale nella cartella ed esegui `npm install`.
2. `npx wrangler login`.
3. `npx wrangler d1 create oasi-db` e sostituisci `INSERISCI_ID_DATABASE_D1` nel file `wrangler.toml` con l'ID ottenuto.
4. `npx wrangler r2 bucket create oasi-media`.
5. `npm run db:remote` per creare le tabelle in produzione. Per ambiente locale `npm run db:local`.
6. Imposta un segreto lungo e casuale con `npx wrangler secret put SETUP_KEY`. Conserva il valore per il passaggio 8.
7. `npm run deploy` e prendi nota dell'indirizzo Workers pubblicato. Configura `PUBLIC_URL` in `wrangler.toml` con l'URL HTTPS pubblicato e ridistribuisci. In locale esegui `cp .dev.vars.example .dev.vars`, assegna SETUP_KEY e usa `npm run dev`.
8. Crea il primo ADMIN UNA SOLA VOLTA con una richiesta POST a `/api/setup`, ad esempio:

```bash
curl -X POST 'https://TUO-SITO.workers.dev/api/setup' \
  -H 'Content-Type: application/json' \
  --data '{"setup_key":"LA_TUA_SETUP_KEY","email":"admin@tuodominio.it","password":"UNA_PASSWORD_DI_ALMENO_12_CARATTERI"}'
```

9. Apri `/admin` e accedi. Crea prima i tavoli nella sala piano terra: **senza tavoli attivi le prenotazioni online non potranno essere confermate**.
10. Facoltativo: abilita email con `npx wrangler secret put RESEND_API_KEY` e configura la variabile `EMAIL_FROM` in Wrangler (mittente verificato su Resend). Senza servizio email, il link per annullare appare solo sullo schermo del cliente: serve quindi un canale di invio conferme prima di andare online. **WhatsApp non è integrato**.

## Piantine, sale e tavoli
La sala piano terra è visibile online. Il primo piano e la veranda restano gestiti internamente; il giardino può essere attivato online dal modulo Sale. Nell'editor scegli la sala, aggiungi tavoli, trascinali sullo schema e clicca un tavolo per modificare forma, posti, dimensioni, rotazione, gruppo di unione e stato. Tavoli che condividono un `group_code` nella stessa sala possono essere considerati un gruppo: il sistema li combina **tutti**, non in sottogruppi arbitrari.

## Regole importanti
- Tavolo occupato per tutto il servizio. Gli orari di arrivo liberi sono configurabili da ADMIN entro gli intervalli. Pranzo e cena sono indipendenti.
- Chiusura straordinaria: impostare le date nel modulo Orari e regole. Chiusura singola sala per data non ha ancora un editor grafico (la struttura di configurazione API supporta `disabledDatesByRoom`).
- La prenotazione viene assegnata automaticamente; in ADMIN il tasto Sposta richiede gli ID dei tavoli (visibili in editor / tramite API). Miglioreremo questa UX con selezione grafica in una versione successiva.
- Le prenotazioni già registrate non vengono annullate quando si disattiva una sala: occorre spostarle manualmente se necessario.
- Non disabilitare manualmente i tavoli con prenotazioni non ricollocate.

## Da completare prima della produzione
**Obbligatorio:** dati reali e foto del ristorante, piantina e capienze effettive, privacy policy GDPR personalizzata da un professionista, dominio/mittente email e verifica invio, test delle prenotazioni/cancellazioni/email da più dispositivi, trattamento del caso pioggia, politica di cancellazione e backup D1. Valutare un controllo anti-abuso/rate limit per POST prenotazioni e accesso admin, protezione Turnstile e gestione dei log.

**Limiti della release:** editor dei muri/porte non presente; piantina gestisce tavoli su canvas a griglia. Configurazione riaperture straordinarie non prevista nell'interfaccia. Spostamento tavolo ADMIN usa ID. Statisticamente sono disponibili prenotazioni e coperti (non incassi), senza esportazione. Email senza resend non viene inviata. Le foto demo provengono da URL esterni e vanno sostituite.

## Comandi
- `npm run build`: compila frontend **senza dipendenze esterne** usando Node.
- `npm run dev`: build e avvio locale Workers con Wrangler.
- `npm run deploy`: build e pubblicazione Workers.
- `npm run db:local` / `npm run db:remote`: applica migrazioni D1.

## Struttura semplificata
- `src/`: interfaccia pubblica, pannello ADMIN, CSS e logo
- `server/`: API, database e ingresso Cloudflare Worker
- `migrations/`: schema database D1
- `index.html`, `build.mjs`, `package.json`, `wrangler.toml`: configurazione e compilazione

La cartella `dist/` si crea automaticamente con `npm run build` e non va caricata nel repository. Pubblicazione con **Cloudflare Workers**, non con il solo hosting statico Pages.

Non pubblicare mai `.dev.vars` o altre chiavi segrete.
