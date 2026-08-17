import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

/* Admin authorization guard.
   First checks the UID document. If the Auth UID changed but the existing
   administrator record is still keyed by another document ID, it safely
   falls back to the authenticated administrator email. */
onAuthStateChanged(auth, async user => {
  if (!user) { location.replace('admin-login.html'); return; }

  try {
    let data = null;
    const uidSnap = await getDoc(doc(db, 'admins', user.uid));
    if (uidSnap.exists()) {
      data = uidSnap.data() || {};
    } else if (user.email) {
      const emailQuery = query(collection(db, 'admins'), where('email', '==', user.email));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) data = emailSnap.docs[0].data() || {};
    }

    if (!data) {
      showAdminSecurityNotice('Firebase login successful, lekin is account ko administrator record mein authorize nahi kiya gaya.');
      return;
    }

    const role = String(data.role || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const allowedRoles = new Set(['admin', 'super admin', 'superadmin', 'administrator']);

    if (data.active === false || String(data.Status || '').trim().toLowerCase() === 'inactive') {
      showAdminSecurityNotice('Ye administrator account inactive hai. Firestore admins record mein active/status check karein.');
      return;
    }
    if (role && !allowedRoles.has(role)) {
      showAdminSecurityNotice('Is account ka administrator role valid nahi hai. Current role: ' + data.role);
      return;
    }

    window.dispatchEvent(new CustomEvent('sshacms-admin-authorized', { detail: { uid: user.uid, role: data.role || 'Admin' } }));
    document.documentElement.dataset.adminAuthorized = 'true';
    document.documentElement.dataset.adminUid = user.uid;
  } catch (e) {
    console.error('Admin security check failed:', e);
    showAdminSecurityNotice('Admin verification temporarily unavailable. Firebase login active hai; page refresh karke dobara try karein.');
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
