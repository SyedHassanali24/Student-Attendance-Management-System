import { db } from "../firebase/firebase-config.js";
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[m]));

  // Keep the student table stable: names/photos must never expand the table horizontally.
  const style = document.createElement('style');
  style.textContent = `
    #studentsTableBody td:nth-child(2){width:180px!important;min-width:180px!important;max-width:180px!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;vertical-align:middle!important}
    #studentsTableBody td:nth-child(2) .student-name-wrap{display:flex!important;align-items:center!important;width:100%!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;gap:8px!important}
    .student-name-text{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .student-photo-thumb{width:36px!important;height:36px!important;min-width:36px!important;border-radius:50%!important;object-fit:cover!important;display:block!important;background:#eef2f7!important}
    .student-photo-action{white-space:nowrap!important}
  `;
  document.head.appendChild(style);

  const getId = (el) => el?.dataset?.id || el?.closest('tr')?.querySelector('[data-id]')?.dataset?.id || '';

  const compress = (file) => new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Please select an image.'));
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const scale = Math.min(1, 900 / img.width, 1100 / img.height);
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext('2d', { alpha:false });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,c.width,c.height);
        ctx.drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg', .86));
      };
      img.onerror = () => reject(new Error('Invalid image.'));
      img.src = r.result;
    };
    r.onerror = () => reject(new Error('Image could not be read.'));
    r.readAsDataURL(file);
  });

  function renderPhoto(id, photo) {
    document.querySelectorAll('#studentsTableBody tr').forEach(row => {
      if (!row.querySelector(`[data-id="${CSS.escape(id)}"]`)) return;
      const cell = row.querySelectorAll('td')[1];
      if (!cell) return;
      const oldName = cell.querySelector('.student-name-text')?.textContent || cell.textContent.trim() || 'Student';
      cell.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'student-name-wrap';
      if (photo) {
        const img = document.createElement('img');
        img.className = 'student-photo-thumb';
        img.src = photo;
        img.alt = 'Student photo';
        wrap.appendChild(img);
      }
      const span = document.createElement('span');
      span.className = 'student-name-text';
      span.textContent = oldName;
      span.title = oldName;
      wrap.appendChild(span);
      cell.appendChild(wrap);
    });
  }

  async function savePhoto(button, file) {
    const id = getId(button);
    if (!id) return;
    try {
      button.disabled = true;
      const photo = await compress(file);
      await updateDoc(doc(db,'students',id), { photo, photoUpdatedAt:new Date().toISOString() });
      renderPhoto(id, photo);
      button.textContent = '✓ Saved';
      setTimeout(() => { button.textContent = '📷 Photo'; button.disabled = false; }, 1000);
    } catch(e) {
      button.disabled = false;
      alert('Photo save failed: ' + e.message);
    }
  }

  function choosePhoto(button, camera = false) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Camera button explicitly opens the camera; Gallery button deliberately has no capture attribute.
    if (camera) input.setAttribute('capture','environment');
    input.style.position='fixed';
    input.style.left='-9999px';
    document.body.appendChild(input);
    input.onchange = () => {
      const f = input.files?.[0];
      input.remove();
      if (f) savePhoto(button,f);
    };
    input.click();
  }

  async function decorate() {
    for (const row of document.querySelectorAll('#studentsTableBody tr')) {
      const id = row.querySelector('[data-id]')?.dataset?.id;
      const cells = row.querySelectorAll('td');
      const cell = cells[1];
      if (!id || !cell) continue;

      if (!cell.querySelector('.student-name-wrap')) {
        const name = cell.textContent.trim() || 'Student';
        cell.textContent='';
        const wrap=document.createElement('div');
        wrap.className='student-name-wrap';
        const span=document.createElement('span');
        span.className='student-name-text';
        span.textContent=name;
        span.title=name;
        wrap.appendChild(span);
        cell.appendChild(wrap);
      }

      const actions = row.querySelector('.action-buttons');
      if (actions && !actions.querySelector('.student-photo-action')) {
        const cameraBtn=document.createElement('button');
        cameraBtn.type='button';
        cameraBtn.className='action-btn student-photo-action';
        cameraBtn.dataset.id=id;
        cameraBtn.dataset.photoMode='camera';
        cameraBtn.textContent='📷 Camera';

        const galleryBtn=document.createElement('button');
        galleryBtn.type='button';
        galleryBtn.className='action-btn student-photo-action';
        galleryBtn.dataset.id=id;
        galleryBtn.dataset.photoMode='gallery';
        galleryBtn.textContent='🖼️ Photo';

        actions.insertBefore(galleryBtn, actions.firstChild);
        actions.insertBefore(cameraBtn, actions.firstChild);
      }

      try {
        const snap = await getDoc(doc(db,'students',id));
        if (snap.exists() && snap.data().photo) renderPhoto(id,snap.data().photo);
      } catch(e) {
        console.warn('photo read failed',e);
      }
    }
  }

  async function openPhotoIDCard(id) {
    const w = window.open('','_blank','width=700,height=900');
    if (!w) return alert('Please allow pop-ups for ID cards.');

    w.document.open();
    w.document.write('<!doctype html><html><body style="font-family:Arial;padding:30px">Loading Student ID Card...</body></html>');
    w.document.close();

    try {
      const snap = await getDoc(doc(db,'students',id));
      if (!snap.exists()) throw new Error('Student not found.');
      const s = snap.data();
      const sid = String(s.studentId || id).trim();
      const studentName = String(s.name || 'Student');
      const photo = s.photo
        ? `<img id="studentPhoto" src="${esc(s.photo)}" alt="Student Photo">`
        : `<span>${esc(studentName.charAt(0).toUpperCase())}</span>`;

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(studentName)} - Student ID</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
<style>
*{box-sizing:border-box}
@page{size:86mm 128mm;margin:0}
html,body{margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;color:#102a52}
.screen{min-height:100vh;padding:18px;display:flex;justify-content:center;align-items:flex-start}
.card{width:86mm;height:128mm;background:#fff;border:1px solid #dbe3ee;border-radius:5mm;overflow:hidden;position:relative;box-shadow:0 10px 35px rgba(16,42,82,.15)}
.head{height:25mm;background:#0b2f63;color:#fff;text-align:center;padding:4.5mm 4mm 2.5mm}
.head h2{margin:0;font-size:4.2mm;line-height:1.15}
.head p{margin:1.5mm 0 0;font-size:2.55mm;opacity:.92}
.body{text-align:center;padding:3.2mm 5mm 2.2mm}
.photo{width:25mm;height:25mm;margin:0 auto 2mm;border-radius:50%;overflow:hidden;background:#e8edf5;border:1mm solid #e5ecf5;display:grid;place-items:center;color:#0b2f63;font-size:9mm;font-weight:800}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.name{font-size:4.4mm;font-weight:800;line-height:1.1;overflow-wrap:anywhere;word-break:break-word;max-height:10mm;overflow:hidden}
.id{display:inline-block;font-size:2.9mm;font-weight:800;color:#0b2f63;background:#edf3fb;padding:1mm 2mm;border-radius:999px;margin:1.2mm 0 1.8mm}
.row{display:flex;justify-content:space-between;gap:2mm;border-top:1px solid #e7ebf1;padding:1.45mm 0;font-size:2.35mm;line-height:1.1;text-align:left;min-height:5.2mm}
.row b{color:#334155;white-space:nowrap}.row span{color:#102a52;text-align:right;max-width:52%;overflow-wrap:anywhere;word-break:break-word}
.qr-title{margin:1.8mm 0 .8mm;color:#334155;font-size:2.45mm;font-weight:800;letter-spacing:.25px}
.qr{display:block;width:27mm;height:27mm;margin:0 auto .7mm;background:#fff;image-rendering:pixelated}
.qr-note{font-size:1.8mm;color:#748196;margin:0;line-height:1.1}
.actions{display:flex;gap:7px;justify-content:center;margin:16px 0 4px}
.action{padding:9px 14px;border:0;border-radius:8px;background:#0b2f63;color:#fff;font-weight:700;cursor:pointer}
.action.secondary{background:#334155}
.status{font-size:12px;color:#475569;text-align:center;min-height:16px}
@media print{
 html,body{width:86mm;height:128mm;background:#fff;overflow:hidden}
 .screen{padding:0;display:block;min-height:0}
 .card{width:86mm;height:128mm;border-radius:0;box-shadow:none;border:0}
 .actions,.status{display:none!important}
}
</style>
</head>
<body>
<div class="screen">
  <div>
    <div id="card" class="card">
      <div class="head"><h2>SIR SYED HASSAN ALI COACHING</h2><p>Student Identity Card</p></div>
      <div class="body">
        <div class="photo">${photo}</div>
        <div class="name">${esc(studentName)}</div>
        <div class="id">${esc(sid)}</div>
        <div class="row"><b>Father Name</b><span>${esc(s.fatherName||'-')}</span></div>
        <div class="row"><b>Phone</b><span>${esc(s.phone||'-')}</span></div>
        <div class="row"><b>Course</b><span>${esc(s.course||'-')}</span></div>
        <div class="row"><b>Batch</b><span>${esc(s.batch||'-')}</span></div>
        <div class="qr-title">SCAN STUDENT ID</div>
        <canvas id="studentQR" class="qr" width="420" height="420"></canvas>
        <p class="qr-note">QR contains only Student ID: ${esc(sid)}</p>
      </div>
    </div>
    <div class="actions">
      <button id="downloadBtn" class="action" type="button">⬇ Download PDF</button>
      <button id="printBtn" class="action secondary" type="button">🖨 Print</button>
    </div>
    <div id="status" class="status"></div>
  </div>
</div>
<script>
(async()=>{
  const status=document.getElementById('status');
  const qrCanvas=document.getElementById('studentQR');
  const downloadBtn=document.getElementById('downloadBtn');
  const printBtn=document.getElementById('printBtn');
  try{
    await new Promise((resolve,reject)=>{
      if(window.QRCode) return resolve();
      reject(new Error('QR library did not load.'));
    });
    await QRCode.toCanvas(qrCanvas, ${JSON.stringify(sid)}, {
      errorCorrectionLevel:'M',
      width:420,
      margin:2,
      color:{dark:'#000000',light:'#ffffff'}
    });
    status.textContent='ID card ready';
  }catch(e){
    status.textContent='QR loading error';
    console.error(e);
  }

  downloadBtn.onclick=async()=>{
    try{
      downloadBtn.disabled=true;
      downloadBtn.textContent='Preparing PDF...';
      status.textContent='Creating one-page PDF...';
      await new Promise(r=>setTimeout(r,120));
      const canvas=await html2canvas(document.getElementById('card'),{
        scale:3,
        useCORS:true,
        backgroundColor:'#ffffff',
        logging:false
      });
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:[86,128],compress:true});
      const img=canvas.toDataURL('image/jpeg',0.96);
      pdf.addImage(img,'JPEG',0,0,86,128,'FAST');
      pdf.save(${JSON.stringify('Student-ID-'+sid+'.pdf')});
      status.textContent='PDF downloaded successfully';
    }catch(e){
      console.error(e);
      status.textContent='PDF download failed. Use Print as fallback.';
      alert('PDF download failed: '+e.message);
    }finally{
      downloadBtn.disabled=false;
      downloadBtn.textContent='⬇ Download PDF';
    }
  };

  printBtn.onclick=()=>window.print();
})();
<\/script>
</body>
</html>`;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
    } catch(e) {
      w.document.open();
      w.document.write(`<p style="font-family:Arial;color:#b42318;padding:30px">Unable to load ID card: ${esc(e.message)}</p>`);
      w.document.close();
    }
  }

  document.addEventListener('click', e => {
    const photoBtn = e.target.closest('.student-photo-action');
    if (photoBtn) {
      e.preventDefault();
      e.stopImmediatePropagation();
      choosePhoto(photoBtn, photoBtn.dataset.photoMode === 'camera');
      return;
    }
    const idBtn = e.target.closest('.id-card-btn');
    if (idBtn) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openPhotoIDCard(idBtn.dataset.id).catch(err => alert('ID card error: ' + err.message));
    }
  }, true);

  const body = document.getElementById('studentsTableBody');
  if (body) new MutationObserver(() => decorate()).observe(body,{childList:true,subtree:true});
  decorate();
})();
