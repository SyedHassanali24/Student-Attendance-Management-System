/* SSHACMS — REMOVE ENHANCED ATTENDANCE CONTROL CENTER */
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

  /* Results Management module */
  const loadResultsAdmin = () => {
    if (document.querySelector('script[data-results-admin]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = './javascript/results-admin.js?v=1';
    script.dataset.resultsAdmin = '1';
    document.body.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadResultsAdmin, { once: true }); else loadResultsAdmin();
})();
