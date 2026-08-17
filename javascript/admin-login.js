import { auth } from "../firebase/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const $ = id => document.getElementById(id);
const loginForm = $("loginForm");
const email = $("email");
const password = $("password");
const togglePassword = $("togglePassword");
const loginError = $("loginError");
const forgotPassword = $("forgotPasswordLink");
const loginButton = $("loginButton");
const FIREBASE_API_KEY = "AIzaSyB1wfjw-zsIDxUMvAYvbbHlvNRQ4zRsgmM";

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

// Reliable password reset: direct Firebase Auth REST request with a hard timeout.
forgotPassword?.addEventListener("click", async e => {
  e.preventDefault();
  e.stopPropagation();
  const userEmail = String(email?.value || "").trim();
  if (!userEmail) {
    message("Pehle admin email enter karein, phir Forgot Password par click karein.", "#dc2626");
    email?.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    message("Valid email address enter karein.", "#dc2626");
    email?.focus();
    return;
  }
  if (forgotPassword.dataset.busy === "1") return;

  forgotPassword.dataset.busy = "1";
  forgotPassword.style.pointerEvents = "none";
  forgotPassword.setAttribute("aria-busy", "true");
  message("Password reset email bheji ja rahi hai…", "#2563eb");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: userEmail })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || "PASSWORD_RESET_FAILED");
    message("✓ Password reset email bheji gayi hai. Inbox aur Spam/Junk folder check karein.", "#059669");
  } catch (error) {
    console.error("Password reset error:", error);
    const code = error?.name === "AbortError" ? "TIMEOUT" : String(error?.message || "");
    message(getResetErrorMessage(code), "#dc2626");
  } finally {
    clearTimeout(timeout);
    forgotPassword.dataset.busy = "0";
    forgotPassword.style.pointerEvents = "auto";
    forgotPassword.removeAttribute("aria-busy");
  }
});

function getResetErrorMessage(code) {
  if (code === "TIMEOUT") return "Firebase response nahi de raha. Internet connection check karke dobara try karein.";
  if (code.includes("EMAIL_NOT_FOUND")) return "Is email ka Firebase Authentication account nahi mila.";
  if (code.includes("INVALID_EMAIL")) return "Valid email address enter karein.";
  if (code.includes("OPERATION_NOT_ALLOWED")) return "Firebase Authentication mein Email/Password provider ON nahi hai.";
  if (code.includes("TOO_MANY_ATTEMPTS")) return "Bohat zyada attempts ho gaye hain. Kuch minutes baad try karein.";
  if (code.includes("USER_DISABLED")) return "Ye Firebase account disabled hai.";
  return `Password reset failed (${code || "unknown-error"}).`;
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
    window.location.replace("admin-dashboard.html?auth=1");
  } catch (error) {
    console.error("Firebase Admin Login Error:", error);
    message(getLoginErrorMessage(error), "#dc2626");
  } finally {
    if (loginButton) loginButton.disabled = false;
  }
});

function getLoginErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Email ya password incorrect hai.";
    case "auth/user-not-found": return "Is email ka Firebase Authentication account nahi mila.";
    case "auth/invalid-email": return "Valid email address enter karein.";
    case "auth/user-disabled": return "Ye Firebase account disabled hai.";
    case "auth/too-many-requests": return "Bohat zyada attempts ho gaye hain. Kuch minutes baad try karein.";
    case "auth/network-request-failed": return "Network error. Internet connection check karein.";
    case "auth/operation-not-allowed": return "Firebase Authentication mein Email/Password provider ON nahi hai.";
    default: return `Login failed (${error?.code || "unknown-error"}).`;
  }
}
