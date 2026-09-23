/* =========================================================
   I.C. ANZIO I
   PORTALE TEST OPERATIVO
   VERSIONE UNIFICATA
   ========================================================= */

const SUPABASE_URL = "https://vnpzhhpkymfxxajvvxtj.supabase.co";
const SUPABASE_KEY = "sb_publishable_qIq-kTzwKFl7YWyWUyZVTA_v_AN386T";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const DEFAULT_PASSWORD = "Anzio2026";

const emailMap = {
  "admin": "admin@ic-anzio-i.test",
  "mario.rossi": "mario.rossi@ic-anzio-i.test",
  "anna.bianchi": "anna.bianchi@ic-anzio-i.test",
  "luca.rossi": "luca.rossi@ic-anzio-i.test",
  "giulia.verdi": "giulia.verdi@ic-anzio-i.test"
};

const state = {
  role: null,
  page: "home",
  user: null,
  authUser: null,
  students: [],
  delegates: [],
  earlyExits: [],
  medications: [],
  orders: [],
  campuses: [],
  classes: [],
  selectedStudent: null,
  verificationStudent: null,
  message: null
};


/* =========================================================
   UTILITY
   ========================================================= */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("it-IT");
}

function showMessage(text, type = "success") {
  state.message = { text, type };
  render();

  setTimeout(() => {
    state.message = null;
    render();
  }, 3000);
}

function displayName(profile) {
  if (!profile) return "Utente";

  const fullName = [
    profile.first_name,
    profile.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    fullName ||
    profile.username ||
    profile.email ||
    state.authUser?.email ||
    "Utente"
  );
}

function roleLabel(role) {
  if (role === "admin") return "👑 Amministratore";
  if (role === "teacher") return "👩‍🏫 Docente";
  if (role === "family") return "👨‍👩‍👧 Famiglia";
  return role || "";
}

function statusClass(status) {
  if (status === "Approvato") return "status-approved";
  if (status === "Da integrare") return "status-warning";
  if (status === "Scaduto") return "status-expired";
  return "status-pending";
}


/* =========================================================
   AUTH
   ========================================================= */

async function doLogin() {
  const username = document.getElementById("loginUsername")?.value
    ?.trim()
    .toLowerCase();

  const password = document.getElementById("loginPassword")?.value || "";

  if (!username || !password) {
    showMessage("Inserisci username e password.", "error");
    return;
  }

  const email = emailMap[username];

  if (!email) {
    showMessage("Utente non presente nell'ambiente di test.", "error");
    return;
  }

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    console.error(error);
    showMessage("Username o password non corretti.", "error");
    return;
  }

  state.authUser = data.user;

  const { data: profile, error: profileError } =
    await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

  if (profileError || !profile) {
    console.error(profileError);
    await supabase.auth.signOut();
    showMessage("Profilo utente non trovato.", "error");
    return;
  }

  state.user = profile;
  state.role = profile.role;

  /*
    Fallback definitivo contro "undefined".
    Se first_name e last_name sono vuoti,
    viene utilizzato username.
  */
  state.user.display = displayName(profile);

  if (profile.must_change_password) {
    state.page = "changePassword";
    render();
    return;
  }

  if (state.role === "family") {
    await syncFamilyFromSupabase();
  } else {
    await syncStaffFromSupabase();
  }

  state.page = "home";
  render();
}

async function restoreSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user) {
    render();
    return;
  }

  state.authUser = session.user;

  const { data: profile, error } =
    await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    render();
    return;
  }

  state.user = profile;
  state.role = profile.role;

  state.user.display = displayName(profile);

  if (profile.must_change_password) {
    state.page = "changePassword";
    render();
    return;
  }

  if (state.role === "family") {
    await syncFamilyFromSupabase();
  } else {
    await syncStaffFromSupabase();
  }

  state.page = "home";
  render();
}

async function doLogout() {
  await supabase.auth.signOut();

  state.role = null;
  state.page = "home";
  state.user = null;
  state.authUser = null;
  state.students = [];
  state.delegates = [];
  state.earlyExits = [];
  state.medications = [];
  state.orders = [];
  state.campuses = [];
  state.classes = [];
  state.selectedStudent = null;
  state.verificationStudent = null;

  render();
}

async function changePassword() {
  const password1 =
    document.getElementById("newPassword")?.value || "";

  const password2 =
    document.getElementById("newPassword2")?.value || "";

  if (!password1 || password1.length < 8) {
    showMessage(
      "La nuova password deve contenere almeno 8 caratteri.",
      "error"
    );
    return;
  }

  if (password1 !== password2) {
    showMessage("Le due password non coincidono.", "error");
    return;
  }

  const { error } =
    await supabase.auth.updateUser({
      password: password1
    });

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante il cambio password.",
      "error"
    );
    return;
  }

  const { error: rpcError } =
    await supabase.rpc("complete_password_change");

  if (rpcError) {
    console.error(rpcError);
  }

  state.user.must_change_password = false;

  if (state.role === "family") {
    await syncFamilyFromSupabase();
  } else {
    await syncStaffFromSupabase();
  }

  state.page = "home";
  showMessage("Password modificata correttamente.");
}


/* =========================================================
   SUPABASE - FAMIGLIA
   ========================================================= */

async function syncFamilyFromSupabase() {
  if (!state.authUser) return;

  const { data: students, error } =
    await supabase
      .from("students")
      .select("*")
      .eq("family_user_id", state.authUser.id)
      .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    showMessage("Errore nel caricamento dei figli.", "error");
    return;
  }

  state.students = students || [];

  const ids = state.students.map(s => s.id);

  state.delegates = [];
  state.earlyExits = [];
  state.medications = [];

  if (!ids.length) return;

  const [
    delegatesResult,
    earlyResult,
    medsResult
  ] = await Promise.all([
    supabase
      .from("student_delegates")
      .select("*")
      .in("student_id", ids),

    supabase
      .from("early_exits")
      .select("*")
      .in("student_id", ids),

    supabase
      .from("student_medications")
      .select("*")
      .in("student_id", ids)
  ]);

  if (!delegatesResult.error) {
    state.delegates = delegatesResult.data || [];
  }

  if (!earlyResult.error) {
    state.earlyExits = earlyResult.data || [];
  }

  if (!medsResult.error) {
    state.medications = medsResult.data || [];
  }
}


