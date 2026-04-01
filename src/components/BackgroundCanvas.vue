<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent></div>
  <div class="game-hud">
    <div>HP <span>{{ hudHp }}</span> BOSS <span>{{ hudBoss }}</span> MINIONS <span>{{ hudMinions }}</span></div>
    <div>WEAPON <span>{{ hudWeapon }}</span> SCORE <span>{{ hudScore }}</span> PHASE <span>{{ phase }}</span></div>
    <div class="hint">CLICK TO LOCK MOUSE - WASD MOVE - SPACE JUMP - 1/2/3 WEAPON - LMB FIRE - RMB GRAPPLE - ESC UNLOCK</div>
  </div>
</template>

<style lang="scss">
.background-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; background: #000; pointer-events: auto; }
.game-hud {
  position: absolute; top: .8rem; right: .8rem; z-index: 120; pointer-events: none; text-align: right;
  font-family: "Courier New", monospace; font-size: .84rem; letter-spacing: .08em; color: #b8fff4;
  text-shadow: 0 0 8px rgba(97,255,220,.35), 0 0 2px rgba(0,0,0,.9); font-variant-numeric: tabular-nums;
}
.game-hud span { display: inline-block; min-width: 4ch; text-align: right; }
.hint { margin-top: .35rem; color: rgba(185,255,244,.8); font-size: .7rem; }
</style>

<script setup>
import * as THREE from "three";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dom } from "quasar";
import { create as createBackgroundMaterial } from "assets/materials/background/material";
import { SHOOTER_CONFIG } from "assets/game/config/shooter-config";
import {
  createBoss,
  createCheckpoint,
  createGameCamera,
  createGameViewport,
  createHero,
  createInputState,
  createMinion,
  createProjectile,
  createVisiblePools,
  createWorldState,
} from "assets/game/objects";

const MAX_STRUCTURES = 1;
const MAX_ANCHORS = 1;
const MAX_MINIONS = 1;
const MAX_PROJECTILES = 1;
const MAX_IMPACTS = 1;
const WEAPON_NAMES = ["GRAPPLE", "ROCKET", "SWORD"];
const W_GRAPPLE = 0;
const W_ROCKET = 1;
const W_SWORD = 2;
const EPS = 0.0001;
const LOOK_SENSITIVITY = 0.0024;
const LOOK_PITCH_MIN = -1.3;
const LOOK_PITCH_MAX = 1.1;

let camera, scene, renderer, material, quad, frameId = null, previousTimeMs = 0;
let visibleStructureCount = 0, visibleAnchorCount = 0, visibleMinionCount = 0;
let visibleProjectileCount = 0, visibleImpactCount = 0;
let lookYaw = 0;
let lookPitch = -0.08;
let pointerLocked = false;
const gameViewportPx = createGameViewport();
const container = ref(null);
const hp = ref(SHOOTER_CONFIG.player.maxHealth);
const bossHp = ref(SHOOTER_CONFIG.boss.maxHealth);
const minionsCount = ref(0);
const score = ref(0);
const phase = ref("IDLE");
const world = createWorldState();
const input = createInputState();
const hero = createHero(SHOOTER_CONFIG.player.start);
hero.maxHealth = SHOOTER_CONFIG.player.maxHealth;
hero.health = hero.maxHealth;
hero.weaponIndex = W_ROCKET;
const boss = createBoss(SHOOTER_CONFIG.boss.start, SHOOTER_CONFIG.boss.maxHealth);
const checkpoint = createCheckpoint(SHOOTER_CONFIG.player.start);
const gameCamera = createGameCamera();
const scan = {
  distance: 0,
  cycle:
    SHOOTER_CONFIG.arena.depthFar -
    SHOOTER_CONFIG.arena.depthNear +
    SHOOTER_CONFIG.scanSweep.cyclePadding,
};

const { structurePool, anchorPool, minionPool, projectilePool, impactPool } = createVisiblePools({
  maxVisibleStructures: MAX_STRUCTURES,
  maxVisibleAnchors: MAX_ANCHORS,
  maxVisibleMinions: MAX_MINIONS,
  maxVisibleProjectiles: MAX_PROJECTILES,
  maxVisibleImpacts: MAX_IMPACTS,
});

const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const lerp = (a, b, t) => a + (b - a) * t;
const normalize3 = (v) => {
  const l = Math.hypot(v.x, v.y, v.z);
  return l < EPS ? { x: 0, y: 0, z: 1 } : { x: v.x / l, y: v.y / l, z: v.z / l };
};
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const format = (v, d) => Math.max(0, Math.floor(v)).toString().padStart(d, "0").slice(-d);

const hudHp = computed(() => format(hp.value, 3));
const hudBoss = computed(() => format(bossHp.value, 4));
const hudMinions = computed(() => format(minionsCount.value, 2));
const hudScore = computed(() => format(score.value, 6));
const hudWeapon = computed(() => WEAPON_NAMES[hero.weaponIndex] || WEAPON_NAMES[1]);

const nextId = () => {
  const id = world.nextEntityId;
  world.nextEntityId += 1;
  return id;
};

const forwardYaw = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

const addImpact = (x, y, z, radius, strength, life = 0.34) => {
  world.impacts.push({ x, y, z, radius, strength, life, maxLife: life });
  if (world.impacts.length > MAX_IMPACTS * 2) {
    world.impacts.splice(0, world.impacts.length - MAX_IMPACTS * 2);
  }
};

