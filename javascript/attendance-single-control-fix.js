/* SSHACMS — REMOVE ENHANCED ATTENDANCE CONTROL CENTER
   Keep the original QR Attendance UI and functionality.
   The separate enhanced "ATTENDANCE CONTROL CENTER" is intentionally disabled.
*/
(() => {
  if (window.__sshacmsAttendanceControlRemovalV1) return;
  window.__sshacmsAttendanceControlRemovalV1 = true;

  // Prevent attendance-enhancer-safe.js from creating the enhanced control panel.
  window.__sshacmsFinalAttendanceLoaded = true;

  function cleanup() {
    const page = document.getElementById('attendance');
    if (!page) return;

    // Remove any enhanced control center that may already have been created.
    page.querySelectorAll('#safeAttendanceControls, .sa').forEach(el => el.remove());

    // Restore the original QR scanner UI that the old guard used to hide.
    page.querySelectorAll('.qr-scanner-card').forEach(card => {
      card.removeAttribute('data-safe-hidden');
      card.style.removeProperty('display');
    });
    page.querySelectorAll('#startScannerBtn, #stopScannerBtn').forEach(btn => {
      btn.style.removeProperty('display');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }

  // Protect the original attendance page if another script injects the panel later.
  const observer = new MutationObserver(cleanup);
  const startObserver = () => {
    const page = document.getElementById('attendance');
    if (page) observer.observe(page, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }
})();
