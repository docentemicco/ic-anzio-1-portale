const KEY="anzio1_test_v11";
const DEFAULT_PASSWORD="Anzio2026";
let db=JSON.parse(localStorage.getItem(KEY)||'{"students":[],"documents":[],"users":[]}');
let state={role:null,page:"home",student:null,user:null};
function ensureDemoUsers(){
  if(!Array.isArray(db.users)) db.users=[];
  const demo=[
    {username:"admin",display:"Amministratore",role:"admin"},
    {username:"mario.rossi",display:"Mario Rossi",role:"teacher"},
    {username:"anna.bianchi",display:"Anna Bianchi",role:"teacher"},
    {username:"luca.rossi",display:"Luca Rossi",role:"family",children:[]},
    {username:"giulia.verdi",display:"Giulia Verdi",role:"family",children:[]}
  ];
  demo.forEach(d=>{
    let u=db.users.find(x=>x.username===d.username);
    if(!u){
      u={...d,password:DEFAULT_PASSWORD,mustChange:true};
      db.users.push(u);
    }else{
      u.role=d.role; u.display=d.display;
      if(d.role==="family" && !Array.isArray(u.children))u.children=[];
      if(!u.password){u.password=DEFAULT_PASSWORD;u.mustChange=true;}
    }
  });
  db.users.forEach(u=>{if(u.role==="family"&&!Array.isArray(u.children))u.children=[];});
  save();
}
// ensureDemoUsers(); // v24: users are managed by Supabase Auth
const orders=["Infanzia","Primaria","Secondaria di I grado"],campuses=["Plesso Centrale","Succursale","Quartiere Europa","Saragat"];
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function header(){return `<div class="top"><div class="brand"><div class="logo"><img src="assets/logo_ic_anzio_i.jpeg"></div><div><b>Istituto Comprensivo Anzio I</b><br><small>Ambiente di test operativo · V39</small></div></div>${state.role?`<div style="display:flex;align-items:center;gap:10px"><span class="muted">${state.user?.display||""}</span><button class="btn" onclick="go('password')">🔐 Password</button><button class="btn" onclick="logout()">Esci</button></div>`:''}</div>`}
function render(){
  if(!state.role){app.innerHTML=header()+login();return}
  if(state.user?.must_change_password && state.page!=="password") state.page="password";
  app.innerHTML=header()+`<div class="container"><div class="layout">${side()}<main>${page()}</main></div></div><div class="footer">TEST — autenticazione Supabase. La migrazione completa di tutti i dati da localStorage a Supabase è ancora in corso.</div>`;
}
function login(){
 return `<div class="login">
 <h2>Accesso al portale</h2>
 <p class="muted">Scegli l'area di accesso e inserisci le credenziali fornite dalla scuola.</p>
 <div class="choices">
   <button class="choice" onclick="showLogin('teacher')">
     <b>👩‍🏫 AREA DOCENTI</b>
     <span class="muted">Accesso a classi, alunni, documenti e informazioni operative.</span>
   </button>
   <button class="choice" onclick="showLogin('family')">
     <b>👨‍👩‍👧 AREA FAMIGLIE</b>
     <span class="muted">Accesso ai propri figli e alla documentazione della famiglia.</span>
   </button>
 </div>
 <div id="loginBox" style="margin-top:18px"></div>
 <div class="section" style="margin-top:18px">
   <b>Credenziali demo</b><br>
   Amministratore: <code>admin</code><br>
   Docenti: <code>mario.rossi</code> · <code>anna.bianchi</code><br>
   Famiglie: <code>luca.rossi</code> · <code>giulia.verdi</code><br>
   Password iniziale: <code>${DEFAULT_PASSWORD}</code>
 </div>
 </div>`;
}
function showLogin(area){
 const box=document.querySelector("#loginBox");
 const isFamily=area==="family";
 box.innerHTML=`<div class="card">
   <h3>${isFamily?"👨‍👩‍👧 Accesso Famiglie":"👩‍🏫 Accesso Docenti"}</h3>
   <form onsubmit="doLogin(event,'${area}')">
    <div class="field"><label>${isFamily?"Nome utente del figlio":"Nome utente del docente"}</label><input id="loginUser" placeholder="${isFamily?"es. luca.rossi":"es. mario.rossi"}" required></div>
    <div class="field"><label>Password</label><input id="loginPass" type="password" required></div>
    <br><button class="btn primary">Accedi all'area ${isFamily?"Famiglie":"Docenti"}</button>
   </form>
   <p id="loginMsg" class="danger" style="display:none;margin-top:12px"></p>
 </div>`;
 document.querySelector("#loginUser").focus();
}

async function syncFamilyFromSupabase(){
 const client=window.supabaseClient;
 if(!client || state.role!=="family" || !state.authUser)return;
 const {data:rows,error}=await client.from("students")
   .select("*")
   .eq("family_user_id",state.authUser.id)
   .order("created_at",{ascending:true});
 if(error){console.error("Supabase students:",error);return;}
 const ids=(rows||[]).map(r=>r.id);
 const [delRes,earlyRes,medRes]=await Promise.all([
   ids.length?client.from("student_delegates").select("*").in("student_id",ids):Promise.resolve({data:[],error:null}),
   ids.length?client.from("early_exits").select("*").in("student_id",ids):Promise.resolve({data:[],error:null}),
   ids.length?client.from("student_medications").select("*").in("student_id",ids):Promise.resolve({data:[],error:null})
 ]);
 const delegates=delRes.data||[], early=earlyRes.data||[], meds=medRes.data||[];
 db.students=(db.students||[]).filter(x=>!x._supabaseFamily);
 const mapped=(rows||[]).map(r=>{
   const oid=r.order_id ? (orders.find(x=>x) || "Primaria") : "Primaria";
   const campus=r.campus_id ? "Plesso Centrale" : "Plesso Centrale";
   return {
    id:r.id, _supabaseFamily:true, name:`${r.first_name} ${r.last_name}`,
    order:oid, campus:campus, class:"", dob:r.date_of_birth||"",
    parents:[{name:state.user.first_name+" "+state.user.last_name,phone:r.parent_phone||"",email:r.parent_email||""}],
    delegates:delegates.filter(x=>x.student_id===r.id).map(x=>({name:x.full_name,relation:x.relationship,document:x.document_info,validity:x.validity_date||""})),
    early:early.filter(x=>x.student_id===r.id).map(x=>({type:x.exit_type,date:x.exit_date||"",time:x.exit_time||"",person:x.authorized_person||""})),
    allergy:r.allergies||"Nessuna",health:r.other_health_info||"",
    med:meds.filter(x=>x.student_id===r.id).length?"Sì":"No",
    medications:meds.filter(x=>x.student_id===r.id).map(x=>({name:x.medication_name,time:x.administration_time,dose:x.dose,method:x.method,school:x.administered_at_school?"Sì":"No"})),
    mensa:r.school_canteen?"Sì":"No",homeMeal:r.home_meal?"Sì":"No",diet:r.diet||"",
    transport:r.transport?"Sì":"No",transportNote:r.transport_notes||"",
    docsInfo:r.document_info||"",note:r.notes||"",
    familySubmitted:r.family_submitted,verificationStatus:r.verification_status
   };
 });
 db.students.push(...mapped);
 state.user.children=ids;
 state.familySupabaseLoaded=true;
}

