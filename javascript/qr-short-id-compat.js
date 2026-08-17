/* =========================================================
   QR SHORT-ID COMPATIBILITY
========================================================= */
(function () {
    if (typeof Html5Qrcode === "undefined") return;
    if (Html5Qrcode.prototype.__sshacmsShortIdCompat) return;
    const originalStart = Html5Qrcode.prototype.start;
    Html5Qrcode.prototype.start = function (cameraConfig, config, successCallback, errorCallback) {
        const compatibleSuccess = decodedText => {
            const raw = String(decodedText ?? "").trim();
            if (!raw) return successCallback(decodedText);
            try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object" && parsed.studentId) return successCallback(raw); } catch (_) {}
            successCallback(JSON.stringify({ studentId: raw }));
        };
        return originalStart.call(this, cameraConfig, config, compatibleSuccess, errorCallback);
    };
    Html5Qrcode.prototype.__sshacmsShortIdCompat = true;
})();

/* Existing student photo fix + new SSHACMS global modules. */
import('./student-photo-fix.js?v=2').catch(err => console.error('Student photo fix:', err));
import('./ai-agent.js?v=1').catch(err => console.error('AI agent:', err));
import('./materials-ui.js?v=1').catch(err => console.error('Materials module:', err));
