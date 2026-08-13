/* =========================================================
   SSHACMS — STUDENT FEE SLIP

   Adds a professional receipt button to every paid fee in
   the Student Portal without changing the existing dashboard.

   Data source: Firebase Firestore /fees
========================================================= */

import { auth, db } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let currentStudent = null;
let feeRecords = [];

onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    try {
        currentStudent = await findStudent(user);

        if (!currentStudent) return;

        feeRecords = await loadFees(currentStudent);

        observeFeeTable();
        addReceiptButtons();

    } catch (error) {
        console.error("Student Fee Slip Error:", error);
    }
});

async function findStudent(user) {

    const queries = [];

    if (user.uid) {
        queries.push(
            query(
                collection(db, "students"),
                where("uid", "==", user.uid)
            )
        );
    }

    if (user.email) {
        queries.push(
            query(
                collection(db, "students"),
                where("email", "==", user.email)
            )
        );
    }

    const savedId = localStorage.getItem("studentId");

    if (savedId) {
        queries.push(
            query(
                collection(db, "students"),
                where("studentId", "==", savedId)
            )
        );
    }

    for (const studentQuery of queries) {
        try {
            const snapshot = await getDocs(studentQuery);

            if (!snapshot.empty) {
                const item = snapshot.docs[0];
                return {
                    id: item.id,
                    ...item.data()
                };
            }
        } catch (error) {
            console.warn("Student lookup failed:", error);
        }
    }

    return null;
}

async function loadFees(student) {

    const queries = [
        query(
            collection(db, "fees"),
            where("studentDocId", "==", student.id)
        )
    ];

    if (student.studentId) {
        queries.push(
            query(
                collection(db, "fees"),
                where("studentId", "==", student.studentId)
            )
        );
    }

    const all = [];

    for (const feeQuery of queries) {
        try {
            const snapshot = await getDocs(feeQuery);

            snapshot.docs.forEach(item => {
                all.push({
                    id: item.id,
                    ...item.data()
                });
            });
        } catch (error) {
            console.warn("Fee lookup failed:", error);
        }
    }

    const unique = new Map();

    all.forEach(record => {
        unique.set(record.id, record);
    });

    return Array.from(unique.values())
        .filter(record =>
            String(record.status || "").toLowerCase() === "paid"
        )
        .sort((a, b) =>
            String(b.month || "").localeCompare(
                String(a.month || "")
            )
        );
}

function observeFeeTable() {

    const body = document.getElementById("feeTableBody");

    if (body) {
        const observer = new MutationObserver(() => {
            addReceiptButtons();
        });

        observer.observe(body, {
            childList: true,
            subtree: true
        });

        return;
    }

    setTimeout(observeFeeTable, 250);
}

function addReceiptButtons() {

    const body = document.getElementById("feeTableBody");

    if (!body) return;

    body.querySelectorAll("tr").forEach(row => {

        if (row.querySelector("[data-student-fee-slip]")) return;

        const cells = row.querySelectorAll("td");

        if (cells.length < 4) return;

        const monthText = cells[0].textContent.trim();
        const statusText = cells[3].textContent.trim().toLowerCase();

        if (!statusText.includes("paid")) return;

        const record = findRecordByMonthText(monthText);

        if (!record) return;

        const actionCell = document.createElement("td");

        actionCell.style.whiteSpace = "nowrap";

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "🧾 Receipt";
        button.setAttribute("data-student-fee-slip", "true");

        button.style.border = "0";
        button.style.borderRadius = "8px";
        button.style.padding = "8px 11px";
        button.style.background = "#eff6ff";
        button.style.color = "#1d4ed8";
        button.style.fontWeight = "700";
        button.style.fontSize = "11px";
        button.style.cursor = "pointer";

        button.addEventListener("click", () => {
            showStudentSlip(record);
        });

        actionCell.appendChild(button);
        row.appendChild(actionCell);
    });

    const table = body.closest("table");

    if (table) {
        const header = table.querySelector("thead tr");

        if (header && !header.querySelector("[data-fee-slip-heading]")) {
            const th = document.createElement("th");
            th.textContent = "Receipt";
            th.setAttribute("data-fee-slip-heading", "true");
            header.appendChild(th);
        }
    }
}

function findRecordByMonthText(monthText) {

    return feeRecords.find(record =>
        formatMonth(record.month).toLowerCase() ===
        monthText.toLowerCase()
    ) || null;
}

