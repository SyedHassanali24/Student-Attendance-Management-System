import { auth } from "../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const $ = id => document.getElementById(id);
const loginForm = $("loginForm");
const email = $("email");
const password = $("password");
const togglePassword = $("togglePassword");
const loginError = $("loginError");
const forgotPassword = $("forgotPasswordLink");
const loginButton = $("loginButton");

function message(text, color = "#2563eb") {
  if (!loginError) return;
  loginError.textContent = text;
  loginError.style.color = color;
}

togglePassword?.addEventListener("click", () => {
  const isPassword = password.type === "password";
  password.type = isPassword ? "text" : "password";
  togglePassword.innerHTML = isPassword
    ? '<i class="fa-solid fa-eye-slash"></i>'
    : '<i class="fa-solid fa-eye"></i>';
});

forgotPassword?.addEventListener("click", async e => {
  e.preventDefault();
  e.stopPropagation();
  const userEmail = String(email?.value || "").trim();
  if (!userEmail) {
    message("Pehle admin email enter karein, phir Forgot Password par click karein.", "#dc2626");
    email?.focus();
    return;
  }
  if (forgotPassword.dataset.busy === "1") return;
  forgotPassword.dataset.busy = "1";
  forgotPassword.style.pointerEvents = "none";
  message("Password reset email bheji ja rahi hai…", "#2563eb");
  try {
    // Password reset only needs a valid Firebase Auth account. Admin Firestore
    // authorization is intentionally NOT checked here.
    await Promise.race([
      sendPasswordResetEmail(auth, userEmail),
      new Promise((_, reject) => setTimeout(() => reject(new Error("RESET_TIMEOUT")), 15000))
    ]);
    message("✓ Reset email bhej di gayi hai. Inbox/Spam folder check karein.", "#059669");
  } catch (error) {
    console.error("Password reset error:", error);
    message(getFirebaseErrorMessage(error), "#dc2626");
  } finally {
    forgotPassword.dataset.busy = "0";
    forgotPassword.style.pointerEvents = "auto";
  }
});

function getFirebaseErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email ya password incorrect hai.";
    case "auth/user-not-found":
      return "Is email ka Firebase Authentication account nahi mila.";
    case "auth/invalid-email":
      return "Valid email address enter karein.";
    case "auth/user-disabled":
      return "Ye Firebase account disabled hai.";
    case "auth/too-many-requests":
      return "Bohat zyada attempts ho gaye hain. Kuch minutes baad try karein.";
    case "auth/network-request-failed":
      return "Network error. Internet connection check karein.";
    case "auth/operation-not-allowed":
      return "Firebase Authentication mein Email/Password provider ON nahi hai.";
    case "auth/unauthorized-continue-uri":
    case "auth/invalid-continue-uri":
      return "Firebase Authentication ke Authorized Domains mein aapki website domain add nahi hai.";
    case "auth/missing-android-pkg-name":
    case "auth/missing-continue-uri":
      return "Firebase password reset configuration incomplete hai.";
    default:
      return error?.message === "RESET_TIMEOUT"
        ? "Firebase response nahi de raha. Internet aur Firebase Authentication settings check karein."
        : `Password reset failed (${error?.code || "unknown-error"}).`;
  }
}

loginForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const userEmail = String(email?.value || "").trim();
  const userPassword = String(password?.value || "");
  if (!userEmail || !userPassword) {
    message("Email aur password dono enter karein.", "#dc2626");
    return;
  }
  if (loginButton) loginButton.disabled = true;
  message("Signing in…", "#2563eb");
  try {
    const credential = await signInWithEmailAndPassword(auth, userEmail, userPassword);
    console.log("Admin login successful:", credential.user.email, credential.user.uid);
    message("✓ Login successful. Opening dashboard…", "#059669");
    window.location.replace("admin-dashboard.html");
  } catch (error) {
    console.error("Firebase Admin Login Error:", error);
    message(getFirebaseErrorMessage(error), "#dc2626");
  } finally {
    if (loginButton) loginButton.disabled = false;
  }
});
