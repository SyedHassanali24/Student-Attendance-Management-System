/* =========================================================
   STUDENT ACCOUNT MANAGEMENT — FIXED
   Admin creates student Firebase Auth accounts without
   logging the administrator out.

   Passwords are NEVER stored in Firestore.
========================================================= */

import { auth, db } from "../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* =========================================================
   SECONDARY FIREBASE APP

   IMPORTANT: getApps() prevents the common
   "Firebase App already exists" error if this module
   is loaded again after a dashboard refresh/navigation.
========================================================= */

const secondaryApp = getApps().some(
    app => app.name === "studentAccountCreator"
)
    ? getApp("studentAccountCreator")
    : initializeApp(
        auth.app.options,
        "studentAccountCreator"
    );

const secondaryAuth = getAuth(secondaryApp);


function studentLoginEmail(studentId) {
    return (
        String(studentId || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "") +
        "@students.sshacms.local"
    );
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   LOGIN MODAL
========================================================= */

function showLoginModal(student) {
    closeLoginModal();

    const studentId = String(student.studentId || "").trim().toUpperCase();
    const email = studentLoginEmail(studentId);

    const overlay = document.createElement("div");
    overlay.id = "studentLoginModal";
    overlay.innerHTML = `
        <div class="student-login-overlay">
            <div class="student-login-modal" role="dialog" aria-modal="true">
                <div class="student-login-modal-head">
                    <div>
                        <span class="student-login-kicker">STUDENT ACCOUNT</span>
                        <h3>Create Student Login</h3>
                        <p>${escapeHTML(student.name || "Student")}</p>
                    </div>
                    <button type="button" class="student-login-close" data-login-close aria-label="Close">×</button>
                </div>

                <div class="student-login-info">
                    <div><span>Student ID</span><strong>${escapeHTML(studentId)}</strong></div>
                    <div><span>Login Email</span><strong>${escapeHTML(email)}</strong></div>
                </div>

                <form id="studentLoginForm" class="student-login-form">
                    <label>
                        Password
                        <input id="studentLoginPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters" required>
                    </label>
                    <label>
                        Confirm Password
                        <input id="studentLoginConfirm" type="password" minlength="6" autocomplete="new-password" placeholder="Enter password again" required>
                    </label>
                    <p id="studentLoginMessage" class="student-login-message"></p>
                    <div class="student-login-actions">
                        <button type="button" class="student-login-cancel" data-login-close>Cancel</button>
                        <button type="submit" class="student-login-submit">Create Login</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-login-close]").forEach(button => {
        button.addEventListener("click", closeLoginModal);
    });

    overlay.querySelector(".student-login-overlay")?.addEventListener("click", event => {
        if (event.target === event.currentTarget) closeLoginModal();
    });

    overlay.querySelector("#studentLoginForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        await createStudentAccount(student.id, overlay);
    });

    overlay.querySelector("#studentLoginPassword")?.focus();
}

function closeLoginModal() {
    document.getElementById("studentLoginModal")?.remove();
}

function setLoginMessage(overlay, message, type = "error") {
    const element = overlay?.querySelector("#studentLoginMessage");
    if (!element) return;
    element.textContent = message;
    element.className = `student-login-message ${type}`;
}


/* =========================================================
   ADD LOGIN BUTTONS
========================================================= */

function addLoginButtons() {
    const rows = document.querySelectorAll("#studentsTableBody tr");

    rows.forEach(row => {
        const idCardButton = row.querySelector(".id-card-btn");
        if (!idCardButton) return;

        if (row.querySelector(".student-login-btn")) return;

        const studentDocId = idCardButton.dataset.id;
        if (!studentDocId) return;

        const container = idCardButton.parentElement;
        if (!container) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-btn student-login-btn";
        button.dataset.id = studentDocId;
        button.innerHTML = "🔐 Create Login";
        button.title = "Create a Firebase login for this student";

        container.appendChild(button);
    });
}


/* =========================================================
   CLICK HANDLER

   Event delegation makes the button reliable even when
   admin.js redraws the student table.
========================================================= */

function setupLoginClickHandler() {
    const tableBody = document.getElementById("studentsTableBody");
    if (!tableBody || tableBody.dataset.loginHandlerReady === "1") return;

    tableBody.dataset.loginHandlerReady = "1";

    tableBody.addEventListener("click", async event => {
        const button = event.target.closest(".student-login-btn");
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const studentDocId = button.dataset.id;
        if (!studentDocId) {
            alert("Student record ID is missing.");
            return;
        }

        try {
            button.disabled = true;
            button.dataset.oldText = button.innerHTML;
            button.innerHTML = "⏳ Loading...";

            const snapshot = await getDoc(doc(db, "students", studentDocId));

            if (!snapshot.exists()) {
                alert("Student record was not found.");
                return;
            }

            const student = { id: snapshot.id, ...snapshot.data() };

            if (student.uid && student.loginEnabled === true) {
                alert(
                    "Login already exists for this student.\n\n" +
                    "Student ID: " + (student.studentId || "-") +
                    "\n\nThe existing password cannot be displayed."
                );
                return;
            }

            showLoginModal(student);

        } catch (error) {
            console.error("Student login button error:", error);
            alert("Unable to open Create Login.\n\n" + (error.message || error));
        } finally {
            button.disabled = false;
            button.innerHTML = button.dataset.oldText || "🔐 Create Login";
        }
    });
}


/* =========================================================
   CREATE FIREBASE ACCOUNT
========================================================= */

async function createStudentAccount(studentDocId, overlay) {
    const passwordInput = overlay.querySelector("#studentLoginPassword");
    const confirmInput = overlay.querySelector("#studentLoginConfirm");
    const submitButton = overlay.querySelector(".student-login-submit");

    const password = passwordInput?.value || "";
    const confirmPassword = confirmInput?.value || "";

    if (password.length < 6) {
        setLoginMessage(overlay, "Password must be at least 6 characters long.");
        passwordInput?.focus();
        return;
    }

    if (password !== confirmPassword) {
        setLoginMessage(overlay, "Passwords do not match.");
        confirmInput?.focus();
        return;
    }

    try {
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";
        setLoginMessage(overlay, "Creating secure Firebase account...", "loading");

        const studentRef = doc(db, "students", studentDocId);
        const snapshot = await getDoc(studentRef);

        if (!snapshot.exists()) {
            throw new Error("Student record was not found.");
        }

        const student = snapshot.data();
        const studentId = String(student.studentId || "").trim().toUpperCase();
        const studentName = student.name || "Student";

        if (!studentId) {
            throw new Error("This student does not have a Student ID.");
        }

        if (student.uid && student.loginEnabled === true) {
            throw new Error("A login already exists for this student.");
        }

        const email = studentLoginEmail(studentId);

        const credential = await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
        );

        await updateDoc(studentRef, {
            uid: credential.user.uid,
            loginEmail: email,
            loginEnabled: true,
            loginCreatedAt: new Date()
        });

        setLoginMessage(overlay, "Student login created successfully.", "success");

        overlay.querySelector(".student-login-modal")?.insertAdjacentHTML(
            "beforeend",
            `<div class="student-login-success-box">
                <strong>Login Created</strong>
                <span>Student ID: ${escapeHTML(studentId)}</span>
                <span>Password: <b>${escapeHTML(password)}</b></span>
                <small>Give these credentials to the student. The password is not stored in Firestore.</small>
            </div>`
        );

        submitButton.textContent = "Done";
        submitButton.disabled = false;
        submitButton.type = "button";
        submitButton.onclick = closeLoginModal;

    } catch (error) {
        console.error("Student account creation error:", error);

        let message = error.message || "Unable to create student account.";

        if (error.code === "auth/email-already-in-use") {
            message = "A Firebase account already exists for this Student ID.";
        } else if (error.code === "auth/weak-password") {
            message = "Password is too weak. Use at least 6 characters.";
        } else if (error.code === "auth/operation-not-allowed") {
            message = "Firebase Email/Password Authentication is disabled. Enable Email/Password in Firebase Authentication → Sign-in method.";
        } else if (error.code === "auth/invalid-api-key") {
            message = "Firebase API configuration is invalid. Check firebase-config.js.";
        }

        setLoginMessage(overlay, message);
        submitButton.disabled = false;
        submitButton.textContent = "Create Login";
    }
}


/* =========================================================
   STYLES
========================================================= */

function addLoginStyles() {
    if (document.getElementById("studentLoginStyles")) return;

    const style = document.createElement("style");
    style.id = "studentLoginStyles";
    style.textContent = `
        .student-login-btn{
            background:#eef2ff !important;
            color:#3730a3 !important;
            border:1px solid #c7d2fe !important;
            cursor:pointer !important;
        }
        .student-login-btn:disabled{opacity:.65;cursor:wait !important}
        .student-login-overlay{
            position:fixed;inset:0;z-index:99999;
            display:flex;align-items:center;justify-content:center;
            padding:20px;background:rgba(15,23,42,.58);backdrop-filter:blur(5px)
        }
        .student-login-modal{
            width:min(520px,100%);background:#fff;border-radius:18px;
            box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden
        }
        .student-login-modal-head{display:flex;justify-content:space-between;gap:20px;padding:24px 26px 18px;border-bottom:1px solid #e5e7eb}
        .student-login-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}
        .student-login-modal h3{margin:5px 0 3px;font-size:22px;color:#0f172a}
        .student-login-modal-head p{margin:0;color:#64748b;font-size:13px}
        .student-login-close{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:10px;font-size:22px;color:#475569;cursor:pointer}
        .student-login-info{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:18px 26px;background:#f8fafc}
        .student-login-info div{display:flex;flex-direction:column;gap:4px;min-width:0}
        .student-login-info span{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
        .student-login-info strong{font-size:13px;color:#0f172a;word-break:break-word}
        .student-login-form{padding:22px 26px 26px}
        .student-login-form label{display:flex;flex-direction:column;gap:7px;margin-bottom:15px;font-size:13px;font-weight:700;color:#334155}
        .student-login-form input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid #cbd5e1;border-radius:10px;outline:none;font:inherit;font-weight:400}
        .student-login-form input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.12)}
        .student-login-message{min-height:20px;margin:4px 0 12px;font-size:13px;color:#dc2626}
        .student-login-message.success{color:#047857}.student-login-message.loading{color:#475569}
        .student-login-actions{display:flex;justify-content:flex-end;gap:10px}
        .student-login-cancel,.student-login-submit{border:0;border-radius:10px;padding:11px 17px;font-weight:700;cursor:pointer}
        .student-login-cancel{background:#f1f5f9;color:#334155}.student-login-submit{background:#172554;color:#fff}
        .student-login-submit:disabled{opacity:.65;cursor:wait}
        .student-login-success-box{margin:0 26px 26px;padding:15px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:12px;display:flex;flex-direction:column;gap:5px;color:#065f46}
        .student-login-success-box small{margin-top:4px;color:#047857}
        @media(max-width:560px){.student-login-info{grid-template-columns:1fr}.student-login-modal-head,.student-login-form{padding-left:18px;padding-right:18px}.student-login-success-box{margin-left:18px;margin-right:18px}}
    `;
    document.head.appendChild(style);
}


/* =========================================================
   START
========================================================= */

function startStudentAccountModule() {
    addLoginStyles();

    const waitForTable = () => {
        const tableBody = document.getElementById("studentsTableBody");

        if (!tableBody) {
            setTimeout(waitForTable, 250);
            return;
        }

        addLoginButtons();
        setupLoginClickHandler();

        new MutationObserver(() => {
            addLoginButtons();
        }).observe(tableBody, { childList: true, subtree: true });
    };

    waitForTable();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startStudentAccountModule, { once: true });
} else {
    startStudentAccountModule();
}
