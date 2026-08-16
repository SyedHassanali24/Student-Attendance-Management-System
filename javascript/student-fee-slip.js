/* =========================================================
   SSHACMS — STUDENT FEE RECEIPT

   Student portal:
   - Adds ONE Receipt button to each paid fee row.
   - Receipt downloads directly as PDF.
   - Uses the same receipt engine/design as Admin.
   - No WhatsApp button.
   - No separate lower receipt section/modal.
========================================================= */

import { auth, db } from "../firebase/firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { downloadFeeReceipt } from "./fee-download.js?v=2";

let currentStudent = null;
let feeRecords = [];
let tableObserver = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
        currentStudent = await findStudent(user);
        if (!currentStudent) return;
        feeRecords = await loadFees(currentStudent);
        observeFeeTable();
        addReceiptButtons();
    } catch (error) {
        console.error("Student Fee Receipt Error:", error);
    }
});

async function findStudent(user) {
    const queries = [];
    if (user.uid) queries.push(query(collection(db, "students"), where("uid", "==", user.uid)));
    if (user.email) queries.push(query(collection(db, "students"), where("email", "==", user.email)));

    const savedId = localStorage.getItem("studentId");
    if (savedId) queries.push(query(collection(db, "students"), where("studentId", "==", savedId)));

    for (const studentQuery of queries) {
        try {
            const snapshot = await getDocs(studentQuery);
            if (!snapshot.empty) {
                const item = snapshot.docs[0];
                return { id: item.id, ...item.data() };
            }
        } catch (error) {
            console.warn("Student lookup failed:", error);
        }
    }
    return null;
}

async function loadFees(student) {
    const queries = [query(collection(db, "fees"), where("studentDocId", "==", student.id))];
    if (student.studentId) queries.push(query(collection(db, "fees"), where("studentId", "==", student.studentId)));

    const all = [];
    for (const feeQuery of queries) {
        try {
            const snapshot = await getDocs(feeQuery);
            snapshot.docs.forEach(item => all.push({ id: item.id, ...item.data() }));
        } catch (error) {
            console.warn("Fee lookup failed:", error);
        }
    }

    const unique = new Map();
    all.forEach(record => unique.set(record.id, record));

    return Array.from(unique.values())
        .filter(record => String(record.status || "").toLowerCase() === "paid")
        .sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
}

function observeFeeTable() {
    const body = document.getElementById("feeTableBody");
    if (!body) {
        setTimeout(observeFeeTable, 250);
        return;
    }

    if (tableObserver) tableObserver.disconnect();
    tableObserver = new MutationObserver(() => addReceiptButtons());
    tableObserver.observe(body, { childList: true, subtree: true });
}

function addReceiptButtons() {
    const body = document.getElementById("feeTableBody");
    if (!body || !currentStudent) return;

    body.querySelectorAll("tr").forEach(row => {
        if (row.querySelector("[data-student-fee-receipt]")) return;

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
        button.setAttribute("data-student-fee-receipt", "true");
        button.style.border = "0";
        button.style.borderRadius = "8px";
        button.style.padding = "8px 11px";
        button.style.background = "#eff6ff";
        button.style.color = "#1d4ed8";
        button.style.fontWeight = "700";
        button.style.fontSize = "11px";
        button.style.cursor = "pointer";

        button.addEventListener("click", async () => {
            const original = button.textContent;
            button.disabled = true;
            button.textContent = "Preparing...";
            try {
                await downloadFeeReceipt(currentStudent, record);
            } catch (error) {
                console.error("Student receipt download failed:", error);
            } finally {
                button.disabled = false;
                button.textContent = original;
            }
        });

        actionCell.appendChild(button);
        row.appendChild(actionCell);
    });

    const table = body.closest("table");
    if (!table) return;

    const header = table.querySelector("thead tr");
    if (header && !header.querySelector("[data-fee-receipt-heading]")) {
        const th = document.createElement("th");
        th.textContent = "Receipt";
        th.setAttribute("data-fee-receipt-heading", "true");
        header.appendChild(th);
    }
}

function findRecordByMonthText(monthText) {
    return feeRecords.find(record =>
        formatMonth(record.month).toLowerCase() === monthText.toLowerCase()
    ) || null;
}

function formatMonth(value) {
    const [year, month] = String(value || "").split("-");
    if (!year || !month) return "—";
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
