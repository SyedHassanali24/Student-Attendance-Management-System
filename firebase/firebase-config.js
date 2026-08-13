import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getFirestore, collection, doc, getDoc, getDocs, setDoc, serverTimestamp, increment, writeBatch }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getStorage }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyB1wfjw-zsIDxUMvAYvbbHlvNRQ4zRsgmM",
    authDomain: "sir-syed-hassan-ali-cms-7762e.firebaseapp.com",
    projectId: "sir-syed-hassan-ali-cms-7762e",
    storageBucket: "sir-syed-hassan-ali-cms-7762e.firebasestorage.app",
    messagingSenderId: "187642253527",
    appId: "1:187642253527:web:63ecfbdbdcea18c1d5e092"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("✅ Firebase Connected Successfully");

/* =========================================================
   LIFETIME STUDENT COUNTER
   The public homepage uses settings/publicStats.totalStudents.
   This number is cumulative: deleting a student never reduces it.
========================================================= */

const publicStatsRef = doc(db, "settings", "publicStats");

let lifetimeCounterReady = Promise.resolve();

async function ensureLifetimeStudentCounter() {

    const [studentsSnapshot, statsSnapshot] = await Promise.all([
        getDocs(collection(db, "students")),
        getDoc(publicStatsRef)
    ]);

    const currentStudents = studentsSnapshot.size;
    const savedTotal = Number(
        statsSnapshot.data()?.totalStudents || 0
    );

    // First-time setup: start from the students that already exist.
    // If the saved lifetime total is higher, never reduce it.
    if (!statsSnapshot.exists() || savedTotal < currentStudents) {
        await setDoc(
            publicStatsRef,
            {
                totalStudents: currentStudents,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );
    }
}

function setupCumulativeStudentCreation() {

    const studentForm = document.getElementById("studentForm");

    if (!studentForm) {
        return;
    }

    /*
       This capture listener runs before the older admin.js submit handler.
       It takes over only for NEW students. Editing existing students keeps
       using the existing admin.js logic.
    */
    studentForm.addEventListener("submit", async event => {

        const editId = document.getElementById("editStudentId")?.value;

        if (editId) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const saveButton = document.getElementById("saveStudentBtn");
        const message = document.getElementById("formMessage");

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = "Saving Student...";
        }

        if (message) {
            message.textContent = "Saving student...";
        }

        const studentData = {
            name: document.getElementById("studentName")?.value.trim() || "",
            fatherName: document.getElementById("fatherName")?.value.trim() || "",
            phone: document.getElementById("phone")?.value.trim() || "",
            course: document.getElementById("course")?.value.trim() || "",
            batch: document.getElementById("batch")?.value.trim() || "",
            admissionDate: document.getElementById("admissionDate")?.value || ""
        };

        try {

            await lifetimeCounterReady;

            const studentsCollection = collection(db, "students");
            const studentRef = doc(studentsCollection);

            const batch = writeBatch(db);

            batch.set(studentRef, {
                ...studentData,
                studentId: generateStudentId(),
                createdAt: serverTimestamp()
            });

            batch.set(
                publicStatsRef,
                {
                    totalStudents: increment(1),
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );

            // Student creation and lifetime counter update happen atomically.
            await batch.commit();

            if (message) {
                message.textContent = "Student added successfully.";
            }

            studentForm.reset();

            const modal = document.getElementById("studentModal");
            modal?.classList.remove("show");

        } catch (error) {

            console.error("Student save error:", error);

            if (message) {
                message.textContent =
                    "Error: " + error.message;
            }

        } finally {

            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = "Save Student";
            }

        }

    }, true);
}

function generateStudentId() {

    return (
        "STU-" +
        Math.floor(100000 + Math.random() * 900000)
    );
}

if (window.location.pathname.includes("admin-dashboard.html")) {

    onAuthStateChanged(auth, user => {

        if (!user) {
            return;
        }

        lifetimeCounterReady = ensureLifetimeStudentCounter()
            .catch(error => {
                console.error(
                    "Lifetime student counter initialization failed:",
                    error
                );
            });

        setupCumulativeStudentCreation();

    });

    const loadFeeModule = () => {
        if (auth.currentUser) {
            import("../javascript/fees.js").catch(error => {
                console.error("Fee module load error:", error);
            });
        } else {
            setTimeout(loadFeeModule, 150);
        }
    };

    loadFeeModule();
}
