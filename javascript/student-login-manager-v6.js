/* SSHACMS Student Login Manager v6
   - Adds a password field when creating a student.
   - Creates the Firebase Auth account without replacing the admin session.
   - Never stores plaintext passwords in Firestore/localStorage.
   - Adds a Login/credentials status button to each student row.
*/
(() => {
  if (window.__sshacmsStudentLoginManagerV6) return;
  window.__sshacmsStudentLoginManagerV6 = true;

  const $ = id => document.getElementById(id);
  const form = $('studentForm');
  const save = $('saveStudentBtn');
  const modal = $('studentModal');
  if (!form || !save || !modal) return;

  const FIREBASE_API_KEY = 'AIzaSyB1wfjw-zsIDxUMvAYvbbHlvNRQ4zRsgmM';
  const emailFor = id => String(id || '').trim().toUpperCase().replace(/\s+/g, '') + '@students.sshacms.local';
  let armedUntil = 0;
  let submitting = false;

  function addPasswordField() {
    if ($('studentPassword')) return;
    const grid = form.querySelector('.form-grid');
    if (!grid) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-group student-login-password-group';
    wrap.innerHTML = `
      <label for="studentPassword">Student Login Password <span style="color:#b42318">*</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="studentPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters" style="flex:1;min-width:0">
        <button type="button" id="studentPasswordToggle" class="secondary-btn" style="height:42px;padding:0 13px">👁 Show</button>
      </div>
      <small style="display:block;margin-top:5px;color:#667085;font-size:11px">Ye password sirf Firebase Authentication mein set hoga. Plain-text password database mein save nahi kiya jayega.</small>`;
    grid.appendChild(wrap);
    $('studentPasswordToggle')?.addEventListener('click', () => {
      const input = $('studentPassword');
      input.type = input.type === 'password' ? 'text' : 'password';
      $('studentPasswordToggle').textContent = input.type === 'password' ? '👁 Show' : '🙈 Hide';
    });
  }

  function addStyles() {
    if ($('sshacmsStudentLoginStylesV6')) return;
    const style = document.createElement('style');
    style.id = 'sshacmsStudentLoginStylesV6';
    style.textContent = `
      .student-login-password-group{grid-column:1/-1!important}
      #studentsTableBody td:nth-child(2){min-width:180px!important;max-width:220px!important}
      #studentsTableBody .student-name-fixed{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px;line-height:1.3}
      #studentsTableBody .student-login-action{background:#eef6ff!important;color:#174c8f!important;border:1px solid #cfe0f5!important}
      .ssh-login-modal-v6{position:fixed;inset:0;background:rgba(7,26,51,.62);display:none;align-items:center;justify-content:center;padding:18px;z-index:6000}
      .ssh-login-modal-v6.show{display:flex}.ssh-login-card-v6{width:min(430px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.3)}
      .ssh-login-head-v6{background:linear-gradient(135deg,#071a33,#245bd8);color:#fff;padding:18px 20px}.ssh-login-head-v6 h3{margin:0}.ssh-login-head-v6 p{margin:5px 0 0;font-size:12px;opacity:.85}
      .ssh-login-body-v6{padding:20px}.ssh-login-row-v6{margin-bottom:14px}.ssh-login-row-v6 label{display:block;font-size:11px;font-weight:800;color:#667085;text-transform:uppercase;margin-bottom:6px}.ssh-login-row-v6 input{width:100%;box-sizing:border-box;height:44px;padding:0 12px;border:1px solid #d0d5dd;border-radius:9px;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function addLoginModal() {
    if ($('sshStudentLoginModalV6')) return;
    const el = document.createElement('div');
    el.id = 'sshStudentLoginModalV6'; el.className = 'ssh-login-modal-v6';
    el.innerHTML = `<div class="ssh-login-card-v6" role="dialog" aria-modal="true">
      <div class="ssh-login-head-v6"><h3>🔐 Student Login</h3><p id="sshLoginStudentNameV6">Student credentials</p></div>
      <div class="ssh-login-body-v6">
        <div class="ssh-login-row-v6"><label>Student ID</label><input id="sshLoginStudentIdV6" readonly></div>
        <div class="ssh-login-row-v6"><label>Login email (system)</label><input id="sshLoginEmailV6" readonly></div>
        <div id="sshLoginStatusV6" style="padding:10px 12px;background:#ecfdf3;border:1px solid #abefc6;color:#067647;border-radius:10px;font-size:12px;margin-bottom:14px">Firebase login account is linked.</div>
        <p style="font-size:12px;color:#667085;line-height:1.5">Firebase Authentication password ko dobara show nahi karta. Password bhoolne par naya password set karna chahiye; existing password plaintext mein kahin save nahi hota.</p>
        <button type="button" id="sshLoginCloseV6" class="secondary-btn">Close</button>
      </div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('show'); });
    $('sshLoginCloseV6')?.addEventListener('click', () => el.classList.remove('show'));
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
    return { uid:data.localId, idToken:data.idToken };
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
    try {
      if (Object.values(data).some(v => !v)) throw new Error('Please fill all student fields.');
      if (password.length < 6) throw new Error('Student password must be at least 6 characters.');
      save.disabled = true; save.textContent = 'Creating Login...'; message('Student ID + Firebase login create ho raha hai...');
      const { db } = await import('../firebase/firebase-config.js');
      const { collection, addDoc, setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
      const studentId = await nextStudentId();
      const account = await createAuthAccount(studentId, password);
      idToken = account.idToken || '';
      const ref = await addDoc(collection(db,'students'), { ...data, studentId, uid:account.uid, loginEnabled:true, passwordSetAt:serverTimestamp(), createdAt:serverTimestamp() });
      await setDoc(doc(db,'studentCredentials',ref.id), { studentDocId:ref.id, studentId, uid:account.uid, email:emailFor(studentId), passwordSet:true, passwordSetAt:serverTimestamp(), updatedAt:serverTimestamp() }, {merge:true});
      message(`✓ ${studentId} ka login successfully create ho gaya. Student ID + password se login ho sakta hai.`);
      const p=$('studentPassword'); if(p)p.value='';
      setTimeout(()=>{modal.classList.remove('show');modal.setAttribute('aria-hidden','true');},900);
    } catch (error) {
      if (idToken) {
        try { await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})}); } catch (_) {}
      }
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
      btn.onclick=async()=>{try{const {db}=await import('../firebase/firebase-config.js');const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');const snap=await getDoc(doc(db,'students',id));if(!snap.exists())throw new Error('Student not found.');const s=snap.data();addLoginModal();$('sshLoginStudentNameV6').textContent=`${s.name||'Student'} • ${s.course||''} / ${s.batch||''}`;$('sshLoginStudentIdV6').value=s.studentId||'-';$('sshLoginEmailV6').value=emailFor(s.studentId||'');$('sshLoginStatusV6').textContent=s.loginEnabled===true?'✓ Firebase login account is active.':'⚠ Login account is not active.';$('sshLoginStatusV6').style.background=s.loginEnabled===true?'#ecfdf3':'#fffaeb';$('sshLoginStatusV6').style.color=s.loginEnabled===true?'#067647':'#b54708';$('sshStudentLoginModalV6').classList.add('show');}catch(err){alert('Unable to open student login: '+err.message);}};
      row.querySelector('.action-buttons')?.appendChild(btn);
    });
  }

  const body=$('studentsTableBody'); if(body)new MutationObserver(()=>requestAnimationFrame(decorateRows)).observe(body,{childList:true,subtree:true});
  addPasswordField(); addStyles(); addLoginModal(); requestAnimationFrame(decorateRows);
})();
