# Ristorante Oasi — Collaudo operativo Fasi 1 e 2

## Ambito e stato
Questa procedura accompagna le modifiche su prenotazioni, combinazioni verticali, banchetti con sala condivisa, Agenda, Sala e stampa. Non certifica il sito di produzione: i test automatici del repository verificano il codice, mentre il collaudo visivo e la consegna richiedono un controllo sul dominio Cloudflare effettivo.

**Prima di iniziare:** fare un backup D1, verificare l'ultimo commit pubblicato e usare una data di prova concordata che non interferisca con prenotazioni reali. Non usare dati personali reali nei test.

## A. Prenotazioni web
- [ ] Prenotazione di 2 ospiti con tavolo libero: conferma una sola volta.
- [ ] Prenotazione oltre 9 ospiti: percorso web non consente la conferma.
- [ ] Due richieste per lo stesso tavolo, data e servizio: una sola può occupare il tavolo.
- [ ] Tavolo prenotato a pranzo: non assegnabile a un altro pranzo; può essere usato per la cena se aperta.
- [ ] Sala o servizio bloccato: non devono comparire nuove conferme.

## B. Prenotazioni amministrative
- [ ] Creare prenotazione da Agenda e da Servizio e sala.
- [ ] Unire tavoli 4+2, esclusivamente quando entrambi liberi e collegati verticalmente.
- [ ] Unire tavoli 3+5+6: catena senza interruzioni.
- [ ] Tentare un collegamento laterale/diagonale (es. 5+4): il server deve rifiutarlo.
- [ ] Modificare una prenotazione: l'elenco deve mostrare tutti i tavoli realmente liberi, e il salvataggio deve rispettare capienza e adiacenza.
- [ ] Provare assegnazione già occupata o bloccata: nessuna modifica parziale alla prenotazione originale.
- [ ] Verificare che annullando una prenotazione i relativi tavoli tornino disponibili.

## C. Banchetto con sala condivisa
- [ ] Aprire «+ Banchetto condiviso» da Agenda e da Sala.
- [ ] Selezionare data, servizio, referente, numero persone e sala.
- [ ] Provare «Suggerisci tavoli», correggere manualmente la proposta e confermare.
- [ ] Selezionare gruppi verticali distinti nella stessa sala: ad esempio 4+2 e 3+5+6, se liberi.
- [ ] Verificare che tutti i tavoli scelti facciano parte di una sola prenotazione e gli altri restino prenotabili.
- [ ] Verificare capienza complessiva, massimo 20 tavoli, nessuna combinazione tra sale diverse.
- [ ] Modificare numero ospiti e tavoli; controllare che non venga duplicata la prenotazione.
- [ ] Un banchetto condiviso non deve aggirare i blocchi di tavolo, sala o servizio.
- [ ] Testare annullamento del banchetto: libera soltanto i tavoli di quella prenotazione.

## D. Sala durante il servizio
- [ ] Oggi e servizio automatici, con passaggio tra pranzo e cena; selezione manuale rispettata.
- [ ] Piantina mostra lo stato di ogni tavolo.
- [ ] «In attesa» → «Arrivato» → «Al tavolo» → «Terminato».
- [ ] Anche quando il cliente è arrivato/terminato, il tavolo resta impegnato per il servizio: non si libera da solo.
- [ ] Bloccare un tavolo ancora libero non cancella una prenotazione confermata.
- [ ] Provare la stampa diretta da Sala.

## E. Agenda e stampa
- [ ] Agenda apre il giorno odierno, mostra Pranzo e Cena; filtri e data funzionano.
- [ ] Ricerca per nome, telefono, tavolo e «banchetto».
- [ ] Banchetto condiviso evidenziato distintamente.
- [ ] Stampa piantina A4: 4+2 e 3+5+6 hanno ponti grafici verticali, nessun collegamento tra clienti differenti.
- [ ] Solo numero tavolo e riferimento P1/P2 all'interno dei tavoli; nomi, ospiti e ora nella tabella.
- [ ] Verificare nomi lunghi, 20 tavoli, gruppi separati, sala a L, carta A4 e stampante reale.
- [ ] Stampare un servizio con molte prenotazioni e controllare margini, pagine e leggibilità in bianco e nero.

## F. Comunicazioni e rilascio
- [ ] Controllare invio reale delle email di conferma, modifica, annullamento e promemoria se configurato.
- [ ] Verificare gestione errori di rete e messaggi senza doppio salvataggio.
- [ ] Verificare desktop, smartphone e almeno due browser.
- [ ] Confermare policy privacy, scadenze e backup D1 prima di usare il gestionale a pieno regime.
- [ ] Registrare esito dei test, versione deploy, data e responsabile della verifica.

## Regole da non alterare
Prenotazioni web massimo 9 ospiti; combinazioni normali massimo 8 tavoli e con collegamenti verticali validi; banchetti condivisi massimo 20 tavoli, anche in gruppi separati ma sempre stessa sala; blocchi ed eventi esclusivi prevalgono sulle nuove disponibilità; mai doppie assegnazioni per tavolo/data/servizio. Un tavolo prenotato rimane riservato fino alla fine del servizio.

## Database
Le modifiche di queste due fasi non richiedono nuove migrazioni. Le migrazioni esistenti devono essere già applicate, in particolare la 0011 relativa all'integrità operativa.
