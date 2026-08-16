import * as THREE from "../vendor/three.module.min.js";
import { GameAudio } from "./audio.js";
import { Net } from "./net.js";

const CFG = {
  world: 64,
  fragLimit: 20,
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
};

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
  warehouse: { id: "warehouse", name: "WAREHOUSE" },
  yard: { id: "yard", name: "CARGO YARD" },
  labs: { id: "labs", name: "NIGHT LAB" },
};

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

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

function makeTex(draw, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  draw(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function floorTex() {
  return makeTex((g) => {
    g.fillStyle = "#141c24";
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "#223040";
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 512);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(512, i);
      g.stroke();
    }
    g.strokeStyle = "#3a6a7a";
    g.lineWidth = 3;
    g.strokeRect(2, 2, 508, 508);
  }, 16);
}

function wallTex() {
  return makeTex((g) => {
    g.fillStyle = "#1a2430";
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "#2a3848";
    g.lineWidth = 6;
    for (let y = 0; y < 512; y += 128) {
      g.strokeRect(8, y + 8, 496, 112);
    }
    g.fillStyle = "#0e141c";
    for (let y = 0; y < 512; y += 128) g.fillRect(16, y + 96, 480, 8);
  }, 2);
}

function crateTex() {
  return makeTex((g) => {
    g.fillStyle = "#5a4630";
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "#3a2c1c";
    g.lineWidth = 14;
    g.strokeRect(20, 20, 472, 472);
    g.beginPath();
    g.moveTo(40, 40);
    g.lineTo(472, 472);
    g.moveTo(472, 40);
    g.lineTo(40, 472);
    g.stroke();
    g.strokeStyle = "#c4a066";
    g.lineWidth = 4;
    g.strokeRect(28, 28, 456, 456);
  }, 1);
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
    while (open.length && steps++ < 2800) {
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

function buildWorld(scene, mapId) {
  const colliders = [];
  const cover = [];
  const spawns = [];
  const root = new THREE.Group();
  scene.add(root);

  const S = CFG.world / 2;
  const H = 5.4;
  const themes = {
    warehouse: {
      fog: 0x0a1018,
      floor: 0xc8d4e0,
      hemi: [0x9eb6c8, 0x1a1410, 0.55],
      sun: 0xd8e6ff,
      lamps: [
        [-20, -20, 0x88ddff],
        [20, -20, 0xffb347],
        [-20, 20, 0xffb347],
        [20, 20, 0x88ddff],
        [0, 0, 0x5ce1ff],
      ],
    },
    yard: {
      fog: 0x10160c,
      floor: 0xb7c4a8,
      hemi: [0xc8d4b0, 0x1a1810, 0.62],
      sun: 0xffe0b0,
      lamps: [
        [-22, -18, 0xffb347],
        [22, -18, 0xffb347],
        [-22, 18, 0x88ddff],
        [22, 18, 0x88ddff],
        [0, 0, 0xffcc66],
      ],
    },
    labs: {
      fog: 0x0c0816,
      floor: 0xb8c0e0,
      hemi: [0xb0a8d8, 0x120814, 0.48],
      sun: 0xc8b8ff,
      lamps: [
        [-12, -12, 0xaa66ff],
        [12, -12, 0x5ce1ff],
        [-12, 12, 0x5ce1ff],
        [12, 12, 0xaa66ff],
        [0, 0, 0xff66aa],
      ],
    },
  };
  const theme = themes[mapId] || themes.warehouse;

  const ftex = floorTex();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.world + 4, CFG.world + 4),
    new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.92, metalness: 0.05, color: theme.floor })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.world + 4, CFG.world + 4),
    new THREE.MeshStandardMaterial({ color: 0x0b1016, roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 8.6;
  root.add(ceil);

  const wtex = wallTex();
  const wallMat = new THREE.MeshStandardMaterial({
    map: wtex,
    roughness: 0.82,
    metalness: 0.12,
    color: theme.floor,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x5ce1ff,
    emissive: 0x5ce1ff,
    emissiveIntensity: 0.7,
    roughness: 0.4,
  });
  const amberMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xffb347,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  const ctex = crateTex();
  const crateMat = new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.7, metalness: 0.05 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a3544, roughness: 0.45, metalness: 0.35 });
  const mats = { wall: wallMat, crate: crateMat, metal: metalMat };

  const walls = [
    [0, H / 2, -S - 0.8, CFG.world + 3.2, H, 1.6],
    [0, H / 2, S + 0.8, CFG.world + 3.2, H, 1.6],
    [-S - 0.8, H / 2, 0, 1.6, H, CFG.world],
    [S + 0.8, H / 2, 0, 1.6, H, CFG.world],
  ];
  for (const [x, y, z, w, h, d] of walls) {
    addCollider(colliders, x, y, z, w, h, d);
    const mesh = makeBoxMesh(x, y, z, w, h, d, wallMat, root);
    root.add(mesh);
  }

  const neon = [
    [0, 0.06, -S + 0.15, CFG.world - 1, 0.08, 0.12, trimMat],
    [0, 0.06, S - 0.15, CFG.world - 1, 0.08, 0.12, trimMat],
    [-S + 0.15, 0.06, 0, 0.12, 0.08, CFG.world - 1, amberMat],
    [S - 0.15, 0.06, 0, 0.12, 0.08, CFG.world - 1, amberMat],
  ];
  for (const [x, y, z, w, h, d, m] of neon) root.add(makeBoxMesh(x, y, z, w, h, d, m, root, false));

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

  if (mapId === "yard") {
    prop(-18, -12, 16, 3.4, 2.8, metalMat, true);
    prop(18, 12, 16, 3.4, 2.8, metalMat, true);
    prop(-12, 18, 3.4, 14, 2.8, metalMat, true);
    prop(12, -18, 3.4, 14, 2.8, metalMat, true);
    prop(0, 0, 3.6, 3.6, 1.4, crateMat, true);
    prop(-8, 4, 2.2, 2.2, 2.2, crateMat, true);
    prop(8, -5, 2.2, 2.2, 1.2, crateMat, true);
    prop(-24, 8, 2.4, 2.4, 1.5, crateMat, true);
    prop(24, -8, 2.4, 2.4, 1.5, crateMat, true);
    prop(0, 22, 8, 2.0, 1.8, wallMat, true);
    prop(0, -22, 8, 2.0, 1.8, wallMat, true);
  } else if (mapId === "labs") {
    prop(-20, -8, 12, 1.5, 4.2, wallMat, true);
    prop(8, -8, 16, 1.5, 4.2, wallMat, true);
    prop(-8, 8, 16, 1.5, 4.2, wallMat, true);
    prop(20, 8, 12, 1.5, 4.2, wallMat, true);
    prop(-8, -20, 1.5, 12, 4.2, wallMat, true);
    prop(-8, 8, 1.5, 16, 4.2, wallMat, true);
    prop(8, -8, 1.5, 16, 4.2, wallMat, true);
    prop(8, 20, 1.5, 12, 4.2, wallMat, true);
    prop(-20, -20, 6, 6, 3.2, metalMat, true);
    prop(20, -20, 6, 6, 3.2, metalMat, true);
    prop(-20, 20, 6, 6, 3.2, metalMat, true);
    prop(20, 20, 6, 6, 3.2, metalMat, true);
    prop(0, 0, 2.0, 2.0, 3.8, metalMat, false);
    root.add(makeBoxMesh(0, 2.2, 0, 0.4, 4.2, 0.4, trimMat, root, false));
    prop(-14, 0, 1.6, 1.6, 1.2, crateMat, true);
    prop(14, 0, 1.6, 1.6, 1.2, crateMat, true);
    prop(0, -14, 1.6, 1.6, 1.2, crateMat, true);
    prop(0, 14, 1.6, 1.6, 1.2, crateMat, true);
  } else {
    prop(0, 0, 2.2, 2.2, 6.5, metalMat, false);
    root.add(makeBoxMesh(0, 3.4, 0, 0.5, 6.6, 0.5, trimMat, root, false));
    prop(-15, -15, 3.4, 3.4, 3.4, wallMat, true);
    prop(15, -15, 3.4, 3.4, 3.4, wallMat, true);
    prop(-15, 15, 3.4, 3.4, 3.4, wallMat, true);
    prop(15, 15, 3.4, 3.4, 3.4, wallMat, true);
    prop(0, -19, 9, 2.0, 2.6, wallMat, true);
    prop(0, 19, 9, 2.0, 2.6, wallMat, true);
    prop(-19, 0, 2.0, 9, 2.6, wallMat, true);
    prop(19, 0, 2.0, 9, 2.6, wallMat, true);
    const crates = [
      [-8, -5.2, 1.6, 1.6, 1.2],
      [-8, -3.4, 1.6, 1.6, 1.2],
      [7.4, 5.2, 1.7, 1.7, 2.2],
      [9.2, 5.2, 1.6, 1.6, 1.1],
      [-22, 10, 2.1, 2.1, 1.35],
      [22, -10, 2.1, 2.1, 1.35],
      [-6, 12, 1.5, 1.5, 1.15],
      [6, -12, 1.5, 1.5, 1.15],
      [-24, -22, 2.4, 2.4, 2.0],
      [24, 22, 2.4, 2.4, 2.0],
      [-4, 0, 1.4, 1.4, 1.1],
      [4.2, -2, 1.4, 1.4, 1.8],
      [-11, 6, 1.5, 1.5, 1.2],
      [11, -7, 1.5, 1.5, 1.2],
    ];
    for (const [x, z, w, d, h] of crates) prop(x, z, w, d, h, crateMat, true);
  }

  const spawnPts = [
    [-26, -26],
    [26, -26],
    [-26, 26],
    [26, 26],
    [-26, 0],
    [26, 0],
    [0, -26],
    [0, 26],
    [-10, -26],
    [10, 26],
  ];
  for (const [x, z] of spawnPts) spawns.push(new THREE.Vector3(x, 0, z));

  root.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2]));
  const sun = new THREE.DirectionalLight(theme.sun, 0.7);
  sun.position.set(18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  root.add(sun);

  for (const [x, z, col] of theme.lamps) {
    const l = new THREE.PointLight(col, 2.4, 28, 1.6);
    l.position.set(x, 6.4, z);
    root.add(l);
    const bulb = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.12, 0.6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4 })
    );
    bulb.position.set(x, 8.2, z);
    root.add(bulb);
  }

  scene.background = new THREE.Color(theme.fog);
  scene.fog = new THREE.Fog(theme.fog, 18, 72);

  return { colliders, cover, spawns, root };
}

