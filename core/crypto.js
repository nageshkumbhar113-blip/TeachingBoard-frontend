/* ════════════════════════════════════════
   core/crypto.js — Local-cache encryption (Web Crypto, AES-256-GCM)
   Global: CRYPTO

   Why: content cached locally for offline use (Notes, Exercise questions,
   Word Test content, Dictionary, etc.) is admin-authored, paid teaching
   material. Storing it as plain JSON in IndexedDB means anyone with basic
   devtools access (or a rooted phone) can browse the database and copy it
   out verbatim. This module encrypts every cached record at rest; content
   only exists in plaintext in memory, for the moment it's actually
   rendered on screen.

   Threat model: this defends against casual copying (opening devtools/IDB
   browser and reading records, or pulling the app's local files off a
   rooted device) — the practical concern for this app. It is NOT a defense
   against a determined attacker who reverse-engineers the JS bundle itself
   to recover the embedded key; that's a fundamentally different (much
   higher) bar that no client-side-only design can fully meet, since the
   app must be able to decrypt without any user-entered secret.

   Usage:
     const packed = await CRYPTO.encrypt(plainObject);   // -> {iv, data} (both base64 strings)
     const plainObject = await CRYPTO.decrypt(packed);   // -> original object, or null if corrupt
════════════════════════════════════════ */

const CRYPTO = (() => {
  // Embedded app-level passphrase — proportionate to the threat model above
  // (see file header). Combined with a per-install random salt (persisted
  // once in IndexedDB settings) so the derived key differs per device even
  // though the passphrase itself is fixed in the JS source.
  const APP_PASSPHRASE = 'NksEduOrbit::LocalCacheKey::v1';

  let _keyPromise = null;

  function _b64FromBytes(bytes) {
    let bin = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }

  function _bytesFromB64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function _getSalt() {
    // Lazily create and persist a per-install salt via DB's settings store.
    // Falls back to a session-only random salt if DB isn't available yet
    // (encryption still works, just not stable across a full DB.setSetting
    // failure — acceptable since this only affects cache readability, never
    // correctness of the live app).
    if (typeof DB === 'undefined' || !DB.getSetting) {
      if (!_getSalt._fallback) _getSalt._fallback = _b64FromBytes(self.crypto.getRandomValues(new Uint8Array(16)));
      return _getSalt._fallback;
    }
    let salt = await DB.getSetting('local_cache_salt', '').catch(() => '');
    if (!salt) {
      salt = _b64FromBytes(self.crypto.getRandomValues(new Uint8Array(16)));
      await DB.setSetting('local_cache_salt', salt).catch(() => {});
    }
    return salt;
  }

  async function _getKey() {
    if (_keyPromise) return _keyPromise;
    _keyPromise = (async () => {
      const salt = await _getSalt();
      const enc = new TextEncoder();
      const baseKey = await self.crypto.subtle.importKey(
        'raw', enc.encode(APP_PASSPHRASE), 'PBKDF2', false, ['deriveKey']
      );
      return self.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    })();
    return _keyPromise;
  }

  // Encrypts any JSON-serializable value. Returns {iv, data} (base64
  // strings) — the shape already anticipated by core/db.js's dead
  // notes_cache store (data/iv fields), now actually implemented.
  async function encrypt(plainValue) {
    const key = await _getKey();
    const iv = self.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const plaintext = enc.encode(JSON.stringify(plainValue));
    const cipherBuf = await self.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return { iv: _b64FromBytes(iv), data: _b64FromBytes(cipherBuf) };
  }

  // Decrypts a {iv, data} record back to the original value. Returns null
  // (never throws) on corruption/tamper/key-mismatch — callers should treat
  // null exactly like "cache miss" and fall through to a network fetch.
  async function decrypt(packed) {
    if (!packed || !packed.iv || !packed.data) return null;
    try {
      const key = await _getKey();
      const iv = _bytesFromB64(packed.iv);
      const cipherBytes = _bytesFromB64(packed.data);
      const plainBuf = await self.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(plainBuf));
    } catch (err) {
      console.warn('CRYPTO.decrypt failed (treating as cache miss):', err.message);
      return null;
    }
  }

  return { encrypt, decrypt };
})();

window.CRYPTO = CRYPTO;
