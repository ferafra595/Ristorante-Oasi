# Ristorante Oasi — Collaudo sito pubblico (Fasi 1 e 2)

Questa checklist riguarda esclusivamente il sito pubblico, non il gestionale operativo. Le modifiche sono su `main`; la prova finale va eseguita sul dominio Cloudflare effettivamente pubblicato dopo il deployment.

## Fase 1 — Design e contenuti
- [ ] Homepage: fotografia hero caricata e ritagliata correttamente su desktop e telefono.
- [ ] Pulsanti «Prenota un tavolo» ed «Esplora il menù» aprono le pagine giuste.
- [ ] Tre accessi rapidi a menù, galleria ed eventi; navigazione con tastiera e touch.
- [ ] Storia: nessun segnaposto «aggiungi qui il tuo racconto» visibile al pubblico.
- [ ] Testo autentico inserito dall'ADMIN non viene sostituito dal fallback.
- [ ] Inquadratura foto homepage e pagine interne regolabile da ADMIN, con salvataggio e verifica desktop/mobile.
- [ ] Galleria: categorie, apertura immagine, precedente/successiva, tasti freccia, Escape, focus di ritorno, visualizzazione integrale.
- [ ] Le fotografie verticali e orizzontali mantengono formati regolari nei riquadri e originali non deformati.

## Fase 2 — Menù
- [ ] Le sezioni visualizzano soltanto i piatti attivi presenti in D1.
- [ ] Nomi, descrizioni, prezzi e allergeni derivano dall'ADMIN (nessun piatto inventato).
- [ ] I filtri del menù nascondono correttamente le altre sezioni.
- [ ] Se presente, il PDF è leggibile e scaricabile.
- [ ] Se non sono presenti voci o PDF, compare l'alternativa di contatto.
- [ ] Verifica desktop e smartphone, anche con nomi lunghi.

## Fase 2 — Prenotazioni
- [ ] Data, servizio, orario e persone aggiornano il riepilogo.
- [ ] Il pulsante Conferma resta disabilitato prima della verifica disponibilità.
- [ ] Cambiando data/orario/coperti si richiede una nuova verifica.
- [ ] Con disponibilità reale positiva si può compilare e inviare; il server valida nuovamente prima di registrare.
- [ ] In caso di indisponibilità, nessuna prenotazione viene creata.
- [ ] Il cliente vede il riferimento della prenotazione e il link per gestirla.
- [ ] Se il servizio email non è attivo, il messaggio lo comunica senza nascondere la conferma avvenuta.
- [ ] Massimo 9 ospiti online; gruppi maggiori indirizzati al contatto telefonico.

## Fase 2 — Eventi
- [ ] Ciascuna categoria (matrimonio, cerimonia, festa privata) indirizza al modulo e precompila il tipo.
- [ ] Il modulo richiede data indicativa e numero di invitati.
- [ ] Il pulsante prepara il messaggio WhatsApp corretto e apre l'app o web.
- [ ] Nessuna richiesta viene presentata falsamente come evento confermato: la disponibilità viene verificata dal personale.
- [ ] Il numero WhatsApp e il numero telefonico devono essere confermati dal ristorante.

## Ultimi prerequisiti alla consegna
- [ ] Immagini definitive e testi autentici caricati.
- [ ] Menù PDF e/o voci aggiornate e allergeni controllati dal ristorante.
- [ ] Informativa privacy definitiva e verificata, attualmente il sito usa un testo segnaposto.
- [ ] Dominio finale acquistato e collegato al Worker.
- [ ] Email e promemoria configurati e testati.
- [ ] Backup D1 verificato.
- [ ] Prove reali su Chrome/Safari, desktop/mobile, incluso test di stampa e prenotazioni simultanee.
- [ ] Annotare commit e URL collaudati, data e responsabile prima di consegnare.

**Non effettuare prove di prenotazione su date in cui il ristorante ha clienti reali senza autorizzazione.**
