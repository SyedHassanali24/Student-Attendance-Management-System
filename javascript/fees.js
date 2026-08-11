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
   Paid + History + Fee Slip + WhatsApp
========================================================= */

(() => {

    let started = false;

    const start = () => {

        if (started) return;
        started = true;

        const tableBody =
            document.getElementById("feesTableBody");

        if (!tableBody) {
            console.error("❌ feesTableBody not found.");
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

        let students = [];
        let records = [];
        let month = currentMonth();

        if (monthInput) {
            monthInput.value = month;
        }

        /* =====================================================
           STUDENTS
        ===================================================== */

        onSnapshot(
            collection(db, "students"),
            snapshot => {

                students = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                render();
            },
            error => {

                console.error("Students Error:", error);

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load students.
                        </td>
                    </tr>
                `;
            }
        );

        /* =====================================================
           FEES
        ===================================================== */

        onSnapshot(
            collection(db, "fees"),
            snapshot => {

                records = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                render();
            },
            error => {

                console.error("Fees Error:", error);

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="empty">
                            Unable to load fee records.
                        </td>
                    </tr>
                `;
            }
        );

        if (monthInput) {
            monthInput.addEventListener("change", () => {
                month =
                    monthInput.value ||
                    currentMonth();

                render();
            });
        }

        if (searchInput) {
            searchInput.addEventListener("input", render);
        }

        if (statusFilter) {
            statusFilter.addEventListener("change", render);
        }

        /* =====================================================
           RENDER
        ===================================================== */

        function render() {

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

            const rows = students
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
                        status: payment
                            ? "paid"
                            : "unpaid"
                    };
                })
                .filter(row => {

                    const student = row.student;

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

                    return searchMatch && statusMatch;
                });

            /* SUMMARY */

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

            const total =
                students.length;

            const paid =
                paidRecords.length;

            const pending =
                Math.max(total - paid, 0);

            const collected =
                paidRecords.reduce(
                    (sum, record) =>
                        sum + Number(record.amount || 0),
                    0
                );

            if (totalEl) {
                totalEl.textContent = total;
            }

            if (paidEl) {
                paidEl.textContent = paid;
            }

            if (pendingEl) {
                pendingEl.textContent = pending;
            }

            if (collectedEl) {
                collectedEl.textContent =
                    `₨ ${money(collected)}`;
            }

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

            /* BUTTON EVENTS */

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

                        if (!student) return;

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
                            showHistory(student);
                        }

                        if (action === "slip") {
                            showSlip(student);
                        }
                    });
                });
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
                                            class="fee-action danger"
                                            data-fee-action="undo"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            Undo
                                        </button>

                                        <button
                                            type="button"
                                            class="fee-action secondary"
                                            data-fee-action="slip"
                                            data-student-id="${escAttr(student.id)}"
                                        >
                                            Slip
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
           SET FEE
        ===================================================== */

        async function setFee(student) {

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
                alert("Please enter a valid fee amount.");
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
                        feeUpdatedAt:
                            serverTimestamp()
                    }
                );

                toast("Monthly fee updated.");

            } catch (error) {

                console.error(error);

                alert(
                    "Unable to update fee:\n\n" +
                    error.message
                );
            }
        }

        /* =====================================================
           PAYMENT MODAL
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

            const close =
                () => overlay.remove();

            overlay
                .querySelector(".fee-modal-close")
                ?.addEventListener(
                    "click",
                    close
                );

            overlay
                .querySelector(".fee-cancel")
                ?.addEventListener(
                    "click",
                    close
                );

            overlay.addEventListener(
                "click",
                event => {

                    if (event.target === overlay) {
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
                                record.studentDocId ===
                                    student.id &&
                                record.month === month
                            );

                        const data = {

                            studentDocId:
                                student.id,

                            studentId:
                                student.studentId || "",

                            studentName:
                                student.name || "",

                            phone:
                                student.phone || "",

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
                                    monthlyFee:
                                        amount
                                }
                            );
                        }

                        close();

                        toast(
                            "Fee paid successfully."
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

                        submit.disabled = false;
                        submit.textContent =
                            "Save Payment";
                    }
                }
            );
        }

        /* =====================================================
           UNDO
        ===================================================== */

        async function undoPayment(student) {

            const record =
                records.find(item =>
                    item.studentDocId === student.id &&
                    item.month === month
                );

            if (!record) return;

            const confirmed =
                confirm(
                    `Undo ${formatMonth(record.month)} fee payment for ${student.name || "this student"}?`
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
                    "Payment marked as unpaid."
                );

            } catch (error) {

                console.error(error);

                alert(
                    "Unable to undo payment:\n\n" +
                    error.message
                );
            }
        }

        /* =====================================================
           HISTORY
        ===================================================== */

        function showHistory(student) {

            const list =
                records
                    .filter(record =>
                        record.studentDocId ===
                            student.id &&
                        record.status ===
                            "paid"
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

                                            <div>
                                                <strong>
                                                    ₨ ${money(
                                                        record.amount
                                                    )}
                                                </strong>

                                                <br>

                                                <button
                                                    type="button"
                                                    class="fee-link-btn"
                                                    data-history-slip="${escAttr(
                                                        record.id
                                                    )}"
                                                >
                                                    Slip
                                                </button>
                                            </div>

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

            const close =
                () => overlay.remove();

            overlay
                .querySelector(".fee-modal-close")
                ?.addEventListener(
                    "click",
                    close
                );

            overlay.addEventListener(
                "click",
                event => {

                    if (event.target === overlay) {
                        close();
                    }
                }
            );

            overlay
                .querySelectorAll(
                    "[data-history-slip]"
                )
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const record =
                                records.find(
                                    item =>
                                        item.id ===
                                        button.dataset.historySlip
                                );

                            if (!record) return;

                            showSlip(
                                student,
                                record
                            );
                        }
                    );
                });
        }

        /* =====================================================
           FEE SLIP
        ===================================================== */

        function showSlip(
            student,
            selectedRecord = null
        ) {

            const record =
                selectedRecord ||
                records.find(item =>
                    item.studentDocId === student.id &&
                    item.month === month &&
                    item.status === "paid"
                );

            if (!record) {

                alert(
                    "No paid fee record found for this month."
                );

                return;
            }

            const phone =
                normalizePhone(
                    student.phone ||
                    record.phone ||
                    ""
                );

            const slipText =
`FEE PAYMENT RECEIPT
Sir Syed Hassan Ali Coaching

Student: ${student.name || "—"}
Student ID: ${student.studentId || "—"}
Course: ${student.course || "—"}
Batch: ${student.batch || "—"}

Month: ${formatMonth(record.month)}
Amount Paid: PKR ${money(record.amount)}
Payment Date: ${formatDate(record.paymentDate)}

Status: PAID

Thank you for your payment.`;

            const overlay =
                document.createElement("div");

            overlay.className =
                "fee-modal-overlay";

            overlay.innerHTML = `
                <div class="fee-modal">

                    <div class="fee-modal-head">

                        <div>
                            <div class="fee-modal-title">
                                Fee Slip
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
                        style="
                            padding:22px;
                            font-size:13px;
                            line-height:1.8;
                        "
                    >

                        <div
                            style="
                                border:1px solid #e5e7eb;
                                border-radius:12px;
                                padding:18px;
                                background:#f8fafc;
                            "
                        >

                            <strong
                                style="
                                    display:block;
                                    font-size:18px;
                                    margin-bottom:12px;
                                "
                            >
                                Sir Syed Hassan Ali Coaching
                            </strong>

                            <div>
                                <strong>Student:</strong>
                                ${esc(student.name || "—")}
                            </div>

                            <div>
                                <strong>Student ID:</strong>
                                ${esc(
                                    student.studentId ||
                                    "—"
                                )}
                            </div>

                            <div>
                                <strong>Course:</strong>
                                ${esc(
                                    student.course ||
                                    "—"
                                )}
                            </div>

                            <div>
                                <strong>Batch:</strong>
                                ${esc(
                                    student.batch ||
                                    "—"
                                )}
                            </div>

                            <hr>

                            <div>
                                <strong>Month:</strong>
                                ${formatMonth(
                                    record.month
                                )}
                            </div>

                            <div>
                                <strong>Amount Paid:</strong>
                                ₨ ${money(
                                    record.amount
                                )}
                            </div>

                            <div>
                                <strong>Payment Date:</strong>
                                ${formatDate(
                                    record.paymentDate
                                )}
                            </div>

                            <div
                                style="
                                    margin-top:10px;
                                    font-weight:800;
                                    color:#047857;
                                "
                            >
                                ✓ PAID
                            </div>

                        </div>

                        <div
                            class="fee-modal-actions"
                            style="margin-top:18px;"
                        >

                            <button
                                type="button"
                                class="secondary-btn"
                                data-slip-copy
                            >
                                Copy Slip
                            </button>

                            <button
                                type="button"
                                class="primary-btn"
                                data-slip-whatsapp
                            >
                                WhatsApp Slip
                            </button>

                        </div>

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

            overlay
                .querySelector(
                    "[data-slip-copy]"
                )
                ?.addEventListener(
                    "click",
                    async () => {

                        try {

                            await navigator.clipboard.writeText(
                                slipText
                            );

                            toast(
                                "Fee slip copied."
                            );

                        } catch {

                            alert(
                                slipText
                            );
                        }
                    }
                );

            overlay
                .querySelector(
                    "[data-slip-whatsapp]"
                )
                ?.addEventListener(
                    "click",
                    () => {

                        if (!phone) {

                            alert(
                                "Student phone number is missing."
                            );

                            return;
                        }

                        const url =
                            `https://wa.me/${phone}?text=${encodeURIComponent(
                                slipText
                            )}`;

                        window.open(
                            url,
                            "_blank"
                        );
                    }
                );
        }
    };

    if (
        document.readyState ===
        "loading"
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

function formatMonth(value) {

    const [
        year,
        month
    ] =
        String(
            value || ""
        ).split("-");

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
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function money(value) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-PK"
    );
}

function esc(value) {

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

function escAttr(value) {

    return esc(value)
        .replace(
            /`/g,
            "&#096;"
        );
}

function normalizePhone(value) {

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

function toast(message) {

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
