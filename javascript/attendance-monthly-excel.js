import { db } from "../firebase/firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

(() => {
  const monthInput = document.getElementById('attendanceReportMonth');
  const downloadBtn = document.getElementById('downloadMonthlyAttendanceBtn');
  if (!monthInput || !downloadBtn) return;
  const pad = n => String(n).padStart(2, '0');
  const today = new Date();
  monthInput.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const getDateKeys = (year, month) => { const days = new Date(year, month, 0).getDate(); return Array.from({length:days},(_,i)=>`${year}-${pad(month)}-${pad(i+1)}`); };
  const statusOf = r => { const s=String(r.status||r.attendanceStatus||'').toLowerCase(); if(s.includes('leave'))return'Leave'; if(s.includes('late'))return'Late'; if(s.includes('absent'))return'Absent'; return'Present'; };
  const dateOf = r => { if(r.date)return String(r.date).slice(0,10); const d=r.timestamp?.toDate?r.timestamp.toDate():r.timestamp?.seconds?new Date(r.timestamp.seconds*1000):null; return d?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`:''; };
  const mark = s => s==='Present'?'P':s==='Late'?'L':s==='Leave'?'LV':'A';
  async function build(){
    if(!window.ExcelJS)throw new Error('Excel export library is not loaded. Refresh the page and try again.');
    const [ss,as]=await Promise.all([getDocs(collection(db,'students')),getDocs(collection(db,'attendance'))]);
    const [year,month]=monthInput.value.split('-').map(Number); if(!year||!month)throw new Error('Select a valid month.');
    const dates=getDateKeys(year,month), valid=new Set(dates), map=new Map();
    as.docs.map(d=>d.data()).filter(r=>valid.has(dateOf(r))).forEach(r=>{const sid=String(r.studentId||r.studentID||r.student||r.studentDocId||''),date=dateOf(r);if(!sid||!date)return;const s=statusOf(r),k=`${sid}|${date}`,old=map.get(k);if(!old||s==='Leave'||(s==='Late'&&old==='Present'))map.set(k,s);});
    const wb=new ExcelJS.Workbook(), ws=wb.addWorksheet('Monthly Attendance',{views:[{state:'frozen',xSplit:4,ySplit:4}]});
    const titleEnd=4+dates.length+5, monthName=new Date(year,month-1,1).toLocaleString('en-US',{month:'long',year:'numeric'});
    ws.mergeCells(1,1,1,titleEnd);ws.getCell(1,1).value='SIR SYED HASSAN ALI COACHING MANAGEMENT SYSTEM';ws.getCell(1,1).font={bold:true,size:16,color:{argb:'FFFFFFFF'}};ws.getCell(1,1).alignment={horizontal:'center'};ws.getCell(1,1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B2F63'}};ws.getRow(1).height=28;
    ws.mergeCells(2,1,2,titleEnd);ws.getCell(2,1).value=`MONTHLY ATTENDANCE REPORT — ${monthName.toUpperCase()}`;ws.getCell(2,1).font={bold:true,size:12,color:{argb:'FF0B2F63'}};ws.getCell(2,1).alignment={horizontal:'center'};
    const headers=['#','Student ID','Student Name','Course / Batch',...dates.map(d=>`${Number(d.slice(8))} ${new Date(`${d}T12:00:00`).toLocaleString('en-US',{weekday:'short'})}`),'Present','Late','Leave','Absent','Attendance %'];
    headers.forEach((h,i)=>{const c=ws.getCell(4,i+1);c.value=h;c.font={bold:true,color:{argb:'FFFFFFFF'},size:10};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B2F63'}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};});ws.getRow(4).height=34;
    const students=ss.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    students.forEach((s,i)=>{const sid=String(s.studentId||s.id||'');let p=0,l=0,lv=0,a=0;const row=[i+1,sid,s.name||'',`${s.course||''}${s.batch?` / ${s.batch}`:''}`];dates.forEach(d=>{const st=map.get(`${sid}|${d}`)||'Absent';if(st==='Present')p++;else if(st==='Late')l++;else if(st==='Leave')lv++;else a++;row.push(mark(st));});const working=dates.length-lv;row.push(p,l,lv,a,working?Number((((p+l)/working)*100).toFixed(1)):0);const er=ws.addRow(row);er.eachCell((c,col)=>{c.alignment={horizontal:col<=4?'left':'center',vertical:'middle'};});dates.forEach((d,j)=>{const st=map.get(`${sid}|${d}`)||'Absent',c=er.getCell(5+j);c.font={bold:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:st==='Late'?'FFFFF2B2':st==='Leave'?'FFBDE7F5':st==='Absent'?'FFFFC7CE':'FFEAF7EF'}};});er.getCell(headers.length).numFmt='0.0"%"';});
    [6,16,24,24].forEach((w,i)=>ws.getColumn(i+1).width=w);dates.forEach((_,i)=>ws.getColumn(5+i).width=7);for(let i=5+dates.length;i<=headers.length;i++)ws.getColumn(i).width=13;ws.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,ws.rowCount),column:headers.length}};
    const legend=ws.addRow(['Legend','P = Present','L = Late','LV = Leave','A = Absent']);[['B2','FFEAF7EF'],['C2','FFFFF2B2'],['D2','FFBDE7F5'],['E2','FFFFC7CE']].forEach(([cell,color])=>ws.getCell(cell).fill={type:'pattern',pattern:'solid',fgColor:{argb:color}});
    const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),aEl=document.createElement('a');aEl.href=url;aEl.download=`Attendance-${year}-${pad(month)}-Sir-Syed-Hassan-Ali.xlsx`;document.body.appendChild(aEl);aEl.click();aEl.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);return students.length;
  }
  downloadBtn.addEventListener('click',async()=>{const old=downloadBtn.innerHTML;downloadBtn.disabled=true;downloadBtn.innerHTML='⏳ Preparing Excel...';try{const n=await build();downloadBtn.innerHTML=`✓ Downloaded (${n} students)`;setTimeout(()=>{downloadBtn.innerHTML=old;downloadBtn.disabled=false},2200)}catch(e){console.error(e);alert('Monthly attendance Excel could not be generated.\n\n'+e.message);downloadBtn.innerHTML=old;downloadBtn.disabled=false}});
})();
