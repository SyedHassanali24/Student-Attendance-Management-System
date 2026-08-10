import { auth, db } from "../firebase/firebase-config.js";

import {
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================
   ELEMENTS
========================= */

const menuItems = document.querySelectorAll(".menu-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("pageTitle");

const logoutBtn = document.getElementById("logoutBtn");

const addStudentBtn = document.getElementById("addStudentBtn");
const studentModal = document.getElementById("studentModal");
const closeModal = document.getElementById("closeModal");
const cancelBtn = document.getElementById("cancelBtn");

const studentForm = document.getElementById("studentForm");

const studentName = document.getElementById("studentName");
const fatherName = document.getElementById("fatherName");
const phone = document.getElementById("phone");
const course = document.getElementById("course");
const batch = document.getElementById("batch");
const admissionDate = document.getElementById("admissionDate");

const editStudentId = document.getElementById("editStudentId");

const modalTitle = document.getElementById("modalTitle");
const saveStudentBtn = document.getElementById("saveStudentBtn");

const studentsTableBody =
    document.getElementById("studentsTableBody");

const studentSearch =
    document.getElementById("studentSearch");

const studentCount =
    document.getElementById("studentCount");

const formMessage =
    document.getElementById("formMessage");


/* =========================
   STUDENT DATA
========================= */

let students = [];
let unsubscribeStudents = null;


/* =========================
   AUTH CHECK
========================= */

onAuthStateChanged(auth, user => {

    if (!user) {
        window.location.href = "admin-login.html";
        return;
    }

    console.log("Admin authenticated:", user.email);

    loadStudents();

});


/* =========================
   SIDEBAR
========================= */

menuItems.forEach(item => {

    item.addEventListener("click", () => {

        menuItems.forEach(i =>
            i.classList.remove("active")
        );

        pages.forEach(page =>
            page.classList.remove("active")
        );

        item.classList.add("active");

        const selectedPage =
            document.getElementById(item.dataset.page);

        if (selectedPage) {
            selectedPage.classList.add("active");
        }

        pageTitle.textContent =
            item.textContent.trim();

    });

});


/* =========================
   ADD STUDENT
========================= */

addStudentBtn.addEventListener("click", () => {

    resetForm();

    modalTitle.textContent = "Add Student";

    saveStudentBtn.textContent = "Save Student";

    studentModal.classList.add("show");

});


/* =========================
   CLOSE MODAL
========================= */

if (closeModal) {
    closeModal.addEventListener(
        "click",
        closeStudentModal
    );
}

if (cancelBtn) {
    cancelBtn.addEventListener(
        "click",
        closeStudentModal
    );
}


function closeStudentModal() {

    studentModal.classList.remove("show");

    resetForm();

}


/* =========================
   RESET FORM
========================= */

function resetForm() {

    studentForm.reset();

    editStudentId.value = "";

    formMessage.textContent = "";

    modalTitle.textContent = "Add Student";

    saveStudentBtn.textContent = "Save Student";

}


/* =========================
   SAVE / UPDATE STUDENT
========================= */

studentForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        formMessage.textContent = "Saving...";

        saveStudentBtn.disabled = true;


        const studentData = {

            name: studentName.value.trim(),

            fatherName: fatherName.value.trim(),

            phone: phone.value.trim(),

            course: course.value.trim(),

            batch: batch.value.trim(),

            admissionDate: admissionDate.value

        };


        try {

            /* UPDATE */

            if (editStudentId.value) {

                const studentRef = doc(
                    db,
                    "students",
                    editStudentId.value
                );

                await updateDoc(
                    studentRef,
                    studentData
                );

                formMessage.textContent =
                    "Student updated successfully.";

            }


            /* ADD */

            else {

                const newStudent = {

                    ...studentData,

                    studentId:
                        generateStudentId(),

                    createdAt:
                        serverTimestamp()

                };

                await addDoc(
                    collection(db, "students"),
                    newStudent
                );

                formMessage.textContent =
                    "Student added successfully.";

            }


            setTimeout(() => {
                closeStudentModal();
            }, 700);


        } catch (error) {

            console.error(
                "Student save error:",
                error
            );

            formMessage.textContent =
                "Error: " + error.message;

        } finally {

            saveStudentBtn.disabled = false;

        }

    }
);