async function syncStaffFromSupabase(){
 const client=window.supabaseClient;
 if(!client || !state.authUser || (state.role!=="teacher" && state.role!=="admin")) return;
 const [stu,del,early,med,ordersRes,campusesRes,classesRes]=await Promise.all([
   client.from("students").select("*").order("created_at",{ascending:true}),
   client.from("student_delegates").select("*"),
   client.from("early_exits").select("*"),
   client.from("student_medications").select("*"),
   client.from("school_orders").select("*"),
   client.from("campuses").select("*"),
   client.from("classes").select("*")
 ]);
 if(stu.error){console.error(stu.error);return;}
 const orderMap=Object.fromEntries((Array.isArray(ordersRes.data)?ordersRes.data:[]).map(x=>[x.id,x.name||x.title||""]));
 const campusMap=Object.fromEntries((Array.isArray(campusesRes.data)?campusesRes.data:[]).map(x=>[x.id,x.name||x.title||""]));
 const classMap=Object.fromEntries((Array.isArray(classesRes.data)?classesRes.data:[]).map(x=>[x.id,x.name||x.code||x.title||""]));
 const delegates=Array.isArray(del.data)?del.data:[];
 const earlyRows=Array.isArray(early.data)?early.data:[];
 const meds=Array.isArray(med.data)?med.data:[];
 db.students=(Array.isArray(stu.data)?stu.data:[]).map(r=>({
   id:r.id,
   _supabase:true,
   name:[r.first_name,r.last_name].filter(Boolean).join(" "),
   order:orderMap[r.school_order_id]||"Primaria",
   campus:campusMap[r.campus_id]||"Plesso Centrale",
   class:classMap[r.class_id]||"",
   dob:r.date_of_birth||"",
   parents:[{name:r.parent_name||"",phone:r.parent_phone||"",email:r.parent_email||""}],
   delegates:delegates.filter(x=>x.student_id===r.id).map(x=>({name:x.full_name||"",relation:x.relationship||"",document:x.document_info||"",validity:x.validity_date||""})),
   early:earlyRows.filter(x=>x.student_id===r.id).map(x=>({type:x.exit_type||"Occasionale",date:x.exit_date||"",time:x.exit_time||"",person:x.authorized_person||""})),
   allergy:r.allergies||"Nessuna",
   health:r.other_health_info||"",
   med:meds.some(x=>x.student_id===r.id)?"Sì":"No",
   medications:meds.filter(x=>x.student_id===r.id).map(x=>({name:x.medication_name||"",time:x.administration_time||"",dose:x.dose||"",method:x.method||"",school:x.administered_at_school?"Sì":"No"})),
   mensa:r.school_canteen?"Sì":"No",
   homeMeal:r.home_meal?"Sì":"No",
   diet:r.diet||"",
   transport:r.transport?"Sì":"No",
   transportNote:r.transport_notes||"",
   docsInfo:r.document_info||"",
   note:r.notes||"",
   familySubmitted:!!r.family_submitted,
   verificationStatus:r.verification_status||"Da verificare",
   verificationNote:r.verification_note||""
 }));
}

async function doLogin(e,area){
 e.preventDefault();
 const u=(document.querySelector("#loginUser").value||"").trim().toLowerCase();
 const pw=document.querySelector("#loginPass").value;
 const wantedRole=area==="family"?"family":null;
 const emailMap={
   "admin":"admin@ic-anzio-i.test",
   "mario.rossi":"mario.rossi@ic-anzio-i.test",
   "anna.bianchi":"anna.bianchi@ic-anzio-i.test",
   "luca.rossi":"luca.rossi@ic-anzio-i.test",
   "giulia.verdi":"giulia.verdi@ic-anzio-i.test"
 };
 const email=emailMap[u] || `${u}@ic-anzio-i.test`;
 const client=window.supabaseClient;
 if(!client){alert("Connessione Supabase non disponibile.");return;}
 const {data,error}=await client.auth.signInWithPassword({email,password:pw});
 if(error){
   const m=document.querySelector("#loginMsg");
   m.textContent="Credenziali non corrette o account non ancora creato in Supabase.";
   m.style.display="block"; return;
 }
 const uid=data.user.id;
 const {data:profile,error:pe}=await client.from("user_profiles").select("*").eq("id",uid).single();
 if(pe || !profile){
   await client.auth.signOut();
   const m=document.querySelector("#loginMsg");
   m.textContent="Account autenticato ma profilo scolastico non configurato.";
   m.style.display="block"; return;
 }
 if(wantedRole && profile.role!=="family" || !wantedRole && profile.role==="family"){
   await client.auth.signOut();
   const m=document.querySelector("#loginMsg");
   m.textContent=area==="family"?"Questo account non è un account famiglia.":"Questo account non è un account docente/amministratore.";
   m.style.display="block"; return;
 }
 state.user=profile;
 state.role=profile.role;
 state.page="home";
 state.student=null;
 state.familyStudent=null;
 state.authUser=data.user;
 if(profile.role==='family') await syncFamilyFromSupabase();
 if(profile.role==='teacher' || profile.role==='admin') await syncStaffFromSupabase();
 render();
}

async function restoreSession(){
 const client=window.supabaseClient;
 if(!client)return;
 const {data}=await client.auth.getSession();
 if(!data?.session)return;
 const uid=data.session.user.id;
 const {data:profile}=await client.from("user_profiles").select("*").eq("id",uid).single();
 if(profile){
   state.user=profile;
   state.role=profile.role;
   state.authUser=data.session.user;
   state.page="home";
   if(profile.role==='family') await syncFamilyFromSupabase();
   if(profile.role==='teacher' || profile.role==='admin') await syncStaffFromSupabase();
   render();
 }
}

