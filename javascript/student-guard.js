import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

onAuthStateChanged(auth, async user => {
  if (!user) { location.replace('login.html'); return; }
  try {
    const snap = await getDocs(query(collection(db,'students'),where('uid','==',user.uid),where('loginEnabled','==',true),limit(1)));
    if (snap.empty) { await signOut(auth); location.replace('login.html'); }
  } catch (e) { console.error('Student security check failed:',e); await signOut(auth); location.replace('login.html'); }
});
