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
    serverTimestamp,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   ELEMENTS
========================================================= */

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
const formMessage = document.getElementById("formMessage");

const studentsTableBody =
    document.getElementById("studentsTableBody");

const studentSearch =
    document.getElementById("studentSearch");

const studentCount =
    document.getElementById("studentCount");

const idCardStudentSelect =
    document.getElementById("idCardStudentSelect");

const generateIdCardBtn =
    document.getElementById("generateIdCardBtn");

const idCardPreview =
    document.getElementById("idCardPreview");

const cardStudentName =
    document.getElementById("cardStudentName");

const cardStudentId =
    document.getElementById("cardStudentId");

const cardFatherName =
    document.getElementById("cardFatherName");

const cardCourse =
    document.getElementById("cardCourse");

const cardBatch =
    document.getElementById("cardBatch");

const cardQRCode =
    document.getElementById("cardQRCode");

const printIdCardBtn =
    document.getElementById("printIdCardBtn");


/* =========================================================
   ATTENDANCE ELEMENTS
========================================================= */

const qrReader =
    document.getElementById("qr-reader");

const startScannerBtn =
    document.getElementById("startScannerBtn");

const stopScannerBtn =
    document.getElementById("stopScannerBtn");

const scannerStatus =
    document.getElementById("scannerStatus");

const qrMessage =
    document.getElementById("qrMessage");

const studentResult =
    document.getElementById("studentResult");

const todayAttendanceCount =
    document.getElementById("todayAttendanceCount");

const attendanceCount =
    document.getElementById("attendanceCount");

const lastScanTime =
    document.getElementById("lastScanTime");

const attendanceTableBody =
    document.getElementById("attendanceTableBody");

const attendanceSearch =
    document.getElementById("attendanceSearch");


/* =========================================================
   DATA
========================================================= */

let students = [];
let unsubscribeStudents = null;

let attendanceRecords = [];
let unsubscribeAttendance = null;

let html5QrCode = null;
let scannerRunning = false;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, user => {

    if (!user) {

        window.location.href = "admin-login.html";

        return;
    }

    console.log("Admin authenticated:", user.email);

    loadStudents();
    loadAttendance();

});


/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

menuItems.forEach(item => {

    item.addEventListener("click", () => {

        menuItems.forEach(menu => {
            menu.classList.remove("active");
        });

        pages.forEach(page => {
            page.classList.remove("active");
        });

        item.classList.add("active");

        const page =
            document.getElementById(item.dataset.page);

        if (page) {
            page.classList.add("active");
        }

        pageTitle.textContent =
            item.textContent.trim();

        /* Stop camera when leaving attendance */
        if (item.dataset.page !== "attendance") {
            stopScanner();
        }

    });

});


/* =========================================================
   ADD STUDENT
========================================================= */

if (addStudentBtn) {

    addStudentBtn.addEventListener("click", () => {

        resetForm();

        modalTitle.textContent = "Add Student";
        saveStudentBtn.textContent = "Save Student";

        studentModal.classList.add("show");

    });

}


/* =========================================================
   CLOSE MODAL
========================================================= */

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

if (studentModal) {

    studentModal.addEventListener("click", event => {

        if (event.target === studentModal) {
            closeStudentModal();
        }

    });

}


function closeStudentModal() {

    studentModal.classList.remove("show");

    resetForm();

}


/* =========================================================
   RESET FORM
========================================================= */

function resetForm() {

    if (studentForm) {
        studentForm.reset();
    }

    if (editStudentId) {
        editStudentId.value = "";
    }

    if (formMessage) {
        formMessage.textContent = "";
    }

    if (modalTitle) {
        modalTitle.textContent = "Add Student";
    }

    if (saveStudentBtn) {
        saveStudentBtn.textContent = "Save Student";
        saveStudentBtn.disabled = false;
    }

}


/* =========================================================
   SAVE / UPDATE STUDENT
========================================================= */