function side(){
 if(state.role==="family") return `<aside class="side">
   <div class="section" style="padding:12px;margin-bottom:8px"><b>👨‍👩‍👧 AREA FAMIGLIE</b></div>
   <button class="nav ${state.page==='home'?'active':''}" onclick="go('home')">🏠 Home</button>
   <button class="nav ${state.page==='familyChildren'?'active':''}" onclick="go('familyChildren')">👧 I miei figli</button>
   <button class="nav ${state.page==='familyDocs'?'active':''}" onclick="go('familyDocs')">📄 Documenti</button>
   <button class="nav ${state.page==='password'?'active':''}" onclick="go('password')">🔐 Password</button>
 </aside>`;
 return `<aside class="side">
   <div class="section" style="padding:12px;margin-bottom:8px"><b>👩‍🏫 AREA DOCENTI</b></div>
   <button class="nav ${state.page==='home'?'active':''}" onclick="go('home')">🏠 Dashboard</button>
   <button class="nav ${state.page==='students'?'active':''}" onclick="go('students')">👨‍🎓 Alunni</button>
   <button class="nav ${state.page==='add'?'active':''}" onclick="go('add')">➕ Inserisci alunno</button>
   <button class="nav ${state.page==='docs'?'active':''}" onclick="go('docs')">📁 Documenti</button>
   <button class="nav ${state.page==='verification'?'active':''}" onclick="go('verification')">🔎 Verifiche famiglie</button>
   <button class="nav ${state.page==='today'?'active':''}" onclick="go('today')">📅 Oggi</button>
   <button class="nav ${state.page==='users'?'active':''}" onclick="go('users')">👥 Utenti</button>
   <button class="nav ${state.page==='password'?'active':''}" onclick="go('password')">🔐 Password</button>
 </aside>`;
}
function page(){if(state.page==='home')return home();if(state.page==='students')return students();if(state.page==='add')return add();if(state.page==='docs')return docs();if(state.page==='verification')return verification();if(state.page==='today')return today();if(state.page==='users')return users();if(state.page==='student')return student();if(state.page==='verificationDetail')return verificationDetail();if(state.page==='password')return passwordPage();if(state.page==='familyChildren')return familyChildren();if(state.page==='addFamilyChild')return addFamilyChild();if(state.page==='familyDocs')return familyDocs();if(state.page==='familyStudent')return familyStudent();if(state.page==='familyEdit')return renderFamilyEdit();return home()}
function home(){
 if(state.role==="family") {
   const count=(state.user.children||[]).length;
   return `<div class="section"><h2>👨‍👩‍👧 Area Famiglie</h2><p>Benvenuto/a, <b>${state.user.display}</b>.</p><p class="muted">Account: ${state.user.username} · Password personale attiva.</p>
   <div class="card"><h3>👧 I miei figli</h3><p>${count ? `Hai inserito ${count} ${count===1?"figlio":"figli"} nel tuo account.` : "Non hai ancora inserito un figlio."}</p>
   <button class="btn primary" onclick="go('familyChildren')">${count?"Gestisci i miei figli":"➕ Inserisci mio figlio"}</button></div>
   <div class="card" style="margin-top:14px"><h3>📄 Documenti</h3><p class="muted">Potrai consultare e caricare la documentazione relativa ai tuoi figli.</p><button class="btn" onclick="go('familyDocs')">Apri documenti</button></div>
   </div>`;
 }
 return `<div class="section"><h2>👩‍🏫 Area Docenti</h2><p class="muted">Dashboard di prova per docenti e amministratori.</p><p class="muted">Account: ${state.user.username} · Ruolo: ${state.user.role==="admin"?"Amministratore":"Docente"} · Password personale attiva.</p></div><div class="grid"><div class="card"><span class="muted">Alunni</span><div class="metric">${db.students.length}</div></div><div class="card"><span class="muted">Documenti</span><div class="metric">${db.documents.length}</div></div><div class="card"><span class="muted">Utenti</span><div class="metric">${db.users.length}</div></div><div class="card"><span class="muted">Plessi</span><div class="metric">${campuses.length}</div></div></div><div class="section" style="margin-top:16px"><h3>⚠️ Prima del passaggio reale</h3><p>Questa build usa localStorage. Serve esclusivamente per provare il funzionamento e raccogliere modifiche. Non usare dati reali di minori.</p><p><b>Livelli informativi:</b> 🟢 operativo · 🟠 autorizzazione · 🔴 sanitario riservato.</p></div>`;
}
function familyChildren(){
 const children=state.user.children||[];
 return `<div class="section"><h2>👧 I miei figli</h2>
 <p class="muted">I figli associati al tuo account sono caricati dal database scolastico. L’inserimento/modifica completo su Supabase sarà attivato nel passaggio successivo.</p><button class="btn" onclick="refreshFamily()">↻ Aggiorna dati</button>
 <button class="btn primary" onclick="go('addFamilyChild')">➕ Inserisci mio figlio</button>
 <div style="margin-top:16px">${children.length ? children.map((id,i)=>{const s=db.students.find(x=>x.id===id); return s?`<div class="card"><h3>${s.name}</h3><p>${s.order} · ${s.campus} · Classe ${s.class}</p><button class="btn primary" onclick="openFamilyStudent(\'${s.id}\')">Apri scheda</button></div>`:""}).join("") : `<div class="card"><h3>Nessun figlio inserito</h3><p>Utilizza il pulsante sopra per inserire il primo figlio.</p></div>`}</div>
 </div>`;
}
async function refreshFamily(){
 await syncFamilyFromSupabase();
 render();
}
function addFamilyChild(){
 return `<div class="section"><button class="btn" onclick="go('familyChildren')">← I miei figli</button><h2>➕ Inserisci mio figlio</h2>
 <p class="muted">Compila i dati del figlio e le informazioni/autorizzazioni che vuoi comunicare alla scuola. In questa versione di test i dati restano nel browser.</p>
 <form onsubmit="saveFamilyChild(event)">
 <div class="formgrid">
  <div class="field"><label>Nome del figlio</label><input id="fc_n" required></div>
  <div class="field"><label>Cognome del figlio</label><input id="fc_c" required></div>
  <div class="field"><label>Ordine</label><select id="fc_o">${orders.map(x=>`<option>${x}</option>`).join("")}</select></div>
  <div class="field"><label>Plesso</label><select id="fc_p">${campuses.map(x=>`<option>${x}</option>`).join("")}</select></div>
  <div class="field"><label>Classe / sezione</label><input id="fc_cl" required></div>
  <div class="field"><label>Data di nascita (facoltativa)</label><input id="fc_dob" type="date"></div>

  <div class="field" style="grid-column:1/-1"><h3>📞 Recapiti</h3></div>
  <div class="field"><label>Telefono del genitore</label><input id="fc_phone" type="tel"></div>
  <div class="field"><label>Email del genitore</label><input id="fc_email" type="email"></div>

  <div class="field" style="grid-column:1/-1"><h3>🚪 Deleghe e uscite</h3></div>
  <div class="field" style="grid-column:1/-1"><label>Deleghe per il ritiro</label>
    <div id="fc_delegateList"></div>
    <button type="button" class="btn" onclick="addFamilyDelegateRow()">+ Aggiungi delegato</button>
  </div>
  <div class="field" style="grid-column:1/-1"><label>Uscite anticipate / autorizzazioni</label>
    <div id="fc_earlyList"></div>
    <button type="button" class="btn" onclick="addFamilyEarlyRow()">+ Aggiungi autorizzazione</button>
  </div>

  <div class="field" style="grid-column:1/-1"><h3>🩺 Informazioni sanitarie</h3></div>
  <div class="field"><label>Allergie / intolleranze</label><textarea id="fc_allergy" placeholder="Nessuna / descrizione"></textarea></div>
  <div class="field"><label>Altre informazioni sanitarie importanti</label><textarea id="fc_health" placeholder="Informazioni operative da comunicare alla scuola"></textarea></div>
  <div class="field" style="grid-column:1/-1">
    <label>Farmaci</label>
    <select id="fc_med" onchange="toggleFamilyMedication()"><option>No</option><option>Sì</option></select>
    <div id="fc_medFields" style="display:none;margin-top:10px"><div id="fc_medList"></div><button type="button" class="btn" onclick="addFamilyMedicationRow()">+ Aggiungi farmaco</button></div>
  </div>

  <div class="field" style="grid-column:1/-1"><h3>🍽️ Mensa e alimentazione</h3></div>
  <div class="field"><label>Mensa</label><select id="fc_mensa"><option>No</option><option>Sì</option></select></div>
  <div class="field"><label>Pasto da casa</label><select id="fc_homeMeal"><option>No</option><option>Sì</option></select></div>
  <div class="field"><label>Indicazioni alimentari / dieta</label><textarea id="fc_diet" placeholder="Eventuali informazioni da comunicare"></textarea></div>

  <div class="field" style="grid-column:1/-1"><h3>🚌 Trasporto</h3></div>
  <div class="field"><label>Trasporto scolastico</label><select id="fc_transport"><option>No</option><option>Sì</option></select></div>
  <div class="field"><label>Note sul trasporto</label><textarea id="fc_transportNote" placeholder="Fermata, modalità, autorizzazioni o altre note"></textarea></div>

  <div class="field" style="grid-column:1/-1"><h3>📄 Documentazione</h3></div>
  <div class="field"><label>Documenti / autorizzazioni da comunicare</label><textarea id="fc_docs" placeholder="Indicare i documenti che verranno consegnati alla scuola"></textarea></div>
  <div class="field" style="grid-column:1/-1"><label>Note aggiuntive</label><textarea id="fc_note"></textarea></div>
 </div><br><button class="btn primary">Salva dati e invia alla scuola</button></form></div>`;
}
function familyMedicationRow(){
 return `<div class="card medrow family-medrow" style="margin:10px 0"><div class="formgrid">
 <div class="field"><label>Nome farmaco</label><input data-fmed="name" required></div>
 <div class="field"><label>Quando</label><input data-fmed="time" placeholder="Es. ore 10:00 / al bisogno"></div>
 <div class="field"><label>Dosaggio</label><input data-fmed="dose"></div>
 <div class="field"><label>Modalità</label><input data-fmed="method"></div>
 <div class="field"><label>Somministrazione a scuola</label><select data-fmed="school"><option>Sì</option><option>No</option></select></div>
 </div><button type="button" class="btn" onclick="this.closest('.family-medrow').remove()">Rimuovi farmaco</button></div>`;
}
function toggleFamilyMedication(){const show=fc_med.value==="Sì";document.querySelector("#fc_medFields").style.display=show?"block":"none";if(show&&!document.querySelector(".family-medrow"))addFamilyMedicationRow()}
function addFamilyMedicationRow(){document.querySelector("#fc_medList").insertAdjacentHTML("beforeend",familyMedicationRow())}
function collectFamilyMedications(){return [...document.querySelectorAll(".family-medrow")].map(r=>({name:r.querySelector('[data-fmed="name"]').value,time:r.querySelector('[data-fmed="time"]').value,dose:r.querySelector('[data-fmed="dose"]').value,method:r.querySelector('[data-fmed="method"]').value,school:r.querySelector('[data-fmed="school"]').value})).filter(x=>x.name)}
async function saveFamilyChild(e){
 e.preventDefault();
 const client=window.supabaseClient;
 if(!client || !state.authUser){alert("Sessione Supabase non disponibile.");return;}

 const {data:row,error}=await client.from("students").insert({
   first_name:fc_n.value.trim(),
   last_name:fc_c.value.trim(),
   school_year:"2026/2027",
   date_of_birth:fc_dob.value||null,
   family_user_id:state.authUser.id,
   parent_phone:fc_phone.value||null,
   parent_email:fc_email.value||null,
   allergies:fc_allergy.value||null,
   other_health_info:fc_health.value||null,
   school_canteen:fc_mensa.value==="Sì",
   home_meal:fc_homeMeal.value==="Sì",
   diet:fc_diet.value||null,
   transport:fc_transport.value==="Sì",
   transport_notes:fc_transportNote.value||null,
   document_info:fc_docs.value||null,
   notes:fc_note.value||null,
   family_submitted:true,
   verification_status:"Da verificare"
 }).select().single();

 if(error){alert("Impossibile salvare l'alunno: "+error.message);return;}
 const sid=row.id;

 const delegates=collectFamilyDelegates();
 if(delegates.length){
   const payload=delegates.map(d=>({
     student_id:sid,full_name:d.name||"Delegato",relationship:d.relation||null,
     document_info:d.document||null,validity_date:d.validity||null,active:true
   }));
   const r=await client.from("student_delegates").insert(payload);
   if(r.error){alert("Alunno salvato, ma errore nelle deleghe: "+r.error.message);}
 }
 const early=collectFamilyEarly();
 if(early.length){
   const payload=early.map(x=>({
     student_id:sid,exit_type:x.type||"Occasionale",exit_date:x.date||null,
     exit_time:x.time||null,authorized_person:x.person||null
   }));
   const r=await client.from("early_exits").insert(payload);
   if(r.error){alert("Alunno salvato, ma errore nelle uscite anticipate: "+r.error.message);}
 }
 if(fc_med.value==="Sì"){
   const meds=collectFamilyMedications();
   if(meds.length){
     const payload=meds.map(m=>({
       student_id:sid,medication_name:m.name||"Farmaco",
       administration_time:m.time||null,dose:m.dose||null,method:m.method||null,
       administered_at_school:m.school==="Sì"
     }));
     const r=await client.from("student_medications").insert(payload);
     if(r.error){alert("Alunno salvato, ma errore nei farmaci: "+r.error.message);}
   }
 }

 await syncFamilyFromSupabase();
 state.familyStudent=db.students.find(x=>x.id===sid)||null;
 state.page="familyStudent";
 render();
}

