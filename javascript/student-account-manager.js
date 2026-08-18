import { auth, db } from "../firebase/firebase-config.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const API_KEY = "AIzaSyB1wfjw-zsIDxUMvAYvbbHlvNRQ4zRsgmM";
const AUTH_EMAIL_DOMAIN = "@students.sshacms.local";
const TABLE_ID = "studentsTableBody";

const emailFor = studentId => `${String(studentId || "").trim().toUpperCase().replace(/\s+/g, "")}${AUTH_EMAIL_DOMAIN}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[c]));
}

function accountButton(student) {
  const enabled = student.loginEnabled === true && !!student.uid;
  const label = enabled ? "🔒 Disable Login" : "🔑 Create Login";
  const cls = enabled ? "student-login-btn active" : "student-login-btn";
  return `<button type="button" class="action-btn ${cls}" data-account-id="${escapeHTML(student.id)}">${label}</button>`;
}

async function getStudent(id) {
  const snap = await getDoc(doc(db, "students", id));
  if (!snap.exists()) throw new Error("Student not found.");
  return { id: snap.id, ...snap.data() };
}

async function firebaseAuthRequest(endpoint, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Firebase Authentication request failed.");
  return data;
}

function validatePassword(password) {
  if (!password || password.length < 6) return "Password kam az kam 6 characters ka hona chahiye.";
  return "";
}

async function createStudentLogin(student) {
  if (!student.studentId) throw new Error("Student ID missing hai.");
  if (student.loginEnabled === true && student.uid) {
    alert(`${student.name || "Student"} ka login already active hai.\n\nStudent ID: ${student.studentId}\nLogin email: ${emailFor(student.studentId)}`);
    return;
  }

  const password = window.prompt(
    `Create password for ${student.name || "student"}\n\nStudent ID: ${student.studentId}\nMinimum 6 characters.\n\nPassword enter karein:`
  );
  if (password === null) return;
  const passwordError = validatePassword(password);
  if (passwordError) {
    alert(passwordError);
    return;
  }

  const button = document.querySelector(`[data-account-id="${CSS.escape(student.id)}"]`);
  if (button) { button.disabled = true; button.textContent = "⏳ Creating..."; }

  const email = emailFor(student.studentId);
  let createdAuth = null;
  try {
    createdAuth = await firebaseAuthRequest("signUp", { email, password, returnSecureToken: true });

    await updateDoc(doc(db, "students", student.id), {
      uid: createdAuth.localId,
      loginEnabled: true,
      loginEmail: email,
      loginCreatedAt: serverTimestamp(),
      loginUpdatedAt: serverTimestamp()
    });

    await setDoc(doc(db, "studentCredentials", student.id), {
      studentDocId: student.id,
      studentId: student.studentId,
      loginEmail: email,
      loginEnabled: true,
      authUid: createdAuth.localId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    alert(
      `✓ Student login created successfully.\n\nName: ${student.name || "Student"}\nStudent ID: ${student.studentId}\nLogin ID: ${student.studentId}\nPassword: ${password}\n\nStudent login page:\n${location.origin}/login.html\n\nPassword ko secure jagah par save karein. System password ko Firestore mein store nahi karta.`
    );
  } catch (error) {
    console.error("Student login creation failed:", error);
    if (createdAuth?.idToken) {
      try { await firebaseAuthRequest("delete", { idToken: createdAuth.idToken }); } catch (cleanupError) { console.error("Auth cleanup failed:", cleanupError); }
    }
    if (String(error.message).includes("EMAIL_EXISTS")) {
      alert("Is Student ID ka Firebase login pehle se exist karta hai. Student record ko manually link/verify karna zaroori hai.");
    } else {
      alert(`Student login create nahi ho saka.\n\n${error.message}`);
    }
  } finally {
    if (button) { button.disabled = false; button.textContent = "🔑 Create Login"; }
  }
}

async function toggleStudentLogin(student) {
  if (!student.uid) return createStudentLogin(student);
  const nextEnabled = student.loginEnabled !== true;
  const action = nextEnabled ? "enable" : "disable";
  if (!confirm(`${student.name || "Student"} ka login ${action} karna hai?`)) return;

  const button = document.querySelector(`[data-account-id="${CSS.escape(student.id)}"]`);
  if (button) { button.disabled = true; button.textContent = "⏳ Updating..."; }
  try {
    await updateDoc(doc(db, "students", student.id), {
      loginEnabled: nextEnabled,
      loginUpdatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "studentCredentials", student.id), {
      loginEnabled: nextEnabled,
      updatedAt: serverTimestamp()
    }, { merge: true });
    alert(nextEnabled ? "✓ Student login enabled." : "✓ Student login disabled.");
  } catch (error) {
    console.error(error);
    alert(`Login access update failed:\n${error.message}`);
  } finally {
    if (button) { button.disabled = false; button.textContent = nextEnabled ? "🔒 Disable Login" : "🔑 Enable Login"; }
  }
}

async function decorateRows() {
  const tbody = document.getElementById(TABLE_ID);
  if (!tbody) return;
  const rows = [...tbody.querySelectorAll("tr")];
  for (const row of rows) {
    const idButton = row.querySelector(".id-card-btn");
    const docId = idButton?.dataset?.id;
    if (!docId || row.dataset.accountDecorated === "1") continue;
    row.dataset.accountDecorated = "1";
    try {
      const student = await getStudent(docId);
      const actions = row.querySelector(".action-buttons");
      if (!actions) continue;
      const wrapper = document.createElement("span");
      wrapper.innerHTML = accountButton(student);
      const button = wrapper.firstElementChild;
      button.addEventListener("click", async () => {
        const latest = await getStudent(docId);
        await toggleStudentLogin(latest);
      });
      actions.appendChild(button);
    } catch (error) {
      console.error("Unable to load student account state:", error);
    }
  }
}

function injectAccountStyles() {
  if (document.getElementById("student-account-manager-styles")) return;
  const style = document.createElement("style");
  style.id = "student-account-manager-styles";
  style.textContent = `
    .student-login-btn{background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #bfdbfe!important;}
    .student-login-btn.active{background:#fff7ed!important;color:#c2410c!important;border-color:#fed7aa!important;}
    .student-login-btn:disabled{opacity:.65;cursor:wait;}
  `;
  document.head.appendChild(style);
}

function init() {
  injectAccountStyles();
  const tbody = document.getElementById(TABLE_ID);
  if (!tbody) return;
  const observer = new MutationObserver(() => { decorateRows(); });
  observer.observe(tbody, { childList: true, subtree: true });
  decorateRows();
  sleep(1200).then(decorateRows);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
