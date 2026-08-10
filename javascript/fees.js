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

(() => {

    const start = () => {

        const tableBody = document.getElementById("feesTableBody");

        if (!tableBody) {
            console.error("feesTableBody not found.");
            return;
        }

        injectFeeStyles();

        const monthInput = document.getElementById("feeMonth");
        const searchInput = document.getElementById("feeStudentSearch");
        const statusFilter = document.getElementById("feeStatusFilter");

        const totalEl = document.getElementById("feeTotalStudents");
        const paidEl = document.getElementById("feePaidStudents");
        const pendingEl = document.getElementById("feePendingStudents");
        const collectedEl = document.getElementById("feeCollectedAmount");

        let students = [];
        let records = [];

        let month = currentMonth();

        if (monthInput) {
            monthInput.value = month;
        }

        // =========================
        // LOAD STUDENTS
        // =========================

        onSnapshot(
            collection(db, "students"),
            (snap) => {

                students = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));

                console.log("Students loaded:", students.length);

                render();

            },
            (error) => {

                console.error("Students Firestore Error:", error);

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load students.
                        </td>
                    </tr>
                `;
            }
        );


        // =========================
        // LOAD FEES
        // =========================

        onSnapshot(
            collection(db, "fees"),
            (snap) => {

                records = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));

                console.log("Fee records loaded:", records.length);

                render();

            },
            (error) => {

                console.error("Fees Firestore Error:", error);

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load fee records.
                        </td>
                    </tr>
                `;
            }
        );


        // =========================
        // FILTERS
        // =========================

        if (monthInput) {
            monthInput.addEventListener("change", () => {

                month = monthInput.value || currentMonth();

                render();
            });
        }


        if (searchInput) {
            searchInput.addEventListener("input", render);
        }


        if (statusFilter) {
            statusFilter.addEventListener("change", render);
        }


        // =========================
        // RENDER
        // =========================

        function render() {

            const search = searchInput
                ? searchInput.value.toLowerCase().trim()
                : "";

            const filter = statusFilter
                ? statusFilter.value
                : "all";


            const rows = students
                .map(student => {

                    const payment = records.find(
                        r =>
                            r.studentDocId === student.id &&
                            r.month === month &&
                            r.status === "paid"
                    );


                    const lastPaid = records
                        .filter(
                            r =>
                                r.studentDocId === student.id &&
                                r.status === "paid" &&
                                r.month
                        )
                        .sort(
                            (a, b) =>
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

                    const s = row.student;

                    const text = [
                        s.name,
                        s.studentId,
                        s.phone,
                        s.course,
                        s.batch,
                        s.fatherName
                    ]
                        .join(" ")
                        .toLowerCase();


                    return (
                        (!search || text.includes(search)) &&
                        (filter === "all" || filter === row.status)
                    );

                });


            // SUMMARY

            const paid = students
                .map(s =>
                    records.find(
                        r =>
                            r.studentDocId === s.id &&
                            r.month === month &&
                            r.status === "paid"
                    )
                )
                .filter(Boolean);


            if (totalEl) {
                totalEl.textContent = students.length;
            }

            if (paidEl) {
                paidEl.textContent = paid.length;
            }

            if (pendingEl) {
                pendingEl.textContent =
                    Math.max(students.length - paid.length, 0);
            }

            if (collectedEl) {

                const total = paid.reduce(
                    (sum, r) =>
                        sum + Number(r.amount || 0),
                    0
                );

                collectedEl.textContent =
                    `₨ ${money(total)}`;
            }


            // TABLE

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


            // BUTTON EVENTS

            tableBody
                .querySelectorAll("[data-fee-action]")
                .forEach(btn => {

                    btn.addEventListener("click", () => {

                        const student = students.find(
                            s => s.id === btn.dataset.studentId
                        );

                        if (!student) {
                            console.error(
                                "Student not found:",
                                btn.dataset.studentId
                            );
                            return;
                        }


                        const action = btn.dataset.feeAction;


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


        // =========================
        // BUILD TABLE ROW
        // =========================

        function buildRow({ student, payment, lastPaid }) {

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
                            ${esc(student.studentId || "—")}
                        </strong>
                    </td>

                    <td>
                        <div class="fee-student-name">
                            ${esc(student.name || "—")}
                        </div>

                        <div class="fee-student-phone">
                            ${esc(student.phone || "")}
                        </div>
                    </td>

                    <td>
                        ${esc(student.course || "—")}
                    </td>

                    <td>
                        ${esc(student.batch || "—")}
                    </td>

                    <td>

                        <div class="fee-amount">
                            ₨ ${money(amount)}
                        </div>

                        <button
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
                                ? `<span class="fee-badge paid">
                                    ✓ Paid
                                   </span>`
                                : `<span class="fee-badge unpaid">
                                    ● Unpaid
                                   </span>`
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
                                            class="fee-action danger"
                                            data-fee-action="undo"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            Undo
                                        </button>
                                      `
                                    : `
                                        <button
                                            class="fee-action success"
                                            data-fee-action="paid"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            ✓ Mark Paid
                                        </button>
                                      `
                            }

                            <button
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


        // =========================
        // SET MONTHLY FEE
        // =========================

        async function setFee(student) {

            const value = prompt(
                `Monthly fee for ${student.name}:`,
                student.monthlyFee || ""
            );


            if (value === null) {
                return;
            }


            const amount = Number(
                String(value)
                    .replace(/,/g, "")
                    .trim()
            );


            if (!Number.isFinite(amount) || amount < 0) {

                alert(
                    "Please enter a valid fee amount."
                );

                return;
            }


            try {

                await updateDoc(
                    doc(db, "students", student.id),
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
                    "Unable to update fee: " +
                    error.message
                );
            }
        }


        // =========================
        // OPEN PAYMENT MODAL
        // =========================

        function openPayment(student) {

            console.log(
                "Opening payment for:",
                student
            );


            const existing = records.find(
                r =>
                    r.studentDocId === student.id &&
                    r.month === month
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
                                    value="${escAttr(student.studentId || "")}"
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
                                        student.monthlyFee ||
                                        existing?.amount ||
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


            overlay
                .querySelector(".fee-modal-close")
                .onclick = close;


            overlay
                .querySelector(".fee-cancel")
                .onclick = close;


            overlay.onclick = e => {

                if (e.target === overlay) {
                    close();
                }

            };


            // =========================
            // SAVE PAYMENT
            // =========================

            overlay
                .querySelector("form")
                .onsubmit = async e => {

                    e.preventDefault();


                    const form =
                        e.currentTarget;


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

                    submit.textContent =
                        "Saving...";


                    try {

                        console.log(
                            "Saving payment...",
                            {
                                student: student.id,
                                month,
                                amount,
                                paymentDate
                            }
                        );


                        const old =
                            records.find(
                                r =>
                                    r.studentDocId === student.id &&
                                    r.month === month
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

                            month:

                                month,

                            amount:

                                amount,

                            paymentDate:

                                paymentDate,

                            note:

                                note,

                            status:

                                "paid",

                            updatedAt:

                                serverTimestamp()

                        };


                        if (old) {

                            console.log(
                                "Updating existing fee:",
                                old.id
                            );


                            await updateDoc(
                                doc(
                                    db,
                                    "fees",
                                    old.id
                                ),
                                data
                            );

                        } else {

                            console.log(
                                "Creating new fee record"
                            );


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


                        // Update student's monthly fee

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
                                    monthlyFee:
                                        amount
                                }
                            );
                        }


                        close();

                        toast(
                            "Fee payment saved successfully."
                        );


                    } catch (error) {

                        console.error(
                            "PAYMENT SAVE ERROR:",
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

                };

        }


        // =========================
        // UNDO PAYMENT
        // =========================

        async function undoPayment(student) {

            const record =
                records.find(
                    r =>
                        r.studentDocId === student.id &&
                        r.month === month
                );


            if (!record) {
                return;
            }


            const confirmed =
                confirm(
                    `Undo ${formatMonth(record.month)} fee payment for ${student.name || "this student"}?`
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


        // =========================
        // PAYMENT HISTORY
        // =========================

        function history(student) {

            const list =
                records
                    .filter(
                        r =>
                            r.studentDocId === student.id &&
                            r.status === "paid"
                    )
                    .sort(
                        (a, b) =>
                            String(b.month)
                                .localeCompare(
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
                            class="fee-modal-close"
                        >
                            ×
                        </button>

                    </div>


                    <div class="fee-history-body">

                        ${
                            list.length

                                ? list.map(r => `

                                    <div class="fee-history-item">

                                        <div>

                                            <strong>
                                                ${formatMonth(r.month)}
                                            </strong>

                                            <span>
                                                ${esc(
                                                    r.paymentDate || "—"
                                                )}
                                            </span>

                                        </div>

                                        <strong>
                                            ₨ ${money(r.amount)}
                                        </strong>

                                    </div>

                                `).join("")

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


            overlay
                .querySelector(".fee-modal-close")
                .onclick = close;


            overlay.onclick = e => {

                if (e.target === overlay) {
                    close();
                }

            };
        }

    };


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


// ==========================================
// HELPER FUNCTIONS
// ==========================================

function currentMonth() {

    const d = new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;
}


function today() {

    const d = new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
}


function formatMonth(value) {

    const [year, month] =
        String(value || "").split("-");


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

    const d =
        new Date(`${value}T00:00:00`);


    if (Number.isNaN(d.getTime())) {
        return value;
    }


    return d.toLocaleDateString(
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


// IMPORTANT: Correct escaping function

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


function toast(message) {

    const old =
        document.querySelector(".fee-toast");

    if (old) {
        old.remove();
    }


    const n =
        document.createElement("div");

    n.className =
        "fee-toast show";

    n.textContent =
        message;

    document.body.appendChild(n);


    setTimeout(
        () => n.remove(),
        2500
    );
}


// ==========================================
// STYLES
// ==========================================

function injectFeeStyles() {

    if (
        document.getElementById(
            "fee-management-styles"
        )
    ) {
        return;
    }


    const s =
        document.createElement("style");


    s.id =
        "fee-management-styles";


    s.textContent = `

        .fee-month-box{
            display:flex;
            align-items:center;
            gap:9px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            padding:8px 10px;
            border-radius:10px;
        }

        .fee-month-box label{
            font-size:12px;
            font-weight:700;
            color:#475569;
        }

        .fee-month-box input{
            border:1px solid #cbd5e1;
            border-radius:8px;
            padding:8px 10px;
            background:#fff;
            color:#172033;
            outline:none;
        }

        .fee-summary-grid{
            display:grid;
            grid-template-columns:repeat(4,minmax(0,1fr));
            gap:15px;
            margin:0 0 20px;
        }

        .fee-summary-card{
            background:#fff;
            border:1px solid #e5e7eb;
            border-radius:14px;
            padding:17px;
            display:flex;
            align-items:center;
            gap:12px;
        }

        .fee-summary-icon{
            width:44px;
            height:44px;
            border-radius:12px;
            background:#eff6ff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:20px;
            flex-shrink:0;
        }

        .fee-summary-icon.paid{
            background:#ecfdf5;
            color:#059669;
        }

        .fee-summary-icon.pending{
            background:#fff7ed;
            color:#ea580c;
        }

        .fee-summary-icon.amount{
            background:#f5f3ff;
            color:#6d28d9;
        }

        .fee-summary-card span{
            display:block;
            font-size:11px;
            color:#64748b;
            margin-bottom:5px;
        }

        .fee-summary-card strong{
            font-size:21px;
            color:#111827;
        }

        .fee-tools{
            display:grid;
            grid-template-columns:1fr 180px;
            gap:10px;
            margin-bottom:16px;
        }

        .fee-tools input,
        .fee-tools select{
            width:100%;
            padding:12px 13px;
            border:1px solid #d1d5db;
            border-radius:9px;
            background:#fff;
            outline:none;
            font-size:13px;
        }

        .fees-table{
            min-width:1080px;
        }

        .fee-student-name{
            font-weight:700;
            color:#172033;
        }

        .fee-student-phone{
            font-size:10px;
            color:#94a3b8;
            margin-top:3px;
        }

        .fee-amount{
            font-weight:800;
            color:#172554;
        }

        .fee-link-btn{
            border:0;
            background:none;
            color:#2563eb;
            font-size:10px;
            font-weight:700;
            padding:3px 0;
            cursor:pointer;
        }

        .fee-badge{
            display:inline-flex;
            padding:6px 9px;
            border-radius:999px;
            font-size:10px;
            font-weight:800;
        }

        .fee-badge.paid{
            background:#ecfdf5;
            color:#047857;
        }

        .fee-badge.unpaid{
            background:#fff7ed;
            color:#c2410c;
        }

        .fee-actions{
            display:flex;
            gap:5px;
            flex-wrap:wrap;
        }

        .fee-action{
            border:0;
            border-radius:7px;
            padding:7px 9px;
            font-size:10px;
            font-weight:800;
            cursor:pointer;
        }

        .fee-action.success{
            background:#dcfce7;
            color:#166534;
        }

        .fee-action.danger{
            background:#fee2e2;
            color:#b91c1c;
        }

        .fee-action.secondary{
            background:#eff6ff;
            color:#1d4ed8;
        }

        .fee-modal-overlay{
            position:fixed;
            inset:0;
            background:rgba(15,23,42,.55);
            backdrop-filter:blur(4px);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
            z-index:2000;
        }

        .fee-modal{
            width:100%;
            max-width:620px;
            background:#fff;
            border-radius:18px;
            box-shadow:0 25px 70px rgba(0,0,0,.22);
            overflow:hidden;
        }

        .fee-history-modal{
            max-width:520px;
        }

        .fee-modal-head{
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:19px 21px;
            border-bottom:1px solid #e5e7eb;
        }

        .fee-modal-title{
            font-size:18px;
            font-weight:800;
            color:#111827;
        }

        .fee-modal-subtitle{
            font-size:11px;
            color:#64748b;
            margin-top:4px;
        }

        .fee-modal-close{
            width:34px;
            height:34px;
            border:0;
            border-radius:8px;
            background:#f3f4f6;
            color:#374151;
            font-size:23px;
            cursor:pointer;
        }

        .fee-payment-form{
            padding:21px;
        }

        .fee-form-grid{
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:14px;
        }

        .fee-form-grid label,
        .fee-note-label{
            display:flex;
            flex-direction:column;
            gap:6px;
            font-size:11px;
            font-weight:700;
            color:#374151;
        }

        .fee-form-grid input,
        .fee-note-label textarea{
            width:100%;
            border:1px solid #d1d5db;
            border-radius:8px;
            padding:10px 11px;
            outline:none;
            font:inherit;
            font-size:13px;
        }

        .fee-note-label{
            margin-top:14px;
        }

        .fee-modal-actions{
            display:flex;
            justify-content:flex-end;
            gap:9px;
            margin-top:18px;
        }

        .fee-modal-actions button{
            border:0;
            border-radius:8px;
            padding:10px 16px;
            cursor:pointer;
            font-weight:700;
        }

        .secondary-btn{
            background:#f1f5f9;
            color:#334155;
        }

        .primary-btn{
            background:#4f46e5;
            color:#fff;
        }

        .primary-btn:disabled{
            opacity:.6;
            cursor:not-allowed;
        }

        .fee-history-body{
            padding:18px 21px;
            max-height:55vh;
            overflow:auto;
        }

        .fee-history-item{
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:12px 13px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
            margin-bottom:8px;
        }

        .fee-history-item strong{
            color:#172554;
            font-size:12px;
        }

        .fee-history-item span{
            display:block;
            color:#64748b;
            font-size:10px;
            margin-top:3px;
        }

        .fee-history-empty{
            text-align:center;
            padding:35px 15px;
            color:#94a3b8;
        }

        .fee-toast{
            position:fixed;
            right:22px;
            bottom:22px;
            z-index:3000;
            background:#047857;
            color:#fff;
            padding:12px 16px;
            border-radius:10px;
            font-size:12px;
            font-weight:700;
            box-shadow:0 10px 25px rgba(15,23,42,.18);
        }

        @media(max-width:1000px){

            .fee-summary-grid{
                grid-template-columns:repeat(2,minmax(0,1fr));
            }

        }

        @media(max-width:650px){

            .fee-summary-grid{
                grid-template-columns:1fr;
            }

            .fee-tools{
                grid-template-columns:1fr;
            }

            .fee-form-grid{
                grid-template-columns:1fr;
            }

            .fee-modal-overlay{
                padding:10px;
            }

        }

    `;


    document.head.appendChild(s);
}import { db } from "../firebase/firebase-config.js";

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


(() => {

    const start = () => {

        const tableBody = document.getElementById("feesTableBody");
        if (!tableBody) return;

        injectFeeStyles();

        const monthInput = document.getElementById("feeMonth");
        const searchInput = document.getElementById("feeStudentSearch");
        const statusFilter = document.getElementById("feeStatusFilter");

        const totalEl = document.getElementById("feeTotalStudents");
        const paidEl = document.getElementById("feePaidStudents");
        const pendingEl = document.getElementById("feePendingStudents");
        const collectedEl = document.getElementById("feeCollectedAmount");

        let students = [];
        let records = [];
        let month = currentMonth();

        if (monthInput) {
            monthInput.value = month;
        }


        // ==============================
        // LOAD STUDENTS
        // ==============================

        onSnapshot(
            collection(db, "students"),
            snap => {

                students = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));

                render();

            },
            err => {

                console.error("Students load error:", err);

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load students.
                        </td>
                    </tr>
                `;

            }
        );


        // ==============================
        // LOAD FEES
        // ==============================

        onSnapshot(
            collection(db, "fees"),
            snap => {

                records = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));

                render();

            },
            err => {

                console.error("Fees load error:", err);

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load fee records.
                            Check Firestore rules.
                        </td>
                    </tr>
                `;

            }
        );


        // ==============================
        // EVENTS
        // ==============================

        if (monthInput) {
            monthInput.addEventListener("change", () => {

                month = monthInput.value || currentMonth();

                render();

            });
        }


        if (searchInput) {
            searchInput.addEventListener("input", render);
        }


        if (statusFilter) {
            statusFilter.addEventListener("change", render);
        }


        // ==============================
        // RENDER
        // ==============================

        function render() {

            const search = searchInput
                ? searchInput.value.toLowerCase().trim()
                : "";

            const filter = statusFilter
                ? statusFilter.value
                : "all";


            const rows = students
                .map(student => {

                    const payment = records.find(
                        r =>
                            r.studentDocId === student.id &&
                            r.month === month &&
                            r.status === "paid"
                    );


                    const lastPaid = records
                        .filter(
                            r =>
                                r.studentDocId === student.id &&
                                r.status === "paid" &&
                                r.month
                        )
                        .sort(
                            (a, b) =>
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

                    const s = row.student;

                    const text = [
                        s.name,
                        s.studentId,
                        s.phone,
                        s.course,
                        s.batch,
                        s.fatherName
                    ]
                        .join(" ")
                        .toLowerCase();


                    return (
                        (!search || text.includes(search)) &&
                        (filter === "all" || filter === row.status)
                    );

                });


            // ==============================
            // SUMMARY
            // ==============================

            const paid = students
                .map(s =>
                    records.find(
                        r =>
                            r.studentDocId === s.id &&
                            r.month === month &&
                            r.status === "paid"
                    )
                )
                .filter(Boolean);


            if (totalEl) {
                totalEl.textContent = students.length;
            }

            if (paidEl) {
                paidEl.textContent = paid.length;
            }

            if (pendingEl) {
                pendingEl.textContent =
                    Math.max(students.length - paid.length, 0);
            }

            if (collectedEl) {

                const total = paid.reduce(
                    (sum, r) =>
                        sum + Number(r.amount || 0),
                    0
                );

                collectedEl.textContent =
                    `₨ ${money(total)}`;
            }


            // ==============================
            // TABLE
            // ==============================

            tableBody.innerHTML = rows.length
                ? rows.map(buildRow).join("")
                : `
                    <tr>
                        <td colspan="9" class="empty">
                            No students found.
                        </td>
                    </tr>
                `;


            // ==============================
            // BUTTON EVENTS
            // ==============================

            tableBody
                .querySelectorAll("[data-fee-action]")
                .forEach(btn => {

                    btn.addEventListener("click", () => {

                        const student = students.find(
                            s =>
                                s.id ===
                                btn.dataset.studentId
                        );

                        if (!student) return;


                        const action =
                            btn.dataset.feeAction;


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


        // ==============================
        // BUILD TABLE ROW
        // ==============================

        function buildRow({ student, payment, lastPaid }) {

            const amount = Number(
                student.monthlyFee ||
                payment?.amount ||
                0
            );


            return `
                <tr>

                    <td>
                        <strong>
                            ${esc(student.studentId || "—")}
                        </strong>
                    </td>


                    <td>
                        <div class="fee-student-name">
                            ${esc(student.name || "—")}
                        </div>

                        <div class="fee-student-phone">
                            ${esc(student.phone || "")}
                        </div>
                    </td>


                    <td>
                        ${esc(student.course || "—")}
                    </td>


                    <td>
                        ${esc(student.batch || "—")}
                    </td>


                    <td>

                        <div class="fee-amount">
                            ₨ ${money(amount)}
                        </div>

                        <button
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
                                            class="fee-action danger"
                                            data-fee-action="undo"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            Undo
                                        </button>
                                      `
                                    : `
                                        <button
                                            class="fee-action success"
                                            data-fee-action="paid"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            ✓ Mark Paid
                                        </button>
                                      `
                            }


                            <button
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


        // ==============================
        // SET MONTHLY FEE
        // ==============================

        async function setFee(student) {

            const value = prompt(
                `Monthly fee for ${student.name}:`,
                student.monthlyFee || ""
            );


            if (value === null) return;


            const amount = Number(
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
                    doc(db, "students", student.id),
                    {
                        monthlyFee: amount,
                        feeUpdatedAt: serverTimestamp()
                    }
                );


                toast(
                    "Monthly fee updated successfully."
                );

            } catch (e) {

                console.error(
                    "Set fee error:",
                    e
                );

                alert(
                    "Unable to update fee: " +
                    e.message
                );

            }

        }


        // ==============================
        // OPEN PAYMENT MODAL
        // ==============================

        function openPayment(student) {

            const existing = records.find(
                r =>
                    r.studentDocId === student.id &&
                    r.month === month
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
                                        student.monthlyFee ||
                                        existing?.amount ||
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


            overlay
                .querySelector(".fee-modal-close")
                .onclick = close;


            overlay
                .querySelector(".fee-cancel")
                .onclick = close;


            overlay.onclick = e => {

                if (e.target === overlay) {
                    close();
                }

            };


            // ==============================
            // SAVE PAYMENT
            // ==============================

            overlay
                .querySelector("form")
                .onsubmit = async e => {

                    e.preventDefault();


                    const form =
                        e.currentTarget;


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
                            "button[type=submit]"
                        );


                    submit.disabled = true;
                    submit.textContent = "Saving...";


                    try {

                        const old =
                            records.find(
                                r =>
                                    r.studentDocId ===
                                        student.id &&
                                    r.month === month
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

                            status: "paid",

                            updatedAt:
                                serverTimestamp()

                        };


                        // Existing record
                        if (old) {

                            await updateDoc(
                                doc(
                                    db,
                                    "fees",
                                    old.id
                                ),
                                data
                            );

                        }

                        // New record
                        else {

                            await addDoc(
                                collection(db, "fees"),
                                {
                                    ...data,
                                    createdAt:
                                        serverTimestamp()
                                }
                            );

                        }


                        // Update student's monthly fee
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
                                    monthlyFee:
                                        amount
                                }
                            );

                        }


                        close();


                        toast(
                            "Fee payment saved successfully."
                        );


                    } catch (err) {

                        console.error(
                            "SAVE PAYMENT ERROR:",
                            err
                        );


                        alert(
                            "Unable to save payment:\n\n" +
                            err.message
                        );


                        submit.disabled = false;
                        submit.textContent =
                            "Save Payment";

                    }

                };

        }


        // ==============================
        // UNDO PAYMENT
        // ==============================

        async function undoPayment(student) {

            const record =
                records.find(
                    r =>
                        r.studentDocId ===
                            student.id &&
                        r.month === month
                );


            if (!record) return;


            if (
                !confirm(
                    `Undo ${formatMonth(record.month)} fee payment for ${student.name || "this student"}?`
                )
            ) {
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


            } catch (e) {

                console.error(
                    "Undo payment error:",
                    e
                );


                alert(
                    "Unable to undo payment: " +
                    e.message
                );

            }

        }


        // ==============================
        // PAYMENT HISTORY
        // ==============================

        function history(student) {

            const list =
                records
                    .filter(
                        r =>
                            r.studentDocId ===
                                student.id &&
                            r.status === "paid"
                    )
                    .sort(
                        (a, b) =>
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
                                ${esc(student.name || "")}
                                •
                                ${esc(student.studentId || "")}
                            </div>

                        </div>


                        <button
                            class="fee-modal-close"
                        >
                            ×
                        </button>

                    </div>


                    <div class="fee-history-body">

                        ${
                            list.length

                                ? list
                                    .map(
                                        r => `

                                        <div class="fee-history-item">

                                            <div>

                                                <strong>
                                                    ${formatMonth(
                                                        r.month
                                                    )}
                                                </strong>

                                                <span>
                                                    ${esc(
                                                        r.paymentDate ||
                                                        "—"
                                                    )}
                                                </span>

                                            </div>


                                            <strong>
                                                ₨ ${money(r.amount)}
                                            </strong>

                                        </div>

                                    `
                                    )
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


            document.body.appendChild(
                overlay
            );


            const close = () =>
                overlay.remove();


            overlay
                .querySelector(
                    ".fee-modal-close"
                )
                .onclick = close;


            overlay.onclick = e => {

                if (e.target === overlay) {
                    close();
                }

            };

        }

    };


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );

    } else {

        start();

    }

})();


// ==========================================
// HELPERS
// ==========================================

function currentMonth() {

    const d = new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;

}


function today() {

    const d = new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;

}


function formatMonth(v) {

    const [y, m] =
        String(v || "").split("-");


    return y && m
        ? new Date(
            Number(y),
            Number(m) - 1,
            1
        ).toLocaleDateString(
            "en-US",
            {
                month: "short",
                year: "numeric"
            }
        )
        : "—";

}


function formatDate(v) {

    const d =
        new Date(`${v}T00:00:00`);


    return Number.isNaN(d.getTime())
        ? v
        : d.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

}


function money(v) {

    return Number(v || 0)
        .toLocaleString("en-PK");

}


// IMPORTANT: Fixed escaping function
function esc(v) {

    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}


function escAttr(v) {

    return esc(v)
        .replace(/`/g, "&#096;");

}


function toast(message) {

    const old =
        document.querySelector(
            ".fee-toast"
        );

    old?.remove();


    const n =
        document.createElement("div");


    n.className =
        "fee-toast show";


    n.textContent =
        message;


    document.body.appendChild(n);


    setTimeout(
        () => n.remove(),
        2500
    );

}


// ==========================================
// FEE MANAGEMENT CSS
// ==========================================

function injectFeeStyles() {

    if (
        document.getElementById(
            "fee-management-styles"
        )
    ) {
        return;
    }


    const s =
        document.createElement("style");


    s.id =
        "fee-management-styles";


    s.textContent = `

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
            grid-template-columns: repeat(
                4,
                minmax(0, 1fr)
            );
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
            background: rgba(15,23,42,.55);
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
            box-shadow: 0 25px 70px rgba(0,0,0,.22);
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
            box-shadow: 0 10px 25px rgba(15,23,42,.18);
        }


        @media (max-width: 1000px) {

            .fee-summary-grid {
                grid-template-columns:
                    repeat(2, minmax(0,1fr));
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


    document.head.appendChild(s);

}import { db } from "../firebase/firebase-config.js";
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
    const start = () => {
        const tableBody = document.getElementById("feesTableBody");
        if (!tableBody) return;
        injectFeeStyles();
        const monthInput = document.getElementById("feeMonth");
        const searchInput = document.getElementById("feeStudentSearch");
        const statusFilter = document.getElementById("feeStatusFilter");
        const totalEl = document.getElementById("feeTotalStudents");
        const paidEl = document.getElementById("feePaidStudents");
        const pendingEl = document.getElementById("feePendingStudents");
        const collectedEl = document.getElementById("feeCollectedAmount");
        let students = [];
        let records = [];
        let month = currentMonth();
        monthInput.value = month;

        onSnapshot(collection(db, "students"), snap => {
            students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            render();
        }, err => {
            console.error(err);
            tableBody.innerHTML = `<tr><td colspan="9" class="empty">Unable to load students.</td></tr>`;
        });

        onSnapshot(collection(db, "fees"), snap => {
            records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            render();
        }, err => {
            console.error(err);
            tableBody.innerHTML = `<tr><td colspan="9" class="empty">Unable to load fee records. Check Firestore rules.</td></tr>`;
        });

        monthInput.addEventListener("change", () => { month = monthInput.value || currentMonth(); render(); });
        searchInput.addEventListener("input", render);
        statusFilter.addEventListener("change", render);

        function render() {
            const search = searchInput.value.toLowerCase().trim();
            const filter = statusFilter.value;
            const rows = students.map(student => {
                const payment = records.find(r => r.studentDocId === student.id && r.month === month && r.status === "paid");
                const lastPaid = records.filter(r => r.studentDocId === student.id && r.status === "paid" && r.month).sort((a,b) => String(b.month).localeCompare(String(a.month)))[0];
                return { student, payment, lastPaid, status: payment ? "paid" : "unpaid" };
            }).filter(row => {
                const s = row.student;
                const text = [s.name,s.studentId,s.phone,s.course,s.batch,s.fatherName].join(" ").toLowerCase();
                return (!search || text.includes(search)) && (filter === "all" || filter === row.status);
            });

            const paid = students.map(s => records.find(r => r.studentDocId === s.id && r.month === month && r.status === "paid")).filter(Boolean);
            totalEl.textContent = students.length;
            paidEl.textContent = paid.length;
            pendingEl.textContent = Math.max(students.length - paid.length, 0);
            collectedEl.textContent = `₨ ${money(paid.reduce((sum,r) => sum + Number(r.amount || 0), 0))}`;

            tableBody.innerHTML = rows.length ? rows.map(buildRow).join("") : `<tr><td colspan="9" class="empty">No students found.</td></tr>`;
            tableBody.querySelectorAll("[data-fee-action]").forEach(btn => btn.addEventListener("click", () => {
                const student = students.find(s => s.id === btn.dataset.studentId);
                if (!student) return;
                if (btn.dataset.feeAction === "paid") openPayment(student);
                if (btn.dataset.feeAction === "undo") undoPayment(student);
                if (btn.dataset.feeAction === "fee") setFee(student);
                if (btn.dataset.feeAction === "history") history(student);
            }));
        }

        function buildRow({student,payment,lastPaid}) {
            const amount = Number(student.monthlyFee || payment?.amount || 0);
            return `<tr>
                <td><strong>${esc(student.studentId || "—")}</strong></td>
                <td><div class="fee-student-name">${esc(student.name || "—")}</div><div class="fee-student-phone">${esc(student.phone || "")}</div></td>
                <td>${esc(student.course || "—")}</td><td>${esc(student.batch || "—")}</td>
                <td><div class="fee-amount">₨ ${money(amount)}</div><button class="fee-link-btn" data-fee-action="fee" data-student-id="${escAttr(student.id)}">Set Fee</button></td>
                <td>${payment ? '<span class="fee-badge paid">✓ Paid</span>' : '<span class="fee-badge unpaid">● Unpaid</span>'}</td>
                <td>${lastPaid ? formatMonth(lastPaid.month) : "—"}</td>
                <td>${payment?.paymentDate ? formatDate(payment.paymentDate) : "—"}</td>
                <td><div class="fee-actions">${payment ? `<button class="fee-action danger" data-fee-action="undo" data-student-id="${escAttr(student.id)}">Undo</button>` : `<button class="fee-action success" data-fee-action="paid" data-student-id="${escAttr(student.id)}">✓ Mark Paid</button>`}<button class="fee-action secondary" data-fee-action="history" data-student-id="${escAttr(student.id)}">History</button></div></td>
            </tr>`;
        }

        async function setFee(student) {
            const value = prompt(`Monthly fee for ${student.name}:`, student.monthlyFee || "");
            if (value === null) return;
            const amount = Number(String(value).replace(/,/g, "").trim());
            if (!Number.isFinite(amount) || amount < 0) return alert("Please enter a valid fee amount.");
            try { await updateDoc(doc(db,"students",student.id),{monthlyFee:amount,feeUpdatedAt:serverTimestamp()}); toast("Monthly fee updated."); }
            catch(e){ console.error(e); alert("Unable to update fee: " + e.message); }
        }

        function openPayment(student) {
            const existing = records.find(r => r.studentDocId === student.id && r.month === month);
            const overlay = document.createElement("div");
            overlay.className = "fee-modal-overlay";
            overlay.innerHTML = `<div class="fee-modal">
                <div class="fee-modal-head"><div><div class="fee-modal-title">Mark Fee Paid</div><div class="fee-modal-subtitle">${esc(student.name || "Student")} • ${formatMonth(month)}</div></div><button type="button" class="fee-modal-close">×</button></div>
                <form class="fee-payment-form"><div class="fee-form-grid">
                    <label>Student ID<input value="${escAttr(student.studentId || "")}" disabled></label>
                    <label>Amount (PKR)<input name="amount" type="number" min="1" step="1" value="${Number(student.monthlyFee || existing?.amount || 0)}" required></label>
                    <label>Payment Date<input name="paymentDate" type="date" value="${today()}" required></label>
                    <label>Month<input value="${formatMonth(month)}" disabled></label>
                </div><label class="fee-note-label">Note (optional)<textarea name="note" rows="3" placeholder="e.g. Paid in cash"></textarea></label>
                <div class="fee-modal-actions"><button type="button" class="secondary-btn fee-cancel">Cancel</button><button type="submit" class="primary-btn">Save Payment</button></div></form>
            </div>`;
            document.body.appendChild(overlay);
            const close = () => overlay.remove();
            overlay.querySelector(".fee-modal-close").onclick = close;
            overlay.querySelector(".fee-cancel").onclick = close;
            overlay.onclick = e => { if (e.target === overlay) close(); };
            overlay.querySelector("form").onsubmit = async e => {
                e.preventDefault();
                const form=e.currentTarget, amount=Number(form.elements.amount.value), paymentDate=form.elements.paymentDate.value, note=form.elements.note.value.trim();
                if (!Number.isFinite(amount) || amount <= 0 || !paymentDate) return alert("Please enter a valid amount and payment date.");
                const submit=form.querySelector("button[type=submit]"); submit.disabled=true; submit.textContent="Saving...";
                try {
                    const old=records.find(r=>r.studentDocId===student.id && r.month===month);
                    const data={studentDocId:student.id,studentId:student.studentId||"",studentName:student.name||"",course:student.course||"",batch:student.batch||"",month,amount,paymentDate,note,status:"paid",updatedAt:serverTimestamp()};
                    if(old) await updateDoc(doc(db,"fees",old.id),data); else await addDoc(collection(db,"fees"),{...data,createdAt:serverTimestamp()});
                    if(Number(student.monthlyFee||0)!==amount) await updateDoc(doc(db,"students",student.id),{monthlyFee:amount});
                    close(); toast("Fee payment saved successfully.");
                } catch(err){ console.error(err); alert("Unable to save payment: " + err.message); submit.disabled=false; submit.textContent="Save Payment"; }
            };
        }

        async function undoPayment(student) {
            const record=records.find(r=>r.studentDocId===student.id && r.month===month);
            if(!record) return;
            if(!confirm(`Undo ${formatMonth(record.month)} fee payment for ${student.name || "this student"}?`)) return;
            try{ await deleteDoc(doc(db,"fees",record.id)); toast("Payment marked as unpaid."); }
            catch(e){ console.error(e); alert("Unable to undo payment: " + e.message); }
        }

        function history(student) {
            const list=records.filter(r=>r.studentDocId===student.id && r.status==="paid").sort((a,b)=>String(b.month).localeCompare(String(a.month)));
            const overlay=document.createElement("div"); overlay.className="fee-modal-overlay";
            overlay.innerHTML=`<div class="fee-modal fee-history-modal"><div class="fee-modal-head"><div><div class="fee-modal-title">Payment History</div><div class="fee-modal-subtitle">${esc(student.name||"Student")} • ${esc(student.studentId||"")}</div></div><button class="fee-modal-close">×</button></div><div class="fee-history-body">${list.length?list.map(r=>`<div class="fee-history-item"><div><strong>${formatMonth(r.month)}</strong><span>${esc(r.paymentDate||"—")}</span></div><strong>₨ ${money(r.amount)}</strong></div>`).join(""):'<div class="fee-history-empty">No payment history found.</div>'}</div></div>`;
            document.body.appendChild(overlay); const close=()=>overlay.remove(); overlay.querySelector(".fee-modal-close").onclick=close; overlay.onclick=e=>{if(e.target===overlay)close();};
        }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();

function currentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function formatMonth(v){const [y,m]=String(v||"").split("-");return y&&m?new Date(Number(y),Number(m)-1,1).toLocaleDateString("en-US",{month:"short",year:"numeric"}):"—";}
function formatDate(v){const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
function money(v){return Number(v||0).toLocaleString("en-PK");}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
function escAttr(v){return esc(v).replace(/`/g,"&#096;");}
function toast(message){const old=document.querySelector(".fee-toast");old?.remove();const n=document.createElement("div");n.className="fee-toast show";n.textContent=message;document.body.appendChild(n);setTimeout(()=>n.remove(),2500);}
function injectFeeStyles(){if(document.getElementById("fee-management-styles"))return;const s=document.createElement("style");s.id="fee-management-styles";s.textContent=`
.fee-month-box{display:flex;align-items:center;gap:9px;background:#f8fafc;border:1px solid #e5e7eb;padding:8px 10px;border-radius:10px}.fee-month-box label{font-size:12px;font-weight:700;color:#475569}.fee-month-box input{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;background:#fff;color:#172033;outline:none}
.fee-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin:0 0 20px}.fee-summary-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:17px;display:flex;align-items:center;gap:12px}.fee-summary-icon{width:44px;height:44px;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}.fee-summary-icon.paid{background:#ecfdf5;color:#059669}.fee-summary-icon.pending{background:#fff7ed;color:#ea580c}.fee-summary-icon.amount{background:#f5f3ff;color:#6d28d9}.fee-summary-card span{display:block;font-size:11px;color:#64748b;margin-bottom:5px}.fee-summary-card strong{font-size:21px;color:#111827}
.fee-tools{display:grid;grid-template-columns:1fr 180px;gap:10px;margin-bottom:16px}.fee-tools input,.fee-tools select{width:100%;padding:12px 13px;border:1px solid #d1d5db;border-radius:9px;background:#fff;outline:none;font-size:13px}.fees-table{min-width:1080px}.fee-student-name{font-weight:700;color:#172033}.fee-student-phone{font-size:10px;color:#94a3b8;margin-top:3px}.fee-amount{font-weight:800;color:#172554}.fee-link-btn{border:0;background:none;color:#2563eb;font-size:10px;font-weight:700;padding:3px 0;cursor:pointer}.fee-badge{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:800}.fee-badge.paid{background:#ecfdf5;color:#047857}.fee-badge.unpaid{background:#fff7ed;color:#c2410c}.fee-actions{display:flex;gap:5px;flex-wrap:wrap}.fee-action{border:0;border-radius:7px;padding:7px 9px;font-size:10px;font-weight:800;cursor:pointer}.fee-action.success{background:#dcfce7;color:#166534}.fee-action.danger{background:#fee2e2;color:#b91c1c}.fee-action.secondary{background:#eff6ff;color:#1d4ed8}
.fee-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:2000}.fee-modal{width:100%;max-width:620px;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.22);overflow:hidden}.fee-history-modal{max-width:520px}.fee-modal-head{display:flex;justify-content:space-between;align-items:center;padding:19px 21px;border-bottom:1px solid #e5e7eb}.fee-modal-title{font-size:18px;font-weight:800;color:#111827}.fee-modal-subtitle{font-size:11px;color:#64748b;margin-top:4px}.fee-modal-close{width:34px;height:34px;border:0;border-radius:8px;background:#f3f4f6;color:#374151;font-size:23px;cursor:pointer}.fee-payment-form{padding:21px}.fee-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fee-form-grid label,.fee-note-label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:700;color:#374151}.fee-form-grid input,.fee-note-label textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 11px;outline:none;font:inherit;font-size:13px}.fee-note-label{margin-top:14px}.fee-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.fee-history-body{padding:18px 21px;max-height:55vh;overflow:auto}.fee-history-item{display:flex;align-items:center;justify-content:space-between;padding:12px 13px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px}.fee-history-item strong{color:#172554;font-size:12px}.fee-history-item span{display:block;color:#64748b;font-size:10px;margin-top:3px}.fee-history-empty{text-align:center;padding:35px 15px;color:#94a3b8}.fee-toast{position:fixed;right:22px;bottom:22px;z-index:3000;background:#047857;color:#fff;padding:12px 16px;border-radius:10px;font-size:12px;font-weight:700;box-shadow:0 10px 25px rgba(15,23,42,.18)}
@media(max-width:1000px){.fee-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.fee-summary-grid{grid-template-columns:1fr}.fee-tools{grid-template-columns:1fr}.fee-form-grid{grid-template-columns:1fr}.fee-modal-overlay{padding:10px}}
`;document.head.appendChild(s);}