/* =========================
   GENERATE STUDENT ID
========================= */

function generateStudentId() {

    const randomNumber =
        Math.floor(
            100000 + Math.random() * 900000
        );

    return "STU-" + randomNumber;

}


/* =========================
   LOAD STUDENTS
========================= */

function loadStudents() {

    if (unsubscribeStudents) {
        unsubscribeStudents();
    }

    const studentsRef =
        collection(db, "students");

    const studentsQuery =
        query(
            studentsRef,
            orderBy("createdAt", "desc")
        );


    unsubscribeStudents = onSnapshot(

        studentsQuery,

        snapshot => {

            students = [];

            snapshot.forEach(
                docSnapshot => {

                    students.push({

                        id: docSnapshot.id,

                        ...docSnapshot.data()

                    });

                }
            );


            studentCount.textContent =
                students.length;


            renderStudents(students);

        },


        error => {

            console.error(
                "Firestore error:",
                error
            );

            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty">
                        Unable to load students.
                        Please check Firestore.
                    </td>
                </tr>
            `;

        }

    );

}


/* =========================
   RENDER STUDENTS
========================= */

function renderStudents(data) {

    if (!data.length) {

        studentsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty">
                    No students found.
                </td>
            </tr>
        `;

        return;
    }


    studentsTableBody.innerHTML = "";


    data.forEach(student => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                <strong>
                    ${escapeHTML(
                        student.studentId || "-"
                    )}
                </strong>
            </td>

            <td>
                ${escapeHTML(
                    student.name || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.fatherName || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.phone || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.course || "-"
                )}
                /
                ${escapeHTML(
                    student.batch || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.admissionDate || "-"
                )}
            </td>

            <td>

                <button
                    type="button"
                    class="action-btn edit-btn"
                    data-id="${student.id}">
                    ✏️ Edit
                </button>

                <button
                    type="button"
                    class="action-btn delete-btn"
                    data-id="${student.id}">
                    🗑️ Delete
                </button>

                <button
                    type="button"
                    class="action-btn id-card-btn"
                    data-id="${student.id}">
                    🪪 ID Card
                </button>

            </td>

        `;


        studentsTableBody.appendChild(row);

    });


    attachActionButtons();

}


/* =========================
   ACTION BUTTONS
========================= */

function attachActionButtons() {

    document
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => editStudent(
                    button.dataset.id
                )
            );

        });


    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => deleteStudent(
                    button.dataset.id
                )
            );

        });


    document
        .querySelectorAll(".id-card-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => openStudentIDCard(
                    button.dataset.id
                )
            );

        });

}


/* =========================
   EDIT STUDENT
========================= */

function editStudent(id) {

    const student =
        students.find(
            student => student.id === id
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    editStudentId.value =
        student.id;

    studentName.value =
        student.name || "";

    fatherName.value =
        student.fatherName || "";

    phone.value =
        student.phone || "";

    course.value =
        student.course || "";

    batch.value =
        student.batch || "";

    admissionDate.value =
        student.admissionDate || "";


    modalTitle.textContent =
        "Edit Student";

    saveStudentBtn.textContent =
        "Update Student";

    formMessage.textContent = "";

    studentModal.classList.add("show");

}


/* =========================
   DELETE STUDENT
========================= */

async function deleteStudent(id) {

    const student =
        students.find(
            student => student.id === id
        );


    if (!student) return;


    const confirmed =
        confirm(
            `Are you sure you want to delete "${student.name}"?`
        );


    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(
                db,
                "students",
                id
            )
        );

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        alert(
            "Unable to delete student: " +
            error.message
        );

    }

}


/* =========================
   SEARCH
========================= */

studentSearch.addEventListener(
    "input",
    () => {

        const search =
            studentSearch.value
                .toLowerCase()
                .trim();


        if (!search) {

            renderStudents(students);

            return;

        }


        const filtered =
            students.filter(student => {

                return (

                    (student.name || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (student.studentId || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (student.phone || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (student.course || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (student.batch || "")
                        .toLowerCase()
                        .includes(search)

                );

            });


        renderStudents(filtered);

    }
);


/* =====================================================
   STUDENT ID CARD
===================================================== */

function openStudentIDCard(id) {

    const student =
        students.find(
            student => student.id === id
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    const qrData =
        JSON.stringify({

            studentId:
                student.studentId,

            name:
                student.name,

            course:
                student.course,

            batch:
                student.batch

        });


    const cardWindow =
        window.open(
            "",
            "_blank",
            "width=500,height=700"
        );


    if (!cardWindow) {

        alert(
            "Please allow pop-ups for this website."
        );

        return;

    }


    cardWindow.document.write(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
${escapeHTML(student.name)} - Student ID Card
</title>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

<style>

* {
    box-sizing: border-box;
}

body {

    margin: 0;

    min-height: 100vh;

    display: flex;

    justify-content: center;

    align-items: center;

    background: #eef2f7;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}

.id-card {

    width: 430px;

    background: white;

    border-radius: 18px;

    overflow: hidden;

    box-shadow:
        0 15px 40px
        rgba(0,0,0,.18);

}

.id-header {

    padding: 22px;

    background:
        linear-gradient(
            135deg,
            #172554,
            #2563eb
        );

    color: white;

    text-align: center;

}

.logo {

    width: 55px;

    height: 55px;

    border-radius: 50%;

    background: white;

    color: #172554;

    display: flex;

    align-items: center;

    justify-content: center;

    font-size: 20px;

    font-weight: 800;

    margin: auto;

}

.id-header h2 {

    margin: 10px 0 4px;

}

.id-header p {

    margin: 0;

    opacity: .85;

    font-size: 12px;

}

.id-body {

    padding: 25px;

}

.student-name {

    text-align: center;

    font-size: 22px;

    font-weight: 800;

    margin-bottom: 18px;

    color: #172554;

}

.info {

    line-height: 1.8;

    font-size: 14px;

}

.info strong {

    display: inline-block;

    width: 85px;

}

.qr {

    display: flex;

    justify-content: center;

    margin-top: 18px;

}

.qr img {

    width: 145px !important;

    height: 145px !important;

}

.id-footer {

    background: #f1f5f9;

    padding: 12px;

    text-align: center;

    font-size: 11px;

    color: #475569;

}

.download-btn {

    margin-top: 20px;

    width: 100%;

    padding: 13px;

    border: 0;

    border-radius: 9px;

    background: #2563eb;

    color: white;

    font-weight: 700;

    cursor: pointer;

}

@media print {

    body {

        background: white;

    }

    .download-btn {

        display: none;

    }

    .id-card {

        box-shadow: none;

    }

}

</style>

</head>


<body>

<div>

<div class="id-card" id="printCard">

    <div class="id-header">

        <div class="logo">
            SS
        </div>

        <h2>
            Sir Syed Hassan Ali
        </h2>

        <p>
            Coaching Management System
        </p>

    </div>


    <div class="id-body">

        <div class="student-name">
            ${escapeHTML(student.name)}
        </div>


        <div class="info">

            <div>
                <strong>ID:</strong>
                ${escapeHTML(student.studentId)}
            </div>

            <div>
                <strong>Father:</strong>
                ${escapeHTML(student.fatherName)}
            </div>

            <div>
                <strong>Course:</strong>
                ${escapeHTML(student.course)}
            </div>

            <div>
                <strong>Batch:</strong>
                ${escapeHTML(student.batch)}
            </div>

            <div>
                <strong>Phone:</strong>
                ${escapeHTML(student.phone)}
            </div>

        </div>


        <div
            class="qr"
            id="studentQR">
        </div>

    </div>


    <div class="id-footer">

        Sir Syed Hassan Ali Coaching
        <br>
        Student Identity Card

    </div>

</div>


<button
    class="download-btn"
    onclick="window.print()">

    🖨️ Download / Save as PDF

</button>

</div>


<script>

window.onload = function() {

    new QRCode(
        document.getElementById("studentQR"),
        {
            text: ${JSON.stringify(qrData)},
            width: 145,
            height: 145,
            correctLevel: QRCode.CorrectLevel.H
        }
    );

};

</script>

</body>

</html>

    `);


    cardWindow.document.close();

}


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "admin-login.html";

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

            alert(
                "Logout failed."
            );

        }

    }
);


/* =========================
   CLOSE MODAL OUTSIDE
========================= */

if (studentModal) {

    studentModal.addEventListener(
        "click",
        event => {

            if (
                event.target === studentModal
            ) {

                closeStudentModal();

            }

        }
    );

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}
