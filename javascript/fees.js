import { db } from "../firebase/firebase-config.js";

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/*
=========================================================
 SIR SYED HASSAN ALI COACHING
 FEE MANAGEMENT SYSTEM
=========================================================

 FEATURES:
 - Monthly fee
 - Mark Paid
 - Pending / Paid
 - One payment per student per month
 - Fee receipt
 - Print / Save as PDF
 - WhatsApp sharing
 - Undo payment
=========================================================
*/

(() => {

    let started = false;

    let students = [];
    let records = [];

    let month = currentMonth();

    const start = () => {

        if (started) return;
        started = true;

        const tableBody =
            document.getElementById("feesTableBody");

        if (!tableBody) {
            console.error("feesTableBody not found.");
            return;
        }

        const monthInput =
            document.getElementById("feeMonth");

        const searchInput =
            document.getElementById("feeStudentSearch");

        const statusFilter =
            document.getElementById("feeStatusFilter");

        const totalEl =
            document.getElementById("feeTotalStudents");

        const paidEl =
            document.getElementById("feePaidStudents");

        const pendingEl =
            document.getElementById("feePendingStudents");

        const collectedEl =
            document.getElementById("feeCollectedAmount");


        /* =================================================
           DEFAULT MONTH
        ================================================= */

        if (monthInput) {
            monthInput.value = month;
        }


        /* =================================================
           LOAD STUDENTS
        ================================================= */

        onSnapshot(
            collection(db, "students"),

            snapshot => {

                students = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                console.log(
                    "Fee Management - Students loaded:",
                    students.length
                );

                render();
            },

            error => {

                console.error(
                    "Students Error:",
                    error
                );

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load students.
                        </td>
                    </tr>
                `;
            }
        );


        /* =================================================
           LOAD FEES
        ================================================= */

        onSnapshot(
            collection(db, "fees"),

            snapshot => {

                records = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                console.log(
                    "Fee Management - Fee records loaded:",
                    records.length
                );

                render();
            },

            error => {

                console.error(
                    "Fees Error:",
                    error
                );

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load fee records.
                        </td>
                    </tr>
                `;
            }
        );


        /* =================================================
           MONTH
        ================================================= */

        monthInput?.addEventListener(
            "change",
            () => {

                month =
                    monthInput.value ||
                    currentMonth();

                render();
            }
        );


        /* =================================================
           SEARCH
        ================================================= */

        searchInput?.addEventListener(
            "input",
            render
        );


        /* =================================================
           STATUS FILTER
        ================================================= */

        statusFilter?.addEventListener(
            "change",
            render
        );

    };


    /* =====================================================
       RENDER
    ===================================================== */

    function render() {

        const tableBody =
            document.getElementById("feesTableBody");

        if (!tableBody) return;


        const searchInput =
            document.getElementById("feeStudentSearch");

        const statusFilter =
            document.getElementById("feeStatusFilter");


        const search =
            searchInput
                ? searchInput.value
                    .toLowerCase()
                    .trim()
                : "";


        const filter =
            statusFilter
                ? statusFilter.value
                : "all";


        /* =================================================
           BUILD STUDENT ROWS
        ================================================= */

        const rows =
            students
                .map(student => {

                    const payment =
                        getCurrentPayment(student.id);


                    const lastPaid =
                        getLastPayment(student.id);


                    return {
                        student,
                        payment,
                        lastPaid,
                        status:
                            payment
                                ? "paid"
                                : "unpaid"
                    };
                })


                .filter(row => {

                    const student =
                        row.student;


                    const text = [
                        student.name,
                        student.studentId,
                        student.phone,
                        student.course,
                        student.batch,
                        student.fatherName
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    const searchMatch =
                        !search ||
                        text.includes(search);


                    const statusMatch =
                        filter === "all" ||
                        filter === row.status;


                    return (
                        searchMatch &&
                        statusMatch
                    );
                });


        /* =================================================
           SUMMARY
        ================================================= */

        const paidRecords =
            students
                .map(student =>
                    getCurrentPayment(student.id)
                )
                .filter(Boolean);


        const total =
            students.length;


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


        if (totalEl()) {
            totalEl().textContent = total;
        }


        if (paidEl()) {
            paidEl().textContent = paid;
        }


        if (pendingEl()) {
            pendingEl().textContent = pending;
        }


        if (collectedEl()) {
            collectedEl().textContent =
                `₨ ${money(collected)}`;
        }


        /* =================================================
           TABLE
        ================================================= */

        tableBody.innerHTML =
            rows.length
                ? rows
                    .map(buildRow)
                    .join("")
                : `
                    <tr>
                        <td colspan="9" class="empty">
                            No students found.
                        </td>
                    </tr>
                `;


        /* =================================================
           BUTTON EVENTS
        ================================================= */

        tableBody
            .querySelectorAll("[data-fee-action]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const student =
                            students.find(
                                item =>
                                    item.id ===
                                    button.dataset.studentId
                            );


                        if (!student) return;


                        const action =
                            button.dataset.feeAction;


                        if (
                            action === "paid"
                        ) {
                            openPayment(student);
                        }


                        if (
                            action === "undo"
                        ) {
                            undoPayment(student);
                        }


                        if (
                            action === "fee"
                        ) {
                            setFee(student);
                        }


                        if (
                            action === "slip"
                        ) {
                            showSlip(student);
                        }

                    }
                );

            });

    }


    /* =====================================================
       GET CURRENT MONTH PAYMENT
    ===================================================== */

    function getCurrentPayment(
        studentId
    ) {

        return records.find(
            record =>
                record.studentDocId ===
                    studentId &&

                record.month ===
                    month &&

                record.status ===
                    "paid"
        ) || null;

    }


    /* =====================================================
       GET LAST PAYMENT
    ===================================================== */

    function getLastPayment(
        studentId
    ) {

        return records
            .filter(
                record =>
                    record.studentDocId ===
                        studentId &&

                    record.status ===
                        "paid" &&

                    record.month
            )
            .sort(
                (a, b) =>
                    String(b.month)
                        .localeCompare(
                            String(a.month)
                        )
            )[0] || null;

    }


    /* =====================================================
       TABLE ROW
    ===================================================== */

    function buildRow({
        student,
        payment,
        lastPaid
    }) {

        const amount =
            Number(
                student.monthlyFee ||
                payment?.amount ||
                0
            );


        return `
            <tr>

                <td>
                    <strong>
                        ${esc(
                            student.studentId ||
                            "—"
                        )}
                    </strong>
                </td>


                <td>

                    <div class="fee-student-name">
                        ${esc(
                            student.name ||
                            "—"
                        )}
                    </div>

                    <div class="fee-student-phone">
                        ${esc(
                            student.phone ||
                            ""
                        )}
                    </div>

                </td>


                <td>
                    ${esc(
                        student.course ||
                        "—"
                    )}
                </td>


                <td>
                    ${esc(
                        student.batch ||
                        "—"
                    )}
                </td>


                <td>

                    <div class="fee-amount">
                        ₨ ${money(amount)}
                    </div>

                    <button
                        type="button"
                        class="fee-link-btn"
                        data-fee-action="fee"
                        data-student-id="${escAttr(
                            student.id
                        )}"
                    >
                        Set Fee
                    </button>

                </td>


                <td>

                    ${
                        payment
                            ? `
                                <span class="fee-badge paid">
                                    ✓ Paid
                                </span>
                            `
                            : `
                                <span class="fee-badge unpaid">
                                    ● Pending
                                </span>
                            `
                    }

                </td>


                <td>

                    ${
                        lastPaid
                            ? formatMonth(
                                lastPaid.month
                            )
                            : "—"
                    }

                </td>


                <td>

                    ${
                        payment?.paymentDate
                            ? formatDate(
                                payment.paymentDate
                            )
                            : "—"
                    }

                </td>


                <td>

                    <div class="fee-actions">

                        ${
                            payment
                                ? `
                                    <button
                                        type="button"
                                        class="fee-action secondary"
                                        data-fee-action="slip"
                                        data-student-id="${escAttr(
                                            student.id
                                        )}"
                                    >
                                        Receipt
                                    </button>

                                    <button
                                        type="button"
                                        class="fee-action danger"
                                        data-fee-action="undo"
                                        data-student-id="${escAttr(
                                            student.id
                                        )}"
                                    >
                                        Undo
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="fee-action success"
                                        data-fee-action="paid"
                                        data-student-id="${escAttr(
                                            student.id
                                        )}"
                                    >
                                        ✓ Mark Paid
                                    </button>
                                `
                        }

                    </div>

                </td>

            </tr>
        `;

    }


    /* =====================================================
       SET MONTHLY FEE
    ===================================================== */

    async function setFee(
        student
    ) {

        const value =
            prompt(
                `Monthly fee for ${student.name}:`,
                student.monthlyFee || ""
            );


        if (value === null) return;


        const amount =
            Number(
                String(value)
                    .replace(/,/g, "")
                    .trim()
            );


        if (
            !Number.isFinite(amount) ||
            amount < 0
        ) {

            alert(
                "Please enter a valid fee amount."
            );

            return;
        }


        try {

            await updateDoc(
                doc(
                    db,
                    "students",
                    student.id
                ),
                {
                    monthlyFee:
                        amount,

                    feeUpdatedAt:
                        serverTimestamp()
                }
            );


            toast(
                "Monthly fee updated."
            );

        } catch (error) {

            console.error(
                "Set Fee Error:",
                error
            );


            alert(
                "Unable to update fee:\n\n" +
                error.message
            );

        }

    }


    /* =====================================================
       MARK PAID
    ===================================================== */

    function openPayment(
        student
    ) {

        const existing =
            getCurrentPayment(
                student.id
            );


        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "fee-modal-overlay";


        overlay.innerHTML = `

            <div class="fee-modal">

                <div class="fee-modal-head">

                    <div>

                        <div class="fee-modal-title">
                            Mark Fee Paid
                        </div>

                        <div class="fee-modal-subtitle">
                            ${esc(
                                student.name ||
                                "Student"
                            )}
                            •
                            ${formatMonth(month)}
                        </div>

                    </div>


                    <button
                        type="button"
                        class="fee-modal-close"
                    >
                        ×
                    </button>

                </div>


                <form class="fee-payment-form">

                    <div class="fee-form-grid">

                        <label>

                            Student ID

                            <input
                                value="${escAttr(
                                    student.studentId ||
                                    ""
                                )}"
                                disabled
                            >

                        </label>


                        <label>

                            Amount (PKR)

                            <input
                                name="amount"
                                type="number"
                                min="1"
                                step="1"
                                value="${Number(
                                    existing?.amount ||
                                    student.monthlyFee ||
                                    0
                                )}"
                                required
                            >

                        </label>


                        <label>

                            Payment Date

                            <input
                                name="paymentDate"
                                type="date"
                                value="${today()}"
                                required
                            >

                        </label>


                        <label>

                            Month

                            <input
                                value="${formatMonth(
                                    month
                                )}"
                                disabled
                            >

                        </label>

                    </div>


                    <label class="fee-note-label">

                        Note

                        <textarea
                            name="note"
                            rows="3"
                            placeholder="Optional payment note"
                        ></textarea>

                    </label>


                    <div class="fee-modal-actions">

                        <button
                            type="button"
                            class="secondary-btn fee-cancel"
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            class="primary-btn"
                        >
                            Save Payment
                        </button>

                    </div>

                </form>

            </div>
        `;


        document.body.appendChild(
            overlay
        );


        const close =
            () => overlay.remove();


        overlay
            .querySelector(
                ".fee-modal-close"
            )
            ?.addEventListener(
                "click",
                close
            );


        overlay
            .querySelector(
                ".fee-cancel"
            )
            ?.addEventListener(
                "click",
                close
            );


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {
                    close();
                }

            }
        );


        const form =
            overlay.querySelector(
                ".fee-payment-form"
            );


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const amount =
                    Number(
                        form.elements.amount.value
                    );


                const paymentDate =
                    form.elements.paymentDate.value;


                const note =
                    form.elements.note.value
                        .trim();


                if (
                    !Number.isFinite(amount) ||
                    amount <= 0 ||
                    !paymentDate
                ) {

                    alert(
                        "Enter a valid amount and payment date."
                    );

                    return;
                }


                const submit =
                    form.querySelector(
                        'button[type="submit"]'
                    );


                submit.disabled =
                    true;

                submit.textContent =
                    "Saving...";


                try {

                    /*
                    IMPORTANT:
                    Only ONE payment record
                    for one student + one month.
                    */

                    const old =
                        records.find(
                            record =>
                                record.studentDocId ===
                                    student.id &&

                                record.month ===
                                    month
                        );


                    const paymentData = {

                        studentDocId:
                            student.id,

                        studentId:
                            student.studentId ||
                            "",

                        studentName:
                            student.name ||
                            "",

                        phone:
                            student.phone ||
                            "",

                        fatherName:
                            student.fatherName ||
                            "",

                        course:
                            student.course ||
                            "",

                        batch:
                            student.batch ||
                            "",

                        month,

                        amount,

                        paymentDate,

                        note,

                        status:
                            "paid",

                        updatedAt:
                            serverTimestamp()

                    };


                    if (old) {

                        await updateDoc(
                            doc(
                                db,
                                "fees",
                                old.id
                            ),
                            paymentData
                        );

                    } else {

                        await addDoc(
                            collection(
                                db,
                                "fees"
                            ),
                            {
                                ...paymentData,

                                createdAt:
                                    serverTimestamp()
                            }
                        );

                    }


                    /*
                    Keep monthly fee
                    synchronized.
                    */

                    if (
                        Number(
                            student.monthlyFee ||
                            0
                        ) !== amount
                    ) {

                        await updateDoc(
                            doc(
                                db,
                                "students",
                                student.id
                            ),
                            {
                                monthlyFee:
                                    amount
                            }
                        );

                    }


                    close();


                    toast(
                        `${student.name} fee marked as paid.`
                    );


                } catch (error) {

                    console.error(
                        "Payment Error:",
                        error
                    );


                    alert(
                        "Unable to save payment:\n\n" +
                        error.message
                    );


                    submit.disabled =
                        false;

                    submit.textContent =
                        "Save Payment";

                }

            }
        );

    }


    /* =====================================================
       UNDO PAYMENT
    ===================================================== */

    async function undoPayment(
        student
    ) {

        const record =
            getCurrentPayment(
                student.id
            );


        if (!record) return;


        const confirmed =
            confirm(
                `Mark ${student.name}'s ${formatMonth(
                    month
                )} fee as pending?`
            );


        if (!confirmed) return;


        try {

            await deleteDoc(
                doc(
                    db,
                    "fees",
                    record.id
                )
            );


            toast(
                "Payment removed. Fee is now pending."
            );


        } catch (error) {

            console.error(
                "Undo Error:",
                error
            );


            alert(
                "Unable to undo payment:\n\n" +
                error.message
            );

        }

    }


    /* =====================================================
       FEE SLIP
    ===================================================== */

    function showSlip(
        student
    ) {

        const record =
            getCurrentPayment(
                student.id
            );


        if (!record) {

            alert(
                "This student's fee is not paid for this month."
            );

            return;
        }


        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "fee-modal-overlay";


        overlay.innerHTML = `

            <div
                class="fee-modal"
                style="max-width:650px;"
            >

                <div class="fee-modal-head">

                    <div>

                        <div class="fee-modal-title">
                            Fee Receipt
                        </div>

                        <div class="fee-modal-subtitle">
                            ${esc(
                                student.name ||
                                "Student"
                            )}
                            •
                            ${formatMonth(
                                record.month
                            )}
                        </div>

                    </div>


                    <button
                        type="button"
                        class="fee-modal-close"
                    >
                        ×
                    </button>

                </div>


                <div
                    id="feeSlipPrintArea"
                    style="
                        padding:28px;
                        background:#ffffff;
                    "
                >

                    <div
                        style="
                            max-width:560px;
                            margin:auto;
                            border:1px solid #e5e7eb;
                            border-radius:16px;
                            overflow:hidden;
                            background:#ffffff;
                        "
                    >

                        <div
                            style="
                                padding:24px;
                                background:#f8fafc;
                                border-bottom:1px solid #e5e7eb;
                            "
                        >

                            <div
                                style="
                                    font-size:21px;
                                    font-weight:800;
                                    color:#172554;
                                "
                            >
                                Sir Syed Hassan Ali Coaching
                            </div>


                            <div
                                style="
                                    margin-top:5px;
                                    font-size:12px;
                                    color:#64748b;
                                "
                            >
                                Monthly Fee Receipt
                            </div>

                        </div>


                        <div
                            style="
                                padding:24px;
                            "
                        >

                            <div
                                style="
                                    display:grid;
                                    grid-template-columns:1fr 1fr;
                                    gap:18px;
                                "
                            >

                                <div>

                                    <div
                                        style="
                                            font-size:11px;
                                            color:#64748b;
                                        "
                                    >
                                        Student Name
                                    </div>

                                    <div
                                        style="
                                            margin-top:4px;
                                            font-size:14px;
                                            font-weight:700;
                                            color:#111827;
                                        "
                                    >
                                        ${esc(
                                            student.name ||
                                            "—"
                                        )}
                                    </div>

                                </div>


                                <div>

                                    <div
                                        style="
                                            font-size:11px;
                                            color:#64748b;
                                        "
                                    >
                                        Student ID
                                    </div>

                                    <div
                                        style="
                                            margin-top:4px;
                                            font-size:14px;
                                            font-weight:700;
                                            color:#111827;
                                        "
                                    >
                                        ${esc(
                                            student.studentId ||
                                            "—"
                                        )}
                                    </div>

                                </div>


                                <div>

                                    <div
                                        style="
                                            font-size:11px;
                                            color:#64748b;
                                        "
                                    >
                                        Course
                                    </div>

                                    <div
                                        style="
                                            margin-top:4px;
                                            font-size:14px;
                                            font-weight:700;
                                            color:#111827;
                                        "
                                    >
                                        ${esc(
                                            student.course ||
                                            "—"
                                        )}
                                    </div>

                                </div>


                                <div>

                                    <div
                                        style="
                                            font-size:11px;
                                            color:#64748b;
                                        "
                                    >
                                        Batch
                                    </div>

                                    <div
                                        style="
                                            margin-top:4px;
                                            font-size:14px;
                                            font-weight:700;
                                            color:#111827;
                                        "
                                    >
                                        ${esc(
                                            student.batch ||
                                            "—"
                                        )}
                                    </div>

                                </div>

                            </div>


                            <hr
                                style="
                                    border:0;
                                    border-top:1px solid #e5e7eb;
                                    margin:24px 0;
                                "
                            >


                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:center;
                                    margin-bottom:14px;
                                "
                            >

                                <span
                                    style="
                                        color:#64748b;
                                        font-size:13px;
                                    "
                                >
                                    Fee Month
                                </span>

                                <strong>
                                    ${formatMonth(
                                        record.month
                                    )}
                                </strong>

                            </div>


                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:center;
                                    margin-bottom:14px;
                                "
                            >

                                <span
                                    style="
                                        color:#64748b;
                                        font-size:13px;
                                    "
                                >
                                    Payment Date
                                </span>

                                <strong>
                                    ${formatDate(
                                        record.paymentDate
                                    )}
                                </strong>

                            </div>


                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:center;
                                    padding:16px;
                                    background:#f8fafc;
                                    border-radius:12px;
                                "
                            >

                                <span
                                    style="
                                        font-size:13px;
                                        font-weight:700;
                                    "
                                >
                                    Amount Paid
                                </span>

                                <strong
                                    style="
                                        font-size:22px;
                                        color:#172554;
                                    "
                                >
                                    ₨ ${money(
                                        record.amount
                                    )}
                                </strong>

                            </div>


                            <div
                                style="
                                    margin-top:18px;
                                    text-align:center;
                                    font-weight:800;
                                    color:#047857;
                                    font-size:14px;
                                "
                            >
                                ✓ PAYMENT PAID
                            </div>


                            ${
                                record.note
                                    ? `
                                        <div
                                            style="
                                                margin-top:18px;
                                                padding:12px;
                                                background:#f8fafc;
                                                border-radius:9px;
                                                font-size:12px;
                                                color:#475569;
                                            "
                                        >
                                            <strong>Note:</strong>
                                            ${esc(record.note)}
                                        </div>
                                    `
                                    : ""
                            }


                            <div
                                style="
                                    margin-top:24px;
                                    text-align:center;
                                    font-size:11px;
                                    color:#94a3b8;
                                "
                            >
                                Thank you for your payment.
                            </div>

                        </div>

                    </div>

                </div>


                <div
                    class="fee-modal-actions"
                    style="
                        padding:0 24px 24px;
                    "
                >

                    <button
                        type="button"
                        class="secondary-btn"
                        data-slip-print
                    >
                        Download / Print PDF
                    </button>


                    <button
                        type="button"
                        class="primary-btn"
                        data-slip-whatsapp
                    >
                        WhatsApp
                    </button>

                </div>

            </div>
        `;


        document.body.appendChild(
            overlay
        );


        const close =
            () => overlay.remove();


        overlay
            .querySelector(
                ".fee-modal-close"
            )
            ?.addEventListener(
                "click",
                close
            );


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {
                    close();
                }

            }
        );


        /* =================================================
           PRINT / SAVE PDF
        ================================================= */

        overlay
            .querySelector(
                "[data-slip-print]"
            )
            ?.addEventListener(
                "click",
                () => {

                    printSlip(
                        student,
                        record
                    );

                }
            );


        /* =================================================
           WHATSAPP
        ================================================= */

        overlay
            .querySelector(
                "[data-slip-whatsapp]"
            )
            ?.addEventListener(
                "click",
                () => {

                    const phone =
                        normalizePhone(
                            student.phone ||
                            record.phone ||
                            ""
                        );


                    if (!phone) {

                        alert(
                            "Student phone number is missing."
                        );

                        return;
                    }


                    const message =
                        createSlipMessage(
                            student,
                            record
                        );


                    const url =
                        `https://wa.me/${phone}?text=${encodeURIComponent(
                            message
                        )}`;


                    window.open(
                        url,
                        "_blank"
                    );

                }
            );

    }


    /* =====================================================
       PRINT SLIP
    ===================================================== */

    function printSlip(
        student,
        record
    ) {

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=800,height=900"
            );


        if (!printWindow) {

            alert(
                "Please allow pop-ups to download the fee slip."
            );

            return;
        }


        printWindow.document.write(`

            <!DOCTYPE html>

            <html>

            <head>

                <title>
                    Fee Receipt - ${esc(
                        student.name
                    )}
                </title>

                <style>

                    * {
                        box-sizing:border-box;
                    }

                    body {
                        margin:0;
                        padding:30px;
                        font-family:
                            Arial,
                            Helvetica,
                            sans-serif;
                        color:#111827;
                        background:#ffffff;
                    }

                    .receipt {
                        max-width:600px;
                        margin:auto;
                        border:1px solid #e5e7eb;
                        border-radius:16px;
                        overflow:hidden;
                    }

                    .header {
                        padding:28px;
                        background:#f8fafc;
                        border-bottom:1px solid #e5e7eb;
                    }

                    .title {
                        font-size:24px;
                        font-weight:800;
                        color:#172554;
                    }

                    .subtitle {
                        margin-top:6px;
                        font-size:13px;
                        color:#64748b;
                    }

                    .content {
                        padding:28px;
                    }

                    .grid {
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:20px;
                    }

                    .label {
                        font-size:11px;
                        color:#64748b;
                    }

                    .value {
                        margin-top:5px;
                        font-size:14px;
                        font-weight:700;
                    }

                    hr {
                        border:0;
                        border-top:1px solid #e5e7eb;
                        margin:25px 0;
                    }

                    .row {
                        display:flex;
                        justify-content:space-between;
                        margin-bottom:16px;
                    }

                    .amount {
                        padding:18px;
                        background:#f8fafc;
                        border-radius:12px;
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                    }

                    .amount strong {
                        font-size:22px;
                        color:#172554;
                    }

                    .paid {
                        text-align:center;
                        margin-top:20px;
                        font-weight:800;
                        color:#047857;
                    }

                    .footer {
                        margin-top:28px;
                        text-align:center;
                        color:#94a3b8;
                        font-size:11px;
                    }

                    @media print {

                        body {
                            padding:0;
                        }

                        .receipt {
                            border:1px solid #ddd;
                        }

                    }

                </style>

            </head>


            <body>

                <div class="receipt">

                    <div class="header">

                        <div class="title">
                            Sir Syed Hassan Ali Coaching
                        </div>

                        <div class="subtitle">
                            Monthly Fee Receipt
                        </div>

                    </div>


                    <div class="content">

                        <div class="grid">

                            <div>
                                <div class="label">
                                    Student Name
                                </div>

                                <div class="value">
                                    ${esc(
                                        student.name ||
                                        "—"
                                    )}
                                </div>
                            </div>


                            <div>
                                <div class="label">
                                    Student ID
                                </div>

                                <div class="value">
                                    ${esc(
                                        student.studentId ||
                                        "—"
                                    )}
                                </div>
                            </div>


                            <div>
                                <div class="label">
                                    Course
                                </div>

                                <div class="value">
                                    ${esc(
                                        student.course ||
                                        "—"
                                    )}
                                </div>
                            </div>


                            <div>
                                <div class="label">
                                    Batch
                                </div>

                                <div class="value">
                                    ${esc(
                                        student.batch ||
                                        "—"
                                    )}
                                </div>
                            </div>

                        </div>


                        <hr>


                        <div class="row">

                            <span>
                                Fee Month
                            </span>

                            <strong>
                                ${formatMonth(
                                    record.month
                                )}
                            </strong>

                        </div>


                        <div class="row">

                            <span>
                                Payment Date
                            </span>

                            <strong>
                                ${formatDate(
                                    record.paymentDate
                                )}
                            </strong>

                        </div>


                        <div class="amount">

                            <strong>
                                Amount Paid
                            </strong>

                            <strong>
                                ₨ ${money(
                                    record.amount
                                )}
                            </strong>

                        </div>


                        <div class="paid">
                            ✓ PAYMENT PAID
                        </div>


                        <div class="footer">
                            Thank you for your payment.
                        </div>

                    </div>

                </div>


                <script>

                    window.onload = function() {

                        window.print();

                    };

                </script>

            </body>

            </html>

        `);


        printWindow.document.close();

    }


    /* =====================================================
       WHATSAPP MESSAGE
    ===================================================== */

    function createSlipMessage(
        student,
        record
    ) {

        return `
FEE PAYMENT RECEIPT
Sir Syed Hassan Ali Coaching

Student: ${student.name || "—"}
Student ID: ${student.studentId || "—"}
Course: ${student.course || "—"}
Batch: ${student.batch || "—"}

Fee Month: ${formatMonth(record.month)}
Amount Paid: PKR ${money(record.amount)}
Payment Date: ${formatDate(record.paymentDate)}

Status: PAID

Thank you for your payment.
        `.trim();

    }

})();


