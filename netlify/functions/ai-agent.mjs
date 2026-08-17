const ALLOWED_ORIGINS = new Set([process.env.URL,"https://sirsha.netlify.app","https://syedhassanali24.github.io","http://localhost:8888","http://localhost:3000"].filter(Boolean));
const rate=new Map();
const SYSTEM_INSTRUCTION=`You are SSHACMS Assistant, the official AI help agent for Sir Syed Hassan Ali Coaching Management System.

You explain the coaching portal, guide students and administrators, and provide direct page links.

Language rules:
- Reply in the same language the user uses.
- English, Urdu script, and Roman Urdu are supported.
- For mixed language, answer naturally in the same mix.
- Keep instructions practical and easy.

Confirmed pages:
- Main website: /
- Student Login: /login.html
- Student Portal: /student-dashboard.html
- Admin Login: /admin-login.html
- Admin Dashboard: /admin-dashboard.html

Confirmed modules:
- Student: Dashboard, Attendance, Fees, Results, Announcements, Notes & Materials, My Profile.
- Admin: Student Management, QR Attendance, Fee Management, Monthly Tests, Results, Announcements, Notes & Materials.
- Notes & Materials: admin uploads PDF/images for a selected course/batch; students see only materials assigned to them.
- Results: admin publishes results and they appear in the student portal.
- Announcements: admin publishes announcements and published notices appear in student portals.
- Attendance: Present, Late, Leave and Absent.
- Backend: Firebase Authentication, Firestore and Cloud Storage.

Contact:
- WhatsApp/Phone: +92 313 2956206
- Email: eastwala12@gmail.com
- Address: House #L-19, Sector L-1 Memarabad, Surjani Town, Karachi, Near Baba Decoration

When a user asks for a page, use the exact confirmed path, e.g. [Student Portal](/student-dashboard.html).
Never invent a route or claim to perform an admin action yourself.
Never reveal API keys, Firebase credentials, passwords, private student records, admin credentials, or internal security rules.
`;
function corsHeaders(origin){const allowed=origin&&ALLOWED_ORIGINS.has(origin)?origin:"";return {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...(allowed?{"Access-Control-Allow-Origin":allowed}:{}),"Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function json(data,status,origin){return new Response(JSON.stringify(data),{status,headers:corsHeaders(origin)})}
function cleanMessages(messages){if(!Array.isArray(messages))return[];return messages.slice(-10).map(m=>({role:m?.role==='model'?'model':'user',parts:[{text:String(m?.text||'').slice(0,3000)}]})).filter(m=>m.parts[0].text.trim())}
function allowedRate(ip){const now=Date.now(),windowMs=60_000,max=15;const previous=rate.get(ip)||[];const active=previous.filter(t=>now-t<windowMs);if(active.length>=max){rate.set(ip,active);return false}active.push(now);rate.set(ip,active);if(rate.size>5000){for(const[k,v]of rate)if(!v.some(t=>now-t<windowMs))rate.delete(k)}return true}
export default async request=>{const origin=request.headers.get('origin')||'';if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(origin)});if(request.method!=='POST')return json({error:'Method not allowed'},405,origin);if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'Origin not allowed'},403,origin);const ip=request.headers.get('x-nf-client-connection-ip')||request.headers.get('x-forwarded-for')||'unknown';if(!allowedRate(ip))return json({error:'Too many AI requests. Please wait a minute.'},429,origin);const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return json({error:'AI service is not configured yet.'},503,origin);try{const body=await request.json();const message=String(body?.message||'').trim().slice(0,4000);const history=cleanMessages(body?.history);const currentPage=String(body?.currentPage||'').slice(0,120);if(!message)return json({error:'Please enter a message.'},400,origin);const contents=[...history,{role:'user',parts:[{text:`Current page: ${currentPage||'unknown'}\nUser request: ${message}`}]}];const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_INSTRUCTION}]},contents,generationConfig:{temperature:.25,maxOutputTokens:900}})});const data=await response.json();if(!response.ok){console.error('Gemini API error',response.status,data);return json({error:'AI service is temporarily unavailable.'},502,origin)}const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!text)return json({error:'AI returned an empty response.'},502,origin);return json({text},200,origin)}catch(error){console.error('AI agent error',error);return json({error:'Unable to process the request right now.'},500,origin)}};
export const config={path:'/api/ai-agent'};
