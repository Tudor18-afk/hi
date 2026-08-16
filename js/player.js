import * as THREE from "three";
import { CONFIG } from "./config.js";
import { resolveCircle } from "./world.js";

export class Player {
  constructor(camera, scene) {
    this.camera = camera;
    this.health = CONFIG.player.maxHealth;
    this.yaw = 0;
    this.pitch = 0;
    this.velocityY = 0;
    this.onGround = true;
    this.shootTimer = 0;
    this.reloadTimer = 0;
    this.reloading = false;
    this.mag = CONFIG.weapon.magSize;
    this.reserve = CONFIG.weapon.reserve;
    this.bob = 0;
    this.recoil = 0;
    this.hurtFlash = 0;

    this.body = new THREE.Object3D();
    this.body.position.set(0, 0, 4);
    this.head = new THREE.Object3D();
    this.head.position.y = CONFIG.player.eyeHeight;
    this.body.add(this.head);
    this.head.add(camera);
    camera.position.set(0, 0, 0);
    scene.add(this.body);

    this.flashlight = new THREE.SpotLight(0xffe6c4, 2.8, 28, Math.PI / 7.5, 0.45, 1.1);
    this.flashlight.position.set(0.15, -0.05, 0.1);
    this.flashlight.target.position.set(0, 0, -6);
    camera.add(this.flashlight);
    camera.add(this.flashlight.target);

    this.gun = this.#makeGun();
    camera.add(this.gun);

    this.keys = new Set();
    this.firing = false;
    this.lookScale = 1;
  }

  get position() {
    return this.body.position;
  }

  #makeGun() {
    const g = new THREE.Group();
    g.position.set(0.28, -0.28, -0.52);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.45, metalness: 0.4 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.9 });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.62), mat);
    barrel.position.set(0, 0.04, -0.12);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.28), mat);
    body.position.set(0, -0.02, 0.12);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.22), wood);
    stock.position.set(0, -0.04, 0.32);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), mat);
    mag.position.set(0, -0.16, 0.08);
    g.add(barrel, body, stock, mag);
    this.muzzle = new THREE.PointLight(0xffaa55, 0, 6, 2);
    this.muzzle.position.set(0, 0.04, -0.46);
    g.add(this.muzzle);
    return g;
  }

  onMouseMove(dx, dy) {
    const s = CONFIG.mouseSensitivity * this.lookScale;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.08;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt, colliders) {
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.muzzle.intensity *= Math.pow(0.001, dt);

    this.body.rotation.set(0, this.yaw, 0);
    this.head.rotation.set(this.pitch, 0, 0);

    const sprint = this.keys.has("shift");
    const speed = sprint ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed;
    let ix = 0;
    let iz = 0;
    if (this.keys.has("w")) iz -= 1;
    if (this.keys.has("s")) iz += 1;
    if (this.keys.has("a")) ix -= 1;
    if (this.keys.has("d")) ix += 1;
    const moving = ix !== 0 || iz !== 0;
    if (moving) {
      const len = Math.hypot(ix, iz);
      ix /= len;
      iz /= len;
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = ix * cos + iz * sin;
    const wz = iz * cos - ix * sin;

    const nx = this.body.position.x + wx * speed * dt;
    const nz = this.body.position.z + wz * speed * dt;
    const resolved = resolveCircle(nx, nz, CONFIG.player.radius, colliders);
    this.body.position.x = resolved.x;
    this.body.position.z = resolved.z;

    this.velocityY -= CONFIG.player.gravity * dt;
    this.body.position.y += this.velocityY * dt;
    if (this.body.position.y <= 0) {
      this.body.position.y = 0;
      this.velocityY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.bob += dt * (moving ? (sprint ? 14 : 9) : 2);
    const walk = moving ? 1 : 0.15;
    this.gun.position.set(
      0.28 + Math.sin(this.bob) * 0.012 * walk,
      -0.28 + Math.abs(Math.cos(this.bob)) * 0.018 * walk + this.recoil * 0.04,
      -0.52 + this.recoil * 0.05
    );
    this.gun.rotation.x = this.recoil * 0.12;
  }

  jump() {
    if (!this.onGround) return;
    this.velocityY = CONFIG.player.jumpSpeed;
    this.onGround = false;
  }

  canShoot() {
    return this.shootTimer <= 0 && !this.reloading && this.mag > 0 && this.health > 0;
  }

  consumeShot() {
    this.mag -= 1;
    this.shootTimer = CONFIG.weapon.fireInterval;
    this.recoil = 1;
    this.muzzle.intensity = 8;
  }

  startReload() {
    if (this.reloading || this.mag === CONFIG.weapon.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = 1.45;
    return true;
  }

  finishReloadIfReady() {
    if (!this.reloading || this.reloadTimer > 0) return;
    const need = CONFIG.weapon.magSize - this.mag;
    const take = Math.min(need, this.reserve);
    this.mag += take;
    this.reserve -= take;
    this.reloading = false;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 1;
    return this.health <= 0;
  }

  addAmmo(n) {
    this.reserve += n;
  }

  heal(n) {
    this.health = Math.min(CONFIG.player.maxHealth, this.health + n);
  }
}
