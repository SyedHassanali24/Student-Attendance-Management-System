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
   SSHACMS — ADMIN FEE MANAGEMENT
   Local admin module: no remote jsDelivr dependency.
========================================================= */

(() => {
    let students = [];
    let fees = [];
    let month = currentMonth();
    let started = false;

    const $ = id => document.getElementById(id);

    function start() {
        if (started) return;
        started = true;

        const table = $("feesTableBody");
        if (!table) return;

        const monthInput = $("feeMonth");
        const search = $("feeStudentSearch");
        const filter = $("feeStatusFilter");

        if (monthInput) monthInput.value = month;

        onSnapshot(collection(db, "students"), snap => {
            students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            render();
        }, err => showError(table, err));

        onSnapshot(collection(db, "fees"), snap => {
            fees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            render();
        }, err => showError(table, err));

        monthInput?.addEventListener("change", () => {
            month = monthInput.value || currentMonth();
            render();
        });
        search?.addEventListener("input", render);
        filter?.addEventListener("change", render);
    }

    function render() {
        const table = $("feesTableBody");
        if (!table) return;

        const query = ($( "feeStudentSearch")?.value || "").trim().toLowerCase();
        const status = $("feeStatusFilter")?.value || "all";

        const rows = students.map(student => {
            const payment = currentPayment(student.id);
            return { student, payment, last: lastPayment(student.id) };
        }).filter(row => {
            const s = row.student;
            const text = [s.name, s.studentId, s.phone, s.course, s.batch, s.fatherName]
                .filter(Boolean).join(" ").toLowerCase();
            return (!query || text.includes(query)) &&
                (status === "all" || status === (row.payment ? "paid" : "unpaid"));
        });

        const paid = students.map(s => currentPayment(s.id)).filter(Boolean);
        $("feeTotalStudents") && ($( "feeTotalStudents").textContent = students.length);
        $("feePaidStudents") && ($( "feePaidStudents").textContent = paid.length);
        $("feePendingStudents") && ($( "feePendingStudents").textContent = Math.max(students.length - paid.length, 0));
        $("feeCollectedAmount") && ($( "feeCollectedAmount").textContent = `₨ ${money(paid.reduce((n, p) => n + Number(p.amount || 0), 0))}`);

        if (!rows.length) {
            table.innerHTML = `<tr><td colspan="9" class="empty">${students.length ? "No students found." : "No students available."}</td></tr>`;
            return;
        }

        table.innerHTML = rows.map(rowHTML).join("");
        table.querySelectorAll("[data-fee-action]").forEach(btn => {
            btn.addEventListener("click", () => {
                const student = students.find(s => s.id === btn.dataset.studentId);
                if (!student) return;
                const action = btn.dataset.feeAction;
                if (action === "fee") setFee(student);
                if (action === "paid") markPaid(student);
                if (action === "undo") undo(student);
                if (action === "slip") receipt(student);
            });
        });
    }

    function rowHTML({ student, payment, last }) {
        const amount = Number(payment?.amount ?? student.monthlyFee ?? 0);
        return `<tr>
            <td><strong>${esc(student.studentId || "—")}</strong></td>
            <td><div class="fee-student-name">${esc(student.name || "—")}</div><div class="fee-student-phone">${esc(student.phone || "")}</div></td>
            <td>${esc(student.course || "—")}</td>
            <td>${esc(student.batch || "—")}</td>
            <td><div class="fee-amount">₨ ${money(amount)}</div><button type="button" class="fee-link-btn" data-fee-action="fee" data-student-id="${escAttr(student.id)}">Set Fee</button></td>
            <td>${payment ? `<span class="fee-badge paid">✓ Paid</span>` : `<span class="fee-badge unpaid">● Pending</span>`}</td>
            <td>${last ? formatMonth(last.month) : "—"}</td>
            <td>${payment?.paymentDate ? formatDate(payment.paymentDate) : "—"}</td>
            <td><div class="fee-actions">${payment
                ? `<button type="button" class="fee-action secondary" data-fee-action="slip" data-student-id="${escAttr(student.id)}">Receipt</button><button type="button" class="fee-action danger" data-fee-action="undo" data-student-id="${escAttr(student.id)}">Undo</button>`
                : `<button type="button" class="fee-action success" data-fee-action="paid" data-student-id="${escAttr(student.id)}">✓ Mark Paid</button>`}</div></td>
        </tr>`;
    }

    function currentPayment(studentId) {
        return fees.find(f => f.studentDocId === studentId && f.month === month && f.status === "paid") || null;
    }

    function lastPayment(studentId) {
        return fees.filter(f => f.studentDocId === studentId && f.status === "paid" && f.month)
            .sort((a, b) => String(b.month).localeCompare(String(a.month)))[0] || null;
    }

    async function setFee(student) {
        const raw = prompt(`Monthly fee for ${student.name}:`, student.monthlyFee ?? "");
        if (raw === null) return;
        const amount = Number(String(raw).replace(/,/g, "").trim());
        if (!Number.isFinite(amount) || amount < 0) return alert("Please enter a valid fee amount.");
        try {
            await updateDoc(doc(db, "students", student.id), { monthlyFee: amount, feeUpdatedAt: serverTimestamp() });
            notify("Monthly fee updated.");
        } catch (e) { alert("Unable to update fee:\n\n" + e.message); }
    }

    async function markPaid(student) {
        const old = currentPayment(student.id);
        const amountRaw = prompt(`Fee amount for ${student.name} — ${formatMonth(month)}:`, old?.amount ?? student.monthlyFee ?? "");
        if (amountRaw === null) return;
        const amount = Number(String(amountRaw).replace(/,/g, "").trim());
        if (!Number.isFinite(amount) || amount <= 0) return alert("Please enter a valid amount.");

        const date = prompt("Payment date (YYYY-MM-DD):", today());
        if (!date) return;

        const data = {
            studentDocId: student.id,
            studentId: student.studentId || "",
            studentName: student.name || "",
            phone: student.phone || "",
            fatherName: student.fatherName || "",
            course: student.course || "",
            batch: student.batch || "",
            month,
            amount,
            paymentDate: date,
            status: "paid",
            updatedAt: serverTimestamp()
        };

        try {
            if (old) await updateDoc(doc(db, "fees", old.id), data);
            else await addDoc(collection(db, "fees"), { ...data, createdAt: serverTimestamp() });
            await updateDoc(doc(db, "students", student.id), { monthlyFee: amount });
            notify(`${student.name} fee marked as paid.`);
        } catch (e) { alert("Unable to save payment:\n\n" + e.message); }
    }

    async function undo(student) {
        const payment = currentPayment(student.id);
        if (!payment) return;
        if (!confirm(`Undo ${formatMonth(month)} payment for ${student.name}?`)) return;
        try {
            await deleteDoc(doc(db, "fees", payment.id));
            notify("Payment undone.");
        } catch (e) { alert("Unable to undo payment:\n\n" + e.message); }
    }

    function receipt(student) {
        const payment = currentPayment(student.id);
        if (!payment) return alert("No paid record found for this month.");
        const w = window.open("", "_blank", "width=800,height=900");
        if (!w) return alert("Please allow pop-ups to print the fee slip.");
        w.document.write(`<!doctype html><html><head><title>Fee Receipt</title><style>body{font-family:Arial;padding:35px;color:#111827}.receipt{max-width:620px;margin:auto;border:1px solid #ddd;border-radius:16px;overflow:hidden}.head{padding:28px;background:#f8fafc}.body{padding:28px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee}.amount{margin-top:22px;padding:18px;background:#f8fafc;border-radius:12px;display:flex;justify-content:space-between;font-size:20px;font-weight:800}.paid{text-align:center;color:#047857;font-weight:800;margin-top:22px}@media print{body{padding:0}}</style></head><body><div class="receipt"><div class="head"><h1>Sir Syed Hassan Ali Coaching</h1><p>Fee Payment Receipt</p></div><div class="body"><div class="row"><span>Student</span><strong>${esc(student.name)}</strong></div><div class="row"><span>Student ID</span><strong>${esc(student.studentId || "—")}</strong></div><div class="row"><span>Father Name</span><strong>${esc(student.fatherName || "—")}</strong></div><div class="row"><span>Course / Batch</span><strong>${esc((student.course || "—") + " / " + (student.batch || "—"))}</strong></div><div class="row"><span>Fee Month</span><strong>${esc(formatMonth(payment.month))}</strong></div><div class="row"><span>Payment Date</span><strong>${esc(formatDate(payment.paymentDate))}</strong></div><div class="amount"><span>Amount Paid</span><span>₨ ${money(payment.amount)}</span></div><div class="paid">✓ PAYMENT PAID</div></div></div><script>window.onload=()=>window.print()</script></body></html>`);
        w.document.close();
    }

    function showError(table, error) {
        console.error("Fee Management Error:", error);
        table.innerHTML = `<tr><td colspan="9" class="empty">Unable to load fee records. Check Firebase/Firestore permissions.</td></tr>`;
    }

    function notify(message) {
        if (typeof window.showToast === "function") return window.showToast(message);
        console.log(message);
    }

    function currentMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    function today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function formatMonth(value) {
        if (!value) return "—";
        const [y, m] = String(value).split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    function formatDate(value) {
        if (!value) return "—";
        const d = new Date(value + "T00:00:00");
        return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
    }

    function money(value) {
        return Number(value || 0).toLocaleString("en-PK");
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
    }

    function escAttr(value) { return esc(value).replace(/'/g, "&#39;"); }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
})();