function createRifle() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x1b222c, metalness: 0.65, roughness: 0.32 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x5ce1ff,
    emissive: 0x5ce1ff,
    emissiveIntensity: 0.4,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.56), black);
  body.position.z = -0.08;
  g.add(body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.4), black);
  barrel.position.z = -0.48;
  g.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.1), black);
  mag.position.set(0, -0.13, 0.04);
  g.add(mag);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), black);
  stock.position.set(0, 0.01, 0.3);
  g.add(stock);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.12), accent);
  sight.position.set(0, 0.09, -0.05);
  g.add(sight);
  return g;
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

function createOperator(color, name) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.7 });
  const visor = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.32), mat);
  torso.position.y = 1.16;
  torso.castShadow = true;
  g.add(torso);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.28), dark);
  hips.position.y = 0.78;
  g.add(hips);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), dark);
  head.position.y = 1.64;
  head.castShadow = true;
  g.add(head);

  const vis = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), visor);
  vis.position.set(0, 1.64, -0.16);
  g.add(vis);

  const larm = new THREE.Group();
  larm.position.set(-0.38, 1.34, 0);
  const larmM = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), mat);
  larmM.position.y = -0.22;
  larm.add(larmM);
  g.add(larm);

  const rarm = new THREE.Group();
  rarm.position.set(0.38, 1.34, 0);
  const rarmM = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), mat);
  rarmM.position.y = -0.22;
  rarm.add(rarmM);
  g.add(rarm);

  const lleg = new THREE.Group();
  lleg.position.set(-0.16, 0.7, 0);
  const llegM = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), dark);
  llegM.position.y = -0.35;
  lleg.add(llegM);
  g.add(lleg);

  const rleg = new THREE.Group();
  rleg.position.set(0.16, 0.7, 0);
  const rlegM = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), dark);
  rlegM.position.y = -0.35;
  rleg.add(rlegM);
  g.add(rleg);

  const gun = createRifle();
  gun.position.set(0.22, 1.28, -0.42);
  g.add(gun);

  const tag = makeLabel(name, hex(color));
  g.add(tag);

  const hpGroup = new THREE.Group();
  hpGroup.position.y = 1.92;
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

