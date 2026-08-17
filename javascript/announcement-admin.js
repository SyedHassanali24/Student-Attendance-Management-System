import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
let unsubscribe = null;
let announcements = [];
let editingId = null;

function injectStyles(){
  if(document.getElementById("announcementAdminStyles")) return;
  const style=document.createElement("style"); style.id="announcementAdminStyles";
  style.textContent=`
  .announcement-admin{display:grid;grid-template-columns:minmax(320px,380px) 1fr;gap:20px}.announcement-form-card,.announcement-list-card{background:#fff;border:1px solid #dfe7f1;border-radius:16px;padding:20px;box-shadow:0 8px 28px rgba(15,43,82,.06)}
  .announcement-form-card h3,.announcement-list-card h3{margin:0 0 5px;color:#0b2f63}.announcement-muted{color:#718096;font-size:12px;margin:0 0 18px}
  .announcement-form{display:grid;gap:13px}.announcement-form label{font-size:12px;font-weight:700;color:#30445f;display:grid;gap:6px}.announcement-form input,.announcement-form select,.announcement-form textarea{width:100%;box-sizing:border-box;border:1px solid #d5dfeb;border-radius:9px;padding:11px 12px;font:inherit;color:#172b4d;background:#fbfcfe}.announcement-form textarea{min-height:125px;resize:vertical}.announcement-form input:focus,.announcement-form select:focus,.announcement-form textarea:focus{outline:0;border-color:#2456d9;box-shadow:0 0 0 3px rgba(36,86,217,.1)}
  .announcement-actions{display:flex;gap:9px}.announcement-btn{border:0;border-radius:9px;padding:11px 15px;font-weight:700;cursor:pointer}.announcement-primary{background:#2456d9;color:#fff}.announcement-secondary{background:#eef2f7;color:#253858}.announcement-list{display:grid;gap:12px}.announcement-admin-item{border:1px solid #e2e8f0;border-radius:13px;padding:15px;background:#fbfcff}.announcement-admin-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.announcement-admin-title{font-weight:800;color:#102a52;margin:0}.announcement-badge{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;text-transform:uppercase}.announcement-badge.info{background:#e8f0ff;color:#2456d9}.announcement-badge.important{background:#fff3db;color:#9a6500}.announcement-badge.urgent{background:#ffe7e7;color:#b42318}.announcement-date{font-size:11px;color:#7a8798;margin:6px 0}.announcement-message{white-space:pre-wrap;color:#40516a;font-size:13px;line-height:1.6;margin:8px 0 12px}.announcement-item-actions{display:flex;gap:7px}.announcement-item-actions button{border:1px solid #d9e1ec;background:#fff;border-radius:7px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer}.announcement-empty{text-align:center;padding:35px;color:#8290a5;border:1px dashed #d7e0eb;border-radius:12px}@media(max-width:900px){.announcement-admin{grid-template-columns:1fr}}
  `; document.head.appendChild(style);
}

function render(){
  const root=document.getElementById("announcements"); if(!root) return;
  root.innerHTML=`<div class="panel"><div class="panel-header"><div><h2>📢 Announcements</h2><p>Publish one announcement and it will instantly appear in every student portal.</p></div><span class="scanner-status">Live</span></div>
  <div class="announcement-admin">
    <div class="announcement-form-card"><h3 id="announcementFormTitle">Create Announcement</h3><p class="announcement-muted">Fill only these simple details.</p>
      <form id="announcementForm" class="announcement-form">
        <label>Title<input id="announcementTitle" maxlength="120" required placeholder="e.g. Classes will remain closed tomorrow"></label>
        <label>Type<select id="announcementType"><option value="info">General</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
        <label>Announcement<textarea id="announcementMessage" maxlength="2000" required placeholder="Write your announcement here..."></textarea></label>
        <div class="announcement-actions"><button class="announcement-btn announcement-primary" id="announcementSave" type="submit">Publish Announcement</button><button class="announcement-btn announcement-secondary" id="announcementCancel" type="button" hidden>Cancel</button></div>
        <div id="announcementFormMessage" class="announcement-muted"></div>
      </form>
    </div>
    <div class="announcement-list-card"><h3>Published Announcements</h3><p class="announcement-muted">Students see these automatically in their Announcements section.</p><div id="announcementAdminList" class="announcement-list"></div></div>
  </div></div>`;
  document.getElementById("announcementForm").addEventListener("submit", saveAnnouncement);
  document.getElementById("announcementCancel").addEventListener("click", resetForm);
  renderList();
}

