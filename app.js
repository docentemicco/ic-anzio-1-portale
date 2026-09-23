/* =========================================================
   I.C. ANZIO I
   PORTALE SCOLASTICO
   APP.JS - AUTH + FAMIGLIE + DOCENTI + VERIFICHE

   Supabase:
   https://vnpzhhpkymfxxajvvxtj.supabase.co

   CODICE DOCENTI:
   ANZIO-DOC-2026

   IMPORTANTE:
   Il codice docente NON viene usato per autorizzare
   direttamente il ruolo lato browser.
   La verifica viene effettuata dalla funzione Supabase:

   check_teacher_registration_code(p_code)
   ========================================================= */


/* =========================================================
   1. SUPABASE
   ========================================================= */

const SUPABASE_URL =
  "https://vnpzhhpkymfxxajvvxtj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_qIq-kTzwKFl7YWyWUyZVTA_v_AN386T";

const supabase =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   2. STATO APPLICAZIONE
   ========================================================= */

const state = {
  authUser: null,
  user: null,
  profile: null,

  page: "login",

  students: [],
  currentStudent: null,

  medications: [],
  delegates: [],
  earlyExits: [],

  verificationStatus: null,
  verificationNote: "",

  loading: false
};


/* =========================================================
   3. UTILITY
   ========================================================= */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function displayName(profile, authUser) {

  const fullName = [
    profile?.first_name,
    profile?.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;

  if (profile?.username) {
    return profile.username;
  }

  if (authUser?.email) {
    return authUser.email.split("@")[0];
  }

  return "Utente";
}


function setMessage(message, type = "info") {

  const box =
    document.getElementById("appMessage");

  if (!box) return;

  box.textContent = message;
  box.className =
    `app-message ${type}`;
}


function setAuthMessage(message, type = "error") {

  const box =
    document.getElementById("authMessage");

  if (!box) return;

  box.textContent = message;
  box.className =
    `auth-message ${type}`;
}


function clearAuthMessage() {

  const box =
    document.getElementById("authMessage");

  if (!box) return;

  box.textContent = "";
  box.className = "";
}


function loadingButton(button, loading, text) {

  if (!button) return;

  button.disabled = loading;

  if (loading) {
    button.dataset.originalText =
      button.textContent;

    button.textContent = "Attendere...";
  } else {
    button.textContent =
      text ||
      button.dataset.originalText ||
      "Conferma";
  }
}


/* =========================================================
   4. PROFILO UTENTE
   ========================================================= */

async function loadProfile(userId) {

  const { data, error } =
    await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

  if (error) {
    console.error(
      "Errore caricamento profilo:",
      error
    );

    throw error;
  }

  return data;
}


/* =========================================================
   5. SESSIONE
   ========================================================= */

async function restoreSession() {

  const {
    data: {
      session
    }
  } = await supabase.auth.getSession();

  if (!session?.user) {

    state.authUser = null;
    state.user = null;
    state.profile = null;
    state.page = "login";

    render();
    return;
  }

  state.authUser = session.user;

  const profile =
    await loadProfile(
      session.user.id
    );

  if (!profile) {

    state.profile = null;

    setMessage(
      "Profilo utente non ancora disponibile. Riprova tra qualche secondo.",
      "error"
    );

    return;
  }

  state.profile = profile;

  state.user = {
    ...profile,

    display:
      displayName(
        profile,
        session.user
      ),

    email:
      session.user.email
  };

  if (profile.must_change_password) {

    state.page = "change-password";

  } else {

    if (profile.role === "admin") {
      state.page = "admin";
    }

    else if (profile.role === "teacher") {
      state.page = "teacher";
    }

    else {
      state.page = "family";
    }
  }

  await syncCurrentArea();

  render();
}


/* =========================================================
   6. AUTH STATE CHANGE
   ========================================================= */

supabase.auth.onAuthStateChange(
  async (event, session) => {

    if (event === "SIGNED_OUT") {

      state.authUser = null;
      state.user = null;
      state.profile = null;
      state.page = "login";

      render();

      return;
    }

    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED"
    ) {

      if (!session?.user) return;

      state.authUser = session.user;

      try {

        const profile =
          await loadProfile(
            session.user.id
          );

        state.profile = profile;

        if (profile) {

          state.user = {
            ...profile,

            display:
              displayName(
                profile,
                session.user
              ),

            email:
              session.user.email
          };

        }

      } catch (error) {

        console.error(error);
      }
    }
  }
);


/* =========================================================
   7. LOGIN
   ========================================================= */

async function loginUser(
  email,
  password
) {

  email =
    email
      .trim()
      .toLowerCase();

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

    throw new Error(
      "Email o password non corretti."
    );
  }

  if (!data?.user) {

    throw new Error(
      "Accesso non riuscito."
    );
  }

  return data.user;
}


