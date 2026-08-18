/* SSHACMS Student Account Manager bootstrap */
(() => {
  if (window.__sshacmsStudentAccountManagerLoaded) return;
  window.__sshacmsStudentAccountManagerLoaded = true;
  const load = () => {
    if (document.querySelector('script[data-sshacms-student-account-manager]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = './javascript/student-account-manager-module.js?v=1';
    script.dataset.sshacmsStudentAccountManager = '1';
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
