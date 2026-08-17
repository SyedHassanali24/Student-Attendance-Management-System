/* SSHACMS Notes & Study Materials — secure class-based sharing */
import { auth, db, storage } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { ref, uploadBytesResumable, getBlob, deleteObject } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js';

const MAX_SIZE = 15 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const esc = s => String(s ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const allowed = f => f && TYPES.includes(f.type) && f.size <= MAX_SIZE;

async function openFile(path, name, download = false) {
  if (!path) return;
  try {
    const blob = await getBlob(ref(storage, path), MAX_SIZE);
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'study-material';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    console.error('Material open error:', e);
    alert('This file is unavailable or you do not have permission to open it.');
  }
}

async function classOptions() {
  const snap = await getDocs(collection(db, 'students'));
  const map = new Map();
  snap.docs.forEach(d => {
    const x = d.data();
    const course = String(x.course || '').trim();
    const batch = String(x.batch || '').trim();
    if (course && batch) map.set(course + '|||' + batch, { course, batch });
  });
  return [...map.values()].sort((a, b) => (a.course + ' ' + a.batch).localeCompare(b.course + ' ' + b.batch));
}

async function verifyAdmin(user) {
  if (!user) throw new Error('Admin session expired. Please login again.');
  const snap = await getDoc(doc(db, 'admins', user.uid));
  if (!snap.exists()) throw new Error('This account is logged in but is not registered as an administrator. Add this UID to the admins collection first.');
  const data = snap.data() || {};
  if (data.active === false || (data.role && data.role !== 'admin')) throw new Error('This account does not have active administrator permission.');
  return true;
}

function uploadFile(path, file, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, metadata);
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      try { task.cancel(); } catch (_) {}
      finish(reject, new Error('Upload timed out after 60 seconds. Check Firebase Storage, rules, and your internet connection.'));
    }, 60000);
    task.on('state_changed', snapshot => {
      const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      onProgress?.(percent);
    }, error => finish(reject, error), () => finish(resolve));
  });
}

async function adminUI() {
  const page = document.getElementById('materials');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = '1';
  page.innerHTML = `<div class="panel materials-panel"><div class="panel-header materials-head"><div><span class="materials-eyebrow">ACADEMIC RESOURCES</span><h2>📚 Notes & Study Materials</h2><p>Upload a PDF or image once and publish it directly to a selected class.</p></div><span class="materials-live">● Secure</span></div><div class="materials-upload-card"><div class="materials-fields"><label>Course<select id="matCourse"><option value="">Select course</option></select></label><label>Class / Batch<select id="matBatch"><option value="">Select batch</option></select></label><label class="materials-title-field">Material Title<input id="matTitle" maxlength="100" placeholder="e.g. English Grammar Notes - Chapter 1"></label></div><div class="materials-file-row"><label class="materials-file"><b>Choose PDF / Image</b><small>PDF, PNG, JPG, WEBP · Maximum 15 MB</small><input id="matFile" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></label><button id="matUpload" type="button" class="primary-btn">Publish to Class</button></div><div id="matProgress" class="materials-message" aria-live="polite"></div><div id="matMsg" class="materials-message" aria-live="polite"></div></div><div class="materials-list-head"><div><h3>Published Materials</h3><p>Files already shared with students</p></div><button id="matRefresh" type="button" class="secondary-btn">↻ Refresh</button></div><div id="matRows" class="materials-admin-list"></div></div>`;

  const courseEl = document.getElementById('matCourse');
  const batchEl = document.getElementById('matBatch');
  const titleEl = document.getElementById('matTitle');
  const fileEl = document.getElementById('matFile');
  const uploadBtn = document.getElementById('matUpload');
  const msg = document.getElementById('matMsg');
  const progress = document.getElementById('matProgress');
  const rows = document.getElementById('matRows');

  let classes = [];
  try {
    classes = await classOptions();
  } catch (e) {
    console.error('Class options error:', e);
    msg.textContent = 'Unable to load classes. Check your admin session and Firestore rules.';
  }

  [...new Set(classes.map(x => x.course))].forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    courseEl.appendChild(o);
  });

  courseEl.onchange = () => {
    batchEl.innerHTML = '<option value="">Select batch</option>';
    classes.filter(x => x.course === courseEl.value).forEach(x => {
      const o = document.createElement('option');
      o.value = x.batch;
      o.textContent = x.batch;
      batchEl.appendChild(o);
    });
  };

  async function render() {
    rows.innerHTML = '<div class="materials-empty">Loading materials…</div>';
    try {
      const snap = await getDocs(collection(db, 'materials'));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(x => x.published === true)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (!items.length) {
        rows.innerHTML = '<div class="materials-empty"><b>No materials published yet.</b><span>Upload your first class note above.</span></div>';
        return;
      }
      rows.innerHTML = items.map(x => `<article class="material-admin-card"><div class="material-file-icon ${x.fileType === 'application/pdf' ? 'pdf' : 'image'}">${x.fileType === 'application/pdf' ? 'PDF' : 'IMG'}</div><div class="material-info"><h4>${esc(x.title)}</h4><p>${esc(x.fileName || 'Study material')}</p><div class="material-tags"><span>${esc(x.course)}</span><span>${esc(x.batch)}</span></div></div><div class="material-actions"><button type="button" class="secondary-btn mat-open" data-path="${esc(x.storagePath)}" data-name="${esc(x.fileName)}">Open</button><button type="button" class="danger-btn mat-delete" data-id="${x.id}" data-path="${esc(x.storagePath)}">Delete</button></div></article>`).join('');
      rows.querySelectorAll('.mat-open').forEach(b => b.onclick = () => openFile(b.dataset.path, b.dataset.name));
      rows.querySelectorAll('.mat-delete').forEach(b => b.onclick = async () => {
        if (!confirm('Delete this material permanently?')) return;
        try {
          if (b.dataset.path) await deleteObject(ref(storage, b.dataset.path)).catch(() => {});
          await deleteDoc(doc(db, 'materials', b.dataset.id));
          render();
        } catch (e) {
          console.error('Delete material error:', e);
          alert('Delete failed.');
        }
      });
    } catch (e) {
      console.error('Load materials error:', e);
      rows.innerHTML = '<div class="materials-empty"><b>Unable to load materials.</b><span>Check Firebase rules and your admin session.</span></div>';
    }
  }

  document.getElementById('matRefresh').onclick = render;

  uploadBtn.onclick = async () => {
    const title = titleEl.value.trim();
    const course = courseEl.value.trim();
    const batch = batchEl.value.trim();
    const file = fileEl.files[0];
    const user = auth.currentUser;
    msg.textContent = '';
    progress.textContent = '';

    uploadBtn.disabled = true;
    try {
      await verifyAdmin(user);
      if (!title || !course || !batch || !file) throw new Error('Please select the class, enter a title and choose a file.');
      if (!allowed(file)) throw new Error('Only PDF, PNG, JPG or WEBP files up to 15 MB are allowed.');

      const ss = await getDocs(query(collection(db, 'students'), where('course', '==', course), where('batch', '==', batch)));
      const uids = ss.docs.map(d => d.data().uid).filter(Boolean);
      if (!uids.length) throw new Error('No student accounts found in this class.');

      progress.textContent = 'Preparing secure upload…';
      const m = await addDoc(collection(db, 'materials'), {
        title,
        course,
        batch,
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        published: false,
        createdBy: user.uid,
        studentUids: uids,
        createdAt: serverTimestamp()
      });

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `materials/${m.id}/${safe}`;
      try {
        await uploadFile(path, file, { contentType: file.type, customMetadata: { materialId: m.id, course, batch } }, percent => {
          progress.textContent = `Uploading securely… ${percent}%`;
        });
        await updateDoc(m, { storagePath: path, published: true, publishedAt: serverTimestamp() });
      } catch (uploadError) {
        await deleteDoc(m).catch(() => {});
        await deleteObject(ref(storage, path)).catch(() => {});
        throw uploadError;
      }

      progress.textContent = 'Upload complete ✓';
      msg.textContent = `Published successfully to ${uids.length} student account(s).`;
      titleEl.value = '';
      fileEl.value = '';
      await render();
      setTimeout(() => { progress.textContent = ''; }, 2500);
    } catch (e) {
      console.error('Material upload error:', e);
      progress.textContent = '';
      msg.textContent = e?.code === 'storage/unauthorized'
        ? 'Upload blocked by Firebase Storage rules. Make sure this account exists in the admins collection and deploy storage.rules.'
        : (e?.message || 'Upload failed. Check Firebase Storage and rules.');
    } finally {
      uploadBtn.disabled = false;
    }
  };

  render();
}

