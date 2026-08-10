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
    orderBy
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

const studentsTableBody = document.getElementById("studentsTableBody");
const studentSearch = document.getElementById("studentSearch");

const studentCount = document.getElementById("studentCount");
const formMessage = document.getElementById("formMessage");


/* =========================
   STUDENT DATA
========================= */

let students = [];


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
   SIDEBAR NAVIGATION
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

        pageTitle.textContent = item.textContent.trim();

    });

});


/* =========================
   OPEN MODAL
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

closeModal.addEventListener("click", closeStudentModal);

cancelBtn.addEventListener("click", closeStudentModal);


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

}


/* =========================
   SAVE STUDENT
========================= */

studentForm.addEventListener("submit", async event => {

    event.preventDefault();

    formMessage.textContent = "Saving...";

    const studentData = {

        name: studentName.value.trim(),

        fatherName: fatherName.value.trim(),

        phone: phone.value.trim(),

        course: course.value.trim(),

        batch: batch.value.trim(),

        admissionDate: admissionDate.value

    };


    try {

        /* EDIT */

        if (editStudentId.value) {

            const studentRef =
                doc(db, "students", editStudentId.value);

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

                studentId: generateStudentId(),

                createdAt: new Date()

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

        console.error(error);

        formMessage.textContent =
            "Error: " + error.message;

    }

});


/* =========================
   GENERATE STUDENT ID
========================= */

function generateStudentId() {

    const random =
        Math.floor(100000 + Math.random() * 900000);

    return "STU-" + random;

}


/* =========================
   LOAD STUDENTS
========================= */

function loadStudents() {

    const studentsRef =
        collection(db, "students");

    const studentsQuery =
        query(
            studentsRef,
            orderBy("createdAt", "desc")
        );


    onSnapshot(

        studentsQuery,

        snapshot => {

            students = [];

            snapshot.forEach(docSnapshot => {

                students.push({

                    id: docSnapshot.id,

                    ...docSnapshot.data()

                });

            });


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
                        Check Firebase Firestore.
                    </td>
                </tr>

            `;

        }

    );

}


/* =========================
   DISPLAY STUDENTS
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
                    ${escapeHTML(student.studentId || "-")}
                </strong>
            </td>

            <td>
                ${escapeHTML(student.name || "-")}
            </td>

            <td>
                ${escapeHTML(student.fatherName || "-")}
            </td>

            <td>
                ${escapeHTML(student.phone || "-")}
            </td>

            <td>
                ${escapeHTML(student.course || "-")}
                /
                ${escapeHTML(student.batch || "-")}
            </td>

            <td>
                ${escapeHTML(student.admissionDate || "-")}
            </td>

            <td>

                <button
                    class="action-btn edit-btn"
                    data-id="${student.id}">
                    Edit
                </button>

                <button
                    class="action-btn delete-btn"
                    data-id="${student.id}">
                    Delete
                </button>

            </td>

        `;


        studentsTableBody.appendChild(row);

    });


    attachActionButtons();

}


/* =========================
   EDIT / DELETE BUTTONS
========================= */

function attachActionButtons() {

    document
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => editStudent(button.dataset.id)
            );

        });


    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => deleteStudent(button.dataset.id)
            );

        });

}


/* =========================
   EDIT STUDENT
========================= */

function editStudent(id) {

    const student =
        students.find(s => s.id === id);

    if (!student) return;


    editStudentId.value = student.id;

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
        students.find(s => s.id === id);

    if (!student) return;


    const confirmed =
        confirm(
            `Delete ${student.name}?`
        );

    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(db, "students", id)
        );

    } catch (error) {

        console.error(error);

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

                );

            });


        renderStudents(filtered);

    }
);


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

            console.error(error);

            alert(
                "Logout failed."
            );

        }

    }
);


/* =========================
   SECURITY
========================= */

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}