function familyStudent(){
 const s=state.familyStudent;
 if(!s)return familyChildren();
 const meds=(s.medications||[]).map((m,i)=>`<div style="margin-top:8px"><b>💊 ${m.name||"Farmaco "+(i+1)}</b><br>Quando: ${m.time||"—"} · Dose: ${m.dose||"—"} · Modalità: ${m.method||"—"} · A scuola: ${m.school||"—"}</div>`).join("")||"Nessun farmaco indicato.";
 return `<div class="section"><button class="btn" onclick="go('familyChildren')">← I miei figli</button><h2>${s.name}</h2>
 <div class="card"><b>Stato comunicazione:</b> <span class="pill orange">${s.verificationStatus||"Da verificare"}</span><p class="muted">Le informazioni inserite dalla famiglia dovranno essere verificate dalla scuola nella versione definitiva.</p></div><div style="margin:12px 0"><button class="btn primary" onclick="editFamilyChild(\'${s.id}\')">✏️ Modifica scheda</button></div>
 <div class="grid">
  <div class="card"><b>Ordine</b><br>${s.order}</div><div class="card"><b>Plesso</b><br>${s.campus}</div><div class="card"><b>Classe</b><br>${s.class}</div>
  <div class="card"><b>📞 Recapito</b><br>${(s.parents||[]).map(g=>`${g.name||"—"}<br>📱 ${g.phone||"—"}<br>✉️ ${g.email||"—"}`).join("")||"—"}</div>
  <div class="card"><b>🚪 Deleghe</b><br>${formatDelegates(s.delegates)}</div>
  <div class="card"><b>🚪 Uscita anticipata</b><br>${formatEarly(s.early)}</div>
  <div class="card"><b>🩺 Allergie</b><br>${s.allergy||"Nessuna"}</div>
  <div class="card"><b>🩺 Altre informazioni sanitarie</b><br>${s.health||"—"}</div>
  <div class="card"><b>💊 Farmaci</b><br>${s.med==="Sì"?meds:"Nessuno indicato"}</div>
  <div class="card"><b>🍽️ Mensa</b><br>${s.mensa}</div>
  <div class="card"><b>🥪 Pasto da casa</b><br>${s.homeMeal}</div>
  <div class="card"><b>🍽️ Dieta / indicazioni alimentari</b><br>${s.diet||"—"}</div>
  <div class="card"><b>🚌 Trasporto</b><br>${s.transport}</div>
  <div class="card"><b>🚌 Note trasporto</b><br>${s.transportNote||"—"}</div>
  <div class="card"><b>📄 Documentazione</b><br>${s.docsInfo||"Nessuna indicazione"}</div>
  <div class="card"><b>📝 Note</b><br>${s.note||"—"}</div>
 </div></div>`;
}
function formatDelegates(items){
 const a=normList(items); if(!a.length)return "Nessuna indicata";
 return a.map(d=>typeof d==='string'?d:`<div style="margin:6px 0"><b>${d.name||"—"}</b> · ${d.relation||"—"}<br>Documento: ${d.document||"—"} · Validità: ${d.validity||"—"}</div>`).join('');
}
function formatEarly(items){
 const a=normList(items); if(!a.length)return "—";
 return a.map(e=>typeof e==='string'?e:`<div style="margin:6px 0"><b>${e.type||"—"}</b> · ${e.date||"—"} ${e.time||""}<br>Persona autorizzata: ${e.person||"—"}</div>`).join('');
}
function openFamilyStudent(id){
 const s=db.students.find(x=>x.id===id);
 if(!s){alert("Scheda alunno non trovata.");return;}
 if(state.role!=="family" || !(state.user.children||[]).includes(id)){alert("Non hai accesso a questa scheda.");return;}
 state.familyStudent=s; state.page="familyStudent"; render();
}
function editFamilyChild(id){
 const s=db.students.find(x=>x.id===id);
 if(!s){alert("Scheda alunno non trovata.");return;}
 if(state.role!=="family" || !(state.user.children||[]).includes(id)){alert("Non hai accesso a questa scheda.");return;}
 state.familyStudent=s;
 state.page="familyEdit";
 render();
}
function renderFamilyEdit(){
 const s=state.familyStudent;
 if(!s)return familyChildren();
 if(!s)return familyChildren();
 const g=(s.parents||[])[0]||{};
 const meds=(s.medications||[]);
 return `<div class="section"><button class="btn" onclick="openFamilyStudent(\'${s.id}\')">← Scheda figlio</button><h2>✏️ Aggiorna informazioni — ${s.name}</h2>
 <p class="muted">Le modifiche saranno nuovamente inviate alla scuola e lo stato tornerà a “Da verificare”.</p>
 <form onsubmit="updateFamilyChild(event,${s.id})"><div class="formgrid">
  <div class="field"><label>Nome</label><input id="ef_n" value="${s.name.split(" ")[0]||""}" required></div>
  <div class="field"><label>Cognome</label><input id="ef_c" value="${s.name.split(" ").slice(1).join(" ")||""}" required></div>
  <div class="field"><label>Ordine</label><select id="ef_o">${orders.map(x=>`<option ${x===s.order?"selected":""}>${x}</option>`).join("")}</select></div>
  <div class="field"><label>Plesso</label><select id="ef_p">${campuses.map(x=>`<option ${x===s.campus?"selected":""}>${x}</option>`).join("")}</select></div>
  <div class="field"><label>Classe / sezione</label><input id="ef_cl" value="${s.class||""}" required></div>
  <div class="field"><label>Data di nascita</label><input id="ef_dob" type="date" value="${s.dob||""}"></div>
  <div class="field"><label>Telefono genitore</label><input id="ef_phone" type="tel" value="${g.phone||""}"></div>
  <div class="field"><label>Email genitore</label><input id="ef_email" type="email" value="${g.email||""}"></div>
  <div class="field" style="grid-column:1/-1"><label>Deleghe</label>
    <div id="ef_delegateList"></div>
    <button type="button" class="btn" onclick="addEditFamilyDelegateRow()">+ Aggiungi delegato</button>
  </div>
  <div class="field" style="grid-column:1/-1"><label>Uscite anticipate / autorizzazioni</label>
    <div id="ef_earlyList"></div>
    <button type="button" class="btn" onclick="addEditFamilyEarlyRow()">+ Aggiungi autorizzazione</button>
  </div>
  <div class="field"><label>Allergie / intolleranze</label><textarea id="ef_allergy">${s.allergy==="Nessuna"?"":s.allergy||""}</textarea></div>
  <div class="field"><label>Altre informazioni sanitarie</label><textarea id="ef_health">${s.health||""}</textarea></div>
  <div class="field" style="grid-column:1/-1"><h3>💊 Farmaci</h3>
   <select id="ef_med" onchange="toggleEditFamilyMedication()"><option ${s.med!=="Sì"?"selected":""}>No</option><option ${s.med==="Sì"?"selected":""}>Sì</option></select>
   <div id="ef_medFields" style="display:${s.med==="Sì"?"block":"none"};margin-top:10px">
    <div id="ef_medList">${(s.medications||[]).map((m,i)=>editFamilyMedicationRow(m,i)).join("")}</div>
    <button type="button" class="btn" onclick="addEditFamilyMedicationRow()">+ Aggiungi farmaco</button>
   </div>
  </div>
  <div class="field"><label>Mensa</label><select id="ef_mensa"><option ${s.mensa==="No"?"selected":""}>No</option><option ${s.mensa==="Sì"?"selected":""}>Sì</option></select></div>
  <div class="field"><label>Pasto da casa</label><select id="ef_homeMeal"><option ${s.homeMeal==="No"?"selected":""}>No</option><option ${s.homeMeal==="Sì"?"selected":""}>Sì</option></select></div>
  <div class="field"><label>Dieta / indicazioni alimentari</label><textarea id="ef_diet">${s.diet||""}</textarea></div>
  <div class="field"><label>Trasporto</label><select id="ef_transport"><option ${s.transport==="No"?"selected":""}>No</option><option ${s.transport==="Sì"?"selected":""}>Sì</option></select></div>
  <div class="field"><label>Note trasporto</label><textarea id="ef_transportNote">${s.transportNote||""}</textarea></div>
  <div class="field" style="grid-column:1/-1"><label>Documentazione / autorizzazioni da comunicare</label><textarea id="ef_docs">${s.docsInfo||""}</textarea></div>
  <div class="field" style="grid-column:1/-1"><label>Note aggiuntive</label><textarea id="ef_note">${s.note||""}</textarea></div>
 </div><br><button class="btn primary">💾 Salva modifiche</button></form></div>`;
}
function editFamilyMedicationRow(m,i){
 return `<div class="card edit-medrow" style="margin:10px 0">
  <div class="formgrid">
   <div class="field"><label>Nome farmaco</label><input data-emed="name" value="${m.name||""}" required></div>
   <div class="field"><label>Quando</label><input data-emed="time" value="${m.time||""}"></div>
   <div class="field"><label>Dosaggio</label><input data-emed="dose" value="${m.dose||""}"></div>
   <div class="field"><label>Modalità</label><input data-emed="method" value="${m.method||""}"></div>
   <div class="field"><label>Somministrazione a scuola</label><select data-emed="school"><option ${m.school==="Sì"||!m.school?"selected":""}>Sì</option><option ${m.school==="No"?"selected":""}>No</option></select></div>
  </div>
  <button type="button" class="btn" onclick="this.closest('.edit-medrow').remove()">Rimuovi farmaco</button>
 </div>`;
}
function toggleEditFamilyMedication(){
 const show=ef_med.value==="Sì";
 document.querySelector("#ef_medFields").style.display=show?"block":"none";
 if(show && !document.querySelector(".edit-medrow")) addEditFamilyMedicationRow();
}
function addEditFamilyMedicationRow(){
 document.querySelector("#ef_medList").insertAdjacentHTML("beforeend",editFamilyMedicationRow({name:"",time:"",dose:"",method:"",school:"Sì"},Date.now()));
}
function collectEditFamilyMedications(){
 return [...document.querySelectorAll(".edit-medrow")].map(r=>({
  name:r.querySelector('[data-emed="name"]').value,
  time:r.querySelector('[data-emed="time"]').value,
  dose:r.querySelector('[data-emed="dose"]').value,
  method:r.querySelector('[data-emed="method"]').value,
  school:r.querySelector('[data-emed="school"]').value
 })).filter(x=>x.name||x.time||x.dose||x.method);
}
async function updateFamilyChild(e,id){
 e.preventDefault();
 const client=window.supabaseClient;
 if(!client || !state.authUser){alert("Sessione Supabase non disponibile.");return;}
 const nameParts=(`${ef_n.value} ${ef_c.value}`).trim().split(/\s+/);
 const first=nameParts.shift()||"";
 const last=nameParts.join(" ")||"";
 const {error}=await client.from("students").update({
   first_name:first,last_name:last,date_of_birth:ef_dob.value||null,
   parent_phone:ef_phone.value||null,parent_email:ef_email.value||null,
   allergies:ef_allergy.value||null,other_health_info:ef_health.value||null,
   school_canteen:ef_mensa.value==="Sì",home_meal:ef_homeMeal.value==="Sì",
   diet:ef_diet.value||null,transport:ef_transport.value==="Sì",
   transport_notes:ef_transportNote.value||null,document_info:ef_docs.value||null,
   notes:ef_note.value||null,family_submitted:true,verification_status:"Da verificare",
   updated_at:new Date().toISOString()
 }).eq("id",id).eq("family_user_id",state.authUser.id);
 if(error){alert("Impossibile aggiornare la scheda: "+error.message);return;}

 await client.from("student_delegates").delete().eq("student_id",id);
 const delegates=collectEditFamilyDelegates();
 if(delegates.length) await client.from("student_delegates").insert(delegates.map(d=>({
   student_id:id,full_name:d.name||"Delegato",relationship:d.relation||null,
   document_info:d.document||null,validity_date:d.validity||null,active:true
 })));

 await client.from("early_exits").delete().eq("student_id",id);
 const early=collectEditFamilyEarly();
 if(early.length) await client.from("early_exits").insert(early.map(x=>({
   student_id:id,exit_type:x.type||"Occasionale",exit_date:x.date||null,
   exit_time:x.time||null,authorized_person:x.person||null
 })));

 await client.from("student_medications").delete().eq("student_id",id);
 if(ef_med.value==="Sì"){
   const meds=collectEditFamilyMedications();
   if(meds.length) await client.from("student_medications").insert(meds.map(m=>({
     student_id:id,medication_name:m.name||"Farmaco",administration_time:m.time||null,
     dose:m.dose||null,method:m.method||null,administered_at_school:m.school==="Sì"
   })));
 }

 await syncFamilyFromSupabase();
 state.familyStudent=db.students.find(x=>x.id===id)||null;
 state.page="familyStudent";
 alert("Scheda aggiornata e inviata nuovamente alla scuola.");
 render();
}

