import * as THREE from "three";
import { CONFIG } from "./config.js";
import { resolveCircle } from "./world.js";

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function makeLimb(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
  );
  mesh.castShadow = true;
  return mesh;
}

export class Zombie {
  constructor(type, x, z) {
    this.type = type;
    const spec = CONFIG.zombies[type];
    this.maxHealth = spec.health;
    this.health = spec.health;
    this.speed = spec.speed;
    this.damage = spec.damage;
    this.dead = false;
    this.deathT = 0;
    this.attackCd = 0;
    this.walkT = Math.random() * Math.PI * 2;
    this.hitFlash = 0;
    this.yaw = 0;

    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    this.root.scale.setScalar(spec.scale);
    this.root.userData.zombie = this;

    const skin = spec.color;
    const cloth = type === "tank" ? 0x2a2420 : 0x1f2418;
    this.torso = makeLimb(0.42, 0.7, 0.28, cloth);
    this.torso.position.set(0, 1.15, 0);
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.3, 0.26),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 })
    );
    this.head.position.set(0, 1.64, 0.04);
    this.head.castShadow = true;
    this.head.userData.part = "head";
    this.head.userData.zombie = this;
    this.torso.userData.part = "body";
    this.torso.userData.zombie = this;

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x110000,
      emissive: 0x66ff33,
      emissiveIntensity: 1.4,
    });
    const le = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), eyeMat);
    const re = le.clone();
    le.position.set(-0.07, 0.04, 0.13);
    re.position.set(0.07, 0.04, 0.13);
    this.head.add(le, re);

    this.armL = makeLimb(0.12, 0.62, 0.12, skin);
    this.armR = makeLimb(0.12, 0.62, 0.12, skin);
    this.armL.position.set(-0.3, 1.22, 0.08);
    this.armR.position.set(0.3, 1.22, 0.08);
    this.armL.rotation.x = -0.85;
    this.armR.rotation.x = -0.7;
    this.legL = makeLimb(0.14, 0.7, 0.16, 0x1a1c16);
    this.legR = makeLimb(0.14, 0.7, 0.16, 0x1a1c16);
    this.legL.position.set(-0.12, 0.42, 0);
    this.legR.position.set(0.12, 0.42, 0);

    this.root.add(this.torso, this.head, this.armL, this.armR, this.legL, this.legR);
    this.meshes = [this.torso, this.head, this.armL, this.armR, this.legL, this.legR];
  }

  /**
   * Chase the player's WORLD position only.
   * Looking around rotates the camera, not this target, so zombies cannot
   * "run away from the crosshair" when the mouse moves.
   */
  update(dt, playerPos, colliders, playerAlive) {
    if (this.dead) {
      this.deathT += dt;
      this.root.rotation.x = Math.min(1.45, this.deathT * 3.2);
      this.root.position.y = Math.max(-0.15, 0.2 - this.deathT);
      return this.deathT < 1.6;
    }

    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.attackCd = Math.max(0, this.attackCd - dt);

    const dx = playerPos.x - this.root.position.x;
    const dz = playerPos.z - this.root.position.z;
    const dist = Math.hypot(dx, dz) || 0.0001;

    const targetYaw = Math.atan2(dx, dz);
    const turn = shortestAngle(this.yaw, targetYaw);
    const maxTurn = CONFIG.zombies.turnRate * dt;
    this.yaw += Math.max(-maxTurn, Math.min(maxTurn, turn));
    this.root.rotation.set(0, this.yaw, 0);

    let attacking = false;
    if (dist > CONFIG.zombies.attackRange) {
      const step = Math.min(this.speed * dt, CONFIG.zombies.maxStep);
      const nx = this.root.position.x + (dx / dist) * step;
      const nz = this.root.position.z + (dz / dist) * step;
      const resolved = resolveCircle(nx, nz, 0.38, colliders);
      this.root.position.x = resolved.x;
      this.root.position.z = resolved.z;
      this.walkT += dt * (2.2 + this.speed);
      const swing = Math.sin(this.walkT);
      this.legL.rotation.x = swing * 0.45;
      this.legR.rotation.x = -swing * 0.45;
      this.armL.rotation.x = -0.85 + swing * 0.15;
      this.armR.rotation.x = -0.7 - swing * 0.15;
    } else {
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      if (playerAlive && this.attackCd <= 0) {
        this.attackCd = CONFIG.zombies.attackCooldown;
        attacking = true;
        this.armL.rotation.x = -1.35;
        this.armR.rotation.x = -1.2;
      }
    }

    const flash = this.hitFlash > 0 ? 0x772222 : null;
    for (const m of this.meshes) {
      if (flash) m.material.emissive.setHex(0x551111);
      else m.material.emissive.setHex(0x000000);
    }
    return { alive: true, attacking, damage: this.damage };
  }

  hit(amount, isHead) {
    if (this.dead) return false;
    this.health -= amount;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.dead = true;
      this.deathT = 0;
      return true;
    }
    if (isHead) {
      const step = 0.18;
      this.root.position.x -= Math.sin(this.yaw) * step * 0.2;
      this.root.position.z -= Math.cos(this.yaw) * step * 0.2;
    }
    return false;
  }
}