class Game {
  constructor() {
    this.audio = new GameAudio();
    this.keys = new Set();
    this.mouseDown = false;
    this.sens = 1.2;
    this.botCount = 8;
    this.mapId = "warehouse";
    this.diffId = "normal";
    this.difficulty = DIFFICULTY.normal;
    this.online = false;
    this.humans = [];
    this.net = new Net();
    this.net.onEvent = (msg) => this._onNet(msg);
    this._netAcc = 0;
    this.running = false;
    this.paused = false;
    this.matchOver = false;
    this.time = 0;
    this.effects = [];
    this.shots = [];
    this.idSeq = 1;

    this.renderer = new THREE.WebGLRenderer({ canvas: $("view"), antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 120);
    this.camera.rotation.order = "YXZ";

    this._loadMap("warehouse");

    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 });
    this.sparkGeo = new THREE.SphereGeometry(0.035, 6, 6);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa55 });
    this.tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);

    this.viewmodel = this._makeViewmodel();
    this.viewmodel.visible = false;
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera);
    this.camera.position.set(22, 11, 22);
    this.camera.lookAt(0, 1.4, 0);

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

    this._bind();
    this._loop = this._loop.bind(this);
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  }

  _makeViewmodel() {
    const root = new THREE.Group();
    const gun = createRifle();
    gun.scale.set(1.35, 1.35, 1.35);
    gun.position.set(0.32, -0.28, -0.62);
    gun.rotation.set(0.04, 0.08, -0.04);
    root.add(gun);
    const light = new THREE.PointLight(0xffcc88, 0, 5);
    light.position.set(0.32, -0.2, -1.05);
    root.add(light);
    const fill = new THREE.PointLight(0xc8e6ff, 0.7, 2.8);
    fill.position.set(0.12, 0.05, -0.2);
    root.add(fill);
    this.muzzleLight = light;
    this.gunRoot = gun;
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
    $("mode-local").addEventListener("click", () => this._setMode(false));
    $("mode-online").addEventListener("click", () => this._setMode(true));
    $("btn-create").addEventListener("click", (e) => {
      e.preventDefault();
      this._createRoom();
    });
    $("btn-join").addEventListener("click", (e) => {
      e.preventDefault();
      this._joinRoom();
    });
    $("room-code").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._joinRoom();
    });
    $("btn-start").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startMatch();
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

    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (["Space", "Tab", "KeyR"].includes(e.code)) e.preventDefault();
      if (e.code === "Tab") $("scoreboard").classList.remove("hidden");
      if (e.code === "Escape" && this.running && !this.matchOver) {
        if (this.paused) this._resume();
        else this._pause();
      }
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") $("scoreboard").classList.add("hidden");
    });
    addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (this.running && !this.matchOver) {
        if (this.paused) this._resume();
        else {
          this.dragging = true;
          this._requestLock();
        }
      }
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      this.dragging = false;
    });
    addEventListener("mousemove", (e) => {
      this._look(e.movementX, e.movementY, this.pointerLocked || this.dragging);
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === $("view");
      if (this.pointerLocked && this.paused) this._resume();
      this._syncLookHint();
    });
    document.addEventListener("pointerlockerror", () => {
      this.pointerLocked = false;
      this._syncLookHint();
    });
    $("view").addEventListener("contextmenu", (e) => e.preventDefault());
    this._bindTouch();
  }

  _bindTouch() {
    const stick = $("stick");
    const fire = $("touch-fire");
    const jump = $("touch-jump");
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

    addEventListener("touchstart", (e) => {
      if (!this.running || this.matchOver) return;
      if (this.paused) this._resume();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchStick.id) continue;
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && (el.id === "touch-fire" || el.id === "touch-jump" || el.closest("#stick"))) continue;
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
    if (!allowed || !this.player || !this.player.alive || this.paused || !this.running) return;
    this.player.yaw -= dx * this.sens * 0.0022;
    this.player.pitch -= dy * this.sens * 0.0022;
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
    $("paused").classList.remove("hidden");
    if (document.exitPointerLock) document.exitPointerLock();
  }

  _resume() {
    this.paused = false;
    $("paused").classList.add("hidden");
    this._requestLock();
  }

  _syncLookHint() {
    const hint = $("look-hint");
    if (!hint) return;
    const show = this.running && !this.paused && !this.matchOver && !this.pointerLocked && !this.usingTouch;
    hint.classList.toggle("hidden", !show);
  }

  _loadMap(mapId) {
    mapId = MAPS[mapId] ? mapId : "warehouse";
    if (this.worldRoot) this.scene.remove(this.worldRoot);
    const built = buildWorld(this.scene, mapId);
    this.worldRoot = built.root;
    this.colliders = built.colliders;
    this.cover = built.cover;
    this.spawns = built.spawns;
    this.nav = new NavGrid(CFG.world, 1.5, this.colliders);
    this.mapId = mapId;
    if ($("map-name-hud")) $("map-name-hud").textContent = MAPS[mapId].name;
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
    if (this.running) return;
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
    this.online = online;
    $("mode-local").classList.toggle("on", !online);
    $("mode-online").classList.toggle("on", online);
    $("local-actions").classList.toggle("hidden", online);
    $("online-actions").classList.toggle("hidden", !online);
    $("menu-eyebrow").textContent = online ? "ONLINE DEATHMATCH" : "LOCAL MATCH";
    if (online) {
      $("net-status").textContent = "Create a room and share the 4-letter code. Friends must open this same site.";
      this.net.connect();
    }
  }

  _createRoom() {
    $("net-status").textContent = "Creating room…";
    this.net.create(this._playerName(), parseInt($("bots").value, 10), this.mapId, this.diffId);
  }

  _joinRoom() {
    const code = ($("room-code").value || "").trim();
    if (!code) {
      $("net-status").textContent = "Enter a room code to join.";
      return;
    }
    $("net-status").textContent = "Joining " + code.toUpperCase() + "…";
    this.net.join(code, this._playerName());
  }

  _onNet(msg) {
    if (msg.t === "err") {
      $("net-status").textContent = msg.m || "Network error.";
      return;
    }
    if (msg.t === "ok") {
      $("net-status").textContent = "Room " + msg.code + " — share this code.";
      $("room-code").value = msg.code;
      this.startMatch({
        online: true,
        netId: msg.id,
        players: msg.players,
        bots: msg.bots,
        host: msg.host,
        map: msg.map,
        diff: msg.diff,
      });
      return;
    }
    if (msg.t === "close" && this.online && this.running) {
      $("net-status").textContent = "Disconnected from the room.";
    }
    if (!this.running) return;
    if (msg.t === "join") this._addRemote(msg.id, msg.name, msg.color, false);
    if (msg.t === "leave") this._removeRemote(msg.id);
    if (msg.t === "host") this.net.host = !!msg.host;
    if (msg.t === "st") this._applyPeerState(msg);
    if (msg.t === "bst" && !this.net.host) this._applyBotStates(msg.bots || []);
    if (msg.t === "shot") this._netShot(msg);
    if (msg.t === "hit") this._netHit(msg);
    if (msg.t === "reset") this.startMatch({ keepOnline: true });
  }

  _byId(id) {
    return this.fighters.find((f) => f && f.id === id) || null;
  }

  _rebuildFighters() {
    this.fighters = [this.player, ...this.humans, ...this.bots].filter(Boolean);
  }

  _addRemote(id, name, color, isBot) {
    if (!id || (this.player && id === this.player.id) || this._byId(id)) return null;
    const f = this._makeFighter(name || "PLAYER", color || 0x8892a0, false);
    f.id = id;
    f.isRemote = true;
    f.isBot = !!isBot;
    f.arch = isBot ? ARCHETYPES[id % ARCHETYPES.length] : { id: "human" };
    const rig = createOperator(f.color, f.name);
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
    if (!f) f = this._addRemote(msg.id, msg.name, msg.color, false);
    if (!f) return;
    f.pos.set(msg.x, msg.y, msg.z);
    f.yaw = msg.yaw;
    f.pitch = msg.pitch || 0;
    f.health = msg.hp;
    f.alive = !!msg.alive;
    f.crouching = !!msg.cr;
    f.kills = msg.k || 0;
    f.deaths = msg.d || 0;
    this._poseRemote(f);
  }

  _applyBotStates(list) {
    const seen = new Set();
    for (const b of list) {
      seen.add(b.id);
      let f = this._byId(b.id);
      if (!f) f = this._addRemote(b.id, b.name, b.color, true);
      if (!f) continue;
      f.pos.set(b.x, b.y, b.z);
      f.yaw = b.yaw;
      f.health = b.hp;
      f.alive = !!b.alive;
      f.kills = b.k || 0;
      f.deaths = b.d || 0;
      this._poseRemote(f);
    }
    for (const bot of [...this.bots]) {
      if (bot.isRemote && !seen.has(bot.id)) this._removeRemote(bot.id);
    }
  }

  _poseRemote(f) {
    if (!f.rig) return;
    if (!f.alive) {
      const t = 1;
      f.rig.group.rotation.x = t * 1.2;
      f.rig.group.position.set(f.pos.x, f.pos.y, f.pos.z);
      return;
    }
    f.rig.group.visible = true;
    f.rig.group.rotation.x = 0;
    f.rig.group.position.copy(f.pos);
    f.rig.group.rotation.y = f.yaw;
    f.walkPhase += 0.2;
    const swing = Math.sin(f.walkPhase) * 0.35;
    f.rig.larm.rotation.x = -swing * 0.5;
    f.rig.rarm.rotation.x = -1.05;
    f.rig.lleg.rotation.x = swing;
    f.rig.rleg.rotation.x = -swing;
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
    if (this._netAcc < 1 / 15) return;
    this._netAcc = 0;
    const p = this.player;
    this.net.send({
      t: "st",
      x: p.pos.x,
      y: p.pos.y,
      z: p.pos.z,
      yaw: p.yaw,
      pitch: p.pitch,
      hp: p.health,
      alive: p.alive,
      cr: p.crouching,
      k: p.kills,
      d: p.deaths,
      name: p.name,
      color: p.color,
    });
    if (this.net.host && this.bots.length) {
      this.net.send({
        t: "bst",
        bots: this.bots.filter((b) => !b.isRemote).map((b) => ({
          id: b.id,
          name: b.name,
          color: b.color,
          x: b.pos.x,
          y: b.pos.y,
          z: b.pos.z,
          yaw: b.yaw,
          hp: b.health,
          alive: b.alive,
          k: b.kills,
          d: b.deaths,
        })),
      });
    }
  }

  startMatch(opts = {}) {
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
      const wantMap = opts.map && MAPS[opts.map] ? opts.map : this.mapId;
      if (!this.worldRoot || wantMap !== this.mapId) this._loadMap(wantMap);
      $("menu").classList.add("hidden");
      $("match-over").classList.add("hidden");
      $("paused").classList.add("hidden");
      $("death-screen").classList.add("hidden");
      $("hud").classList.remove("hidden");
      this.matchOver = false;
      this.running = true;
      this.paused = false;
      this.time = 0;
      this.pointerLocked = false;

      for (const b of this.bots) if (b.rig) this.scene.remove(b.rig.group);
      for (const h of this.humans) if (h.rig) this.scene.remove(h.rig.group);
      for (const e of this.effects) this.scene.remove(e.mesh);
      this.bots = [];
      this.humans = [];
      this.effects.length = 0;

      const myName = this._playerName();
      const myColor = this.online ? 0x5ce1ff : 0x5ce1ff;
      this.player = this._makeFighter(myName, myColor, true);
      if (opts.netId) this.player.id = opts.netId;

      const simulateBots = !this.online || this.net.host;
      if (simulateBots) {
        for (let i = 0; i < this.botCount; i++) {
          const op = OPERATORS[i % OPERATORS.length];
          const bot = this._makeFighter(op.name, op.color, false);
          bot.id = 1000 + i;
          bot.arch = ARCHETYPES[i % ARCHETYPES.length];
          bot.health = this.difficulty.hp;
          bot.maxHealth = this.difficulty.hp;
          bot.react = bot.arch.react * this.difficulty.react;
          bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
          const rig = createOperator(op.color, op.name);
          this.scene.add(rig.group);
          bot.rig = rig;
          this.bots.push(bot);
        }
      }

      if (this.online && opts.players) {
        for (const p of opts.players) {
          if (p.id === this.player.id) continue;
          this._addRemote(p.id, p.name, p.color, false);
        }
      }

      this._rebuildFighters();
      const used = new Set();
      for (const f of this.fighters) {
        if (f.isRemote) continue;
        this._spawn(f, used);
        used.add(f.spawnIndex);
      }

      $("frag-limit").textContent = String(CFG.fragLimit);
      if (this.online && this.net.code) {
        $("room-chip").classList.remove("hidden");
        $("room-code-hud").textContent = this.net.code;
        this._banner("ROOM " + this.net.code);
      } else {
        $("room-chip").classList.add("hidden");
        this._banner((MAPS[this.mapId] ? MAPS[this.mapId].name : "ARENA") + " · " + this.difficulty.name);
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
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      health: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      ammo: CFG.mag,
      reserve: CFG.reserve,
      reloadT: 0,
      shootCd: 0,
      crouching: false,
      grounded: true,
      radius: CFG.radius,
      recoil: 0,
      bloom: 0,
      walkPhase: Math.random() * 10,
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
    for (let i = 0; i < this.spawns.length; i++) {
      if (used.has(i)) continue;
      const s = this.spawns[i];
      let score = 1000;
      for (const o of this.fighters) {
        if (o === ent || !o.alive) continue;
        score = Math.min(score, s.distanceTo(o.pos));
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    const s = this.spawns[best];
    ent.spawnIndex = best;
    ent.pos.set(s.x, 0, s.z);
    ent.vel.set(0, 0, 0);
    ent.health = ent.isPlayer || !ent.arch || ent.arch.id === "human" ? 100 : this.difficulty.hp;
    ent.alive = true;
    ent.ammo = CFG.mag;
    ent.reserve = CFG.reserve;
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

  _loop(now) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (this.running && !this.paused && !this.matchOver) this.update(dt);
    this.draw(dt);
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

  fire(ent, ox, oy, oz, dx, dy, dz, spread) {
    dx += (Math.random() - 0.5) * 2 * spread;
    dy += (Math.random() - 0.5) * 2 * spread;
    dz += (Math.random() - 0.5) * 2 * spread;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    const hit = this.hitscan(ox, oy, oz, dx, dy, dz, 80, ent.id);
    this._tracer(ox, oy, oz, hit.x, hit.y, hit.z);
    this._sparks(hit.x, hit.y, hit.z);
    const dist = ent.isPlayer ? 0 : this.player ? this.player.pos.distanceTo(ent.pos) : 8;
    this.audio.shoot(dist);
    this._alert(ent.pos, ent);
    if (this.online && this.net.connected && ent.isPlayer) {
      this.net.send({ t: "shot", ox, oy, oz, dx, dy, dz });
    }
    if (hit.ent) {
      const dmgBase = CFG.damage * (hit.head ? CFG.headMult : 1) * rand(0.92, 1.05);
      const dmg = ent.isPlayer ? dmgBase : dmgBase * this.difficulty.dmg;
      if (this.online && hit.ent.isRemote && ent.isPlayer) {
        this._hitmarker(hit.head);
        if (hit.head) this.audio.headshot();
        else this.audio.hit();
        this.net.send({ t: "hit", tid: hit.ent.id, dmg, head: !!hit.head });
      } else {
        this.hurt(hit.ent, dmg, ent, hit.head, hit);
      }
    }
    return hit;
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
    if (attacker && attacker !== ent) attacker.kills += 1;
    this.audio.death();
    this._feed(attacker, ent, head);
    if (ent.isPlayer) {
      $("death-screen").classList.remove("hidden");
      $("killed-by").textContent = attacker ? `eliminated by ${attacker.name}` : "eliminated";
    }
    if (attacker && attacker.kills >= CFG.fragLimit) this._end(attacker);
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
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, dy / len, dz / len)
    );
    mesh.scale.y = len;
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.07, max: 0.07, fade: true });
  }

  _sparks(x, y, z) {
    for (let i = 0; i < 6; i++) {
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
    if (this.player) this._updatePlayer(dt);
    for (const b of this.bots) this._updateBot(b, dt);
    this._separate();
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
    this._updateHud();
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
      $("respawn-cd").textContent = `RESPAWNING ${Math.max(0, p.respawnT).toFixed(1)}`;
      return;
    }
    $("death-screen").classList.add("hidden");
    p.crouching = this.keys.has("KeyC");
    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
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
    if (this.keys.has("KeyR") && p.reloadT <= 0 && p.ammo < CFG.mag && p.reserve > 0) {
      p.reloadT = CFG.reload;
      this.audio.reload();
    }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const need = CFG.mag - p.ammo;
        const take = Math.min(need, p.reserve);
        p.ammo += take;
        p.reserve -= take;
      }
    }

    const canFire =
      (this.mouseDown || this.touchFire) &&
      p.reloadT <= 0 &&
      p.ammo > 0 &&
      p.shootCd <= 0 &&
      !this.paused;
    $("crosshair").classList.toggle("firing", canFire);
    if (canFire) {
      p.ammo -= 1;
      p.shootCd = 60 / CFG.rpm;
      p.recoil += 0.018;
      p.bloom = Math.min(0.045, p.bloom + 0.005);
      this.camera.updateMatrixWorld();
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      this.camera.getWorldPosition(origin);
      this.camera.getWorldDirection(dir);
      const spread =
        0.007 +
        p.bloom +
        (moving ? 0.018 : 0) +
        (p.grounded ? 0 : 0.025) +
        (p.crouching ? -0.004 : 0);
      this.fire(p, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, Math.max(0.002, spread));
      this.muzzleLight.intensity = 2.8;
      this.muzzleFlash.material.opacity = 1;
      this.gunRoot.position.z = -0.58;
      if (p.ammo === 0 && p.reserve > 0) {
        p.reloadT = CFG.reload;
        this.audio.reload();
      }
    } else {
      this.muzzleLight.intensity = lerp(this.muzzleLight.intensity, 0, 0.35);
      this.muzzleFlash.material.opacity = lerp(this.muzzleFlash.material.opacity, 0, 0.4);
      this.gunRoot.position.z = lerp(this.gunRoot.position.z, -0.62, 0.2);
    }

    const sway = Math.sin(p.walkPhase) * (moving ? 0.018 : 0.004);
    this.viewmodel.position.x = sway;
    this.viewmodel.position.y = Math.abs(Math.sin(p.walkPhase * 2)) * (moving ? 0.012 : 0);
  }

  _pickTarget(bot) {
    let best = null;
    let bestScore = 1e9;
    for (const o of this.fighters) {
      if (o === bot || !o.alive) continue;
      const dist = bot.pos.distanceTo(o.pos);
      const see = this.los(
        bot.pos.x,
        bot.pos.y + 1.5,
        bot.pos.z,
        o.pos.x,
        o.pos.y + 1.3,
        o.pos.z
      );
      const fov = bot.lastHurtAt > this.time - 2.2 ? 6.3 : bot.arch.fov;
      const aware = see && (this.inFov(bot, o.pos.x, o.pos.z, fov) || dist < 4);
      if (!aware) continue;
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
      this._poseRemote(bot);
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

    if (seeThreat) {
      bot.react -= dt;
      const dist = bot.pos.distanceTo(threat.pos);
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

      if (bot.react <= 0 && bot.reloadT <= 0 && bot.ammo > 0 && bot.shootCd <= 0 && dist < 48) {
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
    const swing = Math.sin(bot.walkPhase) * Math.min(1, spd / 4) * 0.7;
    rig.larm.rotation.x = -swing * 0.5;
    rig.rarm.rotation.x = seeThreat ? -1.15 : swing * 0.35;
    rig.lleg.rotation.x = swing;
    rig.rleg.rotation.x = -swing;
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
      if (e.fade && e.mesh.material) e.mesh.material.opacity = e.life / e.max;
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        if (e.mesh.material && e.mesh.material !== this.tracerMat && e.mesh.material !== this.sparkMat) {
          if (e.fade) e.mesh.material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }

  _updateHud() {
    const p = this.player;
    if (!p) return;
    $("hp-num").textContent = String(Math.max(0, Math.ceil(p.health)));
    $("hp-bar").style.transform = `scaleX(${clamp(p.health / 100, 0, 1)})`;
    $("hp-bar").classList.toggle("low", p.health < 35);
    $("ammo-mag").textContent = p.reloadT > 0 ? "—" : String(p.ammo);
    $("ammo-mag").classList.toggle("empty", p.ammo === 0);
    $("ammo-rest").textContent = `/ ${p.reserve}`;
    $("my-frags").textContent = String(p.kills);
    const ranked = [...this.fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    $("lead-name").textContent = ranked[0] ? ranked[0].name : "—";
    $("lead-score").textContent = ranked[0] ? String(ranked[0].kills) : "0";
    if ($("map-name-hud")) $("map-name-hud").textContent = MAPS[this.mapId] ? MAPS[this.mapId].name : this.mapId;
    if ($("diff-name-hud")) $("diff-name-hud").textContent = this.difficulty.name;
    const body = $("sb-body");
    body.innerHTML = ranked
      .map(
        (f) =>
          `<tr class="${f.isPlayer ? "you" : ""} ${f.alive ? "" : "dead"}"><td>${f.name}${
            f.isPlayer ? "" : f.arch ? " · " + String(f.arch.id).toUpperCase() : ""
          }</td><td>${f.kills}</td><td>${f.deaths}</td><td>${f.alive ? "LIVE" : "DOWN"}</td></tr>`
      )
      .join("");
    this._minimap();
  }

  _minimap() {
    const c = $("minimap");
    const g = c.getContext("2d");
    const W = c.width;
    g.clearRect(0, 0, W, W);
    g.fillStyle = "#05080c";
    g.fillRect(0, 0, W, W);
    const S = CFG.world;
    const map = (x, z) => [((x + S / 2) / S) * W, ((z + S / 2) / S) * W];
    g.fillStyle = "#243044";
    for (const b of this.colliders) {
      const [x1, y1] = map(b.min.x, b.min.z);
      const [x2, y2] = map(b.max.x, b.max.z);
      g.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
    for (const other of [...this.bots, ...this.humans]) {
      if (!other.alive) continue;
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
    g.strokeStyle = "rgba(92,225,255,0.35)";
    g.strokeRect(0.5, 0.5, W - 1, W - 1);
  }

  draw() {
    if (this.player) {
      const eye = this.player.alive
        ? this.player.crouching
          ? 1.05
          : 1.58 + Math.sin(this.player.walkPhase * 2) * (this.player.grounded ? 0.03 : 0)
        : 1.2;
      this.camera.position.set(this.player.pos.x, this.player.pos.y + eye, this.player.pos.z);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = this.player.pitch + this.player.recoil;
      this.camera.rotation.z = 0;
      this.viewmodel.visible = this.player.alive;
    } else {
      const t = performance.now() * 0.00016;
      this.camera.position.set(Math.cos(t) * 24, 10.5, Math.sin(t) * 24);
      this.camera.lookAt(0, 1.4, 0);
      this.viewmodel.visible = false;
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
