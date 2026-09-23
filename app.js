/* =========================================================
   I.C. ANZIO I
   PORTALE SCOLASTICO
   AUTENTICAZIONE + REGISTRAZIONE
   ========================================================= */

const SUPABASE_URL =
  "https://vnpzhhpkymfxxajvvxtj.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_qIq-kTzwKFl7YWyWUyZVTA_v_AN386T";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =========================================================
   STATO APPLICAZIONE
   ========================================================= */

const state = {
  page: "login",

  user: null,
  authUser: null,
  role: null,

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


function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return d.toLocaleDateString("it-IT");
}


function displayName(profile) {
  if (!profile) return "Utente";

  const name = [
    profile.first_name,
    profile.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    profile.username ||
    profile.email ||
    state.authUser?.email ||
    "Utente"
  );
}


function statusClass(status) {
  if (status === "Approvato") {
    return "status-approved";
  }

  if (status === "Da integrare") {
    return "status-warning";
  }

  if (status === "Scaduto") {
    return "status-expired";
  }

  return "status-pending";
}


function roleLabel(role) {
  if (role === "admin") {
    return "👑 Amministratore";
  }

  if (role === "teacher") {
    return "👩‍🏫 Docente";
  }

  if (role === "family") {
    return "👨‍👩‍👧 Famiglia";
  }

  return "";
}


function showMessage(text, type = "success") {

  state.message = {
    text,
    type
  };

  render();

  setTimeout(() => {

    state.message = null;

    render();

  }, 3500);
}


/* =========================================================
   NAVIGAZIONE
   ========================================================= */

function go(page) {

  state.page = page;

  render();
}


/* =========================================================
   LOGIN
   ========================================================= */

async function doLogin() {

  const email =
    document
      .getElementById("loginEmail")
      ?.value
      ?.trim()
      .toLowerCase();

  const password =
    document
      .getElementById("loginPassword")
      ?.value || "";

  if (!email || !password) {

    showMessage(
      "Inserisci email e password.",
      "error"
    );

    return;
  }


  const {
    data,
    error
  } =
    await supabase.auth.signInWithPassword({

      email,

      password

    });


  if (error) {

    console.error(error);

    showMessage(
      "Email o password non corretti.",
      "error"
    );

    return;
  }


  await loadProfile(data.user);
}


/* =========================================================
   CARICAMENTO PROFILO
   ========================================================= */

