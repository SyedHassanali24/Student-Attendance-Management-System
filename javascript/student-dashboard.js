/* =========================================================
   ATTENDANCE - FIXED & REALTIME
========================================================= */

function loadAttendance() {

    if (!currentStudent) return;

    const attendanceRef =
        collection(
            db,
            "attendance"
        );

    /*
       We support BOTH:
       1. studentDocId
       2. studentId

       This makes the student dashboard compatible
       with all attendance records created by Admin.
    */

    const docIdQuery =
        query(
            attendanceRef,
            where(
                "studentDocId",
                "==",
                currentStudent.id
            )
        );

    const studentIdQuery =
        currentStudent.studentId
            ? query(
                attendanceRef,
                where(
                    "studentId",
                    "==",
                    currentStudent.studentId
                )
            )
            : null;


    let docIdRecords = [];
    let studentIdRecords = [];


    const mergeAttendanceRecords = () => {

        const merged = [
            ...docIdRecords,
            ...studentIdRecords
        ];


        /*
           Remove duplicate attendance records
           when the same record matches both queries.
        */

        const unique =
            new Map();


        merged.forEach(record => {

            unique.set(
                record.id,
                record
            );

        });


        attendanceRecords =
            Array.from(
                unique.values()
            );


        /*
           Sort newest attendance first.
        */

        attendanceRecords.sort(
            (a, b) => {

                const dateA =
                    String(
                        a.date || ""
                    );

                const dateB =
                    String(
                        b.date || ""
                    );

                if (
                    dateA !== dateB
                ) {
                    return dateB.localeCompare(
                        dateA
                    );
                }


                return String(
                    b.time || ""
                ).localeCompare(
                    String(
                        a.time || ""
                    )
                );

            }
        );


        renderAttendance();

    };


    /*
       QUERY BY FIRESTORE DOCUMENT ID
    */

    onSnapshot(
        docIdQuery,

        snapshot => {

            docIdRecords =
                snapshot.docs.map(
                    item => ({
                        id:
                            item.id,

                        ...item.data()
                    })
                );


            mergeAttendanceRecords();

        },

        error => {

            console.error(
                "Attendance studentDocId error:",
                error
            );

            docIdRecords = [];

            mergeAttendanceRecords();

        }
    );


    /*
       QUERY BY STUDENT ID
    */

    if (studentIdQuery) {

        onSnapshot(
            studentIdQuery,

            snapshot => {

                studentIdRecords =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                mergeAttendanceRecords();

            },

            error => {

                console.error(
                    "Attendance studentId error:",
                    error
                );

                studentIdRecords = [];

                mergeAttendanceRecords();

            }
        );

    }

}import { auth, db } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


let currentStudent = null;

let attendanceRecords = [];
let feeRecords = [];
let resultRecords = [];
let announcementRecords = [];

let attendancePieChart = null;
let attendanceLineChart = null;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "./login.html";

        return;
    }

    try {

        await loadStudent(user);

    } catch (error) {

        console.error(
            "Student Dashboard Error:",
            error
        );

        showDashboardError(
            "Unable to load student information."
        );

    }

});


/* =========================================================
   LOAD STUDENT
========================================================= */

