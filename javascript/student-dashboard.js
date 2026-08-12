/* =========================================================
   STUDENT DASHBOARD
   Firebase + Firestore
========================================================= */

import { db, auth } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* =========================================================
   STATE
========================================================= */

let currentStudent = null;

let attendanceRecords = [];
let feeRecords = [];
let resultRecords = [];
let announcementRecords = [];

let pieChart = null;
let lineChart = null;


/* =========================================================
   ELEMENT HELPER
========================================================= */

const $ = id =>
    document.getElementById(id);


/* =========================================================
   CURRENT MONTH
========================================================= */

function currentMonth() {

    const date = new Date();

    return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0")
    );
}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(value) {

    if (!value) return "—";

    let date;

    if (
        typeof value.toDate === "function"
    ) {
        date = value.toDate();
    }

    else if (
        value.seconds
    ) {
        date =
            new Date(
                value.seconds * 1000
            );
    }

    else {
        date =
            new Date(
                `${value}T00:00:00`
            );
    }

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


/* =========================================================
   MONTH FORMAT
========================================================= */

function formatMonth(value) {

    if (!value) return "—";

    const parts =
        String(value).split("-");

    if (parts.length !== 2) {
        return value;
    }

    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        1
    ).toLocaleDateString(
        "en-US",
        {
            month: "long",
            year: "numeric"
        }
    );
}


/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            window.location.href =
                "student-login.html";

            return;
        }

        loadStudent(user);
    }
);


/* =========================================================
   LOAD STUDENT
========================================================= */

function loadStudent(user) {

    const studentsRef =
        collection(
            db,
            "students"
        );


    /*
       The student login should authenticate
       the Firebase user and the student's
       document should contain the user's uid.

       We first try uid.
    */

    const studentQuery =
        query(
            studentsRef,
            where(
                "uid",
                "==",
                user.uid
            )
        );


    onSnapshot(
        studentQuery,

        snapshot => {

            if (!snapshot.empty) {

                currentStudent = {
                    id:
                        snapshot.docs[0].id,

                    ...snapshot.docs[0].data()
                };

                initializeDashboard();

                return;
            }


            /*
               Fallback:
               If the current student document
               does not yet have uid, try email.
            */

            if (user.email) {

                const emailQuery =
                    query(
                        studentsRef,
                        where(
                            "email",
                            "==",
                            user.email
                        )
                    );


                onSnapshot(
                    emailQuery,

                    emailSnapshot => {

                        if (
                            !emailSnapshot.empty
                        ) {

                            currentStudent = {
                                id:
                                    emailSnapshot.docs[0].id,

                                ...emailSnapshot.docs[0].data()
                            };

                            initializeDashboard();

                        }

                        else {

                            showError(
                                "Student profile was not found."
                            );

                        }

                    },

                    error => {

                        console.error(
                            "Student email query error:",
                            error
                        );

                        showError(
                            "Unable to load student profile."
                        );

                    }
                );

            }

            else {

                showError(
                    "Student profile was not found."
                );

            }

        },

        error => {

            console.error(
                "Student query error:",
                error
            );

            showError(
                "Unable to load your student profile."
            );

        }
    );
}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeDashboard() {

    renderStudentProfile();

    loadAttendance();

    loadFees();

    loadResults();

    loadAnnouncements();

    setupNavigation();

}


/* =========================================================
   PROFILE
========================================================= */

function renderStudentProfile() {

    const student =
        currentStudent;

    if (!student) return;


    const name =
        student.name ||
        "Student";

    const studentId =
        student.studentId ||
        "—";


    if ($("welcomeName")) {
        $("welcomeName").textContent =
            name;
    }

    if ($("welcomeStudentId")) {
        $("welcomeStudentId").textContent =
            studentId;
    }

    if ($("topStudentName")) {
        $("topStudentName").textContent =
            name;
    }

    if ($("topStudentId")) {
        $("topStudentId").textContent =
            studentId;
    }

    if ($("profileAvatar")) {
        $("profileAvatar").textContent =
            name
                .charAt(0)
                .toUpperCase();
    }


    if ($("profileName")) {
        $("profileName").textContent =
            name;
    }

    if ($("profileStudentId")) {
        $("profileStudentId").textContent =
            studentId;
    }

    if ($("profileFatherName")) {
        $("profileFatherName").textContent =
            student.fatherName || "—";
    }

    if ($("profileCourse")) {
        $("profileCourse").textContent =
            student.course || "—";
    }

    if ($("profileBatch")) {
        $("profileBatch").textContent =
            student.batch || "—";
    }

    if ($("profilePhone")) {
        $("profilePhone").textContent =
            student.phone || "—";
    }

}


