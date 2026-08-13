import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, serverTimestamp, increment, writeBatch, onSnapshot }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

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

console.log("Firebase Connected Successfully");

const publicStatsRef = doc(db, "settings", "publicStats");
let lifetimeCounterReady = Promise.resolve();

async function ensureLifetimeStudentCounter() {
    const [studentsSnapshot, statsSnapshot] = await Promise.all([
        getDocs(collection(db, "students")),
        getDoc(publicStatsRef)
    ]);

    const currentStudents = studentsSnapshot.size;
    const savedTotal = Number(statsSnapshot.data()?.totalStudents || 0);

    if (!statsSnapshot.exists() || savedTotal < currentStudents) {
        await setDoc(publicStatsRef, {
            totalStudents: currentStudents,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}

function setupCumulativeStudentCreation() {
    const studentForm = document.getElementById("studentForm");
    if (!studentForm) return;

    studentForm.addEventListener("submit", async event => {
        const editId = document.getElementById("editStudentId")?.value;
        if (editId) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const saveButton = document.getElementById("saveStudentBtn");
        const message = document.getElementById("formMessage");
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = "Saving Student...";
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
            const studentRef = doc(collection(db, "students"));
            const batch = writeBatch(db);

            batch.set(studentRef, {
                ...studentData,
                studentId: "STU-" + Math.floor(100000 + Math.random() * 900000),
                createdAt: serverTimestamp()
            });

            batch.set(publicStatsRef, {
                totalStudents: increment(1),
                updatedAt: serverTimestamp()
            }, { merge: true });

            await batch.commit();

            if (message) message.textContent = "Student added successfully.";
            studentForm.reset();
            document.getElementById("studentModal")?.classList.remove("show");
        } catch (error) {
            console.error("Student save error:", error);
            if (message) message.textContent = "Error: " + error.message;
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = "Save Student";
            }
        }
    }, true);
}

if (window.location.pathname.includes("admin-dashboard.html")) {
    onAuthStateChanged(auth, user => {
        if (!user) return;
        lifetimeCounterReady = ensureLifetimeStudentCounter().catch(error => console.error("Lifetime counter initialization failed:", error));
        setupCumulativeStudentCreation();
    });

    const loadFeeModule = () => {
        if (auth.currentUser) {
            import("../javascript/fees.js").catch(error => console.error("Fee module load error:", error));
        } else {
            setTimeout(loadFeeModule, 150);
        }
    };
    loadFeeModule();
}

if (window.location.pathname.endsWith("/") || window.location.pathname.endsWith("index.html")) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const todayKey = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    onSnapshot(publicStatsRef, snapshot => {
        setText("studentCount", Number(snapshot.data()?.totalStudents || 0));
    }, error => console.error("Homepage student counter error:", error));

    onSnapshot(collection(db, "attendance"), snapshot => {
        const today = todayKey();
        const unique = new Set();
        snapshot.docs.forEach(item => {
            const record = item.data();
            if (record.date === today) unique.add(record.studentDocId || record.studentId || item.id);
        });
        setText("attendanceToday", unique.size);
    }, error => console.error("Homepage attendance stats error:", error));

    setText("activeCourses", 6);
    setText("successRate", "98%");
}
