/* =========================================================
   STUDENT LOGIN
   Sir Syed Hassan Ali Coaching Management System

   Student logs in with:

   Student ID
   +
   Password

   Accounts are created by Admin.
========================================================= */

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   ELEMENTS
========================================================= */

const form =
    document.getElementById(
        "studentLoginForm"
    );


const studentIdInput =
    document.getElementById(
        "studentId"
    );


const passwordInput =
    document.getElementById(
        "password"
    );


const loginBtn =
    document.getElementById(
        "loginBtn"
    );


const message =
    document.getElementById(
        "loginMessage"
    );


/* =========================================================
   STUDENT LOGIN EMAIL

   Must match student-account.js
========================================================= */

function studentLoginEmail(
    studentId
) {

    return (
        String(studentId || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "") +
        "@students.sshacms.local"
    );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    text,
    type = "error"
) {

    if (!message) {
        return;
    }


    message.textContent =
        text;


    message.className =
        "message show " +
        type;

}


/* =========================================================
   AUTH ERROR
========================================================= */

function getLoginError(
    error
) {

    switch (
        error?.code
    ) {

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":

            return (
                "Student ID or password is incorrect."
            );


        case "auth/invalid-email":

            return (
                "Please enter a valid Student ID."
            );


        case "auth/too-many-requests":

            return (
                "Too many login attempts. Please try again later."
            );


        case "auth/network-request-failed":

            return (
                "Network error. Please check your internet connection."
            );


        default:

            return (
                error?.message ||
                "Unable to login. Please try again."
            );

    }

}


/* =========================================================
   CHECK EXISTING LOGIN
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {
            return;
        }


        try {

            const studentRef =
                doc(
                    db,
                    "students",
                    user.uid
                );


            const snapshot =
                await getDoc(
                    studentRef
                );


            /*
             * Student document IDs in the current
             * project are Firestore document IDs,
             * not Firebase Auth UIDs.
             *
             * Therefore we search using the saved UID.
             */

            if (
                snapshot.exists()
            ) {

                const student =
                    snapshot.data();


                if (
                    student.loginEnabled === true
                ) {

                    localStorage.setItem(
                        "studentDocId",
                        snapshot.id
                    );


                    localStorage.setItem(
                        "studentId",
                        student.studentId || ""
                    );


                    localStorage.setItem(
                        "studentName",
                        student.name || ""
                    );


                    window.location.href =
                        "student-dashboard.html";

                }

            }

        } catch (error) {

            console.error(
                "Existing student session error:",
                error
            );

        }

    }
);


/* =========================================================
   LOGIN
========================================================= */

if (form) {

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const studentId =
                String(
                    studentIdInput?.value || ""
                )
                .trim()
                .toUpperCase();


            const password =
                String(
                    passwordInput?.value || ""
                );


            if (!studentId) {

                showMessage(
                    "Please enter your Student ID."
                );

                return;
            }


            if (!password) {

                showMessage(
                    "Please enter your password."
                );

                return;
            }


            loginBtn.disabled =
                true;


            loginBtn.textContent =
                "Signing in...";


            showMessage(
                "",
                "success"
            );


            try {

                const email =
                    studentLoginEmail(
                        studentId
                    );


                /* =====================================
                   FIREBASE LOGIN
                ===================================== */

                const credential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    credential.user;


                /* =====================================
                   FIND STUDENT PROFILE BY UID
                ===================================== */

                /*
                 * We cannot use students/{uid}
                 * because the existing project uses
                 * automatically generated Firestore IDs.
                 *
                 * We therefore use the saved local
                 * account link after verifying the UID.
                 */

                const savedStudentDocId =
                    localStorage.getItem(
                        "studentDocId"
                    );


                let studentSnapshot =
                    null;


                if (
                    savedStudentDocId
                ) {

                    const ref =
                        doc(
                            db,
                            "students",
                            savedStudentDocId
                        );


                    const snapshot =
                        await getDoc(ref);


                    if (
                        snapshot.exists() &&
                        snapshot.data().uid ===
                            user.uid
                    ) {

                        studentSnapshot =
                            snapshot;

                    }

                }


                /*
                 * If there is no previous local session,
                 * search the students collection.
                 */

                if (!studentSnapshot) {

                    const {
                        collection,
                        getDocs
                    } =
                        await import(
                            "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"
                        );


                    const studentsSnapshot =
                        await getDocs(
                            collection(
                                db,
                                "students"
                            )
                        );


                    for (
                        const item
                        of studentsSnapshot.docs
                    ) {

                        const data =
                            item.data();


                        if (
                            data.uid ===
                                user.uid &&
                            data.loginEnabled ===
                                true
                        ) {

                            studentSnapshot =
                                item;

                            break;

                        }

                    }

                }


                if (
                    !studentSnapshot
                ) {

                    await auth.signOut();


                    throw new Error(
                        "This login account is not linked to a student profile."
                    );

                }


                const student =
                    studentSnapshot.data();


                /*
                 * Make sure the Student ID matches.
                 */

                if (
                    String(
                        student.studentId || ""
                    )
                    .trim()
                    .toUpperCase() !==
                    studentId
                ) {

                    await auth.signOut();


                    throw new Error(
                        "Student ID does not match this account."
                    );

                }


                /* =====================================
                   SAVE STUDENT SESSION
                ===================================== */

                localStorage.setItem(
                    "studentDocId",
                    studentSnapshot.id
                );


                localStorage.setItem(
                    "studentId",
                    student.studentId || ""
                );


                localStorage.setItem(
                    "studentName",
                    student.name || ""
                );


                localStorage.setItem(
                    "studentUid",
                    user.uid
                );


                showMessage(
                    "Login successful. Opening Student Portal...",
                    "success"
                );


                setTimeout(
                    () => {

                        window.location.href =
                            "student-dashboard.html";

                    },
                    500
                );


            } catch (error) {

                console.error(
                    "Student login error:",
                    error
                );


                showMessage(
                    getLoginError(error)
                );


                loginBtn.disabled =
                    false;


                loginBtn.textContent =
                    "Login to Student Portal";

            }

        }
    );

}
