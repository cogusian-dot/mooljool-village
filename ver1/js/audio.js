// 물줄때 마을 · 효과음 & 배경음 (Web Audio 합성)
// 원본 단일 파일 index.html 725–879행에서 옮김
// 물줄때 마을 — 효과음 & 배경음 (WebAudio 합성, 외부 파일 없음)
const SFX = (() => {
  let ctx = null, master = null, sfxBus = null, bgmBus = null;
  let muted = false, bgmOn = true, bgmTimer = null, bgmStep = 0, nextNoteTime = 0, bgmPaused = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    // 살짝 부드럽게
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.0; bgmBus.connect(comp);
    startBgm();
  }

  function tone(freq, dur, o = {}) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib; lg.gain.value = freq * 0.04; l.connect(lg); lg.connect(osc.frequency);
      l.start(t0); l.stop(t0 + dur + 0.05);
    }
    const vol = o.vol ?? 0.2, a = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(dur, o = {}) {
    if (!ctx || muted) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain(); const vol = o.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }

  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz
  const PENTA = [72, 74, 76, 79, 81, 84];

  const lib = {
    click() { tone(520, 0.09, { slide: 980, vol: 0.18, type: 'sine' }); },
    hover() { tone(900, 0.05, { vol: 0.05, type: 'sine' }); },
    blip(pitch = 1) {
      const n = PENTA[(Math.random() * PENTA.length) | 0];
      tone(N(n) * 0.5 * pitch, 0.055, { type: 'triangle', vol: 0.07, slide: N(n) * 0.55 * pitch });
    },
    step() { noise(0.06, { freq: 380, filter: 'lowpass', vol: 0.05 }); },
    pickup() { [0, 1, 2].forEach(i => tone(N(84 + [0, 4, 7][i]), 0.14, { type: 'triangle', vol: 0.13, delay: i * 0.06 })); },
    bag() {
      tone(300, 0.25, { slide: 700, vol: 0.18, type: 'sine' });
      [0, 1, 2, 3].forEach(i => tone(N(79 + [0, 4, 7, 12][i]), 0.25, { type: 'triangle', vol: 0.12, delay: 0.15 + i * 0.08 }));
    },
    shake() {
      noise(0.55, { freq: 2600, q: 0.8, vol: 0.16, sweep: 1400 });
      tone(180, 0.45, { type: 'sine', vol: 0.12, vib: 14 });
    },
    boing() { tone(700, 0.22, { slide: 180, vol: 0.16, type: 'sine' }); },
    plop() { tone(380, 0.12, { slide: 140, vol: 0.18, type: 'sine' }); },
    splash() {
      noise(0.4, { freq: 1800, sweep: 500, q: 0.7, vol: 0.2 });
      for (let i = 0; i < 4; i++) tone(350 + Math.random() * 300, 0.09, { slide: 900 + Math.random() * 500, vol: 0.09, delay: 0.08 + i * 0.07 });
    },
    tok() { tone(1300, 0.05, { type: 'triangle', vol: 0.16, slide: 900 }); noise(0.04, { freq: 3000, vol: 0.08 }); },
    crack() {
      noise(0.18, { freq: 900, q: 0.6, vol: 0.2, sweep: 300 });
      lib.sparkle(0.12);
    },
    sparkle(d = 0) { [96, 100, 103, 108].forEach((n, i) => tone(N(n), 0.35, { vol: 0.06, delay: d + i * 0.05 })); },
    absorb() {
      tone(950, 0.7, { slide: 260, vol: 0.16, type: 'sine' });
      for (let i = 0; i < 5; i++) tone(500 + i * 120, 0.06, { slide: 1200, vol: 0.06, delay: 0.2 + i * 0.09 });
    },
    grow() {
      tone(260, 0.8, { slide: 1040, vol: 0.12, type: 'triangle' });
      [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.6, { type: 'sine', vol: 0.09, delay: 0.45 + i * 0.07 }));
    },
    success() {
      const mel = [72, 76, 79, 84, 79, 84, 88];
      mel.forEach((n, i) => tone(N(n), 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.12 }));
      [60, 64, 67, 72].forEach(n => tone(N(n), 1.4, { type: 'sine', vol: 0.06, delay: 0.84 }));
    },
    happy() { tone(1100, 0.08, { slide: 1600, vol: 0.12 }); tone(1300, 0.1, { slide: 1900, vol: 0.12, delay: 0.1 }); },
    deny() { tone(320, 0.09, { type: 'square', vol: 0.05 }); tone(240, 0.12, { type: 'square', vol: 0.05, delay: 0.1 }); },
    whoosh() { noise(0.35, { freq: 400, sweep: 3000, q: 1.2, vol: 0.12 }); },
    open() { tone(400, 0.12, { slide: 800, vol: 0.1 }); tone(800, 0.1, { slide: 1200, vol: 0.08, delay: 0.06 }); },
    drop() { tone(1500, 0.18, { slide: 500, vol: 0.12 }); tone(2000, 0.12, { slide: 900, vol: 0.06, delay: 0.05 }); },
    rise() { tone(500, 0.5, { slide: 1300, vol: 0.12 }); },
  };

  // ── 배경음: 오르골 느낌 루프 (C–Am–F–G) ──
  const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const MELODY = [76, 79, 81, 79, 76, 74, 72, 74, 72, 76, 74, 72, 69, 72, 74, 76,
                  77, 76, 74, 72, 74, 76, 79, 76, 74, 72, 71, 72, 74, 71, 67, 0];
  const SPB = 60 / 92; // seconds per beat
  function scheduleBgm() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.3) {
      const step = bgmStep % 32; // 8분음표 기준 32스텝 = 4마디
      const bar = Math.floor(step / 8);
      const t = nextNoteTime - ctx.currentTime;
      if (!muted && bgmOn && !bgmPaused) {
        const ch = CHORDS[bar];
        const arp = ch[[0, 1, 2, 1][step % 4]] + 12;
        tone(N(arp), 0.5, { type: 'sine', vol: 0.05, delay: Math.max(0, t), bus: bgmBus, attack: 0.01 });
        if (step % 8 === 0) tone(N(ch[0] - 12), 1.6, { type: 'triangle', vol: 0.06, delay: Math.max(0, t), bus: bgmBus, attack: 0.03 });
        const m = MELODY[step];
        if (m && step % 2 === 0) tone(N(m), 0.6, { type: 'triangle', vol: 0.045, delay: Math.max(0, t), bus: bgmBus, attack: 0.01 });
      }
      nextNoteTime += SPB / 2;
      bgmStep++;
    }
  }
  function startBgm() {
    nextNoteTime = ctx.currentTime + 0.2;
    bgmTimer = setInterval(scheduleBgm, 80);
    bgmBus.gain.setTargetAtTime(bgmOn ? 0.9 : 0, ctx.currentTime, 0.5);
  }

  return {
    init,
    play(name, ...a) { try { lib[name] && lib[name](...a); } catch (e) { } },
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); },
    get muted() { return muted; },
    setBgm(on) { bgmOn = on; if (bgmBus) bgmBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.3); },
    get bgm() { return bgmOn; },
    pauseBgm(p) { bgmPaused = p; if (bgmBus && ctx) bgmBus.gain.setTargetAtTime(p || !bgmOn ? 0 : 0.9, ctx.currentTime, 0.2); },
  };
})();

