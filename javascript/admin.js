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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   ADMIN DASHBOARD - CLEAN SINGLE VERSION
========================================================= */

const $ = id => document.getElementById(id);

const menuItems = document.querySelectorAll(".menu-item");
const pages = document.querySelectorAll(".page");

const pageTitle = $("pageTitle");
const logoutBtn = $("logoutBtn");

const addStudentBtn = $("addStudentBtn");
const studentModal = $("studentModal");
const closeModalBtn = $("closeModal");
const cancelBtn = $("cancelBtn");
const studentForm = $("studentForm");

const editStudentId = $("editStudentId");
const studentName = $("studentName");
const fatherName = $("fatherName");
const phone = $("phone");
const course = $("course");
const batch = $("batch");
const admissionDate = $("admissionDate");
const modalTitle = $("modalTitle");
const saveStudentBtn = $("saveStudentBtn");
const formMessage = $("formMessage");

const studentsTableBody = $("studentsTableBody");
const studentSearch = $("studentSearch");
const studentCount = $("studentCount");
const courseCount = $("courseCount");
const successRate = $("successRate");
const recentActivity = $("recentActivity");

const qrReader = $("qr-reader");
const startScannerBtn = $("startScannerBtn");
const stopScannerBtn = $("stopScannerBtn");
const scannerStatus = $("scannerStatus");
const qrMessage = $("qrMessage");
const studentResult = $("studentResult");
const todayAttendanceCount = $("todayAttendanceCount");
const attendanceCount = $("attendanceCount");
const lastScanTime = $("lastScanTime");
const attendanceTableBody = $("attendanceTableBody");
const attendanceSearch = $("attendanceSearch");

let students = [];
let attendanceRecords = [];

let unsubscribeStudents = null;
let unsubscribeAttendance = null;

let html5QrCode = null;
let scannerRunning = false;

let lastScannedId = "";
let lastScannedAt = 0;

/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async user => {

    if (!user) {
        window.location.href = "admin-login.html";
        return;
    }

    console.log("Admin authenticated:", user.email);

    /*
     * Load the main dashboard data.
     */
    loadStudents();
    loadAttendance();

    /*
     * Load Fee Management only after admin authentication.
     *
     * This is important because fees.js uses Firebase and
     * the Fee Management UI exists inside admin-dashboard.html.
     */
    try {

        await import("./fees.js");

        console.log("✅ Fee Management module loaded successfully.");

    } catch (error) {

        console.error(
            "❌ Fee Management module failed to load:",
            error
        );

    }

});

/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

menuItems.forEach(item => {

    item.addEventListener("click", () => {

        menuItems.forEach(menu =>
            menu.classList.remove("active")
        );

        pages.forEach(page =>
            page.classList.remove("active")
        );

        item.classList.add("active");

        const selectedPage = $(item.dataset.page);

        if (selectedPage) {
            selectedPage.classList.add("active");
        }

        if (pageTitle) {
            pageTitle.textContent =
                item.textContent
                    .replace(/\s+/g, " ")
                    .trim();
        }

        if (item.dataset.page !== "attendance") {
            stopScanner();
        }

    });

});

/* =========================================================
   STUDENT MODAL
========================================================= */

if (addStudentBtn) {

    addStudentBtn.addEventListener("click", () => {

        resetForm();

        if (modalTitle) {
            modalTitle.textContent = "Add Student";
        }

        if (saveStudentBtn) {
            saveStudentBtn.textContent = "Save Student";
        }

        studentModal?.classList.add("show");

    });

}

if (closeModalBtn) {
    closeModalBtn.addEventListener(
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

    studentModal?.classList.remove("show");

    resetForm();

}

function resetForm() {

    studentForm?.reset();

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

        saveStudentBtn.textContent =
            "Save Student";

        saveStudentBtn.disabled = false;

    }

}

/* =========================================================
   ADD / UPDATE STUDENT
========================================================= */

