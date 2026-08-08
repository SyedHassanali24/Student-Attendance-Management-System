/* ==========================================
   FIREBASE IMPORTS
========================================== */

import { auth } from "../firebase/firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   ELEMENTS
========================================== */

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginError = document.getElementById("loginError");


/* ==========================================
   SHOW / HIDE PASSWORD
========================================== */

togglePassword.addEventListener("click", () => {

    if (password.type === "password") {

        password.type = "text";

        togglePassword.innerHTML =
            '<i class="fa-solid fa-eye-slash"></i>';

    } else {

        password.type = "password";

        togglePassword.innerHTML =
            '<i class="fa-solid fa-eye"></i>';

    }

});


/* ==========================================
   LOGIN
========================================== */

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    loginError.innerHTML = "";

    try {

        await signInWithEmailAndPassword(
            auth,
            email.value.trim(),
            password.value
        );

        alert("Login Successful");

        window.location.href = "admin-dashboard.html";

    } catch (error) {

        console.log(error);

        loginError.innerHTML =
            "Invalid Email or Password";

    }

});
