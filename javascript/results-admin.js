import { db, storage } from "../firebase/firebase-config.js";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const esc = s => String(s ?? "").replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const percentage = (total, obtained) => total > 0 ? Math.max(0, Math.min(100, Number(obtained || 0) / Number(total) * 100)) : 0;
const grade = p => p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";
const status = p => p >= 50 ? "PASSED" : "NEEDS IMPROVEMENT";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function injectStyles() {
  if (document.getElementById("sshacms-results-style")) return;
  const s = document.createElement("style"); s.id = "sshacms-results-style";
  s.textContent = `
  .sr-wrap{background:#fff;border:1px solid #dce5ef;border-radius:18px;padding:22px;box-shadow:0 12px 35px rgba(15,31,56,.06)}
  .sr-tabs{display:flex;gap:10px;margin:18px 0}.sr-tab{border:1px solid #d6dfeb;background:#fff;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer;color:#20324d}.sr-tab.active{background:#0b4dcc;color:#fff;border-color:#0b4dcc}
  .sr-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sr-field label{display:block;font-size:10px;font-weight:800;color:#63738b;margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em}.sr-field input,.sr-field select,.sr-field textarea{width:100%;box-sizing:border-box;border:1px solid #d7e0ec;border-radius:9px;padding:10px 11px;background:#fbfcfe;font:inherit}.sr-field textarea{min-height:76px;resize:vertical}.sr-full{grid-column:1/-1}
  .sr-rows{margin-top:16px;border:1px solid #e1e7ef;border-radius:12px;overflow:hidden}.sr-row{display:grid;grid-template-columns:1.55fr .65fr .7fr .75fr 42px;gap:8px;padding:9px;border-bottom:1px solid #e8edf3;align-items:center}.sr-row.head{background:#f3f6fa;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase}.sr-row input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #d9e1eb;border-radius:7px}.sr-percent{background:#f2f7ff!important;color:#0b4dcc!important;font-weight:800}.sr-remove{border:0;background:#feecec;color:#c62828;border-radius:7px;padding:8px;cursor:pointer}
  .sr-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.sr-btn{border:0;border-radius:9px;padding:11px 16px;font-weight:800;cursor:pointer}.sr-btn.primary{background:#0b4dcc;color:#fff}.sr-btn.secondary{background:#eef3f9;color:#24354d}.sr-msg{margin-top:12px;font-weight:700;font-size:13px}
  .sr-table{width:100%;border-collapse:collapse;margin-top:16px}.sr-table th,.sr-table td{padding:10px;border-bottom:1px solid #e7ecf2;text-align:left;font-size:12px}.sr-table th{font-size:10px;text-transform:uppercase;color:#66768d;background:#f7f9fc}.sr-pill{display:inline-flex;padding:5px 9px;border-radius:99px;background:#e8f7ef;color:#18794e;font-weight:800}.sr-mini{font-size:11px;color:#607089}.sr-history{margin-top:24px}.sr-note{font-size:12px;color:#718096}.sr-type-card{border:1px solid #dfe7f0;border-radius:12px;padding:14px;background:#fbfcff;margin-bottom:14px}.sr-type-card h3{margin:0 0 4px;font-size:15px}.sr-type-card p{margin:0;color:#718096;font-size:12px}
  @media(max-width:800px){.sr-grid{grid-template-columns:1fr}.sr-row{grid-template-columns:1fr 1fr 1fr 1fr 40px}.sr-row.head{display:none}}
  `; document.head.appendChild(s);
}

function rowHtml(type) {
  const key = type === "academic" ? "subject" : "module";
  const placeholder = type === "academic" ? "Mathematics" : "HTML & CSS";
  return `<div class="sr-row"><input data-k="${key}" placeholder="${placeholder}"><input data-k="total" type="number" value="100" min="1"><input data-k="obtained" type="number" value="0" min="0"><input data-k="percentage" class="sr-percent" value="0.0%" readonly><button type="button" class="sr-remove">×</button></div>`;
}

