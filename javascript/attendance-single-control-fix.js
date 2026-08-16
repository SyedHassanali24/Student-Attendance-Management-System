/* SSHACMS — FINAL SINGLE ATTENDANCE CONTROL GUARD
   Keep exactly ONE Attendance Control Center.
   The first enhanced control panel is the only one allowed to remain.
   If an older/cached enhancer recreates another panel, remove it immediately.
   No student data, styling, scanner logic, or other dashboard section is changed.
*/
(() => {
  if (window.__sshacmsFinalSingleControlGuardV3) return;
  window.__sshacmsFinalSingleControlGuardV3 = true;

  function cleanup() {
    const page = document.getElementById('attendance');
    if (!page) return;

    const wrappers = [...page.querySelectorAll('#safeAttendanceControls')];
    if (wrappers.length > 1) wrappers.slice(1).forEach(wrapper => wrapper.remove());

    const panels = [...page.querySelectorAll('.sa')].filter(panel => {
      const heading = panel.querySelector('h3');
      return heading && /Check-in, Check-out/i.test(heading.textContent || '');
    });

    if (panels.length > 1) {
      const keep = panels[0];
      panels.slice(1).forEach(panel => {
        const wrapper = panel.closest('#safeAttendanceControls');
        if (wrapper && wrapper !== keep.closest('#safeAttendanceControls')) wrapper.remove();
        else panel.remove();
      });
    }

    const allWrappers = [...page.querySelectorAll('#safeAttendanceControls')];
    allWrappers.slice(1).forEach(wrapper => wrapper.remove());

    page.querySelectorAll('.qr-scanner-card').forEach(card => {
      card.setAttribute('data-safe-hidden', '1');
      card.style.setProperty('display', 'none', 'important');
    });
    page.querySelectorAll('#startScannerBtn,#stopScannerBtn').forEach(btn => {
      btn.style.setProperty('display', 'none', 'important');
    });
  }

  function boot() {
    cleanup();
    const page = document.getElementById('attendance');
    if (!page) return;

    if (!window.__sshacmsAttendanceSingleControlObserverV3) {
      window.__sshacmsAttendanceSingleControlObserverV3 = new MutationObserver(() => cleanup());
      window.__sshacmsAttendanceSingleControlObserverV3.observe(page, {
        childList: true,
        subtree: true
      });
    }

    let elapsed = 0;
    const fastTimer = setInterval(() => {
      cleanup();
      elapsed += 100;
      if (elapsed >= 10000) clearInterval(fastTimer);
    }, 100);

    [12000, 15000, 20000, 30000].forEach(ms => setTimeout(cleanup, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
