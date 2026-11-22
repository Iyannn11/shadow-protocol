// Tiny WebAudio synth: no audio files, every sound is an oscillator blip.
// Created lazily on the first user gesture so browsers allow it.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    pickup() { tone(880, 0.12, 'sine', 0.16); tone(1318, 0.16, 'sine', 0.14, 0.08); },
    spotted() { tone(520, 0.18, 'square', 0.07, 0, 760); },
    alarm() {
      tone(660, 0.16, 'sawtooth', 0.09);
      tone(440, 0.16, 'sawtooth', 0.09, 0.16);
      tone(660, 0.16, 'sawtooth', 0.09, 0.32);
    },
    caught() { tone(220, 0.5, 'sawtooth', 0.12, 0, 110); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.15, i * 0.11));
    },
    click() { tone(700, 0.05, 'sine', 0.08); },
  };
}
