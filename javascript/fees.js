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

/* =========================================================
   FEE MANAGEMENT SYSTEM
========================================================= */

(() => {

    const start = () => {

        const tableBody =
            document.getElementById("feesTableBody");

        if (!tableBody) {
            console.error("❌ feesTableBody not found.");
            return;
        }

        injectFeeStyles();

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

        let students = [];
        let records = [];
        let month = currentMonth();

        if (monthInput) {
            monthInput.value = month;
        }

        /* =====================================================
           LOAD STUDENTS
        ===================================================== */

        onSnapshot(
            collection(db, "students"),

            snapshot => {

                students = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                console.log(
                    "✅ Fee Management - Students loaded:",
                    students.length
                );

                render();
            },

            error => {

                console.error(
                    "❌ Students Firestore Error:",
                    error
                );

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load students.
                            Please check Firestore permissions.
                        </td>
                    </tr>
                `;
            }
        );

        /* =====================================================
           LOAD FEE RECORDS
        ===================================================== */

        onSnapshot(
            collection(db, "fees"),

            snapshot => {

                records = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                console.log(
                    "✅ Fee Management - Fee records loaded:",
                    records.length
                );

                render();
            },

            error => {

                console.error(
                    "❌ Fees Firestore Error:",
                    error
                );

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load fee records.
                            Please check Firestore rules.
                        </td>
                    </tr>
                `;
            }
        );

        /* =====================================================
           MONTH FILTER
        ===================================================== */

        if (monthInput) {

            monthInput.addEventListener("change", () => {

                month =
                    monthInput.value ||
                    currentMonth();

                render();
            });
        }

        /* =====================================================
           SEARCH
        ===================================================== */

        if (searchInput) {
            searchInput.addEventListener("input", render);
        }

        /* =====================================================
           STATUS FILTER
        ===================================================== */

        if (statusFilter) {
            statusFilter.addEventListener("change", render);
        }

        /* =====================================================
           RENDER
        ===================================================== */

        function render() {

            const search =
                searchInput
                    ? searchInput.value.toLowerCase().trim()
                    : "";

            const filter =
                statusFilter
                    ? statusFilter.value
                    : "all";

            const rows =
                students
                    .map(student => {

                        const payment =
                            records.find(record =>
                                record.studentDocId === student.id &&
                                record.month === month &&
                                record.status === "paid"
                            );

                        const lastPaid =
                            records
                                .filter(record =>
                                    record.studentDocId === student.id &&
                                    record.status === "paid" &&
                                    record.month
                                )
                                .sort((a, b) =>
                                    String(b.month).localeCompare(
                                        String(a.month)
                                    )
                                )[0];

                        return {
                            student,
                            payment,
                            lastPaid,
                            status: payment ? "paid" : "unpaid"
                        };
                    })

                    .filter(row => {

                        const student = row.student;

                        const searchableText = [
                            student.name,
                            student.studentId,
                            student.phone,
                            student.course,
                            student.batch,
                            student.fatherName
                        ]
                            .join(" ")
                            .toLowerCase();

                        const matchesSearch =
                            !search ||
                            searchableText.includes(search);

                        const matchesStatus =
                            filter === "all" ||
                            filter === row.status;

                        return matchesSearch && matchesStatus;
                    });

            /* =================================================
               SUMMARY
            ================================================= */

            const paidRecords =
                students
                    .map(student =>
                        records.find(record =>
                            record.studentDocId === student.id &&
                            record.month === month &&
                            record.status === "paid"
                        )
                    )
                    .filter(Boolean);

            const totalStudents =
                students.length;

            const paidStudents =
                paidRecords.length;

            const pendingStudents =
                Math.max(
                    totalStudents - paidStudents,
                    0
                );

            const collectedAmount =
                paidRecords.reduce(
                    (sum, record) =>
                        sum + Number(record.amount || 0),
                    0
                );

            if (totalEl) {
                totalEl.textContent = totalStudents;
            }

            if (paidEl) {
                paidEl.textContent = paidStudents;
            }

            if (pendingEl) {
                pendingEl.textContent = pendingStudents;
            }

            if (collectedEl) {
                collectedEl.textContent =
                    `₨ ${money(collectedAmount)}`;
            }

            /* =================================================
               TABLE
            ================================================= */

            tableBody.innerHTML =
                rows.length
                    ? rows.map(buildRow).join("")
                    : `
                        <tr>
                            <td colspan="9" class="empty">
                                No students found.
                            </td>
                        </tr>
                    `;

            /* =================================================
               ACTION BUTTONS
            ================================================= */

            tableBody
                .querySelectorAll("[data-fee-action]")
                .forEach(button => {

                    button.addEventListener("click", () => {

                        const student =
                            students.find(
                                item =>
                                    item.id ===
                                    button.dataset.studentId
                            );

                        if (!student) {

                            console.error(
                                "Student not found:",
                                button.dataset.studentId
                            );

                            return;
                        }

                        const action =
                            button.dataset.feeAction;

                        if (action === "paid") {
                            openPayment(student);
                        }

                        if (action === "undo") {
                            undoPayment(student);
                        }

                        if (action === "fee") {
                            setFee(student);
                        }

                        if (action === "history") {
                            history(student);
                        }
                    });
                });
        }

        /* =====================================================
           BUILD TABLE ROW
        ===================================================== */

        function buildRow({
            student,
            payment,
            lastPaid
        }) {

            const amount =
                Number(
                    payment?.amount ??
                    student.monthlyFee ??
                    0
                );

            return `
                <tr>

                    <td>
                        <strong>
                            ${esc(
                                student.studentId || "—"
                            )}
                        </strong>
                    </td>

                    <td>
                        <div class="fee-student-name">
                            ${esc(
                                student.name || "—"
                            )}
                        </div>

                        <div class="fee-student-phone">
                            ${esc(
                                student.phone || ""
                            )}
                        </div>
                    </td>

                    <td>
                        ${esc(
                            student.course || "—"
                        )}
                    </td>

                    <td>
                        ${esc(
                            student.batch || "—"
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
                            data-student-id="${escAttr(student.id)}"
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
                                        ● Unpaid
                                    </span>
                                `
                        }

                    </td>

                    <td>
                        ${
                            lastPaid
                                ? formatMonth(lastPaid.month)
                                : "—"
                        }
                    </td>

                    <td>
                        ${
                            payment?.paymentDate
                                ? formatDate(payment.paymentDate)
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
                                            class="fee-action danger"
                                            data-fee-action="undo"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            Undo
                                        </button>
                                    `
                                    : `
                                        <button
                                            type="button"
                                            class="fee-action success"
                                            data-fee-action="paid"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            ✓ Mark Paid
                                        </button>
                                    `
                            }

                            <button
                                type="button"
                                class="fee-action secondary"
                                data-fee-action="history"
                                data-student-id="${escAttr(student.id)}"
                            >
                                History
                            </button>

                        </div>

                    </td>

                </tr>
            `;
        }

        /* =====================================================
           SET MONTHLY FEE
        ===================================================== */

        async function setFee(student) {

            const value =
                prompt(
                    `Monthly fee for ${student.name}:`,
                    student.monthlyFee ?? ""
                );

            if (value === null) {
                return;
            }

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
                        monthlyFee: amount,
                        feeUpdatedAt: serverTimestamp()
                    }
                );

                toast("Monthly fee updated.");

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
           OPEN PAYMENT MODAL
        ===================================================== */

        function openPayment(student) {

            const existing =
                records.find(record =>
                    record.studentDocId === student.id &&
                    record.month === month
                );

            const overlay =
                document.createElement("div");

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
                                ${esc(student.name || "Student")}
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
                                        student.studentId || ""
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
                                        existing?.amount ??
                                        student.monthlyFee ??
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
                                    value="${formatMonth(month)}"
                                    disabled
                                >

                            </label>

                        </div>

                        <label class="fee-note-label">

                            Note (optional)

                            <textarea
                                name="note"
                                rows="3"
                                placeholder="e.g. Paid in cash"
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

            document.body.appendChild(overlay);

            const close = () =>
                overlay.remove();

            const closeButton =
                overlay.querySelector(
                    ".fee-modal-close"
                );

            const cancelButton =
                overlay.querySelector(
                    ".fee-cancel"
                );

            if (closeButton) {
                closeButton.onclick = close;
            }

            if (cancelButton) {
                cancelButton.onclick = close;
            }

            overlay.onclick = event => {

                if (event.target === overlay) {
                    close();
                }
            };

            const form =
                overlay.querySelector(
                    ".fee-payment-form"
                );

            form.onsubmit = async event => {

                event.preventDefault();

                const amount =
                    Number(
                        form.elements.amount.value
                    );

                const paymentDate =
                    form.elements.paymentDate.value;

                const note =
                    form.elements.note.value.trim();

                if (
                    !Number.isFinite(amount) ||
                    amount <= 0 ||
                    !paymentDate
                ) {

                    alert(
                        "Please enter a valid amount and payment date."
                    );

                    return;
                }

                const submit =
                    form.querySelector(
                        'button[type="submit"]'
                    );

                submit.disabled = true;
                submit.textContent = "Saving...";

                try {

                    const old =
                        records.find(record =>
                            record.studentDocId === student.id &&
                            record.month === month
                        );

                    const data = {

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
                            data
                        );

                    } else {

                        await addDoc(
                            collection(
                                db,
                                "fees"
                            ),
                            {
                                ...data,
                                createdAt:
                                    serverTimestamp()
                            }
                        );
                    }

                    if (
                        Number(
                            student.monthlyFee || 0
                        ) !== amount
                    ) {

                        await updateDoc(
                            doc(
                                db,
                                "students",
                                student.id
                            ),
                            {
                                monthlyFee: amount
                            }
                        );
                    }

                    close();

                    toast(
                        "Fee payment saved successfully."
                    );

                } catch (error) {

                    console.error(
                        "❌ PAYMENT SAVE ERROR:",
                        error
                    );

                    alert(
                        "Unable to save payment:\n\n" +
                        error.message
                    );

                    submit.disabled = false;
                    submit.textContent =
                        "Save Payment";
                }
            };
        }

        /* =====================================================
           UNDO PAYMENT
        ===================================================== */

        async function undoPayment(student) {

            const record =
                records.find(item =>
                    item.studentDocId === student.id &&
                    item.month === month
                );

            if (!record) {
                return;
            }

            const confirmed =
                confirm(
                    `Undo ${formatMonth(record.month)} fee payment for ${
                        student.name || "this student"
                    }?`
                );

            if (!confirmed) {
                return;
            }

            try {

                await deleteDoc(
                    doc(
                        db,
                        "fees",
                        record.id
                    )
                );

                toast(
                    "Payment marked as unpaid."
                );

            } catch (error) {

                console.error(
                    "Undo Payment Error:",
                    error
                );

                alert(
                    "Unable to undo payment:\n\n" +
                    error.message
                );
            }
        }

        /* =====================================================
           PAYMENT HISTORY
        ===================================================== */

        function history(student) {

            const list =
                records
                    .filter(record =>
                        record.studentDocId === student.id &&
                        record.status === "paid"
                    )
                    .sort((a, b) =>
                        String(b.month).localeCompare(
                            String(a.month)
                        )
                    );

            const overlay =
                document.createElement("div");

            overlay.className =
                "fee-modal-overlay";

            overlay.innerHTML = `

                <div class="fee-modal fee-history-modal">

                    <div class="fee-modal-head">

                        <div>

                            <div class="fee-modal-title">
                                Payment History
                            </div>

                            <div class="fee-modal-subtitle">
                                ${esc(student.name || "Student")}
                                •
                                ${esc(student.studentId || "")}
                            </div>

                        </div>

                        <button
                            type="button"
                            class="fee-modal-close"
                        >
                            ×
                        </button>

                    </div>

                    <div class="fee-history-body">

                        ${
                            list.length
                                ? list
                                    .map(record => `
                                        <div class="fee-history-item">

                                            <div>

                                                <strong>
                                                    ${formatMonth(
                                                        record.month
                                                    )}
                                                </strong>

                                                <span>
                                                    ${esc(
                                                        record.paymentDate ||
                                                        "—"
                                                    )}
                                                </span>

                                            </div>

                                            <strong>
                                                ₨ ${money(
                                                    record.amount
                                                )}
                                            </strong>

                                        </div>
                                    `)
                                    .join("")
                                : `
                                    <div class="fee-history-empty">
                                        No payment history found.
                                    </div>
                                `
                        }

                    </div>

                </div>
            `;

            document.body.appendChild(overlay);

            const close = () =>
                overlay.remove();

            const closeButton =
                overlay.querySelector(
                    ".fee-modal-close"
                );

            if (closeButton) {
                closeButton.onclick = close;
            }

            overlay.onclick = event => {

                if (event.target === overlay) {
                    close();
                }
            };
        }
    };

    /* =========================================================
       INITIALIZE AFTER DOM
    ========================================================= */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );

    } else {

        start();
    }

})();

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function currentMonth() {

    const date = new Date();

    return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0")
    );
}