async function handleLogin(event) {

  event.preventDefault();

  clearAuthMessage();

  const email =
    document
      .getElementById("loginEmail")
      .value;

  const password =
    document
      .getElementById("loginPassword")
      .value;

  const button =
    event.submitter;

  try {

    loadingButton(
      button,
      true,
      "Accedi"
    );

    await loginUser(
      email,
      password
    );

    await restoreSession();

  } catch (error) {

    setAuthMessage(
      error.message ||
      "Errore durante l'accesso.",
      "error"
    );

  } finally {

    loadingButton(
      button,
      false,
      "Accedi"
    );
  }
}


/* =========================================================
   8. REGISTRAZIONE
   ========================================================= */

async function registerUser({
  firstName,
  lastName,
  email,
  password,
  role,
  teacherCode
}) {

  firstName =
    firstName.trim();

  lastName =
    lastName.trim();

  email =
    email
      .trim()
      .toLowerCase();

  if (
    !firstName ||
    !lastName ||
    !email ||
    !password
  ) {

    throw new Error(
      "Compila tutti i campi obbligatori."
    );
  }


  if (password.length < 8) {

    throw new Error(
      "La password deve contenere almeno 8 caratteri."
    );
  }


  if (
    role !== "family" &&
    role !== "teacher"
  ) {

    throw new Error(
      "Tipo di account non valido."
    );
  }


  /* -----------------------------------------
     DOCENTE
     ----------------------------------------- */

  if (role === "teacher") {

    if (!teacherCode?.trim()) {

      throw new Error(
        "Inserisci il codice di registrazione docenti."
      );
    }


    const {
      data: validCode,
      error: codeError
    } =
      await supabase.rpc(
        "check_teacher_registration_code",
        {
          p_code:
            teacherCode.trim()
        }
      );


    if (codeError) {

      console.error(
        codeError
      );

      throw new Error(
        "Impossibile verificare il codice docente."
      );
    }


    if (validCode !== true) {

      throw new Error(
        "Il codice di registrazione docenti non è corretto."
      );
    }
  }


  /* -----------------------------------------
     SUPABASE AUTH
     ----------------------------------------- */

  const {
    data,
    error
  } =
    await supabase.auth.signUp({

      email,

      password,

      options: {

        data: {

          first_name:
            firstName,

          last_name:
            lastName,

          requested_role:
            role,

          /*
           * Il trigger database verifica nuovamente
           * il codice docente.
           */

          teacher_code:
            role === "teacher"
              ? teacherCode.trim()
              : null
        }
      }
    });


  if (error) {

    console.error(error);

    throw new Error(
      error.message ||
      "Errore durante la registrazione."
    );
  }


  if (!data?.user) {

    throw new Error(
      "Registrazione non completata."
    );
  }


  return data;
}


async function handleRegistration(event) {

  event.preventDefault();

  clearAuthMessage();

  const firstName =
    document
      .getElementById(
        "registerFirstName"
      )
      .value;

  const lastName =
    document
      .getElementById(
        "registerLastName"
      )
      .value;

  const email =
    document
      .getElementById(
        "registerEmail"
      )
      .value;

  const password =
    document
      .getElementById(
        "registerPassword"
      )
      .value;

  const confirmPassword =
    document
      .getElementById(
        "registerPasswordConfirm"
      )
      .value;

  const privacy =
    document
      .getElementById(
        "registerPrivacy"
      )
      .checked;

  const role =
    document.querySelector(
      'input[name="registerRole"]:checked'
    )?.value;

  const teacherCode =
    document
      .getElementById(
        "teacherCode"
      )
      .value;

  const button =
    event.submitter;


  if (!privacy) {

    setAuthMessage(
      "Devi accettare l'informativa sulla privacy.",
      "error"
    );

    return;
  }


  if (
    password !==
    confirmPassword
  ) {

    setAuthMessage(
      "Le due password non coincidono.",
      "error"
    );

    return;
  }


  try {

    loadingButton(
      button,
      true,
      "Crea account"
    );


    const data =
      await registerUser({

        firstName,
        lastName,
        email,
        password,
        role,
        teacherCode

      });


    /*
     * Se Email Confirmation è attiva,
     * Supabase restituisce user ma non session.
     */

    if (!data.session) {

      setAuthMessage(
        "Registrazione completata. Controlla la tua email per completare l'attivazione dell'account.",
        "success"
      );

      document
        .getElementById(
          "registerForm"
        )
        .reset();

      toggleTeacherCode();

      return;
    }


    setAuthMessage(
      "Registrazione completata. Accesso in corso...",
      "success"
    );


    await restoreSession();


  } catch (error) {

    console.error(error);

    setAuthMessage(
      error.message ||
      "Errore durante la registrazione.",
      "error"
    );

  } finally {

    loadingButton(
      button,
      false,
      "Crea account"
    );
  }
}


/* =========================================================
   9. CAMBIO PASSWORD
   ========================================================= */

