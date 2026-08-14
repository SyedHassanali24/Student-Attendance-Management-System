/* =========================================================
   SSHACMS — FEE SLIP DOWNLOAD ENGINE
   Direct one-click PDF for Admin + Student Portal.
========================================================= */

import { db } from "../firebase/firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* Load html2pdf automatically; no extra HTML edit is required. */
function ensurePdfLibrary(){
    if(window.html2pdf) return Promise.resolve();
    if(window.__sshacmsPdfPromise) return window.__sshacmsPdfPromise;
    window.__sshacmsPdfPromise = new Promise((resolve,reject)=>{
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
    return window.__sshacmsPdfPromise;
}

function safe(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
function money(v){return Number(v||0).toLocaleString("en-PK");}
function monthName(v){if(!v)return"—";const[y,m]=String(v).split("-");return new Date(Number(y),Number(m)-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"});}
function dateName(v){if(!v)return"—";const d=new Date(`${v}T00:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
function filename(s,p){const n=String(s?.name||"Student").trim().replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");return`Fee-Slip-${n||"Student"}-${p?.month||"receipt"}.pdf`;}

function receiptHTML(student,payment){return`<div class="fee-pdf-sheet">
<div class="fee-pdf-top"></div><div class="fee-pdf-header"><img src="${safe(new URL("./assets/logo.png",location.href).href)}" class="fee-pdf-logo"><div class="fee-pdf-brand"><h1>SIR SYED HASSAN ALI COACHING</h1><p>Learn Today, Better Future Tomorrow</p><small>House: #L-19, Sector L-1 Memarabad Surjani Town Karachi, Near Baba Decoration<br>Phone: 0313-2956206</small></div><div class="fee-pdf-badge">FEE<br>RECEIPT</div></div>
<div class="fee-pdf-meta"><span>Receipt No. <b>RCP-${safe(String(payment?.id||"").slice(-8).toUpperCase()||"NEW")}</b></span><span>Payment Date <b>${safe(dateName(payment?.paymentDate))}</b></span></div>
<h2 class="fee-pdf-title">Fee Payment Receipt</h2>
<section class="fee-pdf-section"><div class="fee-pdf-section-title">STUDENT INFORMATION</div><div class="fee-pdf-grid"><div><label>Student Name</label><strong>${safe(student?.name||"—")}</strong></div><div><label>Student ID</label><strong>${safe(student?.studentId||"—")}</strong></div><div><label>Father Name</label><strong>${safe(student?.fatherName||"—")}</strong></div><div><label>Phone</label><strong>${safe(student?.phone||"—")}</strong></div><div><label>Course</label><strong>${safe(student?.course||"—")}</strong></div><div><label>Batch</label><strong>${safe(student?.batch||"—")}</strong></div></div></section>
<section class="fee-pdf-section"><div class="fee-pdf-section-title">PAYMENT DETAILS</div><div class="fee-pdf-grid three"><div><label>Fee Month</label><strong>${safe(monthName(payment?.month))}</strong></div><div><label>Payment Method</label><strong>Cash</strong></div><div><label>Status</label><strong class="paid">✓ PAID</strong></div></div></section>
<div class="fee-pdf-amount"><span>AMOUNT PAID</span><strong>Rs. ${money(payment?.amount)}</strong></div><div class="fee-pdf-success">✓ PAYMENT RECEIVED SUCCESSFULLY</div><p class="fee-pdf-note">This is a computer-generated receipt and does not require a signature.</p><div class="fee-pdf-footer"><span>Sir Syed Hassan Ali Coaching Management System</span><b>0313-2956206</b></div></div>`;}

function styles(){return`<style>.fee-pdf-wrap{position:fixed;left:-100000px;top:0;width:190mm;background:#fff;z-index:-1}.fee-pdf-sheet{width:190mm;height:276mm;background:#fff;color:#102a52;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;position:relative;overflow:hidden;border:1px solid #d9e1ec}.fee-pdf-sheet *{box-sizing:border-box}.fee-pdf-top{height:7mm;background:#0b2f63}.fee-pdf-header{height:42mm;padding:7mm 8mm;display:grid;grid-template-columns:25mm 1fr 28mm;gap:5mm;align-items:center;border-bottom:1px solid #e1e7ef}.fee-pdf-logo{width:24mm;height:28mm;object-fit:contain}.fee-pdf-brand h1{margin:0;font-size:17px;color:#082a5b}.fee-pdf-brand p{margin:2mm 0;color:#b27a21;font-size:9px;font-weight:700}.fee-pdf-brand small{font-size:7px;color:#5f7086;line-height:1.5}.fee-pdf-badge{background:#0b2f63;color:#fff;border-radius:3mm;text-align:center;padding:4mm 2mm;font-size:10px;font-weight:800;line-height:1.35}.fee-pdf-meta{display:flex;justify-content:space-between;padding:4mm 8mm;font-size:8px;color:#718096;border-bottom:1px solid #e5eaf1}.fee-pdf-meta b{color:#102a52}.fee-pdf-title{text-align:center;color:#0b2f63;font-size:17px;margin:6mm 0 5mm}.fee-pdf-section{margin:0 8mm 5mm;border:1px solid #d8e0ea;border-radius:2mm;overflow:hidden}.fee-pdf-section-title{background:#0b2f63;color:#fff;font-size:8px;font-weight:800;padding:3mm 4mm;letter-spacing:.5px}.fee-pdf-grid{display:grid;grid-template-columns:1fr 1fr;padding:2mm 4mm}.fee-pdf-grid.three{grid-template-columns:1fr 1fr 1fr}.fee-pdf-grid>div{padding:3mm 2mm;border-bottom:1px dashed #e1e6ee}.fee-pdf-grid.three>div{border-bottom:0}.fee-pdf-grid label{display:block;font-size:7px;color:#8391a3;text-transform:uppercase;margin-bottom:1mm}.fee-pdf-grid strong{font-size:9px;color:#152f57}.fee-pdf-grid strong.paid{color:#16804f}.fee-pdf-amount{margin:7mm 8mm 4mm;padding:5mm;border:2px solid #1d8b5a;border-radius:2mm;background:#f7fcf9;display:flex;justify-content:space-between;align-items:center}.fee-pdf-amount span{font-size:9px;font-weight:800;color:#66778d}.fee-pdf-amount strong{font-size:21px;color:#16804f}.fee-pdf-success{text-align:center;color:#16804f;font-size:10px;font-weight:800;margin-top:4mm}.fee-pdf-note{text-align:center;color:#7b899b;font-size:7px;margin:2mm 8mm}.fee-pdf-footer{position:absolute;bottom:0;left:0;right:0;background:#0b2f63;color:#fff;padding:3mm 8mm;display:flex;justify-content:space-between;font-size:7px}</style>`;}

async function downloadElement(element,name){
    try{
        await ensurePdfLibrary();
        await window.html2pdf().set({margin:0,filename:name,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#fff"},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["avoid-all","css","legacy"]}}).from(element).save();
    }catch(e){console.error("Fee PDF download failed",e);alert("Fee slip PDF download failed. Please try again.");}
}

function addStudentPortalDownloadButtons(){document.querySelectorAll(".student-slip-modal").forEach(modal=>{if(modal.querySelector("[data-fee-download]")||!modal.querySelector(".student-slip-paper"))return;const actions=modal.querySelector(".student-slip-actions");if(!actions)return;const b=document.createElement("button");b.type="button";b.className="primary-btn";b.dataset.feeDownload="true";b.textContent="⬇ Download PDF";b.addEventListener("click",()=>{const p=modal.querySelector(".student-slip-paper");const n=(document.getElementById("topStudentName")?.textContent||"Student").trim().replace(/[^a-z0-9]+/gi,"-");downloadElement(p,`Fee-Slip-${n||"Student"}.pdf`);});actions.insertBefore(b,actions.firstChild);});}

function addAdminDownloadButtons(){const body=document.getElementById("feesTableBody");if(!body)return;body.querySelectorAll("tr").forEach(row=>{if(row.querySelector("[data-admin-fee-download]"))return;const cells=row.querySelectorAll("td");if(cells.length<9||!cells[5]?.textContent.toLowerCase().includes("paid"))return;const studentId=cells[0].textContent.trim();const actionCell=cells[8];if(!studentId||studentId==="—"||!actionCell)return;const b=document.createElement("button");b.type="button";b.className="fee-action success";b.dataset.adminFeeDownload="true";b.textContent="⬇ Download";b.style.marginLeft="6px";b.addEventListener("click",async()=>{b.disabled=true;try{const ss=await getDocs(query(collection(db,"students"),where("studentId","==",studentId)));if(ss.empty)throw new Error("Student record not found.");const sd=ss.docs[0],student={id:sd.id,...sd.data()},month=document.getElementById("feeMonth")?.value||"";const fs=await getDocs(query(collection(db,"fees"),where("studentDocId","==",sd.id)));const payment=fs.docs.map(d=>({id:d.id,...d.data()})).find(f=>f.status==="paid"&&f.month===month);if(!payment)throw new Error("Paid fee record for this month was not found.");const wrap=document.createElement("div");wrap.className="fee-pdf-wrap";wrap.innerHTML=styles()+receiptHTML(student,payment);document.body.appendChild(wrap);await new Promise(r=>setTimeout(r,300));await downloadElement(wrap.querySelector(".fee-pdf-sheet"),filename(student,payment));setTimeout(()=>wrap.remove(),1500);}catch(e){console.error(e);alert(e.message||"Unable to download fee slip.");}finally{b.disabled=false;}});actionCell.appendChild(b);});}

const observer=new MutationObserver(()=>{addStudentPortalDownloadButtons();addAdminDownloadButtons();});
observer.observe(document.body,{childList:true,subtree:true});
addStudentPortalDownloadButtons();addAdminDownloadButtons();
