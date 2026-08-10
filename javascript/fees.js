import { auth, db } from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* =====================================================
   ELEMENTS
===================================================== */

const addFeeBtn =
    document.getElementById("addFeeBtn");

const feeModal =
    document.getElementById("feeModal");

const closeFeeModal =
    document.getElementById("closeFeeModal");

const cancelFeeBtn =
    document.getElementById("cancelFeeBtn");

const feeForm =
    document.getElementById("feeForm");

const feeStudent =
    document.getElementById("feeStudent");

const feeMonth =
    document.getElementById("feeMonth");

const feeAmount =
    document.getElementById("feeAmount");

const paymentMethod =
    document.getElementById("paymentMethod");

const paymentDate =
    document.getElementById("paymentDate");

const feeNotes =
    document.getElementById("feeNotes");

const feeFormMessage =
    document.getElementById("feeFormMessage");

const verifyFeeBtn =
    document.getElementById("verifyFeeBtn");

const feeTableBody =
    document.getElementById("feeTableBody");

const feeSearch =
    document.getElementById("feeSearch");

const feeStatusFilter =
    document.getElementById("feeStatusFilter");

const feeMonthFilter =
    document.getElementById("feeMonthFilter");


/* SUMMARY */

const feeTotalStudents =
    document.getElementById("feeTotalStudents");

const feePaidCount =
    document.getElementById("feePaidCount");

const feePendingCount =
    document.getElementById("feePendingCount");

const feeCollectedAmount =
    document.getElementById("feeCollectedAmount");


/* RECEIPT */

const receiptModal =
    document.getElementById("receiptModal");

const closeReceiptModal =
    document.getElementById("closeReceiptModal");

const closeReceiptBtn =
    document.getElementById("closeReceiptBtn");

const receiptContent =
    document.getElementById("receiptContent");

const downloadReceiptBtn =
    document.getElementById("downloadReceiptBtn");


/* =====================================================
   DATA
===================================================== */

let students = [];

let feeRecords = [];

let unsubscribeStudents = null;

let unsubscribeFees = null;

let selectedReceipt = null;


/* =====================================================
   DATE HELPERS
===================================================== */

function getCurrentMonth() {

    const now = new Date();

    return (
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0")
    );

}


function getTodayDate() {

    const now = new Date();

    return (
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0")
    );

}


