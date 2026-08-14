import { auth, db } from "../firebase/firebase-config.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const menuItems = [...document.querySelectorAll('.menu-item')];
const pages = [...document.querySelectorAll('.page')];
let students = [], attendanceRecords = [];
let unsubscribeStudents = null, unsubscribeAttendance = null;
let scanner = null, scannerRunning = false, lastScan = { id: '', time: 0 };

const pageTitle = $('pageTitle'), logoutBtn = $('logoutBtn');
const studentsTableBody = $('studentsTableBody'), studentSearch = $('studentSearch');
const studentCount = $('studentCount'), courseCount = $('courseCount');
const attendanceCount = $('attendanceCount'), todayAttendanceCount = $('todayAttendanceCount');
const successRate = $('successRate'), recentActivity = $('recentActivity');
const attendanceTableBody = $('attendanceTableBody'), attendanceSearch = $('attendanceSearch');
const lastScanTime = $('lastScanTime');
const studentModal = $('studentModal'), studentForm = $('studentForm'), addStudentBtn = $('addStudentBtn');
const closeModal = $('closeModal'), cancelBtn = $('cancelBtn'), editStudentId = $('editStudentId');
const studentName = $('studentName'), fatherName = $('fatherName'), phone = $('phone');
const course = $('course'), batch = $('batch'), admissionDate = $('admissionDate');
const modalTitle = $('modalTitle'), saveStudentBtn = $('saveStudentBtn'), formMessage = $('formMessage');
const startScannerBtn = $('startScannerBtn'), stopScannerBtn = $('stopScannerBtn');
const qrMessage = $('qrMessage'), scannerStatus = $('scannerStatus'), studentResult = $('studentResult'), qrReader = $('qr-reader');

/* ---------- Stable navigation ---------- */
function showPage(name) {
  const target = $(name) || $('overview');
  menuItems.forEach(item => item.classList.toggle('active', item.dataset.page === target.id));
  pages.forEach(page => page.classList.toggle('active', page === target));
  const item = menuItems.find(x => x.dataset.page === target.id);
  if (pageTitle) pageTitle.textContent = item ? item.textContent.replace(/\s+/g, ' ').trim() : 'Dashboard';
  if (target.id !== 'attendance') stopScanner();
}
menuItems.forEach(item => {
  item.type = 'button';
  item.addEventListener('click', e => { e.preventDefault(); showPage(item.dataset.page); });
});

/* ---------- Authentication ---------- */
onAuthStateChanged(auth, user => {
  if (!user) { window.location.replace('admin-login.html'); return; }
  loadStudents();
  loadAttendance();
  import('./fees.js?v=stable').catch(error => console.error('Optional admin modules:', error));
});
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  try { stopScanner(); unsubscribeStudents?.(); unsubscribeAttendance?.(); await signOut(auth); window.location.replace('admin-login.html'); }
  catch (e) { alert('Logout failed: ' + e.message); }
});

