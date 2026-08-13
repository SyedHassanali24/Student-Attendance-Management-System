import { db } from "../firebase/firebase-config.js";
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   SSHACMS — ADMIN FEE MANAGEMENT
   Professional dynamic fee receipt included.
========================================================= */
(() => {
    let students = [], fees = [], month = currentMonth(), started = false;
    const $ = id => document.getElementById(id);

    function start() {
        if (started) return; started = true;
        const table = $("feesTableBody"); if (!table) return;
        const monthInput = $("feeMonth"), search = $("feeStudentSearch"), filter = $("feeStatusFilter");
        if (monthInput) monthInput.value = month;
        onSnapshot(collection(db, "students"), snap => { students = snap.docs.map(d => ({ id:d.id, ...d.data() })); render(); }, err => showError(table, err));
        onSnapshot(collection(db, "fees"), snap => { fees = snap.docs.map(d => ({ id:d.id, ...d.data() })); render(); }, err => showError(table, err));
        monthInput?.addEventListener("change", () => { month = monthInput.value || currentMonth(); render(); });
        search?.addEventListener("input", render); filter?.addEventListener("change", render);
    }

    function render() {
        const table = $("feesTableBody"); if (!table) return;
        const query = ($("feeStudentSearch")?.value || "").trim().toLowerCase();
        const status = $("feeStatusFilter")?.value || "all";
        const rows = students.map(student => ({ student, payment: currentPayment(student.id), last:lastPayment(student.id) })).filter(row => {
            const s=row.student, text=[s.name,s.studentId,s.phone,s.course,s.batch,s.fatherName].filter(Boolean).join(" ").toLowerCase();
            return (!query || text.includes(query)) && (status === "all" || status === (row.payment ? "paid" : "unpaid"));
        });
        const paid=students.map(s=>currentPayment(s.id)).filter(Boolean);
        $("feeTotalStudents") && ($("feeTotalStudents").textContent=students.length);
        $("feePaidStudents") && ($("feePaidStudents").textContent=paid.length);
        $("feePendingStudents") && ($("feePendingStudents").textContent=Math.max(students.length-paid.length,0));
        $("feeCollectedAmount") && ($("feeCollectedAmount").textContent=`₨ ${money(paid.reduce((n,p)=>n+Number(p.amount||0),0))}`);
        if(!rows.length) { table.innerHTML=`<tr><td colspan="9" class="empty">${students.length?"No students found.":"No students available."}</td></tr>`; return; }
        table.innerHTML=rows.map(rowHTML).join("");
        table.querySelectorAll("[data-fee-action]").forEach(btn=>btn.addEventListener("click",()=>{
            const student=students.find(s=>s.id===btn.dataset.studentId); if(!student)return;
            const action=btn.dataset.feeAction;
            if(action==="fee")setFee(student); if(action==="paid")markPaid(student); if(action==="undo")undo(student); if(action==="slip")receipt(student);
        }));
    }

    function rowHTML({student,payment,last}) {
        const amount=Number(payment?.amount ?? student.monthlyFee ?? 0);
        return `<tr>
<td><strong>${esc(student.studentId||"—")}</strong></td>
<td><div class="fee-student-name">${esc(student.name||"—")}</div><div class="fee-student-phone">${esc(student.phone||"")}</div></td>
<td>${esc(student.course||"—")}</td><td>${esc(student.batch||"—")}</td>
<td><div class="fee-amount">₨ ${money(amount)}</div><button type="button" class="fee-link-btn" data-fee-action="fee" data-student-id="${escAttr(student.id)}">Set Fee</button></td>
<td>${payment?`<span class="fee-badge paid">✓ Paid</span>`:`<span class="fee-badge unpaid">● Pending</span>`}</td>
<td>${last?formatMonth(last.month):"—"}</td><td>${payment?.paymentDate?formatDate(payment.paymentDate):"—"}</td>
<td><div class="fee-actions">${payment?`<button type="button" class="fee-action secondary" data-fee-action="slip" data-student-id="${escAttr(student.id)}">Receipt</button><button type="button" class="fee-action danger" data-fee-action="undo" data-student-id="${escAttr(student.id)}">Undo</button>`:`<button type="button" class="fee-action success" data-fee-action="paid" data-student-id="${escAttr(student.id)}">✓ Mark Paid</button>`}</div></td></tr>`;
    }

    function currentPayment(studentId) { return fees.find(f=>f.studentDocId===studentId&&f.month===month&&f.status==="paid")||null; }
    function lastPayment(studentId) { return fees.filter(f=>f.studentDocId===studentId&&f.status==="paid"&&f.month).sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0]||null; }

    async function setFee(student) {
        const raw=prompt(`Monthly fee for ${student.name}:`,student.monthlyFee??""); if(raw===null)return;
        const amount=Number(String(raw).replace(/,/g,"").trim()); if(!Number.isFinite(amount)||amount<0)return alert("Please enter a valid fee amount.");
        try { await updateDoc(doc(db,"students",student.id),{monthlyFee:amount,feeUpdatedAt:serverTimestamp()}); notify("Monthly fee updated."); } catch(e) { alert("Unable to update fee:\n\n"+e.message); }
    }

    async function markPaid(student) {
        const old=currentPayment(student.id);
        const amountRaw=prompt(`Fee amount for ${student.name} — ${formatMonth(month)}:`,old?.amount??student.monthlyFee??""); if(amountRaw===null)return;
        const amount=Number(String(amountRaw).replace(/,/g,"").trim()); if(!Number.isFinite(amount)||amount<=0)return alert("Please enter a valid amount.");
        const date=prompt("Payment date (YYYY-MM-DD):",today()); if(!date)return;
        const data={studentDocId:student.id,studentId:student.studentId||"",studentName:student.name||"",phone:student.phone||"",fatherName:student.fatherName||"",course:student.course||"",batch:student.batch||"",month,amount,paymentDate:date,status:"paid",updatedAt:serverTimestamp()};
        try { if(old)await updateDoc(doc(db,"fees",old.id),data); else await addDoc(collection(db,"fees"),{...data,createdAt:serverTimestamp()}); await updateDoc(doc(db,"students",student.id),{monthlyFee:amount}); notify(`${student.name} fee marked as paid.`); } catch(e) { alert("Unable to save payment:\n\n"+e.message); }
    }

    async function undo(student) {
        const payment=currentPayment(student.id); if(!payment)return;
        if(!confirm(`Undo ${formatMonth(month)} payment for ${student.name}?`))return;
        try { await deleteDoc(doc(db,"fees",payment.id)); notify("Payment undone."); } catch(e) { alert("Unable to undo payment:\n\n"+e.message); }
    }

    function receipt(student) {
        const payment=currentPayment(student.id); if(!payment)return alert("No paid record found for this month.");
        const w=window.open("","_blank","width=900,height=1000"); if(!w)return alert("Please allow pop-ups to print the fee slip.");
        const receiptNo=`RCP-${String(payment.id||"").slice(-8).toUpperCase()||Date.now().toString().slice(-8)}`;
        const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 330" role="img" aria-label="Sir Syed Hassan Ali logo"><rect width="260" height="330" fill="#fff"/><g stroke="#0b2f63" stroke-width="9" fill="none"><path d="M130 42v178"/><path d="M94 92h72l-8 100H102z" fill="#0b2f63" stroke="none"/><path d="M100 92l30-36 30 36" fill="#b98932"/><path d="M104 115h52M106 148h48M108 178h44" stroke="#fff" stroke-width="7"/><path d="M72 242Q130 202 188 242L130 225z" fill="#b98932"/><path d="M42 248q88-34 176 0-88 18-176 0z" fill="#fff"/><path d="M50 263q80 20 160 0"/></g><g fill="#0b2f63"><circle cx="130" cy="32" r="9"/><text x="130" y="295" text-anchor="middle" font-family="Georgia,serif" font-size="31" font-weight="700">SIR SYED</text><text x="130" y="322" text-anchor="middle" font-family="Georgia,serif" font-size="24" font-weight="700">HASSAN ALI</text></g></svg>`;
        const logoSrc = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(logo);
        const courseBatch=[student.course||"—",student.batch||"—"].join(" / ");
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Fee Payment Receipt</title><style>
@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#102a52;font-family:Inter,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:100%;max-width:780px;min-height:1050px;margin:20px auto;background:#fff;border:1px solid #d7dee9;box-shadow:0 10px 35px rgba(15,35,70,.12);position:relative;overflow:hidden}.topbar{height:9px;background:#0b2f63}.header{padding:24px 30px 20px;display:grid;grid-template-columns:105px 1fr 155px;gap:18px;align-items:center;border-bottom:1px solid #e5eaf1}.logo{width:96px;height:118px;object-fit:contain}.brand h1{margin:0;font-size:27px;line-height:1.12;letter-spacing:.2px;color:#082a5b}.brand .tag{margin:7px 0 12px;color:#b27a21;font-size:13px;font-weight:700;letter-spacing:.4px}.contact{font-size:10.5px;color:#4a5c73;line-height:1.7}.contact strong{color:#0b2f63}.badge{justify-self:end;background:#0b2f63;color:#fff;padding:13px 12px;border-radius:10px;text-align:center;font-weight:800;font-size:15px;line-height:1.3;box-shadow:0 5px 14px rgba(11,47,99,.18)}.meta{padding:16px 30px;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e9edf3;font-size:11px;color:#66758b}.meta strong{color:#102a52}.title{text-align:center;margin:20px 30px 15px;font-size:20px;font-weight:800;color:#0b2f63}.title:after{content:"";display:block;width:90px;height:3px;background:#c6933a;margin:9px auto 0;border-radius:2px}.section{margin:0 30px 18px;border:1px solid #d8e0ea;border-radius:11px;overflow:hidden}.section-head{background:#0b2f63;color:#fff;padding:10px 15px;font-size:13px;font-weight:800;letter-spacing:.5px}.rows{padding:4px 15px}.row{display:grid;grid-template-columns:180px 1fr;padding:11px 3px;border-bottom:1px dashed #d8dee8;font-size:12px}.row:last-child{border-bottom:0}.label{color:#6b7b90}.value{font-weight:750;text-align:right;color:#142e56}.payment{margin:0 30px 18px;border:2px solid #1d8b5a;border-radius:12px;overflow:hidden}.payment-head{padding:9px 15px;font-size:13px;font-weight:800;color:#0b2f63;border-bottom:1px solid #dbe6e0}.payment-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr}.pay-cell{padding:16px;text-align:center;border-right:1px solid #dbe2ea}.pay-cell:last-child{border-right:0}.pay-label{font-size:11px;color:#6b7b90;font-weight:700}.amount{font-size:30px;font-weight:900;color:#16804f;margin-top:5px}.method{font-size:18px;font-weight:800;color:#102a52;margin-top:8px}.status{display:inline-block;margin-top:8px;background:#16804f;color:#fff;border-radius:7px;padding:8px 18px;font-weight:900}.success{text-align:center;color:#16804f;font-weight:900;font-size:14px;margin:10px 30px 5px}.note{text-align:center;color:#77869a;font-size:10px;margin:0 30px 17px}.bottom{display:grid;grid-template-columns:1.6fr .8fr;gap:20px;margin:0 30px 25px;border-top:1px solid #dce3eb;padding-top:15px}.terms h3{font-size:11px;margin:0 0 7px;color:#0b2f63}.terms li{font-size:9.5px;color:#69788c;margin:4px 0}.seal{display:flex;align-items:center;justify-content:center}.seal-inner{width:82px;height:82px;border:2px solid #0b2f63;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:8px;font-weight:900;color:#0b2f63;padding:8px}.footer{position:absolute;left:0;right:0;bottom:0;background:#0b2f63;color:#fff;text-align:center;padding:10px;font-size:10px;letter-spacing:.3px}@media print{body{background:#fff}.sheet{margin:0;max-width:none;min-height:calc(297mm - 24mm);box-shadow:none;border:0}}
</style></head><body><div class="sheet"><div class="topbar"></div><header class="header"><img class="logo" src="${logoSrc}" alt="Sir Syed Hassan Ali logo"><div class="brand"><h1>SIR SYED HASSAN ALI COACHING</h1><div class="tag">Learn Today, Better Future Tomorrow</div><div class="contact"><strong>Karachi, Pakistan</strong> &nbsp; | &nbsp; Phone: <strong>0313-2956206</strong><br>Email: info@sshac.com &nbsp; | &nbsp; Student Fee Management</div></div><div class="badge">FEE PAYMENT<br>RECEIPT</div></header><div class="meta"><span>Receipt No.: <strong>${esc(receiptNo)}</strong></span><span>Date &amp; Time: <strong>${esc(formatDate(payment.paymentDate))}</strong></span></div><div class="title">Thank You For Your Payment</div><section class="section"><div class="section-head">STUDENT INFORMATION</div><div class="rows"><div class="row"><span class="label">Student Name</span><span class="value">${esc(student.name||"—")}</span></div><div class="row"><span class="label">Student ID</span><span class="value">${esc(student.studentId||"—")}</span></div><div class="row"><span class="label">Father Name</span><span class="value">${esc(student.fatherName||"—")}</span></div><div class="row"><span class="label">Course / Batch</span><span class="value">${esc(courseBatch)}</span></div><div class="row"><span class="label">Fee Month</span><span class="value">${esc(formatMonth(payment.month))}</span></div><div class="row"><span class="label">Payment Date</span><span class="value">${esc(formatDate(payment.paymentDate))}</span></div></div></section><section class="payment"><div class="payment-head">PAYMENT DETAILS</div><div class="payment-grid"><div class="pay-cell"><div class="pay-label">AMOUNT PAID</div><div class="amount">Rs. ${money(payment.amount)}</div></div><div class="pay-cell"><div class="pay-label">PAYMENT METHOD</div><div class="method">Cash</div></div><div class="pay-cell"><div class="pay-label">PAYMENT STATUS</div><div class="status">✓ PAID</div></div></div></section><div class="success">✓ PAYMENT SUCCESSFUL</div><div class="note">This is a computer-generated receipt and does not require a signature.</div><div class="bottom"><div class="terms"><h3>TERMS &amp; CONDITIONS</h3><ul><li>Fees once paid are non-refundable.</li><li>Please keep this receipt for your records.</li><li>For any query, contact the administration office.</li></ul></div><div class="seal"><div class="seal-inner">SIR SYED<br>HASSAN ALI<br>COACHING<br>OFFICIAL RECEIPT</div></div></div><div class="footer">Thank you for being a part of our learning community!</div></div><script>window.onload=()=>{window.print();}</script></body></html>`);
        w.document.close();
    }

    function showError(table,error) { console.error("Fee Management Error:",error); table.innerHTML=`<tr><td colspan="9" class="empty">Unable to load fee records. Check Firebase/Firestore permissions.</td></tr>`; }
    function notify(message) { if(typeof window.showToast==="function")return window.showToast(message); console.log(message); }
    function currentMonth() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
    function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
    function formatMonth(value) { if(!value)return "—"; const [y,m]=String(value).split("-"); return new Date(Number(y),Number(m)-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"}); }
    function formatDate(value) { if(!value)return "—"; const d=new Date(value+"T00:00:00"); return Number.isNaN(d.getTime())?value:d.toLocaleDateString("en-GB"); }
    function money(value) { return Number(value||0).toLocaleString("en-PK"); }
    function esc(value) { return String(value??"").replace(/[&<>\"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c])); }
    function escAttr(value) { return esc(value).replace(/'/g,"&#39;"); }
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();
