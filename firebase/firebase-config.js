import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { getAuth }
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
