/* SSHACMS — STUDENT ACCOUNT CREATION FIX
   Creates a Firebase Auth login for every NEW student without logging the admin out.
   Password is entered by the admin and is NEVER stored in Firestore.
   A password can be changed later by using the Firebase Authentication console.
*/
(() => {
  if (window.__sshacmsStudentAccountFix) return;
  window.__sshacmsStudentAccountFix = true;

  const $ = id => document.getElementById(id);
  const form = $('studentForm');
  const save = $('saveStudentBtn');
  const modal = $('studentModal');
  if (!form || !save || !modal) return;

  let firebase = null;
  let secondaryAuth = null;
  let armedUntil = 0;
  let submitting = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
  }[m]));

  function emailFor(studentId) {
    return String(studentId || '').trim().toUpperCase().replace(/\s+/g, '') + '@students.sshacms.local';
  }

  function addPasswordField() {
    if ($('studentPassword')) return;
    const grid = form.querySelector('.form-grid');
    if (!grid) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-group student-login-password-group';
    wrap.innerHTML = `
      <label for="studentPassword">Student Login Password <span style="color:#d92d20">*</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="studentPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters" style="flex:1;min-width:0" required>
        <button type="button" id="studentPasswordToggle" class="secondary-btn" style="height:42px;padding:0 13px">👁 Show</button>
      </div>
      <small style="display:block;margin-top:5px;color:#667085;font-size:11px">Ye password Student Portal login ke liye hoga. System is password ko database mein save nahi karega.</small>`;
    grid.appendChild(wrap);
    $('studentPasswordToggle')?.addEventListener('click', () => {
      const input = $('studentPassword');
      if (!input) return;
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
      .ssh-login-actions{display:flex;gap:8px;justify-content:flex-end}.ssh-login-actions button{border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer}.ssh-primary{background:#174c8f;color:#fff}.ssh-secondary{background:#eef2f6;color:#344054}
    `;
    document.head.appendChild(style);
  }

  function addLoginModal() {
    if ($('sshStudentLoginModal')) return;
    const el = document.createElement('div');
    el.id = 'sshStudentLoginModal';
    el.className = 'ssh-login-modal';
    el.innerHTML = `
      <div class="ssh-login-card" role="dialog" aria-modal="true">
        <div class="ssh-login-head"><h3>🔐 Student Login</h3><p id="sshLoginStudentName">Student credentials</p></div>
        <div class="ssh-login-body">
          <div class="ssh-login-row"><label>Student ID</label><input id="sshLoginStudentId" readonly></div>
          <div class="ssh-login-row"><label>Login email (system)</label><input id="sshLoginEmail" readonly></div>
          <p style="font-size:12px;color:#667085;line-height:1.5">Password Firebase Authentication mein securely managed hota hai, is liye system purana password dobara show nahi karta.</p>
          <div class="ssh-login-actions"><button type="button" id="sshLoginClose" class="ssh-secondary">Close</button></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('show'); });
    $('sshLoginClose')?.addEventListener('click', () => el.classList.remove('show'));
  }

  async function loadFirebase() {
    if (firebase) return firebase;
    const [{ auth, db }, appMod, authMod, fsMod] = await Promise.all([
      import('../firebase/firebase-config.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
    ]);
    let secondaryApp;
    try { secondaryApp = appMod.getApp('studentProvisioning'); }
    catch (_) { secondaryApp = appMod.initializeApp(auth.app.options, 'studentProvisioning'); }
    secondaryAuth = authMod.getAuth(secondaryApp);
    firebase = { auth, db, ...authMod, ...fsMod };
    return firebase;
  }

  async function nextStudentId() {
    const f = await loadFirebase();
    const snap = await f.getDocs(f.collection(f.db, 'students'));
    let max = 0;
    snap.docs.forEach(d => { const m = String(d.data()?.studentId || '').match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    return `STU-${String(max + 1).padStart(4,'0')}`;
  }

  function showMessage(text, error=false) {
    const el = $('formMessage');
    if (el) { el.textContent = text; el.style.color = error ? '#b42318' : '#174c8f'; }
  }

  async function createStudentAccount(data, password) {
    const f = await loadFirebase();
    const studentId = await nextStudentId();
    const email = emailFor(studentId);
    const credential = await f.createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = credential.user;
    try {
      const studentRef = f.doc(f.collection(f.db, 'students'));
      await f.setDoc(studentRef, {
        ...data,
        studentId,
        uid: user.uid,
        loginEnabled: true,
        createdAt: f.serverTimestamp()
      });
      await f.signOut(secondaryAuth);
      return { studentId, email, uid:user.uid };
    } catch (error) {
      try { await f.deleteUser(user); } catch (_) {}
      try { await f.signOut(secondaryAuth); } catch (_) {}
      throw error;
    }
  }

  function armSubmit() { armedUntil = Date.now() + 2500; }
  save.addEventListener('pointerdown', armSubmit, {capture:true});
  save.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') armSubmit(); }, {capture:true});

  form.addEventListener('submit', async e => {
    const editId = $('editStudentId')?.value || '';
    // Editing remains owned by admin.js. Password creation is only for NEW students.
    if (editId || Date.now() > armedUntil || submitting) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    submitting = true;

    const password = String($('studentPassword')?.value || '');
    const data = {
      name: $('studentName')?.value.trim() || '',
      fatherName: $('fatherName')?.value.trim() || '',
      phone: $('phone')?.value.trim() || '',
      course: $('course')?.value.trim() || '',
      batch: $('batch')?.value.trim() || '',
      admissionDate: $('admissionDate')?.value || ''
    };

    try {
      if (Object.values(data).some(v => !v)) throw new Error('Please fill all student fields.');
      if (password.length < 6) throw new Error('Student password must be at least 6 characters.');
      save.disabled = true;
      save.textContent = 'Creating Login...';
      showMessage('Creating Student ID + Firebase login...');
      const result = await createStudentAccount(data, password);
      showMessage(`✓ ${result.studentId} created successfully. Student can now login with this ID and the password you set.`);
      const p = $('studentPassword'); if (p) p.value = '';
      setTimeout(() => { modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }, 900);
    } catch (error) {
      console.error('Student account creation failed:', error);
      let text = error?.message || 'Unable to create student login.';
      if (error?.code === 'auth/email-already-in-use') text = 'Is Student ID ka Firebase login pehle se maujood hai. Existing student ko Edit karein.';
      if (error?.code === 'auth/operation-not-allowed') text = 'Firebase Authentication mein Email/Password provider ON nahi hai.';
      if (error?.code === 'auth/invalid-email') text = 'Generated student login email invalid hai. Student ID check karein.';
      showMessage(text, true);
      save.disabled = false;
      save.textContent = 'Save Student';
    } finally {
      submitting = false;
    }
  }, {capture:true});

  function decorateRows() {
    document.querySelectorAll('#studentsTableBody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (!cells.length || cells.length < 7) return;
      const nameCell = cells[1];
      if (nameCell && !nameCell.querySelector('.student-name-fixed')) {
        const name = nameCell.textContent.trim() || '-';
        nameCell.textContent = '';
        const span = document.createElement('span');
        span.className = 'student-name-fixed';
        span.textContent = name;
        span.title = name;
        nameCell.appendChild(span);
      }
      if (row.querySelector('.student-login-action')) return;
      const id = row.querySelector('[data-id]')?.dataset?.id;
      if (!id) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-btn student-login-action';
      btn.dataset.id = id;
      btn.textContent = '🔐 Login';
      btn.addEventListener('click', async () => {
        try {
          const f = await loadFirebase();
          const snap = await f.getDoc(f.doc(f.db, 'students', id));
          if (!snap.exists()) throw new Error('Student not found.');
          const s = snap.data();
          addLoginModal();
          $('sshLoginStudentName').textContent = `${s.name || 'Student'} • ${s.course || ''} / ${s.batch || ''}`;
          $('sshLoginStudentId').value = s.studentId || '-';
          $('sshLoginEmail').value = emailFor(s.studentId || '');
          $('sshStudentLoginModal').classList.add('show');
        } catch (err) { alert('Unable to open student login: ' + err.message); }
      });
      row.querySelector('.action-buttons')?.appendChild(btn);
    });
  }

  const body = $('studentsTableBody');
  if (body) new MutationObserver(() => requestAnimationFrame(decorateRows)).observe(body, {childList:true, subtree:true});
  addPasswordField();
  addStyles();
  addLoginModal();
  requestAnimationFrame(decorateRows);
})();