const resetHero = () => {
  hero.x = checkpoint.x;
  hero.y = checkpoint.y;
  hero.z = checkpoint.z;
  hero.vx = 0;
  hero.vy = 0;
  hero.vz = 0;
  hero.health = hero.maxHealth;
  hero.damageFlash = 0;
  hero.grappleActive = false;
  hero.grapplePoint = null;
  hero.swordSwingTime = 0;
};

const resetBoss = () => {
  boss.x = SHOOTER_CONFIG.boss.start.x;
  boss.y = SHOOTER_CONFIG.boss.start.y;
  boss.z = SHOOTER_CONFIG.boss.start.z;
  boss.hp = boss.maxHp;
  boss.alive = true;
  boss.state = "idle";
  boss.stateTime = 0;
  boss.summonCooldownLeft = 2.8;
  boss.lookUp = 0;
  boss.pulse = 0;
  boss.attackCooldownLeft = 1.2;
  boss.damageFlash = 0;
};

const buildArena = () => {
  world.structures.length = 0;
  world.grappleAnchors.length = 0;
  world.minions.length = 0;
  world.projectiles.length = 0;
  world.impacts.length = 0;
  world.score = 0;
  world.elapsed = 0;
  const hw = SHOOTER_CONFIG.arena.halfWidth;
  const spacing = SHOOTER_CONFIG.arena.structureSpacing;
  let seg = 0;
  for (let z = SHOOTER_CONFIG.player.start.z - 10; z <= SHOOTER_CONFIG.arena.depthFar; z += spacing) {
    const sideX = hw - 1.4 - Math.abs(Math.sin(z * 0.07)) * 0.65;
    const sideHeight = 3.2 + Math.cos(z * 0.08) * 0.45;
    const sideY = 1.4 + Math.sin(z * 0.11) * 0.15;
    const type = seg % 3 === 0 ? 1 : 0;
    world.structures.push({ x: -sideX, y: sideY, z, r: 0.92, h: sideHeight, type, emissive: 0.36, grapplable: 1 });
    world.structures.push({ x: sideX, y: sideY, z, r: 0.92, h: sideHeight, type, emissive: 0.36, grapplable: 1 });
    if (seg % 2 === 0) {
      world.structures.push({
        x: Math.sin(z * 0.12) * 2.4,
        y: SHOOTER_CONFIG.arena.ceilingY - 1.25,
        z: z + spacing * 0.32,
        r: 3.0,
        h: 0.45,
        type: 1,
        emissive: 0.22,
        grapplable: 0,
      });
    }
    if (seg % 4 === 1) {
      world.structures.push({
        x: Math.sin(z * 0.16) * 4.1,
        y: 0.95,
        z: z + spacing * 0.5,
        r: 1.18,
        h: 1.9,
        type: 0,
        emissive: 0.28,
        grapplable: 0,
      });
    }
    seg += 1;
  }
  for (let i = 0; i < SHOOTER_CONFIG.arena.grappleColumnsPerSide; i++) {
    const z = 18 + i * 13;
    const y = 6.3 + Math.sin(i * 0.63) * 0.46;
    world.grappleAnchors.push({ x: -hw + 1.6, y, z, radius: 0.55, active: 1 });
    world.grappleAnchors.push({ x: hw - 1.6, y, z, radius: 0.55, active: 1 });
  }
  for (let i = 0; i < 4; i++) {
    world.structures.push({
      x: 0,
      y: SHOOTER_CONFIG.arena.floorY + 1.25,
      z: SHOOTER_CONFIG.boss.start.z - 14 + i * 6,
      r: 2.8 - i * 0.25,
      h: 2.1,
      type: 1,
      emissive: 0.45,
      grapplable: 0,
    });
  }
  resetHero();
  resetBoss();
  checkpoint.x = SHOOTER_CONFIG.player.start.x;
  checkpoint.y = SHOOTER_CONFIG.player.start.y;
  checkpoint.z = SHOOTER_CONFIG.player.start.z;
  gameCamera.x = hero.x;
  gameCamera.y = hero.y + SHOOTER_CONFIG.camera.height;
  gameCamera.z = hero.z - SHOOTER_CONFIG.camera.followDistance;
  lookYaw = hero.yaw;
  lookPitch = -0.08;
  gameCamera.yaw = lookYaw;
  gameCamera.pitch = lookPitch;
  scan.distance = 0;
};

const damagePlayer = (amount) => {
  if (hero.damageFlash > 0.55) return;
  hero.health = Math.max(0, hero.health - amount);
  hero.damageFlash = 1;
  addImpact(hero.x, hero.y + 0.9, hero.z, 0.85, 0.65, 0.26);
  if (hero.health <= 0) {
    world.score = Math.max(0, world.score - 300);
    world.minions.length = 0;
    world.projectiles.length = 0;
    resetHero();
  }
};

const damageBoss = (amount, hit) => {
  if (!boss.alive) return;
  boss.hp = Math.max(0, boss.hp - amount);
  boss.damageFlash = 1;
  addImpact(hit.x, hit.y, hit.z, 2.6, 0.95, 0.42);
  if (boss.hp <= 0) {
    boss.alive = false;
    boss.state = "dead";
    boss.pulse = 0;
    world.score += 5000;
  }
};

