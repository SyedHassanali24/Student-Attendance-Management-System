import { db } from "../firebase/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function qrUrl(id) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&format=png&ecc=M&data=${encodeURIComponent(id)}`;
  }

  function cardHTML(s) {
    const id = String(s.studentId || s.id || '').trim();
    const photo = s.photo ? `<img class="photo" src="${esc(s.photo)}" alt="Student photo">` : `<div class="photo placeholder">${esc((s.name || 'S').charAt(0).toUpperCase())}</div>`;
    const qr = id ? `<img class="qr-image" src="${qrUrl(id)}" alt="QR Code for ${esc(id)}" onerror="this.style.display='none';document.getElementById('qrError').style.display='block';">` : '';
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name || 'Student')} - ID Card</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#eef2f7;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}.card{width:370px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(15,35,65,.18)}.head{background:#0b2f63;color:#fff;text-align:center;padding:22px 18px}.head h2{margin:0;font-size:20px;letter-spacing:.3px}.head p{margin:6px 0 0;font-size:12px;opacity:.9}.body{padding:22px;text-align:center}.photo{width:112px;height:112px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 13px;border:4px solid #e6edf7;background:#eef3fa}.placeholder{display:grid;place-items:center;font-size:40px;font-weight:800;color:#0b2f63}.name{font-size:21px;font-weight:800;color:#102a52;line-height:1.25;overflow-wrap:anywhere;word-break:break-word}.id{display:inline-block;margin-top:6px;padding:5px 10px;border-radius:999px;background:#edf3fb;color:#0b2f63;font-size:12px;font-weight:800}.details{margin-top:16px;text-align:left;border-top:1px solid #e5eaf1}.row{display:flex;gap:14px;justify-content:space-between;padding:9px 0;border-bottom:1px solid #e5eaf1;font-size:12px}.row b{color:#68778b;min-width:90px}.row span{font-weight:700;color:#182b45;text-align:right;overflow-wrap:anywhere}.qr-title{margin:17px 0 8px;font-size:12px;color:#66768a;font-weight:700}.qr-wrap{width:210px;height:210px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;background:#fff}.qr-image{width:210px;height:210px;display:block;object-fit:contain;image-rendering:auto}.qr-error{display:none;font-size:11px;color:#b42318;padding:12px}.qr-note{font-size:10px;color:#718096;margin-bottom:16px}.print{border:0;border-radius:9px;padding:11px 20px;background:#0b2f63;color:#fff;font-weight:700;cursor:pointer}@media print{body{background:#fff;padding:0}.card{box-shadow:none;width:370px}.print{display:none}}
    </style></head><body><div class="card"><div class="head"><h2>SIR SYED HASSAN ALI COACHING</h2><p>Student Identity Card</p></div><div class="body">${photo}<div class="name">${esc(s.name || 'Student')}</div><div class="id">${esc(id)}</div><div class="details"><div class="row"><b>Father Name</b><span>${esc(s.fatherName || '-')}</span></div><div class="row"><b>Phone</b><span>${esc(s.phone || '-')}</span></div><div class="row"><b>Course</b><span>${esc(s.course || '-')}</span></div><div class="row"><b>Batch</b><span>${esc(s.batch || '-')}</span></div></div><div class="qr-title">SCAN FOR STUDENT ID</div><div id="studentQR" class="qr-wrap">${qr}<div id="qrError" class="qr-error">QR code could not be loaded. Please check your internet connection.</div></div><div class="qr-note">QR contains only Student ID: ${esc(id)}</div><button class="print" onclick="window.print()">Print / Save PDF</button></div></div></body></html>`;
  }

  async function openStudentCard(id) {
    const w = window.open('', '_blank', 'width=620,height=900');
    if (!w) { alert('Please allow pop-ups for Student ID Cards.'); return; }
    w.document.open(); w.document.write('<!doctype html><html><body style="font-family:Arial;padding:30px">Loading Student ID Card...</body></html>'); w.document.close();
    try {
      const snap = await getDoc(doc(db, 'students', id));
      if (!snap.exists()) throw new Error('Student record not found.');
      w.document.open(); w.document.write(cardHTML({id:snap.id,...snap.data()})); w.document.close();
    } catch (e) {
      w.document.open(); w.document.write(`<p style="font-family:Arial;color:#b42318;padding:30px">Unable to load ID card: ${esc(e.message)}</p>`); w.document.close();
    }
  }

  function bind() {
    document.querySelectorAll('.id-card-btn').forEach(btn => {
      if (btn.dataset.idCardFixed === '1') return;
      btn.dataset.idCardFixed = '1';
      btn.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openStudentCard(btn.dataset.id); }, true);
    });
  }

  const observer = new MutationObserver(bind);
  observer.observe(document.body, {childList:true, subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
