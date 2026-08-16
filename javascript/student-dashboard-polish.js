/* =========================================================
   SSHACMS — STUDENT PORTAL POLISH / PROFILE FIX

   Purpose:
   1. Always load the logged-in student's own Firestore profile.
   2. Fix the duplicate profile IDs in the existing HTML without
      changing the existing dashboard structure.
   3. Replace the placeholder sidebar symbols with clean SVG icons.
   4. Keep the existing dashboard functionality and navigation intact.
========================================================= */

import { auth, db } from "../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


const text = (value, fallback = "—") =>
    value === undefined || value === null || String(value).trim() === ""
        ? fallback
        : String(value);


function setAll(id, value, fallback = "—") {
    document.querySelectorAll(`#${id}`).forEach(element => {
        element.textContent = text(value, fallback);
    });
}


async function getStudentByDocId(docId) {
    if (!docId) return null;

    try {
        const snapshot = await getDoc(doc(db, "students", docId));
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() };
        }
    } catch (error) {
        console.warn("Student document lookup failed:", error);
    }

    return null;
}


async function getStudentByQuery(field, value) {
    if (!value) return null;

    try {
        const snapshot = await getDocs(
            query(collection(db, "students"), where(field, "==", value))
        );

        if (!snapshot.empty) {
            const item = snapshot.docs[0];
            return { id: item.id, ...item.data() };
        }
    } catch (error) {
        console.warn(`Student ${field} lookup failed:`, error);
    }

    return null;
}


async function findCurrentStudent(user) {
    const savedDocId = localStorage.getItem("studentDocId");

    // The login flow already saves the exact Firestore document ID.
    // Prefer it so one student's dashboard can never fall onto another student.
    let student = await getStudentByDocId(savedDocId);

    if (student && student.uid && user?.uid && student.uid !== user.uid) {
        student = null;
    }

    if (!student && user?.uid) {
        student = await getStudentByQuery("uid", user.uid);
    }

    if (!student) {
        const savedStudentId = localStorage.getItem("studentId");
        student = await getStudentByQuery("studentId", savedStudentId);
    }

    if (!student && user?.email) {
        student = await getStudentByQuery("email", user.email);
    }

    return student;
}


function renderEveryProfileField(student) {
    const name = student.name || student.studentName || "Student";
    const studentId = student.studentId || "—";

    setAll("welcomeName", name, "Student");
    setAll("welcomeStudentId", studentId);
    setAll("topStudentName", name, "Student");
    setAll("topStudentId", studentId);

    // These IDs already exist in the overview. There are duplicate IDs in
    // the legacy profile section, so querySelectorAll intentionally updates
    // every matching element instead of allowing only the first one to change.
    setAll("profileName", name, "Student");
    setAll("profileStudentId", studentId);
    setAll("profileFatherName", student.fatherName);
    setAll("profilePhone", student.phone);
    setAll("profileCourse", student.course);
    setAll("profileBatch", student.batch);

    document.querySelectorAll("#profileAvatar").forEach(avatar => {
        avatar.textContent = name.trim().charAt(0).toUpperCase() || "S";
        avatar.setAttribute("aria-label", `${name} profile`);
    });

    // Professional, unique IDs for the visible profile-page fields.
    setAll("profilePageName", name, "Student");
    setAll("profilePageStudentId", studentId);
    setAll("profilePageFatherName", student.fatherName);
    setAll("profilePagePhone", student.phone);
    setAll("profilePageCourse", student.course);
    setAll("profilePageBatch", student.batch);
}


const icons = {
    overview: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>`,
    attendance: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"></path><path d="M4 19h16"></path><path d="M7 15l3-4 3 2 5-7"></path></svg>`,
    fees: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 9h18"></path><path d="M7 14h4"></path></svg>`,
    results: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"></path><path d="M15 3v4h4"></path><path d="M9 13h6M9 17h4M9 9h2"></path></svg>`,
    announcements: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4"></path><path d="M7 9l10-4v14L7 15z"></path><path d="M17 9.5a3 3 0 0 1 0 5"></path><path d="M7 15l1.5 5h3L10 16"></path></svg>`,
    profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20a7 7 0 0 1 14 0"></path></svg>`,
    logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path></svg>`
};


function polishSidebarIcons() {
    document.querySelectorAll(".student-nav .nav-item").forEach(item => {
        const section = item.dataset.section;
        const iconHolder = item.querySelector("span");
        if (iconHolder && icons[section]) {
            iconHolder.innerHTML = icons[section];
            iconHolder.classList.add("nav-icon-svg");
        }
    });

    const logoutIcon = document.querySelector("#studentLogout span");
    if (logoutIcon) {
        logoutIcon.innerHTML = icons.logout;
        logoutIcon.classList.add("nav-icon-svg");
    }
}


async function hydrateStudentPortal(user) {
    const student = await findCurrentStudent(user);

    if (!student) {
        console.warn("Student profile could not be matched to the signed-in account.");
        return;
    }

    localStorage.setItem("studentDocId", student.id || "");
    localStorage.setItem("studentId", student.studentId || "");
    localStorage.setItem("studentName", student.name || student.studentName || "");

    renderEveryProfileField(student);
    polishSidebarIcons();
}


onAuthStateChanged(auth, user => {
    if (!user) return;

    // Let the existing dashboard finish its own rendering first, then apply
    // the profile/visual fixes without changing its existing data modules.
    setTimeout(() => {
        hydrateStudentPortal(user).catch(error => {
            console.error("Student portal polish error:", error);
        });
    }, 150);
});


document.addEventListener("DOMContentLoaded", polishSidebarIcons);
