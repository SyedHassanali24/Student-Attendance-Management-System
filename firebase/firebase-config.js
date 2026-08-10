/* ==========================================
   FIREBASE SDK IMPORTS
========================================== */

import { initializeApp }
    from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getFirestore }
    from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { getAuth }
    from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getStorage }
    from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

/* ==========================================
   FIREBASE CONFIG
========================================== */

const firebaseConfig = {
    apiKey: "AIzaSyB1wfj-wzsIDxUMvAYvbbHlvNRQ4zRsgmM",
    authDomain: "sir-syed-hassan-ali-cms-7762e.firebaseapp.com",
    projectId: "sir-syed-hassan-ali-cms-7762e",
    storageBucket: "sir-syed-hassan-ali-cms-7762e.firebasestorage.app",
    messagingSenderId: "187642253527",
    appId: "1:187642253527:web:63ecfbdbdcea18c1d5e092"
};

/* ==========================================
   INITIALIZE FIREBASE
========================================== */

const app = initializeApp(firebaseConfig);

/* ==========================================
   EXPORT SERVICES
========================================== */

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("✅ Firebase Connected Successfully");

/* ==========================================
   ADMIN FEE MODULE LOADER
   Loads only after admin authentication is ready.
========================================== */

if (window.location.pathname.includes("admin-dashboard.html")) {
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
