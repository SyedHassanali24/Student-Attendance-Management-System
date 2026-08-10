/* ==========================================
   FIREBASE IMPORTS
========================================== */

import { auth } from "../firebase/firebase-config.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

/* ==========================================
   ELEMENTS
========================================== */

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginError = document.getElementById("loginError");
const forgotPassword = document.querySelector('.remember-area a');

/* ==========================================
   SHOW / HIDE PASSWORD
========================================== */

togglePassword?.addEventListener("click", () => {
    if (password.type === "password") {
        password.type = "text";
        togglePassword.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
        password.type = "password";
        togglePassword.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
});

/* ==========================================
   FORGOT PASSWORD
========================================== */

forgotPassword?.addEventListener("click", async (e) => {
    e.preventDefault();

    const userEmail = email.value.trim();

    if (!userEmail) {
        loginError.style.color = "#dc2626";
        loginError.textContent = "Enter your email address first.";
        email.focus();
        return;
    }

    try {
        await sendPasswordResetEmail(auth, userEmail);
        loginError.style.color = "#059669";
        loginError.textContent = "Password reset email sent. Check your inbox.";
    } catch (error) {
        console.error("Password reset error:", error);
        loginError.style.color = "#dc2626";
        loginError.textContent = getFirebaseErrorMessage(error);
    }
});

/* ==========================================
   FIREBASE ERROR MESSAGE
========================================== */

function getFirebaseErrorMessage(error) {
    switch (error?.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Email or password is incorrect. Please verify the Firebase Authentication account.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/user-disabled":
            return "This admin account is disabled in Firebase Authentication.";
        case "auth/too-many-requests":
            return "Too many login attempts. Please wait a few minutes and try again.";
        case "auth/network-request-failed":
            return "Network error. Check your internet connection and try again.";
        case "auth/operation-not-allowed":
            return "Email/Password sign-in is disabled in Firebase Authentication.";
        default:
            return `Login failed (${error?.code || "unknown-error"}). Check Firebase Authentication.`;
    }
}

/* ==========================================
   LOGIN
========================================== */

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userEmail = email.value.trim();
    const userPassword = password.value;

    loginError.textContent = "Signing in...";
    loginError.style.color = "#2563eb";

    try {
        const credential = await signInWithEmailAndPassword(
            auth,
            userEmail,
            userPassword
        );

        console.log("Admin login successful:", credential.user.email);
        loginError.textContent = "Login successful. Opening dashboard...";
        loginError.style.color = "#059669";

        window.location.replace("admin-dashboard.html");

    } catch (error) {
        console.error("Firebase Admin Login Error:", error);
        loginError.textContent = getFirebaseErrorMessage(error);
        loginError.style.color = "#dc2626";
    }
});