/* =========================================================
   SUPABASE - DOCENTI / ADMIN
   ========================================================= */

async function syncStaffFromSupabase() {
  const [
    studentsResult,
    delegatesResult,
    earlyResult,
    medsResult,
    ordersResult,
    campusesResult,
    classesResult
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .order("last_name", { ascending: true }),

    supabase
      .from("student_delegates")
      .select("*"),

    supabase
      .from("early_exits")
      .select("*"),

    supabase
      .from("student_medications")
      .select("*"),

    supabase
      .from("school_orders")
      .select("*")
      .order("name"),

    supabase
      .from("campuses")
      .select("*")
      .order("name"),

    supabase
      .from("classes")
      .select("*")
      .order("name")
  ]);

  state.students = studentsResult.data || [];
  state.delegates = delegatesResult.data || [];
  state.earlyExits = earlyResult.data || [];
  state.medications = medsResult.data || [];
  state.orders = ordersResult.data || [];
  state.campuses = campusesResult.data || [];
  state.classes = classesResult.data || [];
}


/* =========================================================
   STUDENT HELPERS
   ========================================================= */

function studentById(id) {
  return state.students.find(s => s.id === id);
}

function studentDelegates(studentId) {
  return state.delegates.filter(
    d => d.student_id === studentId
  );
}

function studentEarlyExits(studentId) {
  return state.earlyExits.filter(
    e => e.student_id === studentId
  );
}

function studentMedications(studentId) {
  return state.medications.filter(
    m => m.student_id === studentId
  );
}


/* =========================================================
   HOME
   ========================================================= */