export class Horde {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.wave = 0;
    this.kills = 0;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.groanTimer = 2;
  }

  get aliveCount() {
    return this.list.filter((z) => !z.dead).length;
  }

  startWave() {
    this.wave += 1;
    this.toSpawn = 6 + this.wave * 3;
    this.spawnTimer = 0.4;
  }

  spawnOne(playerPos) {
    const typeRoll = Math.random();
    let type = "walker";
    if (this.wave >= 3 && typeRoll > 0.82) type = "tank";
    else if (this.wave >= 2 && typeRoll > 0.55) type = "runner";

    const minR = 22;
    const maxR = CONFIG.mapHalf - 4;
    let x;
    let z;
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r;
      const away = Math.hypot(x - playerPos.x, z - playerPos.z);
      if (away > 16) break;
    }
    const zed = new Zombie(type, x, z);
    this.scene.add(zed.root);
    this.list.push(zed);
  }

  update(dt, playerPos, colliders, playerAlive) {
    this.spawnTimer -= dt;
    if (this.toSpawn > 0 && this.spawnTimer <= 0) {
      this.spawnOne(playerPos);
      this.toSpawn -= 1;
      this.spawnTimer = Math.max(0.35, 1.1 - this.wave * 0.06);
    }

    this.groanTimer -= dt;
    let groan = false;
    if (this.groanTimer <= 0 && this.aliveCount > 0) {
      this.groanTimer = 3.5 + Math.random() * 3;
      groan = true;
    }

    const attacks = [];
    const keep = [];
    for (const z of this.list) {
      const result = z.update(dt, playerPos, colliders, playerAlive);
      if (z.dead) {
        if (result) keep.push(z);
        else this.scene.remove(z.root);
        continue;
      }
      keep.push(z);
      if (result.attacking) attacks.push(result.damage);
    }
    this.list = keep;

    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i];
        const b = this.list[j];
        if (a.dead || b.dead) continue;
        const dx = b.root.position.x - a.root.position.x;
        const dz = b.root.position.z - a.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 0.85) {
          const push = ((0.85 - d) / d) * 0.5;
          a.root.position.x -= dx * push;
          a.root.position.z -= dz * push;
          b.root.position.x += dx * push;
          b.root.position.z += dz * push;
        }
      }
    }

    return { attacks, groan, waveClear: this.toSpawn <= 0 && this.aliveCount === 0 };
  }

  hitScan(raycaster) {
    const targets = [];
    for (const z of this.list) {
      if (z.dead) continue;
      targets.push(z.head, z.torso);
    }
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    const hit = hits[0];
    if (hit.distance > CONFIG.weapon.range) return null;
    const zombie = hit.object.userData.zombie;
    const isHead = hit.object.userData.part === "head";
    const dmg = CONFIG.weapon.damage * (isHead ? CONFIG.weapon.headMultiplier : 1);
    const killed = zombie.hit(dmg, isHead);
    if (killed) this.kills += 1;
    return { zombie, isHead, killed, point: hit.point };
  }
}