async function changePassword(
  event
) {

  event.preventDefault();

  const password =
    document
      .getElementById(
        "newPassword"
      )
      .value;

  const confirm =
    document
      .getElementById(
        "newPasswordConfirm"
      )
      .value;

  const message =
    document
      .getElementById(
        "passwordMessage"
      );


  if (password.length < 8) {

    message.textContent =
      "La password deve contenere almeno 8 caratteri.";

    return;
  }


  if (password !== confirm) {

    message.textContent =
      "Le password non coincidono.";

    return;
  }


  const {
    error
  } =
    await supabase.auth.updateUser({
      password
    });


  if (error) {

    message.textContent =
      error.message;

    return;
  }


  /*
   * Aggiorniamo anche il profilo.
   */

  const {
    error: profileError
  } =
    await supabase
      .from("user_profiles")
      .update({
        must_change_password:
          false,
        updated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        state.authUser.id
      );


  if (profileError) {

    console.error(
      profileError
    );

    message.textContent =
      "Password modificata, ma non è stato possibile aggiornare il profilo.";

    return;
  }


  state.profile.must_change_password =
    false;

  state.user.must_change_password =
    false;


  if (
    state.profile.role === "admin"
  ) {
    state.page = "admin";
  }

  else if (
    state.profile.role === "teacher"
  ) {
    state.page = "teacher";
  }

  else {
    state.page = "family";
  }


  await syncCurrentArea();

  render();
}


/* =========================================================
   10. LOGOUT
   ========================================================= */

async function doLogout() {

  await supabase.auth.signOut();

  state.authUser = null;
  state.user = null;
  state.profile = null;
  state.students = [];
  state.currentStudent = null;
  state.page = "login";

  render();
}


/* =========================================================
   11. NAVIGAZIONE AUTH
   ========================================================= */

function showLogin() {

  state.page = "login";

  render();

  setTimeout(() => {

    const input =
      document.getElementById(
        "loginEmail"
      );

    input?.focus();

  }, 50);
}


function showRegister() {

  state.page = "register";

  render();
}


function toggleTeacherCode() {

  const role =
    document.querySelector(
      'input[name="registerRole"]:checked'
    )?.value;

  const container =
    document.getElementById(
      "teacherCodeContainer"
    );

  const input =
    document.getElementById(
      "teacherCode"
    );

  if (!container || !input) {
    return;
  }


  if (role === "teacher") {

    container.style.display =
      "";

    input.required =
      true;

  } else {

    container.style.display =
      "none";

    input.required =
      false;

    input.value =
      "";
  }
}


/* =========================================================
   12. SUPABASE - FAMIGLIA
   ========================================================= */

async function syncFamilyStudents() {

  if (
    !state.authUser ||
    state.profile?.role !== "family"
  ) {
    return;
  }


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

    console.error(
      error
    );

    throw error;
  }


  state.students =
    data || [];
}


/* =========================================================
   13. SUPABASE - DOCENTI
   ========================================================= */

async function syncTeacherStudents() {

  if (
    !state.authUser ||
    !["teacher", "admin"]
      .includes(
        state.profile?.role
      )
  ) {
    return;
  }


  const {
    data,
    error
  } =
    await supabase
      .from("students")
      .select("*")
      .order(
        "last_name",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      error
    );

    throw error;
  }


  state.students =
    data || [];
}


/* =========================================================
   14. SYNC AREA
   ========================================================= */

async function syncCurrentArea() {

  if (
    !state.profile
  ) {
    return;
  }


  if (
    state.profile.role === "family"
  ) {

    await syncFamilyStudents();

  }

  else if (
    state.profile.role === "teacher" ||
    state.profile.role === "admin"
  ) {

    await syncTeacherStudents();
  }
}


/* =========================================================
   15. PAGINA LOGIN
   ========================================================= */

function renderLogin() {

  return `

    <div class="auth-page">

      <div class="auth-card">

        <div class="logo-area">

          <img
            src="assets/logo_ic_anzio_i.jpeg"
            class="school-logo"
            alt="I.C. Anzio I">

        </div>


        <h1>
          I.C. Anzio I
        </h1>

        <p class="auth-subtitle">
          Portale scolastico
        </p>


        <form
          id="loginForm"
          onsubmit="handleLogin(event)"
        >

          <label>
            Email
          </label>

          <input
            id="loginEmail"
            type="email"
            autocomplete="email"
            required
          >


          <label>
            Password
          </label>

          <input
            id="loginPassword"
            type="password"
            autocomplete="current-password"
            required
          >


          <button
            type="submit"
            class="primary-button"
          >
            Accedi
          </button>


          <button
            type="button"
            class="link-button"
            onclick="showRegister()"
          >
            Non hai ancora un account?
            Registrati
          </button>

        </form>


        <div
          id="authMessage"
          class="auth-message"
        ></div>

      </div>

    </div>
  `;
}


/* =========================================================
   16. PAGINA REGISTRAZIONE
   ========================================================= */

