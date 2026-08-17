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

  const loadModule = (src, attr) => {
    if (document.querySelector(`script[${attr}]`)) return;
    const script = document.createElement('script');
    script.type = 'module'; script.src = src; script.setAttribute(attr, '1'); document.body.appendChild(script);
  };
  const loadModules = () => {
    loadModule('./javascript/results-admin.js?v=2', 'data-results-admin');
    loadModule('./javascript/admin-announcements.js?v=1', 'data-announcements-admin');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadModules, { once: true }); else loadModules();
})();