/* ---------- Students ---------- */
function resetForm() {
  studentForm?.reset();
  if (editStudentId) editStudentId.value = '';
  if (modalTitle) modalTitle.textContent = 'Add Student';
  if (saveStudentBtn) { saveStudentBtn.textContent = 'Save Student'; saveStudentBtn.disabled = false; }
  if (formMessage) formMessage.textContent = '';
}
function closeStudentModal() { studentModal?.classList.remove('show'); studentModal?.setAttribute('aria-hidden','true'); resetForm(); }
function openStudentModal() { resetForm(); studentModal?.classList.add('show'); studentModal?.setAttribute('aria-hidden','false'); }
addStudentBtn?.addEventListener('click', e => { e.preventDefault(); openStudentModal(); });
closeModal?.addEventListener('click', closeStudentModal);
cancelBtn?.addEventListener('click', closeStudentModal);
studentModal?.addEventListener('click', e => { if (e.target === studentModal) closeStudentModal(); });
function nextStudentId() {
  let max = 0;
  students.forEach(s => { const m = String(s.studentId || '').match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
  return `STU-${String(max + 1).padStart(4,'0')}`;
}
studentForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (saveStudentBtn) saveStudentBtn.disabled = true;
  if (formMessage) formMessage.textContent = 'Saving student...';
  const data = { name: studentName?.value.trim() || '', fatherName: fatherName?.value.trim() || '', phone: phone?.value.trim() || '', course: course?.value.trim() || '', batch: batch?.value.trim() || '', admissionDate: admissionDate?.value || '' };
  try {
    if (Object.values(data).some(v => !v)) throw new Error('Please fill all student fields.');
    if (editStudentId?.value) await updateDoc(doc(db,'students',editStudentId.value), data);
    else await addDoc(collection(db,'students'), { ...data, studentId: nextStudentId(), createdAt: serverTimestamp() });
    if (formMessage) formMessage.textContent = 'Student saved successfully.';
    setTimeout(closeStudentModal, 450);
  } catch (error) { console.error(error); if (formMessage) formMessage.textContent = 'Error: ' + error.message; }
  finally { if (saveStudentBtn) saveStudentBtn.disabled = false; }
});
function editStudent(id) {
  const s = students.find(x => x.id === id); if (!s) return alert('Student not found.');
  if (editStudentId) editStudentId.value=s.id; if (studentName) studentName.value=s.name||''; if (fatherName) fatherName.value=s.fatherName||'';
  if (phone) phone.value=s.phone||''; if (course) course.value=s.course||''; if (batch) batch.value=s.batch||''; if (admissionDate) admissionDate.value=s.admissionDate||'';
  if (modalTitle) modalTitle.textContent='Edit Student'; if (saveStudentBtn) saveStudentBtn.textContent='Update Student';
  studentModal?.classList.add('show'); studentModal?.setAttribute('aria-hidden','false');
}
async function deleteStudent(id) {
  const s=students.find(x=>x.id===id); if(!s) return;
  if(!confirm(`Delete ${s.name||'this student'}? This cannot be undone.`)) return;
  try { await deleteDoc(doc(db,'students',id)); } catch(e) { alert('Unable to delete student: '+e.message); }
}
function renderStudents(data) {
  if(!studentsTableBody) return;
  if(!data.length){ studentsTableBody.innerHTML='<tr><td colspan="7" class="empty">No students found.</td></tr>'; return; }
  studentsTableBody.innerHTML=data.map(s=>`<tr><td><strong>${escapeHTML(s.studentId||'-')}</strong></td><td>${escapeHTML(s.name||'-')}</td><td>${escapeHTML(s.fatherName||'-')}</td><td>${escapeHTML(s.phone||'-')}</td><td>${escapeHTML(s.course||'-')} / ${escapeHTML(s.batch||'-')}</td><td>${escapeHTML(s.admissionDate||'-')}</td><td><div class="action-buttons"><button type="button" class="action-btn edit-btn" data-id="${s.id}">✏️ Edit</button><button type="button" class="action-btn delete-btn" data-id="${s.id}">🗑️ Delete</button><button type="button" class="action-btn id-card-btn" data-id="${s.id}">🪪 ID Card</button></div></td></tr>`).join('');
  studentsTableBody.querySelectorAll('.edit-btn').forEach(b=>b.onclick=()=>editStudent(b.dataset.id));
  studentsTableBody.querySelectorAll('.delete-btn').forEach(b=>b.onclick=()=>deleteStudent(b.dataset.id));
  studentsTableBody.querySelectorAll('.id-card-btn').forEach(b=>b.onclick=()=>openStudentIDCard(b.dataset.id));
}
studentSearch?.addEventListener('input',()=>{const q=studentSearch.value.toLowerCase().trim();renderStudents(q?students.filter(s=>[s.name,s.studentId,s.phone,s.course,s.batch,s.fatherName].some(v=>String(v||'').toLowerCase().includes(q))):students);});
function createdTime(s){return s?.createdAt?.toMillis?s.createdAt.toMillis():s?.createdAt?.seconds?s.createdAt.seconds*1000:0;}
function loadStudents(){unsubscribeStudents?.();unsubscribeStudents=onSnapshot(collection(db,'students'),snap=>{students=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>createdTime(b)-createdTime(a));if(studentCount)studentCount.textContent=students.length;if(courseCount)courseCount.textContent=new Set(students.map(s=>String(s.course||'').trim().toLowerCase()).filter(Boolean)).size;renderStudents(students);updateStats();},err=>{console.error(err);if(studentsTableBody)studentsTableBody.innerHTML='<tr><td colspan="7" class="empty">Unable to load students. Check Firestore permissions.</td></tr>';});}