async function loadStudent(user) {

    let student = null;

    /*
     * First try Firebase Auth UID.
     */

    const uidQuery = query(
        collection(db, "students"),
        where("uid", "==", user.uid)
    );

    const uidSnapshot =
        await getDocs(uidQuery);


    if (!uidSnapshot.empty) {

        const item =
            uidSnapshot.docs[0];

        student = {
            id: item.id,
            ...item.data()
        };

    }


    /*
     * If UID is not stored in student document,
     * try email.
     */

    if (!student && user.email) {

        const emailQuery = query(
            collection(db, "students"),
            where("email", "==", user.email)
        );

        const emailSnapshot =
            await getDocs(emailQuery);


        if (!emailSnapshot.empty) {

            const item =
                emailSnapshot.docs[0];

            student = {
                id: item.id,
                ...item.data()
            };

        }

    }


    /*
     * Final fallback:
     * studentId saved in localStorage.
     */

    if (!student) {

        const savedStudentId =
            localStorage.getItem(
                "studentId"
            );


        if (savedStudentId) {

            const idQuery = query(
                collection(db, "students"),
                where(
                    "studentId",
                    "==",
                    savedStudentId
                )
            );

            const idSnapshot =
                await getDocs(idQuery);


            if (!idSnapshot.empty) {

                const item =
                    idSnapshot.docs[0];

                student = {
                    id: item.id,
                    ...item.data()
                };

            }

        }

    }


    if (!student) {

        showDashboardError(
            "Student profile was not found. Please contact administration."
        );

        return;

    }


    currentStudent = student;


    localStorage.setItem(
        "studentId",
        student.studentId || ""
    );


    renderStudentProfile(
        student
    );


    await Promise.all([
        loadAttendance(student),
        loadFees(student),
        loadResults(student),
        loadAnnouncements()
    ]);

}


/* =========================================================
   STUDENT PROFILE
========================================================= */

function renderStudentProfile(student) {

    const name =
        student.name ||
        student.studentName ||
        "Student";


    const studentId =
        student.studentId ||
        "—";


    setText(
        "welcomeName",
        name
    );

    setText(
        "welcomeStudentId",
        studentId
    );

    setText(
        "topStudentName",
        name
    );

    setText(
        "topStudentId",
        studentId
    );


    setText(
        "profileName",
        name
    );

    setText(
        "profileStudentId",
        studentId
    );

    setText(
        "profileFatherName",
        student.fatherName ||
        "—"
    );

    setText(
        "profilePhone",
        student.phone ||
        "—"
    );

    setText(
        "profileCourse",
        student.course ||
        "—"
    );

    setText(
        "profileBatch",
        student.batch ||
        "—"
    );


    const avatar =
        document.querySelector(
            "#profileAvatar"
        );


    if (avatar) {

        avatar.textContent =
            name
                .trim()
                .charAt(0)
                .toUpperCase() ||
            "S";

    }

}


/* =========================================================
   ATTENDANCE
========================================================= */

async function loadAttendance(student) {

    attendanceRecords = [];


    const queries = [];


    queries.push(
        query(
            collection(db, "attendance"),
            where(
                "studentDocId",
                "==",
                student.id
            )
        )
    );


    if (student.studentId) {

        queries.push(
            query(
                collection(db, "attendance"),
                where(
                    "studentId",
                    "==",
                    student.studentId
                )
            )
        );

    }


    let found = false;


    for (
        const attendanceQuery
        of queries
    ) {

        try {

            const snapshot =
                await getDocs(
                    attendanceQuery
                );


            if (!snapshot.empty) {

                attendanceRecords =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                found = true;

                break;

            }

        } catch (error) {

            console.warn(
                "Attendance query failed:",
                error
            );

        }

    }


    if (!found) {

        attendanceRecords = [];

    }


    renderAttendance(
        attendanceRecords
    );

}


/* =========================================================
   RENDER ATTENDANCE
========================================================= */

function renderAttendance(records) {

    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;


    records.forEach(record => {

        const status =
            String(
                record.status ||
                ""
            )
                .toLowerCase()
                .trim();


        if (
            status === "present" ||
            status === "p"
        ) {

            present++;

        } else if (
            status === "absent" ||
            status === "a"
        ) {

            absent++;

        } else if (
            status === "late" ||
            status === "l"
        ) {

            late++;

        } else if (
            status === "leave" ||
            status === "on leave"
        ) {

            leave++;

        }

    });


    const total =
        present +
        absent +
        late +
        leave;


    const percentage =
        total > 0
            ? Math.round(
                (present / total) * 100
            )
            : 0;


    setText(
        "attendancePercent",
        `${percentage}%`
    );

    setText(
        "attendancePagePercent",
        `${percentage}%`
    );


    setText(
        "presentDays",
        present
    );

    setText(
        "absentDays",
        absent
    );


    setText(
        "attendancePagePresent",
        present
    );

    setText(
        "attendancePageAbsent",
        absent
    );

    setText(
        "attendancePageLate",
        late
    );

    setText(
        "attendancePageLeave",
        leave
    );


    setText(
        "legendPresent",
        present
    );

    setText(
        "legendAbsent",
        absent
    );

    setText(
        "legendLate",
        late
    );

    setText(
        "legendLeave",
        leave
    );


    setText(
        "attendanceStatus",
        total
            ? `${present} of ${total} days present`
            : "No attendance data"
    );


    setText(
        "overviewAttendance",
        `${percentage}% attendance`
    );


    createAttendancePie(
        present,
        absent,
        late,
        leave
    );


    createAttendanceLine(
        records
    );


    renderAttendanceTable(
        records
    );

}


