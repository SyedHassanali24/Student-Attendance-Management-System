/* =========================================================
   SSHACMS FEE MANAGEMENT — LOCAL ADMIN LOADER

   Loads the local admin fee module so Fee Management does
   not depend on an external jsDelivr copy.
========================================================= */

/* Install the attendance MutationObserver guard BEFORE the
   attendance enhancement module is evaluated. */
import "./attendance-freeze-fix.js?v=2";
import "./admin-fees.js?v=2";

/* Admin attendance enhancement: camera switching, check-in/out,
   late rule, leave and coaching-off controls. */
import "./attendance-enhancer.js?v=2";