/* ---------- Attendance ---------- */
function dateKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function attendanceTime(r){return r?.timestamp?.toMillis?r.timestamp.toMillis():r?.timestamp?.seconds?r.timestamp.seconds*1000:0;}
function timeText(t){const d=t?.toDate?t.toDate():t?.seconds?new Date(t.seconds*1000):new Date(t||0);return Number.isNaN(d.getTime())?'--':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function loadAttendance(){unsubscribeAttendance?.();unsubscribeAttendance=onSnapshot(collection(db,'attendance'),snap=>{const today=dateKey();attendanceRecords=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.date===today).sort((a,b)=>attendanceTime(b)-attendanceTime(a));renderAttendance(attendanceRecords);updateStats();},err=>console.error(err));}
function renderAttendance(data){if(todayAttendanceCount)todayAttendanceCount.textContent=data.length;if(attendanceCount)attendanceCount.textContent=data.length;if(!attendanceTableBody)return;if(!data.length){attendanceTableBody.innerHTML='<tr><td colspan="7" class="empty">No attendance recorded today.</td></tr>';return;}attendanceTableBody.innerHTML=data.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${escapeHTML(r.studentId||'-')}</strong></td><td>${escapeHTML(r.name||'-')}</td><td>${escapeHTML(r.course||'-')}</td><td>${escapeHTML(r.batch||'-')}</td><td>${escapeHTML(r.time||timeText(r.timestamp))}</td><td><span class="scanner-status">${escapeHTML(r.status||'Present')}</span></td></tr>`).join('');if(lastScanTime)lastScanTime.textContent=data[0].time||timeText(data[0].timestamp);}
attendanceSearch?.addEventListener('input',()=>{const q=attendanceSearch.value.toLowerCase().trim();renderAttendance(q?attendanceRecords.filter(r=>[r.name,r.studentId,r.course,r.batch].some(v=>String(v||'').toLowerCase().includes(q))):attendanceRecords);});
async function markAttendance(code){const normalized=String(code||'').trim();if(!normalized)return;const now=Date.now();if(lastScan.id===normalized&&now-lastScan.time<2500)return;lastScan={id:normalized,time:now};let s=students.find(x=>String(x.studentId||'')===normalized||String(x.id||'')===normalized);if(!s){try{const snap=await getDocs(query(collection(db,'students'),where('studentId','==',normalized)));if(!snap.empty)s={id:snap.docs[0].id,...snap.docs[0].data()};}catch(e){console.error(e);}}if(!s){setQrMessage('Student not found: '+normalized,true);return;}const today=dateKey();try{const existing=await getDocs(query(collection(db,'attendance'),where('studentId','==',s.studentId),where('date','==',today)));if(!existing.empty){setQrMessage(`${s.name} is already marked present today.`);showStudentResult(s,'Already Present');return;}await addDoc(collection(db,'attendance'),{studentId:s.studentId,name:s.name||'',course:s.course||'',batch:s.batch||'',date:today,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),status:'Present',timestamp:serverTimestamp()});setQrMessage(`✓ ${s.name} marked present.`);showStudentResult(s,'Present');}catch(e){console.error(e);setQrMessage('Attendance error: '+e.message,true);}}
function showStudentResult(s,status){if(studentResult)studentResult.innerHTML=`<div style="padding:18px"><h3>${escapeHTML(s.name||'Student')}</h3><p><b>ID:</b> ${escapeHTML(s.studentId||'-')}</p><p><b>Course:</b> ${escapeHTML(s.course||'-')}</p><p><b>Batch:</b> ${escapeHTML(s.batch||'-')}</p><p><b>Status:</b> ${escapeHTML(status)}</p></div>`;}
function setQrMessage(msg,error=false){if(qrMessage)qrMessage.textContent=msg;if(scannerStatus)scannerStatus.textContent=error?'Scanner Error':'Scanner Ready';}
async function startScanner(){if(scannerRunning||!qrReader)return;if(typeof Html5Qrcode==='undefined'){setQrMessage('QR scanner library is not ready. Please refresh and try again.',true);return;}try{scanner=new Html5Qrcode('qr-reader');await scanner.start({facingMode:{exact:'environment'}},{fps:10,qrbox:{width:260,height:260}},text=>markAttendance(text),()=>{});scannerRunning=true;if(scannerStatus)scannerStatus.textContent='Camera Active';}catch(e){try{if(scanner)await scanner.clear();scanner=new Html5Qrcode('qr-reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:260}},text=>markAttendance(text),()=>{});scannerRunning=true;if(scannerStatus)scannerStatus.textContent='Camera Active';}catch(e2){scanner=null;scannerRunning=false;setQrMessage('Camera could not start. Allow camera permission and try again.',true);console.error(e2);}}}
async function stopScanner(){if(!scanner){scannerRunning=false;return;}try{if(scannerRunning)await scanner.stop();}catch(e){}try{await scanner.clear();}catch(e){}scanner=null;scannerRunning=false;if(scannerStatus)scannerStatus.textContent='Scanner Ready';}
startScannerBtn?.addEventListener('click',startScanner);stopScannerBtn?.addEventListener('click',stopScanner);

/* ---------- ID card ---------- */
function openStudentIDCard(id){const s=students.find(x=>x.id===id);if(!s)return alert('Student not found.');const w=window.open('','_blank','width=600,height=800');if(!w)return alert('Please allow pop-ups for ID cards.');const data=encodeURIComponent(s.studentId||s.id);w.document.write(`<!doctype html><html><head><title>Student ID</title><style>body{margin:0;background:#eef2f7;font-family:Arial;display:grid;place-items:center;min-height:100vh}.card{width:330px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px #0002}.head{background:#0b2f63;color:#fff;padding:22px;text-align:center}.head h2{margin:0;font-size:20px}.body{padding:22px;text-align:center}.photo{width:90px;height:90px;border-radius:50%;margin:auto;background:#e8edf5;display:grid;place-items:center;font-size:32px;color:#0b2f63;font-weight:700}.name{font-size:20px;font-weight:800;margin:14px 0 4px;color:#102a52}.id{font-size:12px;color:#6b7788;margin-bottom:16px}.row{display:flex;justify-content:space-between;border-top:1px solid #e7ebf1;padding:9px 0;font-size:11px}.qr{margin:16px auto;width:150px;height:150px}.qr img{width:100%;height:100%}.print{padding:10px 18px;border:0;border-radius:8px;background:#0b2f63;color:#fff;font-weight:700}@media print{body{background:#fff}.card{box-shadow:none}.print{display:none}}</style></head><body><div class="card"><div class="head"><h2>SIR SYED HASSAN ALI COACHING</h2><div>Student Identity Card</div></div><div class="body"><div class="photo">${escapeHTML((s.name||'S').charAt(0).toUpperCase())}</div><div class="name">${escapeHTML(s.name||'Student')}</div><div class="id">${escapeHTML(s.studentId||s.id)}</div><div class="row"><span>Father</span><b>${escapeHTML(s.fatherName||'-')}</b></div><div class="row"><span>Course</span><b>${escapeHTML(s.course||'-')}</b></div><div class="row"><span>Batch</span><b>${escapeHTML(s.batch||'-')}</b></div><div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${data}" alt="QR"></div><button class="print" onclick="print()">Print / Save PDF</button></div></div></body></html>`);w.document.close();}

function updateStats(){if(studentCount)studentCount.textContent=students.length;if(courseCount)courseCount.textContent=new Set(students.map(s=>String(s.course||'').trim().toLowerCase()).filter(Boolean)).size;if(attendanceCount)attendanceCount.textContent=attendanceRecords.length;if(todayAttendanceCount)todayAttendanceCount.textContent=attendanceRecords.length;if(successRate)successRate.textContent=students.length?`${Math.min(100,Math.round(attendanceRecords.length/students.length*100))}%`:'0%';if(recentActivity)recentActivity.innerHTML=attendanceRecords.length?attendanceRecords.slice(0,5).map(r=>`<div style="padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:13px"><strong>${escapeHTML(r.name||'Student')}</strong> marked attendance at ${escapeHTML(r.time||'--')}</div>`).join(''):'<div class="empty-state"><div class="empty-icon">📋</div><p>No recent activity yet.</p></div>';}
function escapeHTML(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
showPage('overview');