/* =========================================================
   ATTENDANCE
========================================================= */

function loadAttendance() {

    if (!currentStudent) return;


    const attendanceRef =
        collection(
            db,
            "attendance"
        );


    /*
       Existing admin attendance records
       use studentDocId and studentId.
    */

    const studentQuery =
        query(
            attendanceRef,
            where(
                "studentDocId",
                "==",
                currentStudent.id
            )
        );


    onSnapshot(
        studentQuery,

        snapshot => {

            attendanceRecords =
                snapshot.docs
                    .map(
                        doc => ({
                            id: doc.id,
                            ...doc.data()
                        })
                    );


            /*
               If no records by document ID,
               the dashboard will still remain usable.
            */

            renderAttendance();

        },

        error => {

            console.error(
                "Attendance error:",
                error
            );

            renderAttendance();

        }
    );
}


/* =========================================================
   ATTENDANCE ANALYTICS
========================================================= */

function calculateAttendance() {

    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;


    attendanceRecords.forEach(
        record => {

            const status =
                String(
                    record.status || ""
                ).toLowerCase();


            if (
                status === "present"
            ) {
                present++;
            }

            else if (
                status === "absent"
            ) {
                absent++;
            }

            else if (
                status === "late"
            ) {
                late++;
            }

            else if (
                status === "leave"
            ) {
                leave++;
            }

        }
    );


    /*
       Older admin scanner records are saved
       with status = Present.
    */

    const total =
        present +
        absent +
        late +
        leave;


    const attendancePercent =
        total
            ? Math.round(
                (
                    present +
                    late
                ) /
                total *
                100
            )
            : 0;


    return {
        present,
        absent,
        late,
        leave,
        total,
        attendancePercent
    };
}


/* =========================================================
   RENDER ATTENDANCE
========================================================= */

function renderAttendance() {

    const stats =
        calculateAttendance();


    /* DASHBOARD */

    if ($("attendancePercent")) {
        $("attendancePercent").textContent =
            `${stats.attendancePercent}%`;
    }

    if ($("presentDays")) {
        $("presentDays").textContent =
            stats.present;
    }

    if ($("absentDays")) {
        $("absentDays").textContent =
            stats.absent;
    }


    /* PAGE */

    if ($("attendancePagePercent")) {
        $("attendancePagePercent").textContent =
            `${stats.attendancePercent}%`;
    }

    if ($("attendancePagePresent")) {
        $("attendancePagePresent").textContent =
            stats.present;
    }

    if ($("attendancePageAbsent")) {
        $("attendancePageAbsent").textContent =
            stats.absent;
    }

    if ($("attendancePageLate")) {
        $("attendancePageLate").textContent =
            stats.late;
    }

    if ($("attendancePageLeave")) {
        $("attendancePageLeave").textContent =
            stats.leave;
    }


    /* STATUS */

    if ($("attendanceStatus")) {

        if (
            stats.attendancePercent >= 80
        ) {
            $("attendanceStatus").textContent =
                "Excellent";
        }

        else if (
            stats.attendancePercent >= 60
        ) {
            $("attendanceStatus").textContent =
                "Good";
        }

        else {
            $("attendanceStatus").textContent =
                "Needs Attention";
        }

    }


    /* LEGEND */

    if ($("legendPresent")) {
        $("legendPresent").textContent =
            stats.present;
    }

    if ($("legendAbsent")) {
        $("legendAbsent").textContent =
            stats.absent;
    }

    if ($("legendLate")) {
        $("legendLate").textContent =
            stats.late;
    }

    if ($("legendLeave")) {
        $("legendLeave").textContent =
            stats.leave;
    }


    renderAttendanceTable();

    renderCharts();

    updateAttendanceOverview(
        stats
    );
}


