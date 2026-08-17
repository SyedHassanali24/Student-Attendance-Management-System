/* SSHACMS student login manager bootstrap. Passwords are never stored in plaintext. */
(() => {
  if (window.__sshacmsStudentLoginManagerBootstrap) return;
  window.__sshacmsStudentLoginManagerBootstrap = true;
  const load = () => {
    if (document.querySelector('script[data-sshacms-student-login-v6]')) return;
    const s = document.createElement('script');
    s.src = './javascript/student-login-manager-v6.js?v=6';
    s.dataset.sshacmsStudentLoginV6 = '1';
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
  else load();
})();
