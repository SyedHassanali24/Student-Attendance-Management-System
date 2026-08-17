/* SSHACMS — STUDENT ACCOUNT + CREATION GUARD
   - Keeps student creation a real admin action.
   - Creates a Firebase Auth account without logging the admin out.
   - Stores the admin-only credential record separately from students.
   - Adds one Login/Credentials button per student.
   - Keeps student names on one stable line.
*/
(() => {
  if (window.__sshacmsStudentAccountManager) return;
  window.__sshacmsStudentAccountManager = true;

  const $ = id => document.getElementById(id);
  const form = $('studentForm');
  const save = $('saveStudentBtn');
  const modal = $('studentModal');
  const message = $('formMessage');
  if (!form || !save || !modal) return;

  let userActionUntil = 0;
  let consumed = false;
  let lastSubmit = 0;
  let firebase = null;
  let secondaryAuth = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
  }[m]));

  const arm = () => {
    userActionUntil = Date.now() + 1800;
    consumed = false;
  };
  save.addEventListener('pointerdown', arm, { capture: true });
  save.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') arm();
  }, { capture: true });

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

  function emailFor(studentId) {
    return String(studentId || '').trim().toUpperCase().replace(/\s+/g, '') + '@students.sshacms.local';
  }

  function getPasswordInput() { return $('studentPassword'); }

  function ensurePasswordField() {
    if ($('studentPassword')) return $('studentPassword');
    const wrap = document.createElement('div');
    wrap.className = 'form-group student-login-password-group';
    wrap.innerHTML = `
      <label for="studentPassword">Student Login Password</label>
      <div class="student-password-box">
        <input id="studentPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Set password (minimum 6 characters)">
        <button type="button" id="studentPasswordToggle" class="student-password-toggle" aria-label="Show password">👁</button>
      </div>
      <small id="studentPasswordHint">Required when creating a new student login. Leave blank while editing if you do not want to change it.</small>`;
    const grid = form.querySelector('.form-grid');
    if (grid) grid.appendChild(wrap);
    const input = $('studentPassword');
    $('studentPasswordToggle')?.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      $('studentPasswordToggle').textContent = input.type === 'password' ? '👁' : '🙈';
    });
    return input;
  }

  function injectStyles() {
    if ($('sshacmsStudentAccountStyles')) return;
    const style = document.createElement('style');
    style.id = 'sshacmsStudentAccountStyles';
    style.textContent = `
      .student-login-password-group{grid-column:1/-1!important}
      .student-password-box{display:flex;gap:8px;align-items:center}
      .student-password-box input{flex:1;min-width:0}
      .student-password-toggle{width:44px;height:42px;border:1px solid #d1d5db;border-radius:8px;background:#f8fafc;cursor:pointer}
      #studentPasswordHint{color:#6b7280;font-size:11px;line-height:1.45}
      #studentsTableBody td:nth-child(2){min-width:180px!important;width:180px!important;max-width:180px!important}
      #studentsTableBody td:nth-child(2),#studentsTableBody td:nth-child(2) *{overflow-wrap:normal!important;word-break:normal!important}
      #studentsTableBody .student-name-wrap{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;width:100%!important}
      #studentsTableBody .student-name-text{display:block!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;line-height:1.25!important}
      .student-login-action{background:#eef6ff!important;color:#174c8f!important;border:1px solid #cfe0f5!important}
      .credential-modal-backdrop{position:fixed;inset:0;background:rgba(7,26,51,.58);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:18px;z-index:5000}
      .credential-modal-backdrop.show{display:flex}
      .credential-modal{width:min(460px,100%);background:#fff;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.28);overflow:hidden;border:1px solid #e5eaf1}
      .credential-head{padding:18px 20px;background:linear-gradient(135deg,#071a33,#174c8f);color:#fff}
      .credential-head h3{margin:0;font-size:18px}.credential-head p{margin:5px 0 0;font-size:12px;opacity:.84}
      .credential-body{padding:20px}.credential-row{margin-bottom:14px}.credential-row label{display:block;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
      .credential-value{display:flex;align-items:center;gap:8px}.credential-value input{flex:1;min-width:0;height:44px;padding:0 12px;border:1px solid #d5dce7;border-radius:9px;background:#f8fafc;font-weight:700;color:#10233f}
      .credential-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.credential-actions button{border:0;border-radius:9px;padding:10px 13px;font-weight:700;cursor:pointer}.credential-primary{background:#174c8f;color:#fff}.credential-secondary{background:#eef2f7;color:#33445b}.credential-danger{background:#fff1f2;color:#be123c}
      .credential-note{font-size:11px;color:#64748b;line-height:1.5;margin-top:14px}.credential-status{min-height:18px;font-size:12px;margin-top:10px;color:#174c8f}
      @media(max-width:700px){.student-login-password-group{grid-column:auto!important}.credential-body{padding:16px}}
    `;
    document.head.appendChild(style);
  }

  function addCredentialModal() {
    if ($('studentCredentialModal')) return;
    const el = document.createElement('div');
    el.id = 'studentCredentialModal';
    el.className = 'credential-modal-backdrop';
    el.innerHTML = `
      <div class="credential-modal" role="dialog" aria-modal="true" aria-labelledby="credentialTitle">
        <div class="credential-head"><h3 id="credentialTitle">Student Login</h3><p id="credentialStudentLabel">Student credentials</p></div>
        <div class="credential-body">
          <div class="credential-row"><label>Student ID</label><div class="credential-value"><input id="credentialStudentId" readonly></div></div>
          <div class="credential-row"><label>Password</label><div class="credential-value"><input id="credentialPassword" type="password" readonly><button type="button" id="credentialToggle" class="credential-secondary" style="padding:10px">👁 Show</button></div></div>
          <div id="credentialActions" class="credential-actions"></div>
          <div id="credentialStatus" class="credential-status"></div>
          <div class="credential-note">This credential area is visible only to an authenticated administrator. Student passwords cannot be recovered from Firebase Authentication itself, so the system keeps the admin-only credential record needed for the requested “Show Password” feature.</div>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeCredentialModal(); });
    $('credentialToggle')?.addEventListener('click', () => {
      const input = $('credentialPassword');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      $('credentialToggle').textContent = input.type === 'password' ? '👁 Show' : '🙈 Hide';
    });
  }

  function closeCredentialModal() { $('studentCredentialModal')?.classList.remove('show'); }

  function setStatus(text, error=false) {
    if (message) { message.textContent = text; message.style.color = error ? '#b42318' : '#174c8f'; }
    const s = $('credentialStatus'); if (s) { s.textContent = text; s.style.color = error ? '#b42318' : '#174c8f'; }
  }

  async function getStudentById(id) {
    const { db, doc, getDoc } = await loadFirebase();
    const snap = await getDoc(doc(db, 'students', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async function nextStudentId() {
    const { db, collection, getDocs } = await loadFirebase();
    const snap = await getDocs(collection(db, 'students'));
    let max = 0;
    snap.docs.forEach(d => { const m = String(d.data()?.studentId || '').match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    return `STU-${String(max + 1).padStart(4,'0')}`;
  }

  async function provisionNewStudent(data, password) {
    const f = await loadFirebase();
    const studentId = await nextStudentId();
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    const email = emailFor(studentId);
    let user = null;
    try {
      const cred = await f.createUserWithEmailAndPassword(secondaryAuth, email, password);
      user = cred.user;
      const studentRef = f.doc(f.collection(f.db, 'students'));
      await f.setDoc(studentRef, { ...data, studentId, uid:user.uid, loginEnabled:true, createdAt:f.serverTimestamp() });
      await f.setDoc(f.doc(f.db, 'studentCredentials', studentRef.id), { studentDocId:studentRef.id, studentId, uid:user.uid, password, updatedAt:f.serverTimestamp(), createdAt:f.serverTimestamp() });
      await f.signOut(secondaryAuth);
      return { id:studentRef.id, studentId };
    } catch (error) {
      try { if (user) await f.deleteUser(user); } catch (_) {}
      throw error;
    }
  }

  async function updateExistingStudent(id, data, newPassword) {
    const f = await loadFirebase();
    const student = await getStudentById(id);
    if (!student) throw new Error('Student record not found.');
    await f.updateDoc(f.doc(f.db, 'students', id), data);
    if (!newPassword) return;
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    const credSnap = await f.getDoc(f.doc(f.db, 'studentCredentials', id));
    if (credSnap.exists() && student.uid) {
      const oldPassword = String(credSnap.data()?.password || '');
      if (!oldPassword) throw new Error('Existing credential record has no saved password. Create a new login from the Login button.');
      await f.signInWithEmailAndPassword(secondaryAuth, emailFor(student.studentId), oldPassword);
      await f.updatePassword(secondaryAuth.currentUser, newPassword);
      await f.setDoc(f.doc(f.db, 'studentCredentials', id), { password:newPassword, updatedAt:f.serverTimestamp(), uid:student.uid, studentId:student.studentId, studentDocId:id }, { merge:true });
      await f.signOut(secondaryAuth);
    } else {
      throw new Error('This student does not have a login account yet. Use the Login button to create it.');
    }
  }

  form.addEventListener('submit', async e => {
    const now = Date.now();
    if (now > userActionUntil || consumed || now - lastSubmit < 1200) {
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    consumed = true; lastSubmit = now;
    const editId = $('editStudentId')?.value || '';
    const password = String(getPasswordInput()?.value || '');
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
      save.disabled = true; save.textContent = editId ? 'Updating...' : 'Creating Login...';
      setStatus(editId ? 'Updating student...' : 'Creating student login securely...');
      if (editId) {
        await updateExistingStudent(editId, data, password);
        setStatus('Student updated successfully.');
      } else {
        const result = await provisionNewStudent(data, password);
        setStatus(`Student ${result.studentId} and login created successfully.`);
      }
      setTimeout(() => { modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }, 650);
      setTimeout(() => { if (getPasswordInput()) getPasswordInput().value = ''; }, 800);
    } catch (error) {
      console.error('Student account error:', error);
      setStatus(error?.code === 'auth/email-already-in-use' ? 'This Student ID already has a login account.' : (error.message || 'Unable to save student.'), true);
      consumed = false;
    } finally {
      save.disabled = false; save.textContent = $('editStudentId')?.value ? 'Update Student' : 'Save Student';
    }
  }, { capture:true });

  function credentialButtonFor(row) {
    if (row.querySelector('.student-login-action')) return;
    const id = row.querySelector('[data-id]')?.dataset?.id;
    if (!id) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'action-btn student-login-action'; btn.dataset.id = id; btn.textContent = '🔐 Login';
    row.querySelector('.action-buttons')?.appendChild(btn);
  }

  function decorateRows() {
    document.querySelectorAll('#studentsTableBody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (!cells.length || cells.length < 7) return;
      credentialButtonFor(row);
      const nameCell = cells[1];
      if (nameCell && !nameCell.querySelector('.student-name-wrap')) {
        const name = nameCell.textContent.trim() || '-';
        nameCell.textContent = '';
        const wrap = document.createElement('div'); wrap.className = 'student-name-wrap';
        const span = document.createElement('span'); span.className = 'student-name-text'; span.textContent = name; span.title = name;
        wrap.appendChild(span); nameCell.appendChild(wrap);
      }
    });
  }

  async function openCredentials(id) {
    addCredentialModal();
    const f = await loadFirebase();
    const student = await getStudentById(id);
    if (!student) throw new Error('Student not found.');
    $('credentialStudentId').value = student.studentId || '-';
    $('credentialStudentLabel').textContent = `${student.name || 'Student'} • ${student.course || ''} / ${student.batch || ''}`;
    $('credentialPassword').value = '';
    $('credentialPassword').type = 'password';
    $('credentialToggle').textContent = '👁 Show';
    const actions = $('credentialActions'); actions.innerHTML = '';
    const credSnap = await f.getDoc(f.doc(f.db, 'studentCredentials', id));
    if (credSnap.exists()) {
      const saved = String(credSnap.data()?.password || '');
      $('credentialPassword').value = saved;
      const copy = document.createElement('button'); copy.type='button'; copy.className='credential-secondary'; copy.textContent='📋 Copy Password';
      copy.onclick = async () => { try { await navigator.clipboard.writeText(saved); setStatus('Password copied.'); } catch (_) { setStatus('Copy failed.', true); } };
      actions.appendChild(copy);
      const close = document.createElement('button'); close.type='button'; close.className='credential-primary'; close.textContent='Done'; close.onclick=closeCredentialModal; actions.appendChild(close);
    } else {
      $('credentialPassword').value = '';
      const create = document.createElement('button'); create.type='button'; create.className='credential-primary'; create.textContent='Create Student Login';
      create.onclick = async () => {
        const pw = prompt(`Set a password for ${student.name || student.studentId} (minimum 6 characters):`);
        if (!pw) return;
        if (pw.length < 6) return alert('Password must be at least 6 characters.');
        try {
          const cred = await f.createUserWithEmailAndPassword(secondaryAuth, emailFor(student.studentId), pw);
          await f.updateDoc(f.doc(f.db,'students',id), { uid:cred.user.uid, loginEnabled:true });
          await f.setDoc(f.doc(f.db,'studentCredentials',id), { studentDocId:id, studentId:student.studentId, uid:cred.user.uid, password:pw, createdAt:f.serverTimestamp(), updatedAt:f.serverTimestamp() });
          await f.signOut(secondaryAuth);
          $('credentialPassword').value = pw; setStatus('Student login created successfully.');
        } catch (e) { setStatus(e.message || 'Login creation failed.', true); }
      };
      actions.appendChild(create);
      const close = document.createElement('button'); close.type='button'; close.className='credential-secondary'; close.textContent='Close'; close.onclick=closeCredentialModal; actions.appendChild(close);
    }
    $('studentCredentialModal').classList.add('show');
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.student-login-action');
    if (!btn) return;
    e.preventDefault(); e.stopImmediatePropagation();
    openCredentials(btn.dataset.id).catch(err => { console.error(err); alert('Unable to open student login: ' + err.message); });
  }, true);

  const body = $('studentsTableBody');
  if (body) new MutationObserver(() => requestAnimationFrame(decorateRows)).observe(body, {childList:true, subtree:true});

  ensurePasswordField(); injectStyles(); addCredentialModal();
  requestAnimationFrame(decorateRows);
})();
