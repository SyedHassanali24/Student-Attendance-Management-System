/* SSHACMS — Student Login
   Student logs in with Student ID + password.
   Firebase Auth email is generated from the Student ID.
*/
import { auth, db } from '../firebase/firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const form=document.getElementById('studentLoginForm');
const studentIdInput=document.getElementById('studentId');
const passwordInput=document.getElementById('password');
const loginBtn=document.getElementById('loginBtn');
const message=document.getElementById('loginMessage');

function studentLoginEmail(id){return String(id||'').trim().toUpperCase().replace(/\s+/g,'')+'@students.sshacms.local';}
function showMessage(text,type='error'){if(!message)return;message.textContent=text;message.className='message show '+type;}
function loginError(error){
  switch(error?.code){
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'Student ID ya password ghalat hai.';
    case 'auth/too-many-requests': return 'Bohat zyada login attempts. Kuch dair baad dobara try karein.';
    case 'auth/network-request-failed': return 'Internet/network error. Connection check karein.';
    default: return error?.message || 'Login nahi ho saka. Dobara try karein.';
  }
}

async function getStudentForUser(user, expectedStudentId=''){
  const q=query(collection(db,'students'),where('uid','==',user.uid),limit(1));
  const snap=await getDocs(q);
  if(snap.empty)throw new Error('This login account is not linked to a student profile.');
  const item=snap.docs[0]; const student=item.data();
  if(student.loginEnabled!==true)throw new Error('This student login is currently disabled.');
  if(expectedStudentId && String(student.studentId||'').trim().toUpperCase()!==expectedStudentId)throw new Error('Student ID does not match this account.');
  return {snapshot:item,student};
}

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
    const result=await getStudentForUser(user);
    localStorage.setItem('studentDocId',result.snapshot.id);
    localStorage.setItem('studentId',result.student.studentId||'');
    localStorage.setItem('studentName',result.student.name||'');
    localStorage.setItem('studentUid',user.uid);
    if(location.pathname.endsWith('login.html'))location.replace('student-dashboard.html');
  }catch(error){console.error('Existing student session error:',error);await signOut(auth);}
});

form?.addEventListener('submit',async event=>{
  event.preventDefault();
  const studentId=String(studentIdInput?.value||'').trim().toUpperCase();
  const password=String(passwordInput?.value||'');
  if(!studentId)return showMessage('Please enter your Student ID.');
  if(!password)return showMessage('Please enter your password.');
  loginBtn.disabled=true; loginBtn.textContent='Signing in...'; showMessage('','success');
  try{
    const credential=await signInWithEmailAndPassword(auth,studentLoginEmail(studentId),password);
    const result=await getStudentForUser(credential.user,studentId);
    localStorage.setItem('studentDocId',result.snapshot.id);
    localStorage.setItem('studentId',result.student.studentId||'');
    localStorage.setItem('studentName',result.student.name||'');
    localStorage.setItem('studentUid',credential.user.uid);
    showMessage('Login successful. Opening Student Portal...','success');
    setTimeout(()=>location.replace('student-dashboard.html'),400);
  }catch(error){console.error('Student login error:',error);showMessage(loginError(error));loginBtn.disabled=false;loginBtn.textContent='Login to Student Portal';}
});