function normList(v){return Array.isArray(v)?v:(v&&v!=="—"?String(v).split(/\n+/).filter(Boolean):[]);}
function delegateRowsHtml(prefix, items){
  const arr=normList(items);
  if(!arr.length) return '';
  return arr.map((d,i)=>`<div class="family-row delegate-row" style="display:grid;grid-template-columns:1.3fr 1fr 1.2fr 1fr auto;gap:8px;align-items:end;margin:8px 0;padding:10px;border:1px solid #e3e7ee;border-radius:10px">
    <div class="field"><label>Nome e cognome</label><input data-${prefix}del="name" value="${(d.name||"").replace(/"/g,'&quot;')}"></div>
    <div class="field"><label>Rapporto</label><input data-${prefix}del="relation" value="${(d.relation||"").replace(/"/g,'&quot;')}"></div>
    <div class="field"><label>Documento</label><input data-${prefix}del="document" value="${(d.document||"").replace(/"/g,'&quot;')}"></div>
    <div class="field"><label>Validità</label><input data-${prefix}del="validity" type="date" value="${d.validity||""}"></div>
    <button type="button" class="btn" onclick="this.closest('.delegate-row').remove()">Rimuovi</button>
  </div>`).join('');
}
function earlyRowsHtml(prefix, items){
  const arr=normList(items);
  if(!arr.length) return '';
  return arr.map(e=>`<div class="family-row early-row" style="display:grid;grid-template-columns:1fr 1fr 1.2fr 1fr auto;gap:8px;align-items:end;margin:8px 0;padding:10px;border:1px solid #e3e7ee;border-radius:10px">
    <div class="field"><label>Tipo</label><select data-${prefix}early="type"><option ${e.type==="Occasionale"?"selected":""}>Occasionale</option><option ${e.type==="Ricorrente"?"selected":""}>Ricorrente</option></select></div>
    <div class="field"><label>Data</label><input data-${prefix}early="date" type="date" value="${e.date||""}"></div>
    <div class="field"><label>Orario</label><input data-${prefix}early="time" type="time" value="${e.time||""}"></div>
    <div class="field"><label>Persona autorizzata</label><input data-${prefix}early="person" value="${(e.person||"").replace(/"/g,'&quot;')}"></div>
    <button type="button" class="btn" onclick="this.closest('.early-row').remove()">Rimuovi</button>
  </div>`).join('');
}
function collectRows(selector, attr){
  return [...document.querySelectorAll(selector)].map(row=>{
    const out={}; row.querySelectorAll(`[${attr}]`).forEach(x=>out[x.getAttribute(attr)]=x.value||''); return out;
  }).filter(x=>Object.values(x).some(Boolean));
}
function collectFamilyDelegates(){return collectRows('#fc_delegateList .delegate-row','data-fcdel');}
function collectEditFamilyDelegates(){return collectRows('#ef_delegateList .delegate-row','data-efdel');}
function collectFamilyEarly(){return collectRows('#fc_earlyList .early-row','data-fcearly');}
function collectEditFamilyEarly(){return collectRows('#ef_earlyList .early-row','data-efearly');}
function addFamilyDelegateRow(){
  const c=document.getElementById('fc_delegateList'); c.insertAdjacentHTML('beforeend',delegateRowsHtml('fc',[{}]));
}
function addEditFamilyDelegateRow(){
  const c=document.getElementById('ef_delegateList'); c.insertAdjacentHTML('beforeend',delegateRowsHtml('ef',[{}]));
}
function addFamilyEarlyRow(){
  const c=document.getElementById('fc_earlyList'); c.insertAdjacentHTML('beforeend',earlyRowsHtml('fc',[{}]));
}
function addEditFamilyEarlyRow(){
  const c=document.getElementById('ef_earlyList'); c.insertAdjacentHTML('beforeend',earlyRowsHtml('ef',[{}]));
}
function renderFamilyStructuredRows(){
  const d=document.getElementById('fc_delegateList'); if(d) d.innerHTML=delegateRowsHtml('fc',[]);
  const e=document.getElementById('fc_earlyList'); if(e) e.innerHTML=earlyRowsHtml('fc',[]);
}
function renderEditFamilyStructuredRows(student){
  const d=document.getElementById('ef_delegateList'); if(d) d.innerHTML=delegateRowsHtml('ef',student.delegates);
  const e=document.getElementById('ef_earlyList'); if(e) e.innerHTML=earlyRowsHtml('ef',student.early);
}

