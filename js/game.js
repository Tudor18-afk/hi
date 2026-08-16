import * as THREE from "../vendor/three.module.min.js";
import { GameAudio } from "./audio.js";
import { Net } from "./net.js";
import { HUMAN, loadHumanModels, cloneHuman, findBone, tintHuman, makeHumanMixer, updateHumanAnim } from "./humans.js";

const CFG = {
  world: 64,
  mag: 30,
  reserve: 90,
  rpm: 650,
  reload: 1.55,
  damage: 24,
  headMult: 1.85,
  gravity: 24,
  jump: 8.4,
  walk: 7.1,
  sprint: 10.4,
  botWalk: 5.6,
  radius: 0.38,
  respawn: 2.5,
  roundTime: 300,
  shopTime: 25,
  killCredit: 100,
  killAmmo: 40,
  headBonus: 50,
  startCredit: 200,
  netHz: 30,
};

const WEAPONS = {
  rifle: {
    id: "rifle",
    name: "AR-15 Carbine",
    key: "1",
    price: 0,
    dmg: 28,
    rpm: 620,
    mag: 30,
    reserve: 90,
    reload: 1.85,
    spread: 0.012,
    adsSpread: 0.0032,
    recoil: 0.018,
    bloom: 0.005,
    pellets: 1,
    auto: true,
    adsFov: 48,
  },
  smg: {
    id: "smg",
    name: "MP5 SMG",
    key: "2",
    price: 400,
    dmg: 18,
    rpm: 900,
    mag: 30,
    reserve: 90,
    reload: 1.55,
    spread: 0.022,
    adsSpread: 0.007,
    recoil: 0.012,
    bloom: 0.004,
    pellets: 1,
    auto: true,
    adsFov: 54,
  },
  shotgun: {
    id: "shotgun",
    name: "M4 Super 90",
    key: "3",
    price: 650,
    dmg: 16,
    rpm: 90,
    mag: 8,
    reserve: 24,
    reload: 2.6,
    spread: 0.055,
    adsSpread: 0.028,
    recoil: 0.055,
    bloom: 0.02,
    pellets: 8,
    auto: false,
    adsFov: 58,
  },
  sniper: {
    id: "sniper",
    name: "M24 DMR",
    key: "4",
    price: 900,
    dmg: 92,
    rpm: 48,
    mag: 5,
    reserve: 15,
    reload: 2.8,
    spread: 0.008,
    adsSpread: 0.00035,
    recoil: 0.04,
    bloom: 0.012,
    pellets: 1,
    auto: false,
    adsFov: 16,
  },
};

const WEAPON_ORDER = ["rifle", "smg", "shotgun", "sniper"];

const OPERATORS = [
  { name: "RAZOR", color: 0xc23b3b },
  { name: "VEX", color: 0x7a3dff },
  { name: "NOMAD", color: 0x2ea44f },
  { name: "ECHO", color: 0x2e8bc9 },
  { name: "HEX", color: 0xd4a017 },
  { name: "JINX", color: 0xe056a0 },
  { name: "ONYX", color: 0x8892a0 },
  { name: "WRAITH", color: 0x4dd4c0 },
];

const ARCHETYPES = [
  { id: "rusher", speed: 1.18, acc: 0.72, range: 11, agr: 0.92, react: 0.16, fov: 2.2 },
  { id: "soldier", speed: 1.0, acc: 1.0, range: 20, agr: 0.58, react: 0.26, fov: 1.9 },
  { id: "sniper", speed: 0.86, acc: 1.4, range: 34, agr: 0.22, react: 0.38, fov: 1.6 },
  { id: "lurker", speed: 0.92, acc: 1.12, range: 16, agr: 0.28, react: 0.3, fov: 2.0 },
];

const DIFFICULTY = {
  easy: { id: "easy", name: "EASY", acc: 0.55, react: 1.75, speed: 0.82, hp: 70, dmg: 0.72, spread: 1.85 },
  normal: { id: "normal", name: "NORMAL", acc: 1, react: 1, speed: 1, hp: 100, dmg: 1, spread: 1 },
  hard: { id: "hard", name: "HARD", acc: 1.35, react: 0.52, speed: 1.12, hp: 130, dmg: 1.22, spread: 0.62 },
  insane: { id: "insane", name: "INSANE", acc: 1.75, react: 0.25, speed: 1.25, hp: 160, dmg: 1.45, spread: 0.38 },
};

const MAPS = {
  warehouse: { id: "warehouse", name: "SUNSET RANGE" },
  yard: { id: "yard", name: "PINE RIDGE" },
  labs: { id: "labs", name: "HARBOR QUAY" },
};

const MODES = {
  ffa: { id: "ffa", name: "FREE FOR ALL", teams: false, short: "FFA" },
  tdm: { id: "tdm", name: "TEAM DEATHMATCH", teams: true, short: "TDM" },
  ctf: { id: "ctf", name: "CAPTURE THE FLAG", teams: true, short: "CTF" },
  koth: { id: "koth", name: "KING OF THE HILL", teams: true, short: "HILL" },
};

const TEAMS = [
  { id: 0, name: "ALPHA", color: 0x3ec4ff },
  { id: 1, name: "BRAVO", color: 0xff6a3d },
];

const XHAIR_DEFAULT = {
  style: "default",
  color: "#f4fbff",
  size: 28,
  gap: 4,
  thick: 2,
  len: 8,
  opacity: 1,
  center: true,
  outline: true,
};

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

const SKINS = [0xf6d5b8, 0xe8c4a0, 0xd4a07a, 0xc48a5c, 0xa0673c, 0x7a4a28, 0x5a3218, 0x3e2414];
const HAIR_STYLES = ["bald", "buzz", "short", "long", "mohawk", "pony"];
const HAIR_COLORS = [0x140e0a, 0x2a1a12, 0x5a3a22, 0xc4a05a, 0x8a2818, 0x4a4a4c, 0xe8e0d4];
const SHIRTS = [0x3d4a38, 0x2a3848, 0x4a3428, 0x1c1d20, 0x5a2424, 0xd0c8bc, 0x2e4a3c, 0x3a3a5a];
const PANTS = [0x2a2e32, 0x3a342c, 0x1a1c20, 0x3a3a48, 0x4a4034, 0x243028];
const HELMETS = ["none", "cap", "tactical"];
const BEARDS = ["none", "stubble", "full"];

const LOOK_DEFAULT = {
  skin: 0xe8c4a0,
  hair: "short",
  hairColor: 0x2a1a12,
  shirt: 0x3d4a38,
  pants: 0x2a2e32,
  vest: true,
  helmet: "none",
  beard: "none",
  iris: 0x3a5a38,
};

function sanitizeLook(raw) {
  const d = LOOK_DEFAULT;
  const o = raw && typeof raw === "object" ? raw : {};
  const num = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n >>> 0 : fb;
  };
  return {
    skin: num(o.skin, d.skin),
    hair: HAIR_STYLES.includes(o.hair) ? o.hair : d.hair,
    hairColor: num(o.hairColor, d.hairColor),
    shirt: num(o.shirt, d.shirt),
    pants: num(o.pants, d.pants),
    vest: !(o.vest === false || o.vest === 0),
    helmet: HELMETS.includes(o.helmet) ? o.helmet : d.helmet,
    beard: BEARDS.includes(o.beard) ? o.beard : d.beard,
    iris: num(o.iris, d.iris),
  };
}

function lookKey(l) {
  const x = sanitizeLook(l);
  return [x.skin, x.hair, x.hairColor, x.shirt, x.pants, x.vest ? 1 : 0, x.helmet, x.beard, x.iris].join(".");
}

function randomLook(seedColor) {
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  return sanitizeLook({
    skin: pick(SKINS),
    hair: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    shirt: seedColor || pick(SHIRTS),
    pants: pick(PANTS),
    vest: Math.random() < 0.6,
    helmet: pick(HELMETS),
    beard: pick(BEARDS),
    iris: pick([0x3a5a38, 0x3a4a6a, 0x5a3a22, 0x2a2a2a]),
  });
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return m + ":" + String(s % 60).padStart(2, "0");
}

function lerpAng(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function yawTo(px, pz, tx, tz) {
  return Math.atan2(-(tx - px), -(tz - pz));
}

function rayAABB(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0;
  let tmax = maxT;
  const min = [b.min.x, b.min.y, b.min.z];
  const max = [b.max.x, b.max.y, b.max.z];
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
    } else {
      let t1 = (min[i] - o[i]) / d[i];
      let t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const ex = ox - cx;
  const ey = oy - cy;
  const ez = oz - cz;
  const b = ex * dx + ey * dy + ez * dz;
  const c = ex * ex + ey * ey + ez * ez - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0.04 || t > maxT) return null;
  return t;
}

function makeTex(draw, repeat = 1, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * hash2(x * f, y * f);
    f *= 2.05;
    a *= 0.5;
  }
  return v;
}

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = (ar + (br - ar) * t) | 0;
  const g = (ag + (bg - ag) * t) | 0;
  const bl = (ab + (bb - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}

function noiseFill(g, size, c0, c1, scale) {
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * scale, y * scale);
      const hex = mixHex(c0, c1, n);
      const i = (y * size + x) * 4;
      d[i] = (hex >> 16) & 255;
      d[i + 1] = (hex >> 8) & 255;
      d[i + 2] = hex & 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function grassTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0x2a5418, 0x6a9a38, 0.035);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() < 0.5 ? "#4e7c28" : "#8bb84a";
      g.fillRect((Math.random() * size) | 0, (Math.random() * size) | 0, 2, 5);
    }
    g.globalAlpha = 1;
  }, 10, 256);
}

function sandTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0xc49a58, 0xf0d8a0, 0.028);
    g.globalAlpha = 0.4;
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? "#e8c878" : "#a87840";
      g.beginPath();
      g.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }, 8, 256);
}

function dockTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0x5a6168, 0x8a9298, 0.02);
    g.strokeStyle = "rgba(40,44,48,0.55)";
    g.lineWidth = 6;
    for (let i = 0; i <= size; i += 48) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, size);
      g.stroke();
    }
    g.fillStyle = "rgba(20,22,24,0.35)";
    for (let y = 16; y < size; y += 48) {
      for (let x = 18; x < size; x += 48) g.fillRect(x, y, 4, 4);
    }
  }, 6, 256);
}

function rockTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0x5a5048, 0xc4b8a4, 0.045);
    g.strokeStyle = "rgba(40,36,32,0.28)";
    g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.moveTo(Math.random() * size, Math.random() * size);
      g.quadraticCurveTo(Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size);
      g.stroke();
    }
  }, 3, 256);
}

function barkTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0x3a2414, 0x8a5a32, 0.05);
    g.strokeStyle = "rgba(20,12,8,0.45)";
    g.lineWidth = 3;
    for (let x = 8; x < size; x += 18) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + Math.sin(x) * 6, size);
      g.stroke();
    }
  }, 2, 256);
}

function crateTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0x4a341c, 0x8a6840, 0.04);
    g.strokeStyle = "#2a1c10";
    g.lineWidth = 14;
    g.strokeRect(18, 18, size - 36, size - 36);
    g.beginPath();
    g.moveTo(36, 36);
    g.lineTo(size - 36, size - 36);
    g.moveTo(size - 36, 36);
    g.lineTo(36, size - 36);
    g.stroke();
    g.strokeStyle = "#d4b070";
    g.lineWidth = 4;
    g.strokeRect(26, 26, size - 52, size - 52);
  }, 1);
}

function cloudTex() {
  return makeTex((g, size) => {
    g.clearRect(0, 0, size, size);
    for (let i = 0; i < 18; i++) {
      const x = size * (0.2 + Math.random() * 0.6);
      const y = size * (0.35 + Math.random() * 0.3);
      const r = 28 + Math.random() * 55;
      const grd = g.createRadialGradient(x, y, 4, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.85)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }, 1, 256);
}

function waterTex() {
  return makeTex((g, size) => {
    noiseFill(g, size, 0x1a4a68, 0x4aa0c8, 0.04);
    g.globalAlpha = 0.25;
    g.strokeStyle = "#c8e8ff";
    g.lineWidth = 2;
    for (let y = 20; y < size; y += 28) {
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + y) * 6);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, 4, 256);
}

function makeSkyMat(zenith, horizon, sunCol) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(zenith) },
      bot: { value: new THREE.Color(horizon) },
      sunDir: { value: new THREE.Vector3(0.42, 0.82, 0.28).normalize() },
      sunCol: { value: new THREE.Color(sunCol) },
    },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vN;
      uniform vec3 top;
      uniform vec3 bot;
      uniform vec3 sunDir;
      uniform vec3 sunCol;
      void main() {
        vec3 n = normalize(vN);
        float h = clamp(n.y * 0.55 + 0.45, 0.0, 1.0);
        vec3 col = mix(bot, top, pow(h, 0.72));
        float d = max(0.0, dot(n, sunDir));
        col += sunCol * pow(d, 220.0) * 1.6;
        col += sunCol * pow(d, 10.0) * 0.22;
        col += vec3(1.0, 0.92, 0.78) * pow(d, 4.0) * 0.08;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function rockGeo(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  let n = seed || 17;
  const rnd = () => (n = (n * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.16 + rnd() * 0.22;
    pos.setXYZ(
      i,
      pos.getX(i) * (1 + (rnd() - 0.5) * k),
      pos.getY(i) * (1 + (rnd() - 0.5) * k * 0.65),
      pos.getZ(i) * (1 + (rnd() - 0.5) * k)
    );
  }
  geo.computeVertexNormals();
  return geo;
}

class NavGrid {
  constructor(size, cell, colliders) {
    this.cell = cell;
    this.n = Math.floor(size / cell);
    this.origin = -size / 2;
    this.walk = new Uint8Array(this.n * this.n);
    const pad = 0.75;
    const limit = size / 2 - 1.4;
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const x = this.origin + (i + 0.5) * cell;
        const z = this.origin + (j + 0.5) * cell;
        let ok = Math.abs(x) < limit && Math.abs(z) < limit ? 1 : 0;
        if (ok) {
          for (const b of colliders) {
            if (
              x > b.min.x - pad &&
              x < b.max.x + pad &&
              z > b.min.z - pad &&
              z < b.max.z + pad &&
              b.max.y > 0.55
            ) {
              ok = 0;
              break;
            }
          }
        }
        this.walk[j * this.n + i] = ok;
      }
    }
  }

  key(i, j) {
    return j * this.n + i;
  }

  inb(i, j) {
    return i >= 0 && j >= 0 && i < this.n && j < this.n;
  }

  walkable(i, j) {
    return this.inb(i, j) && this.walk[this.key(i, j)];
  }

  cellAt(x, z) {
    return [
      Math.floor((x - this.origin) / this.cell),
      Math.floor((z - this.origin) / this.cell),
    ];
  }

  world(i, j) {
    return {
      x: this.origin + (i + 0.5) * this.cell,
      z: this.origin + (j + 0.5) * this.cell,
    };
  }

  nearest(x, z) {
    let [i, j] = this.cellAt(x, z);
    if (this.walkable(i, j)) return [i, j];
    for (let r = 1; r <= 10; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (this.walkable(i + di, j + dj)) return [i + di, j + dj];
        }
      }
    }
    return [clamp(i, 0, this.n - 1), clamp(j, 0, this.n - 1)];
  }

  randomWalkable() {
    for (let n = 0; n < 40; n++) {
      const i = (Math.random() * this.n) | 0;
      const j = (Math.random() * this.n) | 0;
      if (this.walkable(i, j)) return this.world(i, j);
    }
    return { x: 0, z: 0 };
  }

  path(x0, z0, x1, z1) {
    const start = this.nearest(x0, z0);
    const goal = this.nearest(x1, z1);
    const n = this.n;
    const came = new Int32Array(n * n).fill(-1);
    const gScore = new Float32Array(n * n).fill(1e9);
    const fScore = new Float32Array(n * n).fill(1e9);
    const inOpen = new Uint8Array(n * n);
    const open = [start];
    const sk = this.key(start[0], start[1]);
    gScore[sk] = 0;
    fScore[sk] = Math.hypot(goal[0] - start[0], goal[1] - start[1]);
    inOpen[sk] = 1;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let found = false;
    let steps = 0;
    while (open.length && steps++ < 1400) {
      let bi = 0;
      let bf = 1e9;
      for (let k = 0; k < open.length; k++) {
        const f = fScore[this.key(open[k][0], open[k][1])];
        if (f < bf) {
          bf = f;
          bi = k;
        }
      }
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      const ck = this.key(cur[0], cur[1]);
      inOpen[ck] = 0;
      if (cur[0] === goal[0] && cur[1] === goal[1]) {
        found = true;
        break;
      }
      for (const [di, dj] of dirs) {
        const ni = cur[0] + di;
        const nj = cur[1] + dj;
        if (!this.walkable(ni, nj)) continue;
        if (di && dj && (!this.walkable(cur[0] + di, cur[1]) || !this.walkable(cur[0], cur[1] + dj))) {
          continue;
        }
        const nk = this.key(ni, nj);
        const tent = gScore[ck] + Math.hypot(di, dj);
        if (tent < gScore[nk]) {
          came[nk] = ck;
          gScore[nk] = tent;
          fScore[nk] = tent + Math.hypot(goal[0] - ni, goal[1] - nj);
          if (!inOpen[nk]) {
            open.push([ni, nj]);
            inOpen[nk] = 1;
          }
        }
      }
    }
    const pts = [];
    if (found) {
      let k = this.key(goal[0], goal[1]);
      while (k !== sk && k !== -1) {
        const j = Math.floor(k / n);
        const i = k - j * n;
        pts.push(this.world(i, j));
        k = came[k];
      }
      pts.reverse();
    }
    pts.push({ x: x1, z: z1 });
    return pts;
  }
}

function addCollider(colliders, cx, cy, cz, w, h, d) {
  const box = {
    min: new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    max: new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
  };
  colliders.push(box);
  return box;
}

function makeBoxMesh(cx, cy, cz, w, h, d, mat, scene, shadows = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(cx, cy, cz);
  if (shadows) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  scene.add(mesh);
  return mesh;
}

function makeSkyEnv(renderer, theme) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(12, 20, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(theme.skyTop) },
        bot: { value: new THREE.Color(theme.skyBot) },
      },
      vertexShader:
        "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:
        "varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h=normalize(vP).y; gl_FragColor=vec4(mix(bot,top,smoothstep(-0.25,1.0,h)),1.0); }",
    })
  );
  s.add(sky);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 12, 8),
    new THREE.MeshBasicMaterial({ color: theme.sun || 0xfff2c8 })
  );
  sun.position.set(5.2, 8.4, 3.2);
  s.add(sun);
  const rt = pmrem.fromScene(s, 0.03);
  pmrem.dispose();
  return rt.texture;
}