/* =========================================================
   ATTENDANCE PIE
========================================================= */

function createAttendancePie(
    present,
    absent,
    late,
    leave
) {

    const canvas =
        document.getElementById(
            "attendancePieChart"
        );


    if (!canvas) return;


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js not loaded."
        );

        return;

    }


    if (attendancePieChart) {

        attendancePieChart.destroy();

    }


    attendancePieChart =
        new Chart(
            canvas,
            {
                type: "doughnut",

                data: {

                    labels: [
                        "Present",
                        "Absent",
                        "Late",
                        "Leave"
                    ],

                    datasets: [
                        {
                            data: [
                                present,
                                absent,
                                late,
                                leave
                            ],

                            borderWidth: 0
                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    cutout: "68%",

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );

}


/* =========================================================
   ATTENDANCE LINE
========================================================= */

function createAttendanceLine(
    records
) {

    const canvas =
        document.getElementById(
            "attendanceLineChart"
        );


    if (!canvas) return;


    if (
        typeof Chart ===
        "undefined"
    ) return;


    if (attendanceLineChart) {

        attendanceLineChart.destroy();

    }


    const sorted =
        [...records]
            .sort(
                (a, b) =>
                    getRecordDate(a)
                        .localeCompare(
                            getRecordDate(b)
                        )
            )
            .slice(-12);


    const labels =
        sorted.map(
            record =>
                formatShortDate(
                    getRecordDate(record)
                )
        );


    const values =
        sorted.map(
            record => {

                const status =
                    String(
                        record.status ||
                        ""
                    )
                        .toLowerCase();


                if (
                    status === "present" ||
                    status === "p"
                ) return 1;


                if (
                    status === "late" ||
                    status === "l"
                ) return 0.5;


                return 0;

            }
        );


    attendanceLineChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels,

                    datasets: [
                        {
                            label:
                                "Attendance",

                            data:
                                values,

                            tension:
                                0.35,

                            fill:
                                false,

                            pointRadius:
                                4,

                            pointHoverRadius:
                                6

                        }
                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            min: 0,

                            max: 1,

                            ticks: {

                                callback:
                                    value => {

                                        if (
                                            value === 1
                                        ) {
                                            return "Present";
                                        }

                                        if (
                                            value === 0.5
                                        ) {
                                            return "Late";
                                        }

                                        return "Absent";

                                    }

                            }

                        }

                    },

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );

}


/* =========================================================
   ATTENDANCE TABLE
========================================================= */

function renderAttendanceTable(
    records
) {

    const body =
        document.getElementById(
            "attendanceTableBody"
        );


    if (!body) return;


    if (!records.length) {

        body.innerHTML = `
            <tr>
                <td colspan="4">
                    No attendance records found.
                </td>
            </tr>
        `;

        return;

    }


    const sorted =
        [...records]
            .sort(
                (a, b) =>
                    getRecordDate(b)
                        .localeCompare(
                            getRecordDate(a)
                        )
            );


    body.innerHTML =
        sorted
            .map(record => {

                const status =
                    String(
                        record.status ||
                        "Unknown"
                    );


                return `
                    <tr>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    getRecordDate(record)
                                )
                            )}
                        </td>

                        <td>
                            <span class="attendance-status ${statusClass(status)}">
                                ${escapeHtml(status)}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(
                                record.course ||
                                currentStudent?.course ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                record.batch ||
                                currentStudent?.batch ||
                                "—"
                            )}
                        </td>

                    </tr>
                `;

            })
            .join("");

}


/* =========================================================
   FEES
========================================================= */

async function loadFees(student) {

    feeRecords = [];


    const queries = [];


    queries.push(
        query(
            collection(db, "fees"),
            where(
                "studentDocId",
                "==",
                student.id
            )
        )
    );


    if (student.studentId) {

        queries.push(
            query(
                collection(db, "fees"),
                where(
                    "studentId",
                    "==",
                    student.studentId
                )
            )
        );

    }


    for (
        const feeQuery
        of queries
    ) {

        try {

            const snapshot =
                await getDocs(
                    feeQuery
                );


            if (!snapshot.empty) {

                feeRecords =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                break;

            }

        } catch (error) {

            console.warn(
                "Fee query failed:",
                error
            );

        }

    }


    renderFees(
        feeRecords
    );

}


/* =========================================================
   RENDER FEES
========================================================= */

function renderFees(records) {

    const currentMonth =
        getCurrentMonth();


    const currentPayment =
        records.find(
            record =>
                record.month ===
                    currentMonth &&
                record.status ===
                    "paid"
        );


    const monthlyFee =
        Number(
            currentPayment?.amount ||
            currentStudent?.monthlyFee ||
            0
        );


    const paid =
        Boolean(
            currentPayment
        );


    setText(
        "feeStatus",
        paid
            ? "Paid"
            : "Pending"
    );


    setText(
        "overviewFee",
        paid
            ? `₨ ${money(monthlyFee)} paid`
            : monthlyFee
                ? `₨ ${money(monthlyFee)} pending`
                : "Fee pending"
    );


    setText(
        "feeMonthLabel",
        formatMonth(
            currentMonth
        )
    );


    setText(
        "feePageStatus",
        paid
            ? `Your fee of ₨ ${money(monthlyFee)} has been paid.`
            : monthlyFee
                ? `Your monthly fee of ₨ ${money(monthlyFee)} is pending.`
                : "Your fee is pending for this month."
    );


    const badge =
        document.getElementById(
            "feePageBadge"
        );


    if (badge) {

        badge.textContent =
            paid
                ? "✓ Paid"
                : "Pending";


        badge.classList.toggle(
            "paid",
            paid
        );

    }


    renderFeeTable(
        records
    );

}


/* =========================================================
   FEE TABLE
========================================================= */

function renderFeeTable(
    records
) {

    const body =
        document.getElementById(
            "feeTableBody"
        );


    if (!body) return;


    if (!records.length) {

        body.innerHTML = `
            <tr>
                <td colspan="4">
                    No fee payment records found.
                </td>
            </tr>
        `;

        return;

    }


    const sorted =
        [...records]
            .sort(
                (a, b) =>
                    String(
                        b.month || ""
                    )
                        .localeCompare(
                            String(
                                a.month || ""
                            )
                        )
            );


    body.innerHTML =
        sorted
            .map(record => {

                const paid =
                    record.status ===
                    "paid";


                return `
                    <tr>

                        <td>
                            ${escapeHtml(
                                formatMonth(
                                    record.month
                                )
                            )}
                        </td>

                        <td>
                            ₨ ${money(
                                record.amount
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    record.paymentDate
                                )
                            )}
                        </td>

                        <td>

                            <span
                                class="fee-badge ${
                                    paid
                                        ? "paid"
                                        : ""
                                }"
                            >
                                ${
                                    paid
                                        ? "✓ Paid"
                                        : "Pending"
                                }
                            </span>

                        </td>

                    </tr>
                `;

            })
            .join("");

}


/* =========================================================
   RESULTS
========================================================= */

async function loadResults(student) {

    resultRecords = [];


    const queries = [];


    queries.push(
        query(
            collection(db, "results"),
            where(
                "studentDocId",
                "==",
                student.id
            )
        )
    );


    if (student.studentId) {

        queries.push(
            query(
                collection(db, "results"),
                where(
                    "studentId",
                    "==",
                    student.studentId
                )
            )
        );

    }


    for (
        const resultQuery
        of queries
    ) {

        try {

            const snapshot =
                await getDocs(
                    resultQuery
                );


            if (!snapshot.empty) {

                resultRecords =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                break;

            }

        } catch (error) {

            console.warn(
                "Results query failed:",
                error
            );

        }

    }


    renderResults(
        resultRecords
    );

}


/* =========================================================
   RENDER RESULTS
========================================================= */

function renderResults(
    records
) {

    const container =
        document.getElementById(
            "resultsContainer"
        );


    if (!container) return;


    if (!records.length) {

        container.innerHTML = `
            <div class="empty-panel">

                <div>
                    ▣
                </div>

                <h3>
                    No Published Results
                </h3>

                <p>
                    Your results will appear here once they are
                    published by the administration.
                </p>

            </div>
        `;


        setText(
            "overviewResults",
            "No result published yet"
        );

        return;

    }


    setText(
        "overviewResults",
        `${records.length} result record${records.length > 1 ? "s" : ""} available`
    );


    container.innerHTML =
        records
            .map(record => {

                const percentage =
                    Number(
                        record.percentage ||
                        record.percent ||
                        0
                    );


                return `
                    <div class="dashboard-card result-card">

                        <div class="card-heading">

                            <div>

                                <h3>
                                    ${escapeHtml(
                                        record.testName ||
                                        record.examName ||
                                        record.title ||
                                        "Examination Result"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHtml(
                                        record.month ||
                                        record.date ||
                                        ""
                                    )}
                                </p>

                            </div>

                            <strong>
                                ${escapeHtml(
                                    String(
                                        record.grade ||
                                        ""
                                    )
                                )}
                            </strong>

                        </div>

                        <div class="result-details">

                            <div>
                                <span>Marks</span>
                                <strong>
                                    ${escapeHtml(
                                        `${record.marks ?? "—"} / ${record.totalMarks ?? "—"}`
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Percentage</span>
                                <strong>
                                    ${
                                        percentage
                                            ? `${percentage}%`
                                            : "—"
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>Grade</span>
                                <strong>
                                    ${escapeHtml(
                                        record.grade ||
                                        "—"
                                    )}
                                </strong>
                            </div>

                        </div>

                    </div>
                `;

            })
            .join("");

}


/* =========================================================
   ANNOUNCEMENTS
========================================================= */

async function loadAnnouncements() {

    announcementRecords = [];


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "announcements"
                )
            );


        announcementRecords =
            snapshot.docs.map(
                item => ({
                    id: item.id,
                    ...item.data()
                })
            );


    } catch (error) {

        console.warn(
            "Announcements Error:",
            error
        );

        announcementRecords = [];

    }


    renderAnnouncements(
        announcementRecords
    );

}


