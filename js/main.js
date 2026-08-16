import * as THREE from "three";
import { CONFIG } from "./config.js";
import { createWorld } from "./world.js";
import { Player } from "./player.js";
import { Horde } from "./zombies.js";
import { GameAudio } from "./audio.js";
import { SHOP_ITEMS } from "./shop.js";

const overlay = document.getElementById("overlay");
const startScreen = document.getElementById("start-screen");
const deathScreen = document.getElementById("death-screen");
const playBtn = document.getElementById("play");
const againBtn = document.getElementById("again");
const hud = document.getElementById("hud");
const healthFill = document.getElementById("health-fill");
const healthVal = document.getElementById("health-val");
const magVal = document.getElementById("mag-val");
const reserveVal = document.getElementById("reserve-val");
const waveVal = document.getElementById("wave-val");
const killsVal = document.getElementById("kills-val");
const aliveVal = document.getElementById("alive-val");
const waveBanner = document.getElementById("wave-banner");
const pickupMsg = document.getElementById("pickup-msg");
const crosshair = document.getElementById("crosshair");
const hurt = document.getElementById("hurt");
const deathStats = document.getElementById("death-stats");
const sense = document.getElementById("sense");
const shopScreen = document.getElementById("shop-screen");
const shopItems = document.getElementById("shop-items");
const shopCoins = document.getElementById("shop-coins");
const shopNext = document.getElementById("shop-next");
const coinsVal = document.getElementById("coins-val");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.fov, innerWidth / innerHeight, 0.08, 180);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const audio = new GameAudio();

const { colliders } = createWorld(scene);
const player = new Player(camera, scene);
const horde = new Horde(scene);

const impacts = [];
let playing = false;
let paused = false;
let shopping = false;
let wavePause = 0;
let bannerT = 0;
let pickupT = 0;
let nextWaveQueued = true;

function showBanner(text) {
  waveBanner.textContent = text;
  bannerT = 2.2;
}

function showPickup(text) {
  pickupMsg.textContent = text;
  pickupT = 1.6;
}

function spawnImpact(point) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x7a1510 })
  );
  mesh.position.copy(point);
  scene.add(mesh);
  impacts.push({ mesh, t: 0.35 });
}

function shoot() {
  if (!player.canShoot()) {
    if (player.mag === 0) player.startReload();
    return;
  }
  player.consumeShot();
  audio.shoot();
  raycaster.setFromCamera(center, camera);
  const hit = horde.hitScan(raycaster, player.gunDamage);
  if (hit) {
    audio.hit();
    spawnImpact(hit.point);
    if (hit.killed) {
      player.addCoins(hit.coins);
      showPickup(`+${hit.coins} coins`);
    }
  }
}

function beginGame() {
  audio.unlock();
  overlay.classList.add("hidden");
  hud.classList.add("visible");
  startScreen.classList.add("hidden");
  deathScreen.classList.add("hidden");
  shopScreen.classList.add("hidden");
  overlay.classList.remove("shop-open");
  playing = true;
  paused = false;
  shopping = false;
  player.firing = false;
  document.body.requestPointerLock();
  if (horde.wave === 0) {
    nextWaveQueued = true;
    wavePause = 0.4;
  }
}

function gameOver() {
  playing = false;
  shopping = false;
  paused = true;
  document.exitPointerLock();
  hud.classList.remove("visible");
  overlay.classList.remove("hidden");
  overlay.classList.remove("shop-open");
  startScreen.classList.add("hidden");
  shopScreen.classList.add("hidden");
  deathScreen.classList.remove("hidden");
  deathStats.textContent = `Waves reached ${horde.wave}  ·  ${horde.kills} kills  ·  ${player.coins} coins`;
}