function buildWorld(scene, mapId, renderer) {
  const colliders = [];
  const cover = [];
  const spawns = [];
  const root = new THREE.Group();
  scene.add(root);

  const S = CFG.world / 2;
  const H = 4.4;
  const rtex = rockTex();
  const btex = barkTex();
  const ctex = crateTex();
  const wtex = waterTex();
  const cld = cloudTex();
  const geos = [rockGeo(19), rockGeo(41), rockGeo(73)];

  const themes = {
    warehouse: {
      fog: 0xc8dcf0,
      skyTop: 0x4aa4e8,
      skyBot: 0xf2d2a8,
      floor: 0xf0d09a,
      ground: sandTex(),
      hemi: [0xfff4dc, 0xc4a070, 1.55],
      sun: 0xffe6b8,
      sunI: 2.55,
      beyond: 0xd4b078,
    },
    yard: {
      fog: 0xc8e0c8,
      skyTop: 0x5ab0f0,
      skyBot: 0xd8ecff,
      floor: 0xb8d070,
      ground: grassTex(),
      hemi: [0xe8ffe0, 0x6a8040, 1.6],
      sun: 0xfff6e8,
      sunI: 2.4,
      beyond: 0x6a8a40,
    },
    labs: {
      fog: 0xb8d0e0,
      skyTop: 0x6ab4f0,
      skyBot: 0xd0e4f4,
      floor: 0xc8cdd4,
      ground: dockTex(),
      hemi: [0xe8f4ff, 0x8898a8, 1.5],
      sun: 0xfff2e0,
      sunI: 2.35,
      beyond: 0x3a6a88,
    },
  };
  const theme = themes[mapId] || themes.warehouse;

  const beyond = new THREE.Mesh(
    new THREE.CircleGeometry(95, 28),
    new THREE.MeshStandardMaterial({ color: theme.beyond, roughness: 1, metalness: 0 })
  );
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.y = -0.08;
  beyond.receiveShadow = true;
  root.add(beyond);

  if (mapId === "labs") {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(92, 24),
      new THREE.MeshStandardMaterial({
        map: wtex,
        color: 0x4a90b8,
        roughness: 0.18,
        metalness: 0.35,
        transparent: true,
        opacity: 0.92,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.22;
    root.add(water);
    root.userData.water = wtex;
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.world + 6, CFG.world + 6, 1, 1),
    new THREE.MeshStandardMaterial({ map: theme.ground, roughness: 0.92, metalness: 0.03, color: theme.floor })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16), makeSkyMat(theme.skyTop, theme.skyBot, 0xfff0c8));
  root.add(sky);

  const sunOrb = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false })
  );
  sunOrb.position.set(48, 62, 28);
  root.add(sunOrb);

  const cloudMat = new THREE.MeshBasicMaterial({
    map: cld,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const cloudGeo = new THREE.PlaneGeometry(28, 14);
  const cloudSpots = [
    [-40, 42, -30],
    [36, 48, 18],
    [8, 52, -48],
    [-22, 46, 40],
    [52, 44, -12],
    [-55, 50, 8],
  ];
  for (const [x, y, z] of cloudSpots) {
    const cl = new THREE.Mesh(cloudGeo, cloudMat);
    cl.position.set(x, y, z);
    cl.lookAt(0, y - 8, 0);
    root.add(cl);
  }

  const rockMat = new THREE.MeshStandardMaterial({ map: rtex, color: 0xc8b89a, roughness: 0.9, metalness: 0.04 });
  const rockMatB = new THREE.MeshStandardMaterial({ map: rtex, color: 0x9a8a78, roughness: 0.94, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ map: rtex, color: 0xb0a090, roughness: 0.88, metalness: 0.06 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x5ce1ff,
    emissive: 0x5ce1ff,
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });
  const amberMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xffb347,
    emissiveIntensity: 0.75,
    roughness: 0.4,
  });
  const crateMat = new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.72, metalness: 0.06 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.42, metalness: 0.55 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x8a4030, roughness: 0.7, metalness: 0.25 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a8a32, roughness: 0.78, metalness: 0.02 });
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x1e5a22, roughness: 0.82, metalness: 0.02 });
  const trunkMat = new THREE.MeshStandardMaterial({ map: btex, color: 0x8a5a32, roughness: 0.9, metalness: 0.02 });

  const walls = [
    [0, H / 2, -S - 0.9, CFG.world + 3.6, H, 1.8],
    [0, H / 2, S + 0.9, CFG.world + 3.6, H, 1.8],
    [-S - 0.9, H / 2, 0, 1.8, H, CFG.world],
    [S + 0.9, H / 2, 0, 1.8, H, CFG.world],
  ];
  for (const [x, y, z, w, h, d] of walls) {
    addCollider(colliders, x, y, z, w, h, d);
    const mesh = makeBoxMesh(x, y, z, w, h, d, wallMat, root);
    mesh.castShadow = true;
  }

  function placeRock(x, y, z, sx, sy, sz, mat) {
    const m = new THREE.Mesh(geos[(Math.abs((x * 3 + z) | 0)) % geos.length], mat || rockMat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(x * 0.2, z * 0.13, x * 0.05);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }

  const rim = [
    [-28, -18],
    [-30, 0],
    [-28, 18],
    [-18, -30],
    [0, -31],
    [18, -30],
    [28, -18],
    [30, 0],
    [28, 18],
    [18, 30],
    [0, 31],
    [-18, 30],
  ];
  for (const [x, z] of rim) {
    placeRock(x, 1.1, z, 2.4 + (Math.abs(x) % 5) * 0.15, 2.2, 2.1, rockMatB);
  }

  const peaks = [
    [-78, 10, -40],
    [-70, 16, 30],
    [74, 14, -36],
    [68, 18, 42],
    [-20, 12, -82],
    [24, 15, 80],
    [-88, 8, 8],
    [90, 11, -8],
  ];
  const peakMat = new THREE.MeshStandardMaterial({ map: rtex, color: 0x8a8074, roughness: 1, metalness: 0 });
  for (const [x, y, z] of peaks) {
    const m = new THREE.Mesh(geos[0], peakMat);
    m.position.set(x, y * 0.4, z);
    m.scale.set(18 + Math.abs(x) * 0.04, 10 + y, 16);
    m.rotation.y = x * 0.01;
    root.add(m);
  }

  function prop(x, z, w, d, h, mat, isCover) {
    addCollider(colliders, x, h / 2, z, w, h, d);
    root.add(makeBoxMesh(x, h / 2, z, w, h, d, mat, root));
    if (isCover) {
      cover.push(new THREE.Vector3(x + w / 2 + 1.0, 0, z));
      cover.push(new THREE.Vector3(x - w / 2 - 1.0, 0, z));
      cover.push(new THREE.Vector3(x, 0, z + d / 2 + 1.0));
      cover.push(new THREE.Vector3(x, 0, z - d / 2 - 1.0));
    }
  }

  function tree(x, z, scale = 1) {
    addCollider(colliders, x, 1.1 * scale, z, 0.75 * scale, 2.2 * scale, 0.75 * scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.4 * scale, 7), trunkMat);
    trunk.position.set(x, 1.2 * scale, z);
    trunk.castShadow = true;
    root.add(trunk);
    const sizes = [
      [1.7, 2.6, 2.6],
      [1.35, 2.2, 4.2],
      [0.95, 1.7, 5.5],
    ];
    sizes.forEach(([r, h, y], i) => {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r * scale, h * scale, 8), i === 2 ? leafMatB : leafMat);
      leaf.position.set(x, y * scale, z);
      leaf.castShadow = true;
      root.add(leaf);
    });
    cover.push(new THREE.Vector3(x + 1.8, 0, z));
    cover.push(new THREE.Vector3(x - 1.8, 0, z));
  }

  function crateStack(x, z) {
    prop(x, z, 2.2, 2.2, 1.4, crateMat, true);
    const top = makeBoxMesh(x + 0.15, 1.85, z - 0.1, 1.6, 1.1, 1.6, crateMat, root);
    top.rotation.y = 0.18;
  }

  if (mapId === "yard") {
    tree(-22, -18, 1.05);
    tree(22, 18, 1.15);
    tree(-20, 20, 0.92);
    tree(20, -20, 1.08);
    tree(-8, -24, 0.85);
    tree(8, 24, 1);
    tree(-24, 6, 1.2);
    tree(24, -6, 0.9);
    tree(-12, 8, 0.7);
    tree(12, -8, 0.78);
    prop(-14, -10, 4.2, 2.2, 1.2, trunkMat, true);
    prop(14, 10, 4.2, 2.2, 1.2, trunkMat, true);
    crateStack(-10, 12);
    crateStack(10, -12);
    prop(0, -18, 8, 2.2, 1.6, rockMat, true);
    prop(0, 18, 8, 2.2, 1.6, rockMat, true);
    prop(-16, 0, 2.2, 6, 1.4, rockMat, true);
    prop(16, 0, 2.2, 6, 1.4, rockMat, true);
    placeRock(-6, 0.7, -8, 1.6, 1.2, 1.4);
    placeRock(7, 0.55, 9, 1.3, 1, 1.5);
    const tuftGeo = new THREE.ConeGeometry(0.16, 0.38, 5);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x3d7a28, roughness: 1 });
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 70);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 70; i++) {
      dummy.position.set((Math.random() - 0.5) * 50, 0.18, (Math.random() - 0.5) * 50);
      dummy.rotation.y = Math.random() * 6;
      dummy.scale.setScalar(0.7 + Math.random() * 0.8);
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);
    }
    tufts.instanceMatrix.needsUpdate = true;
    root.add(tufts);
  } else if (mapId === "labs") {
    prop(-18, -12, 14, 3.2, 2.6, metalMat, true);
    makeBoxMesh(-18, 2.0, -12, 14.05, 0.35, 3.28, rustMat, root, false);
    prop(18, 12, 14, 3.2, 2.6, metalMat, true);
    makeBoxMesh(
      18,
      2.0,
      12,
      14.05,
      0.35,
      3.28,
      new THREE.MeshStandardMaterial({ color: 0x2e6a9a, roughness: 0.5, metalness: 0.4 }),
      root,
      false
    );
    prop(-12, 16, 3.2, 12, 2.6, metalMat, true);
    prop(12, -16, 3.2, 12, 2.6, metalMat, true);
    crateStack(-8, 4);
    crateStack(8, -5);
    crateStack(-22, 8);
    crateStack(22, -8);
    prop(0, 22, 7, 2.0, 1.5, wallMat, true);
    prop(0, -22, 7, 2.0, 1.5, wallMat, true);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x6a7380, roughness: 0.35, metalness: 0.7 });
    root.add(makeBoxMesh(-26, 5.2, 8, 0.55, 10.4, 0.55, poleMat, root, false));
    root.add(makeBoxMesh(26, 5.2, -8, 0.55, 10.4, 0.55, poleMat, root, false));
    makeBoxMesh(-22, 10.2, 8, 8.5, 0.35, 0.35, poleMat, root, false);
    makeBoxMesh(22, 10.2, -8, 8.5, 0.35, 0.35, poleMat, root, false);
    placeRock(-4, 0.5, 10, 1.2, 0.8, 1.4, rockMatB);
  } else {
    prop(-14, -14, 4.4, 4.4, 2.2, rockMat, true);
    prop(14, -14, 4.4, 4.4, 2.2, rockMat, true);
    prop(-14, 14, 4.4, 4.4, 2.2, rockMat, true);
    prop(14, 14, 4.4, 4.4, 2.2, rockMat, true);
    prop(0, -20, 10, 2.4, 1.6, rockMat, true);
    prop(0, 20, 10, 2.4, 1.6, rockMat, true);
    prop(-20, 0, 2.4, 8, 1.6, rockMat, true);
    prop(20, 0, 2.4, 8, 1.6, rockMat, true);
    crateStack(-8, -6);
    crateStack(8, 6);
    prop(-22, 10, 2.4, 2.4, 1.4, rockMat, true);
    prop(22, -10, 2.4, 2.4, 1.4, rockMat, true);
    tree(-24, -8, 0.82);
    tree(24, 8, 0.9);
    placeRock(-6, 0.8, 4, 1.8, 1.3, 1.6);
    placeRock(5, 0.65, -5, 1.5, 1.1, 1.7);
    placeRock(-10, 0.5, 22, 2.2, 1.4, 1.8, rockMatB);
    placeRock(11, 0.55, -22, 2, 1.3, 1.6, rockMatB);
  }

  const hillRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.2, 0.14, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcc66, emissiveIntensity: 0.9, roughness: 0.45 })
  );
  hillRing.rotation.x = Math.PI / 2;
  hillRing.position.y = 0.08;
  hillRing.visible = false;
  root.add(hillRing);

  const flagA = new THREE.Vector3(-24, 0, 0);
  const flagB = new THREE.Vector3(24, 0, 0);
  const padA = makeBoxMesh(flagA.x, 0.08, flagA.z, 3.2, 0.16, 3.2, trimMat, root, false);
  const padB = makeBoxMesh(flagB.x, 0.08, flagB.z, 3.2, 0.16, 3.2, amberMat, root, false);
  padA.visible = false;
  padB.visible = false;

  const spawnPts = [
    [-26, -22, 0],
    [-26, 22, 0],
    [-26, 0, 0],
    [-22, -26, 0],
    [-22, 26, 0],
    [26, -22, 1],
    [26, 22, 1],
    [26, 0, 1],
    [22, -26, 1],
    [22, 26, 1],
  ];
  for (const [x, z, team] of spawnPts) {
    const v = new THREE.Vector3(x, 0, z);
    v.team = team;
    spawns.push(v);
  }

  root.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], (theme.hemi[2] || 1.5) * 0.7));
  const sun = new THREE.DirectionalLight(theme.sun, (theme.sunI || 2.2) * 0.82);
  sun.position.set(28, 46, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 96;
  sun.shadow.camera.left = -44;
  sun.shadow.camera.right = 44;
  sun.shadow.camera.top = 44;
  sun.shadow.camera.bottom = -44;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  root.add(sun);
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.42);
  fill.position.set(-20, 18, -16);
  root.add(fill);

  scene.background = new THREE.Color(theme.skyBot);
  scene.fog = new THREE.Fog(theme.fog, 38, 148);
  if (renderer) scene.environment = makeSkyEnv(renderer, theme);

  return { colliders, cover, spawns, root, flagA, flagB, padA, padB, hillRing, hill: { x: 0, z: 0, r: 5.2 } };
}

function matSteel(hex, rough = 0.32, metal = 0.82) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: rough,
    metalness: metal,
    envMapIntensity: 1.25,
  });
}

function createWeapon(kind, shadows = true) {
  const g = new THREE.Group();
  const black = matSteel(0x1a1c20, 0.36, 0.78);
  const polymer = matSteel(0x2c3036, 0.64, 0.16);
  const wood = matSteel(0x6a4428, 0.8, 0.06);
  const brass = matSteel(0xb08a4a, 0.34, 0.72);
  const optic = matSteel(0x101214, 0.22, 0.55);
  const steel = matSteel(0x5a626c, 0.28, 0.88);

  if (kind === "smg") {
    g.add(meshBox(0.05, 0.09, 0.36, black, 0, -0.01, -0.1));
    g.add(meshBox(0.048, 0.07, 0.2, polymer, 0, -0.07, -0.04));
    g.add(meshCyl(0.01, 0.011, 0.28, black, 0, 0.0, -0.4));
    g.add(meshCyl(0.016, 0.016, 0.1, polymer, 0, 0.0, -0.56));
    const mag = meshBox(0.036, 0.2, 0.05, polymer, 0, -0.18, -0.02);
    mag.rotation.x = 0.1;
    g.add(mag);
    g.add(meshBox(0.038, 0.048, 0.18, polymer, 0, 0.01, 0.18));
    const grip = meshBox(0.036, 0.12, 0.046, polymer, 0, -0.12, 0.1);
    grip.rotation.x = 0.38;
    g.add(grip);
    g.add(meshBox(0.016, 0.032, 0.036, optic, 0, 0.05, -0.18));
    g.add(meshBox(0.012, 0.024, 0.016, optic, 0, 0.04, -0.28));
  } else if (kind === "shotgun") {
    g.add(meshBox(0.068, 0.086, 0.4, black, 0, -0.01, -0.12));
    g.add(meshCyl(0.016, 0.018, 0.58, steel, 0, 0.012, -0.52));
    g.add(meshCyl(0.012, 0.012, 0.44, black, 0, -0.028, -0.42));
    g.add(meshBox(0.052, 0.052, 0.16, wood, 0, -0.05, -0.32));
    g.add(meshBox(0.052, 0.082, 0.26, wood, 0, -0.015, 0.2));
    const grip = meshBox(0.044, 0.11, 0.048, wood, 0, -0.11, 0.08);
    grip.rotation.x = 0.28;
    g.add(grip);
    g.add(meshSphere(0.008, brass, 0, 0.032, -0.8));
    g.add(meshBox(0.02, 0.03, 0.04, black, 0, 0.04, -0.08));
  } else if (kind === "sniper") {
    g.add(meshBox(0.058, 0.078, 0.46, black, 0, -0.008, -0.14));
    g.add(meshCyl(0.01, 0.012, 0.72, steel, 0, 0.002, -0.66));
    g.add(meshCyl(0.016, 0.014, 0.06, black, 0, 0.002, -1.02));
    g.add(meshBox(0.038, 0.1, 0.068, polymer, 0, -0.09, -0.08));
    g.add(meshBox(0.048, 0.088, 0.28, polymer, 0, -0.01, 0.22));
    g.add(meshBox(0.044, 0.034, 0.12, polymer, 0, 0.048, 0.18));
    const grip = meshBox(0.036, 0.12, 0.044, polymer, 0, -0.11, 0.06);
    grip.rotation.x = 0.32;
    g.add(grip);
    g.add(meshCyl(0.022, 0.026, 0.22, optic, 0, 0.055, -0.18));
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12),
      new THREE.MeshStandardMaterial({
        color: 0x224466,
        roughness: 0.1,
        metalness: 0.45,
        emissive: 0x112233,
        emissiveIntensity: 0.4,
      })
    );
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, 0.055, -0.08);
    g.add(glass);
  } else {
    g.add(meshBox(0.068, 0.108, 0.42, black, 0, -0.02, -0.12));
    g.add(meshBox(0.052, 0.058, 0.18, polymer, 0, -0.068, -0.28));
    g.add(meshCyl(0.011, 0.013, 0.46, steel, 0, 0.0, -0.52));
    g.add(meshCyl(0.016, 0.012, 0.05, black, 0, 0.0, -0.76));
    const mag = meshBox(0.04, 0.18, 0.062, polymer, 0, -0.15, -0.04);
    mag.rotation.x = 0.06;
    g.add(mag);
    g.add(meshBox(0.048, 0.082, 0.22, polymer, 0, -0.008, 0.2));
    const grip = meshBox(0.038, 0.125, 0.046, polymer, 0, -0.13, 0.08);
    grip.rotation.x = 0.38;
    g.add(grip);
    g.add(meshBox(0.028, 0.016, 0.22, black, 0, 0.042, -0.18));
    g.add(meshBox(0.026, 0.038, 0.058, optic, 0, 0.068, -0.22));
    g.add(meshBox(0.012, 0.028, 0.018, optic, 0, 0.038, -0.52));
  }

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = shadows;
    }
  });
  return g;
}

function meshBox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function meshCyl(rt, rb, len, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, 12), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

function meshSphere(r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  m.position.set(x, y, z);
  return m;
}

function makeLabel(text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.font = "700 30px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fillRect(20, 10, 216, 44);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  spr.scale.set(1.7, 0.42, 1);
  spr.position.y = 2.12;
  spr.renderOrder = 2;
  return spr;
}

const _texCache = new Map();

function rgbOf(col) {
  return [(col >> 16) & 255, (col >> 8) & 255, col & 255];
}

function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function skinTex(col) {
  const key = "sk" + col;
  if (_texCache.has(key)) return _texCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const [r, gv, b] = rgbOf(col);
  g.fillStyle = hex(col);
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const n = (Math.random() - 0.35) * 22;
    g.fillStyle = `rgba(${clamp(r + n, 0, 255) | 0},${clamp(gv + n * 0.7, 0, 255) | 0},${clamp(b + n * 0.45, 0, 255) | 0},${0.12 + Math.random() * 0.2})`;
    g.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 1 + (Math.random() * 2) | 0, 1);
  }
  g.fillStyle = "rgba(150,55,45,0.1)";
  g.beginPath();
  g.ellipse(42, 78, 16, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(86, 78, 16, 11, 0, 0, Math.PI * 2);
  g.fill();
  const t = canvasTex(c);
  _texCache.set(key, t);
  return t;
}

function weaveTex() {
  if (_texCache.has("weave")) return _texCache.get("weave");
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#d8d4cc";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 64; i += 2) g.fillRect(0, i, 64, 1);
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 1; i < 64; i += 2) g.fillRect(i, 0, 1, 64);
  const t = canvasTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  _texCache.set("weave", t);
  return t;
}

function matSkin(col) {
  const sheen = new THREE.Color(col).multiplyScalar(0.75);
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: skinTex(col),
    roughness: 0.42,
    metalness: 0.0,
    sheen: 0.45,
    sheenRoughness: 0.48,
    sheenColor: sheen,
    envMapIntensity: 0.85,
  });
}

function matCloth(col, rough = 0.78) {
  return new THREE.MeshStandardMaterial({
    color: col,
    map: weaveTex(),
    roughness: rough,
    metalness: 0.03,
  });
}

function matHair(col) {
  return new THREE.MeshStandardMaterial({ color: col, roughness: 0.58, metalness: 0.06 });
}

function orientUp(mesh, dx, dy, dz) {
  const len = Math.hypot(dx, dy, dz) || 1;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  return mesh;
}

function capsuleBetween(ax, ay, az, bx, by, bz, r, mat, segs = 10) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  const m = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 0.35), 4, segs), mat));
  m.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  orientUp(m, dx, dy, dz);
  return m;
}

function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeEye(irisCol) {
  const g = new THREE.Group();
  const sclera = new THREE.Mesh(
    new THREE.SphereGeometry(0.0165, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.22, metalness: 0.04 })
  );
  const iris = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 12, 10),
    new THREE.MeshStandardMaterial({
      color: irisCol,
      roughness: 0.18,
      metalness: 0.12,
      emissive: irisCol,
      emissiveIntensity: 0.12,
    })
  );
  iris.position.z = -0.01;
  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.0046, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.35 })
  );
  pupil.position.z = -0.016;
  const wet = new THREE.Mesh(
    new THREE.SphereGeometry(0.0172, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.02,
      transparent: true,
      opacity: 0.22,
    })
  );
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  spark.position.set(-0.004, 0.004, -0.018);
  g.add(sclera, iris, pupil, wet, spark);
  return g;
}

function makeHand(skin, scale = 1) {
  const h = new THREE.Group();
  const palm = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.055 * scale, 0.078 * scale, 0.028 * scale), skin));
  h.add(palm);
  for (let i = 0; i < 4; i++) {
    const f = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.007 * scale, 0.038 * scale, 2, 5), skin));
    f.position.set((i - 1.5) * 0.014 * scale, -0.055 * scale, 0);
    h.add(f);
  }
  const thumb = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.008 * scale, 0.028 * scale, 2, 5), skin));
  thumb.position.set(0.034 * scale, -0.01 * scale, 0.008 * scale);
  thumb.rotation.z = 0.85;
  h.add(thumb);
  return h;
}

