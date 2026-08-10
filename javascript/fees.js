
/* =========================================================
   FEE MANAGEMENT
   Sir Syed Hassan Ali Coaching Management System
========================================================= */

import { auth, db } from "../firebase/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   ELEMENTS
========================================================= */

const $ = id => document.getElementById(id);

const feeMonth = $("feeMonth");
const feeStudentSearch = $("feeStudentSearch");
const feeStatusFilter = $("feeStatusFilter");
const feesTableBody = $("feesTableBody");

const feeTotalStudents = $("feeTotalStudents");
const feePaidStudents = $("feePaidStudents");
const feePendingStudents = $("feePendingStudents");
const feeCollectedAmount = $("feeCollectedAmount");

const feeModal = $("feeModal");
const feeModalStudentName = $("feeModalStudentName");
const feeModalStudentInfo = $("feeModalStudentInfo");
const feeAmount = $("feeAmount");
const feePaymentDate = $("feePaymentDate");
const feeCancelBtn = $("feeCancelBtn");
const feeSaveBtn = $("feeSaveBtn");


/* =========================================================
   DATA
========================================================= */

let students = [];
let fees = [];
let selectedStudent = null;


/* =========================================================
   DEFAULT MONTH
========================================================= */

function currentMonth() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    return `${year}-${month}`;
}


function todayDate() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


if (feeMonth) {

    feeMonth.value = currentMonth();

}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, user => {

    if (!user) {

        return;

    }

    loadFeeStudents();

    loadFees();

});


/* =========================================================
   LOAD STUDENTS
========================================================= */

function loadFeeStudents() {

    onSnapshot(
        collection(db, "students"),

        snapshot => {

            students = snapshot.docs.map(item => ({

                id: item.id,

                ...item.data()

            }));

            renderFees();

        },

        error => {

            console.error(
                "Fee students error:",
                error
            );

            showError(
                "Unable to load students."
            );

        }
    );

}


/* =========================================================
   LOAD FEE RECORDS
========================================================= */

function loadFees() {

    onSnapshot(
        collection(db, "fees"),

        snapshot => {

            fees = snapshot.docs.map(item => ({

                id: item.id,

                ...item.data()

            }));

            renderFees();

        },

        error => {

            console.error(
                "Fee records error:",
                error
            );

            showError(
                "Unable to load fee records."
            );

        }
    );

}


/* =========================================================
   RENDER FEES
========================================================= */

function renderFees() {

    if (!feesTableBody) return;

    const selectedMonth =
        feeMonth?.value || currentMonth();

    let data = students.map(student => {

        const payment = fees.find(record =>

            record.studentDocId === student.id &&

            record.month === selectedMonth

        );

        const allStudentPayments = fees

            .filter(record =>
                record.studentDocId === student.id
            )

            .sort((a, b) =>
                String(b.month || "")
                    .localeCompare(
                        String(a.month || "")
                    )
            );

        const lastPayment =
            allStudentPayments[0] || null;

        return {

            student,

            payment,

            lastPayment,

            paid: Boolean(payment)

        };

    });


    /* SEARCH */

    const search =
        feeStudentSearch?.value
            .toLowerCase()
            .trim() || "";


    if (search) {

        data = data.filter(item => {

            const student = item.student;

            return [

                student.name,

                student.studentId,

                student.phone,

                student.course,

                student.batch,

                student.fatherName

            ]

                .some(value =>
                    String(value || "")
                        .toLowerCase()
                        .includes(search)
                );

        });

    }


    /* STATUS FILTER */

    const status =
        feeStatusFilter?.value || "all";


    if (status === "paid") {

        data = data.filter(
            item => item.paid
        );

    }


    if (status === "unpaid") {

        data = data.filter(
            item => !item.paid
        );

    }


    /* SUMMARY */

    updateSummary(
        selectedMonth
    );


    /* EMPTY */

    if (!data.length) {

        feesTableBody.innerHTML = `

            <tr>

                <td
                    colspan="9"
                    class="empty">

                    No students found.

                </td>

            </tr>

        `;

        return;

    }


    /* TABLE */

    feesTableBody.innerHTML =
        data.map(item => {

            const student =
                item.student;

            const payment =
                item.payment;

            const lastPayment =
                item.lastPayment;


            const amount =
                payment?.amount
                    ? `₨ ${Number(
                        payment.amount
                    ).toLocaleString()}`
                    : "—";


            const lastMonth =
                lastPayment?.month
                    ? formatMonth(
                        lastPayment.month
                    )
                    : "Never";


            const paymentDate =
                payment?.paymentDate
                    ? formatDate(
                        payment.paymentDate
                    )
                    : "—";


            return `

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
                            student.course || "-"
                        )}

                    </td>


                    <td>

                        ${escapeHTML(
                            student.batch || "-"
                        )}

                    </td>


                    <td>

                        ${amount}

                    </td>


                    <td>

                        ${
                            payment

                            ?

                            `<span
                                class="fee-status paid">
                                ✓ Paid
                            </span>`

                            :

                            `<span
                                class="fee-status unpaid">
                                Unpaid
                            </span>`
                        }

                    </td>


                    <td>

                        ${lastMonth}

                    </td>


                    <td>

                        ${paymentDate}

                    </td>


                    <td>

                        ${
                            payment

                            ?

                            `<button
                                class="mark-fee-btn paid-btn"
                                disabled>
                                ✓ Paid
                            </button>`

                            :

                            `<button
                                class="mark-fee-btn"
                                data-student-id="${student.id}">
                                💰 Mark Paid
                            </button>`
                        }

                    </td>

                </tr>

            `;

        }).join("");


    attachFeeButtons();

}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary(month) {

    const total =
        students.length;


    const paidRecords =
        students.map(student =>

            fees.find(record =>

                record.studentDocId ===
                student.id &&

                record.month === month

            )

        ).filter(Boolean);


    const paid =
        paidRecords.length;


    const pending =
        Math.max(
            total - paid,
            0
        );


    const collected =
        paidRecords.reduce(
            (sum, record) =>
                sum +
                Number(
                    record.amount || 0
                ),
            0
        );


    if (feeTotalStudents) {

        feeTotalStudents.textContent =
            total;

    }


    if (feePaidStudents) {

        feePaidStudents.textContent =
            paid;

    }


    if (feePendingStudents) {

        feePendingStudents.textContent =
            pending;

    }


    if (feeCollectedAmount) {

        feeCollectedAmount.textContent =
            `₨ ${collected.toLocaleString()}`;

    }

}


