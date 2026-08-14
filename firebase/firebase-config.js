import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp,
    increment,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

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

/* =========================================================
   LIFETIME STUDENT COUNTER

   IMPORTANT:
   This file must NEVER create students.
   Student creation is controlled only by the Admin Student
   Management form in javascript/admin.js.

   The public counter is cumulative:
   - Existing students initialize the counter.
   - A newly added student increases it.
   - Deleting a student never decreases it.
========================================================= */

const publicStatsRef = doc(db, "settings", "publicStats");
let lifetimeCounterReady = Promise.resolve();
let lifetimeCounterUnsubscribe = null;

async function ensureLifetimeStudentCounter() {

    const [studentsSnapshot, statsSnapshot] = await Promise.all([
        getDocs(collection(db, "students")),
        getDoc(publicStatsRef)
    ]);

    const currentStudents = studentsSnapshot.size;
    const savedTotal = Number(
        statsSnapshot.data()?.totalStudents || 0
    );

    // Never reduce an already saved lifetime total.
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

async function setupLifetimeStudentCounterSync() {

    await lifetimeCounterReady;

    if (lifetimeCounterUnsubscribe) {
        lifetimeCounterUnsubscribe();
    }

    let firstSnapshot = true;

    lifetimeCounterUnsubscribe = onSnapshot(
        collection(db, "students"),
        async snapshot => {

            // Firestore reports all existing documents as "added"
            // on the first snapshot. Those are already included in
            // the initial lifetime total, so do not count them again.
            if (firstSnapshot) {
                firstSnapshot = false;
                return;
            }

            const newlyAddedStudents = snapshot
                .docChanges()
                .filter(change => change.type === "added")
                .length;

            if (!newlyAddedStudents) {
                return;
            }

            try {

                await setDoc(
                    publicStatsRef,
                    {
                        totalStudents: increment(newlyAddedStudents),
                        updatedAt: serverTimestamp()
                    },
                    { merge: true }
                );

            } catch (error) {

                console.error(
                    "Lifetime student counter update failed:",
                    error
                );
            }
        },
        error => {
            console.error(
                "Lifetime student counter listener failed:",
                error
            );
        }
    );
}

/* =========================================================
   ADMIN DASHBOARD INITIALIZATION

   There is deliberately NO studentForm submit listener here.
   The admin.js file owns student creation.
   This prevents duplicate/automatic student documents.
========================================================= */

if (window.location.pathname.includes("admin-dashboard.html")) {

    onAuthStateChanged(auth, user => {

        if (!user) {
            return;
        }

        lifetimeCounterReady = ensureLifetimeStudentCounter()
            .catch(error => {
                console.error(
                    "Lifetime counter initialization failed:",
                    error
                );
            });

        setupLifetimeStudentCounterSync()
            .catch(error => {
                console.error(
                    "Lifetime counter listener setup failed:",
                    error
                );
            });
    });

    const loadFeeModule = () => {

        if (auth.currentUser) {

            import("../javascript/fees.js")
                .catch(error => {
                    console.error(
                        "Fee module load error:",
                        error
                    );
                });

        } else {
            setTimeout(loadFeeModule, 150);
        }
    };

    loadFeeModule();
}

/* =========================================================
   PUBLIC HOMEPAGE STATS
========================================================= */

if (
    window.location.pathname.endsWith("/") ||
    window.location.pathname.endsWith("index.html")
) {

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const todayKey = () => {

        const d = new Date();

        return `${d.getFullYear()}-${String(
            d.getMonth() + 1
        ).padStart(2, "0")}-${String(
            d.getDate()
        ).padStart(2, "0")}`;
    };

    onSnapshot(
        publicStatsRef,
        snapshot => {

            setText(
                "studentCount",
                Number(snapshot.data()?.totalStudents || 0)
            );
        },
        error => console.error(
            "Homepage student counter error:",
            error
        )
    );

    onSnapshot(
        collection(db, "attendance"),
        snapshot => {

            const today = todayKey();
            const unique = new Set();

            snapshot.docs.forEach(item => {

                const record = item.data();

                if (record.date === today) {
                    unique.add(
                        record.studentDocId ||
                        record.studentId ||
                        item.id
                    );
                }
            });

            setText("attendanceToday", unique.size);
        },
        error => console.error(
            "Homepage attendance stats error:",
            error
        )
    );

    setText("activeCourses", 6);
    setText("successRate", "98%");
}