/* =========================================================
   ATTENDANCE TABLE
========================================================= */

function renderAttendanceTable() {

    const body =
        $("attendanceTableBody");

    if (!body) return;


    const records =
        [...attendanceRecords]
            .sort(
                (a, b) =>
                    String(
                        b.date || ""
                    ).localeCompare(
                        String(
                            a.date || ""
                        )
                    )
            );


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


    body.innerHTML =
        records
            .map(
                record => {

                    const status =
                        String(
                            record.status ||
                            "Present"
                        );

                    const statusClass =
                        status
                            .toLowerCase();


                    return `
                        <tr>

                            <td>
                                ${escapeHTML(
                                    formatDate(
                                        record.date
                                    )
                                )}
                            </td>

                            <td>
                                <span
                                    class="status-badge status-${statusClass}"
                                >
                                    ${escapeHTML(
                                        status
                                    )}
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(
                                    record.course ||
                                    currentStudent.course ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    record.batch ||
                                    currentStudent.batch ||
                                    "—"
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   CHARTS
========================================================= */

function renderCharts() {

    if (
        typeof Chart ===
        "undefined"
    ) {
        console.warn(
            "Chart.js not loaded."
        );

        return;
    }


    const stats =
        calculateAttendance();


    const pieCanvas =
        $("attendancePieChart");


    if (pieCanvas) {

        if (pieChart) {
            pieChart.destroy();
        }


        pieChart =
            new Chart(
                pieCanvas,
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
                                    stats.present,
                                    stats.absent,
                                    stats.late,
                                    stats.leave
                                ],

                                backgroundColor: [
                                    "#10b981",
                                    "#ef4444",
                                    "#f59e0b",
                                    "#6366f1"
                                ],

                                borderWidth: 0
                            }
                        ]
                    },

                    options: {
                        responsive: true,

                        maintainAspectRatio:
                            false,

                        cutout: "70%",

                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                }
            );

    }


    const lineCanvas =
        $("attendanceLineChart");


    if (lineCanvas) {

        if (lineChart) {
            lineChart.destroy();
        }


        const sorted =
            [...attendanceRecords]
                .sort(
                    (a, b) =>
                        String(
                            a.date || ""
                        ).localeCompare(
                            String(
                                b.date || ""
                            )
                        )
                )
                .slice(-10);


        const labels =
            sorted.map(
                record =>
                    String(
                        record.date ||
                        ""
                    ).slice(5)
            );


        let runningPresent = 0;

        const values =
            sorted.map(
                record => {

                    const status =
                        String(
                            record.status ||
                            "Present"
                        ).toLowerCase();

                    if (
                        status === "present" ||
                        status === "late"
                    ) {
                        runningPresent++;
                    }

                    return runningPresent;
                }
            );


        lineChart =
            new Chart(
                lineCanvas,
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

                                borderColor:
                                    "#2563eb",

                                backgroundColor:
                                    "rgba(37,99,235,.08)",

                                fill: true,

                                tension: .35,

                                pointRadius: 3,

                                pointBackgroundColor:
                                    "#2563eb"
                            }
                        ]
                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        plugins: {
                            legend: {
                                display: false
                            }
                        },

                        scales: {

                            y: {
                                beginAtZero:
                                    true,

                                ticks: {
                                    precision: 0
                                }
                            }

                        }
                    }
                }
            );

    }

}


/* =========================================================
   ATTENDANCE OVERVIEW
========================================================= */

function updateAttendanceOverview(
    stats
) {

    if ($("overviewAttendance")) {

        $("overviewAttendance").textContent =
            `${stats.attendancePercent}% attendance`;

    }

}


/* =========================================================
   FEES
========================================================= */

function loadFees() {

    if (!currentStudent) return;


    const feesRef =
        collection(
            db,
            "fees"
        );


    const feeQuery =
        query(
            feesRef,
            where(
                "studentDocId",
                "==",
                currentStudent.id
            )
        );


    onSnapshot(
        feeQuery,

        snapshot => {

            feeRecords =
                snapshot.docs.map(
                    doc => ({
                        id: doc.id,
                        ...doc.data()
                    })
                );


            renderFees();

        },

        error => {

            console.error(
                "Fees error:",
                error
            );

            renderFees();

        }
    );
}


/* =========================================================
   RENDER FEES
========================================================= */

function renderFees() {

    const month =
        currentMonth();


    const currentPayment =
        feeRecords.find(
            record =>
                record.month ===
                    month &&
                record.status ===
                    "paid"
        );


    const monthLabel =
        formatMonth(month);


    if ($("feeMonthLabel")) {
        $("feeMonthLabel").textContent =
            monthLabel;
    }


    if ($("feePageMonth")) {
        $("feePageMonth").textContent =
            monthLabel;
    }


    const paid =
        Boolean(
            currentPayment
        );


    if ($("feeStatus")) {

        $("feeStatus").textContent =
            paid
                ? "Paid"
                : "Pending";

    }


    if ($("feePageStatus")) {

        $("feePageStatus").textContent =
            paid
                ? "Your fee has been paid for this month."
                : "Your fee is pending for this month.";

    }


    if ($("feePageBadge")) {

        $("feePageBadge").textContent =
            paid
                ? "Paid"
                : "Pending";

        $("feePageBadge")
            .classList.toggle(
                "paid",
                paid
            );

    }


    if ($("overviewFee")) {

        $("overviewFee").textContent =
            paid
                ? "Fee paid for this month"
                : "Fee pending for this month";

    }


    renderFeeTable();
}


/* =========================================================
   FEE TABLE
========================================================= */

function renderFeeTable() {

    const body =
        $("feeTableBody");

    if (!body) return;


    const records =
        [...feeRecords]
            .sort(
                (a, b) =>
                    String(
                        b.month || ""
                    ).localeCompare(
                        String(
                            a.month || ""
                        )
                    )
            );


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


    body.innerHTML =
        records
            .map(
                record => `
                    <tr>

                        <td>
                            ${escapeHTML(
                                formatMonth(
                                    record.month
                                )
                            )}
                        </td>

                        <td>
                            ₨ ${Number(
                                record.amount || 0
                            ).toLocaleString(
                                "en-PK"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                formatDate(
                                    record.paymentDate
                                )
                            )}
                        </td>

                        <td>

                            <span
                                class="status-badge status-present"
                            >
                                Paid
                            </span>

                        </td>

                    </tr>
                `
            )
            .join("");
}


/* =========================================================
   RESULTS
========================================================= */

function loadResults() {

    if (!currentStudent) return;


    const resultsRef =
        collection(
            db,
            "results"
        );


    const resultQuery =
        query(
            resultsRef,
            where(
                "studentDocId",
                "==",
                currentStudent.id
            )
        );


    onSnapshot(
        resultQuery,

        snapshot => {

            resultRecords =
                snapshot.docs.map(
                    doc => ({
                        id: doc.id,
                        ...doc.data()
                    })
                );


            renderResults();

        },

        error => {

            console.error(
                "Results error:",
                error
            );

            renderResults();

        }
    );
}


/* =========================================================
   RESULTS UI
========================================================= */

function renderResults() {

    const container =
        $("resultsContainer");

    if (!container) return;


    const published =
        resultRecords.filter(
            result =>
                result.published === true ||
                result.status === "published"
        );


    if (!published.length) {

        container.innerHTML = `
            <div class="empty-panel">

                <div>▣</div>

                <h3>
                    No Published Results
                </h3>

                <p>
                    Your results will appear here once they are published by the administration.
                </p>

            </div>
        `;

        if ($("overviewResults")) {
            $("overviewResults").textContent =
                "No result published yet";
        }

        return;
    }


    if ($("overviewResults")) {

        $("overviewResults").textContent =
            `${published.length} result(s) published`;

    }


    container.innerHTML =
        published
            .map(
                result => `

                    <div
                        class="dashboard-card"
                        style="margin-bottom:16px;"
                    >

                        <div class="card-heading">

                            <div>
                                <h3>
                                    ${escapeHTML(
                                        result.title ||
                                        result.examType ||
                                        "Examination Result"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        result.date ||
                                        result.month ||
                                        ""
                                    )}
                                </p>
                            </div>

                            <span class="status-pill">
                                Published
                            </span>

                        </div>

                        <div class="profile-details">

                            <div>
                                <span>Marks</span>
                                <strong>
                                    ${escapeHTML(
                                        result.marks ??
                                        "—"
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Percentage</span>
                                <strong>
                                    ${escapeHTML(
                                        result.percentage
                                            ? `${result.percentage}%`
                                            : "—"
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Grade</span>
                                <strong>
                                    ${escapeHTML(
                                        result.grade ||
                                        "—"
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Position</span>
                                <strong>
                                    ${escapeHTML(
                                        result.position ||
                                        "—"
                                    )}
                                </strong>
                            </div>

                        </div>

                    </div>

                `
            )
            .join("");
}


/* =========================================================
   ANNOUNCEMENTS
========================================================= */

function loadAnnouncements() {

    const announcementsRef =
        collection(
            db,
            "announcements"
        );


    onSnapshot(
        announcementsRef,

        snapshot => {

            announcementRecords =
                snapshot.docs
                    .map(
                        doc => ({
                            id: doc.id,
                            ...doc.data()
                        })
                    );


            renderAnnouncements();

        },

        error => {

            console.error(
                "Announcements error:",
                error
            );

            renderAnnouncements();

        }
    );
}


/* =========================================================
   ANNOUNCEMENTS UI
========================================================= */

function renderAnnouncements() {

    const container =
        $("announcementsContainer");

    if (!container) return;


    if (
        !announcementRecords.length
    ) {

        container.innerHTML = `
            <div class="empty-panel">

                <div>◉</div>

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


    const records =
        [...announcementRecords]
            .sort(
                (a, b) =>
                    Boolean(
                        b.pinned
                    ) -
                    Boolean(
                        a.pinned
                    )
            );


    container.innerHTML =
        records
            .map(
                announcement => `

                    <div
                        class="dashboard-card"
                        style="margin-bottom:14px;"
                    >

                        <div class="card-heading">

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        announcement.title ||
                                        "Announcement"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        announcement.date ||
                                        ""
                                    )}
                                </p>

                            </div>

                            ${
                                announcement.pinned
                                    ? `
                                        <span class="status-pill">
                                            Pinned
                                        </span>
                                    `
                                    : ""
                            }

                        </div>

                        <p
                            style="
                                margin:0;
                                color:#64748b;
                                font-size:12px;
                                line-height:1.7;
                            "
                        >
                            ${escapeHTML(
                                announcement.message ||
                                announcement.description ||
                                announcement.content ||
                                ""
                            )}
                        </p>

                    </div>

                `
            )
            .join("");
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    const sections =
        document.querySelectorAll(
            ".dashboard-section"
        );


    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const target =
                        item.dataset.section;


                    navItems.forEach(
                        nav =>
                            nav.classList.remove(
                                "active"
                            )
                    );


                    sections.forEach(
                        section =>
                            section.classList.remove(
                                "active"
                            )
                    );


                    item.classList.add(
                        "active"
                    );


                    const section =
                        $(target);


                    if (section) {
                        section.classList.add(
                            "active"
                        );
                    }


                    if ($("pageTitle")) {

                        $("pageTitle")
                            .textContent =
                                item.textContent
                                    .trim();

                    }

                }
            );

        }
    );


    const logout =
        $("studentLogout");


    if (logout) {

        logout.addEventListener(
            "click",
            async () => {

                try {

                    await signOut(
                        auth
                    );

                    window.location.href =
                        "student-login.html";

                }

                catch (error) {

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

}


/* =========================================================
   SECURITY / ERROR
========================================================= */

function showError(message) {

    const main =
        document.querySelector(
            ".student-main"
        );

    if (!main) return;


    const existing =
        document.querySelector(
            ".dashboard-error"
        );


    if (existing) {
        existing.remove();
    }


    const error =
        document.createElement(
            "div"
        );


    error.className =
        "dashboard-error";


    error.style.cssText = `
        padding:18px;
        margin-bottom:20px;
        border-radius:12px;
        background:#fef2f2;
        border:1px solid #fecaca;
        color:#991b1b;
        font-size:13px;
    `;


    error.textContent =
        message;


    main.prepend(
        error
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

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


console.log(
    "✅ Student Dashboard loaded successfully."
);
