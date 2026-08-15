(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const light = document.createElement("canvas");
  const ltx = light.getContext("2d");

  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $("hud"),
    menu: $("menu"),
    pause: $("pause"),
    dead: $("dead"),
    crosshair: $("crosshair"),
    health: $("health-fill"),
    stamina: $("stamina-fill"),
    weapon: $("weapon-name"),
    mag: $("ammo-mag"),
    res: $("ammo-res"),
    reload: $("reload-fill"),
    wave: $("wave-num"),
    kills: $("kill-num"),
    time: $("time-num"),
    banner: $("wave-banner"),
    toast: $("pickup-toast"),
    hint: $("hint"),
    best: $("best-score"),
    deadStats: $("dead-stats"),
  };

  const TAU = Math.PI * 2;
  const WEAPONS = [
    { id: "pistol", name: "PISTOL", dmg: 22, rate: 0.22, mag: 12, reload: 1.05, spread: 0.045, pellets: 1, range: 560, speed: 920, knock: 42, ammo: "pistol" },
    { id: "shotgun", name: "SHOTGUN", dmg: 11, rate: 0.72, mag: 6, reload: 1.9, spread: 0.24, pellets: 7, range: 280, speed: 780, knock: 70, ammo: "shotgun" },
    { id: "smg", name: "SMG", dmg: 12, rate: 0.075, mag: 30, reload: 1.35, spread: 0.09, pellets: 1, range: 480, speed: 980, knock: 22, ammo: "smg" },
    { id: "rifle", name: "RIFLE", dmg: 58, rate: 0.55, mag: 8, reload: 1.85, spread: 0.012, pellets: 1, range: 820, speed: 1400, knock: 90, ammo: "rifle" },
  ];

  const ZTYPES = {
    walker: { hp: 42, spd: 46, dmg: 9, r: 14, color: "#3d5a38", eye: "#9dff6a", atk: 0.85 },
    runner: { hp: 24, spd: 108, dmg: 7, r: 12, color: "#6a4036", eye: "#ff6a4a", atk: 0.5 },
    brute: { hp: 210, spd: 34, dmg: 24, r: 22, color: "#2a2e28", eye: "#ffcc44", atk: 1.15 },
    spitter: { hp: 32, spd: 52, dmg: 12, r: 13, color: "#4a5c28", eye: "#d6ff44", atk: 1.55 },
  };

  let W = 0, H = 0;
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, down: false };
  let state = "menu";
  let last = 0;
  let shake = 0;
  let hurtFlash = 0;
  let bannerT = 0;
  let toastT = 0;
  let hintT = 8;
  let audio;
  let ambientGain;
  const stick = { x: 0, y: 0 };

  const G = {
    seed: 1,
    rng: Math.random,
    cam: { x: 0, y: 0 },
    player: null,
    zombies: [],
    bullets: [],
    spit: [],
    particles: [],
    corpses: [],
    pickups: [],
    buildings: [],
    cars: [],
    lamps: [],
    barrels: [],
    trees: [],
    decals: [],
    wave: 1,
    kills: 0,
    time: 0,
    toSpawn: [],
    spawnTimer: 0,
    clearTimer: 0,
    phase: "fight",
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + G.rng() * (b - a); }
  function irand(a, b) { return (a + G.rng() * (b - a + 1)) | 0; }
  function pick(arr) { return arr[(G.rng() * arr.length) | 0]; }
  function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function resize() {
    W = canvas.width = light.width = innerWidth;
    H = canvas.height = light.height = innerHeight;
  }
  addEventListener("resize", resize);
  resize();

  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Escape") {
      if (state === "play") pauseGame();
      else if (state === "pause") resumeGame();
    }
    if (state === "play") {
      if (e.code === "Digit1") setWeapon(0, true);
      if (e.code === "Digit2") setWeapon(1, true);
      if (e.code === "Digit3") setWeapon(2, true);
      if (e.code === "Digit4") setWeapon(3, true);
      if (e.code === "KeyR") startReload();
      if (e.code === "Space") { e.preventDefault(); melee(); }
    }
  });
  addEventListener("keyup", (e) => { keys[e.code] = false; });
  addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener("mousedown", (e) => {
    if (e.button === 0) mouse.down = true;
    ensureAudio();
  });
  addEventListener("mouseup", (e) => { if (e.button === 0) mouse.down = false; });
  addEventListener("wheel", (e) => {
    if (state !== "play" || !G.player) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (G.player.wep + dir + WEAPONS.length) % WEAPONS.length;
    if (G.player.owned[next]) setWeapon(next);
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  $("btn-start").onclick = () => startRun();
  $("btn-resume").onclick = () => resumeGame();
  $("btn-quit").onclick = () => goMenu();
  $("btn-again").onclick = () => startRun();
  $("btn-menu").onclick = () => goMenu();

  window.addEventListener("error", (e) => {
    const box = $("boot-error");
    if (!box) return;
    box.textContent = (e.message || "Game error") + (e.lineno ? " (line " + e.lineno + ")" : "");
    box.classList.remove("hidden");
  });

  bindTouch();

  function bestScore() {
    try { return JSON.parse(localStorage.getItem("nodawn-best") || "null"); }
    catch { return null; }
  }
  function saveBest(rec) {
    try {
      const prev = bestScore();
      if (!prev || rec.score > prev.score) localStorage.setItem("nodawn-best", JSON.stringify(rec));
    } catch (_) { /* ignore */ }
  }
  function showBest() {
    const b = bestScore();
    ui.best.textContent = b ? `BEST  ${b.score}  ·  NIGHT ${b.wave}  ·  ${b.kills} KILLS` : "NO SURVIVORS RECORDED";
  }
  showBest();

  function ensureAudio() {
    if (audio) {
      if (audio.resume) audio.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
      ambientGain = audio.createGain();
      ambientGain.gain.value = 0.04;
      ambientGain.connect(audio.destination);
      const osc1 = audio.createOscillator();
      const osc2 = audio.createOscillator();
      const f = audio.createBiquadFilter();
      osc1.type = "sawtooth"; osc2.type = "sine";
      osc1.frequency.value = 46; osc2.frequency.value = 49.2;
      f.type = "lowpass"; f.frequency.value = 180;
      osc1.connect(f); osc2.connect(f); f.connect(ambientGain);
      osc1.start(); osc2.start();
      if (audio.resume) audio.resume().catch(() => {});
    } catch (_) {
      audio = null;
    }
  }
  function beep(freq, dur, type, vol, slide) {
    if (!audio) return;
    try {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), audio.currentTime + dur);
      g.gain.value = vol || 0.08;
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (_) { /* ignore */ }
  }
  function noiseBurst(dur, vol, hp) {
    if (!audio) return;
    try {
      const n = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = audio.createBufferSource(); src.buffer = n;
      const f = audio.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp || 800;
      const g = audio.createGain(); g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(audio.destination);
      src.start();
    } catch (_) { /* ignore */ }
  }
  function sfxShoot() { noiseBurst(0.08, 0.16, 900); beep(180, 0.07, "square", 0.05, 70); }
  function sfxHit() { beep(90, 0.08, "sawtooth", 0.07, 40); }
  function sfxHurt() { beep(70, 0.18, "sawtooth", 0.1, 30); }
  function sfxPickup() { beep(520, 0.12, "sine", 0.07, 880); }
  function sfxReload() { beep(220, 0.08, "triangle", 0.04); }
  function sfxMelee() { noiseBurst(0.06, 0.1, 200); beep(110, 0.1, "square", 0.06, 50); }
  function sfxDie() { beep(80, 0.4, "sawtooth", 0.12, 28); }

  function worldFromScreen(sx, sy) {
    return { x: sx + G.cam.x - W / 2, y: sy + G.cam.y - H / 2 };
  }
  function screenFromWorld(x, y) {
    return { x: x - G.cam.x + W / 2, y: y - G.cam.y + H / 2 };
  }

  function generateWorld() {
    G.buildings = []; G.cars = []; G.lamps = []; G.barrels = []; G.trees = []; G.decals = [];
    const blocks = 5, block = 400, road = 110, origin = 180;
    for (let by = 0; by < blocks; by++) {
      for (let bx = 0; bx < blocks; bx++) {
        const x0 = origin + bx * (block + road);
        const y0 = origin + by * (block + road);
        G.lamps.push({ x: x0 - 18, y: y0 - 18, flicker: rand(0, TAU) });
        const center = bx === 2 && by === 2;
        if (center) {
          G.barrels.push({ x: x0 + block / 2, y: y0 + block / 2 - 40 });
          continue;
        }
        const pad = 22;
        if (G.rng() < 0.7) {
          const w = rand(block * 0.35, block - pad * 2);
          const h = rand(block * 0.35, block - pad * 2);
          const x = x0 + pad + rand(0, block - pad * 2 - w);
          const y = y0 + pad + rand(0, block - pad * 2 - h);
          G.buildings.push({ x, y, w, h, hue: rand(16, 32) });
        } else {
          const w1 = rand(110, 180), h1 = rand(110, 190);
          G.buildings.push({ x: x0 + pad, y: y0 + pad, w: w1, h: h1, hue: rand(16, 32) });
          G.buildings.push({
            x: x0 + block - pad - 140, y: y0 + block - pad - 130, w: 140, h: 130, hue: rand(16, 32),
          });
        }
        if (G.rng() < 0.55) {
          G.cars.push({
            x: x0 - road / 2 + rand(-20, 20),
            y: y0 + rand(40, block - 40),
            w: 52, h: 24, rot: G.rng() < 0.5 ? 0 : Math.PI / 2, color: pick(["#3a2a22", "#2a3330", "#402020", "#243040"]),
          });
        }
      }
    }
    for (let i = 0; i < 28; i++) {
      G.trees.push({ x: rand(80, 2700), y: rand(80, 2700), r: rand(16, 26) });
    }
    for (let i = 0; i < 14; i++) {
      G.barrels.push({ x: rand(200, 2500), y: rand(200, 2500) });
    }
    G.worldSize = origin + blocks * (block + road);
  }

  function circleRect(cx, cy, r, b) {
    const nx = clamp(cx, b.x, b.x + b.w);
    const ny = clamp(cy, b.y, b.y + b.h);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }
  function resolveCircleRect(ent, b) {
    const nx = clamp(ent.x, b.x, b.x + b.w);
    const ny = clamp(ent.y, b.y, b.y + b.h);
    let dx = ent.x - nx, dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= ent.r * ent.r) return false;
    if (d2 === 0) {
      const left = ent.x - b.x, right = b.x + b.w - ent.x;
      const top = ent.y - b.y, bot = b.y + b.h - ent.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) ent.x = b.x - ent.r;
      else if (m === right) ent.x = b.x + b.w + ent.r;
      else if (m === top) ent.y = b.y - ent.r;
      else ent.y = b.y + b.h + ent.r;
      return true;
    }
    const d = Math.sqrt(d2);
    const o = ent.r - d;
    ent.x += (dx / d) * o;
    ent.y += (dy / d) * o;
    return true;
  }
  function obstacles() {
    return G.buildings.concat(G.cars.map((c) => ({ x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h })));
  }
  function collideWorld(ent) {
    for (const b of G.buildings) resolveCircleRect(ent, b);
    for (const c of G.cars) resolveCircleRect(ent, { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h });
    for (const t of G.trees) {
      const d2 = dist2(ent.x, ent.y, t.x, t.y);
      const min = ent.r + t.r * 0.55;
      if (d2 < min * min && d2 > 0) {
        const d = Math.sqrt(d2);
        ent.x = t.x + (ent.x - t.x) / d * min;
        ent.y = t.y + (ent.y - t.y) / d * min;
      }
    }
    ent.x = clamp(ent.x, 40, G.worldSize - 40);
    ent.y = clamp(ent.y, 40, G.worldSize - 40);
  }
  function blocked(x1, y1, x2, y2) {
    for (const b of G.buildings) {
      if (segRect(x1, y1, x2, y2, b)) return true;
    }
    return false;
  }
  function segRect(x1, y1, x2, y2, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const st = [0, 1];
    const clip = (p, q) => {
      if (p === 0) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t > st[1]) return false; if (t > st[0]) st[0] = t; }
      else { if (t < st[0]) return false; if (t < st[1]) st[1] = t; }
      return true;
    };
    return clip(-dx, x1 - r.x) && clip(dx, r.x + r.w - x1) && clip(-dy, y1 - r.y) && clip(dy, r.y + r.h - y1) && st[0] < st[1];
  }
  function rayRectT(ox, oy, dx, dy, r, maxT) {
    let t0 = 0, t1 = maxT;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-8) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t < t0) return false; if (t < t1) t1 = t; }
      else { if (t > t1) return false; if (t > t0) t0 = t; }
      return true;
    };
    if (!clip(-dx, ox - r.x) || !clip(dx, r.x + r.w - ox) || !clip(-dy, oy - r.y) || !clip(dy, r.y + r.h - oy)) return null;
    return t0 >= 0 ? t0 : (t1 >= 0 ? t1 : null);
  }

  function spawnPlayer() {
    const mid = G.worldSize / 2;
    G.player = {
      x: mid, y: mid, r: 14, hp: 100, maxHp: 100,
      stam: 100, vx: 0, vy: 0, aim: 0, walk: 0,
      wep: 0, mag: [12, 0, 0, 0], reserve: { pistol: 48, shotgun: 0, smg: 0, rifle: 0 },
      owned: [true, false, false, false],
      cooldown: 0, reloading: 0, meleeCd: 0, invuln: 0,
    };
  }

  function setWeapon(i, announce) {
    const p = G.player;
    if (!p || !p.owned[i]) {
      if (announce) toast("WEAPON LOCKED");
      return;
    }
    if (p.wep === i) return;
    p.wep = i;
    p.reloading = 0;
    beep(300 + i * 40, 0.06, "triangle", 0.04);
  }
  function startReload() {
    const p = G.player;
    if (!p || p.reloading > 0) return;
    const w = WEAPONS[p.wep];
    if (p.mag[p.wep] >= w.mag) return;
    if ((p.reserve[w.ammo] || 0) <= 0) { toast("NO AMMO"); return; }
    p.reloading = w.reload;
    sfxReload();
  }
  function finishReload() {
    const p = G.player;
    const w = WEAPONS[p.wep];
    const need = w.mag - p.mag[p.wep];
    const take = Math.min(need, p.reserve[w.ammo] || 0);
    p.mag[p.wep] += take;
    p.reserve[w.ammo] -= take;
  }

  function shoot() {
    const p = G.player;
    if (!p || p.cooldown > 0 || p.reloading > 0) return;
    const w = WEAPONS[p.wep];
    if (p.mag[p.wep] <= 0) { startReload(); return; }
    p.mag[p.wep]--;
    p.cooldown = w.rate;
    sfxShoot();
    shake = Math.max(shake, w.id === "shotgun" ? 10 : 5);
    const muzzle = 26;
    const ox = p.x + Math.cos(p.aim) * muzzle;
    const oy = p.y + Math.sin(p.aim) * muzzle;
    burst(ox, oy, p.aim, "#ffe8a8", 6, 80);
    for (let i = 0; i < w.pellets; i++) {
      const a = p.aim + rand(-w.spread, w.spread);
      G.bullets.push({
        x: ox, y: oy, a, spd: w.speed * rand(0.94, 1.04),
        life: w.range / w.speed, dmg: w.dmg, knock: w.knock, from: "player",
      });
    }
    if (p.mag[p.wep] <= 0) startReload();
  }

  function melee() {
    const p = G.player;
    if (!p || p.meleeCd > 0) return;
    p.meleeCd = 0.45;
    sfxMelee();
    shake = Math.max(shake, 6);
    const reach = 62;
    for (const z of G.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      const ang = Math.abs(Math.atan2(z.y - p.y, z.x - p.x) - p.aim);
      const wrap = Math.min(ang, TAU - ang);
      if (d < reach + z.r && wrap < 0.9) {
        hurtZombie(z, 34, p.aim, 140);
      }
    }
    burst(p.x + Math.cos(p.aim) * 30, p.y + Math.sin(p.aim) * 30, p.aim, "#d8d0c0", 8, 90);
  }

  function hurtZombie(z, dmg, dir, knock) {
    z.hp -= dmg;
    z.hit = 0.12;
    z.vx += Math.cos(dir) * knock;
    z.vy += Math.sin(dir) * knock;
    burst(z.x, z.y, dir, "#7a1818", 10, 110);
    sfxHit();
    if (z.hp <= 0) killZombie(z);
  }
  function killZombie(z) {
    if (z.dead) return;
    z.dead = true;
    G.kills++;
    G.corpses.push({ x: z.x, y: z.y, a: z.a, r: z.r, color: z.color, t: 18 });
    burst(z.x, z.y, z.a, "#5a1010", 16, 140);
    if (G.rng() < 0.22) dropLoot(z.x, z.y, false);
    if (z.kind === "brute" && G.rng() < 0.7) dropLoot(z.x, z.y, true);
  }

  function dropLoot(x, y, weapon) {
    if (weapon) {
      const locked = [1, 2, 3].filter((i) => !G.player.owned[i]);
      if (locked.length) {
        G.pickups.push({ x, y, kind: "weapon", wep: pick(locked), t: 0 });
        return;
      }
    }
    const kinds = ["health", "ammo", "ammo", "stam"];
    G.pickups.push({ x, y, kind: pick(kinds), t: 0 });
  }

  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.remove("show");
    void ui.toast.offsetWidth;
    ui.toast.classList.add("show");
    toastT = 1.6;
  }
  function banner(msg) {
    ui.banner.textContent = msg;
    ui.banner.classList.remove("show");
    void ui.banner.offsetWidth;
    ui.banner.classList.add("show");
    bannerT = 2.4;
  }

  function burst(x, y, a, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const ang = a + rand(-0.7, 0.7);
      const s = rand(spd * 0.3, spd);
      G.particles.push({
        x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
        life: rand(0.2, 0.55), max: 0.55, r: rand(1.2, 3.2), color,
      });
    }
  }

  function spawnZombie(kind, x, y) {
    const t = ZTYPES[kind];
    G.zombies.push({
      kind, x, y, r: t.r, hp: t.hp, max: t.hp, spd: t.spd * rand(0.9, 1.08),
      dmg: t.dmg, color: t.color, eye: t.eye, atk: t.atk, cd: 0,
      a: rand(0, TAU), vx: 0, vy: 0, walk: rand(0, TAU), hit: 0, dead: false,
    });
  }

  function planWave(n) {
    const list = [];
    const walkers = 6 + n * 4;
    const runners = Math.max(0, (n - 1) * 2);
    const spitters = n >= 3 ? n - 1 : 0;
    const brutes = n >= 5 ? Math.floor((n - 3) / 2) : 0;
    for (let i = 0; i < walkers; i++) list.push("walker");
    for (let i = 0; i < runners; i++) list.push("runner");
    for (let i = 0; i < spitters; i++) list.push("spitter");
    for (let i = 0; i < brutes; i++) list.push("brute");
    G.toSpawn = list;
    G.spawnTimer = 0.4;
    G.phase = "fight";
    banner(n % 5 === 0 ? `HORDE NIGHT ${n}` : `NIGHT ${n}`);
  }

  function spawnFromQueue() {
    if (!G.toSpawn.length) return;
    const kind = G.toSpawn.pop();
    const p = G.player;
    for (let tries = 0; tries < 18; tries++) {
      const a = rand(0, TAU);
      const d = rand(520, 820);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (x < 60 || y < 60 || x > G.worldSize - 60 || y > G.worldSize - 60) continue;
      let ok = true;
      for (const b of G.buildings) if (circleRect(x, y, 20, b)) { ok = false; break; }
      if (!ok) continue;
      spawnZombie(kind, x, y);
      return;
    }
  }

  function startRun() {
    try {
      beginRun();
    } catch (err) {
      const box = $("boot-error");
      if (box) {
        box.textContent = (err && err.message) || String(err);
        box.classList.remove("hidden");
      }
    }
  }
  function beginRun() {
    ensureAudio();
    G.seed = (Date.now() % 1e9) | 0;
    G.rng = mulberry(G.seed);
    generateWorld();
    spawnPlayer();
    G.zombies = []; G.bullets = []; G.spit = []; G.particles = []; G.corpses = []; G.pickups = [];
    G.wave = 1; G.kills = 0; G.time = 0; G.clearTimer = 0;
    planWave(1);
    for (let i = 0; i < 6; i++) dropLoot(G.player.x + rand(-180, 180), G.player.y + rand(-180, 180), i === 0);
    G.cam.x = G.player.x;
    G.cam.y = G.player.y;
    state = "play";
    hintT = 8;
    ui.menu.classList.add("hidden");
    ui.dead.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    ui.crosshair.classList.remove("hidden");
    document.body.classList.add("playing");
  }

  function goMenu() {
    state = "menu";
    document.body.classList.remove("playing", "hurt");
    ui.hud.classList.add("hidden");
    ui.crosshair.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.dead.classList.add("hidden");
    ui.menu.classList.remove("hidden");
    showBest();
  }
  function pauseGame() {
    state = "pause";
    ui.pause.classList.remove("hidden");
    document.body.classList.remove("playing");
  }
  function resumeGame() {
    state = "play";
    ui.pause.classList.add("hidden");
    document.body.classList.add("playing");
    last = performance.now();
  }

  function die() {
    if (state !== "play") return;
    sfxDie();
    state = "dead";
    document.body.classList.remove("playing");
    ui.crosshair.classList.add("hidden");
    const score = G.kills * 10 + Math.floor(G.time) * 2 + (G.wave - 1) * 50 + G.player.hp;
    const rec = { score, wave: G.wave, kills: G.kills, time: Math.floor(G.time) };
    saveBest(rec);
    ui.deadStats.innerHTML = `
      <div>NIGHT<b>${G.wave}</b></div>
      <div>KILLS<b>${G.kills}</b></div>
      <div>TIME<b>${fmtTime(G.time)}</b></div>
      <div>SCORE<b>${score}</b></div>`;
    ui.dead.classList.remove("hidden");
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updatePlayer(dt) {
    const p = G.player;
    let ix = 0, iy = 0;
    if (keys.KeyW || keys.ArrowUp) iy -= 1;
    if (keys.KeyS || keys.ArrowDown) iy += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    ix += stick.x;
    iy += stick.y;
    const len = Math.hypot(ix, iy) || 1;
    ix /= len; iy /= len;
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && p.stam > 5 && (ix || iy);
    if (sprint) p.stam = Math.max(0, p.stam - 28 * dt);
    else p.stam = Math.min(100, p.stam + 18 * dt);
    const spd = sprint ? 210 : 138;
    p.x += ix * spd * dt; p.y += iy * spd * dt;
    collideWorld(p);
    p.walk += Math.hypot(ix, iy) * spd * dt * 0.08;
    const wpos = worldFromScreen(mouse.x, mouse.y);
    p.aim = angTo(p.x, p.y, wpos.x, wpos.y);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) finishReload();
    }
    if (mouse.down) shoot();
    G.cam.x = lerp(G.cam.x, p.x, 1 - Math.pow(0.001, dt));
    G.cam.y = lerp(G.cam.y, p.y, 1 - Math.pow(0.001, dt));
  }

  function updateZombies(dt) {
    const p = G.player;
    for (const z of G.zombies) {
      if (z.dead) continue;
      z.hit = Math.max(0, z.hit - dt);
      z.cd = Math.max(0, z.cd - dt);
      z.vx *= Math.pow(0.04, dt);
      z.vy *= Math.pow(0.04, dt);
      const dx = p.x - z.x, dy = p.y - z.y;
      const d = Math.hypot(dx, dy) || 1;
      z.a = Math.atan2(dy, dx);
      let fx = dx / d, fy = dy / d;
      if (blocked(z.x, z.y, p.x, p.y)) {
        const s = 0.85;
        fx = Math.cos(z.a + s); fy = Math.sin(z.a + s);
        const x2 = z.x + fx * 28, y2 = z.y + fy * 28;
        if (blocked(z.x, z.y, x2, y2)) { fx = Math.cos(z.a - s); fy = Math.sin(z.a - s); }
      }
      for (const o of G.zombies) {
        if (o === z || o.dead) continue;
        const d2 = dist2(z.x, z.y, o.x, o.y);
        const min = (z.r + o.r) * 0.9;
        if (d2 < min * min && d2 > 0) {
          const dd = Math.sqrt(d2);
          fx -= (o.x - z.x) / dd * 0.35;
          fy -= (o.y - z.y) / dd * 0.35;
        }
      }
      const fl = Math.hypot(fx, fy) || 1;
      z.x += (fx / fl) * z.spd * dt + z.vx * dt;
      z.y += (fy / fl) * z.spd * dt + z.vy * dt;
      collideWorld(z);
      z.walk += dt * 6;
      const reach = z.kind === "spitter" ? 340 : z.r + p.r + 4;
      if (d < reach && z.cd <= 0) {
        if (z.kind === "spitter" && d > 70 && !blocked(z.x, z.y, p.x, p.y)) {
          z.cd = z.atk;
          G.spit.push({
            x: z.x, y: z.y, vx: Math.cos(z.a) * 260, vy: Math.sin(z.a) * 260, life: 1.4, dmg: z.dmg,
          });
        } else if (d < z.r + p.r + 6) {
          z.cd = z.atk;
          hitPlayer(z.dmg, z.a);
        }
      }
    }
    G.zombies = G.zombies.filter((z) => !z.dead);
    G.corpses = G.corpses.filter((c) => (c.t -= dt) > 0);
  }

  function hitPlayer(dmg, dir) {
    const p = G.player;
    if (p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.35;
    p.x -= Math.cos(dir) * 18;
    p.y -= Math.sin(dir) * 18;
    collideWorld(p);
    shake = Math.max(shake, 12);
    hurtFlash = 0.28;
    sfxHurt();
    burst(p.x, p.y, dir + Math.PI, "#a02020", 12, 120);
    if (p.hp <= 0) { p.hp = 0; die(); }
  }

  function updateBullets(dt) {
    for (const b of G.bullets) {
      const dx = Math.cos(b.a) * b.spd * dt;
      const dy = Math.sin(b.a) * b.spd * dt;
      let hitWall = false;
      for (const r of G.buildings) {
        const t = rayRectT(b.x, b.y, Math.cos(b.a), Math.sin(b.a), r, b.spd * dt + 4);
        if (t != null && t >= 0 && t <= b.spd * dt + 4) { hitWall = true; break; }
      }
      b.x += dx; b.y += dy; b.life -= dt;
      if (hitWall) { b.life = 0; burst(b.x, b.y, b.a, "#d8c8a0", 5, 70); continue; }
      for (const z of G.zombies) {
        if (z.dead) continue;
        if (dist2(b.x, b.y, z.x, z.y) < (z.r + 4) * (z.r + 4)) {
          hurtZombie(z, b.dmg, b.a, b.knock);
          b.life = 0;
          break;
        }
      }
    }
    G.bullets = G.bullets.filter((b) => b.life > 0);
    for (const s of G.spit) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (blocked(s.x - s.vx * dt, s.y - s.vy * dt, s.x, s.y)) s.life = 0;
      if (dist2(s.x, s.y, G.player.x, G.player.y) < (G.player.r + 8) ** 2) {
        hitPlayer(s.dmg, angTo(s.x, s.y, G.player.x, G.player.y));
        s.life = 0;
      }
    }
    G.spit = G.spit.filter((s) => s.life > 0);
  }

  function updatePickups(dt) {
    const p = G.player;
    for (const u of G.pickups) {
      u.t += dt;
      if (dist2(u.x, u.y, p.x, p.y) > 26 * 26) continue;
      u.taken = true;
      sfxPickup();
      if (u.kind === "health") {
        p.hp = Math.min(p.maxHp, p.hp + 32);
        toast("+ HEALTH");
      } else if (u.kind === "stam") {
        p.stam = 100;
        toast("+ STIM");
      } else if (u.kind === "ammo") {
        const w = WEAPONS[p.wep];
        p.reserve[w.ammo] = (p.reserve[w.ammo] || 0) + w.mag * 2;
        toast("+ AMMO");
      } else if (u.kind === "weapon") {
        p.owned[u.wep] = true;
        p.mag[u.wep] = WEAPONS[u.wep].mag;
        p.reserve[WEAPONS[u.wep].ammo] += WEAPONS[u.wep].mag * 3;
        setWeapon(u.wep);
        toast(`GOT ${WEAPONS[u.wep].name}`);
      }
    }
    G.pickups = G.pickups.filter((u) => !u.taken);
  }

  function updateWaves(dt) {
    if (G.phase === "fight") {
      G.spawnTimer -= dt;
      if (G.toSpawn.length && G.spawnTimer <= 0) {
        spawnFromQueue();
        G.spawnTimer = Math.max(0.12, 0.55 - G.wave * 0.03);
      }
      if (!G.toSpawn.length && G.zombies.length === 0) {
        G.phase = "clear";
        G.clearTimer = 7;
        banner("NIGHT CLEARED");
        dropLoot(G.player.x + rand(-80, 80), G.player.y + rand(-80, 80), G.wave % 2 === 0);
      }
    } else {
      G.clearTimer -= dt;
      if (G.clearTimer <= 0) {
        G.wave++;
        planWave(G.wave);
      }
    }
  }

  function updateParticles(dt) {
    for (const q of G.particles) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.9; q.vy *= 0.9;
      q.life -= dt;
    }
    G.particles = G.particles.filter((q) => q.life > 0);
    if (G.particles.length > 500) G.particles.splice(0, G.particles.length - 500);
  }

  function updateUI() {
    const p = G.player;
    if (!p) return;
    ui.health.style.transform = `scaleX(${clamp(p.hp / p.maxHp, 0, 1)})`;
    ui.stamina.style.transform = `scaleX(${clamp(p.stam / 100, 0, 1)})`;
    const w = WEAPONS[p.wep];
    ui.weapon.textContent = w.name + (p.owned[p.wep] ? "" : "");
    ui.mag.textContent = String(p.mag[p.wep]);
    ui.res.textContent = String(p.reserve[w.ammo] || 0);
    ui.reload.style.width = p.reloading > 0 ? `${(1 - p.reloading / w.reload) * 100}%` : "0%";
    ui.wave.textContent = String(G.wave);
    ui.kills.textContent = String(G.kills);
    ui.time.textContent = fmtTime(G.time);
    ui.crosshair.style.left = `${mouse.x}px`;
    ui.crosshair.style.top = `${mouse.y}px`;
    ui.hint.style.opacity = hintT > 0 ? String(clamp(hintT, 0, 1)) : "0";
    document.body.classList.toggle("hurt", hurtFlash > 0);
  }

  function drawGround() {
    const s0 = screenFromWorld(0, 0);
    ctx.fillStyle = "#141810";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(s0.x % 80, s0.y % 80);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = -80; x < W + 80; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, -80); ctx.lineTo(x, H + 80); ctx.stroke();
    }
    for (let y = -80; y < H + 80; y += 80) {
      ctx.beginPath(); ctx.moveTo(-80, y); ctx.lineTo(W + 80, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBuildings() {
    for (const b of G.buildings) {
      const s = screenFromWorld(b.x, b.y);
      if (s.x > W + 40 || s.y > H + 40 || s.x + b.w < -40 || s.y + b.h < -40) continue;
      ctx.fillStyle = `hsl(${b.hue}, 12%, 14%)`;
      ctx.fillRect(s.x, s.y, b.w, b.h);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;
      ctx.strokeRect(s.x, s.y, b.w, b.h);
      ctx.fillStyle = "rgba(232, 184, 109, 0.08)";
      const ww = 10, gap = 22;
      for (let x = s.x + 14; x < s.x + b.w - 16; x += gap) {
        for (let y = s.y + 16; y < s.y + b.h - 16; y += 28) {
          ctx.fillRect(x, y, ww, 8);
        }
      }
    }
    for (const c of G.cars) {
      const s = screenFromWorld(c.x, c.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.fillStyle = "rgba(180,220,255,0.15)";
      ctx.fillRect(-c.w / 2 + 6, -c.h / 2 + 4, c.w * 0.35, c.h - 8);
      ctx.restore();
    }
    for (const t of G.trees) {
      const s = screenFromWorld(t.x, t.y);
      ctx.fillStyle = "#0f160e";
      ctx.beginPath(); ctx.arc(s.x, s.y, t.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "#1a2818";
      ctx.beginPath(); ctx.arc(s.x - 3, s.y - 3, t.r * 0.55, 0, TAU); ctx.fill();
    }
    for (const b of G.barrels) {
      const s = screenFromWorld(b.x, b.y);
      ctx.fillStyle = "#3a2418";
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = "#c45a18";
      ctx.beginPath(); ctx.arc(s.x, s.y - 10, 5, 0, TAU); ctx.fill();
    }
  }

  function drawCorpses() {
    for (const c of G.corpses) {
      const s = screenFromWorld(c.x, c.y);
      ctx.globalAlpha = clamp(c.t / 6, 0, 0.7);
      ctx.fillStyle = "#3a1010";
      ctx.beginPath(); ctx.ellipse(s.x, s.y, c.r * 1.4, c.r * 0.7, c.a, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawActor(x, y, a, r, body, eye, walk, gun, zombie) {
    const s = screenFromWorld(x, y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(2, 4, r * 1.05, r * 0.75, 0, 0, TAU); ctx.fill();
    const leg = Math.sin(walk) * (zombie ? 5 : 4);
    ctx.strokeStyle = body; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(-4 + leg, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(4 - leg, 10); ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r, 0, 0, TAU); ctx.fill();
    if (zombie) {
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(r + 10, -2 + Math.sin(walk) * 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(r + 8, 6); ctx.stroke();
    } else if (gun) {
      ctx.fillStyle = "#1c1c1c";
      ctx.fillRect(8, -3, 18, 5);
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(24, -2, 8, 3);
    }
    ctx.fillStyle = zombie ? "#2a3328" : "#d8c8a8";
    ctx.beginPath(); ctx.arc(3, 0, r * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(r * 0.45, -3, 2.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.45, 3, 2.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawEntities() {
    for (const u of G.pickups) {
      const s = screenFromWorld(u.x, u.y);
      const bob = Math.sin(u.t * 4) * 3;
      ctx.fillStyle = u.kind === "health" ? "#c94a4a" : u.kind === "weapon" ? "#e8b86d" : u.kind === "stam" ? "#8fbf8a" : "#6aa0c8";
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.rotate(u.t);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(s.x, s.y + bob, 12, 0, TAU); ctx.stroke();
    }
    for (const z of G.zombies) {
      const col = z.hit > 0 ? "#f0d0c8" : z.color;
      drawActor(z.x, z.y, z.a, z.r, col, z.eye, z.walk, false, true);
      if (z.hp < z.max) {
        const s = screenFromWorld(z.x, z.y);
        ctx.fillStyle = "#000"; ctx.fillRect(s.x - 12, s.y - z.r - 10, 24, 3);
        ctx.fillStyle = "#c94a4a"; ctx.fillRect(s.x - 12, s.y - z.r - 10, 24 * (z.hp / z.max), 3);
      }
    }
    if (G.player) {
      drawActor(G.player.x, G.player.y, G.player.aim, G.player.r, "#4a5a48", "#d8e8ff", G.player.walk, true, false);
    }
    ctx.strokeStyle = "rgba(255,230,160,0.75)";
    ctx.lineWidth = 2;
    for (const b of G.bullets) {
      const s = screenFromWorld(b.x, b.y);
      const s2 = screenFromWorld(b.x - Math.cos(b.a) * 14, b.y - Math.sin(b.a) * 14);
      ctx.beginPath(); ctx.moveTo(s2.x, s2.y); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
    for (const s of G.spit) {
      const p = screenFromWorld(s.x, s.y);
      ctx.fillStyle = "#b6ff44";
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill();
    }
    for (const q of G.particles) {
      const s = screenFromWorld(q.x, q.y);
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, q.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLights() {
    ltx.clearRect(0, 0, W, H);
    ltx.fillStyle = "rgba(6, 8, 6, 0.58)";
    ltx.fillRect(0, 0, W, H);
    ltx.globalCompositeOperation = "destination-out";
    const p = G.player;
    if (p && state !== "menu") {
      const s = screenFromWorld(p.x, p.y);
      const g = ltx.createRadialGradient(s.x, s.y, 10, s.x, s.y, 130);
      g.addColorStop(0, "rgba(0,0,0,0.85)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ltx.fillStyle = g;
      ltx.beginPath(); ltx.arc(s.x, s.y, 130, 0, TAU); ltx.fill();
      ltx.save();
      ltx.translate(s.x, s.y);
      ltx.rotate(p.aim);
      ltx.beginPath();
      ltx.moveTo(0, 0);
      ltx.arc(0, 0, 430, -0.42, 0.42);
      ltx.closePath();
      const cone = ltx.createRadialGradient(0, 0, 20, 0, 0, 430);
      cone.addColorStop(0, "rgba(0,0,0,0.92)");
      cone.addColorStop(1, "rgba(0,0,0,0)");
      ltx.fillStyle = cone;
      ltx.fill();
      ltx.restore();
    }
    for (const lamp of G.lamps) {
      const s = screenFromWorld(lamp.x, lamp.y);
      if (s.x < -160 || s.y < -160 || s.x > W + 160 || s.y > H + 160) continue;
      const flick = 0.75 + Math.sin(performance.now() / 180 + lamp.flicker) * 0.08;
      const g = ltx.createRadialGradient(s.x, s.y, 8, s.x, s.y, 150 * flick);
      g.addColorStop(0, `rgba(0,0,0,${0.55 * flick})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ltx.fillStyle = g;
      ltx.beginPath(); ltx.arc(s.x, s.y, 150, 0, TAU); ltx.fill();
    }
    for (const b of G.barrels) {
      const s = screenFromWorld(b.x, b.y);
      const flick = 0.7 + Math.sin(performance.now() / 90 + b.x) * 0.2;
      const g = ltx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 90 * flick);
      g.addColorStop(0, `rgba(0,0,0,${0.6 * flick})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ltx.fillStyle = g;
      ltx.beginPath(); ltx.arc(s.x, s.y, 90, 0, TAU); ltx.fill();
    }
    ltx.globalCompositeOperation = "source-over";
    ctx.drawImage(light, 0, 0);
  }

  function drawMinimap() {
    if (state !== "play" && state !== "pause") return;
    const mw = 140, mh = 140, pad = 18;
    const x = W - mw - pad, y = H - mh - pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, mw, mh);
    ctx.strokeStyle = "rgba(232,184,109,0.3)";
    ctx.strokeRect(x, y, mw, mh);
    const sc = mw / G.worldSize;
    ctx.fillStyle = "#2a2824";
    for (const b of G.buildings) ctx.fillRect(x + b.x * sc, y + b.y * sc, b.w * sc, b.h * sc);
    ctx.fillStyle = "#c94a4a";
    for (const z of G.zombies) ctx.fillRect(x + z.x * sc - 1, y + z.y * sc - 1, 3, 3);
    ctx.fillStyle = "#e8b86d";
    ctx.beginPath(); ctx.arc(x + G.player.x * sc, y + G.player.y * sc, 3, 0, TAU); ctx.fill();
  }

  function drawMenuBg(t) {
    if (!G.worldSize) {
      G.rng = mulberry(7);
      generateWorld();
      G.cam.x = G.worldSize / 2; G.cam.y = G.worldSize / 2;
      if (!G.zombies.length) {
        for (let i = 0; i < 18; i++) spawnZombie(pick(["walker", "runner"]), rand(400, 2200), rand(400, 2200));
      }
    }
    G.cam.x = G.worldSize / 2 + Math.cos(t / 8000) * 220;
    G.cam.y = G.worldSize / 2 + Math.sin(t / 10000) * 180;
    for (const z of G.zombies) {
      z.a += dtMenu(z) * 0.2;
      z.x += Math.cos(z.a) * z.spd * 0.008;
      z.y += Math.sin(z.a) * z.spd * 0.008;
      z.walk += 0.08;
    }
  }
  function dtMenu() { return 0.016; }

  function bindTouch() {
    const movePad = $("move-pad");
    const firePad = $("fire-pad");
    const touchUI = $("touch");
    if (!movePad || !firePad || !touchUI) return;
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (coarse || "ontouchstart" in window) touchUI.classList.remove("hidden");

    function padVector(el, ev) {
      const t = ev.changedTouches ? ev.changedTouches[0] : ev;
      const r = el.getBoundingClientRect();
      const x = (t.clientX - (r.left + r.width / 2)) / (r.width * 0.5);
      const y = (t.clientY - (r.top + r.height / 2)) / (r.height * 0.5);
      return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), cx: t.clientX, cy: t.clientY };
    }
    function onMoveStart(ev) {
      ev.preventDefault();
      const v = padVector(movePad, ev);
      stick.x = v.x; stick.y = v.y;
    }
    function onMoveEnd(ev) {
      ev.preventDefault();
      stick.x = 0; stick.y = 0;
    }
    function onFireStart(ev) {
      ev.preventDefault();
      mouse.down = true;
      const v = padVector(firePad, ev);
      mouse.x = W / 2 + v.x * 220;
      mouse.y = H / 2 + v.y * 220;
    }
    function onFireMove(ev) {
      ev.preventDefault();
      const v = padVector(firePad, ev);
      mouse.x = W / 2 + v.x * 220;
      mouse.y = H / 2 + v.y * 220;
    }
    function onFireEnd(ev) {
      ev.preventDefault();
      mouse.down = false;
    }
    for (const [el, start, move, end] of [
      [movePad, onMoveStart, onMoveStart, onMoveEnd],
      [firePad, onFireStart, onFireMove, onFireEnd],
    ]) {
      el.addEventListener("touchstart", start, { passive: false });
      el.addEventListener("touchmove", move, { passive: false });
      el.addEventListener("touchend", end, { passive: false });
      el.addEventListener("touchcancel", end, { passive: false });
    }
  }

  function frame(now) {
    try {
      tick(now);
    } catch (err) {
      const box = $("boot-error");
      if (box) {
        box.textContent = (err && err.message) || String(err);
        box.classList.remove("hidden");
      }
      requestAnimationFrame(frame);
      return;
    }
    requestAnimationFrame(frame);
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    shake = Math.max(0, shake - dt * 18);
    hurtFlash = Math.max(0, hurtFlash - dt);
    if (bannerT > 0) bannerT -= dt;
    if (toastT > 0) toastT -= dt;
    if (hintT > 0 && state === "play") hintT -= dt;

    if (state === "play") {
      G.time += dt;
      updatePlayer(dt);
      updateZombies(dt);
      updateBullets(dt);
      updatePickups(dt);
      updateWaves(dt);
      updateParticles(dt);
      updateUI();
    } else if (state === "pause") {
      updateUI();
    } else if (state === "menu") {
      drawMenuBg(now);
    } else if (state === "dead") {
      updateParticles(dt);
    }

    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    drawGround();
    drawCorpses();
    drawBuildings();
    drawEntities();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLights();
    drawMinimap();
    ctx.fillStyle = "rgba(18, 8, 0, 0.12)";
    ctx.fillRect(0, 0, W, H);
  }

  requestAnimationFrame(frame);
})();
