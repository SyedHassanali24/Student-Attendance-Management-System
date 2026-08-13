import { db, storage } from "../firebase/firebase-config.js";
import { collection, doc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

let students=[];
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function uploadPhoto(id){
 const input=document.createElement("input"); input.type="file"; input.accept="image/*"; input.style.display="none"; document.body.appendChild(input); input.click();
 input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;if(file.size>5*1024*1024)return alert("Please choose an image under 5 MB.");try{const path=`students/${id}/profile-${Date.now()}`;const r=ref(storage,path);await uploadBytes(r,file,{contentType:file.type||"image/jpeg"});const url=await getDownloadURL(r);await updateDoc(doc(db,"students",id),{photoURL:url,photoStoragePath:path,photoUpdatedAt:serverTimestamp()});alert("Student photo saved successfully. It is now available for the ID card and portal.");}catch(e){alert("Unable to save student photo: "+e.message)}};
}
function enhance(){document.querySelectorAll("#studentsTableBody tr").forEach(row=>{const idBtn=row.querySelector(".id-card-btn");if(!idBtn)return;const id=idBtn.dataset.id;if(!id||row.querySelector(".student-photo-btn"))return;const b=document.createElement("button");b.type="button";b.className="action-btn student-photo-btn";b.textContent="📷 Photo";b.onclick=()=>uploadPhoto(id);idBtn.parentElement?.appendChild(b);const s=students.find(x=>x.id===id);if(s?.photoURL&&!row.querySelector(".student-photo-thumb")){const img=document.createElement("img");img.src=s.photoURL;img.alt=s.name||"Student";img.className="student-photo-thumb";row.children[1]?.prepend(img)}})}
function addStyles(){if(document.getElementById("studentPhotoStyles"))return;const s=document.createElement("style");s.id="studentPhotoStyles";s.textContent='.student-photo-thumb{width:32px;height:32px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:8px;border:1px solid #d6dde8}.student-photo-btn{background:#f8fafc;color:#174ea6;border:1px solid #cbd5e1}';document.head.appendChild(s)}
function boot(){addStyles();onSnapshot(collection(db,"students"),snap=>{students=snap.docs.map(x=>({id:x.id,...x.data()}));enhance()});const t=document.getElementById("studentsTableBody");if(t)new MutationObserver(enhance).observe(t,{childList:true,subtree:true})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