function renderRegister() {

  return `

    <div class="auth-page">

      <div class="auth-card">

        <div class="logo-area">

          <img
            src="assets/logo_ic_anzio_i.jpeg"
            class="school-logo"
            alt="I.C. Anzio I">

        </div>


        <h1>
          Crea il tuo account
        </h1>


        <div class="role-selector">

          <label>

            <input
              type="radio"
              name="registerRole"
              value="family"
              checked
              onchange="toggleTeacherCode()"
            >

            👨‍👩‍👧 Famiglia

          </label>


          <label>

            <input
              type="radio"
              name="registerRole"
              value="teacher"
              onchange="toggleTeacherCode()"
            >

            👩‍🏫 Docente

          </label>

        </div>


        <form
          id="registerForm"
          onsubmit="handleRegistration(event)"
        >

          <label>
            Nome
          </label>

          <input
            id="registerFirstName"
            type="text"
            autocomplete="given-name"
            required
          >


          <label>
            Cognome
          </label>

          <input
            id="registerLastName"
            type="text"
            autocomplete="family-name"
            required
          >


          <label>
            Email
          </label>

          <input
            id="registerEmail"
            type="email"
            autocomplete="email"
            required
          >


          <label>
            Password
          </label>

          <input
            id="registerPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
          >


          <label>
            Conferma password
          </label>

          <input
            id="registerPasswordConfirm"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
          >


          <div
            id="teacherCodeContainer"
            style="display:none"
          >

            <label>
              Codice di registrazione docenti
            </label>

            <input
              id="teacherCode"
              type="password"
              autocomplete="off"
              placeholder="Inserisci il codice"
            >

            <small>
              Il codice è riservato al personale docente.
            </small>

          </div>


          <label class="privacy-row">

            <input
              id="registerPrivacy"
              type="checkbox"
              required
            >

            <span>
              Dichiaro di aver letto
              l'informativa sulla privacy.
            </span>

          </label>


          <button
            type="submit"
            class="primary-button"
          >
            Crea account
          </button>


          <button
            type="button"
            class="link-button"
            onclick="showLogin()"
          >
            Hai già un account? Accedi
          </button>

        </form>


        <div
          id="authMessage"
          class="auth-message"
        ></div>

      </div>

    </div>
  `;
}


/* =========================================================
   17. CAMBIO PASSWORD
   ========================================================= */

function renderChangePassword() {

  return `

    <div class="auth-page">

      <div class="auth-card">

        <img
          src="assets/logo_ic_anzio_i.jpeg"
          class="school-logo"
          alt="I.C. Anzio I">

        <h1>
          Imposta la nuova password
        </h1>

        <p>
          Per continuare è necessario
          impostare una nuova password.
        </p>


        <form
          onsubmit="changePassword(event)"
        >

          <label>
            Nuova password
          </label>

          <input
            id="newPassword"
            type="password"
            minlength="8"
            required
          >


          <label>
            Conferma password
          </label>

          <input
            id="newPasswordConfirm"
            type="password"
            minlength="8"
            required
          >


          <button
            type="submit"
            class="primary-button"
          >
            Salva nuova password
          </button>

        </form>


        <div
          id="passwordMessage"
          class="auth-message"
        ></div>

      </div>

    </div>
  `;
}


/* =========================================================
   18. HEADER
   ========================================================= */

function renderHeader(title) {

  return `

    <header class="main-header">

      <div class="header-left">

        <img
          src="assets/logo_ic_anzio_i.jpeg"
          class="header-logo"
          alt="I.C. Anzio I">

        <div>

          <strong>
            I.C. Anzio I
          </strong>

          <span>
            ${escapeHtml(title)}
          </span>

        </div>

      </div>


      <div class="header-right">

        <span>
          ${escapeHtml(
            state.user?.display ||
            ""
          )}
        </span>

        <button
          type="button"
          onclick="doLogout()"
        >
          Esci
        </button>

      </div>

    </header>
  `;
}


/* =========================================================
   19. AREA FAMIGLIA
   ========================================================= */

function renderFamily() {

  const students =
    state.students || [];


  return `

    ${renderHeader("Area Famiglie")}


    <main class="page-container">

      <div class="page-title-row">

        <div>

          <h1>
            Area Famiglie
          </h1>

          <p>
            Gestisci i dati dei tuoi figli
            e le relative autorizzazioni.
          </p>

        </div>


        <button
          class="primary-button"
          onclick="newStudent()"
        >
          + Aggiungi figlio
        </button>

      </div>


      ${
        students.length === 0

          ? `

            <div class="empty-card">

              <h2>
                Nessun figlio inserito
              </h2>

              <p>
                Inserisci il primo figlio
                per iniziare.
              </p>

            </div>

          `

          :

          `

            <div class="student-grid">

              ${
                students
                  .map(student =>
                    renderStudentCard(
                      student,
                      true
                    )
                  )
                  .join("")
              }

            </div>

          `
      }

    </main>
  `;
}


/* =========================================================
   20. CARD STUDENTE
   ========================================================= */

function renderStudentCard(
  student,
  editable
) {

  return `

    <div
      class="student-card"
      onclick="openStudent('${student.id}')"
    >

      <div class="student-card-icon">
        👨‍🎓
      </div>

      <div class="student-card-content">

        <h3>
          ${escapeHtml(
            student.first_name
          )}
          ${escapeHtml(
            student.last_name
          )}
        </h3>


        <p>
          ${escapeHtml(
            student.school_year ||
            "Anno scolastico non indicato"
          )}
        </p>


        ${
          student.verification_status

            ? `

              <span
                class="status-badge"
              >
                ${escapeHtml(
                  student.verification_status
                )}
              </span>

            `

            : ""
        }

      </div>


      ${
        editable

          ? `

            <button
              type="button"
              onclick="event.stopPropagation(); editStudent('${student.id}')"
            >
              Modifica
            </button>

          `

          : ""
      }

    </div>
  `;
}