function showStudentSlip(record) {

    const overlay = document.createElement("div");

    overlay.className = "fee-modal-overlay";

    overlay.innerHTML = `
        <div class="student-slip-modal">

            <div class="student-slip-head">
                <div>
                    <div class="student-slip-brand">Sir Syed Hassan Ali</div>
                    <div class="student-slip-subtitle">Coaching Management System</div>
                </div>

                <button type="button" class="student-slip-close">×</button>
            </div>

            <div class="student-slip-paper" id="studentSlipPrintArea">

                <div class="student-slip-top">
                    <div>
                        <div class="student-slip-title">Fee Payment Receipt</div>
                        <div class="student-slip-muted">Official payment confirmation</div>
                    </div>
                    <span class="student-slip-paid">PAID</span>
                </div>

                <div class="student-slip-grid">
                    ${field("Student Name", currentStudent?.name || "—")}
                    ${field("Student ID", currentStudent?.studentId || "—")}
                    ${field("Father Name", currentStudent?.fatherName || "—")}
                    ${field("Phone", currentStudent?.phone || "—")}
                    ${field("Course", currentStudent?.course || "—")}
                    ${field("Batch", currentStudent?.batch || "—")}
                </div>

                <div class="student-slip-divider"></div>

                <div class="student-slip-grid">
                    ${field("Fee Month", formatMonth(record.month))}
                    ${field("Payment Date", formatDate(record.paymentDate))}
                </div>

                <div class="student-slip-amount">
                    <div>
                        <span>Amount Paid</span>
                        <strong>₨ ${money(record.amount)}</strong>
                    </div>
                    <div class="student-slip-check">✓</div>
                </div>

                ${record.note ? `
                    <div class="student-slip-note">
                        <strong>Note:</strong> ${escapeHtml(record.note)}
                    </div>
                ` : ""}

                <div class="student-slip-success">✓ Payment Received Successfully</div>
                <div class="student-slip-thanks">Thank you for your payment.</div>
            </div>

            <div class="student-slip-actions">
                <button type="button" class="secondary-btn" data-slip-print>🖨 Print / Save PDF</button>
                <button type="button" class="primary-btn" data-slip-whatsapp>WhatsApp</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".student-slip-close")?.addEventListener(
        "click",
        () => overlay.remove()
    );

    overlay.addEventListener("click", event => {
        if (event.target === overlay) overlay.remove();
    });

    overlay.querySelector("[data-slip-print]")?.addEventListener(
        "click",
        () => printSlip(record)
    );

    overlay.querySelector("[data-slip-whatsapp]")?.addEventListener(
        "click",
        () => shareWhatsApp(record)
    );
}

function field(label, value) {
    return `
        <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || "—")}</strong>
        </div>
    `;
}

function printSlip(record) {

    const popup = window.open("", "_blank", "width=900,height=1000");

    if (!popup) {
        alert("Please allow pop-ups to print or save the fee receipt.");
        return;
    }

    popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Fee Receipt - ${escapeHtml(currentStudent?.name || "Student")}</title>
            <style>
                *{box-sizing:border-box}
                body{margin:0;padding:30px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff}
                .receipt{max-width:680px;margin:0 auto;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden}
                .head{padding:28px 30px;background:linear-gradient(135deg,#172554,#1d4ed8);color:#fff;display:flex;justify-content:space-between;gap:20px}
                .brand{font-size:25px;font-weight:800}.sub{margin-top:5px;font-size:12px;opacity:.85}.paid{background:#fff;color:#172554;padding:8px 12px;border-radius:9px;font-size:11px;font-weight:800;height:max-content}
                .body{padding:30px}.title{font-size:20px;font-weight:800}.muted{margin-top:5px;color:#64748b;font-size:12px}
                .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:25px}.label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase}.value{margin-top:5px;font-size:14px;font-weight:700}
                .line{height:1px;background:#e2e8f0;margin:25px 0}.amount{margin-top:25px;padding:20px;border-radius:14px;background:#f1f5f9;display:flex;justify-content:space-between;align-items:center}.amount-label{font-size:12px;color:#64748b}.amount-value{margin-top:4px;font-size:28px;font-weight:900;color:#172554}.check{font-size:30px;color:#15803d}.success{text-align:center;margin-top:25px;color:#15803d;font-size:14px;font-weight:800}.thanks{text-align:center;margin-top:6px;color:#94a3b8;font-size:11px}
                @media print{body{padding:0}.receipt{border:1px solid #ddd}}
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="head"><div><div class="brand">Sir Syed Hassan Ali</div><div class="sub">Coaching Management System</div></div><div class="paid">PAID</div></div>
                <div class="body">
                    <div class="title">Fee Payment Receipt</div>
                    <div class="muted">Official payment confirmation</div>
                    <div class="grid">
                        ${printField("Student Name", currentStudent?.name)}
                        ${printField("Student ID", currentStudent?.studentId)}
                        ${printField("Father Name", currentStudent?.fatherName)}
                        ${printField("Phone", currentStudent?.phone)}
                        ${printField("Course", currentStudent?.course)}
                        ${printField("Batch", currentStudent?.batch)}
                    </div>
                    <div class="line"></div>
                    <div class="grid">
                        ${printField("Fee Month", formatMonth(record.month))}
                        ${printField("Payment Date", formatDate(record.paymentDate))}
                    </div>
                    <div class="amount"><div><div class="amount-label">Amount Paid</div><div class="amount-value">₨ ${money(record.amount)}</div></div><div class="check">✓</div></div>
                    <div class="success">✓ Payment Received Successfully</div>
                    <div class="thanks">Thank you for your payment.</div>
                </div>
            </div>
            <script>window.onload=()=>window.print();<\/script>
        </body>
        </html>
    `);

    popup.document.close();
}

function printField(label, value) {
    return `<div><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value || "—")}</div></div>`;
}

function shareWhatsApp(record) {

    const phone = normalizePhone(currentStudent?.phone || "");

    if (!phone) {
        alert("Student phone number is missing.");
        return;
    }

    const message = `FEE PAYMENT RECEIPT\nSir Syed Hassan Ali Coaching\n\nStudent: ${currentStudent?.name || "—"}\nStudent ID: ${currentStudent?.studentId || "—"}\nFather Name: ${currentStudent?.fatherName || "—"}\nCourse: ${currentStudent?.course || "—"}\nBatch: ${currentStudent?.batch || "—"}\n\nFee Month: ${formatMonth(record.month)}\nAmount Paid: PKR ${money(record.amount)}\nPayment Date: ${formatDate(record.paymentDate)}\n\nStatus: PAID\n\nThank you for your payment.`;

    window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank"
    );
}

function normalizePhone(value) {

    let phone = String(value || "").replace(/\D/g, "");

    if (phone.startsWith("00")) phone = phone.substring(2);

    if (phone.startsWith("0") && phone.length === 11) {
        phone = "92" + phone.substring(1);
    }

    return phone;
}

function formatMonth(value) {
    const [year, month] = String(value || "").split("-");

    if (!year || !month) return "—";

    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function money(value) {
    return Number(value || 0).toLocaleString("en-PK");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
