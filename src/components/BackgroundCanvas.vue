<template>
  <div ref="container" class="background-canvas fit"></div>
  <div class="game-hud">
    <div class="game-hud__line">
      ITEMS <span class="game-hud__value game-hud__value--items">{{ hudItems }}</span>
      &nbsp; LIVES <span class="game-hud__value game-hud__value--lives">{{ hudLives }}</span>
      &nbsp; SCORE <span class="game-hud__value game-hud__value--score">{{ hudScore }}</span>
    </div>
  </div>
</template>

<style lang="scss">
.background-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  background-color: black;
  pointer-events: none;
}

.game-hud {
  position: fixed;
  top: 0.85rem;
  right: 0.85rem;
  z-index: 120;
  pointer-events: none;
  font-family: "Courier New", monospace;
  font-size: 0.92rem;
  letter-spacing: 0.08em;
  color: #b8fff4;
  text-align: right;
  text-shadow:
    0 0 8px rgba(97, 255, 220, 0.35),
    0 0 2px rgba(0, 0, 0, 0.9);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

.game-hud__line {
  white-space: nowrap;
}

.game-hud__value {
  display: inline-block;
  text-align: right;
}

.game-hud__value--items {
  min-width: 4ch;
}

.game-hud__value--lives {
  min-width: 2ch;
}

.game-hud__value--score {
  min-width: 7ch;
}
</style>

<script setup>
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dom } from "quasar";
import { create as createBackgroundMaterial } from "assets/materials/background/material";

const MAX_VISIBLE_PLATFORMS = 28;
const MAX_VISIBLE_COLLECTIBLES = 12;
const VIEW_HEIGHT = 22;
const WORLD_HALF_WIDTH = 17;
const WORLD_TOP_LIMIT = 520;
const LEVEL_FILL_MIN = 0.6;
const LEVEL_FILL_MAX = 0.9;
const JUMP_GAP_SCALE = 1.5;
const HERO_WIDTH = 0.74;
const GRAVITY = -40;
const JUMP_VELOCITY = 16.5;
const SUPER_JUMP_VELOCITY = JUMP_VELOCITY * 1.732;
const DOUBLE_JUMP_VELOCITY = 15.4;
const MAX_FALL_SPEED = -35;
const GROUND_ACCELERATION = 52;
const AIR_ACCELERATION = 30;
const GROUND_FRICTION = 22;
const AIR_FRICTION = 7;
const MAX_MOVE_SPEED = 9;
const COYOTE_TIME = 0.11;
const JUMP_BUFFER_TIME = 0.12;
const SUPER_JUMP_CHARGE_REQUIRED = 0.01;
const SUPER_JUMP_CHARGE_MAX = 0.4;
const SUPER_JUMP_RELEASE_WINDOW = 0.25;
const COLLECTIBLE_PICKUP_RADIUS = 0.58;
const CAMERA_BASE_OFFSET = 4.8;
const CAMERA_MIN_Y = -9;
const START_POS = { x: 0, y: 1.12 };
const START_LIVES = 3;

let camera, scene, renderer, material, quad;
let frameId = null;
let previousTimeMs = 0;
let viewWidth = VIEW_HEIGHT;
let viewHeight = VIEW_HEIGHT;
let visiblePlatformCount = 0;
let visibleCollectibleCount = 0;

const container = ref(null);
const livesLeft = ref(START_LIVES);
const collectedItems = ref(0);
const highestRow = ref(0);
const score = computed(() => highestRow.value * collectedItems.value);
const formatHudNumber = (value, digits) => {
  return Math.max(0, Math.floor(value))
    .toString()
    .padStart(digits, "0")
    .slice(-digits);
};
const hudItems = computed(() => formatHudNumber(collectedItems.value, 4));
const hudLives = computed(() => formatHudNumber(livesLeft.value, 2));
const hudScore = computed(() => formatHudNumber(score.value, 7));

