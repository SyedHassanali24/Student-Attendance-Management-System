/* SSHACMS Student Login Manager v7
   - Always adds Login/Create Login action to every student row.
   - Adds password + show/hide field to Add Student modal.
   - Creates Firebase Authentication account without signing the admin out.
   - Never stores plaintext passwords in Firestore/localStorage.
*/
(() => {
  if (window.__sshacmsStudentLoginManagerV7) return;
  window.__sshacmsStudentLoginManagerV7 = true;

  const API_KEY = 'AIzaSyB1wfj-wzsIDxUMvAYvbbHlvNRQ4zRsgmM';
  const $ = id => document.getElementById(id);
  const emailFor = id => String(id || '').trim().toUpperCase().replace(/\s+/g, '') + '@students.sshacms.local';

  function styles() {
    if ($('sshLoginStylesV7')) return;
    const s = document.createElement('style');
    s.id = 'sshLoginStylesV7';
    s.textContent = `
      .ssh-login-create-btn-v7{background:#eef6ff!important;color:#174c8f!important;border:1px solid #c7ddf6!important;font-weight:700!important}
      .ssh-login-modal-v7{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(7,26,51,.62);z-index:99999;padding:18px}
      .ssh-login-modal-v7.show{display:flex}.ssh-login-card-v7{width:min(460px,100%);background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.32);overflow:hidden}
      .ssh-login-head-v7{background:linear-gradient(135deg,#071a33,#245bd8);color:#fff;padding:18px 20px}.ssh-login-head-v7 h3{margin:0}.ssh-login-head-v7 p{margin:5px 0 0;font-size:12px;opacity:.86}
      .ssh-login-body-v7{padding:20px}.ssh-login-field-v7{margin-bottom:14px}.ssh-login-field-v7 label{display:block;font-size:12px;font-weight:800;margin-bottom:6px;color:#344054}.ssh-login-field-v7 input{width:100%;height:44px;border:1px solid #d0d5dd;border-radius:9px;padding:0 12px;box-sizing:border-box;font-weight:600}
      .ssh-login-password-v7{display:flex;gap:8px}.ssh-login-password-v7 input{flex:1}.ssh-login-password-v7 button{white-space:nowrap}
      .ssh-login-status-v7{padding:10px 12px;border-radius:10px;font-size:12px;margin-bottom:14px;background:#f8fafc;color:#475467;border:1px solid #e4e7ec}
      .ssh-login-actions-v7{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.ssh-login-actions-v7 button{min-height:42px}
      #studentsTableBody td:nth-child(2){min-width:170px}#studentsTableBody .ssh-name-v7{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px}
      .student-login-password-group-v7{grid-column:1/-1!important}
    `;
    document.head.appendChild(s);
  }

  function addPasswordToStudentForm() {
    const form = $('studentForm');
    const grid = form?.querySelector('.form-grid');
    if (!form || !grid || $('studentPasswordV7')) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-group student-login-password-group-v7';
    wrap.innerHTML = `<label for="studentPasswordV7">Student Login Password <span style="color:#b42318">*</span></label>
      <div class="ssh-login-password-v7"><input id="studentPasswordV7" type="password" minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters"><button type="button" id="studentPasswordToggleV7" class="secondary-btn">👁 Show</button></div>
      <small style="display:block;margin-top:5px;color:#667085;font-size:11px">Password Firebase Authentication mein secure form mein set hoga. Plain-text password Firestore mein save nahi hoga.</small>`;
    grid.appendChild(wrap);
    $('studentPasswordToggleV7')?.addEventListener('click', () => {
      const input = $('studentPasswordV7');
      input.type = input.type === 'password' ? 'text' : 'password';
      $('studentPasswordToggleV7').textContent = input.type === 'password' ? '👁 Show' : '🙈 Hide';
    });
  }

  function ensureLoginModal() {
    if ($('sshLoginModalV7')) return;
    const modal = document.createElement('div');
    modal.id = 'sshLoginModalV7'; modal.className = 'ssh-login-modal-v7';
    modal.innerHTML = `<div class="ssh-login-card-v7" role="dialog" aria-modal="true">
      <div class="ssh-login-head-v7"><h3>🔐 Create Student Login</h3><p id="sshLoginNameV7">Student account</p></div>
      <div class="ssh-login-body-v7">
        <div class="ssh-login-field-v7"><label>Student ID</label><input id="sshLoginIdV7" readonly></div>
        <div class="ssh-login-field-v7"><label>Login Email</label><input id="sshLoginEmailV7" readonly></div>
        <div class="ssh-login-field-v7"><label>Password</label><div class="ssh-login-password-v7"><input id="sshExistingPasswordV7" type="password" minlength="6" placeholder="Set a new password"><button type="button" id="sshExistingToggleV7" class="secondary-btn">👁 Show</button></div></div>
        <div id="sshLoginMessageV7" class="ssh-login-status-v7">Password will be set securely in Firebase Authentication.</div>
        <div class="ssh-login-actions-v7"><button type="button" id="sshLoginCancelV7" class="secondary-btn">Cancel</button><button type="button" id="sshLoginCreateV7" class="primary-btn">🔐 Create Login</button></div>
      </div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeLoginModal(); });
    $('sshLoginCancelV7')?.addEventListener('click', closeLoginModal);
    $('sshExistingToggleV7')?.addEventListener('click', () => {
      const input = $('sshExistingPasswordV7'); input.type = input.type === 'password' ? 'text' : 'password';
      $('sshExistingToggleV7').textContent = input.type === 'password' ? '👁 Show' : '🙈 Hide';
    });
    $('sshLoginCreateV7')?.addEventListener('click', createExistingStudentLogin);
  }
  function closeLoginModal(){ $('sshLoginModalV7')?.classList.remove('show'); }
  function setLoginMessage(text,error=false){const e=$('sshLoginMessageV7');if(e){e.textContent=text;e.style.color=error?'#b42318':'#067647';e.style.background=error?'#fef3f2':'#ecfdf3';e.style.borderColor=error?'#fecdca':'#abefc6';}}

  async function createAuthAccount(studentId,password){
    const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emailFor(studentId),password,returnSecureToken:true})});
    const d=await r.json();
    if(!r.ok){const code=d?.error?.message||'AUTH_CREATE_FAILED';if(code.includes('OPERATION_NOT_ALLOWED'))throw new Error('Firebase Authentication mein Email/Password provider ON nahi hai.');if(code.includes('EMAIL_EXISTS'))throw new Error('Is Student ID ka login pehle se bana hua hai.');if(code.includes('WEAK_PASSWORD'))throw new Error('Password kam az kam 6 characters ka hona chahiye.');throw new Error('Login create nahi ho saka: '+code);}
    return d;
  }

  async function createExistingStudentLogin(){
    const id=$('sshLoginIdV7')?.value||'', password=$('sshExistingPasswordV7')?.value||'', docId=$('sshLoginModalV7')?.dataset.studentDocId||'';
    if(!id||password.length<6){setLoginMessage('Password kam az kam 6 characters ka hona chahiye.',true);return;}
    const btn=$('sshLoginCreateV7'); if(btn){btn.disabled=true;btn.textContent='Creating...';}
    try{
      const account=await createAuthAccount(id,password);
      const {db}=await import('../firebase/firebase-config.js');
      const {doc,setDoc,serverTimestamp}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
      if(!docId)throw new Error('Student record not found.');
      await setDoc(doc(db,'students',docId),{uid:account.localId,loginEnabled:true,passwordSetAt:serverTimestamp()},{merge:true});
      await setDoc(doc(db,'studentCredentials',docId),{studentDocId:docId,studentId:id,uid:account.localId,email:emailFor(id),passwordSet:true,passwordSetAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
      setLoginMessage('✓ Login successfully create ho gaya. Password Firebase mein secure hai.');
      setTimeout(closeLoginModal,900);
    }catch(e){console.error(e);setLoginMessage(e?.message||'Login create nahi ho saka.',true);}finally{if(btn){btn.disabled=false;btn.textContent='🔐 Create Login';}}
  }

  async function openLoginForStudent(docId){
    try{
      const {db}=await import('../firebase/firebase-config.js');
      const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
      const snap=await getDoc(doc(db,'students',docId));
      if(!snap.exists())throw new Error('Student not found.');
      const s=snap.data(); ensureLoginModal(); const m=$('sshLoginModalV7'); m.dataset.studentDocId=docId;
      $('sshLoginNameV7').textContent=`${s.name||'Student'} • ${s.course||''} / ${s.batch||''}`;
      $('sshLoginIdV7').value=s.studentId||''; $('sshLoginEmailV7').value=emailFor(s.studentId||''); $('sshExistingPasswordV7').value='';
      setLoginMessage(s.loginEnabled?'Login already linked. New password se reset/recreate try kar sakte hain.':'Is student ke liye login create karein.'); m.classList.add('show');
    }catch(e){alert('Unable to open login: '+e.message);}
  }

  function decorateRows(){
    const body=$('studentsTableBody'); if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const cells=row.querySelectorAll('td'); if(cells.length<7)return;
      const nameCell=cells[1]; if(nameCell&&!nameCell.querySelector('.ssh-name-v7')){const name=nameCell.textContent.trim();nameCell.textContent='';const span=document.createElement('span');span.className='ssh-name-v7';span.textContent=name;span.title=name;nameCell.appendChild(span);}
      const actionCell=cells[6]; if(!actionCell)return;
      let actions=actionCell.querySelector('.action-buttons'); if(!actions){actions=document.createElement('div');actions.className='action-buttons';while(actionCell.firstChild)actions.appendChild(actionCell.firstChild);actionCell.appendChild(actions);}
      if(actions.querySelector('.ssh-login-create-btn-v7'))return;
      const source=actions.querySelector('[data-id]'); const id=source?.dataset?.id; if(!id)return;
      const btn=document.createElement('button');btn.type='button';btn.className='action-btn ssh-login-create-btn-v7';btn.dataset.id=id;btn.textContent='🔐 Login';btn.addEventListener('click',()=>openLoginForStudent(id));actions.appendChild(btn);
    });
  }

  function hookForm(){
    const form=$('studentForm'); const save=$('saveStudentBtn'); if(!form||!save)return;
    addPasswordToStudentForm();
    if(form.dataset.loginV7Hooked)return; form.dataset.loginV7Hooked='1';
    let armedUntil=0; let busy=false;
    save.addEventListener('pointerdown',()=>{armedUntil=Date.now()+3000},{capture:true});
    form.addEventListener('submit',async e=>{
      if($('editStudentId')?.value||Date.now()>armedUntil||busy)return;
      e.preventDefault();e.stopImmediatePropagation();busy=true;
      const p=String($('studentPasswordV7')?.value||''); const msg=$('formMessage');
      if(p.length<6){if(msg)msg.textContent='Student password must be at least 6 characters.';busy=false;return;}
      save.disabled=true;save.textContent='Creating Login...';
      let token='';
      try{
        const data={name:$('studentName')?.value.trim()||'',fatherName:$('fatherName')?.value.trim()||'',phone:$('phone')?.value.trim()||'',course:$('course')?.value.trim()||'',batch:$('batch')?.value.trim()||'',admissionDate:$('admissionDate')?.value||''};
        if(Object.values(data).some(v=>!v))throw new Error('Please fill all student fields.');
        const {db}=await import('../firebase/firebase-config.js'); const {collection,addDoc,setDoc,doc,serverTimestamp}=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js');
        const snap=await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js').then(x=>x.getDocs(collection(db,'students')));let max=0;snap.docs.forEach(d=>{const m=String(d.data()?.studentId||'').match(/(\d+)$/);if(m)max=Math.max(max,Number(m[1]));});const studentId=`STU-${String(max+1).padStart(4,'0')}`;
        const account=await createAuthAccount(studentId,p);token=account.idToken||'';
        const ref=await addDoc(collection(db,'students'),{...data,studentId,uid:account.localId,loginEnabled:true,passwordSetAt:serverTimestamp(),createdAt:serverTimestamp()});
        await setDoc(doc(db,'studentCredentials',ref.id),{studentDocId:ref.id,studentId,uid:account.localId,email:emailFor(studentId),passwordSet:true,passwordSetAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
        if(msg)msg.textContent=`✓ ${studentId} ka Login + Password successfully create ho gaya.`;
        const input=$('studentPasswordV7');if(input)input.value='';setTimeout(()=>{const modal=$('studentModal');modal?.classList.remove('show');modal?.setAttribute('aria-hidden','true');},800);
      }catch(err){if(token){try{await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});}catch(_){}}if($('formMessage'))$('formMessage').textContent='Error: '+(err?.message||'Login creation failed.');console.error(err);save.disabled=false;save.textContent='Save Student';}finally{busy=false;}
    },{capture:true});
  }

  styles(); ensureLoginModal(); hookForm(); decorateRows();
  const observer=new MutationObserver(()=>{addPasswordToStudentForm();decorateRows();});
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{addPasswordToStudentForm();decorateRows();},1000);
})();
