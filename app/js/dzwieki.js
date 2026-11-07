// Dźwięki interfejsu syntezowane w Web Audio (bez plików, więc bez licencji)
// i zapętlone tło lasu z naszych filmów na czas układania.

const AMBIENCE_LEVEL = 0.8;

export class Sounds {
  constructor(ambienceUrl) {
    this.ctx = null;
    this.muted = false;
    this.ambience = null;
    this.wantAmbience = false;
    this.ambienceData = fetch(ambienceUrl)
      .then((response) => response.arrayBuffer())
      .catch(() => null);
    // Schowana karta albo zablokowany telefon: las cichnie i wraca razem z aplikacją.
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  // Przeglądarki pozwalają włączyć dźwięk dopiero w geście użytkownika, np. w kliknięciu.
  unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.noise = whiteNoise(this.ctx);
      this.buffer = this.ambienceData.then((data) => data && this.ctx.decodeAudioData(data)).catch(() => null);
    }
    this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  async startAmbience(fade = 2) {
    this.wantAmbience = true;
    if (!this.ctx || this.ambience) return;
    const buffer = await this.buffer;
    if (!buffer || !this.wantAmbience || this.ambience) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(AMBIENCE_LEVEL, now + fade);
    source.connect(gain).connect(this.master);
    source.start();
    this.ambience = { source, gain };
  }

  stopAmbience(fade = 1.5) {
    this.wantAmbience = false;
    if (!this.ambience) return;
    const { source, gain } = this.ambience;
    this.ambience = null;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    source.stop(now + fade + 0.1);
  }

  // Przyciski i przełączniki: krótkie, miękkie kliknięcie.
  tap() {
    if (!this.ctx) return;
    this.burst({ freq: 2600, q: 1.8, level: 0.05, decay: 0.022 });
    this.tone({ freq: 520, to: 380, level: 0.04, attack: 0.002, decay: 0.05 });
  }

  // Podniesienie elementu: ciche, suche tyknięcie.
  pick() {
    if (!this.ctx) return;
    this.burst({ freq: 3600, q: 1.4, level: 0.08, decay: 0.03 });
  }

  // Element wskakuje na miejsce: tekturowe „klik” z krótkim, niskim stuknięciem.
  snap() {
    if (!this.ctx) return;
    this.burst({ freq: 2300, q: 0.9, level: 0.5, attack: 0.001, decay: 0.045 });
    this.burst({ at: 0.012, freq: 1200, q: 1.2, level: 0.18, attack: 0.001, decay: 0.05 });
    this.tone({ freq: 210, to: 80, level: 0.45, attack: 0.003, decay: 0.11 });
  }

  // Obrazek się rozsypuje: narastający szelest i ciche stuknięcie przy każdym elemencie.
  shatter(count, stagger) {
    if (!this.ctx) return;
    const { filter, t } = this.burst({ type: "lowpass", freq: 500, q: 0.7, level: 0.07, attack: 0.25, decay: 0.7 });
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
    filter.frequency.exponentialRampToValueAtTime(700, t + 0.95);
    for (let i = 0; i < count; i++) {
      this.burst({ at: 0.02 + i * stagger + Math.random() * 0.02, freq: 3000 + Math.random() * 1500, q: 1.5, level: 0.05, decay: 0.03 });
    }
  }

  // Szwy znikają: delikatny dzwoneczek z czterech wysokich tonów akordu E-dur.
  shimmer() {
    if (!this.ctx) return;
    [1318.5, 1661.2, 1975.5, 2637].forEach((freq, i) => {
      this.tone({ at: i * 0.075, freq, level: 0.045, attack: 0.01, decay: 1.4 });
      this.tone({ at: i * 0.075, freq: freq * 2.01, level: 0.01, attack: 0.01, decay: 0.6 });
    });
  }

  // Obraz powiększa się na cały ekran: miękki podmuch.
  whoosh(duration) {
    if (!this.ctx) return;
    const { filter, t } = this.burst({ type: "lowpass", freq: 300, q: 0.6, level: 0.09, attack: duration * 0.55, decay: duration * 0.6 });
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + duration * 0.55);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration * 1.15);
  }

  // Krótki szum przepuszczony przez filtr: podstawa stuknięć i szelestów.
  burst({ at = 0, type = "bandpass", freq, q, level, attack = 0.002, decay }) {
    const t = this.ctx.currentTime + at;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = envelope(this.ctx, t, level, attack, decay);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t, Math.random() * 0.5, attack + decay + 0.05);
    return { filter, t };
  }

  tone({ at = 0, freq, to, level, attack, decay }) {
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    osc.connect(envelope(this.ctx, t, level, attack, decay)).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }
}

function envelope(ctx, t, level, attack, decay) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(level, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return gain;
}

function whiteNoise(ctx) {
  const length = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
