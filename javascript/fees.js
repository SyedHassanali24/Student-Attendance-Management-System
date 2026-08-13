/* =========================================================
   SSHACMS FEE MANAGEMENT — LOCAL ADMIN LOADER

   Loads the local admin fee module so Fee Management does
   not depend on an external jsDelivr copy.
========================================================= */

import "./admin-fees.js?v=1";

/* Admin attendance enhancement: camera switching, check-in/out,
   late rule, leave and coaching-off controls. */
import "./attendance-enhancer.js?v=1";