/* =========================================================
   21. AREA DOCENTI
   ========================================================= */

function renderTeacher() {

  const students =
    state.students || [];


  return `

    ${renderHeader("Area Docenti")}


    <main class="page-container">

      <h1>
        Area Docenti
      </h1>

      <p>
        Elenco degli alunni e verifiche
        delle schede.
      </p>


      <div class="teacher-menu">

        <button
          onclick="showTeacherStudents()"
        >
          👨‍🎓 Alunni
        </button>


        <button
          onclick="showVerifications()"
        >
          ✅ Verifiche
        </button>


        <button
          onclick="showStructure()"
        >
          🏫 Struttura
        </button>

      </div>


      <section>

        <h2>
          Alunni
        </h2>


        ${
          students.length === 0

            ? `

              <div class="empty-card">
                Nessun alunno presente.
              </div>

            `

            :

            `

              <div class="student-list">

                ${
                  students
                    .map(student => `

                      <div
                        class="student-row"
                      >

                        <div>

                          <strong>
                            ${escapeHtml(
                              student.first_name
                            )}
                            ${escapeHtml(
                              student.last_name
                            )}
                          </strong>

                          <small>
                            ${escapeHtml(
                              student.school_year ||
                              ""
                            )}
                          </small>

                        </div>


                        <button
                          onclick="openStudent('${student.id}')"
                        >
                          Apri
                        </button>

                      </div>

                    `)
                    .join("")
                }

              </div>

            `
        }

      </section>

    </main>
  `;
}


/* =========================================================
   22. APRI STUDENTE
   ========================================================= */

async function openStudent(
  studentId
) {

  const student =
    state.students.find(
      s => String(s.id) === String(studentId)
    );


  if (!student) {

    setMessage(
      "Alunno non trovato.",
      "error"
    );

    return;
  }


  state.currentStudent =
    student;


  /*
   * Carichiamo dati collegati.
   */

  await loadStudentRelatedData(
    student.id
  );


  state.page =
    "student-detail";


  render();
}


/* =========================================================
   23. DATI COLLEGATI STUDENTE
   ========================================================= */

async function loadStudentRelatedData(
  studentId
) {

  state.medications = [];
  state.delegates = [];
  state.earlyExits = [];


  const [
    medications,
    delegates,
    earlyExits
  ] =
    await Promise.all([

      supabase
        .from("student_medications")
        .select("*")
        .eq(
          "student_id",
          studentId
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        ),

      supabase
        .from("student_delegates")
        .select("*")
        .eq(
          "student_id",
          studentId
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        ),

      supabase
        .from("early_exits")
        .select("*")
        .eq(
          "student_id",
          studentId
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        )
    ]);


  if (!medications.error) {
    state.medications =
      medications.data || [];
  }


  if (!delegates.error) {
    state.delegates =
      delegates.data || [];
  }


  if (!earlyExits.error) {
    state.earlyExits =
      earlyExits.data || [];
  }
}


/* =========================================================
   24. DETTAGLIO STUDENTE
   ========================================================= */