function renderShop() {
  shopCoins.textContent = String(player.coins);
  shopItems.innerHTML = "";
  for (const item of SHOP_ITEMS) {
    const allowed = !item.canBuy || item.canBuy(player);
    const afford = player.coins >= item.cost;
    const card = document.createElement("div");
    card.className = "shop-item";
    card.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.desc(player)}</p>
      <button type="button" data-buy="${item.id}" ${allowed && afford ? "" : "disabled"}>
        ${!allowed ? "Can't use" : afford ? `${item.cost} coins` : "Need coins"}
      </button>
    `;
    shopItems.appendChild(card);
  }
}

function openShop() {
  shopping = true;
  paused = true;
  player.firing = false;
  player.keys.clear();
  renderShop();
  overlay.classList.remove("hidden");
  overlay.classList.add("shop-open");
  startScreen.classList.add("hidden");
  deathScreen.classList.add("hidden");
  shopScreen.classList.remove("hidden");
  if (document.pointerLockElement) document.exitPointerLock();
}

function leaveShop() {
  shopping = false;
  paused = false;
  player.keys.clear();
  player.firing = false;
  shopScreen.classList.add("hidden");
  overlay.classList.add("hidden");
  overlay.classList.remove("shop-open");
  nextWaveQueued = true;
  wavePause = 0.5;
  document.body.requestPointerLock();
}

shopItems.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-buy]");
  if (!btn || btn.disabled) return;
  const item = SHOP_ITEMS.find((it) => it.id === btn.dataset.buy);
  if (!item || player.coins < item.cost) return;
  if (item.canBuy && !item.canBuy(player)) return;
  player.coins -= item.cost;
  item.apply(player);
  audio.buy();
  renderShop();
  updateHud();
});

shopNext.addEventListener("click", leaveShop);

playBtn.addEventListener("click", beginGame);
againBtn.addEventListener("click", () => location.reload());

sense.addEventListener("input", () => {
  player.lookScale = Number(sense.value);
});

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === " ") e.preventDefault();
  if (shopping || paused) return;
  player.keys.add(k === "shift" ? "shift" : k);
  if (!playing) return;
  if (k === "r") {
    if (player.startReload()) audio.reload();
  }
  if (k === " ") player.jump();
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  player.keys.delete(k === "shift" ? "shift" : k);
});

window.addEventListener("mousedown", (e) => {
  if (e.button === 0 && playing && !paused) player.firing = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) player.firing = false;
});

document.addEventListener("mousemove", (e) => {
  if (!playing || document.pointerLockElement !== document.body) return;
  player.onMouseMove(e.movementX, e.movementY);
});

document.addEventListener("pointerlockchange", () => {
  if (shopping) return;
  if (playing && document.pointerLockElement !== document.body) {
    paused = true;
    overlay.classList.remove("hidden");
    overlay.classList.remove("shop-open");
    startScreen.classList.remove("hidden");
    shopScreen.classList.add("hidden");
    document.getElementById("resume-hint").classList.remove("hidden");
    playBtn.textContent = "Resume";
  } else if (playing) {
    paused = false;
    overlay.classList.add("hidden");
  }
});

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function updateHud() {
  healthVal.textContent = Math.ceil(player.health);
  healthFill.style.transform = `scaleX(${player.health / player.maxHealth})`;
  magVal.textContent = player.mag;
  reserveVal.textContent = `/ ${player.reserve}`;
  waveVal.textContent = String(horde.wave).padStart(2, "0");
  killsVal.textContent = String(horde.kills);
  coinsVal.textContent = String(player.coins);
  aliveVal.textContent = String(horde.aliveCount + horde.toSpawn);
  hurt.style.opacity = String(player.hurtFlash * 0.85);
  waveBanner.style.opacity = String(Math.max(0, Math.min(1, bannerT)));
  pickupMsg.style.opacity = String(Math.max(0, Math.min(1, pickupT * 2)));
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  requestAnimationFrame(tick);

  if (playing && !paused) {
    player.finishReloadIfReady();
    player.update(dt, colliders);

    if (nextWaveQueued) {
      wavePause -= dt;
      if (wavePause <= 0) {
        nextWaveQueued = false;
        horde.startWave();
        audio.wave();
        showBanner(`WAVE ${horde.wave}`);
      }
    }

    const { attacks, groan, waveClear } = horde.update(dt, player.position, colliders, player.health > 0);
    if (groan) audio.groan();
    for (const dmg of attacks) {
      audio.hurt();
      if (player.takeDamage(dmg)) gameOver();
    }
    if (waveClear && !nextWaveQueued && !shopping && player.health > 0) {
      player.addCoins(CONFIG.coins.waveClear + horde.wave * 3);
      showBanner("WAVE CLEAR");
      showPickup("shop is open");
      openShop();
    }

    scene.updateMatrixWorld();
    if (player.firing) shoot();

    raycaster.setFromCamera(center, camera);
    const aimTargets = [];
    for (const z of horde.list) {
      if (!z.dead) aimTargets.push(z.head, z.torso);
    }
    const aim = aimTargets.length ? raycaster.intersectObjects(aimTargets, false) : [];
    crosshair.classList.toggle("hot", Boolean(aim.length && aim[0].distance < CONFIG.weapon.range));

    bannerT = Math.max(0, bannerT - dt);
    pickupT = Math.max(0, pickupT - dt);
    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].t -= dt;
      impacts[i].mesh.scale.multiplyScalar(1.8);
      if (impacts[i].t <= 0) {
        scene.remove(impacts[i].mesh);
        impacts.splice(i, 1);
      }
    }
    updateHud();
  }

  renderer.render(scene, camera);
}

tick();
