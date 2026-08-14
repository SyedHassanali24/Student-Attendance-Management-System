/* =========================================================
   STUDENT DASHBOARD — RESPONSIVE LOADER + DASHBOARD LOADER
========================================================= */

const responsiveStylesheet = document.createElement("link");
responsiveStylesheet.rel = "stylesheet";
responsiveStylesheet.href = "./css/responsive.css?v=8";
document.head.appendChild(responsiveStylesheet);

/* Last clean dashboard implementation */
import "https://cdn.jsdelivr.net/gh/SyedHassanali24/Student-Attendance-Management-System@5d7e329ab10115eaf51fecde7b7a412baa836f20/javascript/student-dashboard.js";

/* Existing student fee receipt */
import "./student-fee-slip.js?v=2";

/* Direct one-click PDF download enhancement */
import "./fee-download.js?v=1";