if (studentForm) {

    studentForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (saveStudentBtn) {
                saveStudentBtn.disabled = true;
            }

            if (formMessage) {
                formMessage.textContent =
                    "Saving student...";
            }

            const studentData = {

                name:
                    studentName?.value.trim() || "",

                fatherName:
                    fatherName?.value.trim() || "",

                phone:
                    phone?.value.trim() || "",

                course:
                    course?.value.trim() || "",

                batch:
                    batch?.value.trim() || "",

                admissionDate:
                    admissionDate?.value || ""

            };

            try {

                if (editStudentId?.value) {

                    await updateDoc(
                        doc(
                            db,
                            "students",
                            editStudentId.value
                        ),
                        studentData
                    );

                    if (formMessage) {
                        formMessage.textContent =
                            "Student updated successfully.";
                    }

                } else {

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

                    if (formMessage) {
                        formMessage.textContent =
                            "Student added successfully.";
                    }

                }

                setTimeout(
                    closeStudentModal,
                    500
                );

            } catch (error) {

                console.error(
                    "Student save error:",
                    error
                );

                if (formMessage) {
                    formMessage.textContent =
                        "Error: " + error.message;
                }

            } finally {

                if (saveStudentBtn) {
                    saveStudentBtn.disabled = false;
                }

            }

        }
    );

}

function generateStudentId() {

    return (
        "STU-" +
        Math.floor(
            100000 + Math.random() * 900000
        )
    );

}

/* =========================================================
   STUDENT LOAD / RENDER
========================================================= */