/* =========================================================
   HELPERS
========================================================= */


function currentMonth() {

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


function today() {

    const date =
        new Date();


    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0")
    );

}


function formatMonth(
    value
) {

    const [
        year,
        month
    ] =
        String(
            value || ""
        ).split("-");


    if (
        !year ||
        !month
    ) {
        return "—";
    }


    return new Date(
        Number(year),
        Number(month) - 1,
        1
    ).toLocaleDateString(
        "en-US",
        {
            month:
                "long",
            year:
                "numeric"
        }
    );

}


function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(
            `${value}T00:00:00`
        );


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
            day:
                "2-digit",
            month:
                "short",
            year:
                "numeric"
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


function esc(
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


function escAttr(
    value
) {

    return esc(
        value
    )
        .replace(
            /`/g,
            "&#096;"
        );

}


function normalizePhone(
    value
) {

    let phone =
        String(
            value || ""
        ).replace(
            /\D/g,
            ""
        );


    if (
        phone.startsWith("00")
    ) {

        phone =
            phone.substring(2);

    }


    if (
        phone.startsWith("0") &&
        phone.length === 11
    ) {

        phone =
            "92" +
            phone.substring(1);

    }


    return phone;

}


function toast(
    message
) {

    const old =
        document.querySelector(
            ".fee-toast"
        );


    if (old) {
        old.remove();
    }


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "fee-toast show";


    notification.textContent =
        message;


    document.body.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        2500
    );

}


function totalEl() {
    return document.getElementById(
        "feeTotalStudents"
    );
}


function paidEl() {
    return document.getElementById(
        "feePaidStudents"
    );
}


function pendingEl() {
    return document.getElementById(
        "feePendingStudents"
    );
}


function collectedEl() {
    return document.getElementById(
        "feeCollectedAmount"
    );
}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            const event =
                new Event(
                    "fees-ready"
                );

            document.dispatchEvent(
                event
            );

            if (
                typeof window.startFeesManagement ===
                "function"
            ) {
                window.startFeesManagement();
            }

        },
        {
            once:
                true
        }
    );

}


/*
If the page already loaded,
the main module starts itself above.
*/
