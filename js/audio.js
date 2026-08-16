export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.38;
      this.master.connect(this.ctx.destination);
      this._ambient();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  _env(node, t, a, s, d, peak = 0.2) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  _osc(type, freq, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur);
    return o;
  }

  _noise(t, dur) {
    if (!this._nbuf) {
      const n = Math.floor(this.ctx.sampleRate * 0.12);
      this._nbuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = this._nbuf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this._nbuf;
    src.start(t);
    src.stop(t + dur);
    return src;
  }

  shoot(dist = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = Math.max(0.04, 0.22 / (1 + dist * 0.04));
    const noise = this._noise(t, 0.09);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.7;
    noise.connect(bp);
    this._env(bp, t, 0.001, 0.3, 0.09, vol);
    const o = this._osc("square", 180, t, 0.07);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.07);
    this._env(o, t, 0.001, 0.2, 0.07, vol * 0.6);
  }

  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc("triangle", 880, t, 0.08);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    this._env(o, t, 0.001, 0.2, 0.08, 0.12);
  }

  headshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc("square", 1240, t, 0.12);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    this._env(o, t, 0.001, 0.25, 0.12, 0.14);
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc("sawtooth", 140, t, 0.18);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    this._env(o, t, 0.001, 0.4, 0.18, 0.16);
  }

  reload() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o1 = this._osc("square", 220, t, 0.08);
    this._env(o1, t, 0.001, 0.2, 0.08, 0.06);
    const o2 = this._osc("square", 320, t + 0.12, 0.1);
    this._env(o2, t + 0.12, 0.001, 0.2, 0.1, 0.07);
    const o3 = this._osc("triangle", 180, t + 1.4, 0.08);
    this._env(o3, t + 1.4, 0.001, 0.2, 0.08, 0.08);
  }

  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc("sawtooth", 200, t, 0.5);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    this._env(o, t, 0.01, 0.4, 0.5, 0.18);
  }

  spawn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc("sine", 420, t, 0.25);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.25);
    this._env(o, t, 0.01, 0.3, 0.25, 0.08);
  }

  footstep(sprint) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise(t, 0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = sprint ? 500 : 320;
    n.connect(f);
    this._env(f, t, 0.001, 0.3, 0.05, sprint ? 0.07 : 0.045);
  }

  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, i) => {
      const o = this._osc("triangle", freq, t + i * 0.12, 0.3);
      this._env(o, t + i * 0.12, 0.01, 0.4, 0.3, 0.1);
    });
  }

  _ambient() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 55;
    const g = this.ctx.createGain();
    g.gain.value = 0.03;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = this.ctx.createGain();
    lg.gain.value = 0.012;
    lfo.connect(lg);
    lg.connect(g.gain);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    lfo.start(t);
  }
}