const splash = (center, radius, damage, owner) => {
  if (owner === "player") {
    if (boss.alive) {
      const d = dist3(center, boss);
      if (d <= radius + SHOOTER_CONFIG.boss.radius) {
        const ratio = 1 - clamp((d - SHOOTER_CONFIG.boss.radius) / Math.max(radius, EPS), 0, 1);
        damageBoss(damage * ratio, center);
      }
    }
    for (let i = world.minions.length - 1; i >= 0; i--) {
      const m = world.minions[i];
      const d = dist3(center, m);
      if (d > radius + m.radius) continue;
      const ratio = 1 - clamp((d - m.radius) / Math.max(radius, EPS), 0, 1);
      m.hp -= damage * ratio;
      m.damageFlash = 1;
      if (m.hp <= 0) {
        addImpact(m.x, m.y, m.z, 1.4, 0.88, 0.36);
        world.minions.splice(i, 1);
        world.score += 220;
      }
    }
    const selfD = dist3(center, hero);
    if (selfD < radius + SHOOTER_CONFIG.player.radius) {
      const ratio = 1 - clamp((selfD - SHOOTER_CONFIG.player.radius) / Math.max(radius, EPS), 0, 1);
      damagePlayer(damage * ratio * 0.38);
    }
  } else {
    const d = dist3(center, hero);
    if (d < radius + SHOOTER_CONFIG.player.radius) {
      const ratio = 1 - clamp((d - SHOOTER_CONFIG.player.radius) / Math.max(radius, EPS), 0, 1);
      damagePlayer(damage * ratio);
    }
  }
};

const getLookDirection = () => {
  const cp = Math.cos(lookPitch);
  return normalize3({
    x: Math.sin(lookYaw) * cp,
    y: Math.sin(lookPitch),
    z: Math.cos(lookYaw) * cp,
  });
};

const findGrapple = (origin, direction) => {
  let best = null;
  let bestT = SHOOTER_CONFIG.weapons.grapple.range + 1;
  const latch = SHOOTER_CONFIG.weapons.grapple.latchRadius;
  for (let i = 0; i < world.grappleAnchors.length; i++) {
    const a = world.grappleAnchors[i];
    if (a.active < 0.5) continue;
    const vx = a.x - origin.x;
    const vy = a.y - origin.y;
    const vz = a.z - origin.z;
    const t = vx * direction.x + vy * direction.y + vz * direction.z;
    if (t < 1 || t > SHOOTER_CONFIG.weapons.grapple.range) continue;
    const px = vx - direction.x * t;
    const py = vy - direction.y * t;
    const pz = vz - direction.z * t;
    if (Math.hypot(px, py, pz) > latch + a.radius || t >= bestT) continue;
    best = a;
    bestT = t;
  }
  return best;
};

const fireRocket = (dir) => {
  world.projectiles.push(createProjectile({
    id: nextId(),
    kind: "rocket",
    owner: "player",
    x: hero.x + dir.x * 1.2,
    y: hero.y + 0.95 + dir.y * 0.4,
    z: hero.z + dir.z * 1.2,
    vx: dir.x * SHOOTER_CONFIG.weapons.rocket.speed,
    vy: dir.y * SHOOTER_CONFIG.weapons.rocket.speed,
    vz: dir.z * SHOOTER_CONFIG.weapons.rocket.speed,
    radius: 0.38,
    damage: SHOOTER_CONFIG.weapons.rocket.damage,
    splashRadius: SHOOTER_CONFIG.weapons.rocket.radius,
    life: SHOOTER_CONFIG.weapons.rocket.lifeSeconds,
  }));
  hero.rocketCooldown = SHOOTER_CONFIG.weapons.rocket.cooldown;
};

const useSword = (dir) => {
  hero.swordCooldown = SHOOTER_CONFIG.weapons.sword.cooldown;
  hero.swordSwingTime = 1;
  const o = { x: hero.x, y: hero.y + 0.9, z: hero.z };
  const range = SHOOTER_CONFIG.weapons.sword.range;
  const arc = SHOOTER_CONFIG.weapons.sword.arcCosine;
  if (boss.alive) {
    const toBoss = normalize3({ x: boss.x - o.x, y: boss.y - o.y, z: boss.z - o.z });
    if (dist3(o, boss) <= range + SHOOTER_CONFIG.boss.radius && dir.x * toBoss.x + dir.y * toBoss.y + dir.z * toBoss.z >= arc) {
      damageBoss(SHOOTER_CONFIG.weapons.sword.damage, { x: boss.x, y: boss.y + 1.2, z: boss.z });
    }
  }
  for (let i = world.minions.length - 1; i >= 0; i--) {
    const m = world.minions[i];
    const toMinion = normalize3({ x: m.x - o.x, y: m.y - o.y, z: m.z - o.z });
    if (dist3(o, m) > range + m.radius || dir.x * toMinion.x + dir.y * toMinion.y + dir.z * toMinion.z < arc) continue;
    m.hp -= SHOOTER_CONFIG.weapons.sword.damage;
    m.damageFlash = 1;
    addImpact(m.x, m.y, m.z, 1.1, 0.8, 0.25);
    if (m.hp <= 0) {
      world.minions.splice(i, 1);
      world.score += 240;
    }
  }
};

const shootEnemy = (
  origin,
  dir,
  dmg,
  speed = SHOOTER_CONFIG.minion.projectileSpeed,
  radius = 0.3,
  splashRadius = 0,
) => {
  world.projectiles.push(createProjectile({
    id: nextId(),
    kind: "plasma",
    owner: "enemy",
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: dir.x * speed,
    vy: dir.y * speed,
    vz: dir.z * speed,
    radius,
    damage: dmg,
    splashRadius,
    life: 5.0,
  }));
};

const spawnMinions = (count) => {
  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(count, 1)) * Math.PI * 2 + world.elapsed * 0.9;
    const radius = 3.7 + Math.random() * 1.4;
    world.minions.push(createMinion({
      id: nextId(),
      x: clamp(boss.x + Math.cos(angle) * radius, -SHOOTER_CONFIG.arena.halfWidth + 1.4, SHOOTER_CONFIG.arena.halfWidth - 1.4),
      y: 1.45 + Math.random() * 1.1,
      z: clamp(boss.z + Math.sin(angle) * radius * 0.82, hero.z + 10, SHOOTER_CONFIG.arena.depthFar - 4),
      maxHealth: SHOOTER_CONFIG.minion.maxHealth,
    }));
  }
};

