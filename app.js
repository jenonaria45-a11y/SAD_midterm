// Vanilla JS front end. All business rules live in Supabase RPCs/RLS (see supabase/schema.sql).
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => new Date(d).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour12: false }) + " PHT";
const badge = t => `<span class="badge b-${esc(String(t).split(" ")[0])}">${esc(t)}</span>`;
let me, D = {}, tab = "dash", F = { ay: "2026-2027", sem: "1", q: "", prog: "", comp: "" }, editId = null;

function toast(m, bad) { const t = $("#toast"); t.textContent = m; t.className = bad ? "bad" : ""; t.style.display = "block"; setTimeout(() => t.style.display = "none", 4500); }
async function rpc(fn, args, ok) {
  const { error } = await sb.rpc(fn, args);
  if (error) return toast(error.message, true);
  toast(ok); await refresh();
}

async function boot() { const { data: { session } } = await sb.auth.getSession(); session ? enter() : authView(); }
function authView() {
  $("#who").innerHTML = ""; $("#app").innerHTML = `<form class="card auth" id="af"><h2>Sign in</h2>
  <label>Email<input type="email" id="em" required></label><label style="margin-top:10px">Password<input type="password" id="pw" minlength="6" required></label>
  <div class="row"><button class="btn" data-m="in">Sign in</button><button type="button" class="btn ghost" data-m="up">Sign up</button></div></form>`;
  const go = async m => {
    const c = { email: $("#em").value.trim(), password: $("#pw").value };
    const { error } = m === "up" ? await sb.auth.signUp(c) : await sb.auth.signInWithPassword(c);
    if (error) return toast(error.message, true);
    m === "up" ? toast("Account created. If email confirmation is on, confirm then sign in.") : enter();
  };
  $("#af").onsubmit = e => { e.preventDefault(); go("in"); };
  $("#af [data-m=up]").onclick = () => go("up");
}
async function enter() {
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from("profiles").select("*").eq("auth_id", user.id).single();
  if (error) return toast("Profile not found: " + error.message, true);
  me = data;
  $("#who").innerHTML = `${esc(me.full_name)} (${me.role}) <button class="btn ghost sm" id="lo">Log out</button>`;
  $("#lo").onclick = async () => { await sb.auth.signOut(); authView(); };
  refresh();
}
async function refresh() {
  const [s, p, a, pr] = await Promise.all([
    sb.from("submissions").select("*").order("submitted_at", { ascending: false }),
    sb.from("profiles").select("*").eq("role", "scholar").order("student_id"),
    sb.from("assignments").select("*"), sb.from("programs").select("*").order("name")]);
  D = { subs: s.data || [], scholars: p.data || [], asg: a.data || [], progs: pr.data || [] };
  D.pById = Object.fromEntries(D.scholars.map(x => [x.id, x]));
  D.progOf = Object.fromEntries(D.asg.map(x => [x.scholar_id, D.progs.find(g => g.id === x.program_id)]));
  me.role === "staff" ? staffView() : scholarView();
}