function makeViewHand(skin, side) {
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.125, 0.058), skin);
  palm.position.y = -0.01;
  h.add(palm);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), skin);
  heel.position.set(0, 0.048, 0.004);
  h.add(heel);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.04, 2, 8), skin);
    p1.position.y = -0.078;
    const p2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.032, 2, 8), skin);
    p2.position.set(0, -0.118, 0.02);
    p2.rotation.x = 1.12;
    const p3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.024, 2, 8), skin);
    p3.position.set(0, -0.128, 0.048);
    p3.rotation.x = 1.55;
    finger.add(p1, p2, p3);
    finger.position.set((i - 1.5) * 0.024, 0.032, 0.012);
    finger.rotation.x = 0.62;
    h.add(finger);
  }
  const thumb = new THREE.Group();
  const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.036, 2, 8), skin);
  t1.rotation.z = side * 1.05;
  const t2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.03, 2, 8), skin);
  t2.position.set(side * 0.032, -0.014, 0.026);
  t2.rotation.set(0.85, 0, side * 0.55);
  thumb.add(t1, t2);
  thumb.position.set(side * 0.056, 0.012, 0.018);
  h.add(thumb);
  return h;
}

const VIEW_GRIP = {
  rifle: {
    rPos: [0.018, -0.15, 0.1],
    rRot: [1.08, 0.32, -1.38],
    lPos: [0.012, -0.058, -0.3],
    lRot: [0.42, 0.08, 1.18],
  },
  smg: {
    rPos: [0.016, -0.145, 0.1],
    rRot: [1.1, 0.3, -1.36],
    lPos: [0.01, -0.05, -0.22],
    lRot: [0.4, 0.06, 1.12],
  },
  shotgun: {
    rPos: [0.02, -0.14, 0.09],
    rRot: [1.02, 0.28, -1.32],
    lPos: [0.008, -0.062, -0.34],
    lRot: [0.38, 0.04, 1.2],
  },
  sniper: {
    rPos: [0.016, -0.14, 0.08],
    rRot: [1.04, 0.3, -1.34],
    lPos: [0.01, -0.05, -0.4],
    lRot: [0.36, 0.05, 1.16],
  },
};

const _armDir = new THREE.Vector3();
const _armUp = new THREE.Vector3(0, 1, 0);
const _handWorld = new THREE.Vector3();

function placeArmSeg(mesh, ax, ay, az, bx, by, bz, restLen) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.04;
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  _armDir.set(dx / len, dy / len, dz / len);
  mesh.quaternion.setFromUnitVectors(_armUp, _armDir);
  mesh.scale.set(1, Math.max(0.12, len / restLen), 1);
}

function createViewArms(look, teamColor) {
  look = sanitizeLook(look);
  const g = new THREE.Group();
  const skin = matSkin(look.skin);
  const sleeveCol = teamColor != null ? teamColor : look.shirt;
  const shirt = matCloth(sleeveCol, 0.7);

  const rHand = makeViewHand(skin, 1);
  const lHand = makeViewHand(skin, -1);
  g.add(rHand, lHand);

  const mkSeg = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), mat);
  const rArm = mkSeg(0.11, 0.42, shirt);
  const rFore = mkSeg(0.086, 0.28, skin);
  const lArm = mkSeg(0.11, 0.42, shirt);
  const lFore = mkSeg(0.086, 0.28, skin);
  g.add(rArm, rFore, lArm, lFore);

  g.userData = {
    leftHand: lHand,
    rightHand: rHand,
    rUpper: rArm,
    rLower: rFore,
    lUpper: lArm,
    lLower: lFore,
  };
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  return g;
}

function addHair(g, look, hairM, hy) {
  if (look.hair === "bald" || look.helmet === "tactical") return;
  const cap = (r, phi, sy, yOff = 0) => {
    const m = addShadow(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12, 0, Math.PI * 2, 0, phi), hairM));
    m.position.y = hy + yOff;
    m.scale.set(1.04, sy, 1.06);
    g.add(m);
    return m;
  };
  if (look.hair === "buzz") cap(0.128, 1.18, 0.7, 0.02);
  else if (look.hair === "short") {
    cap(0.132, 1.38, 0.82, 0.025);
    for (const [x, z] of [
      [-0.06, -0.05],
      [0.06, -0.05],
      [0, 0.07],
      [-0.07, 0.04],
      [0.07, 0.04],
    ]) {
      const t = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), hairM));
      t.position.set(x, hy + 0.04, z);
      t.scale.set(1.1, 0.55, 1);
      g.add(t);
    }
  } else if (look.hair === "long") {
    cap(0.134, 1.42, 0.88, 0.03);
    const fall = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.28, 4, 10), hairM));
    fall.position.set(0, hy - 0.22, 0.06);
    g.add(fall);
    const sideL = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.18, 3, 8), hairM));
    sideL.position.set(-0.08, hy - 0.12, 0.02);
    const sideR = sideL.clone();
    sideR.position.x = 0.08;
    g.add(sideL, sideR);
  } else if (look.hair === "mohawk") {
    cap(0.12, 1.05, 0.55, 0.01);
    for (let i = 0; i < 5; i++) {
      const m = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hairM));
      m.position.set(0, hy + 0.1, -0.08 + i * 0.04);
      m.scale.set(0.7, 1.6, 1);
      g.add(m);
    }
  } else if (look.hair === "pony") {
    cap(0.128, 1.22, 0.72, 0.02);
    const tail = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.26, 4, 8), hairM));
    tail.position.set(0, hy - 0.16, 0.11);
    tail.rotation.x = 0.55;
    g.add(tail);
  }
}

function createProcCharacter(look, name, opts = {}) {
  look = sanitizeLook(look);
  const team = opts.teamColor != null ? opts.teamColor : null;
  const g = new THREE.Group();
  const skin = matSkin(look.skin);
  const shirt = matCloth(look.shirt, 0.72);
  const pants = matCloth(look.pants, 0.8);
  const boot = matCloth(0x1a1c20, 0.68);
  const vestCol = team != null ? team : 0x2a3036;
  const vest = matCloth(vestCol, 0.5);
  vest.metalness = 0.22;
  const hairM = matHair(look.hairColor);
  const dark = matCloth(0x14161a, 0.55);
  const lip = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.skin).offsetHSL(0.02, 0.18, -0.08),
    roughness: 0.38,
    metalness: 0.04,
  });

  const pelvis = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), pants));
  pelvis.position.y = 0.94;
  pelvis.scale.set(1.28, 0.72, 1.05);
  g.add(pelvis);

  const waist = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.16, 4, 12), shirt));
  waist.position.y = 1.1;
  waist.scale.set(1.15, 1, 0.92);
  g.add(waist);

  const chest = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 5, 12), shirt));
  chest.position.y = 1.32;
  chest.scale.set(1.22, 1, 0.88);
  g.add(chest);

  const collar = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 14), shirt));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.5;
  g.add(collar);

  const belt = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 16), dark));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.05;
  g.add(belt);

  const shL = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), shirt));
  shL.position.set(-0.22, 1.44, 0);
  const shR = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), shirt));
  shR.position.set(0.22, 1.44, 0);
  g.add(shL, shR);

  if (look.vest) {
    const v = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), vest));
    v.position.y = 1.3;
    v.scale.set(1.12, 0.82, 0.78);
    g.add(v);
    const plate = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.04), vest));
    plate.position.set(0, 1.3, -0.14);
    g.add(plate);
  }

  const neck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.11, 10), skin));
  neck.position.y = 1.54;
  g.add(neck);

  const skull = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 16), skin));
  skull.position.y = 1.655;
  skull.scale.set(0.92, 1.05, 0.98);
  g.add(skull);
  const jaw = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), skin));
  jaw.position.set(0, 1.58, -0.01);
  jaw.scale.set(0.82, 0.58, 0.78);
  g.add(jaw);

  const nose = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.042, 8), skin));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 1.645, -0.112);
  g.add(nose);
  const tip = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), skin));
  tip.position.set(0, 1.632, -0.128);
  g.add(tip);

  const brow = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.02), matHair(look.hairColor)));
  brow.position.set(0, 1.695, -0.1);
  g.add(brow);
  const browL = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.008, 0.012), matHair(look.hairColor)));
  browL.position.set(-0.034, 1.692, -0.102);
  browL.rotation.z = 0.12;
  const browR = browL.clone();
  browR.position.x = 0.034;
  browR.rotation.z = -0.12;
  g.add(browL, browR);

  const eyeL = makeEye(look.iris);
  eyeL.position.set(-0.034, 1.668, -0.092);
  const eyeR = makeEye(look.iris);
  eyeR.position.set(0.034, 1.668, -0.092);
  g.add(eyeL, eyeR);

  const lidGeo = new THREE.SphereGeometry(0.018, 10, 6, 0, Math.PI * 2, 0, 1.0);
  const lidL = new THREE.Mesh(lidGeo, skin);
  lidL.position.set(-0.034, 1.678, -0.09);
  lidL.scale.set(1, 0.45, 0.85);
  const lidR = lidL.clone();
  lidR.position.x = 0.034;
  g.add(lidL, lidR);

  const mouth = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.008, 0.012), lip));
  mouth.position.set(0, 1.6, -0.108);
  g.add(mouth);
  const lipU = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), lip));
  lipU.position.set(0, 1.606, -0.11);
  lipU.scale.set(1.3, 0.35, 0.55);
  const lipLo = lipU.clone();
  lipLo.position.y = 1.594;
  g.add(lipU, lipLo);

  const earG = new THREE.SphereGeometry(0.028, 8, 6);
  const earL = addShadow(new THREE.Mesh(earG, skin));
  earL.position.set(-0.108, 1.655, 0.01);
  earL.scale.set(0.55, 1, 0.7);
  const earR = addShadow(new THREE.Mesh(earG, skin));
  earR.position.set(0.108, 1.655, 0.01);
  earR.scale.set(0.55, 1, 0.7);
  g.add(earL, earR);

  if (look.beard !== "none") {
    const beard = matHair(look.hairColor);
    beard.transparent = true;
    beard.opacity = look.beard === "full" ? 0.92 : 0.45;
    const chin = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), beard));
    chin.position.set(0, 1.555, -0.05);
    chin.scale.set(0.95, 0.55, 0.8);
    g.add(chin);
    if (look.beard === "full") {
      const sideA = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), beard));
      sideA.position.set(-0.07, 1.6, -0.04);
      sideA.scale.set(0.7, 0.9, 0.7);
      const sideB = sideA.clone();
      sideB.position.x = 0.07;
      g.add(sideA, sideB);
    }
  }

  addHair(g, look, hairM, 1.68);

  if (look.helmet === "cap") {
    const cap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, 1.2), dark));
    cap.position.y = 1.72;
    g.add(cap);
    const brim = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.12), dark));
    brim.position.set(0, 1.735, -0.12);
    brim.rotation.x = -0.12;
    g.add(brim);
  } else if (look.helmet === "tactical") {
    const helm = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, 1.5), dark));
    helm.position.y = 1.7;
    g.add(helm);
    const nape = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.1), dark));
    nape.position.set(0, 1.62, 0.06);
    g.add(nape);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.045, 0.03),
      new THREE.MeshStandardMaterial({
        color: team != null ? team : 0x1a2830,
        emissive: team != null ? team : 0x102028,
        emissiveIntensity: 0.35,
        roughness: 0.15,
        metalness: 0.55,
        transparent: true,
        opacity: 0.85,
      })
    );
    visor.position.set(0, 1.668, -0.11);
    g.add(visor);
  }

  const larm = new THREE.Group();
  larm.position.set(-0.22, 1.42, 0);
  larm.add(capsuleBetween(0, 0, 0, 0, -0.28, 0.02, 0.048, shirt));
  const elL = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin));
  elL.position.set(0, -0.28, 0.02);
  larm.add(elL);
  larm.add(capsuleBetween(0, -0.28, 0.02, 0.02, -0.52, -0.02, 0.038, skin));
  const handL = makeHand(skin, 0.95);
  handL.position.set(0.02, -0.56, -0.02);
  handL.rotation.x = 0.15;
  larm.add(handL);
  g.add(larm);

  const rarm = new THREE.Group();
  rarm.position.set(0.22, 1.42, 0);
  rarm.add(capsuleBetween(0, 0, 0, 0, -0.28, 0.02, 0.048, shirt));
  const elR = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin));
  elR.position.set(0, -0.28, 0.02);
  rarm.add(elR);
  rarm.add(capsuleBetween(0, -0.28, 0.02, -0.02, -0.5, -0.06, 0.038, skin));
  const handR = makeHand(skin, 0.95);
  handR.position.set(-0.02, -0.54, -0.08);
  handR.rotation.set(0.4, 0.2, 0.1);
  rarm.add(handR);
  g.add(rarm);

  const lleg = new THREE.Group();
  lleg.position.set(-0.09, 0.92, 0);
  lleg.add(capsuleBetween(0, 0, 0, 0, -0.38, 0.02, 0.062, pants));
  const knL = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), pants));
  knL.position.set(0, -0.38, 0.02);
  lleg.add(knL);
  lleg.add(capsuleBetween(0, -0.38, 0.02, 0, -0.72, 0, 0.05, pants));
  const bootL = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.18), boot));
  bootL.position.set(0, -0.78, 0.03);
  lleg.add(bootL);
  g.add(lleg);

  const rleg = new THREE.Group();
  rleg.position.set(0.09, 0.92, 0);
  rleg.add(capsuleBetween(0, 0, 0, 0, -0.38, 0.02, 0.062, pants));
  const knR = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), pants));
  knR.position.set(0, -0.38, 0.02);
  rleg.add(knR);
  rleg.add(capsuleBetween(0, -0.38, 0.02, 0, -0.72, 0, 0.05, pants));
  const bootR = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.18), boot));
  bootR.position.set(0, -0.78, 0.03);
  rleg.add(bootR);
  g.add(rleg);

  const gun = createWeapon("rifle");
  gun.scale.set(0.85, 0.85, 0.85);
  gun.position.set(0.02, -0.48, -0.28);
  gun.rotation.set(-1.12, 0.04, 0.04);
  rarm.add(gun);

  const tagCol = team != null ? team : look.shirt;
  const tag = makeLabel(name, hex(tagCol));
  tag.position.y = 0.5;
  g.add(tag);

  const hpGroup = new THREE.Group();
  hpGroup.position.y = 2.05;
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })
  );
  hpBg.renderOrder = 2;
  hpGroup.add(hpBg);
  const hpFg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x5ce1ff, depthTest: false })
  );
  hpFg.position.z = 0.01;
  hpFg.renderOrder = 3;
  hpGroup.add(hpFg);
  g.add(hpGroup);

  return { group: g, larm, rarm, lleg, rleg, gun, tag, hpFg, hpGroup };
}

function createGltfCharacter(look, name, opts = {}) {
  look = sanitizeLook(look);
  const team = opts.teamColor != null ? opts.teamColor : null;
  const model = cloneHuman();
  if (!model) return createProcCharacter(look, name, opts);
  const g = new THREE.Group();
  g.add(model);
  tintHuman(model, look, team);
  model.traverse((o) => {
    if (o.isMesh && /visor/i.test(o.name || "") && look.helmet === "none") o.visible = false;
  });

  const dummy = () => new THREE.Group();
  const larm = dummy();
  const rarm = dummy();
  const lleg = dummy();
  const rleg = dummy();
  g.add(larm, rarm, lleg, rleg);

  const head = findBone(model, "mixamorig:Head");
  if (head) {
    const gear = new THREE.Group();
    gear.position.set(0, 0.09, 0.02);
    if (look.hair !== "bald") {
      const hairM = matHair(look.hairColor);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10, 0, Math.PI * 2, 0, 1.25), hairM);
      cap.scale.set(1.05, 0.62, 1.08);
      gear.add(cap);
      if (look.hair === "mohawk") {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.16), hairM);
        m.position.y = 0.08;
        gear.add(m);
      }
      if (look.hair === "long" || look.hair === "pony") {
        const fall = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.16, 3, 8), hairM);
        fall.position.set(0, -0.08, 0.06);
        gear.add(fall);
      }
    }
    if (look.helmet === "cap") {
      const dark = matCloth(0x14161a, 0.55);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.09), dark);
      brim.position.set(0, 0.04, -0.08);
      gear.add(brim);
    }
    head.add(gear);
  }

  const hand = findBone(model, "mixamorig:RightHand");
  const gun = createWeapon("rifle");
  gun.scale.setScalar(0.62);
  gun.rotation.set(-Math.PI / 2, 0, Math.PI);
  gun.position.set(0.02, 0.05, 0.04);
  if (hand) hand.add(gun);
  else rarm.add(gun);

  const { mixer, actions } = makeHumanMixer(model);

  const tagCol = team != null ? team : look.shirt;
  const tag = makeLabel(name, hex(tagCol));
  tag.position.y = 0.52;
  g.add(tag);

  const hpGroup = new THREE.Group();
  hpGroup.position.y = 2.08;
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })
  );
  hpBg.renderOrder = 2;
  hpGroup.add(hpBg);
  const hpFg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x5ce1ff, depthTest: false })
  );
  hpFg.position.z = 0.01;
  hpFg.renderOrder = 3;
  hpGroup.add(hpFg);
  g.add(hpGroup);

  return { group: g, larm, rarm, lleg, rleg, gun, tag, hpFg, hpGroup, mixer, actions, skinned: true };
}

function createCharacter(look, name, opts = {}) {
  look = sanitizeLook(look);
  if (HUMAN.ready) return createGltfCharacter(look, name, opts);
  return createProcCharacter(look, name, opts);
}

function createOperator(color, name, look) {
  const l = look ? sanitizeLook(look) : randomLook(color);
  return createCharacter(l, name, {});
}

