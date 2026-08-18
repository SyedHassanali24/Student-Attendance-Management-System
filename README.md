# Sir Syed Hassan Ali Coaching Management System (SSHACMS)

A static HTML/CSS/JavaScript coaching management system backed by Firebase Authentication, Firestore and Storage.

## Run locally

Because the project uses ES modules, Firebase and browser APIs, run it through a local web server instead of opening HTML files with `file://`.

### Option 1 — VS Code Live Server
1. Open this repository in VS Code.
2. Install **Live Server**.
3. Right-click `index.html` → **Open with Live Server**.
4. Open the generated local URL.

### Option 2 — Python 3

```bash
python -m http.server 5500
```

Then open `http://localhost:5500/`.

### Option 3 — Node.js

```bash
npx serve .
```

Open the URL shown by the command.

## Main pages

- `index.html` — public home page
- `login.html` — student login
- `admin-login.html` — admin login
- `student-dashboard.html` — student portal
- `admin-dashboard.html` — admin dashboard

## Firebase requirement

The repository contains the Firebase web configuration in `firebase/firebase-config.js`. Firebase Authentication and Firestore must be available for login and dashboard data to work.

Student accounts are linked through the `students` Firestore collection and require `loginEnabled: true` plus the correct Firebase Auth UID.

Admin accounts authenticate through Firebase Authentication and are additionally checked against the `admins` Firestore collection by UID or email.

## Netlify

`netlify.toml` is included and publishes the repository root as a static site. No npm build step is required.
