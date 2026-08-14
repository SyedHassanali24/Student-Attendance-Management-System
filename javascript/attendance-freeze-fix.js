/* SSHACMS — FINAL ADMIN FREEZE GUARD
   The admin dashboard has two live table enhancers. A MutationObserver on
   the attendance table is unnecessary because admin.js already owns that
   table. The student photo enhancer is allowed to observe, but its callback
   is coalesced so DOM writes cannot create a hot mutation loop.
*/
(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__sshacmsMutationGuardInstalled) return;
  window.__sshacmsMutationGuardInstalled = true;

  window.MutationObserver = class SSHACMSMutationObserverGuard {
    constructor(callback) {
      this._callback = typeof callback === 'function' ? callback : () => {};
      this._target = null;
      this._scheduled = false;
      this._running = false;
      this._native = new NativeMutationObserver((records, observer) => {
        if (this._running || !records?.length) return;

        // Never let the old attendance enhancer observe/render its own table.
        if (this._target?.id === 'attendanceTableBody') return;

        if (this._scheduled) return;
        this._scheduled = true;

        const run = () => {
          this._scheduled = false;
          if (this._running) return;
          this._running = true;
          try {
            this._callback(records, observer);
          } catch (error) {
            console.error('SSHACMS observer callback error:', error);
          } finally {
            this._running = false;
          }
        };

        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(run);
        } else {
          setTimeout(run, 0);
        }
      });
    }

    observe(target, options) {
      this._target = target || null;

      // Attendance is rendered by admin.js + the attendance enhancer itself.
      // Observing it here only creates duplicate work and can freeze Chrome.
      if (target && target.id === 'attendanceTableBody') return;

      return this._native.observe(target, options);
    }

    disconnect() {
      this._scheduled = false;
      this._native.disconnect();
    }

    takeRecords() {
      return this._native.takeRecords();
    }
  };
})();
