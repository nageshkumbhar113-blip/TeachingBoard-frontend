/* ════════════════════════════════════════
   tts.js — Text-to-Speech Module
   Uses Web Speech API (no deps).
   Global: TTS
════════════════════════════════════════ */

const TTS = (() => {
  let enabled = false;
  const synth  = window.speechSynthesis;
  let voices   = [];

  function _loadVoices() {
    voices = synth ? synth.getVoices() : [];
  }

  if (synth) {
    synth.onvoiceschanged = _loadVoices;
    _loadVoices();
  }

  function _getBestVoice(lang) {
    const langMap = { mr: 'hi-IN', hi: 'hi-IN', en: 'en-IN' };
    const target  = langMap[lang] || 'en-IN';
    return voices.find(v => v.lang === target)
        || voices.find(v => v.lang.startsWith('hi'))
        || voices[0]
        || null;
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  function read(text) {
    if (!enabled || !synth) return;
    synth.cancel();
    const utt   = new SpeechSynthesisUtterance(text);
    const voice = _getBestVoice(I18N.getLang());
    if (voice) utt.voice = voice;
    utt.rate  = 0.9;
    utt.pitch = 1;
    synth.speak(utt);
  }

  function toggle() {
    enabled = !enabled;
    DB.setSetting('tts', enabled);
    const btn = document.getElementById('btn-tts');
    if (btn) {
      btn.title      = enabled ? 'TTS: ON' : 'TTS: OFF';
      btn.style.color = enabled ? 'var(--accent)' : '';
    }
    if (!enabled && synth) synth.cancel();
    APP.toast(enabled ? '🔊 Text-to-Speech ON' : '🔇 Text-to-Speech OFF', 'info');
    return enabled;
  }

  function isEnabled() { return enabled; }

  async function init() {
    enabled = await DB.getSetting('tts', false);
    const btn = document.getElementById('btn-tts');
    if (btn) {
      btn.style.color = enabled ? 'var(--accent)' : '';
      btn.addEventListener('click', toggle);
    }
  }

  return { read, toggle, isEnabled, init };
})();

window.TTS = TTS;