/* =========================================================
   RENDER ANNOUNCEMENTS
========================================================= */

function renderAnnouncements(
    records
) {

    const container =
        document.getElementById(
            "announcementsContainer"
        );


    if (!container) return;


    if (!records.length) {

        container.innerHTML = `
            <div class="empty-panel">

                <div>
                    ◉
                </div>

                <h3>
                    No Announcements
                </h3>

                <p>
                    New announcements will appear here.
                </p>

            </div>
        `;

        return;

    }


    const sorted =
        [...records]
            .sort(
                (a, b) =>
                    getAnnouncementDate(b)
                        .localeCompare(
                            getAnnouncementDate(a)
                        )
            );


    container.innerHTML =
        sorted
            .map(record => {

                return `
                    <article class="announcement-card">

                        <div class="announcement-icon">
                            📢
                        </div>

                        <div>

                            <h3>
                                ${escapeHtml(
                                    record.title ||
                                    "Announcement"
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(
                                    record.message ||
                                    record.description ||
                                    record.content ||
                                    ""
                                )}
                            </p>

                            <small>
                                ${escapeHtml(
                                    formatDate(
                                        getAnnouncementDate(
                                            record
                                        )
                                    )
                                )}
                            </small>

                        </div>

                    </article>
                `;

            })
            .join("");

}


