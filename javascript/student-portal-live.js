/* SSHACMS — FINAL LIVE STUDENT PORTAL
   Keeps the existing UI but makes every dashboard value live from Firestore. */
import { auth, db } from "../firebase/firebase-config.js";
import { collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

(() => {
  if (window.__sshacmsStudentPortalLive) return;
  window.__sshacmsStudentPortalLive = true;

  const $ = id => document.getElementById(id);
  const text = (id, value) => { document.querySelectorAll(`#${id}`).forEach(e => e.textContent = value ?? "—"); };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const monthNow = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
  const dateValue = r => String(r?.date || r?.attendanceDate || "").slice(0,10);
  const status = r => String(r?.status || "").toLowerCase().trim();
  const isPresent = s => s === "present" || s === "p";
  const isLate = s => s === "late" || s === "l";
  const isAbsent = s => s === "absent" || s === "a";
  const isLeave = s => s === "leave" || s === "on leave" || s === "lv";

  let student = null, attendance=[], fees=[], results=[];
  let pie=null, line=null;

  async function findStudent(user) {
    const saved = localStorage.getItem("studentDocId");
    if (saved) { try { const d=await getDocs(query(collection(db,"students"),where("uid","==",user.uid))); const hit=d.docs.find(x=>x.id===saved); if(hit)return {id:hit.id,...hit.data()}; } catch(_){} }
    const attempts=[];
    if(user.uid) attempts.push(query(collection(db,"students"),where("uid","==",user.uid)));
    if(user.email) attempts.push(query(collection(db,"students"),where("email","==",user.email)));
    const sid=localStorage.getItem("studentId"); if(sid) attempts.push(query(collection(db,"students"),where("studentId","==",sid)));
    for(const q of attempts){ try { const s=await getDocs(q); if(!s.empty){const d=s.docs[0];return {id:d.id,...d.data()};} } catch(e){console.warn(e);} }
    return null;
  }

  async function loadCollection(name, student) {
    const qs=[query(collection(db,name),where("studentDocId","==",student.id))];
    if(student.studentId) qs.push(query(collection(db,name),where("studentId","==",student.studentId)));
    const all=[];
    for(const q of qs){ try { const s=await getDocs(q); s.docs.forEach(d=>all.push({id:d.id,...d.data()})); } catch(e){ console.warn(name,e); } }
    return [...new Map(all.map(x=>[x.id,x])).values()];
  }

  function renderProfile(){
    const name=student.name||student.studentName||"Student", sid=student.studentId||"—";
    text("welcomeName",name); text("welcomeStudentId",sid); text("topStudentName",name); text("topStudentId",sid);
    text("profileName",name); text("profileStudentId",sid); text("profileFatherName",student.fatherName||"—"); text("profilePhone",student.phone||"—"); text("profileCourse",student.course||"—"); text("profileBatch",student.batch||"—");
    document.querySelectorAll("#profileAvatar").forEach(a=>a.textContent=name.trim().charAt(0).toUpperCase()||"S");
  }

  function renderAttendance(){
    let present=0,late=0,absent=0,leave=0;
    attendance.forEach(r=>{const s=status(r);if(isPresent(s))present++;else if(isLate(s))late++;else if(isAbsent(s))absent++;else if(isLeave(s))leave++;});
    const attended=present+late, counted=attended+absent;
    const pct=counted?Math.round(attended/counted*100):0;
    text("attendancePercent",`${pct}%`); text("presentDays",present); text("absentDays",absent); text("attendancePagePercent",`${pct}%`); text("attendancePagePresent",present); text("attendancePageAbsent",absent); text("attendancePageLate",late); text("attendancePageLeave",leave); text("legendPresent",present); text("legendAbsent",absent); text("legendLate",late); text("legendLeave",leave); text("attendanceStatus",counted?`${attended} of ${counted} days attended`:"No attendance data"); text("overviewAttendance",`${pct}% attendance`);
    renderCharts(present,late,absent,leave); renderAttendanceTable();
  }

  function renderAttendanceTable(){
    const body=$("attendanceTableBody"); if(!body)return;
    const rows=[...attendance].sort((a,b)=>dateValue(b).localeCompare(dateValue(a)));
    if(!rows.length){body.innerHTML='<tr><td colspan="4">No attendance records found.</td></tr>';return;}
    body.innerHTML=rows.map(r=>`<tr><td>${esc(dateValue(r)||"—")}</td><td><span class="attendance-status ${statusClass(r.status)}">${esc(r.status||"—")}</span></td><td>${esc(r.course||student.course||"—")}</td><td>${esc(r.batch||student.batch||"—")}</td></tr>`).join("");
  }

  function statusClass(v){const s=status({status:v});return isPresent(s)?"present":isLate(s)?"late":isAbsent(s)?"absent":isLeave(s)?"leave":"";}

  function renderCharts(present,late,absent,leave){
    if(typeof Chart==="undefined")return;
    const pc=$("attendancePieChart"), lc=$("attendanceLineChart");
    if(pc){if(pie)pie.destroy();pie=new Chart(pc,{type:"doughnut",data:{labels:["Present","Late","Absent","Leave"],datasets:[{data:[present,late,absent,leave],backgroundColor:["#12b981","#f2b01e","#ef4444","#4f6bed"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{display:false}}}});}
    if(lc){if(line)line.destroy();const rows=[...attendance].sort((a,b)=>dateValue(a).localeCompare(dateValue(b))).slice(-14);line=new Chart(lc,{type:"line",data:{labels:rows.map(r=>dateValue(r).slice(5)),datasets:[{label:"Attendance",data:rows.map(r=>isPresent(status(r))?1:isLate(status(r))?.5:0),tension:.35,fill:false,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:1,ticks:{stepSize:.5,callback:v=>v===1?"Present":v===.5?"Late":"Absent"}}},plugins:{legend:{display:false}}}});}
  }

  function renderFees(){
    const month=monthNow(), paid=fees.filter(f=>String(f.month)===month&&String(f.status).toLowerCase()==="paid")[0];
    const amount=Number(paid?.amount ?? student.monthlyFee ?? student.fee ?? 0), ok=!!paid;
    text("feeStatus",ok?"Paid":"Pending"); text("overviewFee",ok?`₨ ${amount.toLocaleString("en-PK")} paid`:amount?`₨ ${amount.toLocaleString("en-PK")} pending`:"Fee pending"); text("feeMonthLabel",formatMonth(month)); text("feePageStatus",ok?`Your fee of ₨ ${amount.toLocaleString("en-PK")} has been paid.`:amount?`Your monthly fee of ₨ ${amount.toLocaleString("en-PK")} is pending.`:"Your fee is pending for this month.");
    const badge=$("feePageBadge");if(badge){badge.textContent=ok?"✓ Paid":"Pending";badge.classList.toggle("paid",ok);}
    const body=$("feeTableBody");if(!body)return;if(!fees.length){body.innerHTML='<tr><td colspan="4">No fee payment records found.</td></tr>';return;}body.innerHTML=[...fees].sort((a,b)=>String(b.month).localeCompare(String(a.month))).map(f=>{const p=String(f.status).toLowerCase()==="paid";return `<tr><td>${esc(formatMonth(f.month))}</td><td>₨ ${Number(f.amount||0).toLocaleString("en-PK")}</td><td>${esc(f.paymentDate||"—")}</td><td><span class="fee-badge ${p?"paid":""}">${p?"✓ Paid":"Pending"}</span></td></tr>`}).join("");
  }

  function formatMonth(v){if(!v)return"—";const [y,m]=String(v).split("-");if(!m)return String(v);return new Date(Number(y),Number(m)-1,1).toLocaleDateString("en-US",{month:"long",year:"numeric"});}

  function renderResults(){
    const box=$("resultsContainer");if(!box)return;const published=results.filter(r=>r.published!==false);
    text("overviewResults",published.length?`${published.length} result record${published.length>1?"s":""} available`:"No result published yet");
    if(!published.length){box.innerHTML='<div class="empty-panel"><div>▣</div><h3>No Published Results</h3><p>Your results will appear here once administration publishes them.</p></div>';return;}
    box.innerHTML=published.map(r=>{let total=Number(r.totalMarks||r.total||0),obt=Number(r.marks||r.obtained||0);if(Array.isArray(r.entries)){total=r.entries.reduce((n,e)=>n+Number(e.total||0),0);obt=r.entries.reduce((n,e)=>n+Number(e.obtained||0),0);}const p=Number(r.percentage??r.percent??(total?obt/total*100:0));return `<div class="dashboard-card result-card"><div class="card-heading"><div><h3>${esc(r.testName||r.examName||r.exam||r.title||r.courseName||"Result")}</h3><p>${esc(r.resultDate||r.date||r.month||"")}</p></div><strong>${esc(r.overallGrade||r.grade||grade(p))}</strong></div><div class="result-details"><div><span>Marks</span><strong>${obt} / ${total||"—"}</strong></div><div><span>Percentage</span><strong>${p.toFixed(1)}%</strong></div><div><span>Grade</span><strong>${esc(r.overallGrade||r.grade||grade(p))}</strong></div></div>${r.pdfUrl?`<div style="margin-top:15px"><a href="${esc(r.pdfUrl)}" target="_blank" rel="noopener" download class="pdf-result-btn">⬇ Save / Download PDF</a></div>`:""}</div>`}).join("");
  }
  function grade(p){return p>=90?"A+":p>=80?"A":p>=70?"B":p>=60?"C":p>=50?"D":"F";}

  function live(){
    const queries=[query(collection(db,"attendance"),where("studentDocId","==",student.id))];if(student.studentId)queries.push(query(collection(db,"attendance"),where("studentId","==",student.studentId)));
    const maps=[new Map(),new Map()];queries.forEach((q,i)=>onSnapshot(q,s=>{s.docs.forEach(d=>maps[i].set(d.id,{id:d.id,...d.data()}));attendance=[...new Map([...maps[0].values(),...maps[1].values()].map(x=>[x.id,x])).values()];renderAttendance();}));
    getFeesLive(); getResultsLive();
  }
  function getFeesLive(){const qs=[query(collection(db,"fees"),where("studentDocId","==",student.id))];if(student.studentId)qs.push(query(collection(db,"fees"),where("studentId","==",student.studentId)));const maps=[new Map(),new Map()];qs.forEach((q,i)=>onSnapshot(q,s=>{s.docs.forEach(d=>maps[i].set(d.id,{id:d.id,...d.data()}));fees=[...new Map([...maps[0].values(),...maps[1].values()].map(x=>[x.id,x])).values()];renderFees();}));}
  function getResultsLive(){const qs=[query(collection(db,"results"),where("studentDocId","==",student.id))];if(student.studentId)qs.push(query(collection(db,"results"),where("studentId","==",student.studentId)));const maps=[new Map(),new Map()];qs.forEach((q,i)=>onSnapshot(q,s=>{s.docs.forEach(d=>maps[i].set(d.id,{id:d.id,...d.data()}));results=[...new Map([...maps[0].values(),...maps[1].values()].map(x=>[x.id,x])).values()];renderResults();}));}

  function nav(){document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.section;document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".dashboard-section").forEach(s=>s.classList.toggle("active",s.id===id));const titles={overview:"Dashboard",attendance:"Attendance",fees:"Fee Management",results:"Examination Results",announcements:"Announcements",profile:"My Profile"};text("pageTitle",titles[id]||"Dashboard");}));}

  onAuthStateChanged(auth,async user=>{if(!user)return;student=await findStudent(user);if(!student)return;localStorage.setItem("studentDocId",student.id);localStorage.setItem("studentId",student.studentId||"");renderProfile();nav();live();});
})();