function formatMonth(month) {

    if (!month) return "-";

    const [year, monthNumber] =
        month.split("-");

    const date =
        new Date(
            Number(year),
            Number(monthNumber) - 1,
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


function formatDate(date) {

    if (!date) return "-";

    const parts =
        date.split("-");

    if (parts.length !== 3) {
        return date;
    }

    const d =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

    return d.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =====================================================
   AUTH
===================================================== */

onAuthStateChanged(auth, user => {

    if (!user) {

        window.location.href =
            "admin-login.html";

        return;

    }

    loadStudents();

    loadFees();

});


/* =====================================================
   LOAD STUDENTS
===================================================== */

function loadStudents() {

    if (unsubscribeStudents) {
        unsubscribeStudents();
    }


    const studentsQuery =
        query(
            collection(db, "students"),
            orderBy("createdAt", "desc")
        );


    unsubscribeStudents =
        onSnapshot(
            studentsQuery,
            snapshot => {

                students = [];

                snapshot.forEach(
                    studentDoc => {

                        students.push({

                            id: studentDoc.id,

                            ...studentDoc.data()

                        });

                    }
                );


                feeTotalStudents.textContent =
                    students.length;


                populateStudentSelect();

                renderFees();

            },

            error => {

                console.error(
                    "Students load error:",
                    error
                );

            }
        );

}


/* =====================================================
   LOAD FEES
===================================================== */

function loadFees() {

    if (unsubscribeFees) {
        unsubscribeFees();
    }


    const feesQuery =
        query(
            collection(db, "fees"),
            orderBy("createdAt", "desc")
        );


    unsubscribeFees =
        onSnapshot(
            feesQuery,
            snapshot => {

                feeRecords = [];

                snapshot.forEach(
                    feeDoc => {

                        feeRecords.push({

                            id: feeDoc.id,

                            ...feeDoc.data()

                        });

                    }
                );


                renderFees();

            },

            error => {

                console.error(
                    "Fees load error:",
                    error
                );

                feeTableBody.innerHTML = `

                    <tr>

                        <td
                            colspan="8"
                            class="empty">

                            Unable to load fee records.

                        </td>

                    </tr>

                `;

            }
        );

}


/* =====================================================
   STUDENT SELECT
===================================================== */

function populateStudentSelect() {

    if (!feeStudent) return;


    const currentValue =
        feeStudent.value;


    feeStudent.innerHTML = `

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
            `${student.studentId || "N/A"} - ${student.name || "Unnamed Student"}`;


        feeStudent.appendChild(option);

    });


    if (currentValue) {

        feeStudent.value =
            currentValue;

    }

}


/* =====================================================
   OPEN FEE MODAL
===================================================== */

if (addFeeBtn) {

    addFeeBtn.addEventListener(
        "click",
        openFeeModal
    );

}


function openFeeModal() {

    feeForm.reset();

    feeFormMessage.textContent = "";

    feeFormMessage.className =
        "form-message";


    feeMonth.value =
        getCurrentMonth();


    paymentDate.value =
        getTodayDate();


    feeModal.classList.add("show");

}


/* =====================================================
   CLOSE FEE MODAL
===================================================== */

if (closeFeeModal) {

    closeFeeModal.addEventListener(
        "click",
        closeFee
    );

}


if (cancelFeeBtn) {

    cancelFeeBtn.addEventListener(
        "click",
        closeFee
    );

}


function closeFee() {

    feeModal.classList.remove("show");

    feeForm.reset();

    feeFormMessage.textContent = "";

}


/* =====================================================
   VERIFY FEE
===================================================== */

if (feeForm) {

    feeForm.addEventListener(
        "submit",
        verifyFee
    );

}


async function verifyFee(event) {

    event.preventDefault();


    const studentDocId =
        feeStudent.value;


    const month =
        feeMonth.value;


    const amount =
        Number(feeAmount.value);


    const method =
        paymentMethod.value;


    const paidDate =
        paymentDate.value;


    const notes =
        feeNotes.value.trim();


    /* VALIDATION */

    if (!studentDocId) {

        showFeeMessage(
            "Please select a student.",
            "warning"
        );

        return;

    }


    if (!month) {

        showFeeMessage(
            "Please select fee month.",
            "warning"
        );

        return;

    }


    if (!amount || amount <= 0) {

        showFeeMessage(
            "Please enter a valid fee amount.",
            "warning"
        );

        return;

    }


    if (!method) {

        showFeeMessage(
            "Please select payment method.",
            "warning"
        );

        return;

    }


    if (!paidDate) {

        showFeeMessage(
            "Please select payment date.",
            "warning"
        );

        return;

    }


    /* FIND STUDENT */

    const student =
        students.find(
            s => s.id === studentDocId
        );


    if (!student) {

        showFeeMessage(
            "Student record not found.",
            "warning"
        );

        return;

    }


    /* DUPLICATE CHECK */

    const alreadyPaid =
        feeRecords.some(
            fee =>
                fee.studentDocId === studentDocId &&
                fee.month === month &&
                fee.status === "paid"
        );


    if (alreadyPaid) {

        showFeeMessage(
            `${formatMonth(month)} fee is already paid for this student.`,
            "warning"
        );

        return;

    }


    /* START */

    verifyFeeBtn.disabled = true;

    verifyFeeBtn.textContent =
        "Verifying...";


    try {

        const user =
            auth.currentUser;


        const feeData = {

            studentDocId:
                student.id,

            studentId:
                student.studentId || "",

            studentName:
                student.name || "",

            fatherName:
                student.fatherName || "",

            course:
                student.course || "",

            batch:
                student.batch || "",

            month:
                month,

            amount:
                amount,

            paymentMethod:
                method,

            paymentDate:
                paidDate,

            notes:
                notes,

            status:
                "paid",

            verifiedBy:
                user?.email || "Admin",

            createdAt:
                serverTimestamp()

        };


        /* SAVE PAYMENT */

        const feeRef =
            await addDoc(
                collection(db, "fees"),
                feeData
            );


        /* RECEIPT NUMBER */

        const receiptNo =
            generateReceiptNumber(
                feeRef.id
            );


        await updateDoc(
            doc(db, "fees", feeRef.id),
            {
                receiptNo:
                    receiptNo
            }
        );


        /* CREATE RECEIPT */

        const receiptData = {

            id:
                feeRef.id,

            ...feeData,

            receiptNo:
                receiptNo

        };


        showReceipt(
            receiptData
        );


        feeForm.reset();

        feeModal.classList.remove(
            "show"
        );


    } catch (error) {

        console.error(
            "Fee verification error:",
            error
        );


        showFeeMessage(
            "Unable to verify fee: " +
            error.message,
            "warning"
        );


    } finally {

        verifyFeeBtn.disabled = false;

        verifyFeeBtn.textContent =
            "✓ Verify & Mark Paid";

    }

}


/* =====================================================
   RECEIPT NUMBER
===================================================== */

function generateReceiptNumber(
    documentId
) {

    const year =
        new Date().getFullYear();


    const shortId =
        documentId
            .substring(0, 6)
            .toUpperCase();


    return `FEE-${year}-${shortId}`;

}


/* =====================================================
   RENDER FEE TABLE
===================================================== */

function renderFees() {

    if (!feeTableBody) return;


    const currentMonth =
        getCurrentMonth();


    const search =
        (feeSearch?.value || "")
            .toLowerCase()
            .trim();


    const status =
        feeStatusFilter?.value ||
        "all";


    const monthFilter =
        feeMonthFilter?.value ||
        "current";


    /*
       CREATE CURRENT MONTH RECORDS
       FOR ALL STUDENTS.
    */

    let records = [];


    students.forEach(student => {

        const studentFees =
            feeRecords.filter(
                fee =>
                    fee.studentDocId ===
                    student.id
            );


        const currentFee =
            studentFees.find(
                fee =>
                    fee.month ===
                    currentMonth &&
                    fee.status ===
                    "paid"
            );


        if (monthFilter === "current") {

            records.push({

                virtual:
                    !currentFee,

                id:
                    currentFee?.id || null,

                studentDocId:
                    student.id,

                studentId:
                    student.studentId || "",

                studentName:
                    student.name || "",

                course:
                    student.course || "",

                batch:
                    student.batch || "",

                month:
                    currentMonth,

                amount:
                    currentFee?.amount || 0,

                status:
                    currentFee ?
                        "paid" :
                        "pending",

                paymentDate:
                    currentFee?.paymentDate ||
                    "",

                receiptNo:
                    currentFee?.receiptNo ||
                    ""

            });

        } else {

            /*
               ALL MONTHS
            */

            if (studentFees.length) {

                studentFees.forEach(
                    fee => {

                        records.push({

                            ...fee,

                            virtual:
                                false

                        });

                    }
                );

            } else {

                records.push({

                    virtual:
                        true,

                    studentDocId:
                        student.id,

                    studentId:
                        student.studentId || "",

                    studentName:
                        student.name || "",

                    course:
                        student.course || "",

                    batch:
                        student.batch || "",

                    month:
                        currentMonth,

                    amount:
                        0,

                    status:
                        "pending",

                    paymentDate:
                        "",

                    receiptNo:
                        ""

                });

            }

        }

    });


    /* STATUS FILTER */

    if (status !== "all") {

        records =
            records.filter(
                record =>
                    record.status ===
                    status
            );

    }


    /* SEARCH */

    if (search) {

        records =
            records.filter(
                record =>

                    (record.studentName || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (record.studentId || "")
                        .toLowerCase()
                        .includes(search)

            );

    }


    /* SORT */

    records.sort(
        (a, b) => {

            if (a.status !== b.status) {

                return a.status === "pending"
                    ? -1
                    : 1;

            }

            return (
                a.studentName || ""
            ).localeCompare(
                b.studentName || ""
            );

        }
    );


    /* SUMMARY */

    const currentRecords =
        students.map(student => {

            return feeRecords.find(
                fee =>
                    fee.studentDocId ===
                    student.id &&

                    fee.month ===
                    currentMonth &&

                    fee.status ===
                    "paid"
            );

        });


    const paid =
        currentRecords.filter(
            Boolean
        );


    const pending =
        students.length -
        paid.length;


    const collected =
        paid.reduce(
            (total, fee) =>
                total +
                Number(fee.amount || 0),
            0
        );


    feePaidCount.textContent =
        paid.length;


    feePendingCount.textContent =
        pending;


    feeCollectedAmount.textContent =
        formatCurrency(collected);


    /* EMPTY */

    if (!records.length) {

        feeTableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty">

                    No fee records found.

                </td>

            </tr>

        `;

        return;

    }


    /* TABLE */

    feeTableBody.innerHTML = "";


    records.forEach(record => {

        const row =
            document.createElement("tr");


        const statusHTML =
            record.status === "paid"

                ? `
                    <span class="fee-status paid">
                        ✓ PAID
                    </span>
                  `

                : `
                    <span class="fee-status pending">
                        ⏳ PENDING
                    </span>
                  `;


        const amountHTML =
            record.status === "paid"

                ? formatCurrency(
                    record.amount
                  )

                : "—";


        let actionHTML = "";


        if (record.status === "paid") {

            actionHTML = `

                <button
                    class="fee-action-btn receipt-btn"
                    data-receipt-id="${escapeHTML(record.id || "")}">

                    🧾 Receipt

                </button>

            `;

        } else {

            actionHTML = `

                <button
                    class="fee-action-btn verify-fee-btn"
                    data-student-id="${escapeHTML(record.studentDocId)}"
                    data-month="${escapeHTML(record.month)}">

                    ✓ Verify Fee

                </button>

            `;

        }


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
                /
                ${escapeHTML(
                    record.batch || "-"
                )}
            </td>


            <td>
                ${formatMonth(
                    record.month
                )}
            </td>


            <td>
                ${amountHTML}
            </td>


            <td>
                ${statusHTML}
            </td>


            <td>
                ${formatDate(
                    record.paymentDate
                )}
            </td>


            <td>
                ${actionHTML}
            </td>

        `;


        feeTableBody.appendChild(
            row
        );

    });


    attachFeeActions();

}


/* =====================================================
   FEE ACTION BUTTONS
===================================================== */

function attachFeeActions() {


    document
        .querySelectorAll(".verify-fee-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openFeeForStudent(
                        button.dataset.studentId,
                        button.dataset.month
                    );

                }
            );

        });


    document
        .querySelectorAll(".receipt-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const fee =
                        feeRecords.find(
                            record =>
                                record.id ===
                                button.dataset.receiptId
                        );


                    if (fee) {

                        showReceipt(
                            fee
                        );

                    }

                }
            );

        });

}


/* =====================================================
   OPEN PENDING FEE
===================================================== */

function openFeeForStudent(
    studentId,
    month
) {

    feeForm.reset();


    feeStudent.value =
        studentId;


    feeMonth.value =
        month;


    paymentDate.value =
        getTodayDate();


    feeFormMessage.textContent =
        "";


    feeModal.classList.add(
        "show"
    );


    feeAmount.focus();

}


/* =====================================================
   SEARCH / FILTER
===================================================== */

if (feeSearch) {

    feeSearch.addEventListener(
        "input",
        renderFees
    );

}


if (feeStatusFilter) {

    feeStatusFilter.addEventListener(
        "change",
        renderFees
    );

}


if (feeMonthFilter) {

    feeMonthFilter.addEventListener(
        "change",
        renderFees
    );

}


/* =====================================================
   RECEIPT
===================================================== */

function showReceipt(fee) {

    selectedReceipt =
        fee;


    receiptContent.innerHTML = `

        <div class="fee-receipt">

            <div class="receipt-header">

                <h2>
                    Sir Syed Hassan Ali
                </h2>

                <p>
                    Coaching Management System
                </p>

                <div class="receipt-title">
                    FEE PAYMENT RECEIPT
                </div>

            </div>


            <div class="receipt-info">

                <div>

                    <span>
                        Receipt No
                    </span>

                    <strong>
                        ${escapeHTML(
                            fee.receiptNo || "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Payment Date
                    </span>

                    <strong>
                        ${formatDate(
                            fee.paymentDate
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Student ID
                    </span>

                    <strong>
                        ${escapeHTML(
                            fee.studentId || "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Student Name
                    </span>

                    <strong>
                        ${escapeHTML(
                            fee.studentName || "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Father Name
                    </span>

                    <strong>
                        ${escapeHTML(
                            fee.fatherName || "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Course / Batch
                    </span>

                    <strong>
                        ${escapeHTML(
                            fee.course || "-"
                        )}
                        /
                        ${escapeHTML(
                            fee.batch || "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Fee Month
                    </span>

                    <strong>
                        ${formatMonth(
                            fee.month
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        Payment Method
                    </span>

                    <strong>
                        ${escapeHTML(
                            fee.paymentMethod || "-"
                        )}
                    </strong>

                </div>

            </div>


            <div class="receipt-amount">

                <span>
                    Amount Paid
                </span>

                <strong>
                    ${formatCurrency(
                        fee.amount
                    )}
                </strong>

                <span class="receipt-paid">
                    ✓ PAYMENT VERIFIED
                </span>

            </div>


            <div class="receipt-footer">

                Verified by:
                ${escapeHTML(
                    fee.verifiedBy || "Admin"
                )}

                <br>

                Thank you for your payment.

            </div>

        </div>

    `;


    receiptModal.classList.add(
        "show"
    );

}


/* =====================================================
   CLOSE RECEIPT
===================================================== */

if (closeReceiptModal) {

    closeReceiptModal.addEventListener(
        "click",
        closeReceipt
    );

}


if (closeReceiptBtn) {

    closeReceiptBtn.addEventListener(
        "click",
        closeReceipt
    );

}


function closeReceipt() {

    receiptModal.classList.remove(
        "show"
    );

    selectedReceipt =
        null;

}


/* =====================================================
   DOWNLOAD PDF
===================================================== */

if (downloadReceiptBtn) {

    downloadReceiptBtn.addEventListener(
        "click",
        downloadReceiptPDF
    );

}


function downloadReceiptPDF() {

    if (!selectedReceipt) {

        alert(
            "Receipt data not available."
        );

        return;

    }


    if (
        typeof window.jspdf ===
        "undefined"
    ) {

        alert(
            "PDF library is not loaded."
        );

        return;

    }


    const {
        jsPDF
    } = window.jspdf;


    const pdf =
        new jsPDF();


    const fee =
        selectedReceipt;


    pdf.setFontSize(18);

    pdf.text(
        "Sir Syed Hassan Ali",
        105,
        25,
        {
            align: "center"
        }
    );


    pdf.setFontSize(11);

    pdf.text(
        "Coaching Management System",
        105,
        33,
        {
            align: "center"
        }
    );


    pdf.setFontSize(16);

    pdf.text(
        "FEE PAYMENT RECEIPT",
        105,
        48,
        {
            align: "center"
        }
    );


    pdf.line(
        20,
        55,
        190,
        55
    );


    pdf.setFontSize(11);


    const lines = [

        [
            "Receipt No:",
            fee.receiptNo || "-"
        ],

        [
            "Payment Date:",
            formatDate(
                fee.paymentDate
            )
        ],

        [
            "Student ID:",
            fee.studentId || "-"
        ],

        [
            "Student Name:",
            fee.studentName || "-"
        ],

        [
            "Father Name:",
            fee.fatherName || "-"
        ],

        [
            "Course:",
            fee.course || "-"
        ],

        [
            "Batch:",
            fee.batch || "-"
        ],

        [
            "Fee Month:",
            formatMonth(
                fee.month
            )
        ],

        [
            "Payment Method:",
            fee.paymentMethod || "-"
        ],

        [
            "Status:",
            "PAID / VERIFIED"
        ]

    ];


    let y = 70;


    lines.forEach(
        ([label, value]) => {

            pdf.setFont(
                "helvetica",
                "bold"
            );

            pdf.text(
                label,
                25,
                y
            );


            pdf.setFont(
                "helvetica",
                "normal"
            );

            pdf.text(
                String(value),
                75,
                y
            );


            y += 10;

        }
    );


    pdf.line(
        20,
        y + 3,
        190,
        y + 3
    );


    y += 18;


    pdf.setFontSize(14);

    pdf.setFont(
        "helvetica",
        "bold"
    );


    pdf.text(
        "Amount Paid:",
        25,
        y
    );


    pdf.text(
        formatCurrency(
            fee.amount
        ),
        190,
        y,
        {
            align: "right"
        }
    );


    pdf.setFontSize(9);

    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.text(
        "This is a computer generated fee receipt.",
        105,
        270,
        {
            align: "center"
        }
    );


    pdf.text(
        "Thank you for your payment.",
        105,
        278,
        {
            align: "center"
        }
    );


    pdf.save(
        `${fee.receiptNo || "fee-receipt"}.pdf`
    );

}


/* =====================================================
   MESSAGE
===================================================== */

function showFeeMessage(
    message,
    type
) {

    feeFormMessage.textContent =
        message;


    feeFormMessage.className =
        type === "warning"

            ? "fee-form-warning"

            : "fee-form-success";

}


/* =====================================================
   CURRENCY
===================================================== */

function formatCurrency(
    amount
) {

    return (
        "Rs. " +
        Number(
            amount || 0
        ).toLocaleString(
            "en-PK"
        )
    );

}


/* =====================================================
   SECURITY
===================================================== */

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
