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
    getDoc,
    setDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    where,
    getDocs
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
   QR ELEMENTS
========================= */

const qrReader = document.getElementById("qr-reader");
const startScannerBtn = document.getElementById("startScannerBtn");
const stopScannerBtn = document.getElementById("stopScannerBtn");
const qrMessage = document.getElementById("qrMessage");
const scannerStatus = document.getElementById("scannerStatus");

const studentResult = document.getElementById("studentResult");
const todayAttendanceCount =
    document.getElementById("todayAttendanceCount");

const lastScanTime =
    document.getElementById("lastScanTime");

const attendanceTableBody =
    document.getElementById("attendanceTableBody");

const attendanceSearch =
    document.getElementById("attendanceSearch");


/* =========================
   DATA
========================= */

let students = [];
let attendanceRecords = [];
let unsubscribeStudents = null;
let unsubscribeAttendance = null;
let qrScanner = null;
let scannerRunning = false;


/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, user => {

    if (!user) {
        window.location.href = "admin-login.html";
        return;
    }

    console.log("Admin authenticated:", user.email);

    loadStudents();
    loadTodayAttendance();

});


/* =========================
   NAVIGATION
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

        if (item.dataset.page !== "attendance") {
            stopScanner();
        }

    });

});


/* =========================
   STUDENT MODAL
========================= */

addStudentBtn.addEventListener("click", () => {

    resetForm();

    modalTitle.textContent = "Add Student";
    saveStudentBtn.textContent = "Save Student";

    studentModal.classList.add("show");

});


if (closeModal) {
    closeModal.addEventListener("click", closeStudentModal);
}

if (cancelBtn) {
    cancelBtn.addEventListener("click", closeStudentModal);
}


function closeStudentModal() {

    studentModal.classList.remove("show");
    resetForm();

}


function resetForm() {

    studentForm.reset();

    editStudentId.value = "";

    formMessage.textContent = "";

    modalTitle.textContent = "Add Student";

    saveStudentBtn.textContent = "Save Student";

}


/* =========================
   SAVE STUDENT
========================= */

studentForm.addEventListener("submit", async event => {

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

        if (editStudentId.value) {

            await updateDoc(
                doc(db, "students", editStudentId.value),
                studentData
            );

            formMessage.textContent =
                "Student updated successfully.";

        } else {

            await addDoc(
                collection(db, "students"),
                {
                    ...studentData,
                    studentId: generateStudentId(),
                    createdAt: serverTimestamp()
                }
            );

            formMessage.textContent =
                "Student added successfully.";

        }


        setTimeout(closeStudentModal, 700);

    } catch (error) {

        console.error(error);

        formMessage.textContent =
            "Error: " + error.message;

    } finally {

        saveStudentBtn.disabled = false;

    }

});


/* =========================
   STUDENT ID
========================= */

function generateStudentId() {

    return "STU-" +
        Math.floor(100000 + Math.random() * 900000);

}


/* =========================
   LOAD STUDENTS
========================= */

