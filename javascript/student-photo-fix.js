import { db } from "../firebase/firebase-config.js";
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
  const style = document.createElement('style');
  style.textContent = `
    #studentsTableBody td:nth-child(2){width:180px!important;min-width:180px!important;max-width:180px!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important;}
    #studentsTableBody td:nth-child(2) .student-name-wrap{display:flex!important;align-items:center!important;width:100%!important;min-width:0!important;overflow:hidden!important;}
    .student-name-text{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
    .student-photo-thumb{width:36px!important;height:36px!important;min-width:36px!important;border-radius:50%!important;object-fit:cover!important;margin-right:8px!important;display:block!important;}
  `;
  document.head.appendChild(style);

  const idOf = el => el?.dataset?.id || el?.closest('tr')?.querySelector('[data-id]')?.dataset?.id || '';

  function compress(file){
    return new Promise((resolve,reject)=>{
      if(!file?.type?.startsWith('image/')) return reject(new Error('Please select an image.'));
      const r=new FileReader();
      r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');const s=Math.min(1,520/img.width,620/img.height);c.width=Math.max(1,img.width*s);c.height=Math.max(1,img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82));};img.onerror=()=>reject(new Error('Invalid image.'));img.src=r.result;};
      r.onerror=()=>reject(new Error('Image could not be read.'));r.readAsDataURL(file);
    });
  }

  async function savePhoto(button,file){
    const id=idOf(button);if(!id)return;
    try{
      button.disabled=true;const photo=await compress(file);await updateDoc(doc(db,'students',id),{photo,photoUpdatedAt:new Date().toISOString()});
      button.textContent='✓ Photo';setTimeout(()=>{button.textContent='📷 Photo';button.disabled=false;},900);renderPhoto(id,photo);
    }catch(e){button.disabled=false;alert('Photo save failed: '+e.message);}
  }

  function choosePhoto(button){
    const input=document.createElement('input');input.type='file';input.accept='image/*';
    document.body.appendChild(input);
    input.onchange=()=>{const f=input.files?.[0];input.remove();if(f)savePhoto(button,f);};
    input.click();
  }

  function renderPhoto(id,photo){
    document.querySelectorAll('#studentsTableBody tr').forEach(row=>{
      if(!row.querySelector(`[data-id="${CSS.escape(id)}"]`))return;
      const cell=row.querySelectorAll('td')[1];if(!cell)return;
      const name=cell.querySelector('.student-name-text')?.textContent||cell.textContent.trim()||'Student';
      cell.innerHTML='';const wrap=document.createElement('div');wrap.className='student-name-wrap';
      if(photo){const img=document.createElement('img');img.className='student-photo-thumb';img.src=photo;img.alt='Student photo';wrap.appendChild(img);}
      const span=document.createElement('span');span.className='student-name-text';span.textContent=name;span.title=name;wrap.appendChild(span);cell.appendChild(wrap);
    });
  }

  async function decorate(){
    for(const row of document.querySelectorAll('#studentsTableBody tr')){
      const id=row.querySelector('[data-id]')?.dataset?.id;const cells=row.querySelectorAll('td');const cell=cells[1];if(!id||!cell)continue;
      if(!cell.querySelector('.student-name-wrap')){const name=cell.textContent.trim()||'Student';cell.innerHTML=`<div class="student-name-wrap"><span class="student-name-text"></span></div>`;cell.querySelector('.student-name-text').textContent=name;}
      const actions=row.querySelector('.action-buttons');
      if(actions&&!actions.querySelector('.student-photo-action')){const b=document.createElement('button');b.type='button';b.className='action-btn student-photo-action';b.dataset.id=id;b.textContent='📷 Photo';actions.insertBefore(b,actions.firstChild);}
      try{const snap=await getDoc(doc(db,'students',id));if(snap.exists()&&snap.data().photo)renderPhoto(id,snap.data().photo);}catch(e){console.warn(e);}
    }
  }

  document.addEventListener('click',e=>{const b=e.target.closest('.student-photo-action');if(b){e.preventDefault();e.stopImmediatePropagation();choosePhoto(b);}},true);
  const body=document.getElementById('studentsTableBody');if(body){new MutationObserver(decorate).observe(body,{childList:true,subtree:true});decorate();}
})();