const stepBoss = (delta) => {
  if (!boss.alive) {
    boss.lookUp = approach(boss.lookUp, 0, delta * 0.8);
    boss.pulse = approach(boss.pulse, 0, delta * 2.2);
    phase.value = "DEAD";
    return;
  }
  boss.stateTime += delta;
  boss.damageFlash = approach(boss.damageFlash, 0, delta * 3.3);
  boss.attackCooldownLeft -= delta;
  boss.summonCooldownLeft -= delta;
  if (boss.state === "idle") {
    boss.lookUp = approach(boss.lookUp, 0, delta * SHOOTER_CONFIG.boss.lookUpLerp);
    boss.pulse = 0.14 + Math.sin(world.elapsed * 2.3) * 0.06;
    phase.value = "STALK";
    if (boss.attackCooldownLeft <= 0) {
      const origin = { x: boss.x, y: boss.y + 1.05, z: boss.z - 1.7 };
      shootEnemy(origin, normalize3({ x: hero.x - origin.x, y: hero.y + 0.9 - origin.y, z: hero.z - origin.z }), SHOOTER_CONFIG.boss.projectileDamage, SHOOTER_CONFIG.boss.projectileSpeed, 0.45, 1.25);
      boss.attackCooldownLeft = SHOOTER_CONFIG.boss.attackCooldown;
    }
    if (boss.summonCooldownLeft <= 0 && world.minions.length < 12) {
      boss.state = "telegraph";
      boss.stateTime = 0;
      boss.pulse = 0.42;
    }
    return;
  }
  if (boss.state === "telegraph") {
    phase.value = "SUMMON-READ";
    boss.lookUp = approach(boss.lookUp, 1, delta * SHOOTER_CONFIG.boss.lookUpLerp);
    boss.pulse = 0.4 + 0.6 * Math.sin(world.elapsed * 11.5) ** 2;
    if (boss.stateTime >= SHOOTER_CONFIG.boss.summonTelegraph) {
      boss.state = "summoning";
      boss.stateTime = 0;
    }
    return;
  }
  if (boss.state === "summoning") {
    phase.value = "SUMMON";
    boss.lookUp = 1;
    boss.pulse = 0.75 + 0.25 * Math.sin(world.elapsed * 18);
    if (boss.stateTime >= SHOOTER_CONFIG.boss.summonDuration) {
      spawnMinions(SHOOTER_CONFIG.boss.summonCount);
      boss.state = "cooldown";
      boss.stateTime = 0;
      boss.summonCooldownLeft = SHOOTER_CONFIG.boss.summonCooldown;
      boss.attackCooldownLeft = Math.max(0.7, SHOOTER_CONFIG.boss.attackCooldown - 0.3);
    }
    return;
  }
  phase.value = "RESET";
  boss.lookUp = approach(boss.lookUp, 0, delta * SHOOTER_CONFIG.boss.lookUpLerp);
  boss.pulse = approach(boss.pulse, 0.18, delta * 1.6);
  if (boss.stateTime >= 1.2) {
    boss.state = "idle";
    boss.stateTime = 0;
  }
};

const stepMinions = (delta) => {
  for (let i = world.minions.length - 1; i >= 0; i--) {
    const m = world.minions[i];
    m.damageFlash = approach(m.damageFlash, 0, delta * 4.5);
    m.attackCooldownLeft -= delta;
    m.orbitPhase += delta * 2.2;
    const tx = hero.x - m.x;
    const tz = hero.z - m.z;
    const d = Math.hypot(tx, tz);
    const dx = d > EPS ? tx / d : 0;
    const dz = d > EPS ? tz / d : -1;
    const speed = SHOOTER_CONFIG.minion.speed * clamp(d / 9.5, 0.25, 1);
    m.vx = approach(m.vx, dx * speed, delta * 16);
    m.vz = approach(m.vz, dz * speed, delta * 16);
    m.x += m.vx * delta;
    m.z += m.vz * delta;
    m.y = 1.35 + Math.sin(world.elapsed * 3.5 + m.orbitPhase) * 0.5;
    m.x = clamp(m.x, -SHOOTER_CONFIG.arena.halfWidth + 0.8, SHOOTER_CONFIG.arena.halfWidth - 0.8);
    m.z = clamp(m.z, SHOOTER_CONFIG.arena.depthNear + 2, SHOOTER_CONFIG.arena.depthFar - 2);
    const toPlayer = dist3(m, hero);
    if (toPlayer < m.radius + SHOOTER_CONFIG.player.radius + 0.45 && m.attackCooldownLeft <= 0) {
      m.attackCooldownLeft = SHOOTER_CONFIG.minion.attackCooldown;
      damagePlayer(SHOOTER_CONFIG.minion.contactDamage);
    } else if (toPlayer < 28 && m.attackCooldownLeft <= 0) {
      m.attackCooldownLeft = SHOOTER_CONFIG.minion.attackCooldown;
      shootEnemy({ x: m.x, y: m.y, z: m.z }, normalize3({ x: hero.x - m.x, y: hero.y + 0.85 - m.y, z: hero.z - m.z }), SHOOTER_CONFIG.minion.projectileDamage);
    }
    if (m.hp <= 0) {
      addImpact(m.x, m.y, m.z, 1.25, 0.9, 0.36);
      world.minions.splice(i, 1);
      world.score += 220;
    }
  }
};