async function loadProfile(authUser) {

  if (!authUser) {
    return;
  }


  state.authUser = authUser;


  const {
    data: profile,
    error
  } =
    await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();


  if (error || !profile) {

    console.error(error);

    await supabase.auth.signOut();

    state.authUser = null;
    state.user = null;
    state.role = null;

    showMessage(
      "Profilo utente non trovato.",
      "error"
    );

    return;
  }


  state.user = profile;

  state.role = profile.role;

  state.user.display =
    displayName(profile);


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


/* =========================================================
   SESSIONE
   ========================================================= */

async function restoreSession() {

  const {
    data: {
      session
    }
  } =
    await supabase.auth.getSession();


  if (!session?.user) {

    state.page = "login";

    render();

    return;
  }


  await loadProfile(session.user);
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function doLogout() {

  await supabase.auth.signOut();


  state.user = null;
  state.authUser = null;
  state.role = null;

  state.students = [];
  state.delegates = [];
  state.earlyExits = [];
  state.medications = [];

  state.orders = [];
  state.campuses = [];
  state.classes = [];

  state.selectedStudent = null;
  state.verificationStudent = null;

  state.page = "login";


  render();
}


/* =========================================================
   REGISTRAZIONE
   ========================================================= */

function registrationPage() {

  return `

    <div class="login-page">

      <div class="login-card">

        <div class="login-logo">

          <img
            src="assets/logo_ic_anzio_i.jpeg"
            alt="I.C. Anzio I"
          />

        </div>


        <h1>Crea il tuo account</h1>

        <p class="login-subtitle">
          Seleziona il tipo di account.
        </p>


        <div class="registration-choice">

          <button
            class="role-choice"
            onclick="showRegistrationForm('family')"
          >

            <span>👨‍👩‍👧</span>

            <strong>Famiglia</strong>

            <small>
              Per genitori e tutori
            </small>

          </button>


          <button
            class="role-choice"
            onclick="showRegistrationForm('teacher')"
          >

            <span>👩‍🏫</span>

            <strong>Docente</strong>

            <small>
              Per il personale docente
            </small>

          </button>

        </div>


        <button
          class="secondary full-width"
          onclick="go('login')"
        >
          ← Torna all'accesso
        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   FORM REGISTRAZIONE
   ========================================================= */

function showRegistrationForm(type) {

  state.registrationType = type;

  state.page = "registerForm";

  render();
}


function registrationFormPage() {

  const type =
    state.registrationType || "family";

  const isTeacher =
    type === "teacher";


  return `

    <div class="login-page">

      <div class="login-card">

        <div class="login-logo">

          <img
            src="assets/logo_ic_anzio_i.jpeg"
            alt="I.C. Anzio I"
          />

        </div>


        <h1>
          ${
            isTeacher
              ? "Registrazione docente"
              : "Registrazione famiglia"
          }
        </h1>


        <p class="login-subtitle">

          ${
            isTeacher
              ? "Crea il tuo account docente."
              : "Crea il tuo account famiglia."
          }

        </p>


        <form
          onsubmit="
            event.preventDefault();
            registerUser('${type}');
          "
        >


          <label>

            Nome

            <input
              id="registerFirstName"
              type="text"
              required
              autocomplete="given-name"
            />

          </label>


          <label>

            Cognome

            <input
              id="registerLastName"
              type="text"
              required
              autocomplete="family-name"
            />

          </label>


          <label>

            Email

            <input
              id="registerEmail"
              type="email"
              required
              autocomplete="email"
            />

          </label>


          <label>

            Password

            <input
              id="registerPassword"
              type="password"
              minlength="8"
              required
              autocomplete="new-password"
            />

          </label>


          <label>

            Conferma password

            <input
              id="registerPasswordConfirm"
              type="password"
              minlength="8"
              required
              autocomplete="new-password"
            />

          </label>


          ${
            isTeacher
              ? `

                <div class="teacher-code-box">

                  <strong>
                    🔐 Codice docenti
                  </strong>

                  <p>
                    Inserisci il codice fornito
                    dalla scuola.
                  </p>

                  <input
                    id="teacherCode"
                    type="password"
                    required
                    autocomplete="off"
                    placeholder="Codice docenti"
                  />

                </div>

              `
              : ""
          }


          <label class="privacy-check">

            <input
              id="registerPrivacy"
              type="checkbox"
              required
            />

            <span>
              Dichiaro di aver letto
              l'informativa e accetto
              il trattamento dei dati
              secondo le modalità previste
              dalla scuola.
            </span>

          </label>


          <button
            type="submit"
            class="login-button"
          >

            Crea account

          </button>


        </form>


        <button
          class="secondary full-width"
          onclick="go('register')"
        >
          ← Cambia tipo di account
        </button>


        <button
          class="link-button"
          onclick="go('login')"
        >
          Ho già un account
        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   REGISTRAZIONE SUPABASE
   ========================================================= */

async function registerUser(type) {

  const firstName =
    document
      .getElementById("registerFirstName")
      ?.value
      ?.trim();

  const lastName =
    document
      .getElementById("registerLastName")
      ?.value
      ?.trim();

  const email =
    document
      .getElementById("registerEmail")
      ?.value
      ?.trim()
      .toLowerCase();

  const password =
    document
      .getElementById("registerPassword")
      ?.value || "";

  const passwordConfirm =
    document
      .getElementById("registerPasswordConfirm")
      ?.value || "";

  const privacy =
    document
      .getElementById("registerPrivacy")
      ?.checked;


  if (
    !firstName ||
    !lastName ||
    !email ||
    !password
  ) {

    showMessage(
      "Compila tutti i campi obbligatori.",
      "error"
    );

    return;
  }


  if (password.length < 8) {

    showMessage(
      "La password deve contenere almeno 8 caratteri.",
      "error"
    );

    return;
  }


  if (password !== passwordConfirm) {

    showMessage(
      "Le password non coincidono.",
      "error"
    );

    return;
  }


  if (!privacy) {

    showMessage(
      "Devi accettare l'informativa.",
      "error"
    );

    return;
  }


  /*
    Per il docente il codice viene inviato
    al backend tramite la funzione RPC.
  */

  if (type === "teacher") {

    const teacherCode =
      document
        .getElementById("teacherCode")
        ?.value
        ?.trim();


    if (!teacherCode) {

      showMessage(
        "Inserisci il codice docenti.",
        "error"
      );

      return;
    }


    /*
      Prima verifichiamo il codice.
      Il codice reale deve essere gestito
      lato Supabase.
    */

    const {
      data: validCode,
      error: codeError
    } =
      await supabase.rpc(
        "check_teacher_registration_code",
        {
          p_code: teacherCode
        }
      );


    if (
      codeError ||
      validCode !== true
    ) {

      console.error(codeError);

      showMessage(
        "Codice docenti non valido.",
        "error"
      );

      return;
    }
  }


  /*
    Registrazione Auth.
  */

  const {
    data,
    error
  } =
    await supabase.auth.signUp({

      email,

      password,

      options: {

        data: {

          first_name: firstName,

          last_name: lastName,

          requested_role: type

        }

      }

    });


  if (error) {

    console.error(error);

    showMessage(
      error.message ||
      "Errore durante la registrazione.",
      "error"
    );

    return;
  }


  /*
    Se la conferma email è attiva,
    Supabase restituisce l'utente ma
    non una sessione.
  */

  if (!data.session) {

    state.page = "login";

    render();


    setTimeout(() => {

      showMessage(
        "Registrazione completata. Controlla la tua email per confermare l'account."
      );

    }, 100);

    return;
  }


  /*
    Se la conferma email è disattivata,
    l'utente è già autenticato.
  */

  await loadProfile(data.user);
}


/* =========================================================
   CAMBIO PASSWORD
   ========================================================= */

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


        <h1>Cambia password</h1>

        <p>
          Per sicurezza devi impostare
          una nuova password.
        </p>


        <form
          onsubmit="
            event.preventDefault();
            changePassword();
          "
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

            Conferma password

            <input
              id="newPassword2"
              type="password"
              minlength="8"
              required
            />

          </label>


          <button type="submit">
            Salva password
          </button>

        </form>

      </div>

    </div>

  `;
}


async function changePassword() {

  const password =
    document
      .getElementById("newPassword")
      ?.value || "";

  const confirmPassword =
    document
      .getElementById("newPassword2")
      ?.value || "";


  if (password.length < 8) {

    showMessage(
      "La password deve contenere almeno 8 caratteri.",
      "error"
    );

    return;
  }


  if (password !== confirmPassword) {

    showMessage(
      "Le password non coincidono.",
      "error"
    );

    return;
  }


  const {
    error
  } =
    await supabase.auth.updateUser({

      password

    });


  if (error) {

    console.error(error);

    showMessage(
      "Errore durante il cambio password.",
      "error"
    );

    return;
  }


  await supabase.rpc(
    "complete_password_change"
  );


  state.user.must_change_password = false;

  state.page = "home";

  showMessage(
    "Password modificata correttamente."
  );
}


/* =========================================================
   SUPABASE - FAMIGLIA
   ========================================================= */

async function syncFamilyFromSupabase() {

  if (!state.authUser) return;


  const {
    data,
    error
  } =
    await supabase
      .from("students")
      .select("*")
      .eq(
        "family_user_id",
        state.authUser.id
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(error);

    showMessage(
      "Errore nel caricamento dei figli.",
      "error"
    );

    return;
  }


  state.students = data || [];


  const ids =
    state.students.map(
      s => s.id
    );


  state.delegates = [];
  state.earlyExits = [];
  state.medications = [];


  if (!ids.length) {
    return;
  }


  const [
    delegatesResult,
    exitsResult,
    medicationsResult
  ] =
    await Promise.all([

      supabase
        .from("student_delegates")
        .select("*")
        .in(
          "student_id",
          ids
        ),

      supabase
        .from("early_exits")
        .select("*")
        .in(
          "student_id",
          ids
        ),

      supabase
        .from("student_medications")
        .select("*")
        .in(
          "student_id",
          ids
        )

    ]);


  state.delegates =
    delegatesResult.data || [];

  state.earlyExits =
    exitsResult.data || [];

  state.medications =
    medicationsResult.data || [];
}


/* =========================================================
   SUPABASE - DOCENTI / ADMIN
   ========================================================= */

async function syncStaffFromSupabase() {

  const [
    studentsResult,
    delegatesResult,
    exitsResult,
    medicationsResult,
    ordersResult,
    campusesResult,
    classesResult
  ] =
    await Promise.all([

      supabase
        .from("students")
        .select("*")
        .order(
          "last_name",
          {
            ascending: true
          }
        ),

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


  state.students =
    studentsResult.data || [];

  state.delegates =
    delegatesResult.data || [];

  state.earlyExits =
    exitsResult.data || [];

  state.medications =
    medicationsResult.data || [];

  state.orders =
    ordersResult.data || [];

  state.campuses =
    campusesResult.data || [];

  state.classes =
    classesResult.data || [];
}


/* =========================================================
   HOME
   ========================================================= */

function home() {

  const name =
    state.user?.display ||
    state.user?.email ||
    "Utente";


  if (state.role === "family") {

    return `

      <section class="page">

        <div class="hero">

          <h1>Area Famiglie</h1>

          <p>
            Benvenuto/a,
            <strong>
              ${esc(name)}
            </strong>.
          </p>

        </div>


        <div class="cards">

          <div class="card">

            <div class="card-icon">
              👨‍👩‍👧
            </div>

            <h3>I miei figli</h3>

            <p>
              ${state.students.length}
              ${
                state.students.length === 1
                  ? "figlio inserito"
                  : "figli inseriti"
              }
            </p>

            <button
              onclick="go('children')"
            >
              Gestisci figli
            </button>

          </div>


          <div class="card">

            <div class="card-icon">
              📄
            </div>

            <h3>Autorizzazioni</h3>

            <p>
              Deleghe, uscite anticipate
              e documentazione.
            </p>

            <button
              onclick="go('children')"
            >
              Apri
            </button>

          </div>


          <div class="card">

            <div class="card-icon">
              💊
            </div>

            <h3>Farmaci</h3>

            <p>
              Gestione delle informazioni
              sui farmaci autorizzati.
            </p>

            <button
              onclick="go('children')"
            >
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

        <h1>
          ${
            state.role === "admin"
              ? "Area Amministrazione"
              : "Area Docenti"
          }
        </h1>

        <p>
          Benvenuto/a,
          <strong>
            ${esc(name)}
          </strong>.
        </p>

      </div>


      <div class="cards">

        <div class="card">

          <div class="card-icon">
            👨‍🎓
          </div>

          <h3>Alunni</h3>

          <p>
            Consulta le schede degli alunni.
          </p>

          <button
            onclick="go('students')"
          >
            Apri alunni
          </button>

        </div>


        <div class="card">

          <div class="card-icon">
            ✅
          </div>

          <h3>Verifiche</h3>

          <p>
            Gestisci lo stato delle schede.
          </p>

          <button
            onclick="go('verifications')"
          >
            Apri verifiche
          </button>

        </div>


        <div class="card">

          <div class="card-icon">
            🏫
          </div>

          <h3>Struttura</h3>

          <p>
            Ordini, plessi e classi.
          </p>

          <button
            onclick="go('structure')"
          >
            Apri
          </button>

        </div>

      </div>

    </section>

  `;
}


/* =========================================================
   FIGLI
   ========================================================= */

function childrenPage() {

  return `

    <section class="page">

      <div class="page-head">

        <div>

          <h1>I miei figli</h1>

          <p>
            Inserisci e gestisci autonomamente
            i dati dei tuoi figli.
          </p>

        </div>


        <button
          onclick="go('addChild')"
        >
          + Inserisci figlio
        </button>

      </div>


      ${
        state.students.length

          ? `

            <div class="student-grid">

              ${
                state.students
                  .map(studentCard)
                  .join("")
              }

            </div>

          `

          : `

            <div class="empty">

              <div class="empty-icon">
                👨‍👩‍👧
              </div>

              <h3>
                Nessun figlio inserito
              </h3>

              <p>
                Inserisci il primo figlio.
              </p>

              <button
                onclick="go('addChild')"
              >
                Inserisci figlio
              </button>

            </div>

          `
      }

    </section>

  `;
}


function studentCard(student) {

  const status =
    student.verification_status ||
    "Da verificare";


  return `

    <div class="student-card">

      <div class="student-avatar">

        ${esc(
          (student.first_name || "?")
            .charAt(0)
            .toUpperCase()
        )}

      </div>


      <div class="student-info">

        <h3>
          ${esc(student.first_name)}
          ${esc(student.last_name)}
        </h3>

        <p>
          Classe:
          ${esc(student.class_name || "—")}
        </p>

        <p>
          Plesso:
          ${esc(student.campus_name || "—")}
        </p>

        <span
          class="status ${statusClass(status)}"
        >
          ${esc(status)}
        </span>

      </div>


      <div class="student-actions">

        <button
          onclick="
            openFamilyStudent('${student.id}')
          "
        >
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
            Inserisci i dati principali.
          </p>

        </div>

      </div>


      <form
        class="form-card"
        onsubmit="
          saveFamilyChild(event)
        "
      >


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

              <option value="">
                Seleziona
              </option>

              <option value="Infanzia">
                Infanzia
              </option>

              <option value="Primaria">
                Primaria
              </option>

              <option value="Secondaria di I grado">
                Secondaria di I grado
              </option>

            </select>

          </label>


          <label>

            Plesso

            <select id="childCampus">

              <option value="">
                Seleziona
              </option>

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

              <option value="">
                Seleziona
              </option>

              <option value="Si">
                Si
              </option>

              <option value="No">
                No
              </option>

            </select>

          </label>


          <label>

            Pasto da casa

            <select id="childHomeMeal">

              <option value="">
                Seleziona
              </option>

              <option value="Si">
                Si
              </option>

              <option value="No">
                No
              </option>

            </select>

          </label>


          <label>

            Trasporto

            <select id="childTransport">

              <option value="">
                Seleziona
              </option>

              <option value="Si">
                Si
              </option>

              <option value="No">
                No
              </option>

            </select>

          </label>


        </div>


        <h2>
          Allergie
        </h2>


        <div class="form-grid">


          <label>

            Presenti?

            <select id="childAllergy">

              <option value="No">
                No
              </option>

              <option value="Si">
                Si
              </option>

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


  const payload = {

    first_name:
      document
        .getElementById("childFirstName")
        ?.value
        ?.trim(),

    last_name:
      document
        .getElementById("childLastName")
        ?.value
        ?.trim(),

    dob:
      document
        .getElementById("childDob")
        ?.value ||
      null,

    school_year:
      document
        .getElementById("childSchoolYear")
        ?.value
        ?.trim() ||
      "2026/2027",

    order_name:
      document
        .getElementById("childOrder")
        ?.value ||
      null,

    campus_name:
      document
        .getElementById("childCampus")
        ?.value ||
      null,

    class_name:
      document
        .getElementById("childClass")
        ?.value
        ?.trim() ||
      null,

    mensa:
      document
        .getElementById("childMensa")
        ?.value ||
      null,

    home_meal:
      document
        .getElementById("childHomeMeal")
        ?.value ||
      null,

    transport:
      document
        .getElementById("childTransport")
        ?.value ||
      null,

    allergy:
      document
        .getElementById("childAllergy")
        ?.value ||
      "No",

    allergy_type:
      document
        .getElementById("childAllergyType")
        ?.value
        ?.trim() ||
      null,

    allergy_notes:
      document
        .getElementById("childAllergyNotes")
        ?.value
        ?.trim() ||
      null,

    family_user_id:
      state.authUser.id,

    family_submitted:
      true,

    verification_status:
      "Da verificare"

  };


  if (
    !payload.first_name ||
    !payload.last_name
  ) {

    showMessage(
      "Nome e cognome sono obbligatori.",
      "error"
    );

    return;
  }


  const {
    error
  } =
    await supabase
      .from("students")
      .insert(payload);


  if (error) {

    console.error(error);

    showMessage(
      "Errore durante il salvataggio.",
      "error"
    );

    return;
  }


  await syncFamilyFromSupabase();


  state.page = "children";

  render();


  showMessage(
    "Figlio inserito correttamente."
  );
}


/* =========================================================
   APERTURA SCHEDA FIGLIO
   ========================================================= */

function openFamilyStudent(id) {

  const student =
    state.students.find(
      s => s.id === id
    );


  if (!student) {

    showMessage(
      "Alunno non trovato.",
      "error"
    );

    return;
  }


  state.selectedStudent = student;

  state.page = "familyStudent";

  render();
}


/* =========================================================
   SCHEDA FAMIGLIA
   ========================================================= */

function familyStudentPage() {

  const s =
    state.selectedStudent;


  if (!s) {

    state.page = "children";

    return "";
  }


  const delegates =
    state.delegates.filter(
      d =>
        d.student_id === s.id
    );


  const exits =
    state.earlyExits.filter(
      e =>
        e.student_id === s.id
    );


  const meds =
    state.medications.filter(
      m =>
        m.student_id === s.id
    );


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


        <span
          class="status ${
            statusClass(
              s.verification_status ||
              "Da verificare"
            )
          }"
        >

          ${esc(
            s.verification_status ||
            "Da verificare"
          )}

        </span>

      </div>


      <div class="section-card">

        <h2>
          👤 Anagrafica
        </h2>


        <div class="detail-grid">


          <div>
            <strong>Nome</strong>
            <span>
              ${esc(s.first_name)}
            </span>
          </div>


          <div>
            <strong>Cognome</strong>
            <span>
              ${esc(s.last_name)}
            </span>
          </div>


          <div>
            <strong>Data di nascita</strong>
            <span>
              ${formatDate(s.dob)}
            </span>
          </div>


          <div>
            <strong>Anno scolastico</strong>
            <span>
              ${esc(s.school_year || "—")}
            </span>
          </div>


          <div>
            <strong>Ordine</strong>
            <span>
              ${esc(s.order_name || "—")}
            </span>
          </div>


          <div>
            <strong>Plesso</strong>
            <span>
              ${esc(s.campus_name || "—")}
            </span>
          </div>


          <div>
            <strong>Classe</strong>
            <span>
              ${esc(s.class_name || "—")}
            </span>
          </div>


          <div>
            <strong>Mensa</strong>
            <span>
              ${esc(s.mensa || "—")}
            </span>
          </div>


          <div>
            <strong>Pasto da casa</strong>
            <span>
              ${esc(s.home_meal || "—")}
            </span>
          </div>


          <div>
            <strong>Trasporto</strong>
            <span>
              ${esc(s.transport || "—")}
            </span>
          </div>


        </div>


        <button
          onclick="
            editFamilyStudent('${s.id}')
          "
        >
          Modifica scheda
        </button>


      </div>


      <div class="section-card">

        <h2>
          🟠 Allergie
        </h2>


        <p>
          <strong>
            Presenza:
          </strong>

          ${esc(s.allergy || "No")}
        </p>


        <p>
          <strong>
            Tipo:
          </strong>

          ${esc(
            s.allergy_type || "—"
          )}
        </p>


        <p>
          <strong>
            Note operative:
          </strong>

          ${esc(
            s.allergy_notes || "—"
          )}
        </p>


      </div>


      <div class="section-card">

        <div class="section-title-row">

          <h2>
            👥 Deleghe
          </h2>


          <button
            onclick="
              addDelegate('${s.id}')
            "
          >
            + Aggiungi delega
          </button>

        </div>


        ${
          delegates.length
            ? delegates
                .map(delegateCard)
                .join("")
            : `
              <div class="empty-small">
                Nessuna delega inserita.
              </div>
            `
        }

      </div>


      <div class="section-card">

        <div class="section-title-row">

          <h2>
            🚪 Uscite anticipate
          </h2>


          <button
            onclick="
              addEarlyExit('${s.id}')
            "
          >
            + Aggiungi uscita
          </button>

        </div>


        ${
          exits.length
            ? exits
                .map(earlyExitCard)
                .join("")
            : `
              <div class="empty-small">
                Nessuna uscita inserita.
              </div>
            `
        }

      </div>


      <div class="section-card sensitive">

        <div class="section-title-row">

          <h2>
            🔴 Farmaci
          </h2>


          <button
            onclick="
              addMedication('${s.id}')
            "
          >
            + Aggiungi farmaco
          </button>

        </div>


        <p class="sensitive-note">
          Informazioni sensibili.
        </p>


        ${
          meds.length
            ? meds
                .map(medicationCard)
                .join("")
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
   MODIFICA FIGLIO
   ========================================================= */

function editFamilyStudent(id) {

  const student =
    state.students.find(
      s => s.id === id
    );


  if (!student) return;


  state.selectedStudent =
    student;

  state.page =
    "editStudent";

  render();
}


function editStudentPage() {

  const s =
    state.selectedStudent;


  if (!s) {

    state.page =
      "children";

    return "";
  }


  return `

    <section class="page">


      <div class="page-head">

        <div>

          <button
            class="back"
            onclick="
              openFamilyStudent('${s.id}')
            "
          >
            ← Torna alla scheda
          </button>


          <h1>
            Modifica scheda
          </h1>


        </div>

      </div>


      <form
        class="form-card"
        onsubmit="
          updateFamilyStudent(event)
        "
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
              value="${esc(
                s.school_year ||
                "2026/2027"
              )}"
            />

          </label>


          <label>

            Ordine

            <select id="editOrder">

              ${selectOption(
                "Infanzia",
                s.order_name
              )}

              ${selectOption(
                "Primaria",
                s.order_name
              )}

              ${selectOption(
                "Secondaria di I grado",
                s.order_name
              )}

            </select>

          </label>


          <label>

            Plesso

            <select id="editCampus">

              ${selectOption(
                "Plesso Centrale",
                s.campus_name
              )}

              ${selectOption(
                "Succursale",
                s.campus_name
              )}

              ${selectOption(
                "Quartiere Europa",
                s.campus_name
              )}

              ${selectOption(
                "Saragat",
                s.campus_name
              )}

            </select>

          </label>


          <label>

            Classe

            <input
              id="editClass"
              value="${esc(
                s.class_name || ""
              )}"
            />

          </label>


          <label>

            Mensa

            <select id="editMensa">

              ${selectOption(
                "Si",
                s.mensa
              )}

              ${selectOption(
                "No",
                s.mensa
              )}

            </select>

          </label>


          <label>

            Pasto da casa

            <select id="editHomeMeal">

              ${selectOption(
                "Si",
                s.home_meal
              )}

              ${selectOption(
                "No",
                s.home_meal
              )}

            </select>

          </label>


          <label>

            Trasporto

            <select id="editTransport">

              ${selectOption(
                "Si",
                s.transport
              )}

              ${selectOption(
                "No",
                s.transport
              )}

            </select>

          </label>


        </div>


        <h2>
          Allergie
        </h2>


        <div class="form-grid">


          <label>

            Presenti?

            <select id="editAllergy">

              ${selectOption(
                "No",
                s.allergy
              )}

              ${selectOption(
                "Si",
                s.allergy
              )}

            </select>

          </label>


          <label>

            Tipo / categoria

            <input
              id="editAllergyType"
              value="${esc(
                s.allergy_type || ""
              )}"
            />

          </label>


          <label class="full">

            Note operative

            <textarea
              id="editAllergyNotes"
            >${esc(
              s.allergy_notes || ""
            )}</textarea>

          </label>


        </div>


        <div class="form-actions">

          <button
            type="button"
            class="secondary"
            onclick="
              openFamilyStudent('${s.id}')
            "
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


function selectOption(
  value,
  selected
) {

  return `

    <option
      value="${esc(value)}"
      ${
        value === selected
          ? "selected"
          : ""
      }
    >
      ${esc(value)}
    </option>

  `;
}


async function updateFamilyStudent(event) {

  event.preventDefault();


  const s =
    state.selectedStudent;


  if (!s) return;


  const payload = {

    first_name:
      document
        .getElementById("editFirstName")
        ?.value
        ?.trim(),

    last_name:
      document
        .getElementById("editLastName")
        ?.value
        ?.trim(),

    dob:
      document
        .getElementById("editDob")
        ?.value ||
      null,

    school_year:
      document
        .getElementById("editSchoolYear")
        ?.value
        ?.trim(),

    order_name:
      document
        .getElementById("editOrder")
        ?.value ||
      null,

    campus_name:
      document
        .getElementById("editCampus")
        ?.value ||
      null,

    class_name:
      document
        .getElementById("editClass")
        ?.value
        ?.trim() ||
      null,

    mensa:
      document
        .getElementById("editMensa")
        ?.value ||
      null,

    home_meal:
      document
        .getElementById("editHomeMeal")
        ?.value ||
      null,

    transport:
      document
        .getElementById("editTransport")
        ?.value ||
      null,

    allergy:
      document
        .getElementById("editAllergy")
        ?.value ||
      "No",

    allergy_type:
      document
        .getElementById("editAllergyType")
        ?.value
        ?.trim() ||
      null,

    allergy_notes:
      document
        .getElementById("editAllergyNotes")
        ?.value
        ?.trim() ||
      null

  };


  const {
    error
  } =
    await supabase
      .from("students")
      .update(payload)
      .eq("id", s.id)
      .eq(
        "family_user_id",
        state.authUser.id
      );


  if (error) {

    console.error(error);

    showMessage(
      "Errore durante la modifica.",
      "error"
    );

    return;
  }


  await syncFamilyFromSupabase();


  state.selectedStudent =
    state.students.find(
      x => x.id === s.id
    );


  state.page =
    "familyStudent";


  render();


  showMessage(
    "Scheda aggiornata."
  );
}


/* =========================================================
   DELEGHE
   ========================================================= */

function delegateCard(d) {

  return `

    <div class="item-card">

      <div>

        <strong>
          ${esc(
            d.full_name ||
            d.name ||
            "Delegato"
          )}
        </strong>


        <p>
          Rapporto:
          ${esc(
            d.relationship ||
            "—"
          )}
        </p>


        <p>
          Documento:
          ${esc(
            d.document_details ||
            "—"
          )}
        </p>


        <p>
          Scadenza:
          ${esc(
            d.valid_to ||
            "—"
          )}
        </p>

      </div>


      <button
        class="danger-outline"
        onclick="
          deleteDelegate('${d.id}')
        "
      >
        Elimina
      </button>

    </div>

  `;
}


async function addDelegate(studentId) {

  const fullName =
    prompt(
      "Nome e cognome del delegato:"
    );


  if (!fullName) return;


  const relationship =
    prompt(
      "Rapporto con l'alunno:"
    ) || "";


  const documentDetails =
    prompt(
      "Documento di identità / estremi:"
    ) || "";


  const validTo =
    prompt(
      "Scadenza delega (AAAA-MM-GG):"
    ) || null;


  const {
    error
  } =
    await supabase
      .from("student_delegates")
      .insert({

        student_id:
          studentId,

        full_name:
          fullName,

        relationship,

        document_details:
          documentDetails,

        valid_to:
          validTo,

        active:
          true

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


  state.selectedStudent =
    state.students.find(
      s => s.id === studentId
    );


  render();


  showMessage(
    "Delega inserita."
  );
}


async function deleteDelegate(id) {

  if (
    !confirm(
      "Vuoi eliminare questa delega?"
    )
  ) {
    return;
  }


  const {
    error
  } =
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

  render();


  showMessage(
    "Delega eliminata."
  );
}


/* =========================================================
   USCITE ANTICIPATE
   ========================================================= */

function earlyExitCard(e) {

  return `

    <div class="item-card">

      <div>

        <strong>
          ${esc(
            e.exit_date ||
            "Data non indicata"
          )}

          ${
            e.exit_time
              ? " · " +
                esc(e.exit_time)
              : ""
          }

        </strong>


        <p>
          Tipologia:
          ${esc(
            e.type ||
            "Occasionale"
          )}
        </p>


        <p>
          Persona autorizzata:
          ${esc(
            e.authorized_person ||
            "—"
          )}
        </p>

      </div>


      <button
        class="danger-outline"
        onclick="
          deleteEarlyExit('${e.id}')
        "
      >
        Elimina
      </button>

    </div>

  `;
}


async function addEarlyExit(studentId) {

  const date =
    prompt(
      "Data uscita (AAAA-MM-GG):"
    );


  if (!date) return;


  const time =
    prompt(
      "Ora uscita:"
    ) || "";


  const type =
    prompt(
      "Tipologia (Occasionale / Ricorrente):"
    ) ||
    "Occasionale";


  const person =
    prompt(
      "Persona autorizzata:"
    ) ||
    "";


  const {
    error
  } =
    await supabase
      .from("early_exits")
      .insert({

        student_id:
          studentId,

        exit_date:
          date,

        exit_time:
          time,

        type,

        authorized_person:
          person

      });


  if (error) {

    console.error(error);

    showMessage(
      "Errore nel salvataggio.",
      "error"
    );

    return;
  }


  await syncFamilyFromSupabase();


  state.selectedStudent =
    state.students.find(
      s => s.id === studentId
    );


  render();


  showMessage(
    "Uscita inserita."
  );
}


async function deleteEarlyExit(id) {

  if (
    !confirm(
      "Vuoi eliminare questa uscita?"
    )
  ) {
    return;
  }


  const {
    error
  } =
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

  render();


  showMessage(
    "Uscita eliminata."
  );
}


/* =========================================================
   FARMACI
   ========================================================= */

function medicationCard(m) {

  return `

    <div class="item-card sensitive-item">

      <div>

        <strong>
          ${esc(
            m.medication_name ||
            m.name ||
            "Farmaco"
          )}
        </strong>


        <p>
          Dose:
          ${esc(
            m.dose ||
            "—"
          )}
        </p>


        <p>
          Orario:
          ${esc(
            m.schedule ||
            m.when ||
            "—"
          )}
        </p>


        <p>
          Modalità:
          ${esc(
            m.method ||
            "—"
          )}
        </p>


        <p>
          Validità:
          ${esc(
            m.authorization_valid_to ||
            "—"
          )}
        </p>


        <p>
          Istruzioni:
          ${esc(
            m.instructions ||
            "—"
          )}
        </p>

      </div>


      <div class="item-actions">

        <button
          onclick="
            editMedication('${m.id}')
          "
        >
          Modifica
        </button>


        <button
          class="danger-outline"
          onclick="
            deleteMedication('${m.id}')
          "
        >
          Elimina
        </button>

      </div>

    </div>

  `;
}


async function addMedication(studentId) {

  const name =
    prompt(
      "Nome del farmaco:"
    );


  if (!name) return;


  const dose =
    prompt(
      "Dose:"
    ) || "";


  const schedule =
    prompt(
      "Quando / orario:"
    ) || "";


  const method =
    prompt(
      "Modalità di somministrazione:"
    ) || "";


  const administered =
    confirm(
      "Il farmaco deve essere somministrato a scuola?"
    );


  const validity =
    prompt(
      "Validità autorizzazione (AAAA-MM-GG):"
    ) || null;


  const instructions =
    prompt(
      "Istruzioni operative:"
    ) || "";


  const {
    error
  } =
    await supabase
      .from("student_medications")
      .insert({

        student_id:
          studentId,

        medication_name:
          name,

        dose,

        schedule,

        method,

        administered_at_school:
          administered,

        authorization_valid_to:
          validity,

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
    state.students.find(
      s => s.id === studentId
    );


  render();


  showMessage(
    "Farmaco inserito."
  );
}


async function editMedication(id) {

  const medication =
    state.medications.find(
      m => m.id === id
    );


  if (!medication) return;


  const name =
    prompt(
      "Nome del farmaco:",
      medication.medication_name ||
      ""
    );


  if (!name) return;


  const dose =
    prompt(
      "Dose:",
      medication.dose ||
      ""
    ) || "";


  const schedule =
    prompt(
      "Quando / orario:",
      medication.schedule ||
      ""
    ) || "";


  const method =
    prompt(
      "Modalità:",
      medication.method ||
      ""
    ) || "";


  const validity =
    prompt(
      "Validità autorizzazione:",
      medication.authorization_valid_to ||
      ""
    ) || null;


  const instructions =
    prompt(
      "Istruzioni operative:",
      medication.instructions ||
      ""
    ) || "";


  const {
    error
  } =
    await supabase
      .from("student_medications")
      .update({

        medication_name:
          name,

        dose,

        schedule,

        method,

        authorization_valid_to:
          validity,

        instructions

      })
      .eq(
        "id",
        id
      );


  if (error) {

    console.error(error);

    showMessage(
      "Errore durante la modifica.",
      "error"
    );

    return;
  }


  await syncFamilyFromSupabase();

  render();


  showMessage(
    "Farmaco modificato."
  );
}


async function deleteMedication(id) {

  if (
    !confirm(
      "Vuoi eliminare questo farmaco?"
    )
  ) {
    return;
  }


  const {
    error
  } =
    await supabase
      .from("student_medications")
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

  render();


  showMessage(
    "Farmaco eliminato."
  );
}


/* =========================================================
   DOCENTI - ALUNNI
   ========================================================= */

function studentsPage() {

  return `

    <section class="page">


      <div class="page-head">

        <div>

          <h1>
            Alunni
          </h1>

          <p>
            Elenco degli alunni.
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

        ${staffStudentRows(
          state.students
        )}

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

            <th>
              Alunno
            </th>

            <th>
              Classe
            </th>

            <th>
              Plesso
            </th>

            <th>
              Stato
            </th>

            <th></th>

          </tr>

        </thead>


        <tbody>

          ${
            list
              .map(student => `

                <tr>

                  <td>

                    <strong>

                      ${esc(
                        student.first_name
                      )}

                      ${esc(
                        student.last_name
                      )}

                    </strong>

                  </td>


                  <td>
                    ${esc(
                      student.class_name ||
                      "—"
                    )}
                  </td>


                  <td>
                    ${esc(
                      student.campus_name ||
                      "—"
                    )}
                  </td>


                  <td>

                    <span
                      class="status ${
                        statusClass(
                          student.verification_status ||
                          "Da verificare"
                        )
                      }"
                    >

                      ${esc(
                        student.verification_status ||
                        "Da verificare"
                      )}

                    </span>

                  </td>


                  <td>

                    <button
                      onclick="
                        openStaffStudent(
                          '${student.id}'
                        )
                      "
                    >
                      Apri
                    </button>

                  </td>

                </tr>

              `)
              .join("")
          }

        </tbody>

      </table>

    </div>

  `;
}


function filterStudents() {

  const term =
    document
      .getElementById(
        "studentSearch"
      )
      ?.value
      ?.trim()
      .toLowerCase() ||
    "";


  const filtered =
    state.students.filter(
      student => {

        const text = [

          student.first_name,

          student.last_name,

          student.class_name,

          student.campus_name,

          student.order_name

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        return text.includes(term);

      }
    );


  const container =
    document.getElementById(
      "studentsList"
    );


  if (container) {

    container.innerHTML =
      staffStudentRows(
        filtered
      );

  }
}


/* =========================================================
   SCHEDA DOCENTE
   ========================================================= */

function openStaffStudent(id) {

  const student =
    state.students.find(
      s => s.id === id
    );


  if (!student) {

    showMessage(
      "Alunno non trovato.",
      "error"
    );

    return;
  }


  state.selectedStudent =
    student;


  state.page =
    "staffStudent";


  render();
}


function staffStudentPage() {

  const s =
    state.selectedStudent;


  if (!s) {

    state.page =
      "students";

    return "";
  }


  const delegates =
    state.delegates.filter(
      d =>
        d.student_id === s.id
    );


  const exits =
    state.earlyExits.filter(
      e =>
        e.student_id === s.id
    );


  const meds =
    state.medications.filter(
      m =>
        m.student_id === s.id
    );


  return `

    <section class="page">


      <div class="page-head">

        <div>

          <button
            class="back"
            onclick="
              go('students')
            "
          >
            ← Torna agli alunni
          </button>


          <h1>

            ${esc(s.first_name)}
            ${esc(s.last_name)}

          </h1>


          <p>

            ${esc(
              s.class_name ||
              "Classe non indicata"
            )}

            ·

            ${esc(
              s.campus_name ||
              "Plesso non indicato"
            )}

          </p>

        </div>


        <button
          onclick="
            openVerification(
              '${s.id}'
            )
          "
        >
          Verifica questa scheda
        </button>

      </div>


      <div class="section-card">

        <h2>
          👤 Anagrafica
        </h2>


        <div class="detail-grid">


          <div>
            <strong>Nome</strong>
            <span>
              ${esc(s.first_name)}
            </span>
          </div>


          <div>
            <strong>Cognome</strong>
            <span>
              ${esc(s.last_name)}
            </span>
          </div>


          <div>
            <strong>Data di nascita</strong>
            <span>
              ${formatDate(s.dob)}
            </span>
          </div>


          <div>
            <strong>Anno scolastico</strong>
            <span>
              ${esc(
                s.school_year ||
                "—"
              )}
            </span>
          </div>


          <div>
            <strong>Ordine</strong>
            <span>
              ${esc(
                s.order_name ||
                "—"
              )}
            </span>
          </div>


          <div>
            <strong>Plesso</strong>
            <span>
              ${esc(
                s.campus_name ||
                "—"
              )}
            </span>
          </div>


          <div>
            <strong>Classe</strong>
            <span>
              ${esc(
                s.class_name ||
                "—"
              )}
            </span>
          </div>


        </div>

      </div>


      <div class="section-card">

        <h2>
          🟢 Informazioni operative
        </h2>


        <p>
          <strong>Mensa:</strong>
          ${esc(
            s.mensa ||
            "—"
          )}
        </p>


        <p>
          <strong>Pasto da casa:</strong>
          ${esc(
            s.home_meal ||
            "—"
          )}
        </p>


        <p>
          <strong>Trasporto:</strong>
          ${esc(
            s.transport ||
            "—"
          )}
        </p>

      </div>


      <div class="section-card warning-card">

        <h2>
          🟠 Allergie
        </h2>


        <p>
          <strong>
            Presenza:
          </strong>

          ${esc(
            s.allergy ||
            "No"
          )}
        </p>


        <p>
          <strong>
            Tipo:
          </strong>

          ${esc(
            s.allergy_type ||
            "—"
          )}
        </p>


        <p>
          <strong>
            Note operative:
          </strong>

          ${esc(
            s.allergy_notes ||
            "—"
          )}
        </p>

      </div>


      <div class="section-card">

        <h2>
          👥 Deleghe
        </h2>


        ${
          delegates.length
            ? delegates
                .map(delegateCard)
                .join("")
            : `
              <p>
                Nessuna delega presente.
              </p>
            `
        }

      </div>


      <div class="section-card">

        <h2>
          🚪 Uscite anticipate
        </h2>


        ${
          exits.length
            ? exits
                .map(earlyExitCard)
                .join("")
            : `
              <p>
                Nessuna uscita presente.
              </p>
            `
        }

      </div>


      <div class="section-card sensitive">

        <h2>
          🔴 Farmaci
        </h2>


        ${
          meds.length
            ? meds
                .map(medicationCard)
                .join("")
            : `
              <p>
                Nessun farmaco presente.
              </p>
            `
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
    [
      ...state.students
    ].sort(
      (a, b) =>
        (
          a.last_name ||
          ""
        ).localeCompare(
          b.last_name ||
          ""
        )
    );


  return `

    <section class="page">


      <div class="page-head">

        <div>

          <h1>
            Verifiche
          </h1>

          <p>
            Stato delle schede degli alunni.
          </p>

        </div>

      </div>


      <div class="table-card">

        <table>

          <thead>

            <tr>

              <th>
                Alunno
              </th>

              <th>
                Classe
              </th>

              <th>
                Stato
              </th>

              <th></th>

            </tr>

          </thead>


          <tbody>


            ${
              students.length

                ? students
                    .map(
                      student => `

                        <tr>

                          <td>

                            <strong>

                              ${esc(
                                student.first_name
                              )}

                              ${esc(
                                student.last_name
                              )}

                            </strong>

                          </td>


                          <td>
                            ${esc(
                              student.class_name ||
                              "—"
                            )}
                          </td>


                          <td>

                            <span
                              class="status ${
                                statusClass(
                                  student.verification_status ||
                                  "Da verificare"
                                )
                              }"
                            >

                              ${esc(
                                student.verification_status ||
                                "Da verificare"
                              )}

                            </span>

                          </td>


                          <td>

                            <button
                              onclick="
                                openVerification(
                                  '${student.id}'
                                )
                              "
                            >
                              Apri e verifica
                            </button>

                          </td>

                        </tr>

                      `
                    )
                    .join("")

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

  const student =
    state.students.find(
      s => s.id === id
    );


  if (!student) {

    showMessage(
      "Alunno non trovato.",
      "error"
    );

    return;
  }


  state.verificationStudent =
    student;


  state.page =
    "verificationDetail";


  render();
}


function verificationDetailPage() {

  const s =
    state.verificationStudent;


  if (!s) {

    state.page =
      "verifications";

    return "";
  }


  return `

    <section class="page">


      <div class="page-head">

        <div>

          <button
            class="back"
            onclick="
              go('verifications')
            "
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
              ${esc(
                s.class_name ||
                "—"
              )}
            </strong>
          </p>


          <p>
            Plesso:
            <strong>
              ${esc(
                s.campus_name ||
                "—"
              )}
            </strong>
          </p>


          <p>

            Stato:

            <span
              class="status ${
                statusClass(
                  s.verification_status ||
                  "Da verificare"
                )
              }"
            >

              ${esc(
                s.verification_status ||
                "Da verificare"
              )}

            </span>

          </p>


        </div>


        <form
          onsubmit="
            saveVerification(event)
          "
        >


          <label>

            Esito della verifica

            <select
              id="verificationStatus"
              required
            >

              ${selectOption(
                "Da verificare",
                s.verification_status ||
                "Da verificare"
              )}

              ${selectOption(
                "Approvato",
                s.verification_status
              )}

              ${selectOption(
                "Da integrare",
                s.verification_status
              )}

              ${selectOption(
                "Scaduto",
                s.verification_status
              )}

            </select>

          </label>


          <label>

            Note

            <textarea
              id="verificationNote"
              placeholder="Eventuali note..."
            >${esc(
              s.verification_note ||
              ""
            )}</textarea>

          </label>


          <div class="form-actions">


            <button
              type="button"
              class="secondary"
              onclick="
                go('verifications')
              "
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


  const s =
    state.verificationStudent;


  if (!s) return;


  const status =
    document
      .getElementById(
        "verificationStatus"
      )
      ?.value;


  const note =
    document
      .getElementById(
        "verificationNote"
      )
      ?.value
      ?.trim() ||
    null;


  const {
    error
  } =
    await supabase
      .from("students")
      .update({

        verification_status:
          status,

        verification_note:
          note,

        verified_at:
          status === "Da verificare"
            ? null
            : new Date().toISOString(),

        verified_by:
          status === "Da verificare"
            ? null
            : state.authUser.id

      })
      .eq(
        "id",
        s.id
      );


  if (error) {

    console.error(error);

    showMessage(
      "Errore durante il salvataggio.",
      "error"
    );

    return;
  }


  await syncStaffFromSupabase();


  state.verificationStudent =
    state.students.find(
      x => x.id === s.id
    );


  state.page =
    "verifications";


  render();


  showMessage(
    "Verifica salvata su Supabase."
  );
}


/* =========================================================
   STRUTTURA
   ========================================================= */

function structurePage() {

  return `

    <section class="page">

      <div class="page-head">

        <div>

          <h1>
            Struttura scolastica
          </h1>

          <p>
            Informazioni presenti
            nell'ambiente di test.
          </p>

        </div>

      </div>


      <div class="cards">


        <div class="card">

          <div class="card-icon">
            🏫
          </div>

          <h3>
            Ordini
          </h3>

          <p>
            ${state.orders.length}
            elementi
          </p>

        </div>


        <div class="card">

          <div class="card-icon">
            🏢
          </div>

          <h3>
            Plessi
          </h3>

          <p>
            ${state.campuses.length}
            elementi
          </p>

        </div>


        <div class="card">

          <div class="card-icon">
            📚
          </div>

          <h3>
            Classi
          </h3>

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
   HEADER
   ========================================================= */

function header() {

  if (!state.user) {
    return "";
  }


  return `

    <header class="topbar">


      <div class="brand">


        <img
          src="assets/logo_ic_anzio_i.jpeg"
          alt="I.C. Anzio I"
        />


        <div>

          <strong>
            I.C. Anzio I
          </strong>

          <small>
            Portale scolastico
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
            state.user.email ||
            "Utente"
          )}
        </strong>


        <button
          class="logout"
          onclick="
            doLogout()
          "
        >
          Esci
        </button>


      </div>


    </header>

  `;
}


/* =========================================================
   MENU
   ========================================================= */

function nav() {

  if (!state.user) {
    return "";
  }


  let links = `

    <button
      onclick="
        go('home')
      "
    >
      🏠 Home
    </button>

  `;


  if (
    state.role === "family"
  ) {

    links += `

      <button
        onclick="
          go('children')
        "
      >
        👨‍👩‍👧 I miei figli
      </button>

    `;

  }


  if (
    state.role === "teacher" ||
    state.role === "admin"
  ) {

    links += `

      <button
        onclick="
          go('students')
        "
      >
        👨‍🎓 Alunni
      </button>


      <button
        onclick="
          go('verifications')
        "
      >
        ✅ Verifiche
      </button>


      <button
        onclick="
          go('structure')
        "
      >
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


/* =========================================================
   LOGIN
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


        <h1>
          I.C. Anzio I
        </h1>


        <p class="login-subtitle">
          Portale scolastico
        </p>


        <form
          onsubmit="
            event.preventDefault();
            doLogin();
          "
        >


          <label>

            Email

            <input
              id="loginEmail"
              type="email"
              autocomplete="email"
              placeholder="Inserisci email"
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


        <div class="login-divider">
          oppure
        </div>


        <button
          class="register-main-button"
          onclick="
            go('register')
          "
        >
          📝 Crea un account
        </button>


        <button
          class="link-button"
          onclick="
            showForgotPassword()
          "
        >
          Hai dimenticato la password?
        </button>


      </div>


    </div>

  `;
}


/* =========================================================
   RECUPERO PASSWORD
   ========================================================= */

function showForgotPassword() {

  state.page =
    "forgotPassword";

  render();
}


function forgotPasswordPage() {

  return `

    <div class="login-page">


      <div class="login-card">


        <div class="login-logo">

          <img
            src="assets/logo_ic_anzio_i.jpeg"
            alt="I.C. Anzio I"
          />

        </div>


        <h1>
          Recupera password
        </h1>


        <p>
          Inserisci la tua email.
          Riceverai le istruzioni
          per reimpostare la password.
        </p>


        <form
          onsubmit="
            event.preventDefault();
            sendPasswordReset();
          "
        >


          <label>

            Email

            <input
              id="resetEmail"
              type="email"
              required
            />

          </label>


          <button
            type="submit"
          >
            Invia istruzioni
          </button>


        </form>


        <button
          class="secondary full-width"
          onclick="
            go('login')
          "
        >
          ← Torna all'accesso
        </button>


      </div>

    </div>

  `;
}


async function sendPasswordReset() {

  const email =
    document
      .getElementById(
        "resetEmail"
      )
      ?.value
      ?.trim()
      .toLowerCase();


  if (!email) {

    showMessage(
      "Inserisci l'email.",
      "error"
    );

    return;
  }


  const {
    error
  } =
    await supabase.auth
      .resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin
        }
      );


  if (error) {

    console.error(error);

    showMessage(
      "Errore nell'invio delle istruzioni.",
      "error"
    );

    return;
  }


  state.page =
    "login";


  render();


  setTimeout(() => {

    showMessage(
      "Controlla la tua email per reimpostare la password."
    );

  }, 100);
}