function today() {

    const date = new Date();

    return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0")
    );
}

function formatMonth(value) {

    const [
        year,
        month
    ] = String(value || "").split("-");

    if (!year || !month) {
        return "—";
    }

    return new Date(
        Number(year),
        Number(month) - 1,
        1
    ).toLocaleDateString(
        "en-US",
        {
            month: "short",
            year: "numeric"
        }
    );
}

function formatDate(value) {

    const date =
        new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
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

function money(value) {

    return Number(value || 0)
        .toLocaleString("en-PK");
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function esc(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escAttr(value) {

    return esc(value)
        .replace(/`/g, "&#096;");
}

/* =========================================================
   TOAST
========================================================= */

function toast(message) {

    const old =
        document.querySelector(".fee-toast");

    if (old) {
        old.remove();
    }

    const notification =
        document.createElement("div");

    notification.className =
        "fee-toast show";

    notification.textContent =
        message;

    document.body.appendChild(
        notification
    );

    setTimeout(
        () => notification.remove(),
        2500
    );
}

/* =========================================================
   FEE MANAGEMENT STYLES
========================================================= */

function injectFeeStyles() {

    if (
        document.getElementById(
            "fee-management-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "fee-management-styles";

    style.textContent = `

        .fee-month-box {
            display: flex;
            align-items: center;
            gap: 9px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            padding: 8px 10px;
            border-radius: 10px;
        }

        .fee-month-box label {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
        }

        .fee-month-box input {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 10px;
            background: #fff;
            color: #172033;
            outline: none;
        }

        .fee-summary-grid {
            display: grid;
            grid-template-columns:
                repeat(4, minmax(0, 1fr));
            gap: 15px;
            margin: 0 0 20px;
        }

        .fee-summary-card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 17px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .fee-summary-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #eff6ff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
        }

        .fee-summary-icon.paid {
            background: #ecfdf5;
            color: #059669;
        }

        .fee-summary-icon.pending {
            background: #fff7ed;
            color: #ea580c;
        }

        .fee-summary-icon.amount {
            background: #f5f3ff;
            color: #6d28d9;
        }

        .fee-summary-card span {
            display: block;
            font-size: 11px;
            color: #64748b;
            margin-bottom: 5px;
        }

        .fee-summary-card strong {
            font-size: 21px;
            color: #111827;
        }

        .fee-tools {
            display: grid;
            grid-template-columns: 1fr 180px;
            gap: 10px;
            margin-bottom: 16px;
        }

        .fee-tools input,
        .fee-tools select {
            width: 100%;
            padding: 12px 13px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #fff;
            outline: none;
            font-size: 13px;
        }

        .fees-table {
            min-width: 1080px;
        }

        .fee-student-name {
            font-weight: 700;
            color: #172033;
        }

        .fee-student-phone {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 3px;
        }

        .fee-amount {
            font-weight: 800;
            color: #172554;
        }

        .fee-link-btn {
            border: 0;
            background: none;
            color: #2563eb;
            font-size: 10px;
            font-weight: 700;
            padding: 3px 0;
            cursor: pointer;
        }

        .fee-badge {
            display: inline-flex;
            padding: 6px 9px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 800;
        }

        .fee-badge.paid {
            background: #ecfdf5;
            color: #047857;
        }

        .fee-badge.unpaid {
            background: #fff7ed;
            color: #c2410c;
        }

        .fee-actions {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .fee-action {
            border: 0;
            border-radius: 7px;
            padding: 7px 9px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
        }

        .fee-action.success {
            background: #dcfce7;
            color: #166534;
        }

        .fee-action.danger {
            background: #fee2e2;
            color: #b91c1c;
        }

        .fee-action.secondary {
            background: #eff6ff;
            color: #1d4ed8;
        }

        .fee-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, .55);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 2000;
        }

        .fee-modal {
            width: 100%;
            max-width: 620px;
            background: #fff;
            border-radius: 18px;
            box-shadow:
                0 25px 70px rgba(0, 0, 0, .22);
            overflow: hidden;
        }

        .fee-history-modal {
            max-width: 520px;
        }

        .fee-modal-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 19px 21px;
            border-bottom: 1px solid #e5e7eb;
        }

        .fee-modal-title {
            font-size: 18px;
            font-weight: 800;
            color: #111827;
        }

        .fee-modal-subtitle {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }

        .fee-modal-close {
            width: 34px;
            height: 34px;
            border: 0;
            border-radius: 8px;
            background: #f3f4f6;
            color: #374151;
            font-size: 23px;
            cursor: pointer;
        }

        .fee-payment-form {
            padding: 21px;
        }

        .fee-form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }

        .fee-form-grid label,
        .fee-note-label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #374151;
        }

        .fee-form-grid input,
        .fee-note-label textarea {
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 10px 11px;
            outline: none;
            font: inherit;
            font-size: 13px;
            box-sizing: border-box;
        }

        .fee-note-label {
            margin-top: 14px;
        }

        .fee-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 9px;
            margin-top: 18px;
        }

        .fee-modal-actions button {
            border: 0;
            border-radius: 8px;
            padding: 10px 16px;
            cursor: pointer;
            font-weight: 700;
        }

        .secondary-btn {
            background: #f1f5f9;
            color: #334155;
        }

        .primary-btn {
            background: #4f46e5;
            color: #fff;
        }

        .primary-btn:disabled {
            opacity: .6;
            cursor: not-allowed;
        }

        .fee-history-body {
            padding: 18px 21px;
            max-height: 55vh;
            overflow: auto;
        }

        .fee-history-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 13px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            margin-bottom: 8px;
        }

        .fee-history-item strong {
            color: #172554;
            font-size: 12px;
        }

        .fee-history-item span {
            display: block;
            color: #64748b;
            font-size: 10px;
            margin-top: 3px;
        }

        .fee-history-empty {
            text-align: center;
            padding: 35px 15px;
            color: #94a3b8;
        }

        .fee-toast {
            position: fixed;
            right: 22px;
            bottom: 22px;
            z-index: 3000;
            background: #047857;
            color: #fff;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 700;
            box-shadow:
                0 10px 25px rgba(15, 23, 42, .18);
        }

        @media (max-width: 1000px) {

            .fee-summary-grid {
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
            }
        }

        @media (max-width: 650px) {

            .fee-summary-grid {
                grid-template-columns: 1fr;
            }

            .fee-tools {
                grid-template-columns: 1fr;
            }

            .fee-form-grid {
                grid-template-columns: 1fr;
            }

            .fee-modal-overlay {
                padding: 10px;
            }
        }

    `;

    document.head.appendChild(style);
}