function renderAdmin() {
  injectStyles();
  const page = document.getElementById("results");
  if (!page || page.dataset.resultsReady) return;
  page.dataset.resultsReady = "1";
  page.innerHTML = `<div class="sr-wrap"><div class="panel-header"><div><h2>🎓 Results & Certificates</h2><p>Create premium result sheets and course certificates, save the exact PDF and publish it to the student's portal.</p></div></div><div class="sr-tabs"><button class="sr-tab active" data-type="academic">Academic Result</button><button class="sr-tab" data-type="course">Course / Professional Certificate</button></div><div id="srForm"></div><div class="sr-history"><h3>Published Results</h3><p class="sr-note">The same PDF generated here is stored in Firebase and shown to the student.</p><div id="srHistory">Loading...</div></div></div>`;
  let type = "academic", studentList = [];
  const form = page.querySelector("#srForm");

  async function loadStudents() {
    const snap = await getDocs(collection(db, "students"));
    studentList = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => String(a.name||"").localeCompare(String(b.name||"")));
    renderForm();
  }

  function renderForm() {
    const isA = type === "academic";
    form.innerHTML = `<div class="sr-type-card"><h3>${isA ? "Premium Academic Result" : "Premium Course Completion Certificate"}</h3><p>${isA ? "School, O Level, Matric, Intermediate or examination result." : "Web Development, Computer, English Language and any future professional course."}</p></div><div class="sr-grid"><div class="sr-field"><label>Student</label><select id="srStudent"><option value="">Select student</option>${studentList.map(s => `<option value="${esc(s.id)}">${esc(s.name||"Student")} — ${esc(s.studentId||s.id)}</option>`).join("")}</select></div><div class="sr-field"><label>Result / Issue Date</label><input id="srDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>${isA ? `<div class="sr-field"><label>Exam / Term</label><input id="srExam" placeholder="Monthly Test / Mid Term / Final"></div><div class="sr-field"><label>Class / Section</label><input id="srClass" placeholder="Class 10 / O Level"></div>` : `<div class="sr-field"><label>Course Name</label><input id="srCourse" placeholder="Web Development / English Language"></div><div class="sr-field"><label>Duration</label><input id="srDuration" placeholder="3 Months / 8 Weeks"></div><div class="sr-field"><label>Instructor</label><input id="srInstructor" placeholder="Instructor name"></div><div class="sr-field"><label>Certificate ID</label><input id="srCertificate" placeholder="SSHAC-2026-001"></div>`}<div class="sr-field sr-full"><label>Remarks / Achievement</label><textarea id="srRemarks" placeholder="Excellent performance, successfully completed the course, etc."></textarea></div></div><div class="sr-rows"><div class="sr-row head"><div>${isA ? "Subject" : "Module"}</div><div>Total</div><div>Obtained</div><div>Percentage</div><div></div></div><div id="srRows">${rowHtml(type)}${rowHtml(type)}${rowHtml(type)}</div></div><div class="sr-actions"><button type="button" class="sr-btn secondary" id="srAdd">+ Add ${isA ? "Subject" : "Module"}</button><button type="button" class="sr-btn primary" id="srGenerate">Generate, Download & Publish</button></div><div class="sr-msg" id="srMsg"></div>`;

    const rows = () => [...form.querySelectorAll("#srRows .sr-row")].map(r => Object.fromEntries([...r.querySelectorAll("input[data-k]")].map(i => [i.dataset.k, i.value]))).filter(x => x.subject || x.module);
    const recalc = () => form.querySelectorAll("#srRows .sr-row").forEach(r => { const t=Number(r.querySelector('[data-k="total"]')?.value||0), o=Number(r.querySelector('[data-k="obtained"]')?.value||0), p=r.querySelector('[data-k="percentage"]'); if(p) p.value = percentage(t,o).toFixed(1)+"%"; });
    const bindRows = () => form.querySelectorAll(".sr-remove").forEach(b => b.onclick = () => { b.parentElement.remove(); recalc(); });
    form.addEventListener("input", recalc); bindRows();
    form.querySelector("#srAdd").onclick = () => { form.querySelector("#srRows").insertAdjacentHTML("beforeend", rowHtml(type)); bindRows(); recalc(); };

    form.querySelector("#srGenerate").onclick = async () => {
      const msg=form.querySelector("#srMsg"), student=studentList.find(s=>s.id===form.querySelector("#srStudent").value);
      if(!student){msg.textContent="Please select a student.";return;}
      const entries=rows().map(e=>({...e, total:Number(e.total||0), obtained:Number(e.obtained||0), percentage:Number(percentage(e.total,e.obtained).toFixed(1))}));
      if(!entries.length){msg.textContent=`Add at least one ${isA?"subject":"module"}.`;return;}
      if(entries.some(e=>e.total<=0 || e.obtained<0 || e.obtained>e.total)){msg.textContent="Please check total and obtained marks.";return;}
      msg.textContent="Creating premium PDF...";
      try {
        const r={resultType:type,studentName:student.name||"Student",studentId:student.studentId||student.id,studentDocId:student.id,resultDate:form.querySelector("#srDate").value,exam:form.querySelector("#srExam")?.value||"",className:form.querySelector("#srClass")?.value||"",courseName:form.querySelector("#srCourse")?.value||student.course||"",duration:form.querySelector("#srDuration")?.value||"",instructor:form.querySelector("#srInstructor")?.value||"",certificateId:form.querySelector("#srCertificate")?.value||`SSHAC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,remarks:form.querySelector("#srRemarks").value,entries};
        const total=r.entries.reduce((a,e)=>a+e.total,0),obt=r.entries.reduce((a,e)=>a+e.obtained,0),overallPercentage=percentage(total,obt),overallGrade=grade(overallPercentage);
        r.totalMarks=total;r.obtainedMarks=obt;r.overallPercentage=Number(overallPercentage.toFixed(1));r.overallGrade=overallGrade;r.status=status(overallPercentage);
        await loadScript(CDN); const {jsPDF}=window.jspdf; const pdf=makePDF(jsPDF,r); const blob=pdf.output("blob");
        const safeName=(r.studentName||"Student").replace(/[^a-z0-9_-]+/gi,"-");
        downloadBlob(blob,`${safeName}-${r.resultType==="academic"?"Result":"Certificate"}-${r.resultDate}.pdf`);
        const resultId=`${r.studentId}-${Date.now()}`,storageRef=ref(storage,`results/${r.studentId}/${resultId}.pdf`);
        await uploadBytes(storageRef,blob,{contentType:"application/pdf",cacheControl:"public,max-age=31536000"});
        const pdfUrl=await getDownloadURL(storageRef);
        await addDoc(collection(db,"results"),{...r,resultId,pdfUrl,published:true,createdAt:serverTimestamp(),publishedAt:serverTimestamp()});
        msg.textContent="✓ PDF downloaded, saved and published. The student's portal now has the exact same PDF.";
        loadHistory();
      } catch(e){console.error(e);msg.textContent="Could not create/publish PDF: "+e.message;}
    };
    recalc();
  }

  page.querySelectorAll(".sr-tab").forEach(b=>b.onclick=()=>{page.querySelectorAll(".sr-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");type=b.dataset.type;renderForm();});
  loadStudents(); loadHistory();
}

function makePDF(jsPDF,r){
  const pdf=new jsPDF({unit:"mm",format:"a4"}),W=210,H=297;
  const navy=[8,38,82],blue=[15,76,151],gold=[199,151,56],ink=[27,42,65],muted=[103,118,139],light=[246,248,252],line=[215,224,235],white=[255,255,255],green=[28,126,82];
  const border=()=>{pdf.setDrawColor(...line);pdf.setLineWidth(.5);pdf.roundedRect(8,8,W-16,H-16,4,4,"S");pdf.setDrawColor(...gold);pdf.setLineWidth(1);pdf.line(14,14,52,14);pdf.line(W-52,14,W-14,14);pdf.line(14,H-14,52,H-14);pdf.line(W-52,H-14,W-14,H-14)};
  const header=(title,subtitle)=>{pdf.setFillColor(...navy);pdf.rect(0,0,W,43,"F");pdf.setFillColor(...gold);pdf.rect(0,40,W,3,"F");pdf.setFillColor(...white);pdf.circle(25,21,11,"F");pdf.setDrawColor(...gold);pdf.setLineWidth(1);pdf.circle(25,21,8.5,"S");pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(11);pdf.text("SS",25,24,{align:"center"});pdf.setTextColor(...white);pdf.setFont("helvetica","bold");pdf.setFontSize(17);pdf.text("SIR SYED HASSAN ALI",42,17);pdf.setFont("helvetica","normal");pdf.setFontSize(8.2);pdf.text("COACHING MANAGEMENT SYSTEM",42,24);pdf.setFont("helvetica","bold");pdf.setFontSize(8.5);pdf.text(title,W-15,16,{align:"right"});pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text(subtitle,W-15,23,{align:"right"})};
  const footer=()=>{pdf.setDrawColor(...line);pdf.setLineWidth(.4);pdf.line(16,278,W-16,278);pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text("Sir Syed Hassan Ali Coaching Management System",16,285);pdf.text(`ID: ${r.certificateId||r.studentId}`,W-16,285,{align:"right"});pdf.text("Electronically generated official document",W/2,291,{align:"center"})};
  const info=(label,value,x,y)=>{pdf.setTextColor(...muted);pdf.setFont("helvetica","bold");pdf.setFontSize(6.5);pdf.text(label.toUpperCase(),x,y);pdf.setTextColor(...ink);pdf.setFont("helvetica","normal");pdf.setFontSize(8.7);pdf.text(String(value||"-"),x,y+7)};
  border();
  if(r.resultType==="course") return makeCertificate(pdf,r,{W,H,navy,blue,gold,ink,muted,line,white,green,border,header,footer,info});
  header("ACADEMIC RESULT","OFFICIAL STUDENT RECORD");
  pdf.setTextColor(...ink);pdf.setFont("helvetica","bold");pdf.setFontSize(19);pdf.text(r.studentName||"Student",16,59);pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(7.5);pdf.text("STUDENT PERFORMANCE STATEMENT",16,65);
  pdf.setFillColor(...light);pdf.roundedRect(16,70,W-32,25,3,3,"F");pdf.setDrawColor(...line);pdf.roundedRect(16,70,W-32,25,3,3,"S");
  info("Student ID",r.studentId,21,78);info("Exam / Term",r.exam||"-",72,78);info("Class / Section",r.className||"-",125,78);info("Result Date",r.resultDate||"-",168,78);
  let y=107;pdf.setFillColor(...navy);pdf.roundedRect(16,y-8,W-32,12,2,2,"F");pdf.setTextColor(...white);pdf.setFont("helvetica","bold");pdf.setFontSize(7.5);pdf.text("SUBJECT",21,y);pdf.text("TOTAL",118,y);pdf.text("OBTAINED",142,y);pdf.text("PERCENTAGE",170,y);y+=12;
  r.entries.forEach((e,i)=>{if(i%2===0){pdf.setFillColor(249,250,252);pdf.rect(16,y-6,W-32,10,"F")}pdf.setDrawColor(...line);pdf.setLineWidth(.3);pdf.line(16,y+4,W-16,y+4);pdf.setTextColor(...ink);pdf.setFont("helvetica","normal");pdf.setFontSize(8.2);pdf.text(String(e.subject||"-").slice(0,46),21,y);pdf.text(String(e.total),123,y,{align:"right"});pdf.text(String(e.obtained),151,y,{align:"right"});pdf.setFont("helvetica","bold");pdf.setTextColor(...blue);pdf.text(`${Number(e.percentage).toFixed(1)}%`,193,y,{align:"right"});y+=10;});
  y+=6;pdf.setFillColor(...light);pdf.roundedRect(16,y,W-32,39,4,4,"F");pdf.setDrawColor(...line);pdf.roundedRect(16,y,W-32,39,4,4,"S");
  pdf.setTextColor(...muted);pdf.setFont("helvetica","bold");pdf.setFontSize(6.8);pdf.text("TOTAL PERFORMANCE",23,y+10);pdf.setTextColor(...ink);pdf.setFontSize(13);pdf.text(`${r.obtainedMarks} / ${r.totalMarks}`,23,y+21);pdf.setFontSize(6.5);pdf.setTextColor(...muted);pdf.text("MARKS",23,y+29);
  pdf.setDrawColor(...gold);pdf.setLineWidth(1.6);pdf.circle(106,y+19,12,"S");pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(13);pdf.text(`${r.overallPercentage.toFixed(1)}%`,106,y+22,{align:"center"});pdf.setFontSize(6.5);pdf.setTextColor(...muted);pdf.text("OVERALL PERCENTAGE",106,y+32,{align:"center"});
  pdf.setTextColor(...navy);pdf.setFontSize(17);pdf.text(r.overallGrade,177,y+21,{align:"center"});pdf.setFontSize(6.5);pdf.setTextColor(...muted);pdf.text("FINAL GRADE",177,y+31,{align:"center"});
  y+=49;pdf.setFillColor(...(r.overallPercentage>=50?[235,248,241]:[255,243,243]));pdf.roundedRect(16,y,W-32,13,3,3,"F");pdf.setTextColor(...(r.overallPercentage>=50?green:[177,48,48]));pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text(r.status,W/2,y+8,{align:"center"});
  y+=23;pdf.setTextColor(...muted);pdf.setFont("helvetica","bold");pdf.setFontSize(6.8);pdf.text("REMARKS",18,y);pdf.setDrawColor(...line);pdf.line(18,y+3,W-18,y+3);pdf.setTextColor(...ink);pdf.setFont("helvetica","normal");pdf.setFontSize(8);const lines=pdf.splitTextToSize(r.remarks||"No remarks provided.",174);pdf.text(lines,18,y+11);
  pdf.setDrawColor(...[170,180,192]);pdf.setLineWidth(.4);pdf.line(18,264,72,264);pdf.line(138,264,192,264);pdf.setTextColor(...muted);pdf.setFontSize(6.8);pdf.text("Authorized Signature",18,270);pdf.text("Administration",138,270);footer();return pdf;
}

function makeCertificate(pdf,r,c){
  const {W,H,navy,blue,gold,ink,muted,line,white,green,footer,info}=c;
  pdf.setFillColor(...navy);pdf.rect(0,0,W,43,"F");pdf.setFillColor(...gold);pdf.rect(0,40,W,3,"F");pdf.setFillColor(...white);pdf.circle(25,21,11,"F");pdf.setDrawColor(...gold);pdf.setLineWidth(1);pdf.circle(25,21,8.5,"S");pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(11);pdf.text("SS",25,24,{align:"center"});pdf.setTextColor(...white);pdf.setFont("helvetica","bold");pdf.setFontSize(16);pdf.text("SIR SYED HASSAN ALI",42,17);pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.text("COACHING MANAGEMENT SYSTEM",42,24);pdf.setFont("helvetica","bold");pdf.setFontSize(8.5);pdf.text("CERTIFICATE OF COMPLETION",W-15,16,{align:"right"});pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text("OFFICIAL COURSE CERTIFICATE",W-15,23,{align:"right"});
  pdf.setTextColor(...gold);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("CERTIFICATE OF ACHIEVEMENT",W/2,61,{align:"center"});pdf.setTextColor(...ink);pdf.setFont("helvetica","bold");pdf.setFontSize(24);pdf.text(r.studentName||"Student",W/2,79,{align:"center"});pdf.setDrawColor(...gold);pdf.setLineWidth(.8);pdf.line(55,85,155,85);
  pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.text("is hereby recognized for successfully completing",W/2,96,{align:"center"});pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(17);pdf.text(r.courseName||"Professional Course",W/2,109,{align:"center"});
  pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.text(`Duration: ${r.duration||"-"}   •   Instructor: ${r.instructor||"-"}`,W/2,119,{align:"center"});
  let y=133;pdf.setFillColor(...light);pdf.roundedRect(22,y,166,45,4,4,"F");pdf.setDrawColor(...line);pdf.roundedRect(22,y,166,45,4,4,"S");pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(7.5);pdf.text("COURSE PERFORMANCE",W/2,y+10,{align:"center"});pdf.setTextColor(...ink);pdf.setFontSize(10);pdf.text(`${r.obtainedMarks} / ${r.totalMarks} marks`,62,y+23,{align:"center"});pdf.text(`${r.overallPercentage.toFixed(1)}%`,105,y+23,{align:"center"});pdf.text(`Grade ${r.overallGrade}`,148,y+23,{align:"center"});pdf.setTextColor(...muted);pdf.setFontSize(6.5);pdf.text("TOTAL / OBTAINED",62,y+31,{align:"center"});pdf.text("OVERALL PERCENTAGE",105,y+31,{align:"center"});pdf.text("FINAL GRADE",148,y+31,{align:"center"});pdf.setTextColor(...green);pdf.setFontSize(8);pdf.text(r.status,W/2,y+40,{align:"center"});
  y=190;pdf.setTextColor(...muted);pdf.setFont("helvetica","bold");pdf.setFontSize(7);pdf.text("MODULES COMPLETED",18,y);y+=8;r.entries.slice(0,8).forEach((e,i)=>{pdf.setTextColor(...ink);pdf.setFont("helvetica","normal");pdf.setFontSize(7.8);pdf.text(`${i+1}. ${String(e.module||"-").slice(0,45)}`,22,y);pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.text(`${Number(e.percentage).toFixed(1)}%`,188,y,{align:"right"});y+=8});
  pdf.setTextColor(...muted);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.text(`Certificate ID: ${r.certificateId}`,18,250);pdf.text(`Issue Date: ${r.resultDate}`,192,250,{align:"right"});pdf.setDrawColor(...[170,180,192]);pdf.setLineWidth(.4);pdf.line(18,264,72,264);pdf.line(138,264,192,264);pdf.setTextColor(...muted);pdf.setFontSize(6.8);pdf.text("Authorized Signature",18,270);pdf.text("Director / Administration",138,270);footer();return pdf;
}

async function loadHistory(){
  const box=document.getElementById("srHistory"); if(!box)return;
  try{const snap=await getDocs(query(collection(db,"results"),orderBy("createdAt","desc")));if(snap.empty){box.innerHTML='<p class="sr-note">No results published yet.</p>';return;}
    box.innerHTML=`<table class="sr-table"><thead><tr><th>Student</th><th>Type</th><th>Percentage</th><th>Grade</th><th>Date</th><th>PDF</th></tr></thead><tbody>${snap.docs.map(d=>{const r=d.data();const p=r.overallPercentage!=null?Number(r.overallPercentage):(()=>{let t=0,o=0;(r.entries||[]).forEach(e=>{t+=Number(e.total||0);o+=Number(e.obtained||0)});return percentage(t,o)})();const g=r.overallGrade||grade(p);return `<tr><td><b>${esc(r.studentName)}</b><br><span class="sr-mini">${esc(r.studentId)}</span></td><td>${r.resultType==="academic"?"Academic":"Certificate"}</td><td>${p.toFixed(1)}%</td><td><b>${g}</b></td><td>${esc(r.resultDate||"-")}</td><td><a href="${esc(r.pdfUrl)}" target="_blank" rel="noopener">View</a> · <a href="${esc(r.pdfUrl)}" download>Download</a></td></tr>`}).join("")}</tbody></table>`;
  }catch(e){box.innerHTML=`<p class="sr-note">Unable to load result history: ${esc(e.message)}</p>`;}
}

function boot(){if(document.getElementById("results"))renderAdmin();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