function loadStudents() {

    if (unsubscribeStudents) {
        unsubscribeStudents();
    }

    const studentsRef =
        collection(db, "students");

    unsubscribeStudents =
        onSnapshot(

            studentsRef,

            snapshot => {

                students =
                    snapshot.docs.map(item => ({
                        id: item.id,
                        ...item.data()
                    }));

                students.sort(
                    (a, b) =>
                        getCreatedTime(b) -
                        getCreatedTime(a)
                );

                if (studentCount) {
                    studentCount.textContent =
                        students.length;
                }

                if (courseCount) {

                    const courses =
                        new Set(
                            students
                                .map(
                                    s =>
                                        (s.course || "")
                                            .trim()
                                            .toLowerCase()
                                )
                                .filter(Boolean)
                        );

                    courseCount.textContent =
                        courses.size;
                }

                renderStudents(students);

                updateDashboardStats();

            },

            error => {

                console.error(
                    "Firestore student error:",
                    error
                );

                if (studentsTableBody) {

                    studentsTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="empty">
                                Unable to load students.
                                Please check Firestore permissions.
                            </td>
                        </tr>
                    `;

                }

            }

        );

}

function getCreatedTime(student) {

    if (!student?.createdAt) {
        return 0;
    }

    if (
        typeof student.createdAt.toMillis ===
        "function"
    ) {
        return student.createdAt.toMillis();
    }

    if (student.createdAt.seconds) {
        return student.createdAt.seconds * 1000;
    }

    return 0;

}

function renderStudents(data) {

    if (!studentsTableBody) {
        return;
    }

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

    studentsTableBody.innerHTML =
        data
            .map(
                student => `
                    <tr>

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

                            <div class="action-buttons">

                                <button
                                    type="button"
                                    class="action-btn edit-btn"
                                    data-id="${student.id}"
                                >
                                    ✏️ Edit
                                </button>

                                <button
                                    type="button"
                                    class="action-btn delete-btn"
                                    data-id="${student.id}"
                                >
                                    🗑️ Delete
                                </button>

                                <button
                                    type="button"
                                    class="action-btn id-card-btn"
                                    data-id="${student.id}"
                                >
                                    🪪 ID Card
                                </button>

                            </div>

                        </td>

                    </tr>
                `
            )
            .join("");

    attachActionButtons();

}

function attachActionButtons() {

    document
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    editStudent(
                        button.dataset.id
                    )
            );

        });

    document
        .querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteStudent(
                        button.dataset.id
                    )
            );

        });

    document
        .querySelectorAll(".id-card-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    openStudentIDCard(
                        button.dataset.id
                    )
            );

        });

}

function editStudent(id) {

    const student =
        students.find(
            item => item.id === id
        );

    if (!student) {
        alert("Student not found.");
        return;
    }

    if (editStudentId) {
        editStudentId.value =
            student.id;
    }

    if (studentName) {
        studentName.value =
            student.name || "";
    }

    if (fatherName) {
        fatherName.value =
            student.fatherName || "";
    }

    if (phone) {
        phone.value =
            student.phone || "";
    }

    if (course) {
        course.value =
            student.course || "";
    }

    if (batch) {
        batch.value =
            student.batch || "";
    }

    if (admissionDate) {
        admissionDate.value =
            student.admissionDate || "";
    }

    if (modalTitle) {
        modalTitle.textContent =
            "Edit Student";
    }

    if (saveStudentBtn) {
        saveStudentBtn.textContent =
            "Update Student";
    }

    if (formMessage) {
        formMessage.textContent = "";
    }

    studentModal?.classList.add("show");

}

async function deleteStudent(id) {

    const student =
        students.find(
            item => item.id === id
        );

    if (!student) {
        alert("Student not found.");
        return;
    }

    if (
        !confirm(
            `Are you sure you want to delete "${student.name || "this student"}"?`
        )
    ) {
        return;
    }

    try {

        await deleteDoc(
            doc(db, "students", id)
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
   STUDENT SEARCH
========================================================= */

if (studentSearch) {

    studentSearch.addEventListener(
        "input",
        () => {

            const value =
                studentSearch.value
                    .toLowerCase()
                    .trim();

            if (!value) {

                renderStudents(
                    students
                );

                return;
            }

            const filtered =
                students.filter(
                    student => {

                        return [
                            student.name,
                            student.studentId,
                            student.phone,
                            student.course,
                            student.batch,
                            student.fatherName
                        ].some(
                            field =>
                                String(field || "")
                                    .toLowerCase()
                                    .includes(value)
                        );

                    }
                );

            renderStudents(filtered);

        }
    );

}

/* =========================================================
   ATTENDANCE - FIRESTORE
========================================================= */

function todayKey() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}

function loadAttendance() {

    if (unsubscribeAttendance) {
        unsubscribeAttendance();
    }

    const attendanceRef =
        collection(
            db,
            "attendance"
        );

    unsubscribeAttendance =
        onSnapshot(

            attendanceRef,

            snapshot => {

                const today =
                    todayKey();

                attendanceRecords =
                    snapshot.docs
                        .map(item => ({
                            id: item.id,
                            ...item.data()
                        }))
                        .filter(
                            item =>
                                item.date === today
                        )
                        .sort(
                            (a, b) =>
                                getAttendanceTime(b) -
                                getAttendanceTime(a)
                        );

                renderAttendance(
                    attendanceRecords
                );

                updateDashboardStats();

            },

            error => {

                console.error(
                    "Firestore attendance error:",
                    error
                );

                if (attendanceTableBody) {

                    attendanceTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="empty">
                                Unable to load attendance.
                            </td>
                        </tr>
                    `;

                }

            }

        );

}

function getAttendanceTime(record) {

    if (!record?.timestamp) {
        return 0;
    }

    if (
        typeof record.timestamp.toMillis ===
        "function"
    ) {
        return record.timestamp.toMillis();
    }

    if (record.timestamp.seconds) {
        return (
            record.timestamp.seconds *
            1000
        );
    }

    return 0;

}

function renderAttendance(data) {

    if (todayAttendanceCount) {
        todayAttendanceCount.textContent =
            data.length;
    }

    if (attendanceCount) {
        attendanceCount.textContent =
            data.length;
    }

    if (!attendanceTableBody) {
        return;
    }

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

    attendanceTableBody.innerHTML =
        data
            .map(
                (record, index) => `
                    <tr>

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
                                record.name || "-"
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
                                record.time ||
                                formatTime(
                                    record.timestamp
                                )
                            )}
                        </td>

                        <td>
                            <span class="scanner-status">
                                Present
                            </span>
                        </td>

                    </tr>
                `
            )
            .join("");

    if (lastScanTime && data[0]) {

        lastScanTime.textContent =
            data[0].time ||
            formatTime(
                data[0].timestamp
            );

    }

}

