(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $("hud"), menu: $("menu"), pause: $("pause"), dead: $("dead"),
    crosshair: $("crosshair"), health: $("health-fill"), stamina: $("stamina-fill"),
    weapon: $("weapon-name"), mag: $("ammo-mag"), res: $("ammo-res"), reload: $("reload-fill"),
    wave: $("wave-num"), kills: $("kill-num"), time: $("time-num"),
    banner: $("wave-banner"), toast: $("pickup-toast"), hint: $("hint"),
    best: $("best-score"), deadStats: $("dead-stats"), err: $("boot-error"),
  };

  const TAU = Math.PI * 2;
  const MAP = 48;
  const FOV = 1.22;
  const WEAPONS = [
    { id: "pistol", name: "PISTOL", dmg: 24, rate: 0.22, mag: 12, reload: 1.05, spread: 0.03, pellets: 1, range: 18, knock: 2.2, ammo: "pistol" },
    { id: "shotgun", name: "SHOTGUN", dmg: 12, rate: 0.75, mag: 6, reload: 1.9, spread: 0.16, pellets: 7, range: 8, knock: 3.4, ammo: "shotgun" },
    { id: "smg", name: "SMG", dmg: 13, rate: 0.07, mag: 30, reload: 1.35, spread: 0.055, pellets: 1, range: 16, knock: 1.2, ammo: "smg" },
    { id: "rifle", name: "RIFLE", dmg: 62, rate: 0.52, mag: 8, reload: 1.85, spread: 0.01, pellets: 1, range: 28, knock: 4.2, ammo: "rifle" },
  ];
  const ZTYPES = {
    walker: { hp: 42, spd: 1.35, dmg: 10, r: 0.28, atk: 0.85, scale: 0.92, body: "#3d5a38", eye: "#9dff6a" },
    runner: { hp: 24, spd: 3.15, dmg: 8, r: 0.24, atk: 0.5, scale: 0.82, body: "#6a4036", eye: "#ff6a4a" },
    brute: { hp: 220, spd: 1.05, dmg: 26, r: 0.4, atk: 1.15, scale: 1.25, body: "#2a2e28", eye: "#ffcc44" },
    spitter: { hp: 32, spd: 1.55, dmg: 14, r: 0.26, atk: 1.5, scale: 0.88, body: "#4a5c28", eye: "#d6ff44" },
  };
  const WALL = [
    null,
    { l: [118, 62, 52], d: [78, 40, 34] },
    { l: [86, 88, 82], d: [56, 58, 54] },
    { l: [72, 82, 58], d: [46, 54, 38] },
    { l: [112, 78, 48], d: [74, 50, 30] },
  ];

  let W = 0, H = 0, strip = 2;
  const keys = Object.create(null);
  const stick = { x: 0, y: 0 };
  let lookStick = 0;
  let mouseDown = false;
  let state = "menu";
  let last = 0, shake = 0, hurtFlash = 0, hintT = 8, bob = 0, kick = 0, flash = 0;
  let audio = null;
  let zbuf;

  const G = {
    rng: Math.random,
    grid: new Uint8Array(MAP * MAP),
    player: null,
    zombies: [],
    spit: [],
    particles: [],
    corpses: [],
    pickups: [],
    props: [],
    wave: 1, kills: 0, time: 0,
    toSpawn: [], spawnTimer: 0, clearTimer: 0, phase: "fight",
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + G.rng() * (b - a); }
  function pick(arr) { return arr[(G.rng() * arr.length) | 0]; }
  function hypot(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }
  function cell(x, y) {
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= MAP || iy >= MAP) return 1;
    return G.grid[iy * MAP + ix];
  }
  function solid(x, y) { return cell(x, y) > 0; }
  function showErr(msg) {
    if (!ui.err) return;
    ui.err.textContent = msg;
    ui.err.classList.remove("hidden");
  }

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    strip = W > 1400 ? 3 : 2;
    zbuf = new Float32Array(Math.ceil(W / strip));
  }
  addEventListener("resize", resize);
  resize();

  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "Escape" && state === "play") pauseGame();
    if (state === "play") {
      if (e.code === "Digit1") setWeapon(0, true);
      if (e.code === "Digit2") setWeapon(1, true);
      if (e.code === "Digit3") setWeapon(2, true);
      if (e.code === "Digit4") setWeapon(3, true);
      if (e.code === "KeyR") startReload();
      if (e.code === "Space") melee();
    }
  });
  addEventListener("keyup", (e) => { keys[e.code] = false; });
  addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDown = true;
    ensureAudio();
    if (state === "play") lockMouse();
  });
  addEventListener("mouseup", (e) => { if (e.button === 0) mouseDown = false; });
  addEventListener("mousemove", (e) => {
    if (state !== "play" || !G.player) return;
    if (document.pointerLockElement !== canvas && document.pointerLockElement !== document.body) return;
    G.player.yaw += e.movementX * 0.0022;
    G.player.pitch = clamp(G.player.pitch - e.movementY * 0.0016, -0.45, 0.45);
  });
  addEventListener("wheel", (e) => {
    if (state !== "play" || !G.player) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    let i = G.player.wep;
    for (let n = 0; n < 4; n++) {
      i = (i + dir + 4) % 4;
      if (G.player.owned[i]) { setWeapon(i); break; }
    }
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    if (state === "play" && !document.pointerLockElement) pauseGame();
  });

  $("btn-start").onclick = () => startRun();
  $("btn-resume").onclick = () => resumeGame();
  $("btn-quit").onclick = () => goMenu();
  $("btn-again").onclick = () => startRun();
  $("btn-menu").onclick = () => goMenu();
  window.addEventListener("error", (e) => showErr((e.message || "Error") + (e.lineno ? " @" + e.lineno : "")));

  function lockMouse() {
    const el = canvas;
    if (el.requestPointerLock) el.requestPointerLock();
  }
  function unlockMouse() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  function bestScore() {
    try { return JSON.parse(localStorage.getItem("nodawn-fps-best") || "null"); }
    catch { return null; }
  }
  function saveBest(rec) {
    try {
      const prev = bestScore();
      if (!prev || rec.score > prev.score) localStorage.setItem("nodawn-fps-best", JSON.stringify(rec));
    } catch (_) { /* ignore */ }
  }
  function showBest() {
    const b = bestScore();
    ui.best.textContent = b ? `BEST  ${b.score}  ·  NIGHT ${b.wave}  ·  ${b.kills} KILLS` : "NO SURVIVORS RECORDED";
  }
  showBest();

  function ensureAudio() {
    if (audio) { if (audio.resume) audio.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
      const g = audio.createGain(); g.gain.value = 0.045; g.connect(audio.destination);
      const o1 = audio.createOscillator(), o2 = audio.createOscillator(), f = audio.createBiquadFilter();
      o1.type = "sawtooth"; o2.type = "sine";
      o1.frequency.value = 46; o2.frequency.value = 49.2;
      f.type = "lowpass"; f.frequency.value = 180;
      o1.connect(f); o2.connect(f); f.connect(g);
      o1.start(); o2.start();
      if (audio.resume) audio.resume().catch(() => {});
    } catch (_) { audio = null; }
  }
  function beep(freq, dur, type, vol, slide) {
    if (!audio) return;
    try {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || "square"; o.frequency.value = freq;
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
      const f = audio.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp || 900;
      const g = audio.createGain(); g.gain.value = vol || 0.14;
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(audio.destination);
      src.start();
    } catch (_) { /* ignore */ }
  }
  function sfxShoot() { noiseBurst(0.09, 0.18, 700); beep(170, 0.07, "square", 0.05, 60); }
  function sfxHit() { beep(90, 0.08, "sawtooth", 0.07, 40); }
  function sfxHurt() { beep(70, 0.18, "sawtooth", 0.1, 30); }
  function sfxPickup() { beep(520, 0.12, "sine", 0.07, 880); }
  function sfxReload() { beep(220, 0.08, "triangle", 0.04); }
  function sfxMelee() { noiseBurst(0.06, 0.1, 200); beep(110, 0.1, "square", 0.06, 50); }
  function sfxDie() { beep(80, 0.4, "sawtooth", 0.12, 28); }

  function generateMap() {
    G.grid.fill(0);
    for (let i = 0; i < MAP; i++) {
      G.grid[i] = 1;
      G.grid[(MAP - 1) * MAP + i] = 1;
      G.grid[i * MAP] = 1;
      G.grid[i * MAP + MAP - 1] = 1;
    }
    const blocks = 5, block = 6, road = 3, origin = 3;
    G.props = [];
    for (let by = 0; by < blocks; by++) {
      for (let bx = 0; bx < blocks; bx++) {
        const x0 = origin + bx * (block + road);
        const y0 = origin + by * (block + road);
        const plaza = bx === 2 && by === 2;
        if (plaza) {
          G.props.push({ x: x0 + block / 2, y: y0 + 1.2, kind: "barrel" });
          continue;
        }
        const t = 1 + ((bx + by * 3) % 4);
        if (G.rng() < 0.72) {
          for (let y = 0; y < block; y++) {
            for (let x = 0; x < block; x++) {
              if (x === 0 || y === 0 || x === block - 1 || y === block - 1 || G.rng() < 0.55) {
                G.grid[(y0 + y) * MAP + (x0 + x)] = t;
              }
            }
          }
        } else {
          const w = 3 + (G.rng() * 3 | 0), h = 3 + (G.rng() * 3 | 0);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) G.grid[(y0 + y) * MAP + (x0 + x)] = t;
        }
        if (G.rng() < 0.5) G.props.push({ x: x0 - 1.2, y: y0 + rand(1, block - 1), kind: "lamp" });
        if (G.rng() < 0.4) G.props.push({ x: x0 + rand(0.6, block - 0.6), y: y0 - 1.15, kind: "barrel" });
      }
    }
  }

  function emptySpot(minX, minY, maxX, maxY) {
    for (let i = 0; i < 40; i++) {
      const x = rand(minX, maxX), y = rand(minY, maxY);
      if (!solid(x, y) && !solid(x + 0.3, y) && !solid(x - 0.3, y) && !solid(x, y + 0.3) && !solid(x, y - 0.3)) return { x, y };
    }
    return { x: MAP / 2, y: MAP / 2 };
  }

  function spawnPlayer() {
    const p = emptySpot(MAP / 2 - 1.5, MAP / 2 - 1.5, MAP / 2 + 1.5, MAP / 2 + 1.5);
    let best = 0, bestD = 0;
    for (let a = 0; a < 16; a++) {
      const yaw = a * TAU / 16;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      let d = 0.5;
      for (; d < 22; d += 0.5) if (solid(p.x + c * d, p.y + s * d)) break;
      if (d > bestD) { bestD = d; best = yaw; }
    }
    G.player = {
      x: p.x, y: p.y, yaw: best, pitch: 0, r: 0.22,
      hp: 100, maxHp: 100, stam: 100,
      wep: 0, mag: [12, 0, 0, 0],
      reserve: { pistol: 48, shotgun: 0, smg: 0, rifle: 0 },
      owned: [true, false, false, false],
      cooldown: 0, reloading: 0, meleeCd: 0, invuln: 0,
    };
  }

  function tryMove(ent, dx, dy, r) {
    const nx = ent.x + dx, ny = ent.y + dy;
    if (!solid(nx - r, ent.y) && !solid(nx + r, ent.y) && !solid(nx, ent.y - r) && !solid(nx, ent.y + r)) ent.x = nx;
    if (!solid(ent.x - r, ny) && !solid(ent.x + r, ny) && !solid(ent.x, ny - r) && !solid(ent.x, ny + r)) ent.y = ny;
  }

  function setWeapon(i, announce) {
    const p = G.player;
    if (!p || !p.owned[i]) { if (announce) toast("WEAPON LOCKED"); return; }
    if (p.wep === i) return;
    p.wep = i; p.reloading = 0;
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

  function hitscan(yaw, range) {
    const p = G.player;
    const dx = Math.cos(yaw), dy = Math.sin(yaw);
    const step = 0.08;
    for (let t = 0.35; t < range; t += step) {
      const x = p.x + dx * t, y = p.y + dy * t;
      if (solid(x, y)) return { wall: true, dist: t, x, y };
      for (const z of G.zombies) {
        if (z.dead) continue;
        if (hypot(z.x, z.y, x, y) < z.r + 0.08) return { zombie: z, dist: t, x, y };
      }
    }
    return { dist: range, x: p.x + dx * range, y: p.y + dy * range };
  }

  function shoot() {
    const p = G.player;
    if (!p || p.cooldown > 0 || p.reloading > 0) return;
    const w = WEAPONS[p.wep];
    if (p.mag[p.wep] <= 0) { startReload(); return; }
    p.mag[p.wep]--;
    p.cooldown = w.rate;
    kick = w.id === "shotgun" ? 18 : 10;
    flash = 0.07;
    shake = Math.max(shake, w.id === "shotgun" ? 8 : 4);
    sfxShoot();
    for (let i = 0; i < w.pellets; i++) {
      const a = p.yaw + rand(-w.spread, w.spread);
      const hit = hitscan(a, w.range);
      if (hit.zombie) hurtZombie(hit.zombie, w.dmg, a, w.knock);
    }
    if (p.mag[p.wep] <= 0) startReload();
  }

  function melee() {
    const p = G.player;
    if (!p || p.meleeCd > 0) return;
    p.meleeCd = 0.45;
    kick = 14;
    sfxMelee();
    for (const z of G.zombies) {
      if (z.dead) continue;
      const d = hypot(z.x, z.y, p.x, p.y);
      let ang = Math.atan2(z.y - p.y, z.x - p.x) - p.yaw;
      while (ang > Math.PI) ang -= TAU;
      while (ang < -Math.PI) ang += TAU;
      if (d < 1.35 && Math.abs(ang) < 0.7) hurtZombie(z, 36, p.yaw, 5);
    }
  }

  function hurtZombie(z, dmg, dir, knock) {
    z.hp -= dmg;
    z.hit = 0.12;
    z.x += Math.cos(dir) * knock * 0.08;
    z.y += Math.sin(dir) * knock * 0.08;
    sfxHit();
    if (z.hp <= 0) killZombie(z);
  }
  function killZombie(z) {
    if (z.dead) return;
    z.dead = true;
    G.kills++;
    G.corpses.push({ x: z.x, y: z.y, t: 16, kind: z.kind, scale: z.scale });
    if (G.rng() < 0.22) dropLoot(z.x, z.y, false);
    if (z.kind === "brute" && G.rng() < 0.7) dropLoot(z.x, z.y, true);
  }

  function dropLoot(x, y, weapon) {
    if (solid(x, y)) {
      const s = emptySpot(x - 1, y - 1, x + 1, y + 1);
      x = s.x; y = s.y;
    }
    if (weapon) {
      const locked = [1, 2, 3].filter((i) => !G.player.owned[i]);
      if (locked.length) { G.pickups.push({ x, y, kind: "weapon", wep: pick(locked), t: 0 }); return; }
    }
    G.pickups.push({ x, y, kind: pick(["health", "ammo", "ammo", "stam"]), t: 0 });
  }

  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.remove("show");
    void ui.toast.offsetWidth;
    ui.toast.classList.add("show");
  }
  function banner(msg) {
    ui.banner.textContent = msg;
    ui.banner.classList.remove("show");
    void ui.banner.offsetWidth;
    ui.banner.classList.add("show");
  }

  function spawnZombie(kind, x, y) {
    const t = ZTYPES[kind];
    G.zombies.push({
      kind, x, y, r: t.r, hp: t.hp, max: t.hp, spd: t.spd * rand(0.9, 1.08),
      dmg: t.dmg, atk: t.atk, scale: t.scale, body: t.body, eye: t.eye,
      cd: 0, hit: 0, dead: false, walk: rand(0, TAU),
    });
  }

  function planWave(n) {
    const list = [];
    for (let i = 0; i < 5 + n * 4; i++) list.push("walker");
    for (let i = 0; i < Math.max(0, (n - 1) * 2); i++) list.push("runner");
    for (let i = 0; i < (n >= 3 ? n - 1 : 0); i++) list.push("spitter");
    for (let i = 0; i < (n >= 5 ? ((n - 3) / 2) | 0 : 0); i++) list.push("brute");
    G.toSpawn = list;
    G.spawnTimer = 0.35;
    G.phase = "fight";
    banner(n % 5 === 0 ? `HORDE NIGHT ${n}` : `NIGHT ${n}`);
  }

  function spawnFromQueue() {
    if (!G.toSpawn.length) return;
    const kind = G.toSpawn.pop();
    const p = G.player;
    for (let i = 0; i < 24; i++) {
      const a = rand(0, TAU), d = rand(9, 16);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < 2 || y < 2 || x > MAP - 2 || y > MAP - 2) continue;
      if (solid(x, y)) continue;
      spawnZombie(kind, x, y);
      return;
    }
  }

  function beginRun() {
    ensureAudio();
    G.rng = (function (seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })((Date.now() % 1e9) | 0);
    generateMap();
    spawnPlayer();
    G.zombies = []; G.spit = []; G.particles = []; G.corpses = []; G.pickups = [];
    G.wave = 1; G.kills = 0; G.time = 0; G.clearTimer = 0;
    planWave(1);
    for (let i = 0; i < 5; i++) {
      const s = emptySpot(G.player.x - 3, G.player.y - 3, G.player.x + 3, G.player.y + 3);
      dropLoot(s.x, s.y, i === 0);
    }
    state = "play";
    hintT = 8;
    ui.menu.classList.add("hidden");
    ui.dead.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    ui.crosshair.classList.remove("hidden");
    document.body.classList.add("playing");
    lockMouse();
  }
  function startRun() {
    try { beginRun(); }
    catch (err) { showErr((err && err.message) || String(err)); }
  }

  function goMenu() {
    state = "menu";
    unlockMouse();
    document.body.classList.remove("playing", "hurt");
    ui.hud.classList.add("hidden");
    ui.crosshair.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.dead.classList.add("hidden");
    ui.menu.classList.remove("hidden");
    showBest();
  }
  function pauseGame() {
    if (state !== "play") return;
    state = "pause";
    unlockMouse();
    ui.pause.classList.remove("hidden");
    document.body.classList.remove("playing");
  }
  function resumeGame() {
    state = "play";
    ui.pause.classList.add("hidden");
    document.body.classList.add("playing");
    last = performance.now();
    lockMouse();
  }
  function die() {
    if (state !== "play") return;
    sfxDie();
    state = "dead";
    unlockMouse();
    document.body.classList.remove("playing");
    ui.crosshair.classList.add("hidden");
    const score = G.kills * 10 + Math.floor(G.time) * 2 + (G.wave - 1) * 50 + G.player.hp;
    saveBest({ score, wave: G.wave, kills: G.kills, time: Math.floor(G.time) });
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

  function hitPlayer(dmg) {
    const p = G.player;
    if (p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.4;
    shake = Math.max(shake, 14);
    hurtFlash = 0.32;
    sfxHurt();
    if (p.hp <= 0) { p.hp = 0; die(); }
  }

  function updatePlayer(dt) {
    const p = G.player;
    let ix = 0, iy = 0;
    if (keys.KeyW || keys.ArrowUp) iy += 1;
    if (keys.KeyS || keys.ArrowDown) iy -= 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    ix += stick.x; iy -= stick.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && p.stam > 5 && len > 0.1;
    if (sprint) p.stam = Math.max(0, p.stam - 28 * dt);
    else p.stam = Math.min(100, p.stam + 16 * dt);
    const spd = sprint ? 5.4 : 3.35;
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    tryMove(p, (c * iy - s * ix) * spd * dt, (s * iy + c * ix) * spd * dt, p.r);
    if (len > 0.1) bob += dt * (sprint ? 14 : 9);
    p.yaw += lookStick * 2.1 * dt;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    kick = Math.max(0, kick - dt * 55);
    flash = Math.max(0, flash - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) finishReload();
    }
    if (mouseDown) shoot();
  }

  function los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, d / 0.2 | 0);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (solid(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  function updateZombies(dt) {
    const p = G.player;
    for (const z of G.zombies) {
      if (z.dead) continue;
      z.hit = Math.max(0, z.hit - dt);
      z.cd = Math.max(0, z.cd - dt);
      z.walk += dt * 7;
      const dx = p.x - z.x, dy = p.y - z.y;
      const d = Math.hypot(dx, dy) || 1;
      let fx = dx / d, fy = dy / d;
      if (!los(z.x, z.y, p.x, p.y)) {
        const a = Math.atan2(fy, fx) + 0.9;
        fx = Math.cos(a); fy = Math.sin(a);
        if (solid(z.x + fx * 0.4, z.y + fy * 0.4)) { fx = Math.cos(a - 1.8); fy = Math.sin(a - 1.8); }
      }
      for (const o of G.zombies) {
        if (o === z || o.dead) continue;
        const dd = hypot(z.x, z.y, o.x, o.y);
        if (dd < 0.55 && dd > 0) { fx -= (o.x - z.x) / dd * 0.4; fy -= (o.y - z.y) / dd * 0.4; }
      }
      const fl = Math.hypot(fx, fy) || 1;
      tryMove(z, (fx / fl) * z.spd * dt, (fy / fl) * z.spd * dt, z.r);
      if (z.kind === "spitter" && d < 9 && d > 1.6 && z.cd <= 0 && los(z.x, z.y, p.x, p.y)) {
        z.cd = z.atk;
        const inv = 1 / d;
        G.spit.push({ x: z.x, y: z.y, vx: dx * inv * 7.5, vy: dy * inv * 7.5, life: 1.3, dmg: z.dmg });
      } else if (d < 0.85 && z.cd <= 0) {
        z.cd = z.atk;
        hitPlayer(z.dmg);
      }
    }
    G.zombies = G.zombies.filter((z) => !z.dead);
    G.corpses = G.corpses.filter((c) => (c.t -= dt) > 0);
    for (const s of G.spit) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (solid(s.x, s.y)) s.life = 0;
      if (hypot(s.x, s.y, p.x, p.y) < 0.38) { hitPlayer(s.dmg); s.life = 0; }
    }
    G.spit = G.spit.filter((s) => s.life > 0);
  }

  function updatePickups(dt) {
    const p = G.player;
    for (const u of G.pickups) {
      u.t += dt;
      if (hypot(u.x, u.y, p.x, p.y) > 0.7) continue;
      u.taken = true;
      sfxPickup();
      if (u.kind === "health") { p.hp = Math.min(p.maxHp, p.hp + 34); toast("+ HEALTH"); }
      else if (u.kind === "stam") { p.stam = 100; toast("+ STIM"); }
      else if (u.kind === "ammo") {
        const w = WEAPONS[p.wep];
        p.reserve[w.ammo] = (p.reserve[w.ammo] || 0) + w.mag * 2;
        toast("+ AMMO");
      } else if (u.kind === "weapon") {
        p.owned[u.wep] = true;
        p.mag[u.wep] = WEAPONS[u.wep].mag;
        p.reserve[WEAPONS[u.wep].ammo] += WEAPONS[u.wep].mag * 3;
        setWeapon(u.wep);
        toast("GOT " + WEAPONS[u.wep].name);
      }
    }
    G.pickups = G.pickups.filter((u) => !u.taken);
  }

  function updateWaves(dt) {
    if (G.phase === "fight") {
      G.spawnTimer -= dt;
      if (G.toSpawn.length && G.spawnTimer <= 0) {
        spawnFromQueue();
        G.spawnTimer = Math.max(0.12, 0.5 - G.wave * 0.03);
      }
      if (!G.toSpawn.length && G.zombies.length === 0) {
        G.phase = "clear";
        G.clearTimer = 6.5;
        banner("NIGHT CLEARED");
        const s = emptySpot(G.player.x - 2, G.player.y - 2, G.player.x + 2, G.player.y + 2);
        dropLoot(s.x, s.y, G.wave % 2 === 0);
      }
    } else {
      G.clearTimer -= dt;
      if (G.clearTimer <= 0) { G.wave++; planWave(G.wave); }
    }
  }

  function updateUI() {
    const p = G.player;
    if (!p) return;
    ui.health.style.transform = `scaleX(${clamp(p.hp / p.maxHp, 0, 1)})`;
    ui.stamina.style.transform = `scaleX(${clamp(p.stam / 100, 0, 1)})`;
    const w = WEAPONS[p.wep];
    ui.weapon.textContent = w.name;
    ui.mag.textContent = String(p.mag[p.wep]);
    ui.res.textContent = String(p.reserve[w.ammo] || 0);
    ui.reload.style.width = p.reloading > 0 ? `${(1 - p.reloading / w.reload) * 100}%` : "0%";
    ui.wave.textContent = String(G.wave);
    ui.kills.textContent = String(G.kills);
    ui.time.textContent = fmtTime(G.time);
    ui.hint.style.opacity = hintT > 0 ? String(clamp(hintT, 0, 1)) : "0";
    document.body.classList.toggle("hurt", hurtFlash > 0);
  }

  function project(x, y) {
    const p = G.player;
    const relX = x - p.x, relY = y - p.y;
    const c = Math.cos(-p.yaw), s = Math.sin(-p.yaw);
    const camX = relX * c - relY * s;
    const camY = relX * s + relY * c;
    return { camX, camY };
  }

  function drawSkyFloor() {
    const horizon = H / 2 + (G.player ? G.player.pitch * H : 0);
    const g1 = ctx.createLinearGradient(0, 0, 0, horizon);
    g1.addColorStop(0, "#07080c");
    g1.addColorStop(1, "#14161c");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, Math.max(0, horizon));
    const g2 = ctx.createLinearGradient(0, horizon, 0, H);
    g2.addColorStop(0, "#1a1c16");
    g2.addColorStop(1, "#0b0c09");
    ctx.fillStyle = g2;
    ctx.fillRect(0, horizon, W, H);
  }

  function drawWalls() {
    const p = G.player || { x: MAP / 2, y: MAP / 2, yaw: performance.now() / 4000, pitch: 0 };
    const horizon = H / 2 + p.pitch * H;
    const cols = zbuf.length;
    for (let col = 0; col < cols; col++) {
      const sx = (col + 0.5) / cols;
      const ang = p.yaw - FOV / 2 + sx * FOV;
      const rayX = Math.cos(ang), rayY = Math.sin(ang);
      let mapX = p.x | 0, mapY = p.y | 0;
      const deltaX = Math.abs(1 / (rayX || 1e-12));
      const deltaY = Math.abs(1 / (rayY || 1e-12));
      const stepX = rayX < 0 ? -1 : 1;
      const stepY = rayY < 0 ? -1 : 1;
      let sideDistX = rayX < 0 ? (p.x - mapX) * deltaX : (mapX + 1 - p.x) * deltaX;
      let sideDistY = rayY < 0 ? (p.y - mapY) * deltaY : (mapY + 1 - p.y) * deltaY;
      let side = 0, hit = 0, dist = 40;
      for (let i = 0; i < 48; i++) {
        if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
        else { sideDistY += deltaY; mapY += stepY; side = 1; }
        const t = cell(mapX, mapY);
        if (t > 0) {
          hit = t;
          dist = side === 0 ? (mapX - p.x + (1 - stepX) / 2) / rayX : (mapY - p.y + (1 - stepY) / 2) / rayY;
          break;
        }
      }
      dist = Math.max(0.08, dist);
      const corr = dist * Math.cos(ang - p.yaw);
      zbuf[col] = corr;
      const lineH = (H * 1.05) / corr;
      const y0 = horizon - lineH / 2;
      const pal = WALL[hit] || WALL[1];
      const rgb = side ? pal.d : pal.l;
      const fog = clamp(1 - corr / 22, 0.08, 1);
      const shade = (0.72 + 0.28 * (1 - Math.abs(sx * 2 - 1))) * fog;
      ctx.fillStyle = `rgb(${rgb[0] * shade | 0},${rgb[1] * shade | 0},${rgb[2] * shade | 0})`;
      ctx.fillRect(col * strip, y0, strip + 1, lineH);
    }
  }

  function drawSprite(x, y, drawFn, depthScale) {
    const pr = project(x, y);
    if (pr.camY < 0.25) return;
    const p = G.player;
    const horizon = H / 2 + p.pitch * H;
    const screenX = W / 2 + (pr.camX / pr.camY) * (W / 2 / Math.tan(FOV / 2));
    const size = (H * (depthScale || 0.9)) / pr.camY;
    const col = (screenX / strip) | 0;
    if (col >= 0 && col < zbuf.length && pr.camY > zbuf[col] + 0.12) return;
    drawFn(screenX, horizon + size * 0.42, size, pr.camY);
  }

  function drawZombieSprite(z) {
    drawSprite(z.x, z.y, (cx, feet, size) => {
      const h = size * z.scale;
      const w = h * 0.38;
      ctx.save();
      ctx.translate(cx, feet);
      const hit = z.hit > 0;
      ctx.fillStyle = hit ? "#f0d0c8" : z.body;
      ctx.fillRect(-w * 0.35, -h * 0.72, w * 0.7, h * 0.5);
      ctx.fillRect(-w * 0.22, -h * 0.28, w * 0.18, h * 0.28);
      ctx.fillRect(w * 0.04, -h * 0.28, w * 0.18, h * 0.28);
      ctx.strokeStyle = hit ? "#f0d0c8" : z.body;
      ctx.lineWidth = Math.max(2, w * 0.12);
      const reach = Math.sin(z.walk) * w * 0.25;
      ctx.beginPath();
      ctx.moveTo(-w * 0.35, -h * 0.62);
      ctx.lineTo(-w * 0.85, -h * 0.35 + reach);
      ctx.moveTo(w * 0.35, -h * 0.62);
      ctx.lineTo(w * 0.9, -h * 0.32 - reach);
      ctx.stroke();
      ctx.fillStyle = hit ? "#fff" : "#2a3328";
      ctx.beginPath(); ctx.arc(0, -h * 0.82, w * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = z.eye;
      ctx.beginPath(); ctx.arc(-w * 0.1, -h * 0.84, w * 0.07, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.1, -h * 0.84, w * 0.07, 0, TAU); ctx.fill();
      if (z.hp < z.max) {
        ctx.fillStyle = "#000"; ctx.fillRect(-w * 0.4, -h * 1.05, w * 0.8, 4);
        ctx.fillStyle = "#c94a4a"; ctx.fillRect(-w * 0.4, -h * 1.05, w * 0.8 * (z.hp / z.max), 4);
      }
      ctx.restore();
    }, z.scale);
  }

  function drawItemSprite(u) {
    const color = u.kind === "health" ? "#c94a4a" : u.kind === "weapon" ? "#e8b86d" : u.kind === "stam" ? "#8fbf8a" : "#6aa0c8";
    drawSprite(u.x, u.y, (cx, feet, size) => {
      const s = size * 0.18;
      ctx.save();
      ctx.translate(cx, feet - s * 0.6 - Math.sin(u.t * 4) * s * 0.15);
      ctx.rotate(u.t);
      ctx.fillStyle = color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }, 0.35);
  }

  function drawProp(pr) {
    drawSprite(pr.x, pr.y, (cx, feet, size) => {
      if (pr.kind === "lamp") {
        const h = size * 0.7;
        ctx.fillStyle = "#2a2a28";
        ctx.fillRect(cx - 3, feet - h, 6, h);
        ctx.fillStyle = "#e8c878";
        ctx.beginPath(); ctx.arc(cx, feet - h, 8, 0, TAU); ctx.fill();
      } else {
        const h = size * 0.22;
        ctx.fillStyle = "#5a3a28";
        ctx.fillRect(cx - h * 0.35, feet - h, h * 0.7, h);
        ctx.fillStyle = "#c45a18";
        ctx.beginPath(); ctx.arc(cx, feet - h, h * 0.22, 0, TAU); ctx.fill();
      }
    }, pr.kind === "lamp" ? 0.85 : 0.4);
  }

  function drawCorpse(c) {
    drawSprite(c.x, c.y, (cx, feet, size) => {
      ctx.globalAlpha = clamp(c.t / 5, 0, 0.7);
      ctx.fillStyle = "#4a1010";
      ctx.beginPath();
      ctx.ellipse(cx, feet - 6, size * 0.28, size * 0.08, 0.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }, 0.5);
  }

  function drawSpit(s) {
    drawSprite(s.x, s.y, (cx, feet, size) => {
      ctx.fillStyle = "#b6ff44";
      ctx.beginPath(); ctx.arc(cx, feet - size * 0.2, Math.max(4, size * 0.08), 0, TAU); ctx.fill();
    }, 0.3);
  }

  function drawWorldSprites() {
    const p = G.player;
    const items = [];
    for (const c of G.corpses) items.push({ d: hypot(c.x, c.y, p.x, p.y), draw: () => drawCorpse(c) });
    for (const pr of G.props) items.push({ d: hypot(pr.x, pr.y, p.x, p.y), draw: () => drawProp(pr) });
    for (const u of G.pickups) items.push({ d: hypot(u.x, u.y, p.x, p.y), draw: () => drawItemSprite(u) });
    for (const z of G.zombies) items.push({ d: hypot(z.x, z.y, p.x, p.y), draw: () => drawZombieSprite(z) });
    for (const s of G.spit) items.push({ d: hypot(s.x, s.y, p.x, p.y), draw: () => drawSpit(s) });
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.draw();
  }

  function drawWeapon() {
    if (state === "menu") return;
    const p = G.player;
    if (!p) return;
    const w = WEAPONS[p.wep];
    const walk = Math.sin(bob) * 10;
    const ox = W * 0.62 + walk;
    const oy = H * 0.78 + kick + Math.abs(Math.cos(bob)) * 8 + (p.reloading > 0 ? 40 : 0);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(Math.min(W, H) / 700, Math.min(W, H) / 700);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(10, 90, 70, 18, 0, 0, TAU); ctx.fill();
    if (w.id === "pistol") {
      ctx.fillStyle = "#2a2a28"; ctx.fillRect(-8, -12, 92, 22);
      ctx.fillStyle = "#1a1a18"; ctx.fillRect(70, -8, 48, 12);
      ctx.fillStyle = "#3a3028"; ctx.fillRect(-18, 8, 28, 46);
    } else if (w.id === "shotgun") {
      ctx.fillStyle = "#3a2a20"; ctx.fillRect(-20, -16, 150, 28);
      ctx.fillStyle = "#1c1c1a"; ctx.fillRect(110, -10, 70, 14);
      ctx.fillStyle = "#4a3828"; ctx.fillRect(-30, 10, 36, 50);
    } else if (w.id === "smg") {
      ctx.fillStyle = "#2c2c2a"; ctx.fillRect(-12, -14, 110, 20);
      ctx.fillStyle = "#1a1a18"; ctx.fillRect(80, -10, 60, 10);
      ctx.fillStyle = "#333"; ctx.fillRect(10, 8, 18, 40);
      ctx.fillStyle = "#3a3028"; ctx.fillRect(-20, 6, 26, 48);
    } else {
      ctx.fillStyle = "#2a2e28"; ctx.fillRect(-16, -14, 170, 18);
      ctx.fillStyle = "#111"; ctx.fillRect(140, -10, 90, 10);
      ctx.fillStyle = "#3a342c"; ctx.fillRect(-24, 4, 28, 52);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,220,140,${flash * 10})`;
      ctx.beginPath(); ctx.arc(w.id === "rifle" ? 230 : w.id === "shotgun" ? 190 : 130, -2, 28, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawMinimap() {
    if (state !== "play" && state !== "pause") return;
    const s = 3, mw = MAP * s, mh = MAP * s;
    const x = W - mw - 18, y = H - mh - 18;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 4, y - 4, mw + 8, mh + 8);
    for (let gy = 0; gy < MAP; gy++) {
      for (let gx = 0; gx < MAP; gx++) {
        if (G.grid[gy * MAP + gx]) {
          ctx.fillStyle = "#3a3830";
          ctx.fillRect(x + gx * s, y + gy * s, s, s);
        }
      }
    }
    ctx.fillStyle = "#c94a4a";
    for (const z of G.zombies) ctx.fillRect(x + z.x * s - 1, y + z.y * s - 1, 3, 3);
    const p = G.player;
    ctx.fillStyle = "#e8b86d";
    ctx.beginPath(); ctx.arc(x + p.x * s, y + p.y * s, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#e8b86d";
    ctx.beginPath();
    ctx.moveTo(x + p.x * s, y + p.y * s);
    ctx.lineTo(x + p.x * s + Math.cos(p.yaw) * 8, y + p.y * s + Math.sin(p.yaw) * 8);
    ctx.stroke();
  }

  function bindTouch() {
    const movePad = $("move-pad"), firePad = $("fire-pad"), touchUI = $("touch");
    if (!movePad || !firePad || !touchUI) return;
    if ((window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || "ontouchstart" in window) {
      touchUI.classList.remove("hidden");
    }
    function vec(el, ev) {
      const t = ev.changedTouches ? ev.changedTouches[0] : ev;
      const r = el.getBoundingClientRect();
      return {
        x: clamp((t.clientX - (r.left + r.width / 2)) / (r.width * 0.5), -1, 1),
        y: clamp((t.clientY - (r.top + r.height / 2)) / (r.height * 0.5), -1, 1),
      };
    }
    movePad.addEventListener("touchstart", (e) => { e.preventDefault(); const v = vec(movePad, e); stick.x = v.x; stick.y = v.y; }, { passive: false });
    movePad.addEventListener("touchmove", (e) => { e.preventDefault(); const v = vec(movePad, e); stick.x = v.x; stick.y = v.y; }, { passive: false });
    movePad.addEventListener("touchend", (e) => { e.preventDefault(); stick.x = 0; stick.y = 0; }, { passive: false });
    firePad.addEventListener("touchstart", (e) => { e.preventDefault(); mouseDown = true; lookStick = vec(firePad, e).x; }, { passive: false });
    firePad.addEventListener("touchmove", (e) => { e.preventDefault(); lookStick = vec(firePad, e).x; }, { passive: false });
    firePad.addEventListener("touchend", (e) => { e.preventDefault(); mouseDown = false; lookStick = 0; }, { passive: false });
  }

  function ensureMenuWorld() {
    if (G.player) return;
    G.rng = Math.random;
    generateMap();
    spawnPlayer();
    G.player.yaw = 0.4;
    for (let i = 0; i < 10; i++) {
      const s = emptySpot(8, 8, MAP - 8, MAP - 8);
      spawnZombie(pick(["walker", "runner"]), s.x, s.y);
    }
  }

  function frame(now) {
    try { tick(now); }
    catch (err) { showErr((err && err.message) || String(err)); }
    requestAnimationFrame(frame);
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    shake = Math.max(0, shake - dt * 18);
    hurtFlash = Math.max(0, hurtFlash - dt);
    if (hintT > 0 && state === "play") hintT -= dt;

    if (state === "play") {
      G.time += dt;
      updatePlayer(dt);
      updateZombies(dt);
      updatePickups(dt);
      updateWaves(dt);
      updateUI();
    } else if (state === "pause") {
      updateUI();
    } else if (state === "menu") {
      ensureMenuWorld();
      G.player.yaw += dt * 0.12;
    } else if (state === "dead") {
      updateZombies(dt);
    }

    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    drawSkyFloor();
    drawWalls();
    if (G.player) drawWorldSprites();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawWeapon();
    drawMinimap();
    ctx.fillStyle = "rgba(10, 6, 0, 0.12)";
    ctx.fillRect(0, 0, W, H);
  }

  bindTouch();
  requestAnimationFrame(frame);
})();