const stepProjectiles = (delta) => {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    p.life -= delta;
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.z += p.vz * delta;
    const hitWall =
      Math.abs(p.x) > SHOOTER_CONFIG.arena.halfWidth ||
      p.y < SHOOTER_CONFIG.arena.floorY ||
      p.y > SHOOTER_CONFIG.arena.ceilingY ||
      p.z < SHOOTER_CONFIG.arena.depthNear - 8 ||
      p.z > SHOOTER_CONFIG.arena.depthFar + 8;

    if (p.owner === "player") {
      let boom = hitWall || p.life <= 0;
      if (!boom && boss.alive && dist3(p, boss) <= p.radius + SHOOTER_CONFIG.boss.radius) boom = true;
      if (!boom) {
        for (let j = 0; j < world.minions.length; j++) {
          if (dist3(p, world.minions[j]) <= p.radius + world.minions[j].radius) {
            boom = true;
            break;
          }
        }
      }
      if (boom) {
        addImpact(p.x, p.y, p.z, p.splashRadius, 0.95, 0.4);
        splash(p, p.splashRadius, p.damage, p.owner);
        world.projectiles.splice(i, 1);
      }
      continue;
    }

    const hitHero = dist3(p, hero) <= p.radius + SHOOTER_CONFIG.player.radius;
    if (hitHero || hitWall || p.life <= 0) {
      addImpact(p.x, p.y, p.z, 1 + p.splashRadius, 0.8, 0.25);
      if (hitHero) damagePlayer(p.damage);
      else if (p.splashRadius > 0.2) splash(p, p.splashRadius, p.damage, p.owner);
      world.projectiles.splice(i, 1);
    }
  }
};

const stepImpacts = (delta) => {
  for (let i = world.impacts.length - 1; i >= 0; i--) {
    const fx = world.impacts[i];
    fx.life -= delta;
    fx.strength = clamp(fx.life / Math.max(fx.maxLife, EPS), 0, 1);
    fx.radius += delta * 2.7;
    if (fx.life <= 0) world.impacts.splice(i, 1);
  }
};

const stepWeapons = (dir, delta) => {
  hero.rocketCooldown = Math.max(0, hero.rocketCooldown - delta);
  hero.swordCooldown = Math.max(0, hero.swordCooldown - delta);
  hero.grappleCooldown = Math.max(0, hero.grappleCooldown - delta);
  hero.swordSwingTime = Math.max(0, hero.swordSwingTime - delta * 3.8);
  if (input.weaponSwitch >= 0 && input.weaponSwitch <= W_SWORD) hero.weaponIndex = input.weaponSwitch;
  input.weaponSwitch = -1;

  const fire = input.fire;
  const wantsGrapple = input.grapple || (hero.weaponIndex === W_GRAPPLE && fire);
  if (hero.weaponIndex !== W_GRAPPLE && hero.grappleActive) {
    hero.grappleActive = false;
    hero.grapplePoint = null;
  }
  if (hero.weaponIndex === W_GRAPPLE) {
    if (wantsGrapple && !hero.grappleActive && hero.grappleCooldown <= 0) {
      const target = findGrapple({ x: hero.x, y: hero.y + 1, z: hero.z }, dir);
      if (target) {
        hero.grappleActive = true;
        hero.grapplePoint = { x: target.x, y: target.y, z: target.z };
        hero.grappleTravelBoost = 1;
        addImpact(target.x, target.y, target.z, 0.8, 0.7, 0.3);
      } else {
        hero.grappleCooldown = 0.1;
      }
    }
    if (hero.grappleActive && hero.grapplePoint) {
      const to = {
        x: hero.grapplePoint.x - hero.x,
        y: hero.grapplePoint.y - (hero.y + 0.85),
        z: hero.grapplePoint.z - hero.z,
      };
      const d = Math.hypot(to.x, to.y, to.z);
      const pull = normalize3(to);
      const speed = SHOOTER_CONFIG.weapons.grapple.pullSpeed * (0.75 + hero.grappleTravelBoost * 0.35);
      hero.vx = approach(hero.vx, pull.x * speed, delta * 46);
      hero.vy = approach(hero.vy, pull.y * speed, delta * 38);
      hero.vz = approach(hero.vz, pull.z * speed, delta * 46);
      hero.grappleTravelBoost = approach(hero.grappleTravelBoost, 0.2, delta * 1.7);
      if (!wantsGrapple || d < 1.6) {
        hero.grappleActive = false;
        hero.grapplePoint = null;
        hero.grappleCooldown = SHOOTER_CONFIG.weapons.grapple.cooldown;
      }
    }
    return;
  }
  if (hero.weaponIndex === W_ROCKET && fire && hero.rocketCooldown <= 0) {
    fireRocket(dir);
    return;
  }
  if (hero.weaponIndex === W_SWORD && (fire || input.sword) && hero.swordCooldown <= 0) {
    useSword(dir);
  }
};

