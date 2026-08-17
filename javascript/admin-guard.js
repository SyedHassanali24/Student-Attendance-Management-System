import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

/* Do not sign out a valid Firebase session because an authorization lookup fails. */
onAuthStateChanged(auth, async user => {
  if (!user) { location.replace('admin-login.html'); return; }
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    const data = snap.exists() ? snap.data() : null;
    if (!data || data.active === false || data.role !== 'admin') {
      showAdminSecurityNotice('Firebase login is successful, but this account is not registered as an administrator yet. Your login session has NOT been signed out.');
      return;
    }
    window.dispatchEvent(new CustomEvent('sshacms-admin-authorized', { detail: { uid: user.uid } }));
  } catch (e) {
    console.error('Admin security check failed:', e);
    showAdminSecurityNotice('Admin verification could not be completed because of a temporary Firebase/network permission issue. Your login session is still active.');
  }
});

function showAdminSecurityNotice(message) {
  let box = document.getElementById('adminSecurityNotice');
  if (!box) {
    box = document.createElement('div');
    box.id = 'adminSecurityNotice';
    box.style.cssText = 'position:fixed;top:14px;right:14px;z-index:99999;max-width:430px;padding:14px 16px;border:1px solid #f3d28a;border-radius:12px;background:#fff9e8;color:#624500;box-shadow:0 12px 35px rgba(0,0,0,.12);font:600 13px/1.5 system-ui,sans-serif;';
    document.body.appendChild(box);
  }
  box.textContent = message;
}