function home() {
  if (state.role === "family") {
    return `
      <section class="page">
        <div class="hero">
          <h1>Area Famiglie</h1>
          <p>
            Benvenuto/a,
            <strong>${esc(state.user?.display || state.user?.username || "Utente")}</strong>.
          </p>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-icon">👨‍👩‍👧</div>
            <h3>I miei figli</h3>
            <p>
              ${state.students.length}
              ${state.students.length === 1 ? "figlio inserito" : "figli inseriti"}
              nel tuo account.
            </p>
            <button onclick="go('children')">
              Gestisci figli
            </button>
          </div>

          <div class="card">
            <div class="card-icon">📄</div>
            <h3>Autorizzazioni</h3>
            <p>
              Deleghe, uscite anticipate,
              documentazione e autorizzazioni.
            </p>
            <button onclick="go('children')">
              Apri
            </button>
          </div>

          <div class="card">
            <div class="card-icon">💊</div>
            <h3>Farmaci</h3>
            <p>
              Gestione delle informazioni relative
              ai farmaci autorizzati.
            </p>
            <button onclick="go('children')">
              Apri
            </button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="page">
      <div class="hero">
        <h1>Area ${state.role === "admin" ? "Amministrazione" : "Docenti"}</h1>
        <p>
          Benvenuto/a,
          <strong>${esc(state.user?.display || state.user?.username || "Utente")}</strong>.
        </p>
      </div>

      <div class="cards">
        <div class="card">
          <div class="card-icon">👨‍🎓</div>
          <h3>Alunni</h3>
          <p>
            Consulta le schede degli alunni presenti
            nel sistema.
          </p>
          <button onclick="go('students')">
            Apri alunni
          </button>
        </div>

        <div class="card">
          <div class="card-icon">✅</div>
          <h3>Verifiche</h3>
          <p>
            Consulta e gestisci lo stato di verifica
            delle schede.
          </p>
          <button onclick="go('verifications')">
            Apri verifiche
          </button>
        </div>

        <div class="card">
          <div class="card-icon">📊</div>
          <h3>Struttura scolastica</h3>
          <p>
            Ordini, plessi e classi presenti
            nell'ambiente di test.
          </p>
          <button onclick="go('structure')">
            Apri
          </button>
        </div>
      </div>
    </section>
  `;
}


/* =========================================================
   FAMIGLIA - FIGLI
   ========================================================= */

function childrenPage() {
  return `
    <section class="page">
      <div class="page-head">
        <div>
          <h1>I miei figli</h1>
          <p>
            Puoi inserire e aggiornare direttamente
            i dati dei tuoi figli.
          </p>
        </div>

        <button onclick="go('addChild')">
          + Inserisci figlio
        </button>
      </div>

      ${
        state.students.length
          ? `
            <div class="student-grid">
              ${state.students.map(studentCard).join("")}
            </div>
          `
          : `
            <div class="empty">
              <div class="empty-icon">👨‍👩‍👧</div>
              <h3>Nessun figlio inserito</h3>
              <p>
                Inserisci il primo figlio per iniziare.
              </p>
              <button onclick="go('addChild')">
                Inserisci figlio
              </button>
            </div>
          `
      }
    </section>
  `;
}

function studentCard(s) {
  const status = s.verification_status || "Da verificare";

  return `
    <div class="student-card">
      <div class="student-avatar">
        ${(s.first_name || "?").charAt(0).toUpperCase()}
      </div>

      <div class="student-info">
        <h3>
          ${esc(s.first_name)} ${esc(s.last_name)}
        </h3>

        <p>
          Classe:
          ${esc(s.class_name || s.class || "—")}
        </p>

        <p>
          Plesso:
          ${esc(s.campus_name || s.campus || "—")}
        </p>

        <span class="status ${statusClass(status)}">
          ${esc(status)}
        </span>
      </div>

      <div class="student-actions">
        <button onclick="openFamilyStudent('${s.id}')">
          Apri scheda
        </button>
      </div>
    </div>
  `;
}


/* =========================================================
   NUOVO FIGLIO
   ========================================================= */

function addChildPage() {
  return `
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Inserisci figlio</h1>
          <p>
            Inserisci i dati principali dell'alunno.
          </p>
        </div>
      </div>

      <form onsubmit="saveFamilyChild(event)" class="form-card">

        <div class="form-grid">

          <label>
            Nome
            <input
              id="childFirstName"
              required
            />
          </label>

          <label>
            Cognome
            <input
              id="childLastName"
              required
            />
          </label>

          <label>
            Data di nascita
            <input
              id="childDob"
              type="date"
            />
          </label>

          <label>
            Anno scolastico
            <input
              id="childSchoolYear"
              value="2026/2027"
            />
          </label>

          <label>
            Ordine
            <select id="childOrder">
              <option value="">Seleziona</option>
              <option value="Infanzia">Infanzia</option>
              <option value="Primaria">Primaria</option>
              <option value="Secondaria di I grado">
                Secondaria di I grado
              </option>
            </select>
          </label>

          <label>
            Plesso
            <select id="childCampus">
              <option value="">Seleziona</option>
              <option value="Plesso Centrale">
                Plesso Centrale
              </option>
              <option value="Succursale">
                Succursale
              </option>
              <option value="Quartiere Europa">
                Quartiere Europa
              </option>
              <option value="Saragat">
                Saragat
              </option>
            </select>
          </label>

          <label>
            Classe
            <input
              id="childClass"
              placeholder="Es. 4A"
            />
          </label>

          <label>
            Mensa
            <select id="childMensa">
              <option value="">Seleziona</option>
              <option value="Si">Si</option>
              <option value="No">No</option>
            </select>
          </label>

          <label>
            Pasto da casa
            <select id="childHomeMeal">
              <option value="">Seleziona</option>
              <option value="Si">Si</option>
              <option value="No">No</option>
            </select>
          </label>

          <label>
            Trasporto
            <select id="childTransport">
              <option value="">Seleziona</option>
              <option value="Si">Si</option>
              <option value="No">No</option>
            </select>
          </label>

        </div>

        <h2>Allergie</h2>

        <div class="form-grid">

          <label>
            Presenti?
            <select id="childAllergy">
              <option value="No">No</option>
              <option value="Si">Si</option>
            </select>
          </label>

          <label>
            Tipo / categoria
            <input
              id="childAllergyType"
            />
          </label>

          <label class="full">
            Note operative
            <textarea
              id="childAllergyNotes"
            ></textarea>
          </label>

        </div>

        <div class="form-actions">
          <button
            type="button"
            class="secondary"
            onclick="go('children')"
          >
            Annulla
          </button>

          <button type="submit">
            Salva figlio
          </button>
        </div>

      </form>
    </section>
  `;
}

async function saveFamilyChild(event) {
  event.preventDefault();

  if (!state.authUser) return;

  const payload = {
    first_name:
      document.getElementById("childFirstName")?.value.trim(),

    last_name:
      document.getElementById("childLastName")?.value.trim(),

    dob:
      document.getElementById("childDob")?.value || null,

    school_year:
      document.getElementById("childSchoolYear")?.value.trim() ||
      "2026/2027",

    order_name:
      document.getElementById("childOrder")?.value || null,

    campus_name:
      document.getElementById("childCampus")?.value || null,

    class_name:
      document.getElementById("childClass")?.value.trim() || null,

    mensa:
      document.getElementById("childMensa")?.value || null,

    home_meal:
      document.getElementById("childHomeMeal")?.value || null,

    transport:
      document.getElementById("childTransport")?.value || null,

    allergy:
      document.getElementById("childAllergy")?.value || "No",

    allergy_type:
      document.getElementById("childAllergyType")?.value.trim() ||
      null,

    allergy_notes:
      document.getElementById("childAllergyNotes")?.value.trim() ||
      null,

    family_user_id: state.authUser.id,
    family_submitted: true,
    verification_status: "Da verificare"
  };

  if (!payload.first_name || !payload.last_name) {
    showMessage(
      "Nome e cognome sono obbligatori.",
      "error"
    );
    return;
  }

  const { error } =
    await supabase
      .from("students")
      .insert(payload);

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante il salvataggio del figlio.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  state.page = "children";

  showMessage("Figlio inserito correttamente.");
}


/* =========================================================
   SCHEDA FIGLIO - FAMIGLIA
   ========================================================= */

function openFamilyStudent(id) {
  const student = studentById(id);

  if (!student) {
    showMessage("Alunno non trovato.", "error");
    return;
  }

  state.selectedStudent = student;
  state.page = "familyStudent";
  render();
}

function familyStudentPage() {
  const s = state.selectedStudent;

  if (!s) {
    state.page = "children";
    return "";
  }

  const delegates = studentDelegates(s.id);
  const early = studentEarlyExits(s.id);
  const meds = studentMedications(s.id);

  return `
    <section class="page">

      <div class="page-head">
        <div>
          <button
            class="back"
            onclick="go('children')"
          >
            ← Torna ai figli
          </button>

          <h1>
            ${esc(s.first_name)}
            ${esc(s.last_name)}
          </h1>

          <p>
            Scheda alunno
          </p>
        </div>

        <span class="status ${statusClass(
          s.verification_status || "Da verificare"
        )}">
          ${esc(s.verification_status || "Da verificare")}
        </span>
      </div>


      <!-- ANAGRAFICA -->

      <div class="section-card">

        <h2>👤 Anagrafica</h2>

        <div class="detail-grid">

          <div>
            <strong>Nome</strong>
            <span>${esc(s.first_name)}</span>
          </div>

          <div>
            <strong>Cognome</strong>
            <span>${esc(s.last_name)}</span>
          </div>

          <div>
            <strong>Data di nascita</strong>
            <span>${esc(formatDate(s.dob) || "—")}</span>
          </div>

          <div>
            <strong>Anno scolastico</strong>
            <span>${esc(s.school_year || "—")}</span>
          </div>

          <div>
            <strong>Ordine</strong>
            <span>${esc(s.order_name || "—")}</span>
          </div>

          <div>
            <strong>Plesso</strong>
            <span>${esc(s.campus_name || "—")}</span>
          </div>

          <div>
            <strong>Classe</strong>
            <span>${esc(s.class_name || "—")}</span>
          </div>

          <div>
            <strong>Mensa</strong>
            <span>${esc(s.mensa || "—")}</span>
          </div>

          <div>
            <strong>Pasto da casa</strong>
            <span>${esc(s.home_meal || "—")}</span>
          </div>

          <div>
            <strong>Trasporto</strong>
            <span>${esc(s.transport || "—")}</span>
          </div>

        </div>

        <button
          onclick="editFamilyStudent('${s.id}')"
        >
          Modifica scheda
        </button>

      </div>


      <!-- ALLERGIE -->

      <div class="section-card">

        <h2>🟠 Allergie / informazioni importanti</h2>

        <p>
          <strong>Presenza:</strong>
          ${esc(s.allergy || "No")}
        </p>

        <p>
          <strong>Tipo:</strong>
          ${esc(s.allergy_type || "—")}
        </p>

        <p>
          <strong>Note operative:</strong>
          ${esc(s.allergy_notes || "—")}
        </p>

      </div>


      <!-- DELEGHE -->

      <div class="section-card">

        <div class="section-title-row">
          <h2>👥 Deleghe per l'uscita</h2>

          <button
            onclick="addDelegate('${s.id}')"
          >
            + Aggiungi delega
          </button>
        </div>

        ${
          delegates.length
            ? delegates.map(delegateCard).join("")
            : `
              <div class="empty-small">
                Nessuna delega inserita.
              </div>
            `
        }

      </div>


      <!-- USCITE ANTICIPATE -->

      <div class="section-card">

        <div class="section-title-row">
          <h2>🚪 Uscite anticipate</h2>

          <button
            onclick="addEarlyExit('${s.id}')"
          >
            + Aggiungi uscita
          </button>
        </div>

        ${
          early.length
            ? early.map(earlyExitCard).join("")
            : `
              <div class="empty-small">
                Nessuna uscita anticipata inserita.
              </div>
            `
        }

      </div>


      <!-- FARMACI -->

      <div class="section-card sensitive">

        <div class="section-title-row">
          <h2>🔴 Farmaci</h2>

          <button
            onclick="addMedication('${s.id}')"
          >
            + Aggiungi farmaco
          </button>
        </div>

        <p class="sensitive-note">
          Informazioni sensibili. Utilizzare esclusivamente
          per la gestione scolastica autorizzata.
        </p>

        ${
          meds.length
            ? meds.map(medicationCard).join("")
            : `
              <div class="empty-small">
                Nessun farmaco inserito.
              </div>
            `
        }

      </div>

    </section>
  `;
}


/* =========================================================
   MODIFICA SCHEDA
   ========================================================= */

function editFamilyStudent(id) {
  const s = studentById(id);

  if (!s) return;

  state.selectedStudent = s;
  state.page = "editStudent";
  render();
}

function editStudentPage() {
  const s = state.selectedStudent;

  if (!s) {
    state.page = "children";
    return "";
  }

  return `
    <section class="page">

      <div class="page-head">
        <div>
          <button
            class="back"
            onclick="openFamilyStudent('${s.id}')"
          >
            ← Torna alla scheda
          </button>

          <h1>Modifica scheda</h1>

          <p>
            ${esc(s.first_name)}
            ${esc(s.last_name)}
          </p>
        </div>
      </div>


      <form
        onsubmit="updateFamilyStudent(event)"
        class="form-card"
      >

        <div class="form-grid">

          <label>
            Nome
            <input
              id="editFirstName"
              value="${esc(s.first_name)}"
              required
            />
          </label>

          <label>
            Cognome
            <input
              id="editLastName"
              value="${esc(s.last_name)}"
              required
            />
          </label>

          <label>
            Data di nascita
            <input
              id="editDob"
              type="date"
              value="${esc(s.dob || "")}"
            />
          </label>

          <label>
            Anno scolastico
            <input
              id="editSchoolYear"
              value="${esc(s.school_year || "2026/2027")}"
            />
          </label>

          <label>
            Ordine
            <select id="editOrder">
              ${option("Infanzia", s.order_name)}
              ${option("Primaria", s.order_name)}
              ${option(
                "Secondaria di I grado",
                s.order_name
              )}
            </select>
          </label>

          <label>
            Plesso
            <select id="editCampus">
              ${option(
                "Plesso Centrale",
                s.campus_name
              )}
              ${option(
                "Succursale",
                s.campus_name
              )}
              ${option(
                "Quartiere Europa",
                s.campus_name
              )}
              ${option(
                "Saragat",
                s.campus_name
              )}
            </select>
          </label>

          <label>
            Classe
            <input
              id="editClass"
              value="${esc(s.class_name || "")}"
            />
          </label>

          <label>
            Mensa
            <select id="editMensa">
              ${option("Si", s.mensa)}
              ${option("No", s.mensa)}
            </select>
          </label>

          <label>
            Pasto da casa
            <select id="editHomeMeal">
              ${option("Si", s.home_meal)}
              ${option("No", s.home_meal)}
            </select>
          </label>

          <label>
            Trasporto
            <select id="editTransport">
              ${option("Si", s.transport)}
              ${option("No", s.transport)}
            </select>
          </label>

        </div>


        <h2>Allergie</h2>

        <div class="form-grid">

          <label>
            Presenti?
            <select id="editAllergy">
              ${option("No", s.allergy)}
              ${option("Si", s.allergy)}
            </select>
          </label>

          <label>
            Tipo / categoria
            <input
              id="editAllergyType"
              value="${esc(s.allergy_type || "")}"
            />
          </label>

          <label class="full">
            Note operative
            <textarea
              id="editAllergyNotes"
            >${esc(s.allergy_notes || "")}</textarea>
          </label>

        </div>


        <div class="form-actions">

          <button
            type="button"
            class="secondary"
            onclick="openFamilyStudent('${s.id}')"
          >
            Annulla
          </button>

          <button type="submit">
            Salva modifiche
          </button>

        </div>

      </form>
    </section>
  `;
}

function option(value, selected) {
  return `
    <option
      value="${esc(value)}"
      ${value === selected ? "selected" : ""}
    >
      ${esc(value)}
    </option>
  `;
}

async function updateFamilyStudent(event) {
  event.preventDefault();

  const s = state.selectedStudent;

  if (!s) return;

  const payload = {
    first_name:
      document.getElementById("editFirstName")?.value.trim(),

    last_name:
      document.getElementById("editLastName")?.value.trim(),

    dob:
      document.getElementById("editDob")?.value || null,

    school_year:
      document.getElementById("editSchoolYear")?.value.trim(),

    order_name:
      document.getElementById("editOrder")?.value || null,

    campus_name:
      document.getElementById("editCampus")?.value || null,

    class_name:
      document.getElementById("editClass")?.value.trim() || null,

    mensa:
      document.getElementById("editMensa")?.value || null,

    home_meal:
      document.getElementById("editHomeMeal")?.value || null,

    transport:
      document.getElementById("editTransport")?.value || null,

    allergy:
      document.getElementById("editAllergy")?.value || "No",

    allergy_type:
      document.getElementById("editAllergyType")?.value.trim() ||
      null,

    allergy_notes:
      document.getElementById("editAllergyNotes")?.value.trim() ||
      null
  };

  const { error } =
    await supabase
      .from("students")
      .update(payload)
      .eq("id", s.id)
      .eq("family_user_id", state.authUser.id);

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante la modifica della scheda.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  state.selectedStudent = studentById(s.id);

  state.page = "familyStudent";

  showMessage("Scheda aggiornata correttamente.");
}


/* =========================================================
   DELEGHE
   ========================================================= */

function delegateCard(d) {
  return `
    <div class="item-card">

      <div>
        <strong>${esc(d.full_name || d.name || "Delegato")}</strong>

        <p>
          Rapporto:
          ${esc(d.relationship || "—")}
        </p>

        <p>
          Validità:
          ${esc(d.valid_from || "—")}
          →
          ${esc(d.valid_to || "—")}
        </p>

        <p>
          Documento:
          ${esc(d.document_details || "—")}
        </p>
      </div>

      <button
        class="danger-outline"
        onclick="deleteDelegate('${d.id}')"
      >
        Elimina
      </button>

    </div>
  `;
}

async function addDelegate(studentId) {
  const name = prompt("Nome e cognome del delegato:");

  if (!name) return;

  const relationship =
    prompt("Rapporto con l'alunno:") || "";

  const documentDetails =
    prompt("Documento di identità / estremi:") || "";

  const validTo =
    prompt("Data di scadenza della delega (AAAA-MM-GG):") || null;

  const { error } =
    await supabase
      .from("student_delegates")
      .insert({
        student_id: studentId,
        full_name: name,
        relationship,
        document_details: documentDetails,
        valid_to: validTo,
        active: true
      });

  if (error) {
    console.error(error);
    showMessage(
      "Errore nel salvataggio della delega.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();
  state.selectedStudent = studentById(studentId);
  render();

  showMessage("Delega inserita.");
}

async function deleteDelegate(id) {
  if (!confirm("Vuoi eliminare questa delega?")) return;

  const { error } =
    await supabase
      .from("student_delegates")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante l'eliminazione.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  if (state.selectedStudent) {
    state.selectedStudent =
      studentById(state.selectedStudent.id);
  }

  render();

  showMessage("Delega eliminata.");
}


/* =========================================================
   USCITE ANTICIPATE
   ========================================================= */

function earlyExitCard(e) {
  return `
    <div class="item-card">

      <div>
        <strong>
          ${esc(e.exit_date || "Data non indicata")}
          ${e.exit_time ? " · " + esc(e.exit_time) : ""}
        </strong>

        <p>
          Tipologia:
          ${esc(e.type || "Occasionale")}
        </p>

        <p>
          Persona autorizzata:
          ${esc(e.authorized_person || "—")}
        </p>

        <p>
          Validità:
          ${esc(e.valid_from || "—")}
          →
          ${esc(e.valid_to || "—")}
        </p>
      </div>

      <button
        class="danger-outline"
        onclick="deleteEarlyExit('${e.id}')"
      >
        Elimina
      </button>

    </div>
  `;
}

async function addEarlyExit(studentId) {
  const date =
    prompt("Data dell'uscita (AAAA-MM-GG):");

  if (!date) return;

  const time =
    prompt("Ora dell'uscita:") || "";

  const type =
    prompt("Tipologia (Occasionale / Ricorrente):") ||
    "Occasionale";

  const person =
    prompt("Persona autorizzata al ritiro:") ||
    "";

  const { error } =
    await supabase
      .from("early_exits")
      .insert({
        student_id: studentId,
        exit_date: date,
        exit_time: time,
        type,
        authorized_person: person
      });

  if (error) {
    console.error(error);
    showMessage(
      "Errore nel salvataggio dell'uscita.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  state.selectedStudent =
    studentById(studentId);

  render();

  showMessage("Uscita anticipata inserita.");
}

async function deleteEarlyExit(id) {
  if (!confirm("Vuoi eliminare questa uscita?")) return;

  const { error } =
    await supabase
      .from("early_exits")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante l'eliminazione.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  if (state.selectedStudent) {
    state.selectedStudent =
      studentById(state.selectedStudent.id);
  }

  render();

  showMessage("Uscita eliminata.");
}


/* =========================================================
   FARMACI
   ========================================================= */

function medicationCard(m) {
  return `
    <div class="item-card sensitive-item">

      <div>

        <strong>
          ${esc(m.medication_name || m.name || "Farmaco")}
        </strong>

        <p>
          Dose:
          ${esc(m.dose || "—")}
        </p>

        <p>
          Quando:
          ${esc(m.schedule || m.when || "—")}
        </p>

        <p>
          Modalità:
          ${esc(m.method || "—")}
        </p>

        <p>
          Somministrato a scuola:
          ${esc(m.administered_at_school || m.administered_at_school === false
            ? (m.administered_at_school ? "Si" : "No")
            : "—")}
        </p>

        <p>
          Validità autorizzazione:
          ${esc(m.authorization_valid_to || "—")}
        </p>

        <p>
          Istruzioni:
          ${esc(m.instructions || "—")}
        </p>

      </div>

      <div class="item-actions">

        <button
          onclick="editMedication('${m.id}')"
        >
          Modifica
        </button>

        <button
          class="danger-outline"
          onclick="deleteMedication('${m.id}')"
        >
          Elimina
        </button>

      </div>

    </div>
  `;
}

async function addMedication(studentId) {
  const name =
    prompt("Nome del farmaco:");

  if (!name) return;

  const dose =
    prompt("Dose:");

  const schedule =
    prompt("Quando / orario:");

  const method =
    prompt("Modalità di somministrazione:");

  const administered =
    confirm("Il farmaco deve essere somministrato a scuola?");

  const validity =
    prompt(
      "Validità autorizzazione (AAAA-MM-GG), se presente:"
    ) || null;

  const instructions =
    prompt("Istruzioni operative:") || "";

  const { error } =
    await supabase
      .from("student_medications")
      .insert({
        student_id: studentId,
        medication_name: name,
        dose: dose || "",
        schedule: schedule || "",
        method: method || "",
        administered_at_school: administered,
        authorization_valid_to: validity,
        instructions
      });

  if (error) {
    console.error(error);
    showMessage(
      "Errore nel salvataggio del farmaco.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  state.selectedStudent =
    studentById(studentId);

  render();

  showMessage("Farmaco inserito correttamente.");
}

async function editMedication(id) {
  const medication =
    state.medications.find(m => m.id === id);

  if (!medication) return;

  const name =
    prompt(
      "Nome del farmaco:",
      medication.medication_name || ""
    );

  if (!name) return;

  const dose =
    prompt(
      "Dose:",
      medication.dose || ""
    );

  const schedule =
    prompt(
      "Quando / orario:",
      medication.schedule || ""
    );

  const method =
    prompt(
      "Modalità:",
      medication.method || ""
    );

  const validity =
    prompt(
      "Validità autorizzazione:",
      medication.authorization_valid_to || ""
    );

  const instructions =
    prompt(
      "Istruzioni operative:",
      medication.instructions || ""
    );

  const { error } =
    await supabase
      .from("student_medications")
      .update({
        medication_name: name,
        dose: dose || "",
        schedule: schedule || "",
        method: method || "",
        authorization_valid_to:
          validity || null,
        instructions: instructions || ""
      })
      .eq("id", id);

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante la modifica del farmaco.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  if (state.selectedStudent) {
    state.selectedStudent =
      studentById(state.selectedStudent.id);
  }

  render();

  showMessage("Farmaco modificato.");
}

async function deleteMedication(id) {
  if (!confirm("Vuoi eliminare questo farmaco?")) return;

  const { error } =
    await supabase
      .from("student_medications")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(error);
    showMessage(
      "Errore durante l'eliminazione del farmaco.",
      "error"
    );
    return;
  }

  await syncFamilyFromSupabase();

  if (state.selectedStudent) {
    state.selectedStudent =
      studentById(state.selectedStudent.id);
  }

  render();

  showMessage("Farmaco eliminato.");
}


/* =========================================================
   DOCENTI - ALUNNI
   ========================================================= */

function studentsPage() {
  return `
    <section class="page">

      <div class="page-head">

        <div>
          <h1>Alunni</h1>
          <p>
            Elenco degli alunni presenti nel sistema.
          </p>
        </div>

        <input
          id="studentSearch"
          class="search"
          placeholder="Cerca alunno..."
          oninput="filterStudents()"
        />

      </div>

      <div id="studentsList">
        ${staffStudentRows(state.students)}
      </div>

    </section>
  `;
}

function staffStudentRows(list) {
  if (!list.length) {
    return `
      <div class="empty">
        Nessun alunno trovato.
      </div>
    `;
  }

  return `
    <div class="table-card">

      <table>

        <thead>
          <tr>
            <th>Alunno</th>
            <th>Classe</th>
            <th>Plesso</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>

        <tbody>

          ${list.map(s => `
            <tr>

              <td>
                <strong>
                  ${esc(s.first_name)}
                  ${esc(s.last_name)}
                </strong>
              </td>

              <td>
                ${esc(s.class_name || "—")}
              </td>

              <td>
                ${esc(s.campus_name || "—")}
              </td>

              <td>
                <span class="status ${statusClass(
                  s.verification_status ||
                  "Da verificare"
                )}">
                  ${esc(
                    s.verification_status ||
                    "Da verificare"
                  )}
                </span>
              </td>

              <td>
                <button
                  onclick="openStaffStudent('${s.id}')"
                >
                  Apri
                </button>
              </td>

            </tr>
          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}

function filterStudents() {
  const term =
    document.getElementById("studentSearch")
      ?.value
      ?.trim()
      .toLowerCase() || "";

  const filtered =
    state.students.filter(s => {

      const text = [
        s.first_name,
        s.last_name,
        s.class_name,
        s.campus_name,
        s.order_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });

  const container =
    document.getElementById("studentsList");

  if (container) {
    container.innerHTML =
      staffStudentRows(filtered);
  }
}

function openStaffStudent(id) {
  const student = studentById(id);

  if (!student) {
    showMessage("Alunno non trovato.", "error");
    return;
  }

  state.selectedStudent = student;
  state.page = "staffStudent";
  render();
}


/* =========================================================
   SCHEDA ALUNNO - DOCENTI
   ========================================================= */

function staffStudentPage() {
  const s = state.selectedStudent;

  if (!s) {
    state.page = "students";
    return "";
  }

  const delegates = studentDelegates(s.id);
  const early = studentEarlyExits(s.id);
  const meds = studentMedications(s.id);

  return `
    <section class="page">

      <div class="page-head">

        <div>

          <button
            class="back"
            onclick="go('students')"
          >
            ← Torna agli alunni
          </button>

          <h1>
            ${esc(s.first_name)}
            ${esc(s.last_name)}
          </h1>

          <p>
            ${esc(s.class_name || "Classe non indicata")}
            ·
            ${esc(s.campus_name || "Plesso non indicato")}
          </p>

        </div>

        <button
          onclick="openVerification('${s.id}')"
        >
          Verifica questa scheda
        </button>

      </div>


      <div class="section-card">

        <h2>👤 Anagrafica</h2>

        <div class="detail-grid">

          <div>
            <strong>Nome</strong>
            <span>${esc(s.first_name)}</span>
          </div>

          <div>
            <strong>Cognome</strong>
            <span>${esc(s.last_name)}</span>
          </div>

          <div>
            <strong>Data di nascita</strong>
            <span>${esc(formatDate(s.dob) || "—")}</span>
          </div>

          <div>
            <strong>Anno scolastico</strong>
            <span>${esc(s.school_year || "—")}</span>
          </div>

          <div>
            <strong>Ordine</strong>
            <span>${esc(s.order_name || "—")}</span>
          </div>

          <div>
            <strong>Plesso</strong>
            <span>${esc(s.campus_name || "—")}</span>
          </div>

          <div>
            <strong>Classe</strong>
            <span>${esc(s.class_name || "—")}</span>
          </div>

        </div>

      </div>


      <div class="section-card">

        <h2>🟢 Informazioni operative</h2>

        <p>
          <strong>Mensa:</strong>
          ${esc(s.mensa || "—")}
        </p>

        <p>
          <strong>Pasto da casa:</strong>
          ${esc(s.home_meal || "—")}
        </p>

        <p>
          <strong>Trasporto:</strong>
          ${esc(s.transport || "—")}
        </p>

      </div>


      <div class="section-card warning-card">

        <h2>🟠 Allergie / informazioni importanti</h2>

        <p>
          <strong>Presenza:</strong>
          ${esc(s.allergy || "No")}
        </p>

        <p>
          <strong>Tipo:</strong>
          ${esc(s.allergy_type || "—")}
        </p>

        <p>
          <strong>Note operative:</strong>
          ${esc(s.allergy_notes || "—")}
        </p>

      </div>


      <div class="section-card">

        <h2>👥 Deleghe</h2>

        ${
          delegates.length
            ? delegates.map(delegateCard).join("")
            : `<p>Nessuna delega presente.</p>`
        }

      </div>


      <div class="section-card">

        <h2>🚪 Uscite anticipate</h2>

        ${
          early.length
            ? early.map(earlyExitCard).join("")
            : `<p>Nessuna uscita anticipata presente.</p>`
        }

      </div>


      <div class="section-card sensitive">

        <h2>🔴 Farmaci</h2>

        <p class="sensitive-note">
          Area riservata alle informazioni sensibili.
        </p>

        ${
          meds.length
            ? meds.map(medicationCard).join("")
            : `<p>Nessun farmaco presente.</p>`
        }

      </div>

    </section>
  `;
}


/* =========================================================
   VERIFICHE
   ========================================================= */

function verificationsPage() {
  const students =
    [...state.students].sort((a, b) =>
      (a.last_name || "")
        .localeCompare(b.last_name || "")
    );

  return `
    <section class="page">

      <div class="page-head">

        <div>
          <h1>Verifiche</h1>
          <p>
            Stato di verifica delle schede degli alunni.
          </p>
        </div>

      </div>

      <div class="table-card">

        <table>

          <thead>
            <tr>
              <th>Alunno</th>
              <th>Classe</th>
              <th>Stato</th>
              <th></th>
            </tr>
          </thead>

          <tbody>

            ${
              students.length
                ? students.map(s => `
                    <tr>

                      <td>
                        <strong>
                          ${esc(s.first_name)}
                          ${esc(s.last_name)}
                        </strong>
                      </td>

                      <td>
                        ${esc(s.class_name || "—")}
                      </td>

                      <td>
                        <span class="status ${statusClass(
                          s.verification_status ||
                          "Da verificare"
                        )}">
                          ${esc(
                            s.verification_status ||
                            "Da verificare"
                          )}
                        </span>
                      </td>

                      <td>
                        <button
                          onclick="openVerification('${s.id}')"
                        >
                          Apri e verifica
                        </button>
                      </td>

                    </tr>
                  `).join("")
                : `
                  <tr>
                    <td colspan="4">
                      Nessun alunno presente.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>

    </section>
  `;
}

function openVerification(id) {
  const student = studentById(id);

  if (!student) {
    showMessage("Alunno non trovato.", "error");
    return;
  }

  state.verificationStudent = student;
  state.page = "verificationDetail";
  render();
}

function verificationDetailPage() {
  const s = state.verificationStudent;

  if (!s) {
    state.page = "verifications";
    return "";
  }

  return `
    <section class="page">

      <div class="page-head">

        <div>

          <button
            class="back"
            onclick="go('verifications')"
          >
            ← Torna alle verifiche
          </button>

          <h1>
            Verifica scheda
          </h1>

          <p>
            ${esc(s.first_name)}
            ${esc(s.last_name)}
          </p>

        </div>

      </div>


      <div class="verification-card">

        <div class="verification-summary">

          <h2>
            ${esc(s.first_name)}
            ${esc(s.last_name)}
          </h2>

          <p>
            Classe:
            <strong>
              ${esc(s.class_name || "—")}
            </strong>
          </p>

          <p>
            Plesso:
            <strong>
              ${esc(s.campus_name || "—")}
            </strong>
          </p>

          <p>
            Stato attuale:
            <span class="status ${statusClass(
              s.verification_status ||
              "Da verificare"
            )}">
              ${esc(
                s.verification_status ||
                "Da verificare"
              )}
            </span>
          </p>

        </div>


        <form
          onsubmit="saveVerification(event)"
        >

          <label>
            Esito della verifica

            <select
              id="verificationStatus"
              required
            >
              ${option(
                "Da verificare",
                s.verification_status ||
                "Da verificare"
              )}

              ${option(
                "Approvato",
                s.verification_status
              )}

              ${option(
                "Da integrare",
                s.verification_status
              )}

              ${option(
                "Scaduto",
                s.verification_status
              )}
            </select>

          </label>


          <label>
            Note della verifica

            <textarea
              id="verificationNote"
              placeholder="Inserisci eventuali note..."
            >${esc(s.verification_note || "")}</textarea>

          </label>


          <div class="form-actions">

            <button
              type="button"
              class="secondary"
              onclick="go('verifications')"
            >
              Annulla
            </button>

            <button type="submit">
              Salva verifica
            </button>

          </div>

        </form>

      </div>

    </section>
  `;
}

async function saveVerification(event) {
  event.preventDefault();

  const s = state.verificationStudent;

  if (!s) return;

  const status =
    document.getElementById(
      "verificationStatus"
    )?.value;

  const note =
    document.getElementById(
      "verificationNote"
    )?.value
    ?.trim() || null;

  if (!status) {
    showMessage(
      "Seleziona un esito.",
      "error"
    );
    return;
  }

  const { error } =
    await supabase
      .from("students")
      .update({
        verification_status: status,
        verification_note: note,
        verified_at:
          status === "Da verificare"
            ? null
            : new Date().toISOString(),
        verified_by:
          status === "Da verificare"
            ? null
            : state.authUser?.id
      })
      .eq("id", s.id);

  if (error) {
    console.error(error);

    showMessage(
      "Errore durante il salvataggio della verifica.",
      "error"
    );

    return;
  }

  await syncStaffFromSupabase();

  state.verificationStudent =
    studentById(s.id);

  state.selectedStudent =
    studentById(s.id);

  state.page = "verifications";

  render();

  showMessage(
    "Verifica salvata su Supabase."
  );
}


/* =========================================================
   STRUTTURA SCOLASTICA
   ========================================================= */

function structurePage() {
  return `
    <section class="page">

      <div class="page-head">

        <div>
          <h1>Struttura scolastica</h1>
          <p>
            Informazioni presenti nell'ambiente di test.
          </p>
        </div>

      </div>

      <div class="cards">

        <div class="card">
          <div class="card-icon">🏫</div>
          <h3>Ordini</h3>
          <p>
            ${state.orders.length}
            elementi
          </p>
        </div>

        <div class="card">
          <div class="card-icon">🏢</div>
          <h3>Plessi</h3>
          <p>
            ${state.campuses.length}
            elementi
          </p>
        </div>

        <div class="card">
          <div class="card-icon">📚</div>
          <h3>Classi</h3>
          <p>
            ${state.classes.length}
            elementi
          </p>
        </div>

      </div>

    </section>
  `;
}


/* =========================================================
   ROUTING
   ========================================================= */

function go(page) {
  state.page = page;

  if (page === "students" ||
      page === "verifications" ||
      page === "structure") {

    if (state.role === "family") {
      state.page = "children";
    }
  }

  render();
}


/* =========================================================
   RENDER
   ========================================================= */

function loginPage() {
  return `
    <div class="login-page">

      <div class="login-card">

        <div class="login-logo">
          <img
            src="assets/logo_ic_anzio_i.jpeg"
            alt="I.C. Anzio I"
          />
        </div>

        <h1>I.C. Anzio I</h1>

        <p class="login-subtitle">
          Portale scolastico
        </p>

        <form onsubmit="event.preventDefault(); doLogin();">

          <label>
            Username

            <input
              id="loginUsername"
              autocomplete="username"
              placeholder="Inserisci username"
              required
            />
          </label>

          <label>
            Password

            <input
              id="loginPassword"
              type="password"
              autocomplete="current-password"
              placeholder="Inserisci password"
              required
            />
          </label>

          <button
            type="submit"
            class="login-button"
          >
            Accedi
          </button>

        </form>

        <div class="login-info">

          <strong>Ambiente di test</strong>

          <p>
            Password iniziale:
            <code>${DEFAULT_PASSWORD}</code>
          </p>

          <p>
            Al primo accesso sarà richiesto
            di impostare una password personale.
          </p>

        </div>

      </div>

    </div>
  `;
}

function changePasswordPage() {
  return `
    <div class="login-page">

      <div class="login-card">

        <div class="login-logo">
          <img
            src="assets/logo_ic_anzio_i.jpeg"
            alt="I.C. Anzio I"
          />
        </div>

        <h1>Crea la tua password</h1>

        <p class="login-subtitle">
          Per motivi di sicurezza devi modificare
          la password iniziale.
        </p>

        <form
          onsubmit="event.preventDefault(); changePassword();"
        >

          <label>
            Nuova password

            <input
              id="newPassword"
              type="password"
              minlength="8"
              required
            />
          </label>

          <label>
            Ripeti nuova password

            <input
              id="newPassword2"
              type="password"
              minlength="8"
              required
            />
          </label>

          <button type="submit">
            Salva nuova password
          </button>

        </form>

      </div>

    </div>
  `;
}

function header() {
  if (!state.user) return "";

  return `
    <header class="topbar">

      <div class="brand">

        <img
          src="assets/logo_ic_anzio_i.jpeg"
          alt="I.C. Anzio I"
        />

        <div>
          <strong>I.C. Anzio I</strong>
          <small>
            Ambiente di test operativo · V41
          </small>
        </div>

      </div>

      <div class="user-area">

        <span>
          ${roleLabel(state.role)}
        </span>

        <strong>
          ${esc(
            state.user.display ||
            state.user.username ||
            "Utente"
          )}
        </strong>

        <button
          class="logout"
          onclick="doLogout()"
        >
          Esci
        </button>

      </div>

    </header>
  `;
}

function nav() {
  if (!state.user) return "";

  let links = `
    <button onclick="go('home')">
      🏠 Home
    </button>
  `;

  if (state.role === "family") {
    links += `
      <button onclick="go('children')">
        👨‍👩‍👧 I miei figli
      </button>
    `;
  }

  if (
    state.role === "teacher" ||
    state.role === "admin"
  ) {
    links += `
      <button onclick="go('students')">
        👨‍🎓 Alunni
      </button>

      <button onclick="go('verifications')">
        ✅ Verifiche
      </button>

      <button onclick="go('structure')">
        🏫 Struttura
      </button>
    `;
  }

  return `
    <nav class="sidebar">
      ${links}
    </nav>
  `;
}

function appPage() {
  if (state.page === "home") {
    return home();
  }

  if (state.page === "children") {
    return childrenPage();
  }

  if (state.page === "addChild") {
    return addChildPage();
  }

  if (state.page === "familyStudent") {
    return familyStudentPage();
  }

  if (state.page === "editStudent") {
    return editStudentPage();
  }

  if (state.page === "students") {
    return studentsPage();
  }

  if (state.page === "staffStudent") {
    return staffStudentPage();
  }

  if (state.page === "verifications") {
    return verificationsPage();
  }

  if (state.page === "verificationDetail") {
    return verificationDetailPage();
  }

  if (state.page === "structure") {
    return structurePage();
  }

  return home();
}

function render() {
  const app =
    document.getElementById("app");

  if (!app) return;

  if (!state.user) {
    app.innerHTML = loginPage();
    return;
  }

  if (state.page === "changePassword") {
    app.innerHTML = changePasswordPage();
    return;
  }

  app.innerHTML = `
    ${header()}

    <div class="app-layout">

      ${nav()}

      <main class="main">
        ${
          state.message
            ? `
              <div class="toast ${state.message.type}">
                ${esc(state.message.text)}
              </div>
            `
            : ""
        }

        ${appPage()}
      </main>

    </div>
  `;
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    render();
    await restoreSession();
  }
);