const stepHero = (delta) => {
  hero.damageFlash = approach(hero.damageFlash, 0, delta * 3.3);
  const dir = getLookDirection();
  hero.yaw = lookYaw;
  hero.pitch = lookPitch;
  hero.facing = dir.x >= 0 ? 1 : -1;
  stepWeapons(dir, delta);

  const mf = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const mr = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const f = forwardYaw(lookYaw);
  const r = { x: f.z, z: -f.x };
  const mx = r.x * mr + f.x * mf;
  const mz = r.z * mr + f.z * mf;
  const ml = Math.hypot(mx, mz);
  const tvx = ml > EPS ? (mx / ml) * SHOOTER_CONFIG.player.moveSpeed : 0;
  const tvz = ml > EPS ? (mz / ml) * SHOOTER_CONFIG.player.moveSpeed : 0;
  if (!hero.grappleActive) {
    hero.vx = approach(hero.vx, tvx, delta * SHOOTER_CONFIG.player.acceleration);
    hero.vz = approach(hero.vz, tvz, delta * SHOOTER_CONFIG.player.acceleration);
    if (ml <= EPS) {
      hero.vx = approach(hero.vx, 0, delta * SHOOTER_CONFIG.player.friction);
      hero.vz = approach(hero.vz, 0, delta * SHOOTER_CONFIG.player.friction);
    }
  }
  if (input.jump && hero.grounded) {
    hero.vy = SHOOTER_CONFIG.player.jumpVelocity;
    hero.grounded = false;
  }
  hero.vy = Math.max(hero.vy + SHOOTER_CONFIG.player.gravity * delta, -28);
  hero.x += hero.vx * delta;
  hero.y += hero.vy * delta;
  hero.z += hero.vz * delta;
  hero.x = clamp(hero.x, -SHOOTER_CONFIG.arena.halfWidth + SHOOTER_CONFIG.player.radius, SHOOTER_CONFIG.arena.halfWidth - SHOOTER_CONFIG.player.radius);
  hero.z = clamp(hero.z, SHOOTER_CONFIG.arena.depthNear + 1, SHOOTER_CONFIG.arena.depthFar - 2.4);
  if (hero.y <= SHOOTER_CONFIG.arena.floorY + SHOOTER_CONFIG.player.start.y) {
    hero.y = SHOOTER_CONFIG.arena.floorY + SHOOTER_CONFIG.player.start.y;
    hero.vy = 0;
    hero.grounded = true;
  } else {
    hero.grounded = false;
  }
  if (hero.y > SHOOTER_CONFIG.arena.ceilingY - 0.9) {
    hero.y = SHOOTER_CONFIG.arena.ceilingY - 0.9;
    hero.vy = Math.min(hero.vy, 0);
  }
  if (hero.z > checkpoint.z + 18) {
    checkpoint.x = hero.x;
    checkpoint.y = SHOOTER_CONFIG.player.start.y;
    checkpoint.z = hero.z - 2;
  }
};

const stepCamera = (delta) => {
  gameCamera.yaw = lookYaw;
  gameCamera.pitch = lookPitch;
  const f = forwardYaw(gameCamera.yaw);
  const targetX = hero.x - f.x * SHOOTER_CONFIG.camera.followDistance;
  const targetY = hero.y + SHOOTER_CONFIG.camera.height;
  const targetZ = hero.z - f.z * SHOOTER_CONFIG.camera.followDistance;
  const a = clamp(SHOOTER_CONFIG.camera.followLerp * (delta * 60), 0, 1);
  gameCamera.x = lerp(gameCamera.x, targetX, a);
  gameCamera.y = lerp(gameCamera.y, targetY, a);
  gameCamera.z = lerp(gameCamera.z, targetZ, a);
};

const stepScan = (delta) => {
  scan.distance += SHOOTER_CONFIG.scanSweep.speed * delta;
  if (scan.distance > scan.cycle) scan.distance = 0;
};

const stepGame = (delta) => {
  world.elapsed += delta;
  stepHero(delta);
  stepBoss(delta);
  stepMinions(delta);
  stepProjectiles(delta);
  stepImpacts(delta);
  stepCamera(delta);
  stepScan(delta);
  hp.value = hero.health;
  bossHp.value = boss.hp;
  minionsCount.value = world.minions.length;
  score.value = world.score;
};

