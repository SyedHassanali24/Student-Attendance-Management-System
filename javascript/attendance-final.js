import { db } from "../firebase/firebase-config.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
  if (window.__sshacmsFinalAttendanceV2) return;
  window.__sshacmsFinalAttendanceV2 = true;

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const nowTime = () => new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const timeToMinutes = value => { const m = String(value||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i); if(!m)return null; let h=+m[1],min=+m[2]; if(m[3]){const ap=m[3].toUpperCase();if(ap==='PM'&&h<12)h+=12;if(ap==='AM'&&h===12)h=0;} return h*60+min; };
  const currentMinutes = () => { const d=new Date(); return d.getHours()*60+d.getMinutes(); };
  const statusClass = s => ({Present:'present',Late:'late',Leave:'leave',Absent:'absent'}[s]||'present');

  let students = [], records = [], selectedStudent = null, scanner = null, scannerRunning = false, busy = false;
  const defaultBatchStart = localStorage.getItem('sshacmsAttendanceStart') || '18:00';
  const defaultGrace = Number(localStorage.getItem('sshacmsAttendanceGrace') || 15);

  async function loadData() {
    const [ss, aa] = await Promise.all([getDocs(collection(db,'students')), getDocs(query(collection(db,'attendance'), where('date','==',todayKey()))) ]);
    students = ss.docs.map(d=>({id:d.id,...d.data()}));
    records = aa.docs.map(d=>({id:d.id,...d.data()}));
    renderToday();
  }

  function deriveStatus() {
    const start = timeToMinutes($('attendanceBatchStart')?.value || defaultBatchStart);
    const grace = Number($('attendanceGrace')?.value || defaultGrace);
    if(start === null) return 'Present';
    return currentMinutes() > start + grace ? 'Late' : 'Present';
  }

  function buildUI() {
    const page = $('attendance');
    if(!page || $('finalAttendancePanel')) return;
    const panel = document.createElement('div');
    panel.id='finalAttendancePanel';
    panel.innerHTML=`
      <style>
        #finalAttendancePanel{margin:0 0 18px;padding:18px;border:1px solid #dce5f0;border-radius:16px;background:#fff;box-shadow:0 8px 26px rgba(15,43,80,.05)}
        #finalAttendancePanel .fa-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.fa-title{font-weight:800;color:#102a52;font-size:16px}.fa-sub{font-size:11px;color:#718096;margin-top:4px}
        #finalAttendancePanel .fa-grid{display:grid;grid-template-columns:1.1fr .8fr .55fr auto;gap:10px;align-items:end}.fa-field{display:flex;flex-direction:column;gap:6px}.fa-field label{font-size:10px;font-weight:800;color:#53657b;text-transform:uppercase;letter-spacing:.04em}.fa-field input,.fa-field select{height:40px;box-sizing:border-box;border:1px solid #d4deea;border-radius:9px;padding:0 10px;background:#f9fbfd;color:#102a52}.fa-btn{height:40px;border:0;border-radius:9px;padding:0 15px;font-weight:800;cursor:pointer}.fa-primary{background:#0b2f63;color:#fff}.fa-gold{background:#c9972b;color:#fff}.fa-blue{background:#e8f6fb;color:#14607c;border:1px solid #b9dfea}.fa-red{background:#fff0f0;color:#b42318;border:1px solid #f1c7c7}.fa-status{margin-top:12px;min-height:18px;font-size:12px;font-weight:700}.fa-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.fa-chip{font-size:10px;font-weight:800;padding:5px 9px;border-radius:999px}.fa-chip.present{background:#e8f7ef;color:#087443}.fa-chip.late{background:#fff3bd;color:#866200}.fa-chip.leave{background:#dff3fa;color:#14607c}.fa-chip.absent{background:#ffe1e4;color:#b42318}
        #finalAttendanceTable{margin-top:14px;border-top:1px solid #e7edf4;padding-top:12px}#finalAttendanceTable table{width:100%;border-collapse:collapse;font-size:11px}#finalAttendanceTable th{text-align:left;background:#f5f8fc;color:#53657b;padding:9px}#finalAttendanceTable td{padding:9px;border-top:1px solid #edf1f5;color:#26384f}.fa-row-status{font-weight:800;padding:4px 8px;border-radius:999px;display:inline-block}.fa-row-status.present{background:#e8f7ef;color:#087443}.fa-row-status.late{background:#fff3bd;color:#866200}.fa-row-status.leave{background:#dff3fa;color:#14607c}.fa-row-status.absent{background:#ffe1e4;color:#b42318}.fa-action{border:1px solid #d8e0ea;background:#fff;border-radius:7px;padding:5px 8px;cursor:pointer;font-size:10px}.fa-action.delete{color:#b42318}.fa-empty{text-align:center;padding:20px;color:#8290a3}
        @media(max-width:800px){#finalAttendancePanel .fa-grid{grid-template-columns:1fr 1fr}.fa-head{flex-direction:column}}
      </style>
      <div class="fa-head"><div><div class="fa-title">Attendance Control</div><div class="fa-sub">QR scan automatically marks Present or Late. Admin can manually mark Leave, Absent or correct any record.</div></div><div class="fa-legend"><span class="fa-chip present">Present</span><span class="fa-chip late">Late</span><span class="fa-chip leave">Leave</span><span class="fa-chip absent">Absent</span></div></div>
      <div class="fa-grid">
        <div class="fa-field"><label>Student</label><select id="attendanceStudentSelect"><option value="">Select student for manual marking</option></select></div>
        <div class="fa-field"><label>Batch Start</label><input id="attendanceBatchStart" type="time" value="${defaultBatchStart}"></div>
        <div class="fa-field"><label>Grace (minutes)</label><input id="attendanceGrace" type="number" min="0" max="120" value="${defaultGrace}"></div>
        <button class="fa-btn fa-primary" id="saveAttendanceSettings" type="button">Save Timing</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:11px"><button class="fa-btn fa-primary" id="manualPresent" type="button">✓ Present</button><button class="fa-btn fa-gold" id="manualLate" type="button">⏱ Late</button><button class="fa-btn fa-blue" id="manualLeave" type="button">▣ Leave</button><button class="fa-btn fa-red" id="manualAbsent" type="button">✕ Absent</button></div>
      <div id="finalAttendanceStatus" class="fa-status"></div>
      <div id="finalAttendanceTable"><div class="fa-empty">Loading today's attendance...</div></div>`;
    const grid = page.querySelector('.qr-attendance-grid');
    page.querySelector('.panel')?.prepend(panel);
    if(grid) grid.style.marginTop='0';

    const select=$('attendanceStudentSelect');
    students.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.name||'Student'} — ${s.studentId||s.id}`;select.appendChild(o);});
    $('saveAttendanceSettings').onclick=()=>{localStorage.setItem('sshacmsAttendanceStart',$('attendanceBatchStart').value);localStorage.setItem('sshacmsAttendanceGrace',$('attendanceGrace').value);setStatus('✓ Timing saved. Future QR scans will use this timing.','ok');};
    [['manualPresent','Present'],['manualLate','Late'],['manualLeave','Leave'],['manualAbsent','Absent']].forEach(([id,status])=>$(id).onclick=()=>manualMark(status));
    $('attendanceStudentSelect').onchange=()=>{selectedStudent=students.find(s=>s.id===select.value)||null;};
  }

  function setStatus(text,kind='') { const el=$('finalAttendanceStatus');if(!el)return;el.textContent=text;el.style.color=kind==='error'?'#b42318':kind==='ok'?'#087443':'#53657b'; }
  function getStudent(id){return students.find(s=>s.id===id||String(s.studentId)===String(id));}

  async function findRecord(studentId){
    const q=await getDocs(query(collection(db,'attendance'),where('studentId','==',studentId),where('date','==',todayKey())));
    return q.empty?null:{id:q.docs[0].id,...q.docs[0].data()};
  }

  async function saveStatus(student,status){
    if(!student)return setStatus('Please select a student first.','error');
    if(busy)return; busy=true;
    try{
      const existing=await findRecord(student.studentId);
      const payload={studentId:student.studentId,name:student.name||'',course:student.course||'',batch:student.batch||'',date:todayKey(),status,updatedAt:serverTimestamp()};
      if(status==='Present'||status==='Late') payload.time=nowTime();
      else if(existing?.time) payload.time=existing.time;
      if(existing) await updateDoc(doc(db,'attendance',existing.id),payload); else await addDoc(collection(db,'attendance'),{...payload,timestamp:serverTimestamp()});
      setStatus(`✓ ${student.name||'Student'} marked ${status}.`,'ok');
      await loadData();
    }catch(e){console.error(e);setStatus('Attendance could not be saved: '+e.message,'error');}
    finally{busy=false;}
  }
  async function manualMark(status){await saveStatus(selectedStudent,status);}

  async function deleteRecord(id){if(!confirm('Remove this attendance record? The student will become unmarked for today.'))return;try{await deleteDoc(doc(db,'attendance',id));setStatus('✓ Attendance record removed.','ok');await loadData();}catch(e){setStatus('Delete failed: '+e.message,'error');}}
  async function editStatus(id){const r=records.find(x=>x.id===id);if(!r)return;const s=getStudent(r.studentId);const next=prompt('Enter status: Present, Late, Leave or Absent',r.status||'Present');if(!next)return;const status=next.trim().toLowerCase();const normalized=status==='present'?'Present':status==='late'?'Late':status==='leave'?'Leave':status==='absent'?'Absent':null;if(!normalized)return alert('Use only Present, Late, Leave or Absent.');await saveStatus(s,normalized);}

  function renderToday(){
    const el=$('finalAttendanceTable');if(!el)return;
    if(!records.length){el.innerHTML='<div class="fa-empty">No attendance marked today.</div>';return;}
    const sorted=[...records].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    el.innerHTML=`<table><thead><tr><th>Student</th><th>ID</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>${sorted.map(r=>`<tr><td><strong>${escapeHtml(r.name||'-')}</strong></td><td>${escapeHtml(r.studentId||'-')}</td><td>${escapeHtml(r.time||'-')}</td><td><span class="fa-row-status ${statusClass(r.status)}">${escapeHtml(r.status||'Present')}</span></td><td><button class="fa-action" data-edit="${r.id}">Edit</button> <button class="fa-action delete" data-delete="${r.id}">Remove</button></td></tr>`).join('')}</tbody></table>`;
    el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editStatus(b.dataset.edit));el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRecord(b.dataset.delete));
  }

  async function scan(code){
    const value=String(code||'').trim();if(!value)return;const student=getStudent(value);if(!student){setStatus(`Student not found for QR: ${value}`,'error');return;}
    selectedStudent=student;if($('attendanceStudentSelect'))$('attendanceStudentSelect').value=student.id;
    const existing=await findRecord(student.studentId);if(existing){setStatus(`${student.name} is already marked ${existing.status}. Use Edit to change it.`);return;}
    await saveStatus(student,deriveStatus());
  }

  async function start(){
    if(scannerRunning)return;if(typeof Html5Qrcode==='undefined'){setStatus('QR scanner library is not loaded. Refresh the page.','error');return;}
    try{scanner=new Html5Qrcode('qr-reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:260}},scan,()=>{});scannerRunning=true;setStatus('Camera active. Scan a student QR code.','ok');}catch(e){try{if(scanner)await scanner.clear();scanner=new Html5Qrcode('qr-reader');await scanner.start({facingMode:'user'},{fps:10,qrbox:{width:260,height:260}},scan,()=>{});scannerRunning=true;setStatus('Camera active. Scan a student QR code.','ok');}catch(e2){console.error(e2);setStatus('Camera could not start. Allow camera permission and try again.','error');}}
  }
  async function stop(){if(!scanner)return;try{if(scannerRunning)await scanner.stop();}catch(e){}try{await scanner.clear();}catch(e){}scanner=null;scannerRunning=false;setStatus('Scanner stopped.');}

  function replaceOriginalScannerButtons(){
    const start=$('startScannerBtn'),stop=$('stopScannerBtn');
    if(start){const n=start.cloneNode(true);start.replaceWith(n);n.onclick=startScannerFinal;}
    if(stop){const n=stop.cloneNode(true);stop.replaceWith(n);n.onclick=stop;}
  }
  async function startScannerFinal(){await start();}

  async function init(){
    try{await loadData();buildUI();replaceOriginalScannerButtons();}
    catch(e){console.error('Final attendance init:',e);setStatus('Could not load attendance data: '+e.message,'error');}
  }

  const wait=()=>{if($('attendance')&&$('qr-reader'))init();else setTimeout(wait,250);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wait,{once:true});else wait();
})();