/* =========================================================
   APP PAGE
   ========================================================= */

function appPage() {

  switch (state.page) {

    case "home":
      return home();

    case "children":
      return childrenPage();

    case "addChild":
      return addChildPage();

    case "familyStudent":
      return familyStudentPage();

    case "editStudent":
      return editStudentPage();

    case "students":
      return studentsPage();

    case "staffStudent":
      return staffStudentPage();

    case "verifications":
      return verificationsPage();

    case "verificationDetail":
      return verificationDetailPage();

    case "structure":
      return structurePage();

    default:
      return home();

  }
}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

  const app =
    document.getElementById(
      "app"
    );


  if (!app) return;


  if (
    state.page === "login"
  ) {

    app.innerHTML =
      loginPage();

    return;
  }


  if (
    state.page === "register"
  ) {

    app.innerHTML =
      registrationPage();

    return;
  }


  if (
    state.page === "registerForm"
  ) {

    app.innerHTML =
      registrationFormPage();

    return;
  }


  if (
    state.page === "forgotPassword"
  ) {

    app.innerHTML =
      forgotPasswordPage();

    return;
  }


  if (
    state.page === "changePassword"
  ) {

    app.innerHTML =
      changePasswordPage();

    return;
  }


  if (!state.user) {

    state.page =
      "login";

    app.innerHTML =
      loginPage();

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

              <div
                class="
                  toast
                  ${state.message.type}
                "
              >
                ${esc(
                  state.message.text
                )}
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
   AVVIO
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    render();

    await restoreSession();

  }
);
