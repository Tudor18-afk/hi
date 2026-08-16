import * as THREE from "three";
import { CONFIG } from "./config.js";

function noiseTexture(size, c0, c1) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const t = Math.random();
    img.data[i * 4] = c0[0] + (c1[0] - c0[0]) * t;
    img.data[i * 4 + 1] = c0[1] + (c1[1] - c0[1]) * t;
    img.data[i * 4 + 2] = c0[2] + (c1[2] - c0[2]) * t;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function boxMesh(w, h, d, x, y, z, color, roughness = 0.92) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createWorld(scene) {
  scene.background = new THREE.Color(CONFIG.fogColor);
  scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity);

  const hemi = new THREE.HemisphereLight(0x4a5570, 0x1a120c, 0.45);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0x9aa8c8, 0.55);
  moon.position.set(-30, 40, 18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 2;
  moon.shadow.camera.far = 90;
  moon.shadow.camera.left = -50;
  moon.shadow.camera.right = 50;
  moon.shadow.camera.top = 50;
  moon.shadow.camera.bottom = -50;
  scene.add(moon);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      map: noiseTexture(128, [28, 26, 22], [48, 44, 34]),
      roughness: 1,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 1 });
  const roadX = new THREE.Mesh(new THREE.PlaneGeometry(12, 120), roadMat);
  roadX.rotation.x = -Math.PI / 2;
  roadX.position.y = 0.02;
  roadX.receiveShadow = true;
  scene.add(roadX);
  const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(120, 12), roadMat.clone());
  roadZ.rotation.x = -Math.PI / 2;
  roadZ.position.y = 0.02;
  roadZ.receiveShadow = true;
  scene.add(roadZ);

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xc9d2e0 })
  );
  moonMesh.position.set(-40, 38, 30);
  scene.add(moonMesh);

  const colliders = [];
  const props = new THREE.Group();
  scene.add(props);

  function building(x, z, w, d, h, color = 0x2b2622) {
    const mesh = boxMesh(w, h, d, x, h / 2, z, color);
    props.add(mesh);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
    const rim = boxMesh(w + 0.2, 0.35, d + 0.2, x, h + 0.05, z, 0x1a1614);
    props.add(rim);
  }

  building(-18, -18, 12, 10, 7, 0x312820);
  building(-19, 18, 11, 9, 9, 0x26221f);
  building(18, -19, 10, 12, 6, 0x2c241c);
  building(20, 17, 14, 10, 8, 0x241f1c);
  building(-32, -8, 8, 7, 5, 0x2a2724);
  building(32, 8, 8, 6, 5, 0x2f2924);
  building(-8, 32, 7, 8, 6, 0x282421);
  building(8, -32, 7, 8, 4.5, 0x302a24);
  building(-34, 30, 9, 8, 7, 0x1f1c1a);
  building(34, -30, 9, 8, 10, 0x2a221c);

  const crates = [
    [6, 6, 1.2],
    [-7, 5.5, 1.1],
    [5.5, -7, 0.9],
    [-14, 2, 1.0],
    [12, -3, 1.3],
    [-3, 14, 1.0],
  ];
  for (const [x, z, s] of crates) {
    props.add(boxMesh(s, s, s, x, s / 2, z, 0x5a3d24));
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2 });
  }

  const cars = [
    [4.2, 22, 0.4],
    [-5, -24, 1.1],
    [24, 3.5, 0],
  ];
  for (const [x, z, rot] of cars) {
    const car = new THREE.Group();
    car.position.set(x, 0, z);
    car.rotation.y = rot;
    car.add(boxMesh(1.8, 0.7, 4.2, 0, 0.55, 0, 0x3a1210));
    car.add(boxMesh(1.6, 0.55, 2.1, 0, 1.15, -0.3, 0x1a1010));
    props.add(car);
    colliders.push({ minX: x - 2.2, maxX: x + 2.2, minZ: z - 2.2, maxZ: z + 2.2 });
  }

  const lampPosts = [
    [8, 8],
    [-8, 8],
    [8, -8],
    [-8, -8],
    [0, 28],
    [0, -28],
  ];
  for (const [x, z] of lampPosts) {
    props.add(boxMesh(0.18, 4.2, 0.18, x, 2.1, z, 0x151515));
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc37a, emissiveIntensity: 2 })
    );
    bulb.position.set(x, 4.25, z);
    props.add(bulb);
    const lamp = new THREE.PointLight(0xffc27a, 2.2, 16, 1.6);
    lamp.position.set(x, 4.2, z);
    scene.add(lamp);
  }

  const half = CONFIG.mapHalf + 1;
  const wallH = 3.2;
  const wallT = 1.2;
  const walls = [
    [0, half, 2 * half + 4, wallT],
    [0, -half, 2 * half + 4, wallT],
    [half, 0, wallT, 2 * half + 4],
    [-half, 0, wallT, 2 * half + 4],
  ];
  for (const [x, z, w, d] of walls) {
    props.add(boxMesh(w, wallH, d, x, wallH / 2, z, 0x1c1916));
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  return { colliders };
}

export function resolveCircle(x, z, radius, colliders) {
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    let dx = x - cx;
    let dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 1e-8) {
      const left = x - b.minX;
      const right = b.maxX - x;
      const top = z - b.minZ;
      const bot = b.maxZ - z;
      const m = Math.min(left, right, top, bot);
      if (m === left) x = b.minX - radius;
      else if (m === right) x = b.maxX + radius;
      else if (m === top) z = b.minZ - radius;
      else z = b.maxZ + radius;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    x += dx * push;
    z += dz * push;
  }
  return { x, z };
}
