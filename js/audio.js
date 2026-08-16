export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(ctx.destination);
    this.#drone();
  }

  #env(duration, peak = 0.4) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(peak, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    g.connect(this.master);
    return g;
  }

  #drone() {
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 42;
    filt.type = "lowpass";
    filt.frequency.value = 180;
    g.gain.value = 0.12;
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    osc.start();
    this.ambient = osc;
  }

  shoot() {
    if (!this.ctx) return;
    const noise = this.#noise(0.09);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    const g = this.#env(0.12, 0.55);
    noise.connect(bp);
    bp.connect(g);
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.08);
    osc.connect(this.#env(0.09, 0.2));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  hit() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 140;
    osc.connect(this.#env(0.08, 0.18));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  hurt() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.18);
    osc.connect(this.#env(0.2, 0.22));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  groan() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70 + Math.random() * 30, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.4);
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 320;
    osc.connect(filt);
    filt.connect(this.#env(0.45, 0.08));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.46);
  }

  reload() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 420;
    osc.connect(this.#env(0.05, 0.08));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  wave() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, this.ctx.currentTime + 0.35);
    osc.connect(this.#env(0.4, 0.16));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.42);
  }

  #noise(duration) {
    const n = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.start();
    return src;
  }
}
