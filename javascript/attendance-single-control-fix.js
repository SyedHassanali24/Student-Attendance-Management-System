/* SSHACMS — SINGLE ATTENDANCE CONTROL FIX
   Keep exactly ONE enhanced Attendance Control Center on the admin page.
   Also removes duplicate/orphaned copies created by older cached scripts.
*/
(() => {
  function dedupe() {
    const page = document.getElementById('attendance');
    if (!page) return;

    const controls = [...page.querySelectorAll('#safeAttendanceControls')];
    controls.slice(1).forEach(panel => panel.remove());

    /* Older versions can leave an enhanced .sa panel without the expected id. */
    const panels = [...page.querySelectorAll('.sa')].filter(panel => {
      const heading = panel.querySelector('h3');
      return heading && /Check-in, Check-out/i.test(heading.textContent || '');
    });

    const keep = page.querySelector('#safeAttendanceControls .sa') || panels[0];
    panels.forEach(panel => {
      if (panel !== keep) panel.closest('#safeAttendanceControls')?.remove() || panel.remove();
    });

    if (keep) {
      const parent = keep.closest('#safeAttendanceControls');
      if (parent) parent.style.display = '';
    }

    /* The original QR scanner card is no longer a second scanner UI. */
    page.querySelectorAll('.qr-scanner-card').forEach(card => {
      card.setAttribute('data-safe-hidden', '1');
      card.style.setProperty('display', 'none', 'important');
    });

    page.querySelectorAll('#startScannerBtn,#stopScannerBtn').forEach(btn => {
      btn.style.setProperty('display', 'none', 'important');
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