function renderStudentDetail() {

  const s =
    state.currentStudent;


  if (!s) {

    state.page =
      state.profile?.role === "family"
        ? "family"
        : "teacher";

    return "";
  }


  return `

    ${renderHeader(
      "Scheda alunno"
    )}


    <main class="page-container">

      <button
        class="back-button"
        onclick="goBackFromStudent()"
      >
        ← Indietro
      </button>


      <div class="student-detail-header">

        <div>

          <h1>

            ${escapeHtml(
              s.first_name
            )}

            ${escapeHtml(
              s.last_name
            )}

          </h1>

          <p>
            Anno scolastico:
            ${escapeHtml(
              s.school_year || "-"
            )}
          </p>

        </div>


        ${
          state.profile?.role === "family"

            ? `

              <button
                class="primary-button"
                onclick="editStudent('${s.id}')"
              >
                Modifica scheda
              </button>

            `

            : `

              <button
                class="secondary-button"
                onclick="verifyStudent('${s.id}')"
              >
                Verifica questa scheda
              </button>

            `
        }

      </div>


      <section class="detail-section">

        <h2>
          👤 Anagrafica
        </h2>

        <div class="detail-grid">

          ${detailItem(
            "Nome",
            s.first_name
          )}

          ${detailItem(
            "Cognome",
            s.last_name
          )}

          ${detailItem(
            "Classe",
            s.class_name
          )}

          ${detailItem(
            "Plesso",
            s.campus_name
          )}

          ${detailItem(
            "Ordine",
            s.school_order
          )}

          ${detailItem(
            "Anno scolastico",
            s.school_year
          )}

        </div>

      </section>


      <section class="detail-section">

        <h2>
          ⚠️ Allergie e informazioni importanti
        </h2>

        ${
          s.allergies

            ? `

              <div class="alert-box">
                ${escapeHtml(
                  s.allergies
                )}
              </div>

            `

            :

            `<p>
              Nessuna informazione inserita.
            </p>`
        }

      </section>


      <section class="detail-section">

        <h2>
          👥 Deleghe per l'uscita
        </h2>


        ${
          state.delegates.length === 0

            ? `<p>
                Nessuna delega inserita.
              </p>`

            :

            `

              <div class="simple-list">

                ${
                  state.delegates
                    .map(d => `

                      <div class="simple-row">

                        <strong>
                          ${escapeHtml(
                            d.full_name ||
                            d.name ||
                            ""
                          )}
                        </strong>

                        <span>
                          ${escapeHtml(
                            d.relationship ||
                            ""
                          )}
                        </span>

                      </div>

                    `)
                    .join("")
                }

              </div>

            `
        }

      </section>


      <section class="detail-section">

        <h2>
          🚪 Uscite anticipate
        </h2>


        ${
          state.earlyExits.length === 0

            ? `<p>
                Nessuna uscita anticipata inserita.
              </p>`

            :

            `

              <div class="simple-list">

                ${
                  state.earlyExits
                    .map(e => `

                      <div class="simple-row">

                        <strong>
                          ${escapeHtml(
                            e.date ||
                            ""
                          )}
                        </strong>

                        <span>
                          ${escapeHtml(
                            e.time ||
                            ""
                          )}
                        </span>

                      </div>

                    `)
                    .join("")
                }

              </div>

            `
        }

      </section>


      <section class="detail-section">

        <h2>
          💊 Farmaci
        </h2>


        ${
          state.medications.length === 0

            ? `<p>
                Nessun farmaco inserito.
              </p>`

            :

            `

              <div class="simple-list">

                ${
                  state.medications
                    .map(m => `

                      <div class="medication-card">

                        <strong>
                          ${escapeHtml(
                            m.medication_name ||
                            m.name ||
                            ""
                          )}
                        </strong>

                        <span>
                          Dose:
                          ${escapeHtml(
                            m.dose ||
                            "-"
                          )}
                        </span>

                        <span>
                          Quando:
                          ${escapeHtml(
                            m.schedule ||
                            m.when_to_take ||
                            "-"
                          )}
                        </span>

                        <span>
                          Modalità:
                          ${escapeHtml(
                            m.method ||
                            "-"
                          )}
                        </span>

                      </div>

                    `)
                    .join("")
                }

              </div>

            `
        }

      </section>

    </main>
  `;
}


function detailItem(
  label,
  value
) {

  return `

    <div class="detail-item">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          value || "-"
        )}
      </strong>

    </div>
  `;
}


/* =========================================================
   25. MODIFICA STUDENTE
   ========================================================= */

function editStudent(
  studentId
) {

  const student =
    state.students.find(
      s =>
        String(s.id) ===
        String(studentId)
    );


  if (!student) return;


  state.currentStudent =
    student;

  state.page =
    "edit-student";

  render();
}


/* =========================================================
   26. NUOVO STUDENTE
   ========================================================= */

function newStudent() {

  state.currentStudent = {
    first_name: "",
    last_name: "",
    school_year: "2026/2027",
    class_name: "",
    campus_name: "",
    school_order: "Primaria",
    allergies: ""
  };

  state.page =
    "edit-student";

  render();
}


/* =========================================================
   27. FORM STUDENTE
   ========================================================= */

function renderEditStudent() {

  const s =
    state.currentStudent || {};


  return `

    ${renderHeader(
      "Scheda alunno"
    )}


    <main class="page-container">

      <button
        class="back-button"
        onclick="goBackFromStudent()"
      >
        ← Indietro
      </button>


      <h1>
        ${s.id
          ? "Modifica scheda alunno"
          : "Inserisci nuovo alunno"}
      </h1>


      <form
        onsubmit="saveStudent(event)"
        class="student-form"
      >

        <label>
          Nome
        </label>

        <input
          id="studentFirstName"
          value="${escapeHtml(
            s.first_name || ""
          )}"
          required
        >


        <label>
          Cognome
        </label>

        <input
          id="studentLastName"
          value="${escapeHtml(
            s.last_name || ""
          )}"
          required
        >


        <label>
          Ordine
        </label>

        <select
          id="studentSchoolOrder"
        >

          <option
            value="Infanzia"
            ${s.school_order === "Infanzia"
              ? "selected"
              : ""}
          >
            Infanzia
          </option>

          <option
            value="Primaria"
            ${s.school_order === "Primaria"
              ? "selected"
              : ""}
          >
            Primaria
          </option>

          <option
            value="Secondaria"
            ${s.school_order === "Secondaria"
              ? "selected"
              : ""}
          >
            Secondaria di I grado
          </option>

        </select>


        <label>
          Plesso
        </label>

        <input
          id="studentCampus"
          value="${escapeHtml(
            s.campus_name || ""
          )}"
        >


        <label>
          Classe
        </label>

        <input
          id="studentClass"
          value="${escapeHtml(
            s.class_name || ""
          )}"
        >


        <label>
          Anno scolastico
        </label>

        <input
          id="studentSchoolYear"
          value="${escapeHtml(
            s.school_year ||
            "2026/2027"
          )}"
        >


        <label>
          Allergie / informazioni importanti
        </label>

        <textarea
          id="studentAllergies"
        >${escapeHtml(
          s.allergies || ""
        )}</textarea>


        <button
          type="submit"
          class="primary-button"
        >
          Salva scheda
        </button>

      </form>

    </main>
  `;
}