function updateDashboardStats() {

    if (attendanceCount) {
        attendanceCount.textContent =
            attendanceRecords.length;
    }

    if (todayAttendanceCount) {
        todayAttendanceCount.textContent =
            attendanceRecords.length;
    }

    if (successRate) {

        const rate =
            students.length
                ? Math.round(
                    (
                        attendanceRecords.length /
                        students.length
                    ) * 100
                )
                : 0;

        successRate.textContent =
            `${Math.min(rate, 100)}%`;

    }

    if (recentActivity) {

        if (!attendanceRecords.length) {

            recentActivity.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        📋
                    </div>

                    <p>
                        No recent activity yet.
                    </p>

                </div>
            `;

        } else {

            recentActivity.innerHTML =
                attendanceRecords
                    .slice(0, 5)
                    .map(
                        record => `
                            <div
                                style="
                                    padding:10px 0;
                                    border-bottom:1px solid #f0f2f5;
                                    font-size:13px;
                                "
                            >

                                <strong>
                                    ${escapeHTML(
                                        record.name ||
                                        "Student"
                                    )}
                                </strong>

                                marked attendance at
                                ${escapeHTML(
                                    record.time ||
                                    "--"
                                )}

                            </div>
                        `
                    )
                    .join("");

        }

    }

}

function formatTime(timestamp) {

    if (!timestamp) {
        return "--";
    }

    let date;

    if (
        typeof timestamp.toDate ===
        "function"
    ) {

        date =
            timestamp.toDate();

    } else if (
        timestamp.seconds
    ) {

        date =
            new Date(
                timestamp.seconds * 1000
            );

    } else {

        date =
            new Date(timestamp);

    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "--";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

}

/* =========================================================
   QR SCANNER
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

        setScannerMessage(
            "QR scanner library failed to load. Refresh the page.",
            true
        );

        return;
    }

    if (!qrReader) {
        return;
    }

    try {

        html5QrCode =
            new Html5Qrcode(
                "qr-reader"
            );

        await html5QrCode.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                aspectRatio: 1
            },

            decodedText =>
                handleQRScan(
                    decodedText
                ),

            () => {}

        );

        scannerRunning = true;

        if (scannerStatus) {
            scannerStatus.textContent =
                "Scanner Active";
        }

        setScannerMessage(
            "Scanner is active. Show the student's QR card to the camera."
        );

    } catch (error) {

        console.error(
            "Scanner start error:",
            error
        );

        scannerRunning = false;

        if (scannerStatus) {
            scannerStatus.textContent =
                "Scanner Error";
        }

        setScannerMessage(
            "Unable to start camera. Allow camera permission and use HTTPS/localhost.",
            true
        );

    }

}

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

        console.warn(
            "Scanner stop warning:",
            error
        );

    }

    html5QrCode = null;
    scannerRunning = false;

    if (scannerStatus) {
        scannerStatus.textContent =
            "Scanner Ready";
    }

}

async function handleQRScan(
    decodedText
) {

    const now =
        Date.now();

    if (
        decodedText === lastScannedId &&
        now - lastScannedAt < 2500
    ) {
        return;
    }

    lastScannedId =
        decodedText;

    lastScannedAt =
        now;

    let qrData;

    try {

        qrData =
            JSON.parse(
                decodedText
            );

    } catch {

        setScannerMessage(
            "Invalid student QR code.",
            true
        );

        return;
    }

    const student =
        students.find(
            item =>
                item.studentId ===
                qrData.studentId
        );

    if (!student) {

        setScannerMessage(
            "Student not found in the system.",
            true
        );

        return;
    }

    showStudentResult(
        student
    );

    await markAttendance(
        student
    );

}

async function markAttendance(
    student
) {

    const today =
        todayKey();

    const alreadyPresent =
        attendanceRecords.some(
            record =>
                record.studentDocId ===
                    student.id ||
                record.studentId ===
                    student.studentId
        );

    if (alreadyPresent) {

        setScannerMessage(
            `${student.name} is already marked present today.`
        );

        return;
    }

    try {

        await addDoc(
            collection(
                db,
                "attendance"
            ),
            {

                studentDocId:
                    student.id,

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
                    student.batch || "",

                date:
                    today,

                time:
                    new Date().toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                        }
                    ),

                status:
                    "Present",

                timestamp:
                    serverTimestamp()

            }
        );

        setScannerMessage(
            `Attendance marked successfully for ${student.name}.`
        );

    } catch (error) {

        console.error(
            "Attendance save error:",
            error
        );

        setScannerMessage(
            "Attendance could not be saved: " +
            error.message,
            true
        );

    }

}

function showStudentResult(
    student
) {

    if (!studentResult) {
        return;
    }

    studentResult.innerHTML = `

        <div
            style="
                padding:18px;
                border:1px solid #e5e7eb;
                border-radius:12px;
                background:#f8fafc;
            "
        >

            <h3
                style="
                    margin-bottom:12px;
                    color:#172554;
                "
            >
                ${escapeHTML(
                    student.name ||
                    "Student"
                )}
            </h3>

            <p style="margin:6px 0;font-size:13px;">
                <strong>ID:</strong>
                ${escapeHTML(
                    student.studentId || "-"
                )}
            </p>

            <p style="margin:6px 0;font-size:13px;">
                <strong>Father:</strong>
                ${escapeHTML(
                    student.fatherName || "-"
                )}
            </p>

            <p style="margin:6px 0;font-size:13px;">
                <strong>Course:</strong>
                ${escapeHTML(
                    student.course || "-"
                )}
            </p>

            <p style="margin:6px 0;font-size:13px;">
                <strong>Batch:</strong>
                ${escapeHTML(
                    student.batch || "-"
                )}
            </p>

            <p style="margin:6px 0;font-size:13px;">
                <strong>Phone:</strong>
                ${escapeHTML(
                    student.phone || "-"
                )}
            </p>

        </div>

    `;

}

function setScannerMessage(
    message,
    error = false
) {

    if (!qrMessage) {
        return;
    }

    qrMessage.textContent =
        message;

    qrMessage.style.color =
        error
            ? "#dc2626"
            : "#6b7280";

}

/* =========================================================
   ATTENDANCE SEARCH
========================================================= */

if (attendanceSearch) {

    attendanceSearch.addEventListener(
        "input",
        () => {

            const value =
                attendanceSearch.value
                    .toLowerCase()
                    .trim();

            if (!value) {

                renderAttendance(
                    attendanceRecords
                );

                return;
            }

            const filtered =
                attendanceRecords.filter(
                    record =>
                        [
                            record.name,
                            record.studentId,
                            record.course,
                            record.batch
                        ].some(
                            field =>
                                String(
                                    field || ""
                                )
                                    .toLowerCase()
                                    .includes(value)
                        )
                );

            renderAttendance(
                filtered
            );

        }
    );

}

/* =========================================================
   ID CARD
========================================================= */

function openStudentIDCard(
    id
) {

    const student =
        students.find(
            item => item.id === id
        );

    if (!student) {
        alert("Student not found.");
        return;
    }

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

    const cardWindow =
        window.open(
            "",
            "_blank",
            "width=520,height=720"
        );

    if (!cardWindow) {

        alert(
            "Please allow pop-ups for this website."
        );

        return;
    }

    const safeName =
        escapeHTML(
            student.name ||
            "Student"
        );

    const safeId =
        escapeHTML(
            student.studentId ||
            "-"
        );

    const safeFather =
        escapeHTML(
            student.fatherName ||
            "-"
        );

    const safeCourse =
        escapeHTML(
            student.course ||
            "-"
        );

    const safeBatch =
        escapeHTML(
            student.batch ||
            "-"
        );

    const safePhone =
        escapeHTML(
            student.phone ||
            "-"
        );

    cardWindow.document.write(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
>

<title>
    ${safeName} - Student ID Card
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

.wrap {

    display: flex;

    flex-direction: column;

    align-items: center;

    gap: 18px;

}

.card {

    width: 340px;

    height: 214px;

    border-radius: 14px;

    overflow: hidden;

    background: #fff;

    border: 1px solid #d7dee8;

    box-shadow:
        0 14px 35px
        rgba(15,23,42,.22);

}

.header {

    height: 68px;

    padding: 10px 14px;

    display: flex;

    align-items: center;

    gap: 10px;

    color: #fff;

    background:
        linear-gradient(
            135deg,
            #172554,
            #1d4ed8
        );

}

.logo {

    width: 42px;

    height: 42px;

    border-radius: 10px;

    background: #fff;

    color: #172554;

    display: flex;

    align-items: center;

    justify-content: center;

    font-size: 15px;

    font-weight: 900;

}

.header h2 {

    margin: 0;

    font-size: 15px;

}

.header p {

    margin: 3px 0 0;

    font-size: 8px;

    opacity: .85;

}

.body {

    height: 115px;

    padding: 12px 14px;

    display: grid;

    grid-template-columns: 1fr 72px;

    gap: 10px;

}

.name {

    color: #172554;

    font-size: 16px;

    font-weight: 800;

    margin-bottom: 6px;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

}

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

.qr {

    width: 72px;

    height: 72px;

    padding: 4px;

    background: #fff;

    border: 1px solid #dbe3ed;

    border-radius: 7px;

    display: flex;

    align-items: center;

    justify-content: center;

}

.qr img {

    width: 64px !important;

    height: 64px !important;

}

.footer {

    height: 31px;

    padding: 0 14px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    color: #475569;

    background: #f1f5f9;

    border-top: 1px solid #e2e8f0;

    font-size: 7px;

}

.footer strong {

    color: #172554;

}

.print {

    border: 0;

    border-radius: 8px;

    padding: 11px 22px;

    background: #2563eb;

    color: #fff;

    font-size: 13px;

    font-weight: 700;

    cursor: pointer;

}

@media print {

    @page {

        size: 85.6mm 53.98mm;

        margin: 0;

    }

    body {

        width: 85.6mm;

        height: 53.98mm;

        background: #fff;

    }

    .wrap {

        gap: 0;

    }

    .card {

        width: 85.6mm;

        height: 53.98mm;

        border-radius: 3mm;

        box-shadow: none;

    }

    .print {

        display: none;

    }

}

</style>

</head>

<body>

<div class="wrap">

<div class="card">

<div class="header">

<div class="logo">
    SS
</div>

<div>

<h2>
    Sir Syed Hassan Ali
</h2>

<p>
    COACHING MANAGEMENT SYSTEM
</p>

</div>

</div>

<div class="body">

<div>

<div class="name">
    ${safeName}
</div>

<div class="info">

<div>
    <strong>ID</strong>
    ${safeId}
</div>

<div>
    <strong>Father</strong>
    ${safeFather}
</div>

<div>
    <strong>Course</strong>
    ${safeCourse}
</div>

<div>
    <strong>Batch</strong>
    ${safeBatch}
</div>

<div>
    <strong>Phone</strong>
    ${safePhone}
</div>

</div>

</div>

<div
    class="qr"
    id="studentQR"
></div>

</div>

<div class="footer">

<strong>
    Sir Syed Hassan Ali Coaching
</strong>

<span>
    STUDENT ID CARD
</span>

</div>

</div>

<button
    class="print"
    onclick="window.print()"
>
    🖨️ Print / Save as PDF
</button>

</div>

<script>

window.onload = function () {

    new QRCode(
        document.getElementById(
            "studentQR"
        ),
        {
            text: ${JSON.stringify(qrData)},
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

                await stopScanner();

                await signOut(auth);

                window.location.href =
                    "admin-login.html";

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                alert(
                    "Logout failed: " +
                    error.message
                );

            }

        }
    );

}

/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (unsubscribeStudents) {
            unsubscribeStudents();
        }

        if (unsubscribeAttendance) {
            unsubscribeAttendance();
        }

    }
);

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

}

console.log(
    "✅ Clean admin.js loaded successfully"
);
