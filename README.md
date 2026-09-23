# I.C. Anzio I — v8 TEST OPERATIVO

Questa versione serve a provare SUBITO il funzionamento dell'app e a raccogliere modifiche prima del passaggio all'infrastruttura reale.

## Cosa si può provare
- ingresso demo Docente/Admin o Famiglia;
- inserimento di alunni;
- scelta ordine di scuola e plesso;
- classe/sezione;
- allergie;
- uscite anticipate;
- farmaci;
- mensa;
- trasporto;
- note operative;
- schede alunno;
- ricerca;
- registrazione di documenti (solo metadati);
- stati documentali;
- dashboard;
- utenti demo.

## Dove vengono salvati i dati
Nel browser, tramite localStorage. Servono solo per la prova. Non inserire nomi reali, dati sanitari reali, documenti reali o dati identificativi di minori.

## Come avviare
Mac/Linux:
python3 -m http.server 8080
poi aprire http://localhost:8080

Windows:
py -m http.server 8080
poi aprire http://localhost:8080

## Passaggio successivo
Dopo la prova si trasferirà la struttura a:
- database server-side;
- autenticazione Google Workspace;
- ruoli reali;
- associazione genitore/figlio;
- storage privato documenti;
- audit log;
- HTTPS;
- backup;
- configurazione del dominio;
- QR definitivo.

Questa versione NON è destinata alla gestione di dati reali.


## Farmaci — nuova funzione v9
Per ogni alunno, in caso di presenza di terapia/farmaco, il test permette di inserire:
- nome del farmaco;
- quando viene assunto o somministrato;
- dosaggio;
- modalità di somministrazione.

Nella scheda dell'alunno l'informazione viene evidenziata come **🔴 Presente — informazioni riservate**.

Questa funzione è dimostrativa: i dati sanitari reali devono essere gestiti solo dopo l'implementazione dei permessi server-side, autenticazione reale, storage sicuro e approvazione delle procedure dell'Istituto.


## v10 — gestione di più farmaci
La scheda dell'alunno ora supporta più farmaci/terapie. Per ogni farmaco si possono indicare:
- nome;
- quando viene assunto/somministrato;
- dosaggio;
- modalità di somministrazione;
- se la somministrazione avviene a scuola.

Nella scheda vengono mostrati separatamente tutti i farmaci presenti.


## v12 — Recapiti genitori
La scheda alunno include due contatti genitoriali con nome e cognome, telefono ed email. I campi sono facoltativi per consentire anche nuclei con un solo recapito inserito.


## v13 — Aree separate
La schermata iniziale distingue chiaramente Area Docenti e Area Famiglie. Le credenziali sono validate anche in base al ruolo. L'area famiglia non mostra l'elenco generale degli alunni.


## v14 — La famiglia inserisce autonomamente i figli
L'account famiglia può inserire uno o più figli direttamente dalla propria area. Ogni figlio viene associato automaticamente all'account che lo ha inserito; non è richiesto alcun collegamento manuale da parte del docente nel prototipo.


## v15 — Account demo per il collaudo
Account iniziali:
- admin / Anzio2026
- mario.rossi / Anzio2026
- anna.bianchi / Anzio2026
- luca.rossi / Anzio2026
- giulia.verdi / Anzio2026

Ogni account deve cambiare la password al primo accesso. Questa versione è ancora un prototipo locale: per condividere lo stesso ambiente tra più persone occorre pubblicare il progetto e sostituire localStorage con un backend/database condiviso.


## v16 — Dati e autorizzazioni inseribili dalla famiglia
L'area famiglia consente di inserire direttamente per ciascun figlio: recapiti, deleghe per il ritiro, uscite anticipate, allergie/intolleranze, altre informazioni sanitarie, più farmaci con orari/dosaggio/modalità/somministrazione a scuola, mensa, pasto da casa, dieta/indicazioni alimentari, trasporto, note sul trasporto, informazioni sui documenti e note aggiuntive. I dati inviati dalla famiglia sono marcati "Da verificare" per la successiva validazione scolastica.


