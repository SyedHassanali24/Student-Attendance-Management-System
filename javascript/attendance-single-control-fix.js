/* SSHACMS — SINGLE ATTENDANCE CONTROL FIX
   Keep exactly one enhanced Attendance Control Center on the admin page.
*/
(() => {
  function dedupe() {
    const panels = [...document.querySelectorAll('#safeAttendanceControls')];
    panels.slice(1).forEach(panel => panel.remove());
    panels.forEach((panel, index) => {
      panel.style.display = index === 0 ? '' : 'none';
    });
  }

  const boot = () => {
    dedupe();
    const target = document.getElementById('attendance');
    if (!target || window.__sshacmsSingleAttendanceObserver) return;
    window.__sshacmsSingleAttendanceObserver = true;
    const observer = new MutationObserver(() => dedupe());
    observer.observe(target, { childList: true, subtree: true });
    window.__sshacmsSingleAttendanceObserverInstance = observer;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
