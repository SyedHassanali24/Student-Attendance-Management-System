/* SSHACMS — STUDENT LOGIN CREATOR
   Admin creates the Firebase Authentication account through the Firebase Auth REST API.
   This keeps the admin's Firebase session active (no auto-logout).
   Password is NOT stored in Firestore.
*/
(() => {
  if (window.__sshacmsStudentAccountFix) return;
  window.__sshacmsStudentAccountFix = true;

  const $ = id => document.getElementById(id);
  const form = $('studentForm');
  const save = $('saveStudentBtn');
  const modal = $('studentModal');
  if (!form || !save || !modal) return;

  const FIREBASE_API_KEY = 'AIzaSyB1wfjw-zsIDxUMvAYvbbHlvNRQ4zRsgmM';
  let armedUntil = 0;
  let submitting = false;

  const emailFor = id => String(id || '').trim().toUpperCase().replace(/\s+/g, '') + '@students.sshacms.local';
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));

  function addPasswordField() {
    if ($('studentPassword')) return;
    const grid = form.querySelector('.form-grid');
    if (!grid) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-group student-login-password-group';
    wrap.innerHTML = `
      <label for="studentPassword">Student Login Password <span style="color:#d92d20">*</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="studentPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters" style="flex:1;min-width:0">
        <button type="button" id="studentPasswordToggle" class="secondary-btn" style="height:42px;padding:0 13px">👁 Show</button>
      </div>
      <small style="display:block;margin-top:5px;color:#667085;font-size:11px">New student ke liye password zaroor set karein. Password database mein save nahi hota.</small>`;
    grid.appendChild(wrap);
    $('studentPasswordToggle')?.addEventListener('click', () => {
      const input = $('studentPassword');
      input.type = input.type === 'password' ? 'text' : 'password';
      $('studentPasswordToggle').textContent = input.type === 'password' ? '👁 Show' : '🙈 Hide';
    });
  }

  function addStyles() {
    if ($('sshacmsStudentFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'sshacmsStudentFixStyles';
    style.textContent = `
      .student-login-password-group{grid-column:1/-1!important}
      #studentsTableBody td:nth-child(2){min-width:180px!important;max-width:220px!important}
      #studentsTableBody .student-name-fixed{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px;line-height:1.3}
      #studentsTableBody .student-login-action{background:#eef6ff!important;color:#174c8f!important;border:1px solid #cfe0f5!important}
      .ssh-login-modal{position:fixed;inset:0;background:rgba(7,26,51,.62);display:none;align-items:center;justify-content:center;padding:18px;z-index:6000}
      .ssh-login-modal.show{display:flex}.ssh-login-card{width:min(430px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.3)}
      .ssh-login-head{background:linear-gradient(135deg,#071a33,#245bd8);color:#fff;padding:18px 20px}.ssh-login-head h3{margin:0}.ssh-login-head p{margin:5px 0 0;font-size:12px;opacity:.85}
      .ssh-login-body{padding:20px}.ssh-login-row{margin-bottom:14px}.ssh-login-row label{display:block;font-size:11px;font-weight:800;color:#667085;text-transform:uppercase;margin-bottom:6px}.ssh-login-row input{width:100%;box-sizing:border-box;height:44px;padding:0 12px;border:1px solid #d0d5dd;border-radius:9px;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function addLoginModal() {
    if ($('sshStudentLoginModal')) return;
    const el = document.createElement('div');
    el.id = 'sshStudentLoginModal'; el.className = 'ssh-login-modal';
    el.innerHTML = `<div class="ssh-login-card" role="dialog" aria-modal="true">
      <div class="ssh-login-head"><h3>🔐 Student Login</h3><p id="sshLoginStudentName">Student credentials</p></div>
      <div class="ssh-login-body">
        <div class="ssh-login-row"><label>Student ID</label><input id="sshLoginStudentId" readonly></div>
        <div class="ssh-login-row"><label>Login email (system)</label><input id="sshLoginEmail" readonly></div>
        <p style="font-size:12px;color:#667085;line-height:1.5">Firebase purana password show nahi karta. Agar password bhool jayein to Firebase Authentication se password reset karein.</p>
        <button type="button" id="sshLoginClose" class="secondary-btn">Close</button>
      </div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('show'); });
    $('sshLoginClose')?.addEventListener('click', () => el.classList.remove('show'));
  }

  function message(text, error=false) {
    const el = $('formMessage');
    if (el) { el.textContent = text; el.style.color = error ? '#b42318' : '#174c8f'; }
  }

  async function nextStudentId() {
    const { db } = await import('../firebase/firebase-config.js');
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
    const snap = await getDocs(collection(db, 'students'));
    let max = 0;
    snap.docs.forEach(d => { const m = String(d.data()?.studentId || '').match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    return `STU-${String(max + 1).padStart(4,'0')}`;
  }

  async function createAuthAccount(studentId, password) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:emailFor(studentId), password, returnSecureToken:true})
    });
    const data = await response.json();
    if (!response.ok) {
      const code = data?.error?.message || 'AUTH_CREATE_FAILED';
      if (code.includes('OPERATION_NOT_ALLOWED')) throw new Error('Firebase Authentication mein Email/Password provider ON nahi hai.');
      if (code.includes('EMAIL_EXISTS')) throw new Error('Is Student ID ka login pehle se bana hua hai.');
      if (code.includes('WEAK_PASSWORD')) throw new Error('Password kam az kam 6 characters ka hona chahiye.');
      throw new Error('Firebase login create nahi ho saka: ' + code);
    }
    return data.localId;
  }

  async function deleteAuthAccount(idToken) {
    try { await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})}); } catch (_) {}
  }

  function arm() { armedUntil = Date.now() + 2500; }
  save.addEventListener('pointerdown', arm, {capture:true});
  save.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') arm(); }, {capture:true});

  form.addEventListener('submit', async e => {
    const editId = $('editStudentId')?.value || '';
    if (editId || Date.now() > armedUntil || submitting) return;
    e.preventDefault(); e.stopImmediatePropagation();
    submitting = true;
    const password = String($('studentPassword')?.value || '');
    const data = {
      name:$('studentName')?.value.trim() || '', fatherName:$('fatherName')?.value.trim() || '',
      phone:$('phone')?.value.trim() || '', course:$('course')?.value.trim() || '',
      batch:$('batch')?.value.trim() || '', admissionDate:$('admissionDate')?.value || ''
    };
    let idToken = '';
    let studentDocId = '';
    try {
      if (Object.values(data).some(v => !v)) throw new Error('Please fill all student fields.');
      if (password.length < 6) throw new Error('Student password must be at least 6 characters.');
      save.disabled = true; save.textContent = 'Creating Login...'; message('Student ID + Firebase login create ho raha hai...');

      const { auth, db } = await import('../firebase/firebase-config.js');
      const { collection, addDoc, serverTimestamp, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
      const studentId = await nextStudentId();
      const email = emailFor(studentId);

      // Create Auth account first. This does NOT touch the admin's current Firebase session.
      const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password,returnSecureToken:true})
      });
      const authData = await authResponse.json();
      if (!authResponse.ok) {
        const code = authData?.error?.message || 'AUTH_CREATE_FAILED';
        if (code.includes('OPERATION_NOT_ALLOWED')) throw new Error('Firebase Authentication mein Email/Password provider ON nahi hai.');
        if (code.includes('EMAIL_EXISTS')) throw new Error('Is Student ID ka login pehle se bana hua hai.');
        if (code.includes('WEAK_PASSWORD')) throw new Error('Password kam az kam 6 characters ka hona chahiye.');
        throw new Error('Firebase login create nahi ho saka: ' + code);
      }
      idToken = authData.idToken || '';
      const uid = authData.localId;

      // Admin session is still active here, so Firestore rules allow this write.
      const ref = await addDoc(collection(db,'students'), { ...data, studentId, uid, loginEnabled:true, createdAt:serverTimestamp() });
      studentDocId = ref.id;

      message(`✓ ${studentId} ka login successfully create ho gaya. Ab Student ID + password se login ho sakta hai.`);
      const p=$('studentPassword'); if(p)p.value='';
      setTimeout(()=>{modal.classList.remove('show');modal.setAttribute('aria-hidden','true');},900);
    } catch (error) {
      if (idToken) await deleteAuthAccount(idToken);
      console.error('Student account creation failed:',error);
      message(error?.message || 'Unable to create student login.',true);
      save.disabled=false; save.textContent='Save Student';
    } finally { submitting=false; }
  }, {capture:true});

  function decorateRows() {
    document.querySelectorAll('#studentsTableBody tr').forEach(row=>{
      const cells=row.querySelectorAll('td'); if(!cells.length||cells.length<7)return;
      const nameCell=cells[1];
      if(nameCell&&!nameCell.querySelector('.student-name-fixed')){
        const name=nameCell.textContent.trim()||'-'; nameCell.textContent='';
        const span=document.createElement('span'); span.className='student-name-fixed'; span.textContent=name; span.title=name; nameCell.appendChild(span);
      }
      if(row.querySelector('.student-login-action'))return;
      const id=row.querySelector('[data-id]')?.dataset?.id; if(!id)return;
      const btn=document.createElement('button'); btn.type='button'; btn.className='action-btn student-login-action'; btn.dataset.id=id; btn.textContent='🔐 Login';
      btn.onclick=async()=>{try{const {db}=await import('../firebase/firebase-config.js');const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');const snap=await getDoc(doc(db,'students',id));if(!snap.exists())throw new Error('Student not found.');const s=snap.data();addLoginModal();$('sshLoginStudentName').textContent=`${s.name||'Student'} • ${s.course||''} / ${s.batch||''}`;$('sshLoginStudentId').value=s.studentId||'-';$('sshLoginEmail').value=emailFor(s.studentId||'');$('sshStudentLoginModal').classList.add('show');}catch(err){alert('Unable to open student login: '+err.message);}};
      row.querySelector('.action-buttons')?.appendChild(btn);
    });
  }

  const body=$('studentsTableBody'); if(body)new MutationObserver(()=>requestAnimationFrame(decorateRows)).observe(body,{childList:true,subtree:true});
  addPasswordField(); addStyles(); addLoginModal(); requestAnimationFrame(decorateRows);
})();
