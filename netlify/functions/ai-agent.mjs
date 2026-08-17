const ALLOWED_ORIGINS = new Set([
  process.env.URL,
  "https://sirsha.netlify.app",
  "http://localhost:8888",
  "http://localhost:3000"
].filter(Boolean));

const PAGE_MAP = {
  home: "/",
  studentLogin: "/login.html",
  adminLogin: "/admin-login.html",
  adminDashboard: "/admin-dashboard.html",
  studentDashboard: "/student-dashboard.html"
};

const SYSTEM_INSTRUCTION = `You are SSHACMS Assistant, the official AI help agent for Sir Syed Hassan Ali Coaching Management System.

You are an in-project assistant. Your job is to explain how this coaching portal works, guide students and administrators, and give direct links to pages when useful.

Language rules:
- Reply in the same language the user uses.
- English is fully supported.
- Urdu script is fully supported.
- Roman Urdu is fully supported.
- If the user mixes languages, answer naturally in the same mix.
- Keep instructions simple and practical.

Project knowledge:
- Main website: /
- Student Login: /login.html
- Student Portal: /student-dashboard.html
- Admin Login: /admin-login.html
- Admin Dashboard: /admin-dashboard.html
- Student portal modules: Dashboard, Attendance, Fees, Results, Announcements, Materials/Notes, My Profile.
- Admin modules include Student Management, QR Attendance, Fee Management, Monthly Tests, Results, Announcements and Materials/Notes.
- Materials/Notes are uploaded by an administrator and targeted to a student's class/batch. Students should only see materials assigned to them.
- Results can be published by admin and then appear in the student's portal.
- Announcements can be published by admin and appear in student portals.
- Attendance supports Present, Late, Leave and Absent records.
- The system uses Firebase Authentication, Firestore and Cloud Storage for protected application data.
- The AI API key must never be exposed to the browser.

Contact:
- WhatsApp/Phone: +92 313 2956206
- Email: eastwala12@gmail.com
- Address: House #L-19, Sector L-1 Memarabad, Surjani Town, Karachi, Near Baba Decoration

When the user asks for a page, provide a clickable direct path in markdown, for example: [Student Portal](/student-dashboard.html).
Never invent a page that is not in PAGE_MAP. If a requested feature is not currently confirmed by the project context, say that it is not confirmed rather than pretending it exists.
Do not reveal secrets, API keys, Firebase credentials, passwords, private student records, admin credentials, or internal security rules.
Do not claim that you can change data yourself. Explain the correct page/action the user should use.
`;

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-12).map((m) => ({
    role: m?.role === "model" ? "model" : "user",
    parts: [{ text: String(m?.text || "").slice(0, 4000) }]
  })).filter((m) => m.parts[0].text.trim());
}

export default async (request) => {
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "AI service is not configured yet." }, 503, origin);
  }

  try {
    const body = await request.json();
    const message = String(body?.message || "").trim().slice(0, 4000);
    const history = cleanMessages(body?.history);
    const currentPage = String(body?.currentPage || "").slice(0, 120);

    if (!message) return json({ error: "Please enter a message." }, 400, origin);

    const contextualUserMessage = `Current page: ${currentPage || "unknown"}\nUser request: ${message}`;
    const contents = [...history, { role: "user", parts: [{ text: contextualUserMessage }] }];

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 900
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error", response.status, data);
      return json({ error: "AI service is temporarily unavailable." }, 502, origin);
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
    if (!text) return json({ error: "AI returned an empty response." }, 502, origin);

    return json({ text }, 200, origin);
  } catch (error) {
    console.error("AI agent error", error);
    return json({ error: "Unable to process the request right now." }, 500, origin);
  }
};

export const config = { path: "/api/ai-agent" };