function loadStudents() {

    if (unsubscribeStudents) {
        unsubscribeStudents();
    }

    const studentsQuery = query(
        collection(db, "students"),
        orderBy("createdAt", "desc")
    );

    unsubscribeStudents = onSnapshot(
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

            console.error(error);

            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty">
                        Unable to load students.
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

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <strong>
                    ${escapeHTML(student.studentId || "-")}
                </strong>
            </td>

            <td>${escapeHTML(student.name || "-")}</td>

            <td>${escapeHTML(student.fatherName || "-")}</td>

            <td>${escapeHTML(student.phone || "-")}</td>

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

            </td>
        `;

        studentsTableBody.appendChild(row);

    });

    attachActionButtons();

}


/* =========================
   EDIT / DELETE
========================= */

function attachActionButtons() {

    document.querySelectorAll(".edit-btn").forEach(button => {

        button.addEventListener("click", () => {
            editStudent(button.dataset.id);
        });

    });


    document.querySelectorAll(".delete-btn").forEach(button => {

        button.addEventListener("click", () => {
            deleteStudent(button.dataset.id);
        });

    });

}


function editStudent(id) {

    const student =
        students.find(s => s.id === id);

    if (!student) return;

    editStudentId.value = student.id;

    studentName.value = student.name || "";
    fatherName.value = student.fatherName || "";
    phone.value = student.phone || "";
    course.value = student.course || "";
    batch.value = student.batch || "";
    admissionDate.value = student.admissionDate || "";

    modalTitle.textContent = "Edit Student";
    saveStudentBtn.textContent = "Update Student";

    studentModal.classList.add("show");

}


async function deleteStudent(id) {

    const student =
        students.find(s => s.id === id);

    if (!student) return;

    if (!confirm(
        `Are you sure you want to delete "${student.name}"?`
    )) return;

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
   STUDENT SEARCH
========================= */

studentSearch.addEventListener("input", () => {

    const search =
        studentSearch.value.toLowerCase().trim();

    if (!search) {

        renderStudents(students);
        return;

    }

    const filtered = students.filter(student => {

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

});


/* =====================================================
   QR ATTENDANCE
===================================================== */


/* =========================
   START SCANNER
========================= */

if (startScannerBtn) {

    startScannerBtn.addEventListener(
        "click",
        startScanner
    );

}


if (stopScannerBtn) {

    stopScannerBtn.addEventListener(
        "click",
        stopScanner
    );

}


async function startScanner() {

    if (scannerRunning) return;

    if (typeof Html5Qrcode === "undefined") {

        qrMessage.textContent =
            "QR Scanner library not loaded.";

        return;

    }

    try {

        qrMessage.textContent =
            "Starting camera...";

        scannerStatus.textContent =
            "Scanner Starting...";


        qrScanner =
            new Html5Qrcode("qr-reader");


        await qrScanner.start(

            { facingMode: "environment" },

            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            decodedText => {

                handleQRScan(decodedText);

            },

            errorMessage => {
                // Ignore continuous scan errors
            }

        );


        scannerRunning = true;

        scannerStatus.textContent =
            "Scanner Active";

        qrMessage.textContent =
            "Point the camera at student's QR code.";

    } catch (error) {

        console.error(
            "Scanner error:",
            error
        );

        scannerStatus.textContent =
            "Scanner Error";

        qrMessage.textContent =
            "Unable to start camera. Please allow camera permission.";

    }

}


/* =========================
   STOP SCANNER
========================= */

async function stopScanner() {

    if (!qrScanner || !scannerRunning) {
        return;
    }

    try {

        await qrScanner.stop();

        qrScanner.clear();

    } catch (error) {

        console.error(error);

    }

    scannerRunning = false;

    scannerStatus.textContent =
        "Scanner Ready";

    qrMessage.textContent =
        'Click "Start Scanner" and allow camera access.';

}


/* =========================
   QR SCAN
========================= */

let processingScan = false;


async function handleQRScan(decodedText) {

    if (processingScan) return;

    processingScan = true;

    const studentId =
        decodedText.trim();

    console.log(
        "QR Scanned:",
        studentId
    );


    qrMessage.textContent =
        "Checking student...";


    try {

        const student =
            students.find(
                s => s.studentId === studentId
            );


        if (!student) {

            qrMessage.textContent =
                "❌ Student not found.";

            showStudentResult(null);

            processingScan = false;

            return;

        }


        showStudentResult(student);


        await markAttendance(student);


    } catch (error) {

        console.error(
            "Attendance error:",
            error
        );

        qrMessage.textContent =
            "❌ Error: " + error.message;

    }


    setTimeout(() => {

        processingScan = false;

    }, 2000);

}


/* =========================
   SHOW STUDENT RESULT
========================= */

function showStudentResult(student) {

    if (!student) {

        studentResult.innerHTML = `
            <div class="attendance-placeholder">
                <div class="placeholder-icon">❌</div>
                <p>Student not found.</p>
            </div>
        `;

        return;

    }


    studentResult.innerHTML = `
        <div class="student-attendance-info">

            <h3>✅ Student Found</h3>

            <p>
                <strong>Student ID:</strong>
                ${escapeHTML(student.studentId || "-")}
            </p>

            <p>
                <strong>Name:</strong>
                ${escapeHTML(student.name || "-")}
            </p>

            <p>
                <strong>Father Name:</strong>
                ${escapeHTML(student.fatherName || "-")}
            </p>

            <p>
                <strong>Course:</strong>
                ${escapeHTML(student.course || "-")}
            </p>

            <p>
                <strong>Batch:</strong>
                ${escapeHTML(student.batch || "-")}
            </p>

        </div>
    `;

}


/* =========================
   MARK ATTENDANCE
========================= */

async function markAttendance(student) {

    const now = new Date();

    const dateKey =
        now.toISOString().split("T")[0];

    const timeString =
        now.toLocaleTimeString(
            "en-PK",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );


    const attendanceId =
        `${student.studentId}_${dateKey}`;


    const attendanceRef =
        doc(
            db,
            "attendance",
            attendanceId
        );


    const existing =
        await getDoc(attendanceRef);


    if (existing.exists()) {

        qrMessage.textContent =
            "⚠️ Attendance already marked today.";

        return;

    }


    await setDoc(
        attendanceRef,
        {

            studentId: student.studentId,

            studentName: student.name,

            fatherName: student.fatherName || "",

            course: student.course || "",

            batch: student.batch || "",

            date: dateKey,

            time: timeString,

            status: "Present",

            createdAt: serverTimestamp()

        }
    );


    qrMessage.textContent =
        "✅ Attendance marked successfully!";


    lastScanTime.textContent =
        timeString;

}


/* =========================
   LOAD TODAY ATTENDANCE
========================= */

function loadTodayAttendance() {

    if (unsubscribeAttendance) {
        unsubscribeAttendance();
    }


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    const attendanceQuery =
        query(
            collection(db, "attendance"),
            where("date", "==", today)
        );


    unsubscribeAttendance =
        onSnapshot(

            attendanceQuery,

            snapshot => {

                attendanceRecords = [];

                snapshot.forEach(
                    docSnapshot => {

                        attendanceRecords.push({

                            id: docSnapshot.id,

                            ...docSnapshot.data()

                        });

                    }
                );


                attendanceRecords.sort(
                    (a, b) =>
                        (b.time || "")
                            .localeCompare(
                                a.time || ""
                            )
                );


                todayAttendanceCount.textContent =
                    attendanceRecords.length;


                const dashboardCount =
                    document.getElementById(
                        "attendanceCount"
                    );

                if (dashboardCount) {

                    dashboardCount.textContent =
                        attendanceRecords.length;

                }


                renderAttendance(
                    attendanceRecords
                );

            },

            error => {

                console.error(
                    "Attendance error:",
                    error
                );

            }

        );

}


/* =========================
   RENDER ATTENDANCE
========================= */

function renderAttendance(data) {

    if (!data.length) {

        attendanceTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty">
                    No attendance recorded today.
                </td>
            </tr>
        `;

        return;

    }


    attendanceTableBody.innerHTML = "";


    data.forEach(record => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                <strong>
                    ${escapeHTML(
                        record.studentId || "-"
                    )}
                </strong>
            </td>

            <td>
                ${escapeHTML(
                    record.studentName || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    record.course || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    record.batch || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    record.date || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    record.time || "-"
                )}
            </td>

            <td>
                <strong>
                    ✅ ${escapeHTML(
                        record.status || "Present"
                    )}
                </strong>
            </td>

        `;


        attendanceTableBody.appendChild(row);

    });

}


/* =========================
   ATTENDANCE SEARCH
========================= */

if (attendanceSearch) {

    attendanceSearch.addEventListener(
        "input",
        () => {

            const search =
                attendanceSearch.value
                    .toLowerCase()
                    .trim();


            if (!search) {

                renderAttendance(
                    attendanceRecords
                );

                return;

            }


            const filtered =
                attendanceRecords.filter(
                    record => {

                        return (

                            (record.studentName || "")
                                .toLowerCase()
                                .includes(search)

                            ||

                            (record.studentId || "")
                                .toLowerCase()
                                .includes(search)

                            ||

                            (record.course || "")
                                .toLowerCase()
                                .includes(search)

                            ||

                            (record.batch || "")
                                .toLowerCase()
                                .includes(search)

                        );

                    }
                );


            renderAttendance(filtered);

        }
    );

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

            console.error(error);

            alert("Logout failed.");

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

            if (event.target === studentModal) {
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
