import { auth, db } from "../firebase/firebase-config.js";
import { collection, doc, addDoc, updateDoc, getDocs, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* SSHACMS — SAFE ATTENDANCE ENHANCER
   One control center only. The existing dashboard table remains owned by admin.js.
   Check-in is always the first scan; check-out is allowed only after 5 full minutes.
*/
(() => {
  if (window.__sshacmsSafeAttendanceLoaded) return;
  window.__sshacmsSafeAttendanceLoaded = true;

  const $ = id => document.getElementById(id);
  let students = [], records = [], scanner = null, running = false;
  let camera = "environment", unsubStudents = null, unsubAttendance = null;
  let lastText = "", lastAt = 0;

  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const clock = d => d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const mins = d => d.getHours()*60+d.getMinutes();
  const esc = v => String(v ?? "").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

  function schedule(s){
    const t=`${s?.course||""} ${s?.batch||""}`.toLowerCase();
    return /1st\s*year|first\s*year|2nd\s*year|second\s*year/.test(t)
      ? {start:1170,label:"7:30 PM - 9:00 PM"}
      : {start:1080,label:"6:00 PM - 8:00 PM"};
  }
  function status(s,d){ return mins(d) > schedule(s).start + 15 ? "Late" : "Present"; }
  function message(text,error=false){ const n=$("safeScannerMessage"); if(n){n.textContent=text;n.style.color=error?"#b42318":"#667085";} }

  function addStyles(){
    if($("safeAttendanceStyles")) return;
    const s=document.createElement("style");s.id="safeAttendanceStyles";
    s.textContent=`
      #safeAttendanceControls{margin-bottom:22px}.sa{background:#fff;border:1px solid #dfe6ef;border-radius:20px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.07)}
      .sa-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.sa-kicker{font-size:10px;letter-spacing:.14em;font-weight:800;color:#a17a22}.sa h3{margin:5px 0;color:#102a57}.sa p,.sa-hint{color:#667085;font-size:12px}.sa-live{background:#ecfdf3;color:#067647;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:800}
      .sa-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.sa-box{background:#fbfcfe;border:1px solid #e6ebf2;border-radius:14px;padding:15px}.sa-box>b{display:block;color:#152b55;margin-bottom:10px}.sa-flex{display:flex;gap:8px;flex-wrap:wrap}.sa-btn{border:1px solid #d0d7e2;background:#fff;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer}.sa-primary{background:#102f64;color:#fff}.sa-warn{background:#fff8e7;color:#9a6700}.sa-danger{background:#fff1f3;color:#b42318}.sa-box input,.sa-box select{min-height:40px;border:1px solid #d0d7e2;border-radius:9px;padding:0 10px;flex:1;min-width:130px}.sa-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:14px}.sa-stat{padding:12px;background:#f8fafc;border:1px solid #edf1f5;border-radius:12px;display:flex;justify-content:space-between}.sa-stat b{font-size:18px;color:#102a57}
      @media(max-width:900px){.sa-grid{grid-template-columns:1fr}.sa-summary{grid-template-columns:1fr 1fr}}@media(max-width:560px){.sa-head{flex-direction:column}.sa-summary{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function removeDuplicateControls(){
    const all=[...document.querySelectorAll("#safeAttendanceControls")];
    all.slice(1).forEach(x=>x.remove());
  }

  function addUI(){
    const page=$("attendance");if(!page)return;
    removeDuplicateControls();
    if($("safeAttendanceControls")) return;
    const wrap=document.createElement("div");wrap.id="safeAttendanceControls";
    wrap.innerHTML=`<div class="sa">
      <div class="sa-head"><div><span class="sa-kicker">ATTENDANCE CONTROL CENTER</span><h3>Check-in, Check-out & Daily Exceptions</h3><p>First scan = arrival. Check-out is allowed only after 5 minutes. 15-minute late rule is automatic.</p></div><span class="sa-live">● Live</span></div>
      <div class="sa-grid">
        <div class="sa-box"><b>Camera Scanner</b><div class="sa-hint" id="safeCameraLabel">Rear camera selected</div><div class="sa-flex"><button type="button" class="sa-btn sa-primary" id="safeStart">Start Scanner</button><button type="button" class="sa-btn" id="safeStop">Stop</button><button type="button" class="sa-btn" id="safeSwitch">Switch Camera</button></div><div class="sa-hint" id="safeScannerMessage">Use rear or front camera as required.</div></div>
        <div class="sa-box"><b>Batch Timing</b><div class="sa-hint"><strong>Class 1 → Matric:</strong> 6:00 PM - 8:00 PM</div><div class="sa-hint"><strong>1st Year + 2nd Year:</strong> 7:30 PM - 9:00 PM</div><div class="sa-hint">Late after 15 minutes from the batch start time.</div></div>
      </div>
      <div class="sa-grid">
        <div class="sa-box"><b>Mark Student Leave</b><div class="sa-flex"><select id="safeLeaveStudent"><option value="">Select student</option></select><input id="safeLeaveDate" type="date"><input id="safeLeaveReason" placeholder="Reason (optional)"><button type="button" class="sa-btn sa-warn" id="safeLeaveBtn">Mark Leave</button></div></div>
        <div class="sa-box"><b>Coaching Off / Pakistan Public Holiday</b><div class="sa-flex"><input id="safeOffDate" type="date"><select id="safeOffType"><option value="coaching_off">Coaching Off</option><option value="government_holiday">Government / Public Holiday</option></select><input id="safeOffReason" placeholder="Holiday / off reason"><button type="button" class="sa-btn sa-danger" id="safeOffBtn">Mark Day Off</button></div><div class="sa-hint">No attendance is expected on a saved off day.</div></div>
      </div><div class="sa-summary" id="safeSummary"></div></div>`;
    const grid=page.querySelector(".qr-attendance-grid");
    grid?.parentElement ? grid.parentElement.insertBefore(wrap,grid) : page.prepend(wrap);
    $("safeLeaveDate").value=today();$("safeOffDate").value=today();
    $("safeStart").onclick=start;$("safeStop").onclick=stop;$("safeSwitch").onclick=switchCamera;$("safeLeaveBtn").onclick=markLeave;$("safeOffBtn").onclick=markOff;
    $("startScannerBtn")?.style.setProperty("display","none");$("stopScannerBtn")?.style.setProperty("display","none");
  }

  async function start(){
    if(running)return;if(typeof Html5Qrcode==="undefined"){message("QR scanner library is not ready. Refresh once and try again.",true);return;}
    try{await stop();const reader=$("qr-reader");if(!reader)return;reader.innerHTML="";scanner=new Html5Qrcode("qr-reader");await scanner.start({facingMode:camera},{fps:10,qrbox:{width:250,height:250},aspectRatio:1},onScan,()=>{});running=true;updateCameraLabel();message(`Scanner active — ${camera==="environment"?"rear":"front"} camera.`);}
    catch(e){console.error("Safe attendance camera error:",e);running=false;scanner=null;message("Unable to start camera. Allow camera permission and use HTTPS.",true);}
  }
  async function stop(){if(!scanner){running=false;return;}try{if(running)await scanner.stop();}catch(_){}try{await scanner.clear();}catch(_){}scanner=null;running=false;}
  async function switchCamera(){camera=camera==="environment"?"user":"environment";updateCameraLabel();if(running){await stop();await start();}}
  function updateCameraLabel(){const n=$("safeCameraLabel");if(n)n.textContent=camera==="environment"?"Rear camera selected":"Front camera selected";}

  function recordMillis(r){
    if(r?.checkInAt?.toMillis)return r.checkInAt.toMillis();
    if(r?.timestamp?.toMillis)return r.timestamp.toMillis();
    if(r?.checkInAt?.seconds)return r.checkInAt.seconds*1000;
    if(r?.timestamp?.seconds)return r.timestamp.seconds*1000;
    return 0;
  }

  async function onScan(decodedText){
    const now=Date.now();if(decodedText===lastText&&now-lastAt<2500)return;lastText=decodedText;lastAt=now;
    let parsed;try{parsed=JSON.parse(String(decodedText).trim());}catch(_){parsed={studentId:String(decodedText).trim()};}
    const sid=parsed?.studentId;const student=students.find(s=>String(s.studentId||"")===String(sid));
    if(!student)return message(`Student not found: ${sid||"unknown ID"}`,true);
    const date=today();if(await isDayOff(date))return message("Coaching is OFF today. No attendance is expected.",true);if(await isOnLeave(student.id,date))return message(`${student.name} is on leave today.`,true);
    const existing=records.find(r=>r.date===date&&(r.studentDocId===student.id||r.studentId===student.studentId));const d=new Date();
    try{
      if(!existing){
        const st=status(student,d);const stamp=clock(d);
        await addDoc(collection(db,"attendance"),{studentDocId:student.id,studentId:student.studentId||"",name:student.name||"",fatherName:student.fatherName||"",phone:student.phone||"",course:student.course||"",batch:student.batch||"",date,time:stamp,checkInTime:stamp,checkOutTime:"",checkInAt:serverTimestamp(),status:st,attendanceMode:"check-in-out",scheduleStart:schedule(student).label,timestamp:serverTimestamp()});
        message(`${student.name} checked in at ${stamp} — ${st}.`);
      }else if(!existing.checkOutTime){
        const checkedInAt=recordMillis(existing);const elapsed=checkedInAt?Math.floor((Date.now()-checkedInAt)/60000):0;
        if(elapsed<5){const remaining=5-elapsed;return message(`${student.name} is checked in. Check-out will be available after ${remaining} more minute${remaining===1?"":"s"}.`,true);}
        const out=clock(d);await updateDoc(doc(db,"attendance",existing.id),{checkOutTime:out,exitStatus:"Checked Out",lastUpdatedAt:serverTimestamp()});message(`${student.name} checked out at ${out}.`);
      }else message(`${student.name} already has check-in and check-out today.`);
    }catch(e){console.error(e);message("Attendance error: "+e.message,true);}
  }

  async function isDayOff(date){try{return !(await getDocs(query(collection(db,"coachingDays"),where("date","==",date)))).empty;}catch(_){return false;}}
  async function isOnLeave(id,date){try{return !(await getDocs(query(collection(db,"studentLeaves"),where("studentDocId","==",id),where("date","==",date)))).empty;}catch(_){return false;}}
  async function markLeave(){const id=$("safeLeaveStudent")?.value,date=$("safeLeaveDate")?.value||today(),reason=$("safeLeaveReason")?.value.trim()||"Personal leave";const s=students.find(x=>x.id===id);if(!s)return alert("Please select a student.");try{if(await isOnLeave(s.id,date))return alert("Leave is already marked.");await addDoc(collection(db,"studentLeaves"),{studentDocId:s.id,studentId:s.studentId||"",name:s.name||"",date,reason,status:"Leave",createdAt:serverTimestamp()});alert(`${s.name} marked on leave for ${date}.`);}catch(e){alert("Unable to mark leave: "+e.message);}}
  async function markOff(){const date=$("safeOffDate")?.value||today(),type=$("safeOffType")?.value||"coaching_off",reason=$("safeOffReason")?.value.trim()||(type==="government_holiday"?"Government / Public Holiday":"Coaching Off");try{if(await isDayOff(date))return alert("Off day already exists.");await addDoc(collection(db,"coachingDays"),{date,type,reason,country:type==="government_holiday"?"Pakistan":"",createdAt:serverTimestamp()});alert(`${reason} saved for ${date}.`);}catch(e){alert("Unable to save: "+e.message);}}

  function fillLeaveStudents(){const select=$("safeLeaveStudent");if(!select)return;const value=select.value;select.innerHTML='<option value="">Select student</option>'+students.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))).map(s=>`<option value="${esc(s.id)}">${esc(s.name)} — ${esc(s.studentId)}</option>`).join("");if(value)select.value=value;}
  function updateSummary(){const n=$("safeSummary");if(!n)return;const present=records.filter(r=>r.status==="Present").length,late=records.filter(r=>r.status==="Late").length,leave=records.filter(r=>r.status==="Leave").length,out=records.filter(r=>r.checkOutTime).length;n.innerHTML=`<div class="sa-stat"><span>Present</span><b>${present}</b></div><div class="sa-stat"><span>Late</span><b>${late}</b></div><div class="sa-stat"><span>Leave</span><b>${leave}</b></div><div class="sa-stat"><span>Checked Out</span><b>${out}</b></div>`;}

  function boot(){
    if(!auth.currentUser)return setTimeout(boot,300);
    addStyles();addUI();removeDuplicateControls();
    unsubStudents?.();unsubAttendance?.();
    unsubStudents=onSnapshot(collection(db,"students"),snap=>{students=snap.docs.map(d=>({id:d.id,...d.data()}));fillLeaveStudents();});
    unsubAttendance=onSnapshot(collection(db,"attendance"),snap=>{const d=today();records=snap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.date===d);updateSummary();});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