/* =========================================================
   28. SALVA STUDENTE
   ========================================================= */

async function saveStudent(
  event
) {

  event.preventDefault();


  const payload = {

    first_name:
      document
        .getElementById(
          "studentFirstName"
        )
        .value
        .trim(),

    last_name:
      document
        .getElementById(
          "studentLastName"
        )
        .value
        .trim(),

    school_order:
      document
        .getElementById(
          "studentSchoolOrder"
        )
        .value,

    campus_name:
      document
        .getElementById(
          "studentCampus"
        )
        .value
        .trim(),

    class_name:
      document
        .getElementById(
          "studentClass"
        )
        .value
        .trim(),

    school_year:
      document
        .getElementById(
          "studentSchoolYear"
        )
        .value
        .trim(),

    allergies:
      document
        .getElementById(
          "studentAllergies"
        )
        .value
        .trim()
  };


  let result;


  if (
    state.currentStudent?.id
  ) {

    result =
      await supabase
        .from("students")
        .update(payload)
        .eq(
          "id",
          state.currentStudent.id
        )
        .select()
        .single();

  } else {

    payload.family_user_id =
      state.authUser.id;

    payload.family_submitted =
      true;

    payload.verification_status =
      "Da verificare";


    result =
      await supabase
        .from("students")
        .insert(payload)
        .select()
        .single();
  }


  if (result.error) {

    console.error(
      result.error
    );

    setMessage(
      result.error.message,
      "error"
    );

    return;
  }


  await syncCurrentArea();


  state.currentStudent =
    result.data;


  state.page =
    "student-detail";


  await loadStudentRelatedData(
    result.data.id
  );


  render();
}


/* =========================================================
   29. VERIFICA
   ========================================================= */

async function verifyStudent(
  studentId
) {

  const student =
    state.students.find(
      s =>
        String(s.id) ===
        String(studentId)
    );


  if (!student) return;


  state.currentStudent =
    student;


  state.verificationStatus =
    student.verification_status ||
    "Da verificare";

  state.verificationNote =
    student.verification_note ||
    "";


  state.page =
    "verification-detail";


  render();
}


/* =========================================================
   30. PAGINA VERIFICA
   ========================================================= */

function renderVerificationDetail() {

  const s =
    state.currentStudent;


  return `

    ${renderHeader(
      "Verifica scheda"
    )}


    <main class="page-container">

      <button
        class="back-button"
        onclick="openStudent('${s.id}')"
      >
        ← Indietro
      </button>


      <h1>
        Verifica scheda
      </h1>


      <h2>
        ${escapeHtml(
          s.first_name
        )}
        ${escapeHtml(
          s.last_name
        )}
      </h2>


      <label>
        Stato
      </label>

      <select
        id="verificationStatus"
      >

        <option
          value="Da verificare"
          ${
            state.verificationStatus ===
            "Da verificare"
              ? "selected"
              : ""
          }
        >
          Da verificare
        </option>


        <option
          value="Approvato"
          ${
            state.verificationStatus ===
            "Approvato"
              ? "selected"
              : ""
          }
        >
          Approvato
        </option>


        <option
          value="Da integrare"
          ${
            state.verificationStatus ===
            "Da integrare"
              ? "selected"
              : ""
          }
        >
          Da integrare
        </option>


        <option
          value="Scaduto"
          ${
            state.verificationStatus ===
            "Scaduto"
              ? "selected"
              : ""
          }
        >
          Scaduto
        </option>

      </select>


      <label>
        Nota
      </label>

      <textarea
        id="verificationNote"
        rows="6"
      >${escapeHtml(
        state.verificationNote
      )}</textarea>


      <button
        class="primary-button"
        onclick="saveVerification()"
      >
        Salva verifica
      </button>

    </main>
  `;
}


/* =========================================================
   31. SALVA VERIFICA
   ========================================================= */

async function saveVerification() {

  const status =
    document
      .getElementById(
        "verificationStatus"
      )
      .value;

  const note =
    document
      .getElementById(
        "verificationNote"
      )
      .value
      .trim();


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

        updated_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        state.currentStudent.id
      );


  if (error) {

    console.error(
      error
    );

    setMessage(
      error.message,
      "error"
    );

    return;
  }


  /*
   * Aggiorna anche il record locale.
   */

  const local =
    state.students.find(
      s =>
        String(s.id) ===
        String(
          state.currentStudent.id
        )
    );


  if (local) {

    local.verification_status =
      status;

    local.verification_note =
      note;
  }


  state.currentStudent.verification_status =
    status;

  state.currentStudent.verification_note =
    note;


  setMessage(
    "Verifica salvata su Supabase.",
    "success"
  );


  state.page =
    "verification-list";


  render();
}