function drawLookPreview(canvas, look) {
  if (!canvas) return;
  look = sanitizeLook(look);
  const g = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#121820";
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const skin = hex(look.skin);
  const shirt = hex(look.shirt);
  const pants = hex(look.pants);
  const hair = hex(look.hairColor);
  g.fillStyle = pants;
  g.fillRect(cx - 22, 118, 18, 48);
  g.fillRect(cx + 4, 118, 18, 48);
  g.fillStyle = "#1a1c20";
  g.fillRect(cx - 24, 158, 20, 10);
  g.fillRect(cx + 4, 158, 20, 10);
  g.fillStyle = shirt;
  g.beginPath();
  g.ellipse(cx, 92, 28, 32, 0, 0, Math.PI * 2);
  g.fill();
  if (look.vest) {
    g.fillStyle = "#2c3238";
    g.fillRect(cx - 20, 78, 40, 36);
  }
  g.fillStyle = shirt;
  g.fillRect(cx - 40, 78, 14, 36);
  g.fillRect(cx + 26, 78, 14, 36);
  g.fillStyle = skin;
  g.fillRect(cx - 40, 110, 12, 22);
  g.fillRect(cx + 28, 110, 12, 22);
  g.beginPath();
  g.arc(cx, 52, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f4f0ea";
  g.beginPath();
  g.ellipse(cx - 7, 52, 4, 3, 0, 0, Math.PI * 2);
  g.ellipse(cx + 7, 52, 4, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hex(look.iris);
  g.beginPath();
  g.arc(cx - 7, 52, 2, 0, Math.PI * 2);
  g.arc(cx + 7, 52, 2, 0, Math.PI * 2);
  g.fill();
  if (look.hair !== "bald") {
    g.fillStyle = hair;
    g.beginPath();
    g.arc(cx, 42, 20, Math.PI, 0);
    g.fill();
    if (look.hair === "long" || look.hair === "pony") {
      g.fillRect(cx - 16, 48, 10, 28);
      g.fillRect(cx + 6, 48, 10, 28);
    }
    if (look.hair === "mohawk") g.fillRect(cx - 4, 22, 8, 18);
  }
  if (look.beard !== "none") {
    g.fillStyle = hair;
    g.globalAlpha = look.beard === "full" ? 0.7 : 0.28;
    g.beginPath();
    g.ellipse(cx, 66, look.beard === "full" ? 16 : 12, look.beard === "full" ? 10 : 6, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  if (look.helmet === "cap") {
    g.fillStyle = "#16181c";
    g.fillRect(cx - 18, 32, 36, 10);
    g.fillRect(cx - 8, 36, 28, 6);
  } else if (look.helmet === "tactical") {
    g.fillStyle = "#16181c";
    g.beginPath();
    g.arc(cx, 48, 24, Math.PI, 0);
    g.fill();
  }
}

class Game {
  constructor() {
    this.audio = new GameAudio();
    this.keys = new Set();
    this.mouseDown = false;
    this.sens = 1.2;
    this.botCount = 8;
    this.mapId = "warehouse";
    this.diffId = "normal";
    this.modeId = "ffa";
    this.mode = MODES.ffa;
    this.teamScore = [0, 0];
    this.flags = [];
    this.hill = { x: 0, z: 0, r: 5.2 };
    this.flagHomes = [new THREE.Vector3(-24, 0, 0), new THREE.Vector3(24, 0, 0)];
    this._hillAcc = 0;
    this._hillHold = -1;
    this.hillRing = null;
    this.padA = null;
    this.padB = null;
    this.difficulty = DIFFICULTY.normal;
    this.wantTeam = 0;
    this.online = false;
    this.humans = [];
    this.net = new Net();
    this.net.onEvent = (msg) => this._onNet(msg);
    this._netAcc = 0;
    this._hudAcc = 0;
    this._miniWalls = null;
    this.running = false;
    this.paused = false;
    if (typeof location !== "undefined" && /(?:\?|&)fast=1(?:&|$)/.test(location.search)) {
      CFG.roundTime = 15;
      CFG.shopTime = 10;
    }
    this.matchOver = false;
    this.inShop = false;
    this.round = 1;
    this.roundLeft = CFG.roundTime;
    this.shopLeft = 0;
    this.credits = CFG.startCredit;
    this.owned = { rifle: true };
    this.weaponId = "rifle";
    this._firedSemi = false;
    this.aimT = 0;
    this.rmbDown = false;
    this.touchAim = false;
    this.inSettings = false;
    this.xhair = this._loadXhair();
    this.look = this._loadLook();
    this.mannequin = null;
    this._netLookN = 0;
    this.time = 0;
    this.effects = [];
    this.shots = [];
    this.idSeq = 1;
    this._bind();

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: $("view"),
        antialias: (devicePixelRatio || 1) < 1.4,
        powerPreference: "high-performance",
        stencil: false,
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      this.renderer.setSize(innerWidth, innerHeight);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.28;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 240);
      this.camera.rotation.order = "YXZ";

      this._loadMap("warehouse");

      this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 });
      this.sparkGeo = new THREE.SphereGeometry(0.035, 6, 6);
      this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa55 });
      this.tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);

      this.viewmodel = this._makeViewmodel();
      this._rebuildViewArms();
      this.viewmodel.visible = false;
      this.camera.add(this.viewmodel);
      this.scene.add(this.camera);
      this.camera.position.set(26, 12.5, 26);
      this.camera.lookAt(0, 2.2, 0);
    } catch (err) {
      console.error(err);
      const tag = document.querySelector("#menu .tag");
      if (tag) tag.textContent = "Graphics failed to start, but the menu still works. Try Chrome or Firefox.";
    }

    this.player = null;
    this.bots = [];
    this.humans = [];
    this.fighters = [];
    this.pointerLocked = false;
    this.dragging = false;
    this.touchStick = { active: false, id: null, x: 0, y: 0, nx: 0, ny: 0 };
    this.touchLook = { id: null, x: 0, y: 0 };
    this.touchFire = false;
    this.touchJump = false;
    this.usingTouch = false;

    this._bindInput();
    this._bindSettings();
    this._applyXhair();
    this._syncLookUI();
    this._refreshMannequin();
    loadHumanModels()
      .then(() => {
        this._refreshMannequin();
        if (this.running) {
          for (const f of this.fighters || []) {
            if (f && !f.isPlayer && f.rig) this._rebuildRig(f);
          }
        }
      })
      .catch((err) => console.warn("Human model failed to load", err));
    this._loop = this._loop.bind(this);
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  }

  _makeViewmodel() {
    const root = new THREE.Group();
    const gun = createWeapon("rifle", false);
    gun.scale.set(1.28, 1.28, 1.28);
    gun.position.set(0.32, -0.28, -0.62);
    gun.rotation.set(0.04, 0.08, -0.04);
    root.add(gun);
    const light = new THREE.PointLight(0xffcc88, 0, 4.5);
    light.position.set(0.32, -0.2, -1.05);
    root.add(light);
    const fill = new THREE.PointLight(0xffe8d0, 1.25, 2.8);
    fill.position.set(0.1, 0.04, -0.18);
    root.add(fill);
    this.muzzleLight = light;
    this.gunRoot = gun;
    this.gunRestZ = -0.62;
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({
        color: 0xffeeaa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    flash.position.set(0.3, -0.22, -1.22);
    root.add(flash);
    this.muzzleFlash = flash;
    return root;
  }

  _bind() {
    $("sens").addEventListener("input", (e) => {
      this.sens = parseFloat(e.target.value);
      $("sens-val").textContent = this.sens.toFixed(1);
    });
    $("bots").addEventListener("input", (e) => {
      this.botCount = parseInt(e.target.value, 10);
      $("bots-val").textContent = String(this.botCount);
    });
    $("diff-row").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-diff]");
      if (!btn) return;
      this._setDifficulty(btn.dataset.diff);
    });
    $("map-row").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-map]");
      if (!btn) return;
      this._setMap(btn.dataset.map);
    });
    $("game-row").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-game]");
      if (!btn) return;
      this._setGame(btn.dataset.game);
    });
    if ($("team-row")) {
      $("team-row").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-team]");
        if (!btn) return;
        this._setWantTeam(Number(btn.dataset.team));
      });
    }
    $("mode-local").addEventListener("click", (e) => {
      e.preventDefault();
      this._setMode(false);
    });
    $("mode-online").addEventListener("click", (e) => {
      e.preventDefault();
      this._setMode(true);
    });
    if ($("btn-create")) {
      $("btn-create").addEventListener("click", (e) => {
        e.preventDefault();
        this._createRoom();
      });
    }
    $("btn-join").addEventListener("click", (e) => {
      e.preventDefault();
      this._joinRoom();
    });
    if ($("lobby-list")) {
      $("lobby-list").addEventListener("click", (e) => {
        const row = e.target.closest("[data-join]");
        if (!row || row.disabled) return;
        e.preventDefault();
        this._joinLobby(row.dataset.join);
      });
    }
    $("room-code").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._joinRoom();
    });
    $("btn-start").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.online) this._createRoom();
      else this.startMatch();
    });
    $("btn-again").addEventListener("click", (e) => {
      e.preventDefault();
      if (this.online && this.net.host) this.net.send({ t: "reset" });
      this.startMatch({ keepOnline: this.online });
    });
    $("btn-resume").addEventListener("click", (e) => {
      e.preventDefault();
      this._resume();
    });
    if ($("btn-menu")) {
      $("btn-menu").addEventListener("click", (e) => {
        e.preventDefault();
        this._leaveToMenu();
      });
    }
    $("btn-settings-close").addEventListener("click", (e) => {
      e.preventDefault();
      this._closeSettings();
    });
    if ($("btn-customize")) {
      $("btn-customize").addEventListener("click", (e) => {
        e.preventDefault();
        this._openSettings();
      });
    }
    $("btn-next-round").addEventListener("click", (e) => {
      e.preventDefault();
      this._nextRound();
    });
    $("shop-items").addEventListener("click", (e) => {
      const card = e.target.closest("[data-buy]");
      if (card) this._buyOrEquip(card.dataset.buy);
    });
  }

  _bindInput() {
    addEventListener("resize", () => {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (["Space", "Tab", "KeyR"].includes(e.code)) e.preventDefault();
      if (e.code === "Tab") $("scoreboard").classList.remove("hidden");
      if (e.code === "Digit1") this._equipWeapon("rifle");
      if (e.code === "Digit2") this._equipWeapon("smg");
      if (e.code === "Digit3") this._equipWeapon("shotgun");
      if (e.code === "Digit4") this._equipWeapon("sniper");
      if (e.code === "KeyP") {
        if (e.repeat) return;
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        this._toggleSettings();
        return;
      }
      if (e.code === "KeyY") {
        if (e.repeat) return;
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        this._leaveToMenu();
        return;
      }
      if (e.code === "Escape" && this.inSettings) {
        e.preventDefault();
        this._closeSettings();
        return;
      }
      if (e.code === "Escape" && this.running && !this.matchOver && !this.inShop) {
        if (this.paused) this._resume();
        else this._pause();
      }
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") $("scoreboard").classList.add("hidden");
    });
    addEventListener("mousedown", (e) => {
      const ui = e.target.closest("button, input, #shop, #menu, #match-over, #paused, #scoreboard, #settings");
      if (e.button === 0) this.mouseDown = !ui && !this.inShop && !this.inSettings;
      if (e.button === 2) {
        e.preventDefault();
        this.rmbDown = !ui && !this.inShop && !this.inSettings;
      }
      if (this.running && !this.matchOver && !this.inShop && !this.inSettings && !ui) {
        if (this.paused) this._resume();
        else {
          this.dragging = true;
          this._requestLock();
        }
      }
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rmbDown = false;
      this.dragging = false;
    });
    addEventListener("mousemove", (e) => {
      this._look(e.movementX, e.movementY, this.pointerLocked || this.dragging);
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === $("view");
      if (this.pointerLocked && this.paused && !this.inSettings) this._resume();
      this._syncLookHint();
    });
    document.addEventListener("pointerlockerror", () => {
      this.pointerLocked = false;
      this._syncLookHint();
    });
    if ($("view")) $("view").addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("contextmenu", (e) => {
      if (this.running) e.preventDefault();
    });
    this._bindTouch();
  }

  _bindTouch() {
    const stick = $("stick");
    const fire = $("touch-fire");
    const jump = $("touch-jump");
    const aim = $("touch-aim");
    const showTouch = () => {
      this.usingTouch = true;
      $("touch-ui").classList.remove("hidden");
    };
    addEventListener("touchstart", showTouch, { once: true, passive: true });

    const setKnob = (nx, ny) => {
      $("stick-knob").style.transform = `translate(${nx * 32}px, ${ny * 32}px)`;
    };

    stick.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.touchStick.active = true;
      this.touchStick.id = t.identifier;
      const r = stick.getBoundingClientRect();
      this.touchStick.x = r.left + r.width / 2;
      this.touchStick.y = r.top + r.height / 2;
    }, { passive: false });

    fire.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.touchFire = true;
      this.mouseDown = true;
    }, { passive: false });
    fire.addEventListener("touchend", () => {
      this.touchFire = false;
      this.mouseDown = false;
    });
    jump.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.touchJump = true;
    }, { passive: false });
    jump.addEventListener("touchend", () => {
      this.touchJump = false;
    });
    if (aim) {
      aim.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.touchAim = true;
      }, { passive: false });
      aim.addEventListener("touchend", () => {
        this.touchAim = false;
      });
    }

    addEventListener("touchstart", (e) => {
      if (!this.running || this.matchOver || this.inShop) return;
      if (this.paused) this._resume();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchStick.id) continue;
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && (el.id === "touch-fire" || el.id === "touch-jump" || el.id === "touch-aim" || el.closest("#stick"))) continue;
        if (this.touchLook.id == null) {
          this.touchLook.id = t.identifier;
          this.touchLook.x = t.clientX;
          this.touchLook.y = t.clientY;
        }
      }
    }, { passive: true });

    addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (this.touchStick.active && t.identifier === this.touchStick.id) {
          let nx = (t.clientX - this.touchStick.x) / 48;
          let ny = (t.clientY - this.touchStick.y) / 48;
          const m = Math.hypot(nx, ny);
          if (m > 1) {
            nx /= m;
            ny /= m;
          }
          this.touchStick.nx = nx;
          this.touchStick.ny = ny;
          setKnob(nx, ny);
        } else if (t.identifier === this.touchLook.id) {
          this._look(t.clientX - this.touchLook.x, t.clientY - this.touchLook.y, true);
          this.touchLook.x = t.clientX;
          this.touchLook.y = t.clientY;
        }
      }
    }, { passive: true });

    addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchStick.id) {
          this.touchStick.active = false;
          this.touchStick.id = null;
          this.touchStick.nx = 0;
          this.touchStick.ny = 0;
          setKnob(0, 0);
        }
        if (t.identifier === this.touchLook.id) this.touchLook.id = null;
      }
    });
  }

  _look(dx, dy, allowed) {
    if (!allowed || !this.player || !this.player.alive || this.paused || this.inShop || this.inSettings || !this.running) return;
    const scoped = this.weaponId === "sniper" ? 0.82 : 0.52;
    this.player.yaw -= dx * this.sens * 0.0022 * (1 - this.aimT * scoped);
    this.player.pitch -= dy * this.sens * 0.0022 * (1 - this.aimT * scoped);
    this.player.pitch = clamp(this.player.pitch, -1.45, 1.45);
  }

  _requestLock() {
    const canvas = $("view");
    if (!canvas.requestPointerLock) return;
    try {
      const ret = canvas.requestPointerLock();
      if (ret && typeof ret.catch === "function") ret.catch(() => {});
    } catch (_) {
      /* pointer lock is optional */
    }
  }

  _pause() {
    this.paused = true;
    this._hideAdsUi();
    if (!this.inSettings) $("paused").classList.remove("hidden");
    if (document.exitPointerLock) document.exitPointerLock();
  }

  _resume() {
    if (this.inSettings) {
      this._closeSettings();
      return;
    }
    this.paused = false;
    $("paused").classList.add("hidden");
    this._requestLock();
  }

  _leaveToMenu() {
    const menu = $("menu");
    const onMenu = menu && !menu.classList.contains("hidden") && !this.running && !this.matchOver && !this.inShop;
    if (onMenu) return;
    if (!this.running && !this.matchOver && !this.inShop) return;

    this.running = false;
    this.matchOver = false;
    this.inShop = false;
    this.paused = false;
    this.keys.clear();
    this.mouseDown = false;
    this.rmbDown = false;
    this.dragging = false;
    this._hideAdsUi();
    if (this.inSettings) this._closeSettings();
    if (document.exitPointerLock) document.exitPointerLock();

    if (this.online && this.net) this.net.leaveRoom();

    for (const b of this.bots || []) if (b.rig) this.scene.remove(b.rig.group);
    for (const h of this.humans || []) if (h.rig) this.scene.remove(h.rig.group);
    for (const e of this.effects || []) if (e.mesh) this.scene.remove(e.mesh);
    this.bots = [];
    this.humans = [];
    this.effects = [];
    this.player = null;
    this.fighters = [];

    if ($("hud")) $("hud").classList.add("hidden");
    if ($("shop")) $("shop").classList.add("hidden");
    if ($("paused")) $("paused").classList.add("hidden");
    if ($("death-screen")) $("death-screen").classList.add("hidden");
    if ($("match-over")) $("match-over").classList.add("hidden");
    if ($("scoreboard")) $("scoreboard").classList.add("hidden");
    if ($("room-chip")) $("room-chip").classList.add("hidden");
    if (menu) menu.classList.remove("hidden");
    this._refreshMannequin();
    if (this.online) this._startLobbyWatch();
  }

  _hideAdsUi() {
    this.aimT = 0;
    const ch = $("crosshair");
    if (ch) ch.classList.remove("ads", "hidden-ads");
    if ($("hud")) $("hud").classList.remove("ads", "scope", "holo");
    const sc = $("scope");
    if (sc) sc.classList.remove("show");
  }

  _loadXhair() {
    const out = { ...XHAIR_DEFAULT };
    try {
      const raw = localStorage.getItem("nexus-xhair");
      if (!raw) return out;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") Object.assign(out, data);
    } catch (_) {}
    return out;
  }

  _saveXhair() {
    try {
      localStorage.setItem("nexus-xhair", JSON.stringify(this.xhair));
    } catch (_) {}
  }

  _loadLook() {
    try {
      const raw = localStorage.getItem("nexus-look");
      if (!raw) return sanitizeLook(LOOK_DEFAULT);
      return sanitizeLook(JSON.parse(raw));
    } catch (_) {
      return sanitizeLook(LOOK_DEFAULT);
    }
  }

  _saveLook() {
    try {
      localStorage.setItem("nexus-look", JSON.stringify(sanitizeLook(this.look)));
    } catch (_) {}
  }

  _commitLook() {
    this.look = sanitizeLook(this.look);
    this._saveLook();
    this._syncLookUI();
    this._rebuildViewArms();
    this._refreshMannequin();
    if (this.player) this.player.look = this.look;
    if (this.online && this.net && this.net.connected) this.net.send({ t: "look", look: this.look });
  }

  _rebuildViewArms() {
    if (!this.viewmodel) return;
    if (this.viewArms) this.viewmodel.remove(this.viewArms);
    const teamCol =
      this._isTeamMode() && this.player && this.player.team >= 0 ? TEAMS[this.player.team].color : null;
    this.viewArms = createViewArms(this.look, teamCol);
    this.viewmodel.add(this.viewArms);
    if (this.gunRoot) this.viewmodel.add(this.gunRoot);
    if (this.muzzleFlash) this.viewmodel.add(this.muzzleFlash);
    this._poseViewHands(this.weaponId);
  }

  _poseViewHands(id) {
    try {
      const arms = this.viewArms;
      const gun = this.gunRoot;
      if (!arms || !gun || !arms.userData) return;
      const grip = VIEW_GRIP[id] || VIEW_GRIP.rifle;
      const rh = arms.userData.rightHand;
      const lh = arms.userData.leftHand;
      if (!rh || !lh) return;
      gun.updateMatrixWorld(true);
      const place = (hand, pos, rot) => {
        _handWorld.set(pos[0], pos[1], pos[2]);
        gun.localToWorld(_handWorld);
        if (this.viewmodel) this.viewmodel.worldToLocal(_handWorld);
        hand.position.copy(_handWorld);
        hand.rotation.set(rot[0], rot[1], rot[2]);
        hand.quaternion.premultiply(gun.quaternion);
      };
      place(rh, grip.rPos, grip.rRot);
      place(lh, grip.lPos, grip.lRot);
      this._stretchViewArms();
    } catch (err) {
      console.warn("view arms", err);
    }
  }

  _stretchViewArms() {
    const d = this.viewArms && this.viewArms.userData;
    if (!d || !d.rightHand || !d.leftHand) return;
    const rSh = [0.34, -0.18, 0.16];
    const lSh = [-0.18, -0.24, 0.12];
    const rw = d.rightHand.position;
    const lw = d.leftHand.position;
    const rMid = [
      rSh[0] + (rw.x - rSh[0]) * 0.52,
      rSh[1] + (rw.y - rSh[1]) * 0.52 - 0.04,
      rSh[2] + (rw.z - rSh[2]) * 0.52,
    ];
    const lMid = [
      lSh[0] + (lw.x - lSh[0]) * 0.52,
      lSh[1] + (lw.y - lSh[1]) * 0.52 - 0.04,
      lSh[2] + (lw.z - lSh[2]) * 0.52,
    ];
    placeArmSeg(d.rUpper, rSh[0], rSh[1], rSh[2], rMid[0], rMid[1], rMid[2], 0.42);
    placeArmSeg(d.rLower, rMid[0], rMid[1], rMid[2], rw.x, rw.y, rw.z, 0.28);
    placeArmSeg(d.lUpper, lSh[0], lSh[1], lSh[2], lMid[0], lMid[1], lMid[2], 0.42);
    placeArmSeg(d.lLower, lMid[0], lMid[1], lMid[2], lw.x, lw.y, lw.z, 0.28);
  }

  _charOpts(ent) {
    return { teamColor: this._isTeamMode() && ent && ent.team >= 0 ? TEAMS[ent.team].color : null };
  }

  _makeRig(ent) {
    const look = sanitizeLook(ent.look || this.look);
    ent.look = look;
    ent.lookKey = lookKey(look);
    return createCharacter(look, ent.name, this._charOpts(ent));
  }

  _rebuildRig(ent) {
    if (!ent || ent.isPlayer) return;
    const pos = ent.rig ? ent.rig.group.position.clone() : ent.pos.clone();
    const rotY = ent.rig ? ent.rig.group.rotation.y : ent.yaw;
    if (ent.rig) this.scene.remove(ent.rig.group);
    ent.rig = this._makeRig(ent);
    ent.rig.group.position.copy(pos);
    ent.rig.group.rotation.y = rotY;
    this.scene.add(ent.rig.group);
  }

  _setLook(ent, look) {
    if (!ent) return;
    const l = sanitizeLook(look);
    const k = lookKey(l);
    if (ent.lookKey === k && ent.rig) {
      ent.look = l;
      return;
    }
    ent.look = l;
    ent.lookKey = k;
    if (ent.rig) this._rebuildRig(ent);
  }

  _refreshMannequin() {
    if (this.mannequin) {
      this.scene.remove(this.mannequin.group);
      this.mannequin = null;
    }
    if (this.running || !this.scene) return;
    const name = this._playerName ? this._playerName() : "YOU";
    const rig = createCharacter(this.look, name, {});
    if (rig.hpGroup) rig.hpGroup.visible = false;
    if (rig.tag) rig.tag.visible = false;
    rig.group.position.set(0, 0, 0);
    this.scene.add(rig.group);
    this.mannequin = rig;
  }

  _fillLookRow(id, colors, key) {
    const row = $(id);
    if (!row) return;
    row.innerHTML = colors
      .map(
        (c) =>
          `<button type="button" class="xh-swatch" data-look-key="${key}" data-look-num="${c}" style="background:${hex(c)}"></button>`
      )
      .join("");
    row.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-look-num]");
      if (!btn) return;
      this.look[key] = Number(btn.dataset.lookNum) >>> 0;
      this._commitLook();
    });
  }

  _syncLookUI() {
    const l = sanitizeLook(this.look);
    this.look = l;
    const mark = (sel, on) => {
      const root = $(sel);
      if (!root) return;
      for (const btn of root.querySelectorAll("button")) btn.classList.toggle("on", on(btn));
    };
    mark("look-skin-row", (b) => (Number(b.dataset.lookNum) >>> 0) === l.skin);
    mark("look-hairc-row", (b) => (Number(b.dataset.lookNum) >>> 0) === l.hairColor);
    mark("look-shirt-row", (b) => (Number(b.dataset.lookNum) >>> 0) === l.shirt);
    mark("look-pants-row", (b) => (Number(b.dataset.lookNum) >>> 0) === l.pants);
    mark("look-hair-row", (b) => b.dataset.lookHair === l.hair);
    mark("look-gear-row", (b) => {
      if (b.id === "look-vest-btn") return !!l.vest;
      return b.dataset.lookHelm === l.helmet;
    });
    mark("look-beard-row", (b) => b.dataset.lookBeard === l.beard);
    drawLookPreview($("look-preview"), l);
  }

  _applyXhair() {
    const x = this.xhair || XHAIR_DEFAULT;
    for (const id of ["crosshair", "xh-preview"]) {
      const el = $(id);
      if (!el) continue;
      el.dataset.style = x.style || "default";
      el.classList.toggle("nodot", !x.center);
      el.style.setProperty("--xh-color", x.color || "#f4fbff");
      el.style.setProperty("--xh-size", (x.size || 28) + "px");
      el.style.setProperty("--xh-gap", (x.gap ?? 4) + "px");
      el.style.setProperty("--xh-thick", (x.thick || 2) + "px");
      el.style.setProperty("--xh-len", (x.len || 8) + "px");
      el.style.setProperty("--xh-dot", Math.max(2, x.thick || 2) + "px");
      el.style.setProperty("--xh-op", String(x.opacity ?? 1));
      el.style.setProperty("--xh-outline", x.outline ? "1px" : "0px");
    }
  }

  _syncXhairUI() {
    const x = this.xhair;
    const set = (id, val) => {
      if ($(id)) $(id).value = String(val);
    };
    const lab = (id, val) => {
      if ($(id)) $(id).textContent = String(val);
    };
    set("xh-size", x.size);
    set("xh-gap", x.gap);
    set("xh-thick", x.thick);
    set("xh-len", x.len);
    set("xh-op", x.opacity);
    lab("xh-size-val", x.size);
    lab("xh-gap-val", x.gap);
    lab("xh-thick-val", x.thick);
    lab("xh-len-val", x.len);
    lab("xh-op-val", Number(x.opacity).toFixed(2));
    if ($("xh-dot-btn")) $("xh-dot-btn").classList.toggle("on", !!x.center);
    if ($("xh-outline-btn")) $("xh-outline-btn").classList.toggle("on", !!x.outline);
    if ($("xh-style-row")) {
      for (const btn of $("xh-style-row").querySelectorAll("[data-xh-style]")) {
        btn.classList.toggle("on", btn.dataset.xhStyle === x.style);
      }
    }
    if ($("xh-color-row")) {
      for (const btn of $("xh-color-row").querySelectorAll("[data-xh-color]")) {
        btn.classList.toggle("on", btn.dataset.xhColor === x.color);
      }
    }
    this._applyXhair();
  }

  _bindSettings() {
    const row = $("xh-style-row");
    if (row) {
      row.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-xh-style]");
        if (!btn) return;
        this.xhair.style = btn.dataset.xhStyle;
        this._saveXhair();
        this._syncXhairUI();
      });
    }
    const colors = $("xh-color-row");
    if (colors) {
      colors.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-xh-color]");
        if (!btn) return;
        this.xhair.color = btn.dataset.xhColor;
        this._saveXhair();
        this._syncXhairUI();
      });
    }
    const bindRange = (id, key, label, fmt) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        const n = parseFloat(el.value);
        this.xhair[key] = n;
        if ($(label)) $(label).textContent = fmt ? fmt(n) : String(n);
        this._saveXhair();
        this._applyXhair();
      });
    };
    bindRange("xh-size", "size", "xh-size-val");
    bindRange("xh-gap", "gap", "xh-gap-val");
    bindRange("xh-thick", "thick", "xh-thick-val");
    bindRange("xh-len", "len", "xh-len-val");
    bindRange("xh-op", "opacity", "xh-op-val", (n) => n.toFixed(2));
    if ($("xh-dot-btn")) {
      $("xh-dot-btn").addEventListener("click", () => {
        this.xhair.center = !this.xhair.center;
        this._saveXhair();
        this._syncXhairUI();
      });
    }
    if ($("xh-outline-btn")) {
      $("xh-outline-btn").addEventListener("click", () => {
        this.xhair.outline = !this.xhair.outline;
        this._saveXhair();
        this._syncXhairUI();
      });
    }
    this._fillLookRow("look-skin-row", SKINS, "skin");
    this._fillLookRow("look-hairc-row", HAIR_COLORS, "hairColor");
    this._fillLookRow("look-shirt-row", SHIRTS, "shirt");
    this._fillLookRow("look-pants-row", PANTS, "pants");
    if ($("look-hair-row")) {
      $("look-hair-row").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-look-hair]");
        if (!btn) return;
        this.look.hair = btn.dataset.lookHair;
        this._commitLook();
      });
    }
    if ($("look-gear-row")) {
      $("look-gear-row").addEventListener("click", (e) => {
        if (e.target.closest("#look-vest-btn")) {
          this.look.vest = !this.look.vest;
          this._commitLook();
          return;
        }
        const btn = e.target.closest("[data-look-helm]");
        if (!btn) return;
        this.look.helmet = btn.dataset.lookHelm;
        this._commitLook();
      });
    }
    if ($("look-beard-row")) {
      $("look-beard-row").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-look-beard]");
        if (!btn) return;
        this.look.beard = btn.dataset.lookBeard;
        this._commitLook();
      });
    }
    if ($("look-random-btn")) {
      $("look-random-btn").addEventListener("click", () => {
        this.look = randomLook();
        this._commitLook();
      });
    }
  }

  _toggleSettings() {
    if (this.inSettings) this._closeSettings();
    else this._openSettings();
  }

  _openSettings() {
    this.inSettings = true;
    this._hideAdsUi();
    if (this.running && !this.matchOver && !this.inShop) {
      this.paused = true;
      $("paused").classList.add("hidden");
      if (document.exitPointerLock) document.exitPointerLock();
    }
    $("settings").classList.remove("hidden");
    this._syncXhairUI();
    this._syncLookUI();
    this._syncLookHint();
  }

  _closeSettings() {
    const resumeGame = this.running && !this.matchOver && !this.inShop && this.inSettings && this.paused;
    this.inSettings = false;
    $("settings").classList.add("hidden");
    if (resumeGame) {
      this.paused = false;
      $("paused").classList.add("hidden");
      this._requestLock();
    }
    this._syncLookHint();
  }

  _syncLookHint() {
    const hint = $("look-hint");
    if (!hint) return;
    const show = this.running && !this.paused && !this.matchOver && !this.inShop && !this.inSettings && !this.pointerLocked && !this.usingTouch;
    hint.classList.toggle("hidden", !show);
  }

  _loadMap(mapId) {
    mapId = MAPS[mapId] ? mapId : "warehouse";
    if (this.worldRoot) this.scene.remove(this.worldRoot);
    const built = buildWorld(this.scene, mapId, this.renderer);
    this.worldRoot = built.root;
    this.colliders = built.colliders;
    this.cover = built.cover;
    this.spawns = built.spawns;
    this.nav = new NavGrid(CFG.world, 1.5, this.colliders);
    this.mapId = mapId;
    this._miniWalls = null;
    this.flagHomes = [built.flagA.clone(), built.flagB.clone()];
    this.hill = built.hill || { x: 0, z: 0, r: 5.2 };
    this.hillRing = built.hillRing || null;
    this.padA = built.padA || null;
    this.padB = built.padB || null;
    if (this.flagGroup) {
      this.scene.remove(this.flagGroup);
      this.flagGroup = null;
      this.flags = [];
    }
    if ($("map-name-hud")) $("map-name-hud").textContent = MAPS[mapId].name;
    this._refreshMannequin();
  }

  _setGame(id) {
    const mode = MODES[id] || MODES.ffa;
    this.modeId = mode.id;
    this.mode = mode;
    for (const btn of $("game-row").querySelectorAll("[data-game]")) {
      btn.classList.toggle("on", btn.dataset.game === mode.id);
    }
    if ($("mode-name-hud")) $("mode-name-hud").textContent = mode.short;
    this._syncTeamPick();
  }

  _syncTeamPick() {
    const el = $("team-block");
    if (!el) return;
    el.classList.remove("hidden");
    el.style.opacity = this._isTeamMode() || this.online ? "1" : "0.55";
  }

  _setWantTeam(id) {
    this.wantTeam = Number(id) === 1 ? 1 : 0;
    if ($("team-row")) {
      for (const btn of $("team-row").querySelectorAll("[data-team]")) {
        btn.classList.toggle("on", Number(btn.dataset.team) === this.wantTeam);
      }
    }
    if (this.player && this._isTeamMode() && !this.running) {
      this._assignTeam(this.player, 0, this.wantTeam);
    }
  }

  _isTeamMode() {
    return !!(this.mode && this.mode.teams);
  }

  _sameTeam(a, b) {
    return this._isTeamMode() && a && b && a.team === b.team;
  }

  _assignTeam(ent, index, forced) {
    if (!this._isTeamMode()) {
      ent.team = -1;
      return;
    }
    if (forced === 0 || forced === 1) ent.team = forced;
    else if (ent.isPlayer) ent.team = this.wantTeam === 1 ? 1 : 0;
    else ent.team = ((index % 2) + 2) % 2;
    ent.color = TEAMS[ent.team].color;
  }

  _makeFlagMesh(color) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 })
    );
    pole.position.y = 1.2;
    g.add(pole);
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.5, 0.04),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.45 })
    );
    cloth.position.set(0.42, 2.0, 0);
    g.add(cloth);
    return g;
  }

  _setupObjectives() {
    if (this.flagGroup) this.scene.remove(this.flagGroup);
    this.flagGroup = new THREE.Group();
    this.scene.add(this.flagGroup);
    const a = this.flagHomes[0] || new THREE.Vector3(-24, 0, 0);
    const b = this.flagHomes[1] || new THREE.Vector3(24, 0, 0);
    this.flags = [
      { team: 0, home: a.clone(), pos: a.clone(), carrierId: null, mesh: this._makeFlagMesh(TEAMS[0].color) },
      { team: 1, home: b.clone(), pos: b.clone(), carrierId: null, mesh: this._makeFlagMesh(TEAMS[1].color) },
    ];
    this.flagGroup.add(this.flags[0].mesh);
    this.flagGroup.add(this.flags[1].mesh);
    this.flagGroup.visible = this.modeId === "ctf";
    if (this.hillRing) this.hillRing.visible = this.modeId === "koth";
    if (this.padA) this.padA.visible = this.modeId === "ctf";
    if (this.padB) this.padB.visible = this.modeId === "ctf";
    this._poseFlags();
    this.teamScore = [0, 0];
    this._hillAcc = 0;
    this._hillHold = -1;
  }

  _dropFlag(ent) {
    if (!ent || this.modeId !== "ctf") return;
    for (const fl of this.flags) {
      if (fl.carrierId === ent.id) {
        fl.carrierId = null;
        fl.pos.set(ent.pos.x, 0, ent.pos.z);
      }
    }
    this._poseFlags();
  }

  _flagState(fl) {
    if (!fl) return "—";
    if (fl.carrierId != null) {
      const c = this._byId(fl.carrierId);
      return "TAKEN" + (c ? " · " + c.name : "");
    }
    if (fl.home && fl.pos.distanceTo(fl.home) > 1.4) return "DROPPED";
    return "HOME";
  }

  _objFeed(text) {
    const row = document.createElement("div");
    row.className = "feed-row";
    row.innerHTML = `<b>${text}</b>`;
    const feed = $("killfeed");
    if (!feed) return;
    feed.prepend(row);
    while (feed.children.length > 6) feed.lastChild.remove();
    setTimeout(() => row.remove(), 4200);
  }

  _updateObjectives(dt) {
    if (this._driveRounds()) {
      if (this.modeId === "ctf") this._updateCtf();
      else if (this.modeId === "koth") this._updateKoth(dt);
    }
    this._poseFlags();
  }

  _updateCtf() {
    if (this.flags.length < 2) return;
    for (const f of this.fighters) {
      if (!f.alive || f.team < 0) continue;
      const own = this.flags[f.team];
      const enemy = this.flags[1 - f.team];
      if (!own || !enemy) continue;

      if (own.carrierId == null && own.pos.distanceTo(own.home) > 1.2 && f.pos.distanceTo(own.pos) < 1.75) {
        this._resetFlag(own);
        this._banner("FLAG RETURNED");
        this._objFeed(f.name + " returned the " + TEAMS[own.team].name + " flag");
      }

      if (enemy.carrierId == null && f.pos.distanceTo(enemy.pos) < 1.75) {
        const holding = this.flags.some((fl) => fl.carrierId === f.id);
        if (!holding) {
          enemy.carrierId = f.id;
          this._banner(f.name + " TOOK THE FLAG");
          this._objFeed(f.name + " took the " + TEAMS[enemy.team].name + " flag");
        }
      }

      if (
        enemy.carrierId === f.id &&
        own.carrierId == null &&
        own.pos.distanceTo(own.home) < 1.2 &&
        f.pos.distanceTo(own.home) < 2.5
      ) {
        this.teamScore[f.team] += 1;
        this._resetFlag(enemy);
        if (f.isPlayer) {
          this.credits += 150;
          if ($("credits-hud")) $("credits-hud").textContent = String(this.credits);
        }
        this._banner(TEAMS[f.team].name + " CAPTURE " + this.teamScore[f.team]);
        this._objFeed(f.name + " captured for " + TEAMS[f.team].name);
      }
    }
  }

  _updateKoth(dt) {
    const present = [0, 0];
    const r2 = (this.hill.r || 5.2) * (this.hill.r || 5.2);
    for (const f of this.fighters) {
      if (!f.alive || f.team < 0) continue;
      const dx = f.pos.x - this.hill.x;
      const dz = f.pos.z - this.hill.z;
      if (dx * dx + dz * dz <= r2) present[f.team] += 1;
    }
    if (present[0] && present[1]) this._hillHold = -2;
    else if (present[0]) this._hillHold = 0;
    else if (present[1]) this._hillHold = 1;
    else this._hillHold = -1;
    if (this._hillHold >= 0) {
      this._hillAcc += dt;
      while (this._hillAcc >= 1) {
        this._hillAcc -= 1;
        this.teamScore[this._hillHold] += 1;
      }
    } else {
      this._hillAcc = 0;
    }
  }

  _objPayload() {
    return {
      t: "obj",
      a: this.teamScore[0] | 0,
      b: this.teamScore[1] | 0,
      h: this._hillHold,
      flags: this.flags.map((fl) => ({
        x: Math.round(fl.pos.x * 100) / 100,
        z: Math.round(fl.pos.z * 100) / 100,
        c: fl.carrierId == null ? -1 : fl.carrierId,
      })),
    };
  }

  _applyObj(msg) {
    if (this._driveRounds()) return;
    if (msg.a != null) this.teamScore[0] = msg.a;
    if (msg.b != null) this.teamScore[1] = msg.b;
    if (msg.h != null) this._hillHold = msg.h;
    if (msg.flags && this.flags.length) {
      for (let i = 0; i < 2; i++) {
        const s = msg.flags[i];
        if (!s || !this.flags[i]) continue;
        this.flags[i].pos.set(s.x, 0, s.z);
        this.flags[i].carrierId = s.c >= 0 ? s.c : null;
      }
    }
    this._poseFlags();
  }

  _poseFlags() {
    for (const f of this.flags) {
      const c = f.carrierId != null ? this._byId(f.carrierId) : null;
      if (c && c.alive) {
        f.pos.set(c.pos.x, 0, c.pos.z);
        f.mesh.position.set(c.pos.x, 0.15, c.pos.z);
      } else {
        f.mesh.position.set(f.pos.x, 0, f.pos.z);
      }
    }
  }

  _resetFlag(f) {
    f.carrierId = null;
    f.pos.copy(f.home);
    this._poseFlags();
  }

  _setDifficulty(id) {
    const diff = DIFFICULTY[id] || DIFFICULTY.normal;
    this.diffId = diff.id;
    this.difficulty = diff;
    for (const btn of $("diff-row").querySelectorAll("[data-diff]")) {
      btn.classList.toggle("on", btn.dataset.diff === diff.id);
    }
    if ($("diff-name-hud")) $("diff-name-hud").textContent = diff.name;
  }

  _setMap(id) {
    if (this.running || !this.scene) return;
    const map = MAPS[id] ? id : "warehouse";
    for (const btn of $("map-row").querySelectorAll("[data-map]")) {
      btn.classList.toggle("on", btn.dataset.map === map);
    }
    this._loadMap(map);
  }

  _playerName() {
    const raw = ($("player-name") && $("player-name").value) || "YOU";
    return raw.trim().toUpperCase().slice(0, 12) || "YOU";
  }

  _setMode(online) {
    this.online = !!online;
    if ($("mode-local")) $("mode-local").classList.toggle("on", !this.online);
    if ($("mode-online")) $("mode-online").classList.toggle("on", this.online);
    if ($("online-actions")) $("online-actions").classList.toggle("hidden", !this.online);
    if ($("menu-eyebrow")) $("menu-eyebrow").textContent = this.online ? "ONLINE DEATHMATCH" : "LOCAL MATCH";
    if ($("btn-start")) $("btn-start").textContent = this.online ? "CREATE ROOM" : "PLAY";
    if (this.online) {
      if ($("net-status")) $("net-status").textContent = "Connecting…";
      this._renderLobbies([]);
      if ($("lobby-list")) {
        const empty = $("lobby-list").querySelector(".lobby-empty");
        if (empty) empty.textContent = "Connecting to find rooms…";
      }
      this.net.connect();
      this._startLobbyWatch();
    } else {
      this._stopLobbyWatch();
    }
    this._syncTeamPick();
  }

  _startLobbyWatch() {
    this._stopLobbyWatch(true);
    this.net.watch();
    this._lobbyTimer = setInterval(() => {
      if (this.online && !this.running) this.net.listLobbies();
      else this._stopLobbyWatch();
    }, 2000);
  }

  _stopLobbyWatch(keepSocket) {
    if (this._lobbyTimer) {
      clearInterval(this._lobbyTimer);
      this._lobbyTimer = null;
    }
    if (!keepSocket) this.net.unwatch();
  }

  _renderLobbies(rooms) {
    const el = $("lobby-list");
    if (!el) return;
    el.replaceChildren();
    const list = Array.isArray(rooms) ? rooms : [];
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "lobby-empty";
      empty.textContent = this.online
        ? "No open lobbies yet. Hit CREATE ROOM and it will show up here."
        : "Switch to ONLINE to see rooms.";
      el.appendChild(empty);
      return;
    }
    for (const r of list) {
      const max = r.max || 8;
      const full = (r.players || 0) >= max;
      const map = (MAPS[r.map] && MAPS[r.map].name) || "ARENA";
      const mode = (MODES[r.mode] && MODES[r.mode].short) || "FFA";
      const diff = (DIFFICULTY[r.diff] && DIFFICULTY[r.diff].name) || "";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lobby-row" + (full ? " full" : "");
      row.dataset.join = r.code || "";
      row.disabled = full || !r.code;
      const code = document.createElement("span");
      code.className = "lobby-code";
      code.textContent = r.code || "----";
      const meta = document.createElement("span");
      meta.className = "lobby-meta";
      const host = document.createElement("b");
      host.textContent = r.host || "HOST";
      const info = document.createElement("i");
      const bits = [r.players + "/" + max, mode, map];
      if (diff) bits.push(diff);
      if (r.bots) bits.push(r.bots + " BOTS");
      info.textContent = bits.join(" · ");
      meta.append(host, info);
      const go = document.createElement("span");
      go.className = "lobby-go";
      go.textContent = full ? "FULL" : "JOIN";
      row.append(code, meta, go);
      el.appendChild(row);
    }
  }

  _joinLobby(code) {
    if ($("room-code")) $("room-code").value = String(code || "").toUpperCase();
    this._joinRoom();
  }

  _createRoom() {
    $("net-status").textContent = "Creating room…";
    this.net.create(
      this._playerName(),
      parseInt($("bots").value, 10),
      this.mapId,
      this.diffId,
      this.modeId,
      this.look,
      this.wantTeam
    );
  }

  _joinRoom() {
    const code = ($("room-code").value || "").trim();
    if (!code) {
      $("net-status").textContent = "Enter a room code to join.";
      return;
    }
    $("net-status").textContent = "Joining " + code.toUpperCase() + "…";
    this.net.join(code, this._playerName(), this.look, this.wantTeam);
  }

  _onNet(msg) {
    if (msg.t === "err") {
      if ($("net-status")) $("net-status").textContent = msg.m || "Network error.";
      return;
    }
    if (msg.t === "open") {
      if (this.online && !this.running) {
        if ($("net-status")) $("net-status").textContent = "Connected. Pick a lobby, or create one.";
        this.net.watch();
      }
      return;
    }
    if (msg.t === "lobbies") {
      if (!this.running) this._renderLobbies(msg.rooms || []);
      return;
    }
    if (msg.t === "ok") {
      this._stopLobbyWatch();
      $("net-status").textContent = "Room " + msg.code + " — share this code.";
      $("room-code").value = msg.code;
      if (msg.team === 0 || msg.team === 1) this.wantTeam = msg.team;
      this.startMatch({
        online: true,
        netId: msg.id,
        players: msg.players,
        bots: msg.bots,
        host: msg.host,
        map: msg.map,
        diff: msg.diff,
        mode: msg.mode,
      });
      return;
    }
    if (msg.t === "close" && this.online && this.running) {
      $("net-status").textContent = "Disconnected from the room.";
    }
    if (!this.running) return;
    if (msg.t === "join") this._addRemote(msg.id, msg.name, msg.color, false, msg.look, msg.team);
    if (msg.t === "leave") this._removeRemote(msg.id);
    if (msg.t === "host") this.net.host = !!msg.host;
    if (msg.t === "look") {
      const f = this._byId(msg.id) || this._addRemote(msg.id, msg.name, msg.color, false, msg.look, msg.team);
      if (f) this._setLook(f, msg.look);
    }
    if (msg.t === "st") this._applyPeerState(msg);
    if (msg.t === "bst" && !this.net.host) this._applyBotStates(msg.bots || []);
    if (msg.t === "shot") this._netShot(msg);
    if (msg.t === "hit") this._netHit(msg);
    if (msg.t === "shop") this._openShop(true);
    if (msg.t === "next") this._nextRound(true);
    if (msg.t === "obj") this._applyObj(msg);
    if (msg.t === "reset") this.startMatch({ keepOnline: true, mode: this.modeId, map: this.mapId, diff: this.diffId });
  }

  _byId(id) {
    return this.fighters.find((f) => f && f.id === id) || null;
  }

  _rebuildFighters() {
    this.fighters = [this.player, ...this.humans, ...this.bots].filter(Boolean);
  }

  _addRemote(id, name, color, isBot, look, team) {
    if (!id || (this.player && id === this.player.id) || this._byId(id)) return null;
    const f = this._makeFighter(name || "PLAYER", color || 0x8892a0, false);
    f.id = id;
    this._assignTeam(f, id - 1, team === 0 || team === 1 ? team : undefined);
    if (this._isTeamMode() && f.team >= 0) f.color = TEAMS[f.team].color;
    f.isRemote = true;
    f.isBot = !!isBot;
    f.arch = isBot ? ARCHETYPES[id % ARCHETYPES.length] : { id: "human" };
    f.look = look ? sanitizeLook(look) : randomLook(f.color);
    f.lookKey = lookKey(f.look);
    const rig = this._makeRig(f);
    this.scene.add(rig.group);
    f.rig = rig;
    if (isBot) this.bots.push(f);
    else this.humans.push(f);
    this._rebuildFighters();
    this._spawn(f);
    return f;
  }

  _removeRemote(id) {
    const f = this._byId(id);
    if (!f || f.isPlayer) return;
    if (f.rig) this.scene.remove(f.rig.group);
    this.bots = this.bots.filter((b) => b !== f);
    this.humans = this.humans.filter((h) => h !== f);
    this._rebuildFighters();
  }

  _applyPeerState(msg) {
    if (!msg || msg.id === this.player?.id) return;
    let f = this._byId(msg.id);
    if (!f) f = this._addRemote(msg.id, msg.name, msg.color, false, msg.look, msg.team);
    if (!f) return;
    this._setNetPose(f, msg.x, msg.y, msg.z, msg.yaw, msg.pitch);
    f.health = msg.hp;
    f.alive = !!msg.alive;
    f.crouching = !!msg.cr;
    if (msg.k != null) f.kills = msg.k;
    if (msg.d != null) f.deaths = msg.d;
    if (msg.team != null) f.team = msg.team;
    if (msg.look) this._setLook(f, msg.look);
  }

  _applyBotStates(list) {
    const seen = new Set();
    for (const b of list) {
      seen.add(b.id);
      let f = this._byId(b.id);
      if (!f) f = this._addRemote(b.id, b.name, b.color, true, b.look, b.team);
      if (!f) continue;
      this._setNetPose(f, b.x, b.y, b.z, b.yaw, 0);
      f.health = b.hp;
      f.alive = !!b.alive;
      if (b.k != null) f.kills = b.k;
      if (b.d != null) f.deaths = b.d;
      if (b.team != null) f.team = b.team;
      if (b.look) this._setLook(f, b.look);
    }
    for (const bot of [...this.bots]) {
      if (bot.isRemote && !seen.has(bot.id)) this._removeRemote(bot.id);
    }
  }

  _setNetPose(f, x, y, z, yaw, pitch) {
    if (!f.netPos) f.netPos = new THREE.Vector3();
    f.netPos.set(x, y, z);
    f.netYaw = yaw;
    f.netPitch = pitch || 0;
    if (!f._netInit) {
      f.pos.copy(f.netPos);
      f.yaw = f.netYaw;
      f.pitch = f.netPitch;
      f._netInit = true;
    }
  }

  _interpRemote(f, dt) {
    if (!f.netPos) {
      this._poseRemote(f, dt);
      return;
    }
    const dx = f.pos.x - f.netPos.x;
    const dz = f.pos.z - f.netPos.z;
    if (dx * dx + dz * dz > 64) {
      f.pos.copy(f.netPos);
      f.yaw = f.netYaw;
    } else {
      const k = 1 - Math.exp(-18 * dt);
      f.pos.lerp(f.netPos, k);
      f.yaw = lerpAng(f.yaw, f.netYaw, k);
      f.pitch = lerp(f.pitch, f.netPitch, k);
    }
    this._poseRemote(f, dt);
  }

  _poseRemote(f, dt = 0.016) {
    if (!f.rig) return;
    if (!f.alive) {
      f.rig.group.rotation.x = 1.2;
      f.rig.group.position.set(f.pos.x, f.pos.y, f.pos.z);
      return;
    }
    f.rig.group.visible = true;
    f.rig.group.rotation.x = 0;
    f.rig.group.position.copy(f.pos);
    f.rig.group.rotation.y = f.yaw;
    if (!f._lastPose) f._lastPose = f.pos.clone();
    const spd = f.pos.distanceTo(f._lastPose) / Math.max(dt, 0.008);
    f._lastPose.copy(f.pos);
    if (f.rig.skinned) {
      updateHumanAnim(f.rig, spd, dt);
    } else {
      f.walkPhase += 0.2;
      const swing = Math.sin(f.walkPhase) * 0.35;
      f.rig.larm.rotation.x = -swing * 0.5;
      f.rig.rarm.rotation.x = -1.05;
      f.rig.lleg.rotation.x = swing;
      f.rig.rleg.rotation.x = -swing;
    }
    f.rig.hpFg.scale.x = clamp(f.health / (f.maxHealth || 100), 0.02, 1);
    f.rig.hpFg.position.x = (f.rig.hpFg.scale.x - 1) * 0.39;
    f.rig.hpGroup.lookAt(this.camera.position);
  }

  _netShot(msg) {
    if (!msg || msg.id === this.player?.id) return;
    this._tracer(msg.ox, msg.oy, msg.oz, msg.ox + msg.dx * 40, msg.oy + msg.dy * 40, msg.oz + msg.dz * 40);
    const src = this._byId(msg.id);
    const dist = src && this.player ? this.player.pos.distanceTo(src.pos) : 12;
    this.audio.shoot(dist);
  }

  _netHit(msg) {
    if (!msg || !this.player) return;
    const attacker = this._byId(msg.id);
    const target = this._byId(msg.tid);
    if (!target) return;
    const mine = target.isPlayer || (!target.isRemote && this.net.host);
    if (mine) this.hurt(target, msg.dmg, attacker, msg.head, null, true);
  }

  _netTick(dt) {
    if (!this.online || !this.net.connected || !this.player) return;
    this._netAcc += dt;
    if (this._netAcc < 1 / CFG.netHz) return;
    this._netAcc = 0;
    this._netLookN = (this._netLookN || 0) + 1;
    const pulseLook = this._netLookN % 20 === 1;
    const p = this.player;
    const q = (n) => Math.round(n * 100) / 100;
    const st = {
      t: "st",
      x: q(p.pos.x),
      y: q(p.pos.y),
      z: q(p.pos.z),
      yaw: q(p.yaw),
      pitch: q(p.pitch),
      hp: Math.round(p.health),
      alive: p.alive ? 1 : 0,
      cr: p.crouching ? 1 : 0,
      k: p.kills,
      d: p.deaths,
      team: p.team,
    };
    if (pulseLook) st.look = sanitizeLook(this.look);
    this.net.send(st);
    if (this.net.host && this.bots.length) {
      this.net.send({
        t: "bst",
        bots: this.bots.filter((b) => !b.isRemote).map((b) => {
          const row = {
            id: b.id,
            name: b.name,
            color: b.color,
            x: q(b.pos.x),
            y: q(b.pos.y),
            z: q(b.pos.z),
            yaw: q(b.yaw),
            hp: Math.round(b.health),
            alive: b.alive ? 1 : 0,
            k: b.kills,
            d: b.deaths,
            team: b.team,
          };
          if (pulseLook && b.look) row.look = b.look;
          return row;
        }),
      });
    }
    if (this.net.host && this._isTeamMode()) this.net.send(this._objPayload());
  }

  startMatch(opts = {}) {
    if (!this.scene || !this.renderer || !this.camera) {
      const tag = document.querySelector("#menu .tag");
      if (tag) tag.textContent = "Graphics are not ready yet. Refresh and try again.";
      return;
    }
    try {
      this.audio.init();
    } catch (_) {
      /* audio optional */
    }
    try {
      this.sens = parseFloat($("sens").value);
      const keepOnline = !!(opts.keepOnline || opts.online);
      this.online = keepOnline || this.online && !!opts.online;
      if (opts.online) this.online = true;
      if (opts.host != null) this.net.host = !!opts.host;
      this.botCount = opts.bots != null ? opts.bots : parseInt($("bots").value, 10);
      if (opts.diff && DIFFICULTY[opts.diff]) this._setDifficulty(opts.diff);
      if (opts.mode && MODES[opts.mode]) this._setGame(opts.mode);
      const wantMap = opts.map && MAPS[opts.map] ? opts.map : this.mapId;
      if (!this.worldRoot || wantMap !== this.mapId) this._loadMap(wantMap);
      $("menu").classList.add("hidden");
      $("match-over").classList.add("hidden");
      $("paused").classList.add("hidden");
      $("death-screen").classList.add("hidden");
      $("shop").classList.add("hidden");
      $("hud").classList.remove("hidden");
      this.matchOver = false;
      this.inShop = false;
      this.running = true;
      this.paused = false;
      this.time = 0;
      this.round = 1;
      this.roundLeft = CFG.roundTime;
      this.shopLeft = 0;
      this.credits = CFG.startCredit;
      this.owned = { rifle: true };
      this.weaponId = "rifle";
      this._firedSemi = false;
      this.aimT = 0;
      this.rmbDown = false;
      this.touchAim = false;
      if (this.inSettings) this._closeSettings();
      this.camera.fov = 78;
      this.camera.updateProjectionMatrix();
      this.pointerLocked = false;
      this._refreshMannequin();

      for (const b of this.bots) if (b.rig) this.scene.remove(b.rig.group);
      for (const h of this.humans) if (h.rig) this.scene.remove(h.rig.group);
      for (const e of this.effects) this.scene.remove(e.mesh);
      this.bots = [];
      this.humans = [];
      this.effects.length = 0;

      const myName = this._playerName();
      this.player = this._makeFighter(myName, 0x5ce1ff, true);
      this.player.look = sanitizeLook(this.look);
      this.player.lookKey = lookKey(this.player.look);
      if (opts.netId) this.player.id = opts.netId;
      this._assignTeam(this.player, this.player.id - 1, this.wantTeam);
      this._rebuildViewArms();

      const simulateBots = !this.online || this.net.host;
      if (simulateBots) {
        for (let i = 0; i < this.botCount; i++) {
          const op = OPERATORS[i % OPERATORS.length];
          const bot = this._makeFighter(op.name, op.color, false);
          bot.id = 1000 + i;
          this._assignTeam(bot, this.player.team === 0 ? i + 1 : i);
          const col = this._isTeamMode() ? TEAMS[bot.team].color : op.color;
          bot.color = col;
          bot.arch = ARCHETYPES[i % ARCHETYPES.length];
          bot.health = this.difficulty.hp;
          bot.maxHealth = this.difficulty.hp;
          bot.react = bot.arch.react * this.difficulty.react;
          bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
          bot.look = randomLook(this._isTeamMode() ? null : op.color);
          bot.lookKey = lookKey(bot.look);
          const rig = this._makeRig(bot);
          this.scene.add(rig.group);
          bot.rig = rig;
          this.bots.push(bot);
        }
      }

      if (this.online && opts.players) {
        for (const p of opts.players) {
          if (p.id === this.player.id) {
            if (p.team === 0 || p.team === 1) {
              this.wantTeam = p.team;
              this._assignTeam(this.player, 0, p.team);
            }
            continue;
          }
          this._addRemote(p.id, p.name, p.color, false, p.look, p.team);
        }
      }

      this._rebuildFighters();
      this._setupObjectives();
      this._equipWeapon("rifle", true);
      if (this.online && this.net.connected) this.net.send({ t: "look", look: sanitizeLook(this.look) });
      if ($("round-num")) $("round-num").textContent = "1";
      if ($("credits-hud")) $("credits-hud").textContent = String(this.credits);
      const used = new Set();
      for (const f of this.fighters) {
        if (f.isRemote) continue;
        this._spawn(f, used);
        used.add(f.spawnIndex);
      }

      if (this.online && this.net.code) {
        $("room-chip").classList.remove("hidden");
        $("room-code-hud").textContent = this.net.code;
        this._banner("ROOM " + this.net.code);
      } else {
        $("room-chip").classList.add("hidden");
        this._banner(
          (this.mode ? this.mode.short + " · " : "") +
            (MAPS[this.mapId] ? MAPS[this.mapId].name : "ARENA") +
            " · " +
            this.difficulty.name
        );
      }
      try {
        this.audio.spawn();
      } catch (_) {}
      this._syncLookHint();
      this._requestLock();
    } catch (err) {
      console.error(err);
      $("menu").classList.remove("hidden");
      const tag = document.querySelector("#menu .tag");
      if (tag) tag.textContent = "Could not start the match. Try Chrome or Firefox on a computer.";
    }
  }

  _makeFighter(name, color, isPlayer) {
    return {
      id: this.idSeq++,
      name,
      color,
      isPlayer,
      team: -1,
      pos: new THREE.Vector3(),
      netPos: new THREE.Vector3(),
      netYaw: 0,
      netPitch: 0,
      _netInit: false,
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      health: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      ammo: CFG.mag,
      reserve: CFG.reserve,
      weaponId: "rifle",
      gunAmmo: {},
      reloadT: 0,
      shootCd: 0,
      crouching: false,
      grounded: true,
      radius: CFG.radius,
      recoil: 0,
      bloom: 0,
      walkPhase: Math.random() * 10,
      look: null,
      lookKey: "",
      lastHurtBy: null,
      lastHurtAt: -99,
      respawnT: 0,
      path: [],
      repath: 0,
      target: null,
      lastSeen: null,
      lastSeenAt: -99,
      react: 0.3,
      alert: null,
      alertAt: -99,
      coverGoal: null,
      stuckT: 0,
      lastXZ: new THREE.Vector2(),
      footT: 0,
      _prevY: 0,
      spawnIndex: 0,
      deathT: 0,
      _wx: 0,
      _wz: 0,
    };
  }

  _spawn(ent, used = new Set()) {
    let best = 0;
    let bestScore = -1;
    let found = false;
    for (let i = 0; i < this.spawns.length; i++) {
      if (used.has(i)) continue;
      const s = this.spawns[i];
      if (this._isTeamMode() && s.team != null && ent.team >= 0 && s.team !== ent.team) continue;
      let score = 1000;
      for (const o of this.fighters) {
        if (o === ent || !o.alive) continue;
        score = Math.min(score, s.distanceTo(o.pos));
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
        found = true;
      }
    }
    if (!found) {
      for (let i = 0; i < this.spawns.length; i++) {
        if (used.has(i)) continue;
        best = i;
        break;
      }
    }
    const s = this.spawns[best];
    ent.spawnIndex = best;
    ent.pos.set(s.x, 0, s.z);
    ent.vel.set(0, 0, 0);
    ent.health = ent.isPlayer || !ent.arch || ent.arch.id === "human" ? 100 : this.difficulty.hp;
    ent.alive = true;
    const w = WEAPONS[ent.weaponId] || WEAPONS.rifle;
    if (ent.isPlayer) {
      ent.ammo = w.mag;
      ent.reserve = w.reserve;
      if (!ent.gunAmmo) ent.gunAmmo = {};
      ent.gunAmmo[w.id] = { ammo: w.mag, reserve: w.reserve };
    } else {
      ent.ammo = CFG.mag;
      ent.reserve = CFG.reserve;
    }
    ent.reloadT = 0;
    ent.yaw = yawTo(s.x, s.z, 0, 0);
    ent.pitch = 0;
    ent.target = null;
    ent.path = [];
    ent.deathT = 0;
    ent._prevY = 0;
    if (ent.rig) {
      ent.rig.group.visible = true;
      ent.rig.group.rotation.x = 0;
    }
  }

  _banner(text) {
    const el = $("banner");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => el.classList.remove("show"), 1400);
  }

  _weapon() {
    return WEAPONS[this.weaponId] || WEAPONS.rifle;
  }

  _saveGunAmmo() {
    const p = this.player;
    if (!p) return;
    if (!p.gunAmmo) p.gunAmmo = {};
    p.gunAmmo[p.weaponId || this.weaponId] = { ammo: p.ammo, reserve: p.reserve };
  }

  _equipWeapon(id, force = false) {
    const w = WEAPONS[id];
    if (!w) return;
    if (!this.running && !force) return;
    if (!force && !this.owned[id]) {
      this._banner("NOT OWNED");
      return;
    }
    if (this.player && this.weaponId === id && this.player.weaponId === id && !force) return;
    if (this.player) this._saveGunAmmo();
    this.weaponId = id;
    if (this.player) {
      this.player.weaponId = id;
      this.player.reloadT = 0;
      const saved = this.player.gunAmmo && this.player.gunAmmo[id];
      this.player.ammo = saved ? saved.ammo : w.mag;
      this.player.reserve = saved ? saved.reserve : w.reserve;
    }
    if (this.viewmodel && this.gunRoot) {
      this.viewmodel.remove(this.gunRoot);
      const gun = createWeapon(id, false);
      gun.scale.set(1.28, 1.28, 1.28);
      gun.position.set(0.32, -0.28, this.gunRestZ || -0.62);
      gun.rotation.set(0.04, 0.08, -0.04);
      this.viewmodel.add(gun);
      this.gunRoot = gun;
    }
    this._poseViewHands(id);
    const flashZ = id === "sniper" ? -1.55 : id === "shotgun" ? -1.42 : id === "smg" ? -1.12 : -1.22;
    if (this.muzzleFlash) this.muzzleFlash.position.z = flashZ;
    if (this.muzzleLight) this.muzzleLight.position.z = flashZ + 0.15;
    if ($("weapon-name")) {
      $("weapon-name").textContent = w.name.toUpperCase() + " · " + (w.auto ? "FULL AUTO" : "SEMI AUTO");
    }
    if (this.inShop) this._renderShop();
  }

  _buyOrEquip(id) {
    const w = WEAPONS[id];
    if (!w) return;
    if (this.owned[id]) {
      this._equipWeapon(id);
      return;
    }
    if (this.credits < w.price) {
      this._banner("NOT ENOUGH CREDITS");
      return;
    }
    this.credits -= w.price;
    this.owned[id] = true;
    this._equipWeapon(id, true);
    if ($("credits-hud")) $("credits-hud").textContent = String(this.credits);
    this._renderShop();
    this._banner("BOUGHT " + w.name.toUpperCase());
  }

  _ranked() {
    return [...this.fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  _boardHtml() {
    return this._ranked()
      .slice(0, 8)
      .map((f, i) => {
        const tag = this._isTeamMode() && f.team >= 0 ? TEAMS[f.team].name[0] + " " : "";
        return `<div class="lb-row ${f.isPlayer ? "you" : ""}"><span>${i + 1}. ${tag}${f.name}</span><b>${f.kills}–${f.deaths}</b></div>`;
      })
      .join("");
  }

  _renderShop() {
    if ($("shop-credits")) $("shop-credits").textContent = "¢ " + this.credits;
    if ($("shop-board")) $("shop-board").innerHTML = this._boardHtml();
    if ($("shop-items")) {
      $("shop-items").innerHTML = WEAPON_ORDER.map((id) => {
        const w = WEAPONS[id];
        const owned = !!this.owned[id];
        const eq = this.weaponId === id;
        const locked = !owned && this.credits < w.price;
        return `<button type="button" class="shop-card ${owned ? "owned" : ""} ${eq ? "equipped" : ""} ${locked ? "locked" : ""}" data-buy="${id}">
          <div>${w.key} · ${w.name}</div>
          <div class="stat">${w.auto ? "FULL AUTO" : "SEMI"} · ${w.dmg} DMG · ${w.rpm} RPM · MAG ${w.mag}${
          w.pellets > 1 ? " · " + w.pellets + " PELLETS" : ""
        }</div>
          <div class="cost">${owned ? (eq ? "EQUIPPED" : "OWNED · EQUIP") : "¢ " + w.price}</div>
        </button>`;
      }).join("");
    }
  }

  _driveRounds() {
    return !this.online || this.net.host;
  }

  _openShop(fromNet = false) {
    if (this.inShop) return;
    this.inShop = true;
    this.shopLeft = CFG.shopTime;
    this.roundLeft = 0;
    this.aimT = 0;
    this.rmbDown = false;
    this.touchAim = false;
    this.camera.fov = 78;
    this.camera.updateProjectionMatrix();
    this._hideAdsUi();
    this.paused = false;
    $("paused").classList.add("hidden");
    if (document.exitPointerLock) document.exitPointerLock();
    $("shop").classList.remove("hidden");
    if ($("btn-next-round")) $("btn-next-round").classList.toggle("hidden", this.online && !this.net.host);
    if ($("round-timer")) {
      $("round-timer").textContent = "0:00";
      $("round-timer").classList.add("low");
    }
    this._renderShop();
    this._banner("ROUND OVER · ARMORY");
    if (!fromNet && this.online && this.net.host) this.net.send({ t: "shop" });
  }

  _nextRound(fromNet = false) {
    if (!this.inShop && !fromNet) return;
    if (!fromNet && this.online && !this.net.host) return;
    this.inShop = false;
    $("shop").classList.add("hidden");
    this.round += 1;
    this.roundLeft = CFG.roundTime;
    this.shopLeft = 0;
    if ($("round-num")) $("round-num").textContent = String(this.round);
    const used = new Set();
    for (const f of this.fighters) {
      if (f.isRemote) continue;
      if (f.isPlayer) {
        f.weaponId = this.weaponId;
        f.gunAmmo = {};
        for (const id of WEAPON_ORDER) {
          if (this.owned[id]) {
            const ww = WEAPONS[id];
            f.gunAmmo[id] = { ammo: ww.mag, reserve: ww.reserve };
          }
        }
      }
      this._spawn(f, used);
      used.add(f.spawnIndex);
    }
    if (this.modeId === "ctf") {
      for (const fl of this.flags) this._resetFlag(fl);
    }
    this._hillAcc = 0;
    this._hillHold = -1;
    this._equipWeapon(this.weaponId, true);
    $("death-screen").classList.add("hidden");
    this._updateHud();
    this._banner("ROUND " + this.round);
    this._requestLock();
    if (!fromNet && this.online && this.net.host) this.net.send({ t: "next" });
  }

  _updateShop(dt) {
    this.shopLeft -= dt;
    if ($("shop-timer")) $("shop-timer").textContent = "NEXT ROUND " + fmtTime(this.shopLeft);
    if ($("shop-credits")) $("shop-credits").textContent = "¢ " + this.credits;
    if (this.shopLeft <= 0 && this._driveRounds()) this._nextRound();
  }

  _loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.running && !this.paused && !this.matchOver) {
      if (this.inShop) this._updateShop(dt);
      else this.update(dt);
    }
    if (this.renderer && this.scene && this.camera) this.draw(dt);
    requestAnimationFrame(this._loop);
  }

  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.3) return true;
    const inv = 1 / len;
    for (const b of this.colliders) {
      const t = rayAABB(ax, ay, az, dx * inv, dy * inv, dz * inv, b, len - 0.35);
      if (t !== null) return false;
    }
    return true;
  }

  inFov(ent, tx, tz, fov) {
    const dx = tx - ent.pos.x;
    const dz = tz - ent.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    const fx = -Math.sin(ent.yaw);
    const fz = -Math.cos(ent.yaw);
    return (fx * dx + fz * dz) / dl >= Math.cos(fov * 0.5);
  }

  hitscan(ox, oy, oz, dx, dy, dz, maxDist, ignoreId) {
    let best = maxDist;
    let ent = null;
    let head = false;
    let wall = false;
    for (const b of this.colliders) {
      const t = rayAABB(ox, oy, oz, dx, dy, dz, b, best);
      if (t !== null && t < best) {
        best = t;
        wall = true;
        ent = null;
        head = false;
      }
    }
    for (const f of this.fighters) {
      if (!f.alive || f.id === ignoreId) continue;
      const src = this._byId(ignoreId);
      if (src && this._sameTeam(src, f)) continue;
      const by = f.pos.y + (f.crouching ? 0.72 : 1.08);
      const tb = raySphere(ox, oy, oz, dx, dy, dz, f.pos.x, by, f.pos.z, 0.36, best);
      if (tb !== null && tb < best) {
        best = tb;
        ent = f;
        head = false;
        wall = false;
      }
      const hy = f.pos.y + (f.crouching ? 1.18 : 1.64);
      const th = raySphere(ox, oy, oz, dx, dy, dz, f.pos.x, hy, f.pos.z, 0.2, best);
      if (th !== null && th < best) {
        best = th;
        ent = f;
        head = true;
        wall = false;
      }
    }
    return {
      dist: best,
      ent,
      head,
      wall,
      x: ox + dx * best,
      y: oy + dy * best,
      z: oz + dz * best,
    };
  }

  fire(ent, ox, oy, oz, dx0, dy0, dz0, spread, opts = {}) {
    const pellets = opts.pellets || 1;
    const shotDmg = opts.dmg != null ? opts.dmg : CFG.damage;
    const dist = ent.isPlayer ? 0 : this.player ? this.player.pos.distanceTo(ent.pos) : 8;
    this.audio.shoot(dist);
    this._alert(ent.pos, ent);
    if (this.online && this.net.connected && ent.isPlayer) {
      this.net.send({ t: "shot", ox, oy, oz, dx: dx0, dy: dy0, dz: dz0 });
    }
    let last = null;
    for (let i = 0; i < pellets; i++) {
      let dx = dx0 + (Math.random() - 0.5) * 2 * spread;
      let dy = dy0 + (Math.random() - 0.5) * 2 * spread;
      let dz = dz0 + (Math.random() - 0.5) * 2 * spread;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len;
      dy /= len;
      dz /= len;
      const hit = this.hitscan(ox, oy, oz, dx, dy, dz, 80, ent.id);
      if (i === 0) this._tracer(ox, oy, oz, hit.x, hit.y, hit.z);
      if (i === 0) this._sparks(hit.x, hit.y, hit.z);
      if (hit.ent) {
        if (this._sameTeam(ent, hit.ent)) continue;
        const dmgBase = shotDmg * (hit.head ? CFG.headMult : 1) * rand(0.92, 1.05);
        const dmg = ent.isPlayer ? dmgBase : dmgBase * this.difficulty.dmg;
        if (this.online && hit.ent.isRemote && ent.isPlayer) {
          this._hitmarker(hit.head);
          if (hit.head) this.audio.headshot();
          else this.audio.hit();
          this.net.send({ t: "hit", tid: hit.ent.id, dmg, head: !!hit.head });
          if (hit.ent.alive !== false) {
            const hp = hit.ent.health == null ? 100 : hit.ent.health;
            hit.ent.health = hp - dmg;
            if (hit.ent.health <= 0) {
              hit.ent.alive = false;
              ent.kills += 1;
              this._onPlayerKill(hit.head);
            }
          }
        } else {
          this.hurt(hit.ent, dmg, ent, hit.head, hit);
        }
      }
      last = hit;
    }
    return last;
  }

  _alert(pos, source) {
    for (const b of this.bots) {
      if (b === source || !b.alive) continue;
      if (b.pos.distanceTo(pos) < 38) {
        b.alert = pos.clone();
        b.alertAt = this.time;
      }
    }
  }

  hurt(ent, dmg, attacker, head, hit, fromNet = false) {
    if (!ent || !ent.alive) return;
    if (attacker && this._sameTeam(ent, attacker)) return;
    ent.health -= dmg;
    ent.lastHurtBy = attacker;
    ent.lastHurtAt = this.time;
    if (ent.isPlayer) {
      this.audio.hurt();
      $("damage-flash").style.opacity = "1";
      setTimeout(() => {
        $("damage-flash").style.opacity = "0";
      }, 90);
      this._hurtDir(attacker);
    } else if (attacker && attacker.isPlayer) {
      this._hitmarker(head);
      if (head) this.audio.headshot();
      else this.audio.hit();
    }
    if (ent.health <= 0) this.kill(ent, attacker, head, fromNet);
  }

  _hurtDir(attacker) {
    if (!attacker) return;
    const ang = yawTo(this.player.pos.x, this.player.pos.z, attacker.pos.x, attacker.pos.z);
    let d = ang - this.player.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const ids = ["dir-n", "dir-e", "dir-s", "dir-w"];
    const idx = ((Math.round(-d / (Math.PI / 2)) + 4) % 4);
    const el = $(ids[idx]);
    el.style.opacity = "1";
    setTimeout(() => {
      el.style.opacity = "0";
    }, 380);
  }

  _hitmarker(head) {
    const el = $("hitmarker");
    el.classList.add("show");
    el.classList.toggle("head", !!head);
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => el.classList.remove("show", "head"), 120);
  }

  _onPlayerKill(head) {
    this.credits += CFG.killCredit + (head ? CFG.headBonus : 0);
    if ($("credits-hud")) $("credits-hud").textContent = String(this.credits);
    this._giveKillAmmo(this.player);
  }

  _giveKillAmmo(ent) {
    if (!ent || !ent.isPlayer) return;
    const w = WEAPONS[ent.weaponId] || WEAPONS[this.weaponId] || WEAPONS.rifle;
    let n = CFG.killAmmo;
    const magRoom = Math.max(0, w.mag - (ent.ammo || 0));
    const toMag = Math.min(n, magRoom);
    ent.ammo = (ent.ammo || 0) + toMag;
    n -= toMag;
    ent.reserve = (ent.reserve || 0) + n;
    if (!ent.gunAmmo) ent.gunAmmo = {};
    ent.gunAmmo[w.id] = { ammo: ent.ammo, reserve: ent.reserve };
    this._updateHud(0);
    this._banner("+40 AMMO");
  }

  kill(ent, attacker, head, fromNet = false) {
    if (!ent.alive && ent.health <= 0) {
      /* still allow first kill path */
    }
    ent.alive = false;
    ent.health = 0;
    ent.deaths += 1;
    ent.respawnT = CFG.respawn;
    ent.deathT = 0;
    ent.vel.set(0, 0, 0);
    if (attacker && attacker !== ent) {
      attacker.kills += 1;
      if (this.modeId === "tdm" && attacker.team >= 0 && !this._sameTeam(attacker, ent)) {
        this.teamScore[attacker.team] += 1;
      }
      if (attacker.isPlayer) this._onPlayerKill(head);
    }
    this._dropFlag(ent);
    this.audio.death();
    this._feed(attacker, ent, head);
    if (ent.isPlayer) {
      $("death-screen").classList.remove("hidden");
      $("killed-by").textContent = attacker ? `eliminated by ${attacker.name}` : "eliminated";
    }
  }

  _feed(attacker, victim, head) {
    const row = document.createElement("div");
    row.className = "feed-row";
    if (attacker && attacker.isPlayer) row.classList.add("you");
    if (victim.isPlayer) row.classList.add("dead");
    const a = attacker ? attacker.name : "ARENA";
    row.innerHTML = `<b>${a}</b> ${head ? "headshot" : "fragged"} <b>${victim.name}</b>`;
    const feed = $("killfeed");
    feed.prepend(row);
    while (feed.children.length > 6) feed.lastChild.remove();
    setTimeout(() => row.remove(), 4200);
  }

  _end(winner) {
    this.matchOver = true;
    this.running = true;
    document.exitPointerLock();
    $("match-over").classList.remove("hidden");
    $("winner-name").textContent = winner.name;
    $("winner-sub").textContent = winner.isPlayer ? "took the arena" : "outgunned the field";
    const ranked = [...this.fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    $("final-board").innerHTML = ranked
      .slice(0, 9)
      .map((f, i) => `${i + 1}. ${f.name}  ${f.kills}–${f.deaths}`)
      .join("<br>");
    this.audio.win();
  }

  _tracer(ax, ay, az, bx, by, bz) {
    if (this.effects.length > 40) {
      const old = this.effects.shift();
      this.scene.remove(old.mesh);
    }
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, dy / len, dz / len)
    );
    mesh.scale.y = len;
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.06, max: 0.06, fade: false });
  }

  _sparks(x, y, z) {
    const n = Math.min(3, 40 - this.effects.length);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.effects.push({
        mesh,
        life: 0.22,
        max: 0.22,
        vx: rand(-3, 3),
        vy: rand(1, 5),
        vz: rand(-3, 3),
        grav: true,
      });
    }
  }

  update(dt) {
    this.time += dt;
    this.roundLeft -= dt;
    if (this.roundLeft <= 0) {
      this._openShop();
      return;
    }
    if (this.player) this._updatePlayer(dt);
    for (const h of this.humans) {
      if (h.isRemote) this._interpRemote(h, dt);
    }
    for (const b of this.bots) this._updateBot(b, dt);
    this._separate();
    this._updateObjectives(dt);
    for (const f of this.fighters) {
      if (f.isRemote) continue;
      if (!f.alive) {
        f.respawnT -= dt;
        f.deathT += dt;
        if (f.respawnT <= 0) this._spawn(f);
      }
    }
    this._updateEffects(dt);
    this._netTick(dt);
    this._updateHud(dt);
  }

  _moveWish(ent, wx, wz, speed, dt) {
    const grounded = ent.grounded;
    if (grounded) {
      ent.vel.x = wx * speed;
      ent.vel.z = wz * speed;
    } else {
      ent.vel.x += wx * 8 * dt;
      ent.vel.z += wz * 8 * dt;
      const h = Math.hypot(ent.vel.x, ent.vel.z);
      const cap = speed * 1.05;
      if (h > cap) {
        ent.vel.x = (ent.vel.x / h) * cap;
        ent.vel.z = (ent.vel.z / h) * cap;
      }
    }
    ent.vel.y -= CFG.gravity * dt;
    this._collide(ent, dt);
  }

  _collide(ent, dt) {
    const r = ent.radius;
    const h = ent.crouching ? 1.12 : 1.7;
    ent.pos.x += ent.vel.x * dt;
    this._pushXZ(ent, r, h);
    ent.pos.z += ent.vel.z * dt;
    this._pushXZ(ent, r, h);
    ent.pos.y += ent.vel.y * dt;
    ent.grounded = false;
    if (ent.pos.y < 0) {
      ent.pos.y = 0;
      ent.vel.y = 0;
      ent.grounded = true;
    }
    for (const b of this.colliders) {
      if (b.max.y < 0.4 || ent.vel.y > 0.5) continue;
      if (ent._prevY >= b.max.y - 0.12 && ent.pos.y <= b.max.y + 0.02) {
        if (
          ent.pos.x > b.min.x - r &&
          ent.pos.x < b.max.x + r &&
          ent.pos.z > b.min.z - r &&
          ent.pos.z < b.max.z + r
        ) {
          ent.pos.y = b.max.y;
          ent.vel.y = 0;
          ent.grounded = true;
        }
      }
    }
    const limit = CFG.world / 2 - 0.6;
    ent.pos.x = clamp(ent.pos.x, -limit, limit);
    ent.pos.z = clamp(ent.pos.z, -limit, limit);
    ent._prevY = ent.pos.y;
  }

  _pushXZ(ent, r, h) {
    const y0 = ent.pos.y + 0.18;
    const y1 = ent.pos.y + h;
    for (const b of this.colliders) {
      if (y1 < b.min.y + 0.04 || y0 > b.max.y - 0.02) continue;
      const minx = b.min.x - r;
      const maxx = b.max.x + r;
      const minz = b.min.z - r;
      const maxz = b.max.z + r;
      if (ent.pos.x > minx && ent.pos.x < maxx && ent.pos.z > minz && ent.pos.z < maxz) {
        const px1 = ent.pos.x - minx;
        const px2 = maxx - ent.pos.x;
        const pz1 = ent.pos.z - minz;
        const pz2 = maxz - ent.pos.z;
        const m = Math.min(px1, px2, pz1, pz2);
        if (m === px1) ent.pos.x = minx;
        else if (m === px2) ent.pos.x = maxx;
        else if (m === pz1) ent.pos.z = minz;
        else ent.pos.z = maxz;
      }
    }
  }

  _separate() {
    const list = this.fighters;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.alive || !b.alive) continue;
        if (a.isRemote || b.isRemote) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius + 0.04;
        if (d > 0.001 && d < min) {
          const p = (min - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * p;
          a.pos.z -= nz * p;
          b.pos.x += nx * p;
          b.pos.z += nz * p;
        }
      }
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) {
      this.aimT = lerp(this.aimT, 0, 0.25);
      this._setScopeUi(0, this._weapon());
      if (this.camera.fov !== 78) {
        this.camera.fov = lerp(this.camera.fov, 78, 0.25);
        this.camera.updateProjectionMatrix();
      }
      $("respawn-cd").textContent = `RESPAWNING ${Math.max(0, p.respawnT).toFixed(1)}`;
      return;
    }
    $("death-screen").classList.add("hidden");
    p.crouching = this.keys.has("KeyC");
    const w = this._weapon();
    const wantAds =
      (this.rmbDown || this.keys.has("KeyE") || this.touchAim) &&
      !this.paused &&
      !this.inShop &&
      !this.inSettings;
    const adsRate = w.id === "sniper" ? 9 : 14;
    this.aimT = lerp(this.aimT, wantAds ? 1 : 0, 1 - Math.exp(-adsRate * dt));
    const ads = this.aimT;
    const sprint = !wantAds && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
    let ix = 0;
    let iz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iz -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iz += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    if (this.touchStick.active) {
      ix += this.touchStick.nx;
      iz += this.touchStick.ny;
    }
    const fl = Math.hypot(ix, iz) || 1;
    ix /= fl;
    iz /= fl;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const wx = fx * -iz + rx * ix;
    const wz = fz * -iz + rz * ix;
    let speed = p.crouching ? CFG.walk * 0.55 : sprint && iz < 0 ? CFG.sprint : CFG.walk;
    if (ads > 0.2) speed *= lerp(1, 0.72, ads);
    if (!p.grounded) speed *= 0.85;
    this._moveWish(p, wx, wz, speed, dt);
    if ((this.keys.has("Space") || this.touchJump) && p.grounded) p.vel.y = CFG.jump;

    const moving = Math.hypot(p.vel.x, p.vel.z) > 1.2 && p.grounded;
    if (moving) {
      p.walkPhase += dt * (sprint ? 11 : 8);
      p.footT -= dt;
      if (p.footT <= 0) {
        this.audio.footstep(sprint);
        p.footT = sprint ? 0.28 : 0.38;
      }
    }

    p.shootCd -= dt;
    p.bloom = Math.max(0, p.bloom - dt * 0.085);
    p.recoil = lerp(p.recoil, 0, 1 - Math.exp(-10 * dt));
    if (this.keys.has("KeyR") && p.reloadT <= 0 && p.ammo < w.mag && p.reserve > 0) {
      p.reloadT = w.reload;
      this.audio.reload();
    }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const need = w.mag - p.ammo;
        const take = Math.min(need, p.reserve);
        p.ammo += take;
        p.reserve -= take;
        this._saveGunAmmo();
      }
    }

    const holding = this.mouseDown || this.touchFire;
    if (!holding) this._firedSemi = false;
    const trigger = w.auto ? holding : holding && !this._firedSemi;
    const canFire =
      trigger &&
      p.reloadT <= 0 &&
      p.ammo > 0 &&
      p.shootCd <= 0 &&
      !this.paused &&
      !this.inShop;
    $("crosshair").classList.toggle("firing", canFire);
    if (canFire) {
      this._firedSemi = true;
      p.ammo -= 1;
      p.shootCd = 60 / w.rpm;
      p.recoil += w.recoil * lerp(1, 0.55, ads);
      p.bloom = Math.min(0.055, p.bloom + w.bloom * lerp(1, 0.35, ads));
      this.camera.updateMatrixWorld();
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      this.camera.getWorldPosition(origin);
      this.camera.getWorldDirection(dir);
      const hip = lerp(w.spread, w.adsSpread, ads);
      const spread =
        hip +
        p.bloom * lerp(1, 0.25, ads) +
        (moving ? 0.016 * lerp(1, 0.2, ads) : 0) +
        (p.grounded ? 0 : 0.022);
      this.fire(p, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, Math.max(0.0004, spread), {
        pellets: w.pellets,
        dmg: w.dmg,
      });
      this.muzzleLight.intensity = w.pellets > 1 ? 4.4 : 3.1;
      this.muzzleFlash.material.opacity = 1;
      this.gunRoot.position.z = (this.gunRestZ || -0.62) + 0.045;
      this._saveGunAmmo();
      if (p.ammo === 0 && p.reserve > 0) {
        p.reloadT = w.reload;
        this.audio.reload();
      }
    } else {
      this.muzzleLight.intensity = lerp(this.muzzleLight.intensity, 0, 0.35);
      this.muzzleFlash.material.opacity = lerp(this.muzzleFlash.material.opacity, 0, 0.4);
      this.gunRoot.position.z = lerp(this.gunRoot.position.z, this.gunRestZ || -0.62, 0.2);
    }

    const sway = Math.sin(p.walkPhase) * (moving ? 0.018 : 0.004) * (1 - ads);
    const bob = Math.abs(Math.sin(p.walkPhase * 2)) * (moving ? 0.012 : 0) * (1 - ads);
    const adsX = w.id === "sniper" ? -0.02 : -0.318;
    const adsY = w.id === "sniper" ? 0.12 : 0.255;
    const adsZ = w.id === "sniper" ? 0.22 : 0.16;
    this.viewmodel.position.x = lerp(sway, adsX, ads);
    this.viewmodel.position.y = lerp(bob, adsY, ads);
    this.viewmodel.position.z = lerp(0, adsZ, ads);
    this.viewmodel.rotation.x = lerp(0, w.id === "sniper" ? -0.02 : -0.04, ads);
    this.viewmodel.rotation.y = lerp(0, w.id === "sniper" ? 0 : -0.08, ads);
    this.viewmodel.rotation.z = lerp(0, 0.04, ads);
    this._poseViewHands(w.id);
    this._setScopeUi(ads, w);
    const fov = lerp(78, w.adsFov || 56, ads);
    if (Math.abs(this.camera.fov - fov) > 0.04) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  _setScopeUi(ads, w) {
    const sniper = w && w.id === "sniper";
    const scoped = sniper && ads > 0.55;
    const holo = !sniper && ads > 0.5;
    const ch = $("crosshair");
    if (ch) {
      ch.classList.toggle("ads", ads > 0.55 && !scoped);
      ch.classList.toggle("hidden-ads", scoped);
    }
    if ($("hud")) {
      $("hud").classList.toggle("ads", ads > 0.45);
      $("hud").classList.toggle("scope", scoped);
      $("hud").classList.toggle("holo", holo);
    }
    const sc = $("scope");
    if (sc) sc.classList.toggle("show", scoped);
  }

  _pickTarget(bot) {
    let best = null;
    let bestScore = 1e9;
    for (const o of this.fighters) {
      if (o === bot || !o.alive) continue;
      if (this._sameTeam(bot, o)) continue;
      const dist = bot.pos.distanceTo(o.pos);
      if (dist > 48) continue;
      const fov = bot.lastHurtAt > this.time - 2.2 ? 6.3 : bot.arch.fov;
      if (dist >= 4 && !this.inFov(bot, o.pos.x, o.pos.z, fov)) continue;
      const see = this.los(
        bot.pos.x,
        bot.pos.y + 1.5,
        bot.pos.z,
        o.pos.x,
        o.pos.y + 1.3,
        o.pos.z
      );
      if (!see) continue;
      let score = dist;
      if (o.isPlayer) score *= 0.82;
      if (bot.target === o) score *= 0.75;
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }

  _updateBot(bot, dt) {
    if (bot.isRemote) {
      this._interpRemote(bot, dt);
      return;
    }
    const rig = bot.rig;
    if (!bot.alive) {
      const t = clamp(bot.deathT / 0.45, 0, 1);
      rig.group.rotation.x = t * 1.2;
      rig.group.position.set(bot.pos.x, bot.pos.y + 0.2 * (1 - t), bot.pos.z);
      if (bot.deathT > 0.9) rig.group.visible = false;
      return;
    }
    rig.group.visible = true;
    rig.group.rotation.x = 0;

    bot.shootCd -= dt;
    bot.repath -= dt;
    if (bot.reloadT > 0) {
      bot.reloadT -= dt;
      if (bot.reloadT <= 0) {
        const need = CFG.mag - bot.ammo;
        const take = Math.min(need, bot.reserve);
        bot.ammo += take;
        bot.reserve -= take;
      }
    } else if (bot.ammo <= 0 && bot.reserve > 0) {
      bot.reloadT = CFG.reload + 0.2;
    }

    const vis = this._pickTarget(bot);
    if (vis) {
      bot.target = vis;
      bot.lastSeen = vis.pos.clone();
      bot.lastSeenAt = this.time;
    } else if (bot.target && (!bot.target.alive || this.time - bot.lastSeenAt > 4.5)) {
      bot.target = null;
    }

    const arch = bot.arch;
    let wishx = 0;
    let wishz = 0;
    let speed = CFG.botWalk * arch.speed * this.difficulty.speed;
    const threat = bot.target;
    const seeThreat =
      threat &&
      threat.alive &&
      this.los(bot.pos.x, bot.pos.y + 1.5, bot.pos.z, threat.pos.x, threat.pos.y + 1.3, threat.pos.z);
    const dist = seeThreat ? bot.pos.distanceTo(threat.pos) : 1e9;
    const carrying = this.modeId === "ctf" && this.flags.some((fl) => fl.carrierId === bot.id);

    if (carrying && bot.team >= 0) {
      const home = this.flagHomes[bot.team] || { x: -24, z: 0 };
      this._follow(bot, home.x, home.z);
      wishx = bot._wx || 0;
      wishz = bot._wz || 0;
      speed *= 1.08;
      if (seeThreat) {
        bot.react -= dt;
        bot.yaw = lerpAng(bot.yaw, yawTo(bot.pos.x, bot.pos.z, threat.pos.x, threat.pos.z), 1 - Math.exp(-8 * dt));
      } else if (wishx || wishz) {
        bot.yaw = lerpAng(
          bot.yaw,
          yawTo(bot.pos.x, bot.pos.z, bot.pos.x + wishx, bot.pos.z + wishz),
          1 - Math.exp(-6 * dt)
        );
      }
    } else if (seeThreat) {
      bot.react -= dt;
      bot.yaw = lerpAng(bot.yaw, yawTo(bot.pos.x, bot.pos.z, threat.pos.x, threat.pos.z), 1 - Math.exp(-8 * dt));
      const low = bot.health < 38 && arch.agr < 0.8;
      if (low) {
        const c = this._bestCover(bot, threat);
        if (c) {
          this._follow(bot, c.x, c.z);
          wishx = bot._wx || 0;
          wishz = bot._wz || 0;
        }
        speed *= 1.1;
      } else {
        const fx = -Math.sin(bot.yaw);
        const fz = -Math.cos(bot.yaw);
        const rx = Math.cos(bot.yaw);
        const rz = -Math.sin(bot.yaw);
        bot.strafeT = (bot.strafeT || 0) - dt;
        if ((bot.strafeT || 0) <= 0) {
          bot.strafeDir *= Math.random() < 0.3 ? 1 : -1;
          bot.strafeT = rand(0.4, 1.1);
        }
        let along = 0;
        if (dist > arch.range) along = 1;
        else if (dist < arch.range * 0.45) along = -1;
        wishx = fx * along + rx * bot.strafeDir * 0.85;
        wishz = fz * along + rz * bot.strafeDir * 0.85;
        const wl = Math.hypot(wishx, wishz) || 1;
        wishx /= wl;
        wishz /= wl;
        if (arch.id === "lurker" && dist < arch.range) {
          wishx *= 0.25;
          wishz *= 0.25;
        }
      }
    } else {
      bot.react = arch.react * this.difficulty.react;
      let gx = null;
      let gz = null;
      if (bot.lastSeen && this.time - bot.lastSeenAt < 5) {
        gx = bot.lastSeen.x;
        gz = bot.lastSeen.z;
      } else if (bot.alert && this.time - bot.alertAt < 6) {
        gx = bot.alert.x;
        gz = bot.alert.z;
      } else if (this.modeId === "ctf" && bot.team >= 0 && this.flags[1 - bot.team]) {
        const enemy = this.flags[1 - bot.team];
        gx = enemy.pos.x;
        gz = enemy.pos.z;
      } else if (this.modeId === "koth") {
        gx = this.hill.x;
        gz = this.hill.z;
      }
      if (gx == null) {
        if (!bot.path.length || bot.repath <= 0) {
          const w = this.nav.randomWalkable();
          bot.path = this.nav.path(bot.pos.x, bot.pos.z, w.x, w.z);
          bot.repath = rand(2.5, 5);
        }
      } else if (bot.repath <= 0 || !bot.path.length) {
        bot.path = this.nav.path(bot.pos.x, bot.pos.z, gx, gz);
        bot.repath = 0.7;
      }
      this._followPath(bot);
      wishx = bot._wx;
      wishz = bot._wz;
      if (wishx || wishz) bot.yaw = lerpAng(bot.yaw, yawTo(bot.pos.x, bot.pos.z, bot.pos.x + wishx, bot.pos.z + wishz), 1 - Math.exp(-6 * dt));
    }

    if (seeThreat && bot.react <= 0 && bot.reloadT <= 0 && bot.ammo > 0 && bot.shootCd <= 0 && dist < 48) {
      const rpm = arch.id === "sniper" ? 210 : arch.id === "rusher" ? 720 : 520;
      bot.shootCd = 60 / rpm;
      bot.ammo -= 1;
      const eye = 1.48;
      const ox = bot.pos.x - Math.sin(bot.yaw) * 0.45;
      const oy = bot.pos.y + eye;
      const oz = bot.pos.z - Math.cos(bot.yaw) * 0.45;
      const ty = threat.pos.y + (threat.crouching ? 0.9 : 1.25);
      let dx = threat.pos.x - ox;
      let dy = ty - oy;
      let dz = threat.pos.z - oz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl;
      dy /= dl;
      dz /= dl;
      const spread =
        (0.028 / (arch.acc * this.difficulty.acc)) * (1 + dist / 50) * this.difficulty.spread +
        (Math.hypot(bot.vel.x, bot.vel.z) > 2 ? 0.02 : 0);
      this.fire(bot, ox, oy, oz, dx, dy, dz, spread);
    }

    const moved = Math.hypot(bot.pos.x - bot.lastXZ.x, bot.pos.z - bot.lastXZ.y);
    if (Math.hypot(wishx, wishz) > 0.2 && moved < 0.04) bot.stuckT += dt;
    else bot.stuckT = 0;
    if (bot.stuckT > 1.1) {
      bot.path = this.nav.path(bot.pos.x, bot.pos.z, bot.pos.x + rand(-6, 6), bot.pos.z + rand(-6, 6));
      bot.stuckT = 0;
      bot.repath = 0.4;
    }
    bot.lastXZ.set(bot.pos.x, bot.pos.z);

    this._moveWish(bot, wishx, wishz, speed, dt);
    const spd = Math.hypot(bot.vel.x, bot.vel.z);
    bot.walkPhase += dt * (spd > 0.4 ? 9 : 0);
    if (rig.skinned) {
      updateHumanAnim(rig, spd, dt);
    } else {
      const swing = Math.sin(bot.walkPhase) * Math.min(1, spd / 4) * 0.7;
      rig.larm.rotation.x = -swing * 0.5;
      rig.rarm.rotation.x = seeThreat ? -1.15 : swing * 0.35;
      rig.lleg.rotation.x = swing;
      rig.rleg.rotation.x = -swing;
    }
    rig.group.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
    rig.group.rotation.y = bot.yaw;
    rig.hpFg.scale.x = clamp(bot.health / (bot.maxHealth || 100), 0.02, 1);
    rig.hpFg.position.x = (rig.hpFg.scale.x - 1) * 0.39;
    rig.hpGroup.lookAt(this.camera.position);
  }

  _follow(bot, x, z) {
    if (bot.repath <= 0) {
      bot.path = this.nav.path(bot.pos.x, bot.pos.z, x, z);
      bot.repath = 0.55;
    }
    this._followPath(bot);
  }

  _followPath(bot) {
    bot._wx = 0;
    bot._wz = 0;
    while (bot.path.length) {
      const wp = bot.path[0];
      const dx = wp.x - bot.pos.x;
      const dz = wp.z - bot.pos.z;
      if (dx * dx + dz * dz < 0.7) {
        bot.path.shift();
        continue;
      }
      const l = Math.hypot(dx, dz) || 1;
      bot._wx = dx / l;
      bot._wz = dz / l;
      break;
    }
  }

  _bestCover(bot, threat) {
    let best = null;
    let bestD = 1e9;
    for (const c of this.cover) {
      const blocked = !this.los(c.x, 1.2, c.z, threat.pos.x, threat.pos.y + 1.3, threat.pos.z);
      if (!blocked) continue;
      const d = bot.pos.distanceTo(c);
      if (d < bestD && d < 22) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  _updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.grav) {
        e.vy -= 18 * dt;
        e.mesh.position.x += e.vx * dt;
        e.mesh.position.y += e.vy * dt;
        e.mesh.position.z += e.vz * dt;
      }
      if (e.fade && e.mesh.material && e.mesh.material !== this.tracerMat && e.mesh.material !== this.sparkMat) {
        e.mesh.material.opacity = e.life / e.max;
      }
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        if (e.mesh.material && e.mesh.material !== this.tracerMat && e.mesh.material !== this.sparkMat) {
          if (e.fade) e.mesh.material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }

  _updateHud(dt = 0.2) {
    const p = this.player;
    if (!p) return;
    $("hp-num").textContent = String(Math.max(0, Math.ceil(p.health)));
    $("hp-bar").style.transform = `scaleX(${clamp(p.health / 100, 0, 1)})`;
    $("hp-bar").classList.toggle("low", p.health < 35);
    $("ammo-mag").textContent = p.reloadT > 0 ? "—" : String(p.ammo);
    $("ammo-mag").classList.toggle("empty", p.ammo === 0);
    $("ammo-rest").textContent = `/ ${p.reserve}`;
    $("my-frags").textContent = String(p.kills);
    if ($("credits-hud")) $("credits-hud").textContent = String(this.credits);
    if ($("round-timer")) {
      $("round-timer").textContent = fmtTime(this.roundLeft);
      $("round-timer").classList.toggle("low", this.roundLeft <= 30);
    }
    const teamMode = this._isTeamMode();
    if ($("team-score")) $("team-score").classList.toggle("hidden", !teamMode);
    if ($("lead-chip")) $("lead-chip").classList.toggle("hidden", teamMode);
    if (teamMode) {
      if ($("score-a")) $("score-a").textContent = String(this.teamScore[0] | 0);
      if ($("score-b")) $("score-b").textContent = String(this.teamScore[1] | 0);
    }
    if ($("mode-name-hud")) {
      let t = this.mode.short;
      if (teamMode && p.team >= 0) t += " · " + TEAMS[p.team].name;
      $("mode-name-hud").textContent = t;
    }
    if ($("obj-hud")) {
      if (this.modeId === "ctf" && this.flags.length === 2) {
        $("obj-hud").textContent =
          "A " + this._flagState(this.flags[0]) + "   ·   B " + this._flagState(this.flags[1]);
      } else if (this.modeId === "koth") {
        const h = this._hillHold;
        $("obj-hud").textContent =
          h === 0 ? "HILL · ALPHA" : h === 1 ? "HILL · BRAVO" : h === -2 ? "HILL · CONTESTED" : "HILL · OPEN";
      } else {
        $("obj-hud").textContent = "";
      }
    }
    this._hudAcc += dt;
    const slow = this._hudAcc >= 0.1;
    if (slow) {
      this._hudAcc = 0;
      if ($("round-num")) $("round-num").textContent = String(this.round);
      const ranked = this._ranked();
      $("lead-name").textContent = ranked[0] ? ranked[0].name : "—";
      $("lead-score").textContent = ranked[0] ? String(ranked[0].kills) : "0";
      if ($("live-board")) $("live-board").innerHTML = this._boardHtml();
      const w = this._weapon();
      if ($("weapon-name")) {
        $("weapon-name").textContent = w.name.toUpperCase() + " · " + (w.auto ? "FULL AUTO" : "SEMI AUTO");
      }
      const sb = $("scoreboard");
      if (sb && !sb.classList.contains("hidden")) {
        $("sb-body").innerHTML = ranked
          .map(
            (f) =>
              `<tr class="${f.isPlayer ? "you" : ""} ${f.alive ? "" : "dead"}"><td>${
                this._isTeamMode() && f.team >= 0 ? TEAMS[f.team].name + " · " : ""
              }${f.name}${
                f.isPlayer ? "" : f.arch ? " · " + String(f.arch.id).toUpperCase() : ""
              }</td><td>${f.kills}</td><td>${f.deaths}</td><td>${f.alive ? "LIVE" : "DOWN"}</td></tr>`
          )
          .join("");
      }
    }
    this._minimap();
  }

  _bakeMinimap() {
    const c = $("minimap");
    const W = c.width;
    const off = document.createElement("canvas");
    off.width = off.height = W;
    const g = off.getContext("2d");
    g.fillStyle = this.mapId === "yard" ? "#1a3320" : this.mapId === "labs" ? "#1c2834" : "#2a2418";
    g.fillRect(0, 0, W, W);
    const S = CFG.world;
    const map = (x, z) => [((x + S / 2) / S) * W, ((z + S / 2) / S) * W];
    g.fillStyle = this.mapId === "yard" ? "#4a6a38" : this.mapId === "labs" ? "#4a5560" : "#8a7048";
    for (const b of this.colliders) {
      const [x1, y1] = map(b.min.x, b.min.z);
      const [x2, y2] = map(b.max.x, b.max.z);
      g.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
    g.strokeStyle = "rgba(92,225,255,0.35)";
    g.strokeRect(0.5, 0.5, W - 1, W - 1);
    this._miniWalls = off;
  }

  _minimap() {
    const c = $("minimap");
    const g = c.getContext("2d");
    const W = c.width;
    if (!this._miniWalls) this._bakeMinimap();
    g.drawImage(this._miniWalls, 0, 0);
    const S = CFG.world;
    const map = (x, z) => [((x + S / 2) / S) * W, ((z + S / 2) / S) * W];
    if (this.modeId === "koth") {
      const [hx, hy] = map(this.hill.x, this.hill.z);
      g.strokeStyle = "#ffe08a";
      g.beginPath();
      g.arc(hx, hy, 12, 0, Math.PI * 2);
      g.stroke();
    }
    if (this.modeId === "ctf") {
      for (const fl of this.flags) {
        const [fx, fy] = map(fl.pos.x, fl.pos.z);
        g.fillStyle = hex(TEAMS[fl.team].color);
        g.fillRect(fx - 3, fy - 3, 6, 6);
      }
    }
    for (const other of this.fighters) {
      if (!other || other.isPlayer || !other.alive) continue;
      const [x, y] = map(other.pos.x, other.pos.z);
      g.fillStyle = hex(other.color);
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
    if (this.player && this.player.alive) {
      const [x, y] = map(this.player.pos.x, this.player.pos.z);
      g.save();
      g.translate(x, y);
      g.rotate(-this.player.yaw);
      g.fillStyle = "#5ce1ff";
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4.2, 5);
      g.lineTo(-4.2, 5);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  draw(dt = 0.016) {
    if (this.mannequin && this.mannequin.mixer && !this.running) {
      updateHumanAnim(this.mannequin, 0, dt);
    }
    if (this.player) {
      const eye = this.player.alive
        ? this.player.crouching
          ? 1.05
          : 1.58 + Math.sin(this.player.walkPhase * 2) * (this.player.grounded ? 0.03 : 0)
        : 1.2;
      this.camera.position.set(this.player.pos.x, this.player.pos.y + eye, this.player.pos.z);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.player.yaw;
      let pitch = this.player.pitch + this.player.recoil;
      if (this.weaponId === "sniper" && this.aimT > 0.45 && this.player.alive) {
        pitch += Math.sin(this.time * 1.25) * 0.0032 + Math.sin(this.time * 0.62) * 0.002;
      }
      this.camera.rotation.x = pitch;
      this.camera.rotation.z = 0;
      this.viewmodel.visible = this.player.alive && !(this.weaponId === "sniper" && this.aimT > 0.5);
    } else {
      const t = performance.now() * 0.00016;
      this.camera.position.set(Math.cos(t) * 28, 12.8, Math.sin(t) * 28);
      this.camera.lookAt(0, 2.2, 0);
      this.viewmodel.visible = false;
    }
    const water = this.worldRoot && this.worldRoot.userData.water;
    if (water && water.offset) {
      const t = performance.now() * 0.00003;
      water.offset.x = t % 1;
      water.offset.y = (t * 0.7) % 1;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

try {
  new Game();
} catch (err) {
  console.error(err);
  const menu = document.getElementById("menu");
  if (menu) {
    const tag = menu.querySelector(".tag");
    if (tag) {
      tag.textContent =
        "This arena needs WebGL. Open it in a desktop browser (Chrome, Firefox, or Edge) over http://localhost — not as a raw file.";
    }
  }
}
