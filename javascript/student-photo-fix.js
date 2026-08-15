import { db } from "../firebase/firebase-config.js";
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
  const STYLE = `
    .student-name-cell{min-width:0!important;width:150px!important;max-width:150px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
    .student-photo-thumb{width:34px;height:34px;border-radius:50%;object-fit:cover;display:inline-block;vertical-align:middle;margin-right:7px;border:2px solid #e6ebf2;background:#f4f7fb;}
    .student-photo-placeholder{width:34px;height:34px;border-radius:50%;display:inline-grid;place-items:center;vertical-align:middle;margin-right:7px;background:#edf2f8;color:#36557d;font-weight:800;font-size:13px;border:2px solid #e6ebf2;}
  `;
  const style=document.createElement('style'); style.textContent=STYLE; document.head.appendChild(style);

  function getId(btn){
    if(btn?.dataset?.id) return btn.dataset.id;
    const row=btn?.closest('tr');
    const idBtn=row?.querySelector('[data-id]');
    return idBtn?.dataset?.id || '';
  }
  function compressImage(file){
    return new Promise((resolve,reject)=>{
      if(!file || !file.type.startsWith('image/')) return reject(new Error('Please select an image file.'));
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Could not read the image.'));
      reader.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          const maxW=420,maxH=520;
          const scale=Math.min(1,maxW/img.width,maxH/img.height);
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.width*scale));
          canvas.height=Math.max(1,Math.round(img.height*scale));
          const ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL('image/jpeg',0.78));
        };
        img.onerror=()=>reject(new Error('Invalid image.'));
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function savePhoto(btn,file){
    const id=getId(btn); if(!id) throw new Error('Student record ID not found.');
    btn.disabled=true;
    const old=btn.textContent; btn.textContent='⏳ Saving...';
    try{
      const photo=await compressImage(file);
      await updateDoc(doc(db,'students',id),{photo,photoUpdatedAt:new Date().toISOString()});
      btn.textContent='✓ Photo';
      btn.classList.add('photo-saved');
      setTimeout(()=>{btn.textContent=old||'📷 Photo';btn.disabled=false;},900);
      renderRowPhoto(id,photo);
    }catch(e){
      console.error(e); alert('Photo save failed: '+e.message); btn.textContent=old||'📷 Photo'; btn.disabled=false;
    }
  }

  function renderRowPhoto(id,photo){
    document.querySelectorAll('tr').forEach(row=>{
      const any=row.querySelector(`[data-id="${CSS.escape(id)}"]`); if(!any)return;
      const cells=row.querySelectorAll('td');
      if(!cells.length)return;
      const nameCell=cells[1]; if(!nameCell)return;
      const existing=nameCell.querySelector('.student-photo-thumb,.student-photo-placeholder'); existing?.remove();
      const img=document.createElement('img'); img.className='student-photo-thumb'; img.src=photo; img.alt='Student photo';
      nameCell.prepend(img);
    });
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('button'); if(!btn)return;
    const text=(btn.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(!(btn.classList.contains('photo-btn') || text==='photo' || text.includes('photo'))) return;
    e.preventDefault(); e.stopPropagation();
    let input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='user'; input.style.display='none';
    document.body.appendChild(input);
    input.addEventListener('change',()=>{const file=input.files?.[0]; if(file)savePhoto(btn,file);input.remove();},{once:true});
    input.click();
  },true);

  function scanRows(){
    document.querySelectorAll('#studentsTableBody tr').forEach(async row=>{
      const idEl=row.querySelector('[data-id]'); const id=idEl?.dataset?.id; if(!id)return;
      const cells=row.querySelectorAll('td'); const nameCell=cells[1]; if(!nameCell || nameCell.querySelector('.student-photo-thumb'))return;
      try{const snap=await getDoc(doc(db,'students',id)); const data=snap.exists()?snap.data():null; if(data?.photo)renderRowPhoto(id,data.photo);}catch(e){console.warn('Student photo read failed',e);}
    });
  }
  const observer=new MutationObserver(()=>scanRows());
  const body=document.getElementById('studentsTableBody'); if(body)observer.observe(body,{childList:true,subtree:true});
  setTimeout(scanRows,600);

  const originalOpen=window.open;
  let pendingStudentId='';
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.id-card-btn'); if(btn) pendingStudentId=btn.dataset.id||'';
  },true);
  window.open=function(...args){
    const child=originalOpen.apply(window,args);
    const id=pendingStudentId; pendingStudentId='';
    if(child && id){
      setTimeout(async()=>{
        try{
          const snap=await getDoc(doc(db,'students',id)); const photo=snap.exists()?snap.data()?.photo:'';
          if(!photo || !child.document?.body)return;
          const target=child.document.querySelector('.photo');
          if(target){target.innerHTML=`<img src="${photo}" alt="Student Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;target.style.padding='0';target.style.overflow='hidden';}
        }catch(e){console.warn('ID card photo injection failed',e);}
      },350);
    }
    return child;
  };
})();
