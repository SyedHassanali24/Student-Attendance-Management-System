/* SSHACMS — compatibility entry point
   The original attendance enhancer contained a MutationObserver that watched
   the same table it re-rendered. That caused a render → mutation → render
   loop and Chrome eventually reported "Page Unresponsive".

   Keep this filename for old cached imports, but route them to the new
   freeze-safe implementation. The safe implementation never observes or
   rewrites #attendanceTableBody.
*/
import "./attendance-enhancer-safe.js?v=1";
