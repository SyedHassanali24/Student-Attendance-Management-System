import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

onAuthStateChanged(auth, async user => {
  if (!user) { location.replace('admin-login.html'); return; }
  try {
    const snap = await getDoc(doc(db,'admins',user.uid));
    const data = snap.exists() ? snap.data() : null;
    if (!data || data.active === false || data.role !== 'admin') {
      await signOut(auth);
      alert('Administrator access is required.');
      location.replace('admin-login.html');
    }
  } catch (e) {
    console.error('Admin security check failed:', e);
    await signOut(auth);
    location.replace('admin-login.html');
  }
});
