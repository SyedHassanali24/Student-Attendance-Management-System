import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

/* Admin authorization guard. Never signs the user out just because the
   authorization document is temporarily unavailable. */
onAuthStateChanged(auth, async user => {
  if (!user) { location.replace('admin-login.html'); return; }

  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    if (!snap.exists()) {
      showAdminSecurityNotice('Firebase login successful, lekin is account ke liye admins/' + user.uid + ' document nahi mila.');
      return;
    }

    const data = snap.data() || {};
    const role = String(data.role || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const allowedRoles = new Set(['admin', 'super admin', 'superadmin', 'administrator']);

    if (data.active === false) {
      showAdminSecurityNotice('Ye administrator account inactive hai. Firestore admins record mein active ko true karein.');
      return;
    }
    if (role && !allowedRoles.has(role)) {
      showAdminSecurityNotice('Is account ka administrator role valid nahi hai. Current role: ' + data.role);
      return;
    }

    // Keep the dashboard informed that the account has passed authorization.
    window.dispatchEvent(new CustomEvent('sshacms-admin-authorized', { detail: { uid: user.uid, role: data.role || 'Admin' } }));
    document.documentElement.dataset.adminAuthorized = 'true';
  } catch (e) {
    console.error('Admin security check failed:', e);
    showAdminSecurityNotice('Admin verification temporarily unavailable. Aapka Firebase login session active hai; page ko refresh karke dobara try karein.');
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
