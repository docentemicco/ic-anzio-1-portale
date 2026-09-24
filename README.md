# I.C. Anzio I — V46

V46 mantiene la base operativa V40/V45 e aggiunge:
- ripristino automatico del profilo amministratore per `admin@ic-anzio-i.test`;
- area amministrativa riservata all'admin;
- elenco dei profili famiglia e dei figli associati;
- eliminazione definitiva di un singolo alunno;
- eliminazione definitiva di un profilo famiglia, dei figli e dell'account Auth tramite funzione SQL amministrativa.

## SQL Supabase
Eseguire una sola volta `V46_SUPABASE_ADMIN_SQL.sql` nel SQL Editor del progetto Supabase prima di usare le nuove funzioni amministrative.

## Account demo
- Admin: `admin` / `Anzio2026`
- Docenti: `mario.rossi`, `anna.bianchi`
- Famiglie: `luca.rossi`, `giulia.verdi`

Per i dati reali di minori e dati sanitari, validare prima del passaggio in produzione con il RPD/DPO dell'istituto le procedure di cancellazione, conservazione e audit.