const fillPools = () => {
  visibleStructureCount = 0;
  visibleAnchorCount = 0;
  visibleMinionCount = 0;
  visibleProjectileCount = 0;
  visibleImpactCount = 0;
  const nearZ = gameCamera.z - 20;
  const farZ = gameCamera.z + 220;

  for (let i = 0; i < world.structures.length && visibleStructureCount < MAX_STRUCTURES; i++) {
    const s = world.structures[i];
    if (s.z < nearZ || s.z > farZ) continue;
    const p = structurePool[visibleStructureCount];
    p.x = s.x;
    p.y = s.y;
    p.z = s.z;
    p.r = s.r;
    p.h = s.h;
    p.type = s.type;
    p.emissive = s.emissive;
    p.grapplable = s.grapplable;
    visibleStructureCount += 1;
  }
  for (let i = visibleStructureCount; i < MAX_STRUCTURES; i++) {
    const p = structurePool[i];
    p.x = -9999;
    p.y = -9999;
    p.z = -9999;
    p.r = 0;
    p.h = 0;
    p.type = 0;
    p.emissive = 0;
    p.grapplable = 0;
  }

  for (let i = 0; i < world.grappleAnchors.length && visibleAnchorCount < MAX_ANCHORS; i++) {
    const a = world.grappleAnchors[i];
    if (a.z < nearZ || a.z > farZ) continue;
    const p = anchorPool[visibleAnchorCount];
    p.x = a.x;
    p.y = a.y;
    p.z = a.z;
    p.radius = a.radius;
    p.active = a.active;
    visibleAnchorCount += 1;
  }
  for (let i = visibleAnchorCount; i < MAX_ANCHORS; i++) {
    const p = anchorPool[i];
    p.x = -9999;
    p.y = -9999;
    p.z = -9999;
    p.radius = 0;
    p.active = 0;
  }

  for (let i = 0; i < world.minions.length && visibleMinionCount < MAX_MINIONS; i++) {
    const m = world.minions[i];
    const p = minionPool[visibleMinionCount];
    p.x = m.x;
    p.y = m.y;
    p.z = m.z;
    p.radius = m.radius;
    p.hp = clamp(m.hp / Math.max(m.maxHp, EPS), 0, 1);
    p.phase = m.orbitPhase;
    p.flash = m.damageFlash;
    visibleMinionCount += 1;
  }
  for (let i = visibleMinionCount; i < MAX_MINIONS; i++) {
    const p = minionPool[i];
    p.x = -9999;
    p.y = -9999;
    p.z = -9999;
    p.radius = 0;
    p.hp = 0;
    p.phase = 0;
    p.flash = 0;
  }

  for (let i = 0; i < world.projectiles.length && visibleProjectileCount < MAX_PROJECTILES; i++) {
    const pr = world.projectiles[i];
    const p = projectilePool[visibleProjectileCount];
    p.x = pr.x;
    p.y = pr.y;
    p.z = pr.z;
    p.radius = pr.radius;
    p.kind = pr.kind === "rocket" ? 0 : 1;
    p.lifeRatio = clamp(pr.life / Math.max(pr.maxLife, EPS), 0, 1);
    p.owner = pr.owner === "player" ? 0 : 1;
    p.glow = pr.kind === "rocket" ? 1 : 0.75;
    visibleProjectileCount += 1;
  }
  for (let i = visibleProjectileCount; i < MAX_PROJECTILES; i++) {
    const p = projectilePool[i];
    p.x = -9999;
    p.y = -9999;
    p.z = -9999;
    p.radius = 0;
    p.kind = 0;
    p.lifeRatio = 0;
    p.owner = 0;
    p.glow = 0;
  }

  for (let i = 0; i < world.impacts.length && visibleImpactCount < MAX_IMPACTS; i++) {
    const fx = world.impacts[i];
    const p = impactPool[visibleImpactCount];
    p.x = fx.x;
    p.y = fx.y;
    p.z = fx.z;
    p.radius = fx.radius;
    p.strength = fx.strength;
    visibleImpactCount += 1;
  }
  for (let i = visibleImpactCount; i < MAX_IMPACTS; i++) {
    const p = impactPool[i];
    p.x = -9999;
    p.y = -9999;
    p.z = -9999;
    p.radius = 0;
    p.strength = 0;
  }
};

const syncUniforms = (t) => {
  fillPools();
  material.uniforms.uTime.value = t;
  material.uniforms.uCameraPos.value.set(gameCamera.x, gameCamera.y, gameCamera.z);
  material.uniforms.uCameraYaw.value = gameCamera.yaw;
  material.uniforms.uCameraPitch.value = gameCamera.pitch;
  material.uniforms.uFov.value = SHOOTER_CONFIG.camera.fov;
  material.uniforms.uArenaHalfWidth.value = SHOOTER_CONFIG.arena.halfWidth;
  material.uniforms.uArenaFloorY.value = SHOOTER_CONFIG.arena.floorY;
  material.uniforms.uArenaCeilingY.value = SHOOTER_CONFIG.arena.ceilingY;
  material.uniforms.uPlayerPos.value.set(hero.x, hero.y, hero.z);
  material.uniforms.uPlayerVelocity.value.set(hero.vx, hero.vy, hero.vz);
  material.uniforms.uPlayerWeapon.value = hero.weaponIndex;
  material.uniforms.uPlayerHealthNorm.value = clamp(hero.health / Math.max(hero.maxHealth, EPS), 0, 1);
  material.uniforms.uPlayerGrappleActive.value = hero.grappleActive ? 1 : 0;
  if (hero.grapplePoint) {
    material.uniforms.uPlayerGrapplePoint.value.set(hero.grapplePoint.x, hero.grapplePoint.y, hero.grapplePoint.z);
  } else {
    material.uniforms.uPlayerGrapplePoint.value.set(hero.x, hero.y + 1, hero.z + 1);
  }
  material.uniforms.uPlayerSwordSwing.value = hero.swordSwingTime;
  material.uniforms.uBossPos.value.set(boss.x, boss.y, boss.z);
  material.uniforms.uBossHealthNorm.value = clamp(boss.hp / Math.max(boss.maxHp, EPS), 0, 1);
  material.uniforms.uBossLookUp.value = boss.lookUp;
  material.uniforms.uBossSummonPulse.value = boss.pulse;
  material.uniforms.uBossAlive.value = boss.alive ? 1 : 0;
  material.uniforms.uScanOriginZ.value = hero.z;
  material.uniforms.uScanDistance.value = scan.distance;
  material.uniforms.uScanWidth.value = SHOOTER_CONFIG.scanSweep.width;
  material.uniforms.uScanIntensity.value = SHOOTER_CONFIG.scanSweep.intensity;

  const ss = material.uniforms.uStructures.value;
  const sm = material.uniforms.uStructureMeta.value;
  for (let i = 0; i < MAX_STRUCTURES; i++) {
    const p = structurePool[i];
    ss[i].set(p.x, p.y, p.z, p.r);
    sm[i].set(p.h, p.type, p.emissive, p.grapplable);
  }
  material.uniforms.uStructureCount.value = visibleStructureCount;

  const as = material.uniforms.uAnchors.value;
  const ast = material.uniforms.uAnchorState.value;
  for (let i = 0; i < MAX_ANCHORS; i++) {
    const p = anchorPool[i];
    as[i].set(p.x, p.y, p.z, p.radius);
    ast[i] = p.active;
  }
  material.uniforms.uAnchorCount.value = visibleAnchorCount;

  const ms = material.uniforms.uMinions.value;
  const mm = material.uniforms.uMinionMeta.value;
  for (let i = 0; i < MAX_MINIONS; i++) {
    const p = minionPool[i];
    ms[i].set(p.x, p.y, p.z, p.radius);
    mm[i].set(p.hp, p.phase, p.flash, 1);
  }
  material.uniforms.uMinionCount.value = visibleMinionCount;

  const ps = material.uniforms.uProjectiles.value;
  const pm = material.uniforms.uProjectileMeta.value;
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    const p = projectilePool[i];
    ps[i].set(p.x, p.y, p.z, p.radius);
    pm[i].set(p.kind, p.lifeRatio, p.owner, p.glow);
  }
  material.uniforms.uProjectileCount.value = visibleProjectileCount;

  const is = material.uniforms.uImpacts.value;
  const ist = material.uniforms.uImpactStrength.value;
  for (let i = 0; i < MAX_IMPACTS; i++) {
    const p = impactPool[i];
    is[i].set(p.x, p.y, p.z, p.radius);
    ist[i] = p.strength;
  }
  material.uniforms.uImpactCount.value = visibleImpactCount;
};