/* =========================================================
   NAVIGATION
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".nav-item"
            );


        if (!button) return;


        const sectionId =
            button.dataset.section;


        if (!sectionId) return;


        document
            .querySelectorAll(
                ".nav-item"
            )
            .forEach(item => {

                item.classList.toggle(
                    "active",
                    item === button
                );

            });


        document
            .querySelectorAll(
                ".dashboard-section"
            )
            .forEach(section => {

                section.classList.toggle(
                    "active",
                    section.id ===
                    sectionId
                );

            });


        const titles = {

            overview:
                "Dashboard",

            attendance:
                "Attendance",

            fees:
                "Fee Management",

            results:
                "Examination Results",

            announcements:
                "Announcements",

            profile:
                "My Profile"

        };


        setText(
            "pageTitle",
            titles[sectionId] ||
            "Dashboard"
        );

    }
);


/* =========================================================
   LOGOUT
========================================================= */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "#studentLogout"
            );


        if (!button) return;


        try {

            await signOut(auth);

            localStorage.removeItem(
                "studentId"
            );

            window.location.href =
                "./login.html";

        } catch (error) {

            console.error(
                "Logout Error:",
                error
            );

            alert(
                "Unable to logout. Please try again."
            );

        }

    }
);


/* =========================================================
   HELPERS
========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value ?? "—";

    }

}


function getCurrentMonth() {

    const date =
        new Date();


    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0")
    );

}


function formatMonth(
    value
) {

    if (!value) return "—";


    const parts =
        String(value)
            .split("-");


    if (
        parts.length !== 2
    ) {

        return value;

    }


    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            1
        );


    return date.toLocaleDateString(
        "en-US",
        {
            month: "long",
            year: "numeric"
        }
    );

}


function getRecordDate(
    record
) {

    return (
        record.date ||
        record.attendanceDate ||
        record.createdDate ||
        record.paymentDate ||
        ""
    );

}


function getAnnouncementDate(
    record
) {

    return (
        record.date ||
        record.createdAt?.toDate?.()?.toISOString() ||
        record.createdAt ||
        ""
    );

}


function formatDate(
    value
) {

    if (!value) return "—";


    const date =
        new Date(
            `${String(value).substring(0, 10)}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function formatShortDate(
    value
) {

    if (!value) return "—";


    const date =
        new Date(
            `${String(value).substring(0, 10)}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        "en-US",
        {
            day: "2-digit",
            month: "short"
        }
    );

}


function money(
    value
) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-PK"
    );

}


function statusClass(
    status
) {

    const value =
        String(status)
            .toLowerCase();


    if (
        value.includes("present") ||
        value === "p"
    ) {

        return "present";

    }


    if (
        value.includes("absent") ||
        value === "a"
    ) {

        return "absent";

    }


    if (
        value.includes("late") ||
        value === "l"
    ) {

        return "late";

    }


    if (
        value.includes("leave")
    ) {

        return "leave";

    }


    return "";

}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
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


/* =========================================================
   ERROR
========================================================= */

function showDashboardError(
    message
) {

    const main =
        document.querySelector(
            ".student-main"
        );


    if (!main) return;


    const old =
        document.getElementById(
            "studentDashboardError"
        );


    if (old) {

        old.remove();

    }


    const error =
        document.createElement(
            "div"
        );


    error.id =
        "studentDashboardError";


    error.style.cssText = `
        position:fixed;
        inset:20px;
        z-index:9999;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:20px;
        box-shadow:0 20px 60px rgba(0,0,0,.15);
        padding:30px;
        text-align:center;
        font-family:Inter,Arial,sans-serif;
    `;


    error.innerHTML = `
        <div>

            <div style="
                font-size:48px;
                margin-bottom:15px;
            ">
                ⚠️
            </div>

            <h2 style="
                margin:0 0 10px;
                color:#111827;
            ">
                Student Profile Not Found
            </h2>

            <p style="
                margin:0;
                color:#64748b;
                max-width:500px;
                line-height:1.6;
            ">
                ${escapeHtml(message)}
            </p>

        </div>
    `;


    document.body.appendChild(
        error
    );

}
