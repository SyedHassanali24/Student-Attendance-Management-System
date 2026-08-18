import { auth, db } from '../firebase/firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const form = document.getElementById('studentLoginForm');
const idInput = document.getElementById('studentId');
const pass = document.getElementById('password');
const btn = document.getElementById('loginBtn');
const msg = document.getElementById('loginMessage');

const emailFor = id => String(id || '').trim().toUpperCase().replace(/\s+/g, '') + '@students.sshacms.local';
const show = (text, type = 'error') => {
  if (msg) {
    msg.textContent = text;
    msg.className = 'message show ' + type;
  }
};

function setBusy(busy) {
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? 'Signing in...' : 'Login to Student Portal';
  btn.setAttribute('aria-busy', String(busy));
}

function withTimeout(promise, ms = 15000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function findStudent(uid) {
  const snap = await withTimeout(
    getDocs(query(collection(db, 'students'), where('uid', '==', uid), limit(1)))
  );
  if (snap.empty) return null;
  const student = snap.docs[0];
  return student.data().loginEnabled === true ? student : null;
}

onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const student = await findStudent(user.uid);
    if (student) {
      const data = student.data();
      localStorage.setItem('studentDocId', student.id);
      localStorage.setItem('studentId', data.studentId || '');
      localStorage.setItem('studentName', data.name || '');
      localStorage.setItem('studentUid', user.uid);
      location.replace('student-dashboard.html');
    } else {
      await signOut(auth);
    }
  } catch (error) {
    console.error('Student auth state check failed:', error);
  }
});

form?.addEventListener('submit', async e => {
  e.preventDefault();
  e.stopPropagation();

  const sid = idInput.value.trim().toUpperCase();
  const pw = pass.value;
  if (!sid || !pw) {
    show('Please enter Student ID and password.');
    return;
  }

  setBusy(true);
  show('Firebase se login verify ho raha hai...', 'success');

  try {
    // Student login pages use session persistence by default; the session is cleared on browser close.
    await withTimeout(setPersistence(auth, browserSessionPersistence));
    const cred = await withTimeout(signInWithEmailAndPassword(auth, emailFor(sid), pw));
    const student = await findStudent(cred.user.uid);

    if (!student || String(student.data().studentId || '').trim().toUpperCase() !== sid) {
      await signOut(auth);
      throw new Error('STUDENT_NOT_LINKED');
    }

    const data = student.data();
    localStorage.setItem('studentDocId', student.id);
    localStorage.setItem('studentId', data.studentId || '');
    localStorage.setItem('studentName', data.name || '');
    localStorage.setItem('studentUid', cred.user.uid);
    show('Login successful. Opening Student Portal...', 'success');
    setTimeout(() => location.replace('student-dashboard.html'), 250);
  } catch (error) {
    console.error('Student login error:', error);
    if (error?.message === 'NETWORK_TIMEOUT') {
      show('Firebase response mein time lag raha hai. Internet check karke dobara try karein.');
    } else if (error?.code === 'auth/too-many-requests') {
      show('Too many attempts. Please try again later.');
    } else if (error?.code === 'auth/network-request-failed') {
      show('Network error. Internet connection check karein.');
    } else if (error?.code === 'auth/operation-not-allowed') {
      show('Firebase Authentication mein Email/Password provider ON nahi hai.');
    } else if (error?.message === 'STUDENT_NOT_LINKED') {
      show('Student account database se correctly linked nahi hai. Admin se account verify karwayein.');
    } else {
      show('Student ID or password is incorrect.');
    }
    setBusy(false);
  }
});