function familyDocs(){return `<div class="section"><h2>📄 Documenti della famiglia</h2><p class="muted">Area riservata ai propri figli. Nella versione definitiva qui sarà possibile caricare autorizzazioni, deleghe, documentazione per farmaci e altri documenti richiesti dalla scuola.</p><div class="card">Nessun file reale in questa versione di test.</div></div>`;}

function add(){return `<div class="section"><h2>Nuovo alunno — test</h2><form onsubmit="addStudent(event)"><div class="formgrid"><div class="field"><label>Nome</label><input id="n" required></div><div class="field"><label>Cognome</label><input id="c" required></div><div class="field"><label>Ordine</label><select id="o">${orders.map(x=>`<option>${x}</option>`).join("")}</select></div><div class="field"><label>Plesso</label><select id="p">${campuses.map(x=>`<option>${x}</option>`).join("")}</select></div><div class="field"><label>Classe / sezione</label><input id="cl" required></div>
<div class="field"><label>Genitore 1 — nome e cognome</label><input id="g1n" placeholder="Nome e cognome"></div>
<div class="field"><label>Genitore 1 — telefono</label><input id="g1t" type="tel" placeholder="Es. 333 1234567"></div>
<div class="field"><label>Genitore 1 — email</label><input id="g1e" type="email" placeholder="email@example.it"></div>
<div class="field"><label>Genitore 2 — nome e cognome</label><input id="g2n" placeholder="Nome e cognome"></div>
<div class="field"><label>Genitore 2 — telefono</label><input id="g2t" type="tel" placeholder="Es. 333 1234567"></div>
<div class="field"><label>Genitore 2 — email</label><input id="g2e" type="email" placeholder="email@example.it"></div>
<div class="field"><label>Allergie</label><input id="a" placeholder="Nessuna / descrizione"></div><div class="field"><label>Uscita anticipata</label><input id="e" placeholder="—"></div><div class="field"><label>Farmaci</label><select id="m" onchange="toggleMedication()"><option>No</option><option>Sì</option></select></div>
<div id="medFields" style="display:none;grid-column:1/-1">
<div id="medList"></div>
<button type="button" class="btn" onclick="addMedicationRow()">+ Aggiungi farmaco</button>
</div><div class="field"><label>Mensa</label><select id="me"><option>Sì</option><option>No</option></select></div><div class="field"><label>Trasporto</label><select id="t"><option>Sì</option><option>No</option></select></div><div class="field" style="grid-column:1/-1"><label>Note operative</label><textarea id="note"></textarea></div></div><br><button class="btn primary">Salva alunno di prova</button></form></div>`}
function medicationRow(i){
return `<div class="card medrow" style="margin:10px 0">
<div class="formgrid">
<div class="field"><label>Nome farmaco</label><input data-med="name" placeholder="Nome del farmaco"></div>
<div class="field"><label>Somministrazione a scuola</label><select data-med="school"><option>Sì</option><option>No</option></select></div>
<div class="field"><label>Quando</label><input data-med="time" placeholder="Es. ore 10:00 / al bisogno"></div>
<div class="field"><label>Dosaggio</label><input data-med="dose" placeholder="Es. 5 ml / 1 compressa"></div>
<div class="field"><label>Modalità</label><input data-med="method" placeholder="Es. per via orale"></div>
</div>
<button type="button" class="btn" style="margin-top:8px" onclick="this.closest('.medrow').remove()">Rimuovi farmaco</button>
</div>`}
function toggleMedication(){const show=m.value==="Sì";document.querySelector("#medFields").style.display=show?"block":"none";if(show&&!document.querySelector(".medrow"))addMedicationRow()}
function addMedicationRow(){document.querySelector("#medList").insertAdjacentHTML("beforeend",medicationRow(Date.now()))}
function collectMedications(){return [...document.querySelectorAll(".medrow")].map(r=>({name:r.querySelector('[data-med="name"]').value,time:r.querySelector('[data-med="time"]').value,dose:r.querySelector('[data-med="dose"]').value,method:r.querySelector('[data-med="method"]').value,school:r.querySelector('[data-med="school"]').value})).filter(x=>x.name||x.time||x.dose||x.method)}
function addStudent(e){e.preventDefault();const hasMed=m.value==="Sì";db.students.push({
 id:Date.now(),
 name:`${n.value} ${c.value}`,
 order:o.value,campus:p.value,class:cl.value,
 parents:[
  {name:g1n.value||"",phone:g1t.value||"",email:g1e.value||""},
  {name:g2n.value||"",phone:g2t.value||"",email:g2e.value||""}
 ].filter(x=>x.name||x.phone||x.email),
 allergy:a.value||"Nessuna",early:e.value||"—",
 med:hasMed?"Sì":"No",medications:hasMed?collectMedications():[],
 mensa:me.value,transport:t.value,note:note.value
});save();state.page="students";render()}
function students(){
 const arr=db.students||[];
 const rows=arr.map(s=>`<div class="row"><div><b>${s.name||"—"}</b></div><div>${s.class||"—"}</div><div>${s.campus||"—"}</div><div>${s.order||"—"}</div><div><button type="button" class="btn primary" onclick="openS('${s.id}')">Apri</button></div></div>`).join("");
 return `<div class="section"><h2>Alunni</h2>
 <p class="muted">Elenco sincronizzato con Supabase.</p>
 <div class="toolbar"><input id="q" placeholder="Cerca..." oninput="filter()"></div>
 <div class="table" id="tab"><div class="row head"><div>Alunno</div><div>Classe</div><div>Plesso</div><div>Ordine</div><div></div></div>${rows||'<div style="padding:20px" class="muted">Nessun alunno presente.</div>'}</div></div>`;
}
function filter(){
 const q=(document.querySelector("#q")?.value||"").toLowerCase();
 const a=(db.students||[]).filter(s=>`${s.name||""} ${s.class||""} ${s.campus||""} ${s.order||""}`.toLowerCase().includes(q));
 document.querySelector("#tab").innerHTML='<div class="row head"><div>Alunno</div><div>Classe</div><div>Plesso</div><div>Ordine</div><div></div></div>'+
 (a.length?a.map(s=>`<div class="row"><div><b>${s.name||"—"}</b></div><div>${s.class||"—"}</div><div>${s.campus||"—"}</div><div>${s.order||"—"}</div><div><button type="button" class="btn primary" onclick="openS('${s.id}')">Apri</button></div></div>`).join(""):'<div style="padding:20px" class="muted">Nessun risultato.</div>');
}
function openS(id){
 const found=(db.students||[]).find(x=>String(x.id)===String(id));
 if(!found){alert("Scheda alunno non trovata.");return;}
 state.student=found;
 state.page="student";
 render();
}
function student(){let s=state.student;return `<div class="section"><button class="btn" onclick="go('students')">← Alunni</button><h2>${s.name}</h2><div class="grid"><div class="card"><b>Ordine</b><br>${s.order}</div><div class="card"><b>Plesso</b><br>${s.campus}</div><div class="card"><b>Classe</b><br>${s.class}</div>
<div class="card" style="grid-column:1/-1"><b>📞 Recapiti genitori</b><br>
${(s.parents||[]).length ? (s.parents||[]).map((g,i)=>`<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e4e7ec"><b>Genitore ${i+1}</b><br>${g.name||"—"}<br>📱 ${g.phone||"—"}<br>✉️ ${g.email||"—"}</div>`).join("") : '<span class="muted">Nessun recapito inserito.</span>'}
</div>
<div class="card"><b>Allergie</b><br>${s.allergy}</div><div class="card"><b>Uscita</b><br>${s.early}</div><div class="card"><b>Farmaci</b><br>${s.med==="Sì"?`<span class="pill red">Presente — informazioni riservate</span>${(s.medications||[]).map((med,i)=>`<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e4e7ec"><b>💊 ${med.name||"Farmaco "+(i+1)}</b><br><b>Quando:</b> ${med.time||"—"}<br><b>Dosaggio:</b> ${med.dose||"—"}<br><b>Modalità:</b> ${med.method||"—"}<br><b>Somministrazione a scuola:</b> ${med.school||"—"}</div>`).join("")}`:"Nessuno indicato"}</div><div class="card"><b>Mensa</b><br>${s.mensa}</div><div class="card"><b>Trasporto</b><br>${s.transport}</div></div></div><div class="section"><h3>Note operative</h3><p>${s.note||"—"}</p></div><div class="section" style="margin-top:16px"><button type="button" class="btn primary" onclick="openVerification('${s.id}')">🔎 Verifica questa scheda</button></div>`}
function docs(){return `<div class="section"><h2>Documenti di prova</h2><p class="muted">Per ora registriamo solo metadati di prova, non file reali.</p><form onsubmit="addDoc(event)"><div class="formgrid"><div><label>Nome documento</label><input id="dn" required></div><div><label>Categoria</label><select id="dc"><option>Delega</option><option>Uscita anticipata</option><option>Autorizzazione</option><option>Farmaci</option><option>Allergie</option><option>Mensa</option><option>Trasporto</option></select></div><div><label>Alunno</label><select id="ds">${db.students.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}</select></div><div><label>Stato</label><select id="dst"><option>Da verificare</option><option>Approvato</option><option>Da integrare</option><option>Scaduto</option></select></div></div><br><button class="btn primary">Registra documento di prova</button></form><hr>${db.documents.map(d=>`<p><b>${d.name}</b> — ${d.cat} — <span class="pill ${d.status==='Approvato'?'green':d.status==='Scaduto'?'red':'orange'}">${d.status}</span></p>`).join("")}</div>`}
function addDoc(e){e.preventDefault();db.documents.push({name:dn.value,cat:dc.value,student:ds.value,status:dst.value});save();render()}
function verification(){
 const submitted=db.students.filter(s=>s.familySubmitted);
 const pending=submitted.filter(s=>(s.verificationStatus||"Da verificare")==="Da verificare");
 const approved=submitted.filter(s=>s.verificationStatus==="Approvato");
 const integrate=submitted.filter(s=>s.verificationStatus==="Da integrare");
 const card=(s)=>`<div class="card" style="margin:10px 0">
   <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
    <div><h3 style="margin:0">${s.name}</h3><p class="muted">${s.order} · ${s.campus} · Classe ${s.class}</p></div>
    <span class="pill ${s.verificationStatus==="Approvato"?"green":s.verificationStatus==="Da integrare"?"orange":"orange"}">${s.verificationStatus||"Da verificare"}</span>
   </div>
   <div style="margin-top:10px">
    <b>Famiglia:</b> ${(s.parents||[])[0]?.name||"—"} · 📱 ${(s.parents||[])[0]?.phone||"—"} · ✉️ ${(s.parents||[])[0]?.email||"—"}<br>
    <b>Deleghe:</b> ${s.delegates||"—"}<br>
    <b>Uscita:</b> ${s.early||"—"}<br>
    <b>Allergie:</b> ${s.allergy||"—"}<br>
    <b>Farmaci:</b> ${s.med==="Sì" ? `${(s.medications||[]).map(m=>m.name).filter(Boolean).join(", ")||"Indicati"} ` : "Nessuno"}<br>
    <b>Mensa:</b> ${s.mensa||"—"} · <b>Pasto da casa:</b> ${s.homeMeal||"—"} · <b>Trasporto:</b> ${s.transport||"—"}
   </div>
   <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn primary" onclick="openVerification('${s.id}')">Apri e verifica</button>
   </div>
  </div>`;
 return `<div class="section"><h2>🔎 Verifiche delle informazioni delle famiglie</h2>
   <p class="muted">Qui i docenti/amministratori possono controllare le informazioni inserite dalle famiglie e indicare se sono approvate o da integrare.</p>
   <div class="grid">
    <div class="card"><span class="muted">Da verificare</span><div class="metric">${pending.length}</div></div>
    <div class="card"><span class="muted">Approvate</span><div class="metric">${approved.length}</div></div>
    <div class="card"><span class="muted">Da integrare</span><div class="metric">${integrate.length}</div></div>
   </div>
   <div class="section" style="margin-top:16px"><h3>📥 Comunicazioni ricevute</h3>${submitted.length?submitted.map(card).join(""):'<p class="muted">Non ci sono ancora comunicazioni inserite dalle famiglie.</p>'}</div>
 </div>`;
}
function openVerification(id){
 const found=(db.students||[]).find(s=>String(s.id)===String(id));
 if(!found){alert("Scheda alunno non trovata.");return;}
 state.student=found;
 state.page="verificationDetail";
 render();
}
function verificationDetail(){
 const s=state.student;if(!s)return verification();
 const meds=(s.medications||[]).map((m,i)=>`<div style="padding:8px 0;border-top:1px solid #e4e7ec"><b>💊 ${m.name||"Farmaco "+(i+1)}</b><br>Quando: ${m.time||"—"} · Dose: ${m.dose||"—"} · Modalità: ${m.method||"—"} · A scuola: ${m.school||"—"}</div>`).join("")||"Nessuno";
 return `<div class="section"><button class="btn" onclick="go('verification')">← Verifiche</button><h2>Verifica — ${s.name}</h2>
 <div class="card"><b>Stato attuale:</b> <span class="pill orange">${s.verificationStatus||"Da verificare"}</span></div>
 <div class="grid">
  <div class="card"><h3>👤 Dati</h3>${s.order} · ${s.campus} · Classe ${s.class}<br>Data di nascita: ${s.dob||"—"}</div>
  <div class="card"><h3>📞 Genitore</h3>${(s.parents||[]).map(g=>`${g.name||"—"}<br>📱 ${g.phone||"—"}<br>✉️ ${g.email||"—"}`).join("<hr>")}</div>
  <div class="card"><h3>🚪 Deleghe</h3>${s.delegates||"—"}</div>
  <div class="card"><h3>🚪 Uscita anticipata</h3>${s.early||"—"}</div>
  <div class="card"><h3>🩺 Allergie</h3>${s.allergy||"—"}<br><br><b>Altre informazioni:</b><br>${s.health||"—"}</div>
  <div class="card"><h3>💊 Farmaci</h3>${s.med==="Sì"?meds:"Nessuno"}</div>
  <div class="card"><h3>🍽️ Alimentazione</h3>Mensa: ${s.mensa||"—"}<br>Pasto da casa: ${s.homeMeal||"—"}<br>${s.diet||""}</div>
  <div class="card"><h3>🚌 Trasporto</h3>${s.transport||"—"}<br>${s.transportNote||""}</div>
  <div class="card"><h3>📄 Documentazione</h3>${s.docsInfo||"—"}</div>
 </div>
 <div class="section" style="margin-top:16px"><h3>Esito verifica</h3>
  <div class="formgrid">
   <div class="field"><label>Stato</label><select id="verStatus"><option ${s.verificationStatus==="Da verificare"?"selected":""}>Da verificare</option><option ${s.verificationStatus==="Approvato"?"selected":""}>Approvato</option><option ${s.verificationStatus==="Da integrare"?"selected":""}>Da integrare</option></select></div>
   <div class="field" style="grid-column:1/-1"><label>Nota del docente</label><textarea id="verNote" placeholder="Es. manca documento, delega da integrare, autorizzazione da verificare...">${s.verificationNote||""}</textarea></div>
  </div><br><button class="btn primary" onclick="saveVerification('${s.id}')">Salva verifica</button>
 </div></div>`;
}
async function saveVerification(id){
 const s=db.students.find(x=>String(x.id)===String(id)); if(!s)return;
 const status=document.querySelector("#verStatus").value;
 const note=document.querySelector("#verNote").value||"";
 const client=window.supabaseClient;
 if(!client){alert("Supabase non disponibile.");return;}
 const {error}=await client.from("students").update({verification_status:status}).eq("id",id);
 if(error){alert("Errore nel salvataggio: "+error.message);return;}
 s.verificationStatus=status;
 s.verificationNote=note;
 s.verifiedBy=state.user?.username||"";
 s.verifiedAt=new Date().toLocaleString("it-IT");
 await syncStaffFromSupabase();
 state.student=db.students.find(x=>String(x.id)===String(id))||s;
 state.page="verificationDetail";
 render();
 alert("Verifica salvata su Supabase.");
}

function today(){return `<div class="section"><h2>Oggi</h2>${db.students.filter(s=>s.early&&s.early!=="—").map(s=>`<div class="danger"><b>${s.name}</b> — ${s.early}</div>`).join("")||'<p class="muted">Nessuna uscita anticipata inserita.</p>'}</div>`}
function users(){return `<div class="section"><h2>Utenti</h2><p class="muted">In questa versione di test ogni utente riceve una password iniziale comune. Al primo accesso la password deve essere cambiata e diventa personale.</p><button class="btn primary" onclick="addUser()">+ Aggiungi utente</button><div class="table" style="margin-top:16px"><div class="row head"><div>Nome utente</div><div>Nome</div><div>Ruolo</div><div>Password</div><div></div></div>${db.users.map(u=>`<div class="row"><div><b>${u.username}</b></div><div>${u.display}</div><div>${u.role}</div><div>${u.mustChange?"Iniziale":"Personale"}</div><div></div></div>`).join("")}</div></div>`}
function addUser(){
 let username=prompt("Nome utente (es. nome.cognome)");
 if(!username)return;
 username=username.trim().toLowerCase();
 if(db.users.some(u=>u.username===username)){alert("Nome utente già esistente.");return;}
 let display=prompt("Nome e cognome")||username;
 let role=prompt("Ruolo: Docente / Famiglia / Admin")||"teacher";
 role=role.toLowerCase().includes("fam")?"family":role.toLowerCase().includes("admin")?"admin":"teacher";
 db.users.push({username,display,role,password:DEFAULT_PASSWORD,mustChange:true});
 save();render();
}
function passwordPage(){
 return `<div class="section"><h2>🔐 Modifica password</h2><p class="muted">La password iniziale è stata assegnata dalla scuola. Scegline ora una personale e non condividerla.</p>
 <form onsubmit="changePassword(event)"><div class="field"><label>Password attuale</label><input id="oldPw" type="password" required></div>
 <div class="field"><label>Nuova password</label><input id="newPw" type="password" minlength="8" required></div>
 <div class="field"><label>Conferma nuova password</label><input id="newPw2" type="password" minlength="8" required></div>
 <br><button class="btn primary">Salva nuova password</button></form></div>`;
}
async function changePassword(e){
 e.preventDefault();
 const oldPw=document.querySelector("#oldPw").value;
 const n1=document.querySelector("#newPw").value;
 const n2=document.querySelector("#newPw2").value;
 if(n1!==n2){alert("Le due nuove password non coincidono.");return;}
 if(n1.length<8){alert("La nuova password deve avere almeno 8 caratteri.");return;}
 const client=window.supabaseClient;
 if(!client || !state.authUser){alert("Sessione Supabase non disponibile.");return;}
 const {error:verify}=await client.auth.signInWithPassword({email:state.authUser.email,password:oldPw});
 if(verify){alert("La password attuale non è corretta.");return;}
 const {error}=await client.auth.updateUser({password:n1});
 if(error){alert("Impossibile modificare la password: "+error.message);return;}
 const {error:rpcError}=await client.rpc("complete_password_change");
 if(rpcError){alert("Password modificata, ma non è stato possibile completare lo stato del primo accesso. Controlla la funzione SQL indicata nelle istruzioni.");return;}
 state.user.must_change_password=false;
 state.page="home";
 alert("Password modificata correttamente.");
 render();
}

async function go(p){
 if(state.user?.must_change_password && p!=="password") p="password";
 state.page=p;
 state.student=null;
 if((p==="students"||p==="verification")&&(state.role==="teacher"||state.role==="admin")) await syncStaffFromSupabase();
 render();
}
async function logout(){
 if(window.supabaseClient) await window.supabaseClient.auth.signOut();
 state={role:null,page:"home",student:null,user:null,authUser:null,familyStudent:null};
 render();
}render();
restoreSession();
document.addEventListener('click', function(ev){
  const b=ev.target.closest('button'); if(!b) return;
  setTimeout(function(){
    const ef=document.getElementById('ef_delegateList');
    if(ef && !ef.dataset.ready){
      const heading=document.querySelector('h2');
      const st=state.familyStudent || null;
      if(st) renderEditFamilyStructuredRows(st);
      ef.dataset.ready='1';
    }
  },20);
});
