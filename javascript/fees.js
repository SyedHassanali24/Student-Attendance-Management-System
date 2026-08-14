/* =========================================================
   SSHACMS FEE MANAGEMENT — LOCAL ADMIN LOADER

   Loads the local admin fee module so Fee Management does
   not depend on an external jsDelivr copy.
========================================================= */

/* Install the FINAL attendance freeze guard before the
   attendance enhancement module is evaluated. */
import "./attendance-freeze-fix.js?v=3";
import "./admin-fees.js?v=3";

/* Admin attendance enhancement: camera switching, check-in/out,
   late rule, leave and coaching-off controls. */
import "./attendance-enhancer.js?v=3";
