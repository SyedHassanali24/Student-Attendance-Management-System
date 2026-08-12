/* =========================================================
   STUDENT ACCOUNT MANAGEMENT
   Sir Syed Hassan Ali Coaching Management System

   Admin creates student login accounts.
   Student logs in using:
   Student ID + Password

   IMPORTANT:
   Password is NOT stored in Firestore.
   Firebase Authentication handles the password.
========================================================= */

import { auth, db } from "../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* =========================================================
   SECONDARY FIREBASE APP

   We use a second Firebase Auth instance so that
   creating a student account does NOT log the admin out.
========================================================= */

const secondaryApp = initializeApp(
    auth.app.options,
    "studentAccountCreator"
);

const secondaryAuth = getAuth(
    secondaryApp
);


/* =========================================================
   STUDENT LOGIN EMAIL

   Students don't need to know this email.
   Their Student ID becomes the login username.
========================================================= */

function studentLoginEmail(studentId) {

    return (
        String(studentId || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "") +
        "@students.sshacms.local"
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   ADD LOGIN BUTTONS TO STUDENT TABLE
========================================================= */

function addLoginButtons() {

    const rows =
        document.querySelectorAll(
            "#studentsTableBody tr"
        );


    rows.forEach(row => {

        const idCardButton =
            row.querySelector(
                ".id-card-btn"
            );


        if (!idCardButton) {
            return;
        }


        if (
            row.querySelector(
                ".student-login-btn"
            )
        ) {
            return;
        }


        const studentId =
            idCardButton.dataset.id;


        if (!studentId) {
            return;
        }


        const container =
            idCardButton.parentElement;


        if (!container) {
            return;
        }


        const button =
            document.createElement("button");


        button.type = "button";

        button.className =
            "action-btn student-login-btn";


        button.dataset.id =
            studentId;


        button.innerHTML =
            "🔐 Create Login";


        button.style.cssText = `
            background:#eef2ff;
            color:#3730a3;
            border:1px solid #c7d2fe;
            cursor:pointer;
        `;


        button.addEventListener(
            "click",
            () => {

                createStudentAccount(
                    studentId
                );

            }
        );


        container.appendChild(
            button
        );

    });

}


/* =========================================================
   WATCH STUDENT TABLE

   admin.js dynamically renders the student table.
   MutationObserver lets us add the login button
   whenever the table refreshes.
========================================================= */

function watchStudentTable() {

    const tableBody =
        document.getElementById(
            "studentsTableBody"
        );


    if (!tableBody) {

        setTimeout(
            watchStudentTable,
            500
        );

        return;
    }


    addLoginButtons();


    const observer =
        new MutationObserver(() => {

            addLoginButtons();

        });


    observer.observe(
        tableBody,
        {
            childList: true,
            subtree: true
        }
    );

}


/* =========================================================
   CREATE STUDENT ACCOUNT
========================================================= */

async function createStudentAccount(
    studentDocId
) {

    if (!studentDocId) {
        return;
    }


    try {

        const studentRef =
            doc(
                db,
                "students",
                studentDocId
            );


        const studentSnapshot =
            await getDoc(
                studentRef
            );


        if (!studentSnapshot.exists()) {

            alert(
                "Student record was not found."
            );

            return;
        }


        const student =
            studentSnapshot.data();


        const studentId =
            String(
                student.studentId || ""
            )
            .trim()
            .toUpperCase();


        const studentName =
            student.name ||
            "Student";


        if (!studentId) {

            alert(
                "This student does not have a Student ID."
            );

            return;
        }


        /* =============================================
           ALREADY CREATED
        ============================================= */

        if (
            student.uid &&
            student.loginEnabled === true
        ) {

            alert(
                "Login already exists for this student.\n\n" +
                "Student ID: " +
                studentId +
                "\n\n" +
                "The existing password cannot be displayed here."
            );

            return;
        }


        /* =============================================
           PASSWORD
        ============================================= */

        const password =
            prompt(
                `Create password for ${studentName}\n\n` +
                `Student ID: ${studentId}\n\n` +
                `Password must be at least 6 characters.`,
                ""
            );


        if (password === null) {
            return;
        }


        if (
            String(password).length < 6
        ) {

            alert(
                "Password must be at least 6 characters long."
            );

            return;
        }


        const confirmPassword =
            prompt(
                "Confirm the student password:"
            );


        if (
            confirmPassword === null
        ) {
            return;
        }


        if (
            password !==
            confirmPassword
        ) {

            alert(
                "Passwords do not match."
            );

            return;
        }


        /* =============================================
           CREATE FIREBASE AUTH ACCOUNT
        ============================================= */

        const email =
            studentLoginEmail(
                studentId
            );


        const credential =
            await createUserWithEmailAndPassword(
                secondaryAuth,
                email,
                password
            );


        const uid =
            credential.user.uid;


        /* =============================================
           SAVE ACCOUNT LINK IN STUDENT DOCUMENT
        ============================================= */

        await updateDoc(
            studentRef,
            {

                uid,

                loginEmail:
                    email,

                loginEnabled:
                    true,

                loginCreatedAt:
                    new Date()

            }
        );


        /* =============================================
           SUCCESS
        ============================================= */

        alert(
            "Student login created successfully!\n\n" +

            "Student Name: " +
            studentName +
            "\n\n" +

            "Student ID: " +
            studentId +
            "\n\n" +

            "Password: " +
            password +
            "\n\n" +

            "Give these credentials to the student."
        );


    } catch (error) {

        console.error(
            "Student account creation error:",
            error
        );


        let message =
            error.message ||
            "Unable to create student account.";


        if (
            error.code ===
            "auth/email-already-in-use"
        ) {

            message =
                "An account already exists for this Student ID.";

        }


        if (
            error.code ===
            "auth/weak-password"
        ) {

            message =
                "Password is too weak. Use at least 6 characters.";

        }


        if (
            error.code ===
            "auth/operation-not-allowed"
        ) {

            message =
                "Email/Password Authentication is not enabled in Firebase.";

        }


        alert(
            "Unable to create student login.\n\n" +
            message
        );

    }

}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        watchStudentTable,
        {
            once: true
        }
    );

} else {

    watchStudentTable();

}
