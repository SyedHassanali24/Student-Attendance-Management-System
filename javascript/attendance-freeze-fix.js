/* SSHACMS emergency freeze fix
   The previous attendance enhancer observed #attendanceTableBody with a MutationObserver
   and its own render() changed that same tbody. That created a render -> mutation -> render
   loop which could freeze the entire page after the first live Firestore update.
   This guard prevents only that self-observation; all other MutationObserver usage remains normal.
*/
(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__sshacmsMutationGuardInstalled) return;
  window.__sshacmsMutationGuardInstalled = true;

  window.MutationObserver = class SSHACMSMutationObserverGuard {
    constructor(callback) {
      this._callback = callback;
      this._native = new NativeMutationObserver(callback);
    }
    observe(target, options) {
      if (target && target.id === 'attendanceTableBody') {
        this._skippedAttendanceTable = true;
        return;
      }
      return this._native.observe(target, options);
    }
    disconnect() {
      this._native.disconnect();
    }
    takeRecords() {
      return this._native.takeRecords();
    }
  };
})();
