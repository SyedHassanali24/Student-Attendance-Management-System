# SSHACMS Production Security Setup

## 1. Firebase admin role
The production Firestore/Storage rules use an `admins/{uid}` document. This prevents a normal authenticated student from becoming an administrator.

After logging into Firebase Authentication with the real administrator account, copy that account's UID and create:

`admins/<ADMIN_FIREBASE_UID>`

Fields:

```json
{ "role": "admin", "active": true }
```

Do this manually in Firebase Console or through a trusted server/Admin SDK. Do not let the browser create admin role documents.

## 2. Deploy rules
Deploy `firestore.rules` to Cloud Firestore and `storage.rules` to Cloud Storage. Test them before production deployment.

The intended policy is:
- public users: no private Firestore/Storage access
- admin: manage students, attendance, fees, results, announcements and materials
- student: only their own student-linked attendance/fee/result records
- student: only published materials whose `studentUids` contains their Firebase UID
- published announcements: readable by authenticated students
- all other collections/paths: denied

## 3. Gemini API key
Create a Gemini API key and store it only as a Netlify environment variable:

`GEMINI_API_KEY`

Never put the Gemini key in HTML, browser JavaScript, Firebase config, GitHub, or localStorage.

The browser calls `/api/ai-agent`; the Netlify Function calls Gemini server-side.

## 4. Netlify
The repository now contains `netlify.toml` and the function at `netlify/functions/ai-agent.mjs`.

After setting `GEMINI_API_KEY`, trigger a new Netlify deploy.

## 5. Firebase App Check
Enable Firebase App Check for the web application in Firebase Console and register the production Netlify domain. Start in monitoring mode, verify legitimate traffic, then enforce it for Firestore and Storage.

## 6. Important existing-data migration
The new rules expect students to have a Firebase Auth `uid` field and materials to contain `studentUids`.

Attendance/fees/results can still be matched to the student's authenticated Student ID because student login emails use:

`<STUDENT_ID>@students.sshacms.local`

Do not loosen the rules to `allow read, write: if request.auth != null` in production.