## v17 — Verifica docenti
L'area docenti include una sezione 'Verifiche famiglie' con elenco delle comunicazioni ricevute, conteggi per stato e scheda di verifica. Il docente/amministratore può impostare Da verificare, Approvato o Da integrare e aggiungere una nota; vengono registrati username e data/ora della verifica nel prototipo.


## v18 — Modifica scheda figlio
La famiglia può aprire la scheda del figlio e modificare le informazioni già inserite. Ogni modifica riporta automaticamente lo stato a 'Da verificare' per una nuova verifica scolastica.


## v19 — Farmaci modificabili
La famiglia può modificare i farmaci già inseriti, aggiungerne di nuovi o rimuoverli dalla scheda del figlio. Ogni modifica riporta la comunicazione allo stato 'Da verificare'.


## v20 — Deleghe e uscite strutturate
- Deleghe multiple con nome, rapporto, documento e validità.
- Uscite anticipate multiple con tipo, data, orario e persona autorizzata.
- I dati restano in localStorage come nelle versioni precedenti: è una demo locale, non un database condiviso.


## v22 — Modifica scheda realmente funzionante
Il pulsante “Modifica scheda” apre il modulo di modifica come pagina dedicata e il salvataggio torna alla scheda del figlio.

## v23 — Configurazione Supabase
- Collegato il client browser al progetto Supabase `ic-anzio-1`.
- Inserita esclusivamente la Publishable Key.
- La Secret Key non è presente nel progetto.
- Questa versione prepara il collegamento tecnico; l'app usa ancora il flusso locale finché non viene completata la migrazione di autenticazione e CRUD da localStorage a Supabase.

## v24 — Supabase Auth
- Il login passa a Supabase Auth.
- L'utente viene autorizzato tramite `user_profiles`.
- La modifica password usa Supabase Auth e la funzione RPC `complete_password_change`.
- Gli utenti non vengono più creati automaticamente nel browser.
- La migrazione completa di alunni/documenti/farmaci/deleghe da localStorage a Supabase sarà il passaggio successivo.

## v25 — Lettura famiglia da Supabase
- Dopo il login famiglia, l'app legge gli alunni collegati all'utente autenticato da `students`.
- Legge anche deleghe, uscite anticipate e farmaci tramite le relative tabelle.
- Le RLS vengono quindi verificate con un dato reale di test (Sofia Rossi → Luca Rossi).
- Inserimento e modifica completi su Supabase restano il prossimo passaggio.

## v26 — Famiglia scrive su Supabase
- Inserimento figlio salvato in `students`.
- Deleghe salvate in `student_delegates`.
- Uscite anticipate salvate in `early_exits`.
- Farmaci salvati in `student_medications`.
- Modifica scheda aggiorna le stesse tabelle.
- Dopo ogni salvataggio la scheda viene ricaricata da Supabase.

## v35 — Build pulita Docenti
Questa versione riparte dalla v26, che aveva il flusso famiglia/Supabase funzionante, invece di accumulare le modifiche delle v27-v34. Aggiunge solo:
- sincronizzazione Docenti/Amministratore da Supabase;
- elenco alunni con ricerca;
- apertura della scheda originale già presente nella v26;
- stato di verifica salvato su Supabase.

## v36 — Pulsante verifica scheda
Aggiunto il pulsante `Verifica questa scheda` nella scheda Docente e reso UUID-safe il passaggio alla verifica.

## v38 — Base V36 stabile
V38 mantiene la struttura della V36, che apre correttamente la scheda da entrambe le sezioni, e consolida il passaggio alla verifica e il salvataggio dell'esito su Supabase senza introdurre il gestore click della V37.

## v40 — Verifiche operative
La sezione Verifiche mostra lo stato corrente di ogni scheda e mantiene il percorso di apertura/verifica della V39. I campi data/docente/nota vengono mostrati solo se già disponibili nei dati.