/* ---------- Scholar ---------- */
function scholarView() {
  const prog = D.progOf[me.id];
  $("#app").innerHTML = `<div class="card"><h2>${editId ? "Correct and resubmit" : "Submit semester grades"}</h2>
  <p class="muted">Program: <b>${esc(prog?.name || "Not assigned yet")}</b>${prog ? " · Deadline " + fmt(prog.deadline) : ""}</p>
  <form id="sf" class="grid">
   <label>Academic year<input id="ay" pattern="\\d{4}-\\d{4}" value="2026-2027" required ${editId ? "disabled" : ""}></label>
   <label>Semester<select id="sem" ${editId ? "disabled" : ""}><option>1</option><option>2</option><option>3</option></select></label>
   <label>GWA (1.00–5.00)<input id="gwa" type="number" step="0.01" min="1" max="5" required></label>
   <label>Enrolled units<input id="un" type="number" min="0" step="1" required></label>
   <label>Failed<input id="fl" type="number" min="0" step="1" value="0" required></label>
   <label>Incomplete<input id="ic" type="number" min="0" step="1" value="0" required></label>
   <label>Dropped<input id="dr" type="number" min="0" step="1" value="0" required></label>
   <label>Grade document reference<input id="ref" placeholder="e.g. REG-2026-1-0001.pdf" required></label>
   <button class="btn">${editId ? "Resubmit correction" : "Submit grades"}</button>
   ${editId ? '<button type="button" class="btn ghost" id="cx">Cancel</button>' : ""}</form></div>
  <div class="card"><h2>My submissions</h2><div class="scroll"><table><tr><th>Term</th><th>GWA</th><th>Units</th><th>F/INC/DRP</th><th>Evidence</th><th>Submitted</th><th>Status</th><th></th></tr>
  ${D.subs.map(s => `<tr><td>${esc(s.academic_year)} S${s.semester}</td><td>${s.gwa}</td><td>${s.units}</td><td>${s.failed_count}/${s.inc_count}/${s.dropped_count}</td><td>${esc(s.evidence_ref)}</td><td>${fmt(s.submitted_at)}</td>
   <td>${badge(s.verification_status)} ${s.compliance_result !== "Not Evaluated" ? badge(s.compliance_result) : ""} ${s.renewal_decision !== "None" ? badge(s.renewal_decision) : ""}
   ${s.return_reason ? `<div class="reasons">Returned: ${esc(s.return_reason)}</div>` : ""}${s.deficiency_reasons.length ? `<ul class="reasons">${s.deficiency_reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}</td>
   <td>${s.verification_status === "Returned" ? `<button class="btn sm" data-act="edit" data-id="${s.id}">Correct</button>` : ""}<button class="btn ghost sm" data-act="hist" data-id="${s.id}">History</button></td></tr>`).join("") || '<tr><td colspan="8" class="muted">No submissions yet. Fill in the form above.</td></tr>'}
  </table></div></div>`;
  if (editId) { const s = D.subs.find(x => x.id === editId); $("#ay").value = s.academic_year; $("#sem").value = s.semester; $("#gwa").value = s.gwa; $("#un").value = s.units; $("#fl").value = s.failed_count; $("#ic").value = s.inc_count; $("#dr").value = s.dropped_count; $("#ref").value = s.evidence_ref; $("#cx").onclick = () => { editId = null; scholarView(); }; }
  $("#sf").onsubmit = async e => {
    e.preventDefault();
    const v = { p_gwa: +$("#gwa").value, p_units: +$("#un").value, p_failed: +$("#fl").value, p_inc: +$("#ic").value, p_drop: +$("#dr").value, p_ref: $("#ref").value };
    if (editId) { const id = editId; editId = null; await rpc("resubmit_grades", { p_id: id, ...v }, "Correction resubmitted. Status: Pending verification."); }
    else await rpc("submit_grades", { p_ay: $("#ay").value, p_sem: +$("#sem").value, ...v }, "Grades submitted and timestamped.");
  };
}

/* ---------- Staff ---------- */
function staffView() {
  const term = D.subs.filter(s => s.academic_year === F.ay && String(s.semester) === F.sem);
  const rows = term.filter(s => {
    const p = D.pById[s.scholar_id], q = F.q.toLowerCase();
    return (!q || p?.student_id?.toLowerCase().includes(q) || p?.full_name.toLowerCase().includes(q))
      && (!F.prog || D.progOf[s.scholar_id]?.id === F.prog) && (!F.comp || s.compliance_result === F.comp);
  });
  const n = f => term.filter(f).length;
  const dash = `<div class="stats">
   <div class="stat"><b>${D.asg.length}</b>Assigned scholars</div>
   <div class="stat y"><b>${n(s => s.verification_status === "Pending")}</b>Pending verification</div>
   <div class="stat g"><b>${n(s => s.compliance_result === "Compliant")}</b>Compliant</div>
   <div class="stat r"><b>${n(s => s.compliance_result === "With Deficiency")}</b>With deficiency</div></div>
  <div class="card"><div class="grid">
   <label>Academic year<input id="fay" value="${esc(F.ay)}"></label>
   <label>Semester<select id="fsem">${[1, 2, 3].map(x => `<option ${F.sem == x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
   <label>Search ID or name<input id="fq" value="${esc(F.q)}"></label>
   <label>Program<select id="fpr"><option value="">All</option>${D.progs.map(g => `<option value="${g.id}" ${F.prog === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>
   <label>Compliance<select id="fco"><option value="">All</option>${["Not Evaluated", "Compliant", "With Deficiency"].map(c => `<option ${F.comp === c ? "selected" : ""}>${c}</option>`).join("")}</select></label></div></div>
  <div class="card"><h2>Submissions</h2><div class="scroll"><table><tr><th>ID / Scholar</th><th>Program</th><th>GWA</th><th>Units F/INC/DRP</th><th>Evidence · Submitted</th><th>Status</th><th>Actions</th></tr>
  ${rows.map(s => { const p = D.pById[s.scholar_id]; return `<tr><td><b>${esc(p?.student_id)}</b><br>${esc(p?.full_name)}</td><td>${esc(D.progOf[s.scholar_id]?.name)}</td><td>${s.gwa}</td>
   <td>${s.units} · ${s.failed_count}/${s.inc_count}/${s.dropped_count}</td><td>${esc(s.evidence_ref)}<br><span class="muted">${fmt(s.submitted_at)}</span></td>
   <td>${badge(s.verification_status)} ${badge(s.compliance_result)} ${badge(s.renewal_decision)}${s.return_reason ? `<div class="reasons">${esc(s.return_reason)}</div>` : ""}
   ${s.deficiency_reasons.length ? `<ul class="reasons">${s.deficiency_reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}${s.decision_note ? `<div class="muted">Note: ${esc(s.decision_note)}</div>` : ""}</td>
   <td>${[["verify", "Verify", "ok"], ["return", "Return", "warn"], ["eval", "Evaluate", ""], ["approve", "Approve", "ok"], ["hold", "Hold", "bad"], ["hist", "History", "ghost"]].map(([a, l, c]) => `<button class="btn sm ${c}" data-act="${a}" data-id="${s.id}">${l}</button>`).join("")}</td></tr>`; }).join("") || '<tr><td colspan="7" class="muted">No submissions match this term and filter.</td></tr>'}
  </table></div></div>`;
  const sch = `<div class="card"><h2>Register scholar</h2><form id="rf" class="grid">
   <label>Student ID<input id="rid" required></label><label>Full name<input id="rnm" required></label>
   <label>Email (scholar signs up with this)<input id="rem" type="email" required></label>
   <label>Program<select id="rpr">${D.progs.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></label><button class="btn">Register and assign</button></form></div>
  <div class="card"><h2>Scholars and policies</h2><div class="scroll"><table><tr><th>ID</th><th>Name</th><th>Email</th><th>Program</th></tr>
  ${D.scholars.map(p => `<tr><td>${esc(p.student_id)}</td><td>${esc(p.full_name)}</td><td>${esc(p.email)}</td><td>${esc(D.progOf[p.id]?.name || "Unassigned")}</td></tr>`).join("")}</table></div>
  <h3 style="margin-top:18px">Policy records (read by the evaluation function)</h3><div class="scroll"><table><tr><th>Program</th><th>Max GWA</th><th>Min units</th><th>Failed</th><th>INC</th><th>Dropped</th><th>Deadline</th></tr>
  ${D.progs.map(g => `<tr><td>${esc(g.name)}</td><td>${g.max_gwa}</td><td>${g.min_units}</td><td>${g.max_failed}</td><td>${g.max_inc}</td><td>${g.max_dropped}</td><td>${fmt(g.deadline)}</td></tr>`).join("")}</table></div></div>`;
  $("#app").innerHTML = `<div class="tabs"><button class="btn ${tab === "dash" ? "on" : ""}" data-tab="dash">Dashboard</button><button class="btn ${tab === "sch" ? "on" : ""}" data-tab="sch">Scholars</button></div>` + (tab === "dash" ? dash : sch);
  if (tab === "dash") {
    const bind = (id, k, ev = "change") => $(id).addEventListener(ev, e => { F[k] = e.target.value; staffView(); if (k === "q") { const i = $("#fq"); i.focus(); i.setSelectionRange(99, 99); } });
    bind("#fay", "ay"); bind("#fsem", "sem"); bind("#fq", "q", "input"); bind("#fpr", "prog"); bind("#fco", "comp");
  } else $("#rf").onsubmit = async e => {
    e.preventDefault();
    const { data: pr, error } = await sb.from("profiles").insert({ student_id: $("#rid").value.trim(), full_name: $("#rnm").value.trim(), email: $("#rem").value.trim().toLowerCase(), role: "scholar" }).select().single();
    if (error) return toast(error.message, true);
    const r = await sb.from("assignments").insert({ scholar_id: pr.id, program_id: $("#rpr").value });
    if (r.error) return toast(r.error.message, true);
    toast("Scholar registered and assigned."); refresh();
  };
}

/* ---------- Shared click actions ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-tab],[data-act]"); if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; return staffView(); }
  const id = t.dataset.id, a = t.dataset.act;
  if (a === "edit") { editId = id; return scholarView(); }
  if (a === "verify") return rpc("verify_submission", { p_id: id, p_status: "Verified", p_reason: null }, "Marked Verified.");
  if (a === "return") { const r = prompt("Reason for returning this evidence:"); return r === null ? 0 : rpc("verify_submission", { p_id: id, p_status: "Returned", p_reason: r }, "Returned to scholar."); }
  if (a === "eval") return rpc("evaluate_submission", { p_id: id }, "Evaluation recorded.");
  if (a === "approve" || a === "hold") { const n = prompt("Decision note:"); return n === null ? 0 : rpc("decide_renewal", { p_id: id, p_decision: a === "approve" ? "Approved" : "Held", p_note: n }, "Renewal " + (a === "approve" ? "approved." : "held.")); }
  if (a === "hist") {
    const { data, error } = await sb.from("history").select("*").eq("submission_id", id).order("created_at");
    if (error) return toast(error.message, true);
    const who = x => D.pById[x]?.full_name || (x === me.id ? me.full_name : "Staff");
    $("#dlgBody").innerHTML = `<h2>History</h2>` + (data.map(h => `<p><b>${esc(h.action)}</b> — ${esc(who(h.actor_id))}<br><span class="muted">${fmt(h.created_at)}${h.note ? " · " + esc(h.note) : ""}</span></p>`).join("") || "<p>No entries.</p>");
    $("#dlg").showModal();
  }
});
boot();