if (studentForm) {

    studentForm.addEventListener("submit", async event => {

        event.preventDefault();

        if (formMessage) {
            formMessage.textContent = "Saving student...";
        }

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

                const studentRef =
                    doc(
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

                await addDoc(
                    collection(db, "students"),
                    {

                        ...studentData,

                        studentId:
                            generateStudentId(),

                        createdAt:
                            serverTimestamp()

                    }
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

    });

}


/* =========================================================
   STUDENT ID GENERATOR
========================================================= */

function generateStudentId() {

    const number =
        Math.floor(
            100000 +
            Math.random() * 900000
        );

    return `STU-${number}`;

}


/* =========================================================
   LOAD STUDENTS
========================================================= */

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

            snapshot.forEach(docSnapshot => {

                students.push({

                    id: docSnapshot.id,

                    ...docSnapshot.data()

                });

            });


            if (studentCount) {
                studentCount.textContent =
                    students.length;
            }


            renderStudents(students);

            populateStudentSelect();

        },

        error => {

            console.error(
                "Firestore student error:",
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


/* =========================================================
   RENDER STUDENTS
========================================================= */

function renderStudents(data) {

    if (!data.length) {

        studentsTableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty">

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

                <span style="opacity:.5;"> / </span>

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

                <div class="action-buttons">

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

                </div>

            </td>

        `;


        studentsTableBody.appendChild(row);

    });


    attachActionButtons();

}


/* =========================================================
   ACTION BUTTONS
========================================================= */

function attachActionButtons() {

    document
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    editStudent(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteStudent(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(".id-card-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectStudentForIDCard(
                        button.dataset.id
                    );

                }
            );

        });

}


/* =========================================================
   EDIT STUDENT
========================================================= */

function editStudent(id) {

    const student =
        students.find(
            item => item.id === id
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


/* =========================================================
   DELETE STUDENT
========================================================= */

async function deleteStudent(id) {

    const student =
        students.find(
            item => item.id === id
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    const confirmed =
        confirm(
            `Are you sure you want to delete "${student.name}"?`
        );


    if (!confirmed) {
        return;
    }


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


/* =========================================================
   SEARCH STUDENTS
========================================================= */

if (studentSearch) {

    studentSearch.addEventListener("input", () => {

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

                    ||

                    (student.fatherName || "")
                        .toLowerCase()
                        .includes(search)

                );

            });


        renderStudents(filtered);

    });

}


/* =========================================================
   ID CARD STUDENT SELECT
========================================================= */

function populateStudentSelect() {

    if (!idCardStudentSelect) {
        return;
    }


    idCardStudentSelect.innerHTML = `

        <option value="">
            Select Student
        </option>

    `;


    students.forEach(student => {

        const option =
            document.createElement("option");

        option.value =
            student.id;

        option.textContent =
            `${student.name || "Student"} — ${student.studentId || ""}`;

        idCardStudentSelect.appendChild(option);

    });

}


/* =========================================================
   SELECT STUDENT FOR ID CARD
========================================================= */

function selectStudentForIDCard(id) {

    if (idCardStudentSelect) {

        idCardStudentSelect.value = id;

    }


    generateStudentIDCard(id);

    /* Scroll to ID card */

    if (idCardPreview) {

        setTimeout(() => {

            idCardPreview.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        }, 100);

    }

}


/* =========================================================
   GENERATE ID CARD BUTTON
========================================================= */

if (generateIdCardBtn) {

    generateIdCardBtn.addEventListener(
        "click",
        () => {

            const id =
                idCardStudentSelect.value;


            if (!id) {

                alert(
                    "Please select a student first."
                );

                return;

            }


            generateStudentIDCard(id);

        }
    );

}


/* =========================================================
   GENERATE PROFESSIONAL ID CARD
========================================================= */

function generateStudentIDCard(id) {

    const student =
        students.find(
            item => item.id === id
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    /* Fill card */

    cardStudentName.textContent =
        student.name || "Student";

    cardStudentId.textContent =
        student.studentId || "-";

    cardFatherName.textContent =
        student.fatherName || "-";

    cardCourse.textContent =
        student.course || "-";

    cardBatch.textContent =
        student.batch || "-";


    /* Clear old QR */

    if (cardQRCode) {

        cardQRCode.innerHTML = "";

    }


    /* QR DATA */

    const qrData =
        JSON.stringify({

            type: "student",

            studentId:
                student.studentId || "",

            name:
                student.name || "",

            fatherName:
                student.fatherName || "",

            phone:
                student.phone || "",

            course:
                student.course || "",

            batch:
                student.batch || ""

        });


    /* Generate QR */

    if (
        cardQRCode &&
        typeof QRCode !== "undefined"
    ) {

        new QRCode(

            cardQRCode,

            {

                text: qrData,

                width: 110,

                height: 110,

                correctLevel:
                    QRCode.CorrectLevel.H

            }

        );

    } else {

        console.error(
            "QRCode library not loaded."
        );

        cardQRCode.innerHTML = `
            <div style="
                font-size:12px;
                color:#dc2626;
                text-align:center;
            ">
                QR library not loaded
            </div>
        `;

    }


    /* Show preview */

    if (idCardPreview) {

        idCardPreview.style.display =
            "block";

    }

}


/* =========================================================
   PRINT ID CARD
========================================================= */

if (printIdCardBtn) {

    printIdCardBtn.addEventListener(
        "click",
        printIDCard
    );

}


function printIDCard() {

    if (!idCardPreview) {
        return;
    }


    const card =
        idCardPreview.querySelector(
            ".id-card"
        );


    if (!card) {

        alert(
            "Please generate an ID card first."
        );

        return;

    }


    const printWindow =
        window.open(
            "",
            "_blank",
            "width=900,height=700"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups for this website."
        );

        return;

    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                ${escapeHTML(
                    cardStudentName.textContent
                )} - ID Card
            </title>


            <style>

                * {
                    box-sizing: border-box;
                }


                body {

                    margin: 0;

                    padding: 30px;

                    display: flex;

                    justify-content: center;

                    align-items: center;

                    min-height: 100vh;

                    background: #f1f5f9;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                }


                .id-card {

                    width: 430px;

                    min-height: 270px;

                    overflow: hidden;

                    border-radius: 18px;

                    background: white;

                    box-shadow:
                        0 15px 40px
                        rgba(15,23,42,.18);

                    border:
                        1px solid #dbe3ed;

                }


                .id-card-header {

                    height: 75px;

                    padding: 12px 18px;

                    display: flex;

                    align-items: center;

                    gap: 12px;

                    color: white;

                    background:
                        linear-gradient(
                            135deg,
                            #172554,
                            #2563eb
                        );

                }


                .id-card-logo {

                    width: 48px;

                    height: 48px;

                    border-radius: 12px;

                    display: flex;

                    align-items: center;

                    justify-content: center;

                    background: white;

                    color: #172554;

                    font-size: 16px;

                    font-weight: 900;

                }


                .id-card-header h2 {

                    margin: 0;

                    font-size: 17px;

                }


                .id-card-header p {

                    margin: 4px 0 0;

                    font-size: 9px;

                    opacity: .85;

                }


                .id-card-body {

                    padding: 18px;

                    display: grid;

                    grid-template-columns:
                        1fr 115px;

                    gap: 15px;

                    min-height: 155px;

                }


                .student-info h3 {

                    margin:
                        0 0 10px;

                    color: #172554;

                    font-size: 19px;

                }


                .student-info p {

                    margin: 5px 0;

                    color: #475569;

                    font-size: 11px;

                }


                .student-info strong {

                    display:
                        inline-block;

                    width: 58px;

                    color: #172554;

                }


                .student-qr {

                    width: 115px;

                    height: 115px;

                    display: flex;

                    align-items: center;

                    justify-content: center;

                    border:
                        1px solid #dbe3ed;

                    border-radius: 10px;

                    background: white;

                }


                .student-qr img {

                    width: 105px !important;

                    height: 105px !important;

                }


                .id-card-footer {

                    height: 40px;

                    padding: 0 18px;

                    display: flex;

                    align-items: center;

                    justify-content:
                        space-between;

                    background: #f1f5f9;

                    border-top:
                        1px solid #e2e8f0;

                    color: #475569;

                    font-size: 8px;

                }


                @media print {

                    @page {

                        size:
                            85.6mm 53.98mm;

                        margin: 0;

                    }


                    body {

                        padding: 0;

                        width:
                            85.6mm;

                        height:
                            53.98mm;

                        background: white;

                    }


                    .id-card {

                        width:
                            85.6mm;

                        height:
                            53.98mm;

                        min-height: 0;

                        border-radius:
                            3mm;

                        box-shadow: none;

                    }

                }

            </style>

        </head>


        <body>

            ${card.outerHTML}

        </body>

        </html>

    `);


    printWindow.document.close();


    setTimeout(() => {

        printWindow.focus();

        printWindow.print();

    }, 500);

}


/* =========================================================
   QR ATTENDANCE SCANNER
========================================================= */

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

    if (scannerRunning) {
        return;
    }


    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        alert(
            "QR Scanner library is not loaded."
        );

        return;

    }


    try {

        html5QrCode =
            new Html5Qrcode(
                "qr-reader"
            );


        scannerRunning = true;


        scannerStatus.textContent =
            "Scanner Active";

        scannerStatus.classList.add(
            "active"
        );


        qrMessage.textContent =
            "Camera started. Scan student's QR code.";


        await html5QrCode.start(

            {
                facingMode: "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }

            },

            decodedText => {

                handleQRCode(
                    decodedText
                );

            },

            errorMessage => {

                /* Ignore normal scan errors */

            }

        );


    } catch (error) {

        console.error(
            "Scanner start error:",
            error
        );

        scannerRunning = false;

        scannerStatus.textContent =
            "Scanner Error";

        qrMessage.textContent =
            "Unable to access camera. Please allow camera permission.";

    }

}


/* =========================================================
   STOP SCANNER
========================================================= */

async function stopScanner() {

    if (
        !html5QrCode ||
        !scannerRunning
    ) {

        return;

    }


    try {

        await html5QrCode.stop();

        html5QrCode.clear();

    } catch (error) {

        console.error(
            "Scanner stop error:",
            error
        );

    }


    scannerRunning = false;

    scannerStatus.textContent =
        "Scanner Ready";

    scannerStatus.classList.remove(
        "active"
    );

}


/* =========================================================
   QR CODE PROCESSING
========================================================= */

let lastScannedCode = "";
let lastScanTimestamp = 0;


async function handleQRCode(decodedText) {

    const now =
        Date.now();


    /* Prevent duplicate scan */

    if (
        decodedText === lastScannedCode &&
        now - lastScanTimestamp < 5000
    ) {

        return;

    }


    lastScannedCode =
        decodedText;

    lastScanTimestamp =
        now;


    let qrData;


    try {

        qrData =
            JSON.parse(decodedText);

    } catch (error) {

        qrMessage.textContent =
            "Invalid student QR code.";

        return;

    }


    if (!qrData.studentId) {

        qrMessage.textContent =
            "This QR code does not contain a valid Student ID.";

        return;

    }


    const student =
        students.find(
            item =>
                item.studentId ===
                qrData.studentId
        );


    if (!student) {

        qrMessage.textContent =
            "Student not found in database.";

        return;

    }


    await markAttendance(student);

}


/* =========================================================
   MARK ATTENDANCE
========================================================= */

async function markAttendance(student) {

    const today =
        getTodayDate();


    try {

        /* Check duplicate */

        const attendanceRef =
            collection(
                db,
                "attendance"
            );


        const duplicateQuery =
            query(

                attendanceRef,

                where(
                    "studentId",
                    "==",
                    student.studentId
                ),

                where(
                    "date",
                    "==",
                    today
                )

            );


        const existing =
            await getDocs(
                duplicateQuery
            );


        if (!existing.empty) {

            showStudentResult(
                student,
                "Already marked present today."
            );

            qrMessage.textContent =
                `${student.name} is already marked present today.`;

            lastScanTime.textContent =
                getCurrentTime();

            return;

        }


        await addDoc(

            attendanceRef,

            {

                studentId:
                    student.studentId,

                studentName:
                    student.name || "",

                course:
                    student.course || "",

                batch:
                    student.batch || "",

                date:
                    today,

                time:
                    getCurrentTime(),

                createdAt:
                    serverTimestamp()

            }

        );


        showStudentResult(
            student,
            "Attendance marked successfully."
        );


        qrMessage.textContent =
            `✓ ${student.name} marked present successfully.`;

        lastScanTime.textContent =
            getCurrentTime();


    } catch (error) {

        console.error(
            "Attendance error:",
            error
        );

        qrMessage.textContent =
            "Unable to mark attendance: " +
            error.message;

    }

}


/* =========================================================
   STUDENT ATTENDANCE RESULT
========================================================= */

function showStudentResult(
    student,
    message
) {

    studentResult.innerHTML = `

        <div class="student-result">

            <div class="result-avatar">

                ${escapeHTML(
                    (student.name || "S")
                        .charAt(0)
                        .toUpperCase()
                )}

            </div>


            <div class="result-info">

                <h3>

                    ${escapeHTML(
                        student.name || "-"
                    )}

                </h3>


                <p>

                    <strong>ID:</strong>

                    ${escapeHTML(
                        student.studentId || "-"
                    )}

                </p>


                <p>

                    <strong>Course:</strong>

                    ${escapeHTML(
                        student.course || "-"
                    )}

                </p>


                <p>

                    <strong>Batch:</strong>

                    ${escapeHTML(
                        student.batch || "-"
                    )}

                </p>


                <div class="attendance-success">

                    ✓ ${escapeHTML(message)}

                </div>

            </div>

        </div>

    `;

}


/* =========================================================
   LOAD TODAY ATTENDANCE
========================================================= */

function loadAttendance() {

    if (unsubscribeAttendance) {
        unsubscribeAttendance();
    }


    const attendanceRef =
        collection(
            db,
            "attendance"
        );


    const attendanceQuery =
        query(
            attendanceRef,
            where(
                "date",
                "==",
                getTodayDate()
            )
        );


    unsubscribeAttendance =
        onSnapshot(

            attendanceQuery,

            snapshot => {

                attendanceRecords = [];


                snapshot.forEach(
                    docSnapshot => {

                        attendanceRecords.push({

                            id:
                                docSnapshot.id,

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


                const count =
                    attendanceRecords.length;


                if (todayAttendanceCount) {

                    todayAttendanceCount.textContent =
                        count;

                }


                if (attendanceCount) {

                    attendanceCount.textContent =
                        count;

                }


                renderAttendance(
                    attendanceRecords
                );

            },

            error => {

                console.error(
                    "Attendance loading error:",
                    error
                );

            }

        );

}


/* =========================================================
   RENDER ATTENDANCE
========================================================= */

function renderAttendance(data) {

    if (!attendanceTableBody) {
        return;
    }


    if (!data.length) {

        attendanceTableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty">

                    No attendance recorded today.

                </td>

            </tr>

        `;

        return;

    }


    attendanceTableBody.innerHTML = "";


    data.forEach(
        (record, index) => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${index + 1}
                </td>


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
                        record.time || "-"
                    )}

                </td>


                <td>

                    <span class="status-present">

                        ✓ Present

                    </span>

                </td>

            `;


            attendanceTableBody.appendChild(row);

        }
    );

}


/* =========================================================
   ATTENDANCE SEARCH
========================================================= */

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


            renderAttendance(
                filtered
            );

        }
    );

}


/* =========================================================
   DATE / TIME
========================================================= */

function getTodayDate() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}


