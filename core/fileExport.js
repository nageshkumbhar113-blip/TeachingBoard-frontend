/* ════════════════════════════════════════
   fileExport.js — Blob → device file, cross-platform
   Global: FILE_EXPORT

   Why this exists: inside the Capacitor Android WebView, an
   `<a download>` click on a blob: URL does nothing — there's no
   DownloadListener wired for blob: URLs, so the file silently never
   reaches Downloads (this is why every "Export" button looked broken /
   sometimes bounced out to the system browser via window.open()).
   On native, we write the blob to the app's cache dir via
   @capacitor/filesystem and hand it to @capacitor/share so the user
   picks where it goes (Downloads, Drive, WhatsApp, etc). On the web
   build (PWA / desktop testing) the classic <a download> still works
   fine, so we keep that path unchanged.
════════════════════════════════════════ */

const FILE_EXPORT = (() => {
  function _isNative() {
    return !!(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is "data:<mime>;base64,<data>" — Filesystem wants
        // just the base64 payload.
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function saveAndShare(blob, filename) {
    if (!_isNative()) {
      // Web/PWA: normal browser download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      return;
    }

    const Filesystem = window.Capacitor?.Plugins?.Filesystem;
    const Share = window.Capacitor?.Plugins?.Share;
    if (!Filesystem) {
      throw new Error('Filesystem plugin not available — rebuild the app after `npx cap sync`');
    }

    const base64 = await _blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: 'CACHE',
    });

    if (Share) {
      await Share.share({ title: filename, url: written.uri });
    } else {
      throw new Error('Share plugin not available — rebuild the app after `npx cap sync`');
    }
  }

  return { saveAndShare };
})();

window.FILE_EXPORT = FILE_EXPORT;