/* =========================================================
   FEE BUTTONS
========================================================= */

function attachFeeButtons() {

    document
        .querySelectorAll(".mark-fee-btn:not(.paid-btn)")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openFeeModal(
                        button.dataset.studentId
                    );

                }
            );

        });

}


/* =========================================================
   OPEN MODAL
========================================================= */

function openFeeModal(studentId) {

    selectedStudent =
        students.find(
            student =>
                student.id === studentId
        );


    if (!selectedStudent) {

        alert(
            "Student not found."
        );

        return;

    }


    const selectedMonth =
        feeMonth?.value ||
        currentMonth();


    if (feeModalStudentName) {

        feeModalStudentName.textContent =
            selectedStudent.name ||
            "Student";

    }


    if (feeModalStudentInfo) {

        feeModalStudentInfo.textContent =

            `${selectedStudent.studentId || "-"} • ` +

            `${selectedStudent.course || "-"} • ` +

            `${selectedStudent.batch || "-"}`;

    }


    if (feeAmount) {

        feeAmount.value =
            selectedStudent.monthlyFee ||
            "";

    }


    if (feePaymentDate) {

        feePaymentDate.value =
            todayDate();

    }


    if (feeModal) {

        feeModal.classList.add("show");

    }

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeFeeModal() {

    selectedStudent = null;

    feeModal?.classList.remove(
        "show"
    );

}


feeCancelBtn?.addEventListener(
    "click",
    closeFeeModal
);


feeModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            feeModal
        ) {

            closeFeeModal();

        }

    }
);


/* =========================================================
   SAVE PAYMENT
========================================================= */

feeSaveBtn?.addEventListener(
    "click",
    async () => {

        if (!selectedStudent) {

            return;

        }


        const amount =
            Number(
                feeAmount?.value || 0
            );


        const paymentDate =
            feePaymentDate?.value ||
            todayDate();


        const month =
            feeMonth?.value ||
            currentMonth();


        if (amount <= 0) {

            alert(
                "Please enter a valid fee amount."
            );

            return;

        }


        /* Prevent duplicate */

        const existing =
            fees.find(record =>

                record.studentDocId ===
                selectedStudent.id &&

                record.month ===
                month

            );


        if (existing) {

            alert(
                "This month's fee is already marked as paid."
            );

            closeFeeModal();

            return;

        }


        feeSaveBtn.disabled =
            true;

        feeSaveBtn.textContent =
            "Saving...";


        try {

            await addDoc(
                collection(
                    db,
                    "fees"
                ),
                {

                    studentDocId:
                        selectedStudent.id,

                    studentId:
                        selectedStudent.studentId ||
                        "",

                    studentName:
                        selectedStudent.name ||
                        "",

                    fatherName:
                        selectedStudent.fatherName ||
                        "",

                    phone:
                        selectedStudent.phone ||
                        "",

                    course:
                        selectedStudent.course ||
                        "",

                    batch:
                        selectedStudent.batch ||
                        "",

                    month:

                        month,

                    amount:

                        amount,

                    paymentDate:

                        paymentDate,

                    status:

                        "Paid",

                    paidAt:

                        serverTimestamp()

                }

            );


            alert(
                `${selectedStudent.name}'s fee for ${formatMonth(month)} has been marked as PAID.`
            );


            closeFeeModal();


        } catch (error) {

            console.error(
                "Fee save error:",
                error
            );

            alert(
                "Fee could not be saved: " +
                error.message
            );

        } finally {

            feeSaveBtn.disabled =
                false;

            feeSaveBtn.textContent =
                "✓ Mark as Paid";

        }

    }
);


/* =========================================================
   FILTER EVENTS
========================================================= */

feeMonth?.addEventListener(
    "change",
    renderFees
);


feeStudentSearch?.addEventListener(
    "input",
    renderFees
);


feeStatusFilter?.addEventListener(
    "change",
    renderFees
);


/* =========================================================
   FORMAT MONTH
========================================================= */

function formatMonth(value) {

    if (!value) return "-";


    const parts =
        value.split("-");


    if (parts.length !== 2) {

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


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value) {

    if (!value) return "—";


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

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
   HTML ESCAPE
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


/* =========================================================
   ERROR
========================================================= */

function showError(message) {

    if (!feesTableBody) return;


    feesTableBody.innerHTML = `

        <tr>

            <td
                colspan="9"
                class="empty">

                ${escapeHTML(message)}

            </td>

        </tr>

    `;

}


console.log(
    "✅ Fee Management loaded successfully"
);