const worldPlatforms = [];
const worldCollectibles = [];
const rowMilestones = [];
let nextCollectibleId = 1;

const platformPool = Array.from({ length: MAX_VISIBLE_PLATFORMS }, () => ({
  x: -9999,
  y: -9999,
  w: 0,
  h: 0,
}));

const collectiblePool = Array.from({ length: MAX_VISIBLE_COLLECTIBLES }, () => ({
  x: -9999,
  y: -9999,
  phase: 0,
}));

const checkpoint = {
  x: START_POS.x,
  y: START_POS.y,
};

const inputState = {
  left: false,
  right: false,
  down: false,
  jumpQueued: false,
};

const hero = {
  x: START_POS.x,
  y: START_POS.y,
  vx: 0,
  vy: 0,
  facing: 1,
  grounded: false,
  coyoteLeft: 0,
  jumpBufferLeft: 0,
  crouch: 0,
  superJumpCharge: 0,
  superJumpWindow: 0,
  airJumpsLeft: 1,
};

const gameCamera = {
  x: 0,
  y: 6.5,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => value - Math.floor(value);

const seededNoise = (seed) => {
  return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
};

const approach = (value, target, maxDelta) => {
  if (value < target) {
    return Math.min(value + maxDelta, target);
  }

  return Math.max(value - maxDelta, target);
};

const shouldIgnoreKeyEvent = (event) => {
  const target = event.target;
  if (!target) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

const setKeyState = (event, value) => {
  if (value && shouldIgnoreKeyEvent(event)) {
    return false;
  }

  const isLeft = event.code === "ArrowLeft" || event.code === "KeyA";
  const isRight = event.code === "ArrowRight" || event.code === "KeyD";
  const isDown = event.code === "ArrowDown" || event.code === "KeyS";
  const isJump =
    event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space";

  if (!isLeft && !isRight && !isDown && !isJump) {
    return false;
  }

  if (isLeft) {
    inputState.left = value;
  }

  if (isRight) {
    inputState.right = value;
  }

  if (isDown) {
    inputState.down = value;
  }

  if (isJump && value && !event.repeat) {
    inputState.jumpQueued = true;
  }

  return true;
};

const clearInputState = () => {
  inputState.left = false;
  inputState.right = false;
  inputState.down = false;
  inputState.jumpQueued = false;
};

const onKeyDown = (event) => {
  if (setKeyState(event, true)) {
    event.preventDefault();
  }
};

const onKeyUp = (event) => {
  if (setKeyState(event, false)) {
    event.preventDefault();
  }
};

const addCollectibleForPlatform = (platform, seed) => {
  if (platform.y < 3.0 || seededNoise(seed) < 0.42) {
    return;
  }

  const offsetX = 0.15 + seededNoise(seed + 0.73) * 0.7;
  worldCollectibles.push({
    id: nextCollectibleId++,
    x: platform.x + platform.w * offsetX,
    y: platform.y + platform.h + 0.82,
    phase: seededNoise(seed + 1.53) * Math.PI * 2,
    collected: false,
  });
};

const generateWorld = () => {
  worldPlatforms.length = 0;
  worldCollectibles.length = 0;
  rowMilestones.length = 0;
  nextCollectibleId = 1;

  worldPlatforms.push({
    x: -WORLD_HALF_WIDTH,
    y: 0,
    w: WORLD_HALF_WIDTH * 2,
    h: 1.12,
  });

  const worldWidth = WORLD_HALF_WIDTH * 2;
  const minEdgeWidth = 2.6;
  const holeDriftRange = 10.8 * JUMP_GAP_SCALE;

  let y = 2.1;
  let row = 0;
  let prevHoleCenter = 0;

  while (y < WORLD_TOP_LIMIT) {
    const spacing = (2.15 + seededNoise(row * 0.83) * 1.15) * JUMP_GAP_SCALE;
    y += spacing;
    rowMilestones.push(y);

    const fillRatio =
      LEVEL_FILL_MIN +
      seededNoise(row * 1.27) * (LEVEL_FILL_MAX - LEVEL_FILL_MIN);
    const filledWidth = worldWidth * fillRatio;
    const holeWidth = worldWidth - filledWidth;

    const desiredHoleCenter =
      prevHoleCenter + (seededNoise(row * 2.01) - 0.5) * holeDriftRange;
    const centerMin = -WORLD_HALF_WIDTH + holeWidth * 0.5 + minEdgeWidth;
    const centerMax = WORLD_HALF_WIDTH - holeWidth * 0.5 - minEdgeWidth;
    const holeCenter =
      centerMin <= centerMax
        ? clamp(desiredHoleCenter, centerMin, centerMax)
        : 0;

    const holeStart = holeCenter - holeWidth * 0.5;
    const holeEnd = holeCenter + holeWidth * 0.5;

    const leftWidth = holeStart + WORLD_HALF_WIDTH;
    if (leftWidth > 1.8) {
      const leftPlatform = {
        x: -WORLD_HALF_WIDTH,
        y,
        w: leftWidth,
        h: 0.82 + seededNoise(row * 3.49) * 0.12,
      };
      worldPlatforms.push(leftPlatform);
      addCollectibleForPlatform(leftPlatform, row * 4.31);
    }

    const rightWidth = WORLD_HALF_WIDTH - holeEnd;
    if (rightWidth > 1.8) {
      const rightPlatform = {
        x: holeEnd,
        y,
        w: rightWidth,
        h: 0.82 + seededNoise(row * 5.71) * 0.12,
      };
      worldPlatforms.push(rightPlatform);
      addCollectibleForPlatform(rightPlatform, row * 6.37);
    }

    if (seededNoise(row * 7.11) > 0.45 && holeWidth > 2.4) {
      const bridgeWidth = clamp(
        holeWidth * (0.28 + seededNoise(row * 8.13) * 0.24),
        2.2,
        5.2,
      );
      const bridgeRange = Math.max(0, (holeWidth - bridgeWidth) * 0.5);
      const bridgeCenter = holeCenter + (seededNoise(row * 9.17) - 0.5) * bridgeRange * 1.2;
      const bridgePlatform = {
        x: bridgeCenter - bridgeWidth * 0.5,
        y: y + 0.75 + seededNoise(row * 10.3) * 0.7,
        w: bridgeWidth,
        h: 0.74 + seededNoise(row * 11.7) * 0.08,
      };
      worldPlatforms.push(bridgePlatform);
      addCollectibleForPlatform(bridgePlatform, row * 12.9);
    }

    prevHoleCenter = holeCenter;
    row++;
  }

  worldPlatforms.sort((a, b) => a.y - b.y);
  worldCollectibles.sort((a, b) => a.y - b.y);
};

const calculateRowFromHeight = (height) => {
  let row = 0;

  while (row < rowMilestones.length && height >= rowMilestones[row] - 0.15) {
    row++;
  }

  return row;
};

const updateHighestRow = (height) => {
  highestRow.value = Math.max(highestRow.value, calculateRowFromHeight(height));
};

const collectVisiblePlatforms = (heroY, cameraY) => {
  const minY = Math.min(heroY, cameraY) - viewHeight * 0.96 - 2;
  const maxY = Math.max(heroY, cameraY) + viewHeight * 1.0 + 2;
  let index = 0;

  for (let i = 0; i < worldPlatforms.length && index < MAX_VISIBLE_PLATFORMS; i++) {
    const platform = worldPlatforms[i];
    if (platform.y + platform.h < minY) {
      continue;
    }

    if (platform.y > maxY) {
      break;
    }

    platformPool[index].x = platform.x;
    platformPool[index].y = platform.y;
    platformPool[index].w = platform.w;
    platformPool[index].h = platform.h;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_PLATFORMS; i++) {
    platformPool[i].x = -9999;
    platformPool[i].y = -9999;
    platformPool[i].w = 0;
    platformPool[i].h = 0;
  }

  visiblePlatformCount = index;
};

const collectVisibleCollectibles = (cameraY) => {
  const minY = cameraY - viewHeight * 0.96 - 1;
  const maxY = cameraY + viewHeight * 0.96 + 1;
  let index = 0;

  for (
    let i = 0;
    i < worldCollectibles.length && index < MAX_VISIBLE_COLLECTIBLES;
    i++
  ) {
    const collectible = worldCollectibles[i];
    if (collectible.collected) {
      continue;
    }

    if (collectible.y < minY) {
      continue;
    }

    if (collectible.y > maxY) {
      break;
    }

    collectiblePool[index].x = collectible.x;
    collectiblePool[index].y = collectible.y;
    collectiblePool[index].phase = collectible.phase;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_COLLECTIBLES; i++) {
    collectiblePool[i].x = -9999;
    collectiblePool[i].y = -9999;
    collectiblePool[i].phase = 0;
  }

  visibleCollectibleCount = index;
};

const collectNearbyCollectibles = () => {
  const heroCenterY = hero.y + 0.82;

  for (let i = 0; i < worldCollectibles.length; i++) {
    const collectible = worldCollectibles[i];
    if (collectible.collected) {
      continue;
    }

    const dx = hero.x - collectible.x;
    const dy = heroCenterY - collectible.y;
    if (dx * dx + dy * dy <= COLLECTIBLE_PICKUP_RADIUS * COLLECTIBLE_PICKUP_RADIUS) {
      collectible.collected = true;
      collectedItems.value += 1;
    }
  }
};

const resetCollectiblesProgress = () => {
  for (let i = 0; i < worldCollectibles.length; i++) {
    worldCollectibles[i].collected = false;
  }

  collectedItems.value = 0;
};

const resetHero = (x = START_POS.x, y = START_POS.y) => {
  hero.x = x;
  hero.y = y;
  hero.vx = 0;
  hero.vy = 0;
  hero.facing = 1;
  hero.grounded = false;
  hero.coyoteLeft = 0;
  hero.jumpBufferLeft = 0;
  hero.crouch = 0;
  hero.superJumpCharge = 0;
  hero.superJumpWindow = 0;
  hero.airJumpsLeft = 1;
  gameCamera.x = 0;
  gameCamera.y = Math.max(CAMERA_MIN_Y, y + CAMERA_BASE_OFFSET);
};

const onHeroDeath = () => {
  livesLeft.value -= 1;

  if (livesLeft.value <= 0) {
    livesLeft.value = START_LIVES;
    highestRow.value = 0;
    checkpoint.x = START_POS.x;
    checkpoint.y = START_POS.y;
    resetCollectiblesProgress();
    resetHero(START_POS.x, START_POS.y);
    return;
  }

  resetHero(checkpoint.x, Math.max(START_POS.y, checkpoint.y));
};

const resolveLanding = (previousY) => {
  if (hero.vy > 0) {
    return false;
  }

  const left = hero.x - HERO_WIDTH * 0.5 + 0.04;
  const right = hero.x + HERO_WIDTH * 0.5 - 0.04;
  let bestLanding = -Infinity;

  for (let i = 0; i < visiblePlatformCount; i++) {
    const platform = platformPool[i];
    const platformTop = platform.y + platform.h;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.w;

    if (right <= platformLeft + 0.02 || left >= platformRight - 0.02) {
      continue;
    }

    if (previousY >= platformTop && hero.y <= platformTop) {
      bestLanding = Math.max(bestLanding, platformTop);
    }
  }

  if (bestLanding > -Infinity) {
    hero.y = bestLanding;
    hero.vy = 0;
    return true;
  }

  return false;
};

const stepGame = (delta) => {
  const wasGrounded = hero.grounded;
  const crouchWanted = inputState.down && hero.grounded;
  hero.crouch = approach(hero.crouch, crouchWanted ? 1 : 0, delta * 9.5);

  const horizontalInput = crouchWanted
    ? 0
    : (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
  const acceleration = hero.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION;
  const friction = hero.grounded ? GROUND_FRICTION : AIR_FRICTION;

  hero.vx = approach(hero.vx, horizontalInput * MAX_MOVE_SPEED, acceleration * delta);

  if (horizontalInput === 0) {
    hero.vx = approach(hero.vx, 0, friction * delta);
  }

  if (horizontalInput !== 0) {
    hero.facing = horizontalInput > 0 ? 1 : -1;
  }

  if (inputState.jumpQueued) {
    hero.jumpBufferLeft = JUMP_BUFFER_TIME;
    inputState.jumpQueued = false;
  } else {
    hero.jumpBufferLeft = Math.max(0, hero.jumpBufferLeft - delta);
  }

  hero.coyoteLeft = hero.grounded
    ? COYOTE_TIME
    : Math.max(0, hero.coyoteLeft - delta);

  hero.superJumpWindow = Math.max(0, hero.superJumpWindow - delta);

  if (hero.grounded && inputState.down) {
    hero.superJumpCharge = Math.min(
      SUPER_JUMP_CHARGE_MAX,
      hero.superJumpCharge + delta,
    );
  } else {
    if (hero.grounded && hero.superJumpCharge >= SUPER_JUMP_CHARGE_REQUIRED) {
      hero.superJumpWindow = SUPER_JUMP_RELEASE_WINDOW;
    }

    hero.superJumpCharge = Math.max(0, hero.superJumpCharge - delta * 3);
  }

  if (hero.jumpBufferLeft > 0) {
    if (hero.grounded || hero.coyoteLeft > 0) {
      const hasSuperCharge = hero.superJumpCharge >= SUPER_JUMP_CHARGE_REQUIRED;
      const useSuperJump =
        hasSuperCharge && (inputState.down || hero.superJumpWindow > 0);

      hero.vy = useSuperJump ? SUPER_JUMP_VELOCITY : JUMP_VELOCITY;
      hero.grounded = false;
      hero.coyoteLeft = 0;
      hero.jumpBufferLeft = 0;
      hero.superJumpCharge = 0;
      hero.superJumpWindow = 0;
      hero.airJumpsLeft = 1;
    } else if (!hero.grounded && hero.airJumpsLeft > 0) {
      hero.vy = DOUBLE_JUMP_VELOCITY;
      hero.airJumpsLeft -= 1;
      hero.jumpBufferLeft = 0;
      hero.superJumpWindow = 0;
    }
  }

  hero.vy = Math.max(MAX_FALL_SPEED, hero.vy + GRAVITY * delta);

  const previousY = hero.y;

  hero.x += hero.vx * delta;
  const leftBound = -WORLD_HALF_WIDTH + HERO_WIDTH * 0.5;
  const rightBound = WORLD_HALF_WIDTH - HERO_WIDTH * 0.5;
  const clampedX = clamp(hero.x, leftBound, rightBound);
  if (clampedX !== hero.x) {
    hero.vx = 0;
    hero.x = clampedX;
  }

  hero.y += hero.vy * delta;
  collectVisiblePlatforms(hero.y, gameCamera.y);
  hero.grounded = resolveLanding(previousY);

  if (hero.grounded) {
    hero.airJumpsLeft = 1;
  }

  if (!wasGrounded && hero.grounded && hero.y > checkpoint.y + 2.4) {
    checkpoint.x = hero.x;
    checkpoint.y = hero.y - 0.3;
  }

  updateHighestRow(Math.max(hero.y, checkpoint.y));
  collectNearbyCollectibles();

  const verticalDropLimit = gameCamera.y - viewHeight * 0.98;
  if (hero.y < verticalDropLimit) {
    onHeroDeath();
  }
};

const syncUniforms = (timeSeconds) => {
  const defaultY = hero.y + CAMERA_BASE_OFFSET;
  const lookDownY = hero.y - viewHeight * 0.43;
  const targetCameraY = THREE.MathUtils.lerp(defaultY, lookDownY, hero.crouch);

  gameCamera.x = 0;
  gameCamera.y = THREE.MathUtils.lerp(
    gameCamera.y,
    clamp(targetCameraY, CAMERA_MIN_Y, WORLD_TOP_LIMIT),
    hero.crouch > 0.05 ? 0.17 : 0.08,
  );

  collectVisiblePlatforms(hero.y, gameCamera.y);
  collectVisibleCollectibles(gameCamera.y);

  const shaderPlatforms = material.uniforms.uPlatforms.value;
  for (let i = 0; i < MAX_VISIBLE_PLATFORMS; i++) {
    const platform = platformPool[i];
    shaderPlatforms[i].set(platform.x, platform.y, platform.w, platform.h);
  }

  const shaderCollectibles = material.uniforms.uCollectibles.value;
  for (let i = 0; i < MAX_VISIBLE_COLLECTIBLES; i++) {
    const item = collectiblePool[i];
    shaderCollectibles[i].set(item.x, item.y, item.phase, 1);
  }

  material.uniforms.uTime.value = timeSeconds;
  material.uniforms.uCameraPos.value.set(gameCamera.x, gameCamera.y);
  material.uniforms.uHeroPos.value.set(hero.x, hero.y);
  material.uniforms.uHeroVelocity.value.set(hero.vx, hero.vy);
  material.uniforms.uHeroFacing.value = hero.facing;
  material.uniforms.uHeroGrounded.value = hero.grounded ? 1.0 : 0.0;
  material.uniforms.uHeroCrouch.value = hero.crouch;
  material.uniforms.uPlatformCount.value = visiblePlatformCount;
  material.uniforms.uCollectibleCount.value = visibleCollectibleCount;
};

const onResize = () => {
  if (!container.value || !renderer || !material) {
    return;
  }

  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  viewHeight = VIEW_HEIGHT;
  viewWidth = (width / height) * viewHeight;

  material.uniforms.uResolution.value.set(width, height);
  material.uniforms.uViewSize.value.set(viewWidth, viewHeight);
};

const createRenderer = async () => {
  const rendererOptions = {
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  };

  if (typeof navigator !== "undefined" && navigator.gpu) {
    try {
      const webgpuRenderer = new WebGPURenderer(rendererOptions);
      await webgpuRenderer.init();
      return webgpuRenderer;
    } catch {
      // Fallback to WebGL on unsupported drivers/browsers.
    }
  }

  return new THREE.WebGLRenderer(rendererOptions);
};

const initGL = async () => {
  generateWorld();

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;

  renderer = await createRenderer();
  renderer.domElement.classList.add("fit");
  container.value.appendChild(renderer.domElement);

  material = createBackgroundMaterial(1, 1);
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  checkpoint.x = START_POS.x;
  checkpoint.y = START_POS.y;
  livesLeft.value = START_LIVES;
  highestRow.value = 0;
  resetCollectiblesProgress();
  resetHero(START_POS.x, START_POS.y);
  collectVisiblePlatforms(hero.y, gameCamera.y);
  collectVisibleCollectibles(gameCamera.y);
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
  window.addEventListener("blur", clearInputState);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", clearInputState);

  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  if (quad) {
    quad.geometry.dispose();
  }

  if (material) {
    material.dispose();
  }

  if (renderer) {
    renderer.dispose();
    if (typeof renderer.forceContextLoss === "function") {
      renderer.forceContextLoss();
    }

    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
});
</script>