const onResize = () => {
  if (!container.value || !renderer || !material) return;
  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));
  const gameWidth = Math.max(1, Math.floor(width * SHOOTER_CONFIG.render.gameViewportWidthRatio));
  const gameX = (width - gameWidth) * 0.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  gameViewportPx.x = gameX;
  gameViewportPx.y = 0;
  gameViewportPx.w = gameWidth;
  gameViewportPx.h = height;
  material.uniforms.uResolution.value.set(width, height);
  material.uniforms.uGameViewport.value.set(gameX, 0, gameWidth, height);
  material.uniforms.uPixelScale.value = SHOOTER_CONFIG.render.pixelationScale;
};

const ignoreKey = (e) => {
  const t = e.target;
  if (!t) return false;
  const tag = t.tagName;
  return t.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

const setKey = (e, v) => {
  if (v && ignoreKey(e)) return false;
  let handled = false;
  if (e.code === "KeyW" || e.code === "ArrowUp") {
    input.forward = v;
    handled = true;
  } else if (e.code === "KeyS" || e.code === "ArrowDown") {
    input.backward = v;
    handled = true;
  } else if (e.code === "KeyA" || e.code === "ArrowLeft") {
    input.left = v;
    handled = true;
  } else if (e.code === "KeyD" || e.code === "ArrowRight") {
    input.right = v;
    handled = true;
  } else if (e.code === "Space") {
    input.jump = v;
    handled = true;
  } else if (e.code === "KeyJ" || e.code === "ControlLeft") {
    input.fire = v;
    handled = true;
  } else if (e.code === "KeyE") {
    input.grapple = v;
    handled = true;
  } else if (e.code === "KeyF") {
    input.sword = v;
    handled = true;
  } else if (v && e.code === "Digit1") {
    input.weaponSwitch = W_GRAPPLE;
    handled = true;
  } else if (v && e.code === "Digit2") {
    input.weaponSwitch = W_ROCKET;
    handled = true;
  } else if (v && e.code === "Digit3") {
    input.weaponSwitch = W_SWORD;
    handled = true;
  }
  return handled;
};

const clearInput = () => {
  input.forward = false;
  input.backward = false;
  input.left = false;
  input.right = false;
  input.jump = false;
  input.fire = false;
  input.grapple = false;
  input.sword = false;
  input.pointerActive = false;
};

const onKeyDown = (e) => {
  if (setKey(e, true)) e.preventDefault();
};
const onKeyUp = (e) => {
  if (setKey(e, false)) e.preventDefault();
};

const requestPointerLock = () => {
  if (!container.value || !document.pointerLockElement) return;
  if (typeof container.value.requestPointerLock === "function") {
    container.value.requestPointerLock();
  }
};

const onPointerLockChange = () => {
  pointerLocked = document.pointerLockElement === container.value;
  input.pointerActive = pointerLocked;
};

const onPointerMove = (e) => {
  if (!pointerLocked) return;
  lookYaw += e.movementX * LOOK_SENSITIVITY;
  lookPitch = clamp(
    lookPitch - e.movementY * LOOK_SENSITIVITY,
    LOOK_PITCH_MIN,
    LOOK_PITCH_MAX,
  );
};

const onPointerDown = (e) => {
  requestPointerLock();
  if (e.button === 0) {
    input.fire = true;
    e.preventDefault();
  } else if (e.button === 2) {
    input.grapple = true;
    e.preventDefault();
  }
};
const onPointerUp = (e) => {
  if (e.button === 0) {
    input.fire = false;
    e.preventDefault();
  } else if (e.button === 2) {
    input.grapple = false;
    e.preventDefault();
  }
};

const initGL = async () => {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.domElement.classList.add("fit");
  container.value.appendChild(renderer.domElement);
  material = createBackgroundMaterial(1, 1);
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);
  buildArena();
  onResize();
  previousTimeMs = performance.now();
  const animate = (nowMs) => {
    const delta = clamp((nowMs - previousTimeMs) / 1000, 0, 1 / 24);
    previousTimeMs = nowMs;
    stepGame(delta);
    syncUniforms(nowMs * 0.001);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  };
  frameId = requestAnimationFrame(animate);
};

onMounted(async () => {
  await initGL();
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearInput);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointerlockchange", onPointerLockChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", clearInput);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointerup", onPointerUp);
  document.removeEventListener("pointerlockchange", onPointerLockChange);
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  if (quad) quad.geometry.dispose();
  if (material) material.dispose();
  if (renderer) {
    renderer.dispose();
    if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
});
</script>
