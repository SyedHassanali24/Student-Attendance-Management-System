/* =========================================================
   SSHACMS FEE MANAGEMENT — LOCAL ADMIN LOADER
   Stable local modules only.
========================================================= */

/* Freeze guard prevents accidental MutationObserver render loops. */
import "./attendance-freeze-fix.js?v=4";

/* Admin fee management + direct one-click PDF receipt. */
import "./admin-fees.js?v=4";

/* Freeze-safe attendance enhancement.
   This module deliberately does NOT observe or rewrite the attendance table;
   admin.js remains the single owner of that table. */
import "./attendance-enhancer-safe.js?v=1";