function getCurrentTime() {

    return new Date()
        .toLocaleTimeString(
            "en-PK",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }
        );

}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutBtn) {

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

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}import { auth, db } from "../firebase/firebase-config.js";

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


/* =========================================================
   ELEMENTS
========================================================= */

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


/* =========================================================
   STUDENT DATA
========================================================= */

let students = [];
let unsubscribeStudents = null;


/* =========================================================
   AUTH CHECK
========================================================= */

onAuthStateChanged(auth, user => {

    if (!user) {

        window.location.href = "admin-login.html";

        return;
    }

    console.log("Admin authenticated:", user.email);

    loadStudents();

});


/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

menuItems.forEach(item => {

    item.addEventListener("click", () => {

        menuItems.forEach(i => {
            i.classList.remove("active");
        });

        pages.forEach(page => {
            page.classList.remove("active");
        });

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


/* =========================================================
   ADD STUDENT
========================================================= */

if (addStudentBtn) {

    addStudentBtn.addEventListener("click", () => {

        resetForm();

        modalTitle.textContent = "Add Student";

        saveStudentBtn.textContent = "Save Student";

        studentModal.classList.add("show");

    });

}


/* =========================================================
   CLOSE MODAL
========================================================= */

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


/* =========================================================
   RESET FORM
========================================================= */

function resetForm() {

    studentForm.reset();

    editStudentId.value = "";

    formMessage.textContent = "";

    modalTitle.textContent = "Add Student";

    saveStudentBtn.textContent = "Save Student";

}


/* =========================================================
   SAVE / UPDATE STUDENT
========================================================= */

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

            /* =========================
               UPDATE EXISTING STUDENT
            ========================= */

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


            /* =========================
               ADD NEW STUDENT
            ========================= */

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


/* =========================================================
   GENERATE STUDENT ID
========================================================= */

function generateStudentId() {

    const randomNumber =
        Math.floor(
            100000 + Math.random() * 900000
        );

    return "STU-" + randomNumber;

}


/* =========================================================
   LOAD STUDENTS
========================================================= */

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


            if (studentCount) {
                studentCount.textContent =
                    students.length;
            }


            renderStudents(students);

        },


        error => {

            console.error(
                "Firestore error:",
                error
            );


            studentsTableBody.innerHTML = `

                <tr>

                    <td
                        colspan="7"
                        class="empty">

                        Unable to load students.
                        Please check Firestore.

                    </td>

                </tr>

            `;

        }

    );

}


/* =========================================================
   RENDER STUDENTS
========================================================= */

function renderStudents(data) {

    if (!data.length) {

        studentsTableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty">

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


/* =========================================================
   ACTION BUTTONS
========================================================= */

function attachActionButtons() {

    document
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    editStudent(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteStudent(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(".id-card-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openStudentIDCard(
                        button.dataset.id
                    );

                }
            );

        });

}


/* =========================================================
   EDIT STUDENT
========================================================= */

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


/* =========================================================
   DELETE STUDENT
========================================================= */

async function deleteStudent(id) {

    const student =
        students.find(
            student => student.id === id
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    const confirmed =
        confirm(
            `Are you sure you want to delete "${student.name}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "students",
                id
            )
        );


        console.log(
            "Student deleted:",
            id
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


/* =========================================================
   SEARCH STUDENTS
========================================================= */

if (studentSearch) {

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

                    const name =
                        (
                            student.name || ""
                        ).toLowerCase();

                    const studentId =
                        (
                            student.studentId || ""
                        ).toLowerCase();

                    const phoneNumber =
                        (
                            student.phone || ""
                        ).toLowerCase();

                    const courseName =
                        (
                            student.course || ""
                        ).toLowerCase();

                    const batchName =
                        (
                            student.batch || ""
                        ).toLowerCase();


                    return (

                        name.includes(search) ||

                        studentId.includes(search) ||

                        phoneNumber.includes(search) ||

                        courseName.includes(search) ||

                        batchName.includes(search)

                    );

                });


            renderStudents(filtered);

        }
    );

}


/* =========================================================
   STUDENT ID CARD
   PROFESSIONAL PLASTIC CARD
========================================================= */

function openStudentIDCard(id) {

    const student =
        students.find(
            student => student.id === id
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    /* =========================
       QR DATA
    ========================= */

    const qrData =
        JSON.stringify({

            studentId:
                student.studentId || "",

            name:
                student.name || "",

            course:
                student.course || "",

            batch:
                student.batch || ""

        });


    /* =========================
       OPEN CARD WINDOW
    ========================= */

    const cardWindow =
        window.open(
            "",
            "_blank",
            "width=700,height=800"
        );


    if (!cardWindow) {

        alert(
            "Please allow pop-ups for this website."
        );

        return;

    }


    /* =========================
       CARD HTML
    ========================= */

    cardWindow.document.write(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0">

<title>
${escapeHTML(student.name || "Student")} - ID Card
</title>


<script
src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js">
</script>


<style>

* {
    box-sizing: border-box;
}


body {

    margin: 0;

    min-height: 100vh;

    display: flex;

    align-items: center;

    justify-content: center;

    background: #e8edf4;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

}


/* =========================================
   CARD WRAPPER
========================================= */

.card-container {

    display: flex;

    flex-direction: column;

    align-items: center;

    gap: 20px;

}


/* =========================================
   PROFESSIONAL PLASTIC ID CARD
   CR80 ratio: 85.60mm × 53.98mm
========================================= */

.id-card {

    width: 340px;

    height: 214px;

    border-radius: 14px;

    overflow: hidden;

    position: relative;

    background:
        linear-gradient(
            135deg,
            #ffffff 0%,
            #f8fafc 100%
        );

    box-shadow:
        0 14px 35px
        rgba(15, 23, 42, 0.22);

    border:
        1px solid #d7dee8;

}


/* =========================================
   TOP HEADER
========================================= */

.id-header {

    height: 68px;

    padding:
        10px 14px;

    display: flex;

    align-items: center;

    gap: 10px;

    color: white;

    background:
        linear-gradient(
            135deg,
            #172554,
            #1d4ed8
        );

    position: relative;

}


/* Decorative circle */

.id-header::after {

    content: "";

    position: absolute;

    width: 100px;

    height: 100px;

    right: -35px;

    top: -55px;

    border-radius: 50%;

    background:
        rgba(255,255,255,0.08);

}


/* =========================================
   LOGO
========================================= */

.logo {

    width: 42px;

    height: 42px;

    min-width: 42px;

    border-radius: 10px;

    display: flex;

    align-items: center;

    justify-content: center;

    background: white;

    color: #172554;

    font-size: 15px;

    font-weight: 900;

    box-shadow:
        0 3px 8px
        rgba(0,0,0,.15);

}


/* =========================================
   HEADER TEXT
========================================= */

.header-text {

    position: relative;

    z-index: 2;

}


.header-text h2 {

    margin: 0;

    font-size: 15px;

    line-height: 1.2;

}


.header-text p {

    margin:
        3px 0 0;

    font-size: 8px;

    opacity: .85;

}


/* =========================================
   CARD BODY
========================================= */

.id-body {

    height: 115px;

    padding:
        12px 14px;

    display: grid;

    grid-template-columns:
        1fr 72px;

    gap: 10px;

}


/* =========================================
   STUDENT NAME
========================================= */

.student-name {

    color: #172554;

    font-size: 16px;

    font-weight: 800;

    margin-bottom: 6px;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

}


/* =========================================
   STUDENT INFORMATION
========================================= */

.info {

    font-size: 9px;

    color: #475569;

    line-height: 1.65;

}


.info div {

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

}


.info strong {

    display: inline-block;

    width: 42px;

    color: #172554;

}


/* =========================================
   QR
========================================= */

.qr {

    width: 72px;

    height: 72px;

    padding: 4px;

    display: flex;

    align-items: center;

    justify-content: center;

    background: white;

    border:
        1px solid #dbe3ed;

    border-radius: 7px;

    box-shadow:
        0 2px 7px
        rgba(15,23,42,.08);

}


.qr img {

    width: 64px !important;

    height: 64px !important;

}


/* =========================================
   FOOTER
========================================= */

.id-footer {

    height: 31px;

    padding:
        0 14px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    color: #475569;

    background: #f1f5f9;

    border-top:
        1px solid #e2e8f0;

    font-size: 7px;

}


.id-footer strong {

    color: #172554;

}


/* =========================================
   BUTTON
========================================= */

.download-btn {

    border: none;

    border-radius: 8px;

    padding:
        11px 22px;

    background:
        linear-gradient(
            135deg,
            #2563eb,
            #1d4ed8
        );

    color: white;

    font-size: 13px;

    font-weight: 700;

    cursor: pointer;

    box-shadow:
        0 5px 15px
        rgba(37,99,235,.25);

}


.download-btn:hover {

    transform: translateY(-1px);

}


/* =========================================
   PRINT
========================================= */

@media print {

    @page {

        size: 85.6mm 53.98mm;

        margin: 0;

    }


    body {

        width: 85.6mm;

        height: 53.98mm;

        background: white;

    }


    .card-container {

        gap: 0;

    }


    .id-card {

        width: 85.6mm;

        height: 53.98mm;

        border-radius: 3mm;

        box-shadow: none;

        border: .2mm solid #d7dee8;

    }


    .download-btn {

        display: none;

    }

}

</style>

</head>


<body>


<div class="card-container">


    <div
        class="id-card"
        id="printCard">


        <!-- HEADER -->

        <div class="id-header">

            <div class="logo">
                SS
            </div>


            <div class="header-text">

                <h2>
                    Sir Syed Hassan Ali
                </h2>

                <p>
                    COACHING MANAGEMENT SYSTEM
                </p>

            </div>

        </div>


        <!-- BODY -->

        <div class="id-body">


            <div>


                <div class="student-name">

                    ${escapeHTML(
                        student.name || "Student"
                    )}

                </div>


                <div class="info">

                    <div>

                        <strong>ID</strong>

                        ${escapeHTML(
                            student.studentId || "-"
                        )}

                    </div>


                    <div>

                        <strong>Father</strong>

                        ${escapeHTML(
                            student.fatherName || "-"
                        )}

                    </div>


                    <div>

                        <strong>Course</strong>

                        ${escapeHTML(
                            student.course || "-"
                        )}

                    </div>


                    <div>

                        <strong>Batch</strong>

                        ${escapeHTML(
                            student.batch || "-"
                        )}

                    </div>


                    <div>

                        <strong>Phone</strong>

                        ${escapeHTML(
                            student.phone || "-"
                        )}

                    </div>

                </div>

            </div>


            <!-- QR -->

            <div
                class="qr"
                id="studentQR">
            </div>


        </div>


        <!-- FOOTER -->

        <div class="id-footer">

            <strong>
                Sir Syed Hassan Ali Coaching
            </strong>

            <span>
                STUDENT ID CARD
            </span>

        </div>


    </div>


    <button
        class="download-btn"
        onclick="window.print()">

        🖨️ Print / Save as PDF

    </button>


</div>


<script>

window.onload = function() {

    const qrElement =
        document.getElementById("studentQR");


    new QRCode(

        qrElement,

        {

            text:
                ${JSON.stringify(qrData)},

            width: 64,

            height: 64,

            correctLevel:
                QRCode.CorrectLevel.H

        }

    );

};

</script>


</body>

</html>

    `);


    cardWindow.document.close();

}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutBtn) {

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

}


/* =========================================================
   CLOSE MODAL ON OUTSIDE CLICK
========================================================= */

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


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}import { auth, db } from "../firebase/firebase-config.js";

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