/* =========================================================
   32. ELENCO VERIFICHE
   ========================================================= */

function showVerifications() {

  state.page =
    "verification-list";

  render();
}


function renderVerificationList() {

  const students =
    state.students || [];


  return `

    ${renderHeader(
      "Verifiche"
    )}


    <main class="page-container">

      <h1>
        Verifiche schede alunni
      </h1>


      <div class="verification-list">

        ${
          students.length === 0

            ? `<div class="empty-card">
                Nessun alunno.
              </div>`

            :

            students
              .map(s => `

                <div
                  class="verification-row"
                >

                  <div>

                    <strong>

                      ${escapeHtml(
                        s.first_name
                      )}

                      ${escapeHtml(
                        s.last_name
                      )}

                    </strong>

                    <span>
                      ${escapeHtml(
                        s.verification_status ||
                        "Da verificare"
                      )}
                    </span>

                  </div>


                  <button
                    onclick="verifyStudent('${s.id}')"
                  >
                    Apri
                  </button>

                </div>

              `)
              .join("")
        }

      </div>

    </main>
  `;
}


/* =========================================================
   33. STRUTTURA
   ========================================================= */

function showStructure() {

  state.page =
    "structure";

  render();
}


function renderStructure() {

  return `

    ${renderHeader(
      "Struttura scolastica"
    )}


    <main class="page-container">

      <h1>
        I.C. Anzio I
      </h1>


      <div class="structure-tree">

        <div>
          🏫
          <strong>
            I.C. Anzio I
          </strong>
        </div>


        <div>
          └── 👶 Infanzia
        </div>

        <div>
          └── 📚 Primaria
        </div>

        <div>
          └── 🎓 Secondaria di I grado
        </div>


        <hr>


        <div>
          📍 Plesso Centrale
        </div>

        <div>
          📍 Succursale
        </div>

        <div>
          📍 Quartiere Europa
        </div>

        <div>
          📍 Saragat
        </div>

      </div>

    </main>
  `;
}


/* =========================================================
   34. NAVIGAZIONE STUDENTE
   ========================================================= */

function goBackFromStudent() {

  if (
    state.profile?.role ===
    "family"
  ) {

    state.page =
      "family";

  } else {

    state.page =
      "teacher";
  }


  render();
}


function showTeacherStudents() {

  state.page =
    "teacher";

  render();
}


/* =========================================================
   35. ADMIN
   ========================================================= */

function renderAdmin() {

  return `

    ${renderHeader(
      "Amministrazione"
    )}


    <main class="page-container">

      <h1>
        👑 Area Amministrazione
      </h1>


      <div class="admin-grid">

        <div class="admin-card">
          👩‍🏫
          <strong>
            Docenti
          </strong>
        </div>


        <div class="admin-card">
          👨‍👩‍👧
          <strong>
            Famiglie
          </strong>
        </div>


        <div class="admin-card">
          👨‍🎓
          <strong>
            Alunni
          </strong>
        </div>


        <div class="admin-card">
          🏫
          <strong>
            Struttura
          </strong>
        </div>


        <div class="admin-card">
          📄
          <strong>
            Documenti
          </strong>
        </div>


        <div class="admin-card">
          🔐
          <strong>
            Permessi
          </strong>
        </div>

      </div>

    </main>
  `;
}


/* =========================================================
   36. RENDER PRINCIPALE
   ========================================================= */

function render() {

  const app =
    document.getElementById(
      "app"
    );

  if (!app) return;


  switch (state.page) {

    case "login":

      app.innerHTML =
        renderLogin();

      break;


    case "register":

      app.innerHTML =
        renderRegister();

      setTimeout(
        toggleTeacherCode,
        0
      );

      break;


    case "change-password":

      app.innerHTML =
        renderChangePassword();

      break;


    case "family":

      app.innerHTML =
        renderFamily();

      break;


    case "teacher":

      app.innerHTML =
        renderTeacher();

      break;


    case "admin":

      app.innerHTML =
        renderAdmin();

      break;


    case "student-detail":

      app.innerHTML =
        renderStudentDetail();

      break;


    case "edit-student":

      app.innerHTML =
        renderEditStudent();

      break;


    case "verification-detail":

      app.innerHTML =
        renderVerificationDetail();

      break;


    case "verification-list":

      app.innerHTML =
        renderVerificationList();

      break;


    case "structure":

      app.innerHTML =
        renderStructure();

      break;


    default:

      state.page =
        "login";

      app.innerHTML =
        renderLogin();
  }
}


/* =========================================================
   37. AVVIO
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    render();

    try {

      await restoreSession();

    } catch (error) {

      console.error(
        "Errore inizializzazione:",
        error
      );

      state.page =
        "login";

      render();
    }
  }
);
