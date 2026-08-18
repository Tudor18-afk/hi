import * as THREE from "../vendor/three.module.min.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone as cloneSkinned } from "../vendor/SkeletonUtils.js";

export const HUMAN = { ready: false, gltf: null };

export function loadHumanModels() {
  const loader = new GLTFLoader();
  return loader.loadAsync("./models/soldier.glb").then((gltf) => {
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    HUMAN.gltf = gltf;
    HUMAN.ready = true;
    return gltf;
  });
}

export function cloneHuman() {
  if (!HUMAN.ready || !HUMAN.gltf) return null;
  const model = cloneSkinned(HUMAN.gltf.scene);
  model.traverse((o) => {
    if (o.isMesh) {
      if (Array.isArray(o.material)) o.material = o.material.map((m) => m && m.clone());
      else if (o.material) o.material = o.material.clone();
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  model.rotation.y = Math.PI;
  return model;
}

export function findBone(root, name) {
  let bone = null;
  root.traverse((o) => {
    if (o.isBone && o.name === name) bone = o;
  });
  return bone;
}

export function tintHuman(model, look, teamColor) {
  const shirt = new THREE.Color(look.shirt);
  const skin = new THREE.Color(look.skin);
  const pants = new THREE.Color(look.pants);
  const visor = new THREE.Color(teamColor != null ? teamColor : look.shirt);
  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const list = [].concat(o.material);
    for (const m of list) {
      if (!m || !m.color) continue;
      const n = ((m.name || "") + " " + (o.name || "")).toLowerCase();
      if (n.includes("visor")) {
        m.color.copy(visor);
        if (m.emissive) {
          m.emissive.copy(visor);
          m.emissiveIntensity = 0.28;
        }
        m.metalness = 0.55;
        m.roughness = 0.18;
        m.envMapIntensity = 1.3;
      } else {
        const mix = look.vest ? shirt : shirt.clone().lerp(skin, 0.35);
        mix.lerp(pants, 0.18);
        m.color.copy(mix);
        m.color.lerp(new THREE.Color(0xffffff), 0.38);
        m.envMapIntensity = 1.05;
        m.roughness = Math.min(0.92, (m.roughness || 0.6) * 0.92);
      }
      m.needsUpdate = true;
    }
  });
}

export function makeHumanMixer(root) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  if (!HUMAN.gltf || !HUMAN.gltf.animations) return { mixer, actions };
  for (const clip of HUMAN.gltf.animations) {
    const key = String(clip.name || "").toLowerCase();
    if (key === "tpose") continue;
    const act = mixer.clipAction(clip);
    act.enabled = true;
    act.setEffectiveWeight(key === "idle" ? 1 : 0);
    act.play();
    actions[key] = act;
  }
  return { mixer, actions };
}

export function updateHumanAnim(rig, speed, dt) {
  if (!rig || !rig.mixer) return;
  rig.mixer.update(dt);
  const walk = Math.max(0, Math.min(1, (speed - 0.35) / 3.1));
  const run = Math.max(0, Math.min(1, (speed - 5.1) / 3.2));
  const idleW = 1 - walk;
  const walkW = walk * (1 - run);
  if (rig.actions.idle) rig.actions.idle.setEffectiveWeight(idleW);
  if (rig.actions.walk) rig.actions.walk.setEffectiveWeight(walkW);
  if (rig.actions.run) rig.actions.run.setEffectiveWeight(run);
}
