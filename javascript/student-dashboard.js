/* =========================================================
   STUDENT DASHBOARD — RESPONSIVE LOADER + DASHBOARD LOADER
========================================================= */

/* Load the shared responsive layer after the portal CSS so its
   mobile/tablet rules can safely override desktop dimensions. */
const responsiveStylesheet = document.createElement("link");
responsiveStylesheet.rel = "stylesheet";
responsiveStylesheet.href = "./css/responsive.css?v=7";
document.head.appendChild(responsiveStylesheet);

/* Last clean dashboard implementation */
import "https://cdn.jsdelivr.net/gh/SyedHassanali24/Student-Attendance-Management-System@5d7e329ab10115eaf51fecde7b7a412baa836f20/javascript/student-dashboard.js";

/* Student fee receipt / print PDF / WhatsApp */
import "./student-fee-slip.js?v=1";
