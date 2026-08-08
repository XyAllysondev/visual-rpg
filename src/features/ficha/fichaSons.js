
/* ── Aura sound (Web Audio API) ── */
function startAuraSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain — fade in over 1.5 s
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 1.5);
    master.connect(ctx.destination);

    // Simple reverb via feedback delay
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.35;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.45;
    delay.connect(fbGain);
    fbGain.connect(delay);
    delay.connect(master);

    // LFO — slow shimmer at 0.7 Hz
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfo.start();

    // Chord: A3 · C#4 · E4 · A4 · E5 (golden major chord)
    const freqs = [220, 277.18, 329.63, 440, 659.25];
    const detunes = [0, 1.5, -1.2, 0.8, -0.6];
    const oscs = freqs.map((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq + detunes[i];
      g.gain.value = 0.22 / freqs.length;
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(delay);
      g.connect(master);
      osc.start();
      return osc;
    });

    return { ctx, oscs, lfo, master };
  } catch { return null; }
}

function stopAuraSound(sound) {
  if (!sound) return;
  const { ctx, oscs, lfo, master } = sound;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch { /* já parado */ } }); try { lfo.stop(); } catch { /* já parado */ } ctx.close(); }, 900);
}

/* ── Dice rolling sound (Web Audio API) ── */
function playDiceRollSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Simulate multiple dice hits: 6 impacts, decreasing in volume and spacing
    const hitTimes   = [0, 0.07, 0.16, 0.27, 0.37, 0.46];
    const hitVolumes = [0.55, 0.48, 0.38, 0.28, 0.18, 0.10];

    hitTimes.forEach((t, i) => {
      const bufLen = Math.floor(ctx.sampleRate * 0.055);
      const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) {
        // White noise with fast exponential decay
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufLen * 0.18));
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      // Bandpass filter — gives each hit a slightly different "body"
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900 + Math.random() * 900;
      bp.Q.value = 1.8;

      // High-shelf adds the hard "click" of dice on table
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 4000;
      shelf.gain.value = 6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(hitVolumes[i], ctx.currentTime + t);

      src.connect(bp);
      bp.connect(shelf);
      shelf.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime + t);
    });

    setTimeout(() => ctx.close(), 1200);
  } catch (e) { console.warn("[áudio] efeito sonoro falhou:", e); }
}

export { startAuraSound, stopAuraSound, playDiceRollSound };
