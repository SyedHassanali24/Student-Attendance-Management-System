/* SSHACMS — STUDENT CREATION GUARD
   A student may only be created after a real user action on Save Student.
   This blocks accidental/programmatic form submissions and rapid duplicate submits.
*/
(() => {
  if (window.__sshacmsStudentCreateGuard) return;
  window.__sshacmsStudentCreateGuard = true;

  let userActionUntil = 0;
  let consumed = false;
  let lastSubmit = 0;

  const form = document.getElementById('studentForm');
  const save = document.getElementById('saveStudentBtn');
  const modal = document.getElementById('studentModal');

  if (!form || !save) return;

  const arm = () => {
    userActionUntil = Date.now() + 1800;
    consumed = false;
  };

  save.addEventListener('pointerdown', arm, { capture: true });
  save.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') arm();
  }, { capture: true });

  form.addEventListener('submit', e => {
    const now = Date.now();

    /* Never accept a submit that did not follow a real Save action. */
    if (now > userActionUntil || consumed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    /* Prevent double-submit from touch/click/keyboard races. */
    if (now - lastSubmit < 1200) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    lastSubmit = now;
    consumed = true;
  }, { capture: true });

  /* Opening the Add Student modal gives a clean submit state. */
  modal?.addEventListener('click', e => {
    if (e.target === modal) {
      userActionUntil = 0;
      consumed = false;
    }
  }, { capture: true });
})();