async function studentUI(student) {
  const box = document.getElementById('materialsContainer');
  if (!box || !auth.currentUser) return;
  box.innerHTML = '<div class="materials-empty">Loading your class notes…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'materials'), where('published', '==', true), where('studentUids', 'array-contains', auth.currentUser.uid)));
    const course = String(student?.course || '').trim();
    const batch = String(student?.batch || '').trim();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(x => x.course === course && x.batch === batch)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (!items.length) {
      box.innerHTML = '<div class="materials-empty"><b>No Notes Yet</b><span>Your teacher has not uploaded notes for your class yet.</span></div>';
      return;
    }
    box.innerHTML = `<div class="materials-student-grid">${items.map(x => `<article class="material-student-card"><div class="material-student-top"><div class="material-file-icon ${x.fileType === 'application/pdf' ? 'pdf' : 'image'}">${x.fileType === 'application/pdf' ? 'PDF' : 'IMG'}</div><span>${x.publishedAt?.toDate ? x.publishedAt.toDate().toLocaleDateString() : 'Published'}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.fileName || 'Study material')}</p><div class="material-student-actions"><button type="button" class="primary-btn mat-open-student" data-path="${esc(x.storagePath)}" data-name="${esc(x.fileName)}">Open</button><button type="button" class="secondary-btn mat-save-student" data-path="${esc(x.storagePath)}" data-name="${esc(x.fileName)}">Save</button></div></article>`).join('')}</div>`;
    box.querySelectorAll('.mat-open-student').forEach(b => b.onclick = () => openFile(b.dataset.path, b.dataset.name));
    box.querySelectorAll('.mat-save-student').forEach(b => b.onclick = () => openFile(b.dataset.path, b.dataset.name, true));
  } catch (e) {
    console.error('Student materials error:', e);
    box.innerHTML = '<div class="materials-empty"><b>Unable to load materials.</b><span>Please contact administration.</span></div>';
  }
}

window.sshInitAdminMaterials = adminUI;
if (document.getElementById('materials')) adminUI();
if (document.getElementById('materialsContainer')) onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const snap = await getDocs(query(collection(db, 'students'), where('uid', '==', user.uid)));
    if (!snap.empty) studentUI(snap.docs[0].data());
  } catch (e) {
    console.error('Student materials lookup failed:', e);
  }
});