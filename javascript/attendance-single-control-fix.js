/* SSHACMS — REMOVE ENHANCED ATTENDANCE CONTROL CENTER
   Keep the original QR Attendance UI and functionality.
   The separate enhanced "ATTENDANCE CONTROL CENTER" is intentionally disabled.
*/
(() => {
  if (window.__sshacmsAttendanceControlRemovalV1) return;
  window.__sshacmsAttendanceControlRemovalV1 = true;
  window.__sshacmsFinalAttendanceLoaded = true;
  function cleanup() {
    const page = document.getElementById('attendance');
    if (!page) return;
    page.querySelectorAll('#safeAttendanceControls, .sa').forEach(el => el.remove());
    page.querySelectorAll('.qr-scanner-card').forEach(card => { card.removeAttribute('data-safe-hidden'); card.style.removeProperty('display'); });
    page.querySelectorAll('#startScannerBtn, #stopScannerBtn').forEach(btn => btn.style.removeProperty('display'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanup, { once: true }); else cleanup();
  const observer = new MutationObserver(cleanup);
  const startObserver = () => { const page = document.getElementById('attendance'); if (page) observer.observe(page, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true }); else startObserver();
})();

/* Results Management — loaded after the admin page exists. */
import './results-admin.js?v=1';
