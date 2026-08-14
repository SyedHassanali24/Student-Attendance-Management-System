import { db, storage } from "../firebase/firebase-config.js";
import {
    collection,
    doc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

/* =========================================================
   STUDENT PHOTO + PROFESSIONAL ONE-PAGE ID CARD
   - Photo is stored in Firebase Storage and linked to student
   - ID card always uses the latest photoURL
   - QR contains ONLY the short Student ID
   - One-click PDF download, fixed ID-card page size
========================================================= */

let students = [];

const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const escAttr = value => esc(value).replace(/`/g, "&#096;");

function getStudent(id) {
    return students.find(student => student.id === id);
}

/* =========================================================
   PHOTO UPLOAD
========================================================= */

function uploadPhoto(id) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/*";
    input.style.display = "none";

    document.body.appendChild(input);
    input.click();

    input.onchange = async () => {
        const file = input.files?.[0];
        input.remove();

        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("Please choose an image under 5 MB.");
            return;
        }

        try {
            const extension =
                (file.name.split(".").pop() || "jpg")
                    .replace(/[^a-z0-9]/gi, "")
                    .toLowerCase() || "jpg";

            const path = `students/${id}/profile-${Date.now()}.${extension}`;
            const storageRef = ref(storage, path);

            await uploadBytes(storageRef, file, {
                contentType: file.type || "image/jpeg"
            });

            const url = await getDownloadURL(storageRef);

            await updateDoc(
                doc(db, "students", id),
                {
                    photoURL: url,
                    photoStoragePath: path,
                    photoUpdatedAt: serverTimestamp()
                }
            );

            alert("Student photo saved successfully. It will appear on the ID card and student portal.");
        } catch (error) {
            console.error("Student photo upload error:", error);
            alert("Unable to save student photo: " + error.message);
        }
    };
}

/* =========================================================
   ONE-CLICK PROFESSIONAL ID CARD
========================================================= */

function openProfessionalIDCard(id) {
    const student = getStudent(id);

    if (!student) {
        alert("Student not found.");
        return;
    }

    const popup = window.open(
        "",
        "_blank",
        "width=700,height=900"
    );

    if (!popup) {
        alert("Please allow pop-ups for this website.");
        return;
    }

    const name = esc(student.name || "Student");
    const studentId = esc(student.studentId || "-");
    const father = esc(student.fatherName || "-");
    const course = esc(student.course || "-");
    const batch = esc(student.batch || "-");
    const phone = esc(student.phone || "-");

    const photo = student.photoURL
        ? `<img class="student-photo" src="${escAttr(student.photoURL)}" alt="${escAttr(student.name || "Student")}">`
        : `<div class="student-photo photo-placeholder">${esc((student.name || "S").charAt(0).toUpperCase())}</div>`;

    /* Only the short ID is encoded. This keeps the QR sparse and highly scannable. */
    const qrText = student.studentId || "";

    /* Resolve logo from the actual page URL so it works on GitHub Pages and locally. */
    const logoUrl = new URL("./assets/logo.png", window.location.href).href;

    popup.document.write(`
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} - Student ID Card</title>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;min-height:100%;font-family:Inter,Arial,Helvetica,sans-serif}
body{background:#e9eef5;display:flex;justify-content:center;align-items:flex-start;padding:34px 18px;color:#102a57}
.page{display:flex;flex-direction:column;align-items:center;gap:18px}

.id-card{
    width:428px;
    height:270px;
    position:relative;
    overflow:hidden;
    border-radius:18px;
    background:#fff;
    border:1px solid #d9e0ea;
    box-shadow:0 22px 55px rgba(15,23,42,.22);
}

.top-accent{height:7px;background:linear-gradient(90deg,#0a2b59,#d6a94c,#0a2b59)}

.header{
    height:72px;
    display:flex;
    align-items:center;
    gap:12px;
    padding:10px 16px;
    color:#fff;
    background:linear-gradient(135deg,#061b42 0%,#0c376f 65%,#174d86 100%);
}

.logo-wrap{
    width:52px;height:52px;flex:0 0 52px;
    border-radius:12px;background:#fff;
    display:flex;align-items:center;justify-content:center;
    overflow:hidden;border:1px solid rgba(255,255,255,.75)
}
.logo{width:100%;height:100%;object-fit:contain;padding:3px}

.brand-title{font-size:16px;font-weight:850;letter-spacing:.15px;line-height:1.15}
.brand-sub{margin-top:4px;font-size:7px;letter-spacing:1.35px;text-transform:uppercase;opacity:.82}

.content{height:151px;padding:13px 16px;display:grid;grid-template-columns:78px 1fr 92px;gap:13px;align-items:center}

.student-photo{
    width:78px;height:96px;object-fit:cover;border-radius:11px;
    border:2px solid #d6a94c;background:#f5f7fa;display:block
}
.photo-placeholder{display:flex;align-items:center;justify-content:center;font-size:29px;font-weight:800;color:#0c376f}

.student-name{font-size:18px;font-weight:850;line-height:1.15;color:#0a2854;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px}

.details{font-size:8.5px;color:#53657b;line-height:1.72}
.details-row{display:flex;min-width:0}
.details-label{width:43px;flex:0 0 43px;color:#0b2d5c;font-weight:800}
.details-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#3f5168}

.qr-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.qr-box{width:92px;height:92px;padding:7px;background:#fff;border:1px solid #d7e0ea;border-radius:10px;display:flex;align-items:center;justify-content:center}
#qr img,#qr canvas{width:78px!important;height:78px!important;image-rendering:auto}
.qr-label{font-size:6.5px;font-weight:800;letter-spacing:.8px;color:#53657b;text-transform:uppercase}

.footer{height:40px;padding:0 16px;border-top:1px solid #e7ebf1;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:7px;color:#66778d}
.footer strong{color:#0a2b59;font-size:7.5px}

.actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
.btn{border:0;border-radius:10px;padding:11px 17px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 5px 14px rgba(15,23,42,.12)}
.download{background:#0b3569;color:#fff}
.print{background:#fff;color:#0b3569;border:1px solid #cbd5e1}
.btn:disabled{opacity:.55;cursor:wait}
.note{font-size:10px;color:#64748b;text-align:center;max-width:440px}

@media print{
    @page{size:85.6mm 53.98mm;margin:0}
    html,body{width:85.6mm;height:53.98mm;background:#fff;padding:0;overflow:hidden}
    .page{width:85.6mm;height:53.98mm;gap:0}
    .id-card{width:85.6mm;height:53.98mm;border-radius:3mm;box-shadow:none}
    .actions,.note{display:none!important}
}
</style>
</head>

<body>
<div class="page">
    <div id="idCard" class="id-card">
        <div class="top-accent"></div>

        <div class="header">
            <div class="logo-wrap">
                <img class="logo" src="${escAttr(logoUrl)}" alt="Sir Syed Hassan Ali">
            </div>
            <div>
                <div class="brand-title">Sir Syed Hassan Ali Coaching</div>
                <div class="brand-sub">Student Identification Card • SSHACMS</div>
            </div>
        </div>

        <div class="content">
            ${photo}

            <div>
                <div class="student-name">${name}</div>
                <div class="details">
                    <div class="details-row"><span class="details-label">ID</span><span class="details-value">${studentId}</span></div>
                    <div class="details-row"><span class="details-label">Father</span><span class="details-value">${father}</span></div>
                    <div class="details-row"><span class="details-label">Course</span><span class="details-value">${course}</span></div>
                    <div class="details-row"><span class="details-label">Batch</span><span class="details-value">${batch}</span></div>
                    <div class="details-row"><span class="details-label">Phone</span><span class="details-value">${phone}</span></div>
                </div>
            </div>

            <div class="qr-panel">
                <div id="qr" class="qr-box"></div>
                <div class="qr-label">Scan Student ID</div>
            </div>
        </div>

        <div class="footer">
            <strong>Sir Syed Hassan Ali Coaching Management System</strong>
            <span>Valid Student ID • ${studentId}</span>
        </div>
    </div>

    <div class="actions">
        <button id="downloadBtn" class="btn download">⬇ Download ID Card</button>
        <button class="btn print" onclick="window.print()">🖨 Print</button>
    </div>
    <div id="note" class="note">Professional one-page ID card • QR contains only the short Student ID for faster scanning.</div>
</div>

<script>
const QR_TEXT = ${JSON.stringify(qrText)};
const FILE_NAME = ${JSON.stringify((student.studentId || "student-id") + "-ID-Card.pdf")};

function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function waitForImages(root){
    const images=[...root.querySelectorAll('img')];
    await Promise.all(images.map(img=>new Promise(resolve=>{
        if(img.complete) return resolve();
        img.onload=resolve;
        img.onerror=resolve;
    })));
}

async function downloadPDF(){
    const button=document.getElementById('downloadBtn');
    const note=document.getElementById('note');

    if(!window.html2canvas || !window.jspdf){
        alert('PDF tools are still loading. Please try again in a moment.');
        return;
    }

    button.disabled=true;
    button.textContent='Preparing PDF...';

    try{
        const card=document.getElementById('idCard');
        await waitForImages(card);
        await wait(250);

        const canvas=await html2canvas(card,{
            scale:3,
            useCORS:true,
            allowTaint:false,
            backgroundColor:'#ffffff',
            logging:false,
            imageTimeout:15000
        });

        const { jsPDF } = window.jspdf;
        const pdf=new jsPDF({
            orientation:'landscape',
            unit:'mm',
            format:[85.6,53.98],
            compress:true
        });

        const image=canvas.toDataURL('image/jpeg',0.96);
        pdf.addImage(image,'JPEG',0,0,85.6,53.98,undefined,'FAST');
        pdf.save(FILE_NAME);

        note.textContent='Downloaded successfully as a single-page PDF.';
    }catch(error){
        console.error('ID card PDF error:',error);
        note.textContent='Download failed. Please use Print if your browser blocks image export.';
        alert('Unable to create the PDF: '+error.message);
    }finally{
        button.disabled=false;
        button.textContent='⬇ Download ID Card';
    }
}

window.addEventListener('load',()=>{
    try{
        new QRCode(document.getElementById('qr'),{
            text:QR_TEXT,
            width:78,
            height:78,
            correctLevel:QRCode.CorrectLevel.M
        });
    }catch(error){
        console.error('QR generation error:',error);
    }

    document.getElementById('downloadBtn').addEventListener('click',downloadPDF);
});
</script>
</body>
</html>
`);

    popup.document.close();
}

/* =========================================================
   CAPTURE ID CARD CLICK BEFORE admin.js
   admin.js already adds a click listener. Capturing here prevents
   the old two-page card from opening and keeps one clean flow.
========================================================= */

document.addEventListener("click", event => {
    const idButton = event.target.closest?.(".id-card-btn");

    if (!idButton) return;

    const id = idButton.dataset.id;
    if (!id) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    openProfessionalIDCard(id);
}, true);

/* =========================================================
   STUDENT TABLE ENHANCEMENT
========================================================= */

function enhanceStudentRows() {
    document.querySelectorAll("#studentsTableBody tr").forEach(row => {
        const idButton = row.querySelector(".id-card-btn");
        if (!idButton) return;

        const id = idButton.dataset.id;
        if (!id) return;

        const student = getStudent(id);
        if (!student) return;

        const nameCell = row.children[1];

        if (nameCell && !nameCell.querySelector(".student-photo-thumb")) {
            const wrapper = document.createElement("span");
            wrapper.style.display = "inline-flex";
            wrapper.style.alignItems = "center";
            wrapper.style.gap = "8px";

            const image = document.createElement("img");
            image.src = student.photoURL || "";
            image.alt = student.name || "Student";
            image.className = "student-photo-thumb";

            if (student.photoURL) {
                wrapper.appendChild(image);
            }

            const existingContent = nameCell.innerHTML;
            const text = document.createElement("span");
            text.innerHTML = existingContent;
            wrapper.appendChild(text);

            nameCell.innerHTML = "";
            nameCell.appendChild(wrapper);
        }

        if (!row.querySelector(".student-photo-btn")) {
            const photoButton = document.createElement("button");
            photoButton.type = "button";
            photoButton.className = "action-btn student-photo-btn";
            photoButton.textContent = "📷 Photo";
            photoButton.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                uploadPhoto(id);
            });
            idButton.parentElement?.appendChild(photoButton);
        }
    });
}

function addStyles() {
    if (document.getElementById("studentPhotoStyles")) return;

    const style = document.createElement("style");
    style.id = "studentPhotoStyles";
    style.textContent = `
        .student-photo-thumb{
            width:34px;
            height:34px;
            object-fit:cover;
            border-radius:9px;
            border:1px solid #d6a94c;
            vertical-align:middle;
            background:#f8fafc;
            flex:0 0 34px;
        }
        .student-photo-btn{
            background:#f8fafc;
            color:#174ea6;
            border:1px solid #cbd5e1;
        }
    `;
    document.head.appendChild(style);
}

function boot() {
    addStyles();

    onSnapshot(
        collection(db, "students"),
        snapshot => {
            students = snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));

            enhanceStudentRows();
        },
        error => console.error("Student photo listener error:", error)
    );

    const table = document.getElementById("studentsTableBody");
    if (table) {
        new MutationObserver(enhanceStudentRows).observe(
            table,
            { childList: true, subtree: true }
        );
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
    boot();
}
