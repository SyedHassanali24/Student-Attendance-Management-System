/* =========================================================
   QR SHORT-ID COMPATIBILITY
   The new ID card QR contains only the student's short ID.
   The existing admin scanner expects JSON, so this small adapter
   converts a raw scanned Student ID into the format the scanner
   already understands. Existing JSON QR codes continue to work.
========================================================= */

(function () {
    if (typeof Html5Qrcode === "undefined") return;
    if (Html5Qrcode.prototype.__sshacmsShortIdCompat) return;

    const originalStart = Html5Qrcode.prototype.start;

    Html5Qrcode.prototype.start = function (cameraConfig, config, successCallback, errorCallback) {
        const compatibleSuccess = decodedText => {
            const raw = String(decodedText ?? "").trim();

            if (!raw) {
                successCallback(decodedText);
                return;
            }

            try {
                const parsed = JSON.parse(raw);

                if (parsed && typeof parsed === "object" && parsed.studentId) {
                    successCallback(raw);
                    return;
                }
            } catch (_) {
                // Raw short Student ID: convert it for the existing scanner logic.
            }

            successCallback(JSON.stringify({ studentId: raw }));
        };

        return originalStart.call(
            this,
            cameraConfig,
            config,
            compatibleSuccess,
            errorCallback
        );
    };

    Html5Qrcode.prototype.__sshacmsShortIdCompat = true;
})();
