import { db } from "../firebase/firebase-config.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const API_KEY = "AIzaSyB1wfj-wzsIDxUMvAYvbbHlvNRQ4zRsgmM";
const AUTH_EMAIL_DOMAIN = "@students.sshacms.local";
const TABLE_ID = "studentsTableBody";
const emailFor = studentId => `${String(studentId || "").trim().toUpperCase().replace(/\s+/g, "")}${AUTH_EMAIL_DOMAIN}`;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
}

function accountButton(student) {
  const enabled = student.loginEnabled === true && !!student.uid;
  return `<button type="button" class="action-btn student-login-btn${enabled ? " active" : ""}" data-account-id="${escapeHTML(student.id)}">${enabled ? "🔒 Login Active" : "🔑 Create Login"}</button>`;
}

async function getStudent(id) {
  const snap = await getDoc(doc(db, "students", id));
  if (!snap.exists()) throw new Error("Student not found.");
  return { id: snap.id, ...snap.data() };
}

async function authRequest(endpoint, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(API_KEY)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Firebase Authentication request failed.");
  return data;
}

async function createStudentLogin(student) {
  if (!student.studentId) return alert("Student ID missing hai.");
  if (student.loginEnabled === true && student.uid) return alert(`${student.name || "Student"} ka login already active hai.\n\nStudent ID: ${student.studentId}\nLogin ID: ${student.studentId}`);
  const password = window.prompt(`Create login password for ${student.name || "student"}\n\nStudent ID: ${student.studentId}\nMinimum 6 characters:`);
  if (password === null) return;
  if (password.length < 6) return alert("Password kam az kam 6 characters ka hona chahiye.");
  const button = document.querySelector(`[data-account-id="${CSS.escape(student.id)}"]`);
  if (button) { button.disabled = true; button.textContent = "⏳ Creating..."; }
  let account = null;
  try {
    const email = emailFor(student.studentId);
    account = await authRequest("signUp", { email, password, returnSecureToken: true });
    await updateDoc(doc(db, "students", student.id), { uid: account.localId, loginEnabled: true, loginEmail: email, loginCreatedAt: serverTimestamp(), loginUpdatedAt: serverTimestamp() });
    await setDoc(doc(db, "studentCredentials", student.id), { studentDocId: student.id, studentId: student.studentId, loginEmail: email, loginEnabled: true, authUid: account.localId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    alert(`✓ Student login created successfully.\n\nStudent: ${student.name || "Student"}\nLogin ID: ${student.studentId}\nPassword: ${password}\n\nLogin page: ${location.origin}/login.html\n\nPassword Firebase Authentication mein secure hai; plaintext database mein save nahi hota.`);
  } catch (error) {
    console.error(error);
    if (String(error.message).includes("EMAIL_EXISTS")) alert("Is Student ID ka Firebase login pehle se exist karta hai.");
    else alert(`Login create nahi ho saka.\n\n${error.message}`);
  } finally {
    if (button) { button.disabled = false; button.textContent = "🔑 Create Login"; }
  }
}

async function toggleLogin(student) {
  if (!student.uid) return createStudentLogin(student);
  if (!confirm(`${student.name || "Student"} ka login ${student.loginEnabled === true ? "disable" : "enable"} karna hai?`)) return;
  const enabled = student.loginEnabled !== true;
  try {
    await updateDoc(doc(db, "students", student.id), { loginEnabled: enabled, loginUpdatedAt: serverTimestamp() });
    await setDoc(doc(db, "studentCredentials", student.id), { loginEnabled: enabled, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) { alert(`Login access update failed:\n${error.message}`); }
}

async function decorateRows() {
  const tbody = document.getElementById(TABLE_ID);
  if (!tbody) return;
  for (const row of [...tbody.querySelectorAll("tr")]) {
    if (row.dataset.accountDecorated === "1") continue;
    const idButton = row.querySelector(".id-card-btn");
    const docId = idButton?.dataset?.id;
    const actions = row.querySelector(".action-buttons");
    if (!docId || !actions) continue;
    row.dataset.accountDecorated = "1";
    try {
      const student = await getStudent(docId);
      const holder = document.createElement("span");
      holder.innerHTML = accountButton(student);
      const button = holder.firstElementChild;
      button.addEventListener("click", async () => toggleLogin(await getStudent(docId)));
      actions.appendChild(button);
    } catch (error) {
      console.error("Student account UI error:", error);
      row.dataset.accountDecorated = "";
    }
  }
}

function init() {
  const style = document.createElement("style");
  style.textContent = ".student-login-btn{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #bfdbfe!important;font-weight:700!important}.student-login-btn.active{background:#ecfdf3!important;color:#047857!important;border-color:#a7f3d0!important}.student-login-btn:disabled{opacity:.65;cursor:wait!important}";
  document.head.appendChild(style);
  const tbody = document.getElementById(TABLE_ID);
  if (!tbody) return;
  new MutationObserver(() => decorateRows()).observe(tbody, { childList: true, subtree: true });
  decorateRows();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