function formatDate(a){const d=a.createdAt?.toDate?a.createdAt.toDate():new Date(a.createdAt||Date.now());return d.toLocaleString([], {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function renderList(){const el=document.getElementById("announcementAdminList");if(!el)return;if(!announcements.length){el.innerHTML='<div class="announcement-empty">No announcements yet.<br>Create your first announcement.</div>';return;}el.innerHTML=announcements.map(a=>`<article class="announcement-admin-item"><div class="announcement-admin-top"><h4 class="announcement-admin-title">${escapeHTML(a.title)}</h4><span class="announcement-badge ${escapeHTML(a.type||"info")}">${escapeHTML(a.type||"info")}</span></div><div class="announcement-date">${formatDate(a)}</div><div class="announcement-message">${escapeHTML(a.message)}</div><div class="announcement-item-actions"><button type="button" data-edit="${a.id}">Edit</button><button type="button" data-delete="${a.id}">Delete</button></div></article>`).join("");el.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editAnnouncement(b.dataset.edit));el.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>removeAnnouncement(b.dataset.delete));}

async function saveAnnouncement(e){e.preventDefault();const title=document.getElementById("announcementTitle").value.trim();const message=document.getElementById("announcementMessage").value.trim();const type=document.getElementById("announcementType").value;const msg=document.getElementById("announcementFormMessage");const btn=document.getElementById("announcementSave");if(!title||!message)return;btn.disabled=true;msg.textContent="Saving...";try{if(editingId){await updateDoc(doc(db,"announcements",editingId),{title,message,type,updatedAt:serverTimestamp()});msg.textContent="Announcement updated.";}else{await addDoc(collection(db,"announcements"),{title,message,type,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});msg.textContent="Published successfully. Students can see it now.";}setTimeout(resetForm,500);}catch(error){console.error(error);msg.textContent="Error: "+error.message;}finally{btn.disabled=false;}}
function editAnnouncement(id){const a=announcements.find(x=>x.id===id);if(!a)return;editingId=id;document.getElementById("announcementFormTitle").textContent="Edit Announcement";document.getElementById("announcementTitle").value=a.title||"";document.getElementById("announcementMessage").value=a.message||"";document.getElementById("announcementType").value=a.type||"info";document.getElementById("announcementSave").textContent="Update Announcement";document.getElementById("announcementCancel").hidden=false;document.getElementById("announcementFormMessage").textContent="";}
function resetForm(){editingId=null;const f=document.getElementById("announcementForm");if(f)f.reset();const t=document.getElementById("announcementFormTitle");if(t)t.textContent="Create Announcement";const b=document.getElementById("announcementSave");if(b)b.textContent="Publish Announcement";const c=document.getElementById("announcementCancel");if(c)c.hidden=true;}
async function removeAnnouncement(id){const a=announcements.find(x=>x.id===id);if(!a||!confirm(`Delete "${a.title}"?`))return;try{await deleteDoc(doc(db,"announcements",id));}catch(error){alert("Unable to delete announcement: "+error.message);}}

onAuthStateChanged(auth,user=>{if(!user)return;injectStyles();const start=()=>{render();unsubscribe?.();try{unsubscribe=onSnapshot(query(collection(db,"announcements"),orderBy("createdAt","desc")),snap=>{announcements=snap.docs.map(d=>({id:d.id,...d.data()}));renderList();},error=>{console.error(error);const el=document.getElementById("announcementAdminList");if(el)el.innerHTML=`<div class="announcement-empty">Unable to load announcements.<br>${escapeHTML(error.message)}</div>`;});}catch(e){console.error(e)}};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();});
