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
const MAX_VISIBLE_LADDERS = 20;
const BASE_VIEW_HEIGHT = 22;
const BASE_REFERENCE_HEIGHT = 900;
const WORLD_UNITS_PER_PIXEL = BASE_VIEW_HEIGHT / BASE_REFERENCE_HEIGHT;
const WORLD_HALF_WIDTH = 17;
const WORLD_TOP_LIMIT = 520;
const JUMP_GAP_SCALE = 1.5;
const HERO_WIDTH = 0.74;
const PLATFORM_GAP_MULTIPLIER = 1.8;
const MOVING_PLATFORM_CHANCE = 0.3;
const MOVING_PLATFORM_SPEED = 2.25;
const LADDER_WIDTH = 0.32;
const LADDER_CLIMB_SPEED = 7.6;
const LADDER_GRAB_RADIUS_X = 0.45;
const LADDER_GRAB_RADIUS_Y = 0.75;
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
const START_POS = { x: 0, y: 1.16 };
const START_LIVES = 3;

let camera, scene, renderer, material, quad;
let frameId = null;
let previousTimeMs = 0;
let viewWidth = BASE_VIEW_HEIGHT;
let viewHeight = BASE_VIEW_HEIGHT;
let visiblePlatformCount = 0;
let visibleCollectibleCount = 0;
let visibleLadderCount = 0;

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
const worldLadders = [];
const rowMilestones = [];
let nextCollectibleId = 1;

const platformPool = Array.from({ length: MAX_VISIBLE_PLATFORMS }, () => ({
  x: -9999,
  y: -9999,
  w: 0,
  h: 0,
  motion: 0,
  ref: null,
}));

const collectiblePool = Array.from({ length: MAX_VISIBLE_COLLECTIBLES }, () => ({
  x: -9999,
  y: -9999,
  phase: 0,
}));

const ladderPool = Array.from({ length: MAX_VISIBLE_LADDERS }, () => ({
  x: -9999,
  y: -9999,
  w: 0,
  h: 0,
  ref: null,
}));

const checkpoint = {
  x: START_POS.x,
  y: START_POS.y,
};

const inputState = {
  left: false,
  right: false,
  up: false,
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
  supportPlatform: null,
  onLadder: false,
  ladder: null,
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
  const isUp = event.code === "ArrowUp" || event.code === "KeyW";
  const isDown = event.code === "ArrowDown" || event.code === "KeyS";
  const isJump = isUp || event.code === "Space";

  if (!isLeft && !isRight && !isUp && !isDown && !isJump) {
    return false;
  }

  if (isLeft) {
    inputState.left = value;
  }

  if (isRight) {
    inputState.right = value;
  }

  if (isUp) {
    inputState.up = value;
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
  inputState.up = false;
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
  worldLadders.length = 0;
  rowMilestones.length = 0;
  nextCollectibleId = 1;

  worldPlatforms.push({
    x: -WORLD_HALF_WIDTH,
    y: 0,
    w: WORLD_HALF_WIDTH * 2,
    h: 1.12,
    moveDir: 0,
    moveSpeed: 0,
  });

  const minEdgeWidth = 2.6;
  const fixedGapWidth = HERO_WIDTH * PLATFORM_GAP_MULTIPLIER;
  const holeDriftRange = 10.8 * JUMP_GAP_SCALE;
  const addLadderBetweenRows = (lowerPlatform, upperPlatform, seed) => {
    if (!lowerPlatform || !upperPlatform) {
      return false;
    }

    const ladderPadding = LADDER_WIDTH * 0.72 + 0.1;
    const overlapStart = Math.max(
      lowerPlatform.x + ladderPadding,
      upperPlatform.x + ladderPadding,
    );
    const overlapEnd = Math.min(
      lowerPlatform.x + lowerPlatform.w - ladderPadding,
      upperPlatform.x + upperPlatform.w - ladderPadding,
    );

    if (overlapEnd <= overlapStart) {
      return false;
    }

    const bottom = lowerPlatform.y + lowerPlatform.h;
    const top = upperPlatform.y + upperPlatform.h;
    if (top <= bottom + 0.4) {
      return false;
    }

    worldLadders.push({
      x: THREE.MathUtils.lerp(overlapStart, overlapEnd, seededNoise(seed)),
      y: bottom,
      w: LADDER_WIDTH,
      h: top - bottom,
    });

    return true;
  };

  let y = 2.1;
  let row = 0;
  let prevHoleCenter = 0;
  let previousLeftPlatform = worldPlatforms[0];
  let previousRightPlatform = worldPlatforms[0];

  while (y < WORLD_TOP_LIMIT) {
    const spacingBase = (2.15 + seededNoise(row * 0.83) * 1.15) * JUMP_GAP_SCALE;
    const spacing = row === 0 ? spacingBase * 0.35 : spacingBase;
    y += spacing;
    rowMilestones.push(y);

    const holeWidth = fixedGapWidth;

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

    let leftPlatform = null;
    const leftWidth = holeStart + WORLD_HALF_WIDTH;
    if (leftWidth > 1.8) {
      const leftMoveSeed = seededNoise(row * 7.91 + 0.17);
      const leftMoving = leftMoveSeed < MOVING_PLATFORM_CHANCE;
      leftPlatform = {
        x: -WORLD_HALF_WIDTH,
        y,
        w: leftWidth,
        h: 0.82 + seededNoise(row * 3.49) * 0.12,
        moveDir: leftMoving
          ? (seededNoise(row * 8.47 + 0.61) < 0.5 ? -1 : 1)
          : 0,
        moveSpeed: leftMoving ? MOVING_PLATFORM_SPEED : 0,
      };
      worldPlatforms.push(leftPlatform);
      addCollectibleForPlatform(leftPlatform, row * 4.31);
    }

    let rightPlatform = null;
    const rightWidth = WORLD_HALF_WIDTH - holeEnd;
    if (rightWidth > 1.8) {
      const rightMoveSeed = seededNoise(row * 9.13 + 0.39);
      const rightMoving = rightMoveSeed < MOVING_PLATFORM_CHANCE;
      rightPlatform = {
        x: holeEnd,
        y,
        w: rightWidth,
        h: 0.82 + seededNoise(row * 5.71) * 0.12,
        moveDir: rightMoving
          ? (seededNoise(row * 9.79 + 0.83) < 0.5 ? -1 : 1)
          : 0,
        moveSpeed: rightMoving ? MOVING_PLATFORM_SPEED : 0,
      };
      worldPlatforms.push(rightPlatform);
      addCollectibleForPlatform(rightPlatform, row * 6.37);
    }

    const preferLeftLadder = seededNoise(row * 11.13 + 0.19) < 0.5;
    const hasPrimaryLadder = preferLeftLadder
      ? addLadderBetweenRows(previousLeftPlatform, leftPlatform, row * 12.31 + 0.11)
      : addLadderBetweenRows(previousRightPlatform, rightPlatform, row * 12.31 + 0.37);

    if (!hasPrimaryLadder) {
      const fallbackLower = preferLeftLadder ? previousRightPlatform : previousLeftPlatform;
      const fallbackUpper = preferLeftLadder ? rightPlatform : leftPlatform;
      addLadderBetweenRows(fallbackLower, fallbackUpper, row * 12.31 + 0.73);
    }

    if (leftPlatform) {
      previousLeftPlatform = leftPlatform;
    }

    if (rightPlatform) {
      previousRightPlatform = rightPlatform;
    }

    prevHoleCenter = holeCenter;
    row++;
  }

  worldPlatforms.sort((a, b) => a.y - b.y);
  worldCollectibles.sort((a, b) => a.y - b.y);
  worldLadders.sort((a, b) => a.y - b.y);
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
    platformPool[index].motion = platform.moveDir * platform.moveSpeed;
    platformPool[index].ref = platform;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_PLATFORMS; i++) {
    platformPool[i].x = -9999;
    platformPool[i].y = -9999;
    platformPool[i].w = 0;
    platformPool[i].h = 0;
    platformPool[i].motion = 0;
    platformPool[i].ref = null;
  }

  visiblePlatformCount = index;
};

const collectVisibleLadders = (heroY, cameraY) => {
  const minY = Math.min(heroY, cameraY) - viewHeight * 0.98 - 2;
  const maxY = Math.max(heroY, cameraY) + viewHeight * 1.02 + 2;
  let index = 0;

  for (let i = 0; i < worldLadders.length && index < MAX_VISIBLE_LADDERS; i++) {
    const ladder = worldLadders[i];
    if (ladder.y + ladder.h < minY) {
      continue;
    }

    if (ladder.y > maxY) {
      break;
    }

    ladderPool[index].x = ladder.x;
    ladderPool[index].y = ladder.y;
    ladderPool[index].w = ladder.w;
    ladderPool[index].h = ladder.h;
    ladderPool[index].ref = ladder;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_LADDERS; i++) {
    ladderPool[i].x = -9999;
    ladderPool[i].y = -9999;
    ladderPool[i].w = 0;
    ladderPool[i].h = 0;
    ladderPool[i].ref = null;
  }

  visibleLadderCount = index;
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
  hero.supportPlatform = null;
  hero.onLadder = false;
  hero.ladder = null;
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
    return null;
  }

  const left = hero.x - HERO_WIDTH * 0.5 + 0.04;
  const right = hero.x + HERO_WIDTH * 0.5 - 0.04;
  let bestLanding = -Infinity;
  let bestPlatform = null;

  for (let i = 0; i < visiblePlatformCount; i++) {
    const platform = platformPool[i];
    const platformTop = platform.y + platform.h;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.w;

    if (right <= platformLeft + 0.02 || left >= platformRight - 0.02) {
      continue;
    }

    if (previousY >= platformTop + 0.02 && hero.y <= platformTop) {
      if (platformTop > bestLanding) {
        bestLanding = platformTop;
        bestPlatform = platform.ref;
      }
    }
  }

  if (bestLanding > -Infinity) {
    hero.y = bestLanding;
    hero.vy = 0;
    return bestPlatform;
  }

  return null;
};

const findStandingPlatform = () => {
  const left = hero.x - HERO_WIDTH * 0.5 + 0.04;
  const right = hero.x + HERO_WIDTH * 0.5 - 0.04;
  let bestPlatform = null;
  let bestTop = -Infinity;

  for (let i = 0; i < visiblePlatformCount; i++) {
    const platform = platformPool[i];
    const platformTop = platform.y + platform.h;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.w;

    if (right <= platformLeft + 0.02 || left >= platformRight - 0.02) {
      continue;
    }

    if (Math.abs(hero.y - platformTop) <= 0.14 && platformTop > bestTop) {
      bestTop = platformTop;
      bestPlatform = platform.ref;
    }
  }

  return bestPlatform;
};

const findNearbyLadder = () => {
  const heroCenterY = hero.y + 0.72;
  let closestLadder = null;
  let closestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < visibleLadderCount; i++) {
    const ladder = ladderPool[i];
    const ladderCenterX = ladder.x;
    const ladderBottom = ladder.y - LADDER_GRAB_RADIUS_Y;
    const ladderTop = ladder.y + ladder.h + LADDER_GRAB_RADIUS_Y;
    const dx = Math.abs(hero.x - ladderCenterX);

    if (dx > LADDER_GRAB_RADIUS_X) {
      continue;
    }

    if (heroCenterY < ladderBottom || heroCenterY > ladderTop) {
      continue;
    }

    if (dx < closestDist) {
      closestDist = dx;
      closestLadder = ladder.ref;
    }
  }

  return closestLadder;
};

const applyRidingPlatformMotion = (delta) => {
  if (!hero.grounded || !hero.supportPlatform) {
    return;
  }

  const platform = hero.supportPlatform;
  const platformMotion = platform.moveDir * platform.moveSpeed;
  if (platformMotion === 0) {
    return;
  }

  hero.x += platformMotion * delta;
};

const stepGame = (delta) => {
  const wasGrounded = hero.grounded;
  collectVisibleLadders(hero.y, gameCamera.y);
  const nearbyLadder = findNearbyLadder();

  if (!hero.onLadder && nearbyLadder && (inputState.up || inputState.down)) {
    hero.onLadder = true;
    hero.ladder = nearbyLadder;
    hero.grounded = false;
    hero.supportPlatform = null;
    hero.vx = 0;
    hero.vy = 0;
    hero.jumpBufferLeft = 0;
    hero.superJumpCharge = 0;
    hero.superJumpWindow = 0;
    inputState.jumpQueued = false;
  }

  if (hero.onLadder && hero.ladder) {
    const activeLadder = hero.ladder;
    const ladderBottom = activeLadder.y;
    const ladderTop = activeLadder.y + activeLadder.h;
    const climbInput = (inputState.up ? 1 : 0) - (inputState.down ? 1 : 0);

    hero.crouch = approach(hero.crouch, 0, delta * 10);
    hero.vx = 0;
    hero.vy = 0;
    hero.x = approach(hero.x, activeLadder.x, delta * 16);
    hero.y += climbInput * LADDER_CLIMB_SPEED * delta;
    hero.y = clamp(hero.y, ladderBottom - 0.02, ladderTop + 0.02);

    if (inputState.jumpQueued && !inputState.up && !inputState.down) {
      inputState.jumpQueued = false;
      hero.onLadder = false;
      hero.ladder = null;
      hero.vy = JUMP_VELOCITY * 0.9;
      hero.supportPlatform = null;
    } else {
      const reachedTop = climbInput > 0 && hero.y >= ladderTop - 0.01;
      const reachedBottom = climbInput < 0 && hero.y <= ladderBottom + 0.01;

      if (reachedTop || reachedBottom) {
        hero.y = reachedTop ? ladderTop : ladderBottom;
        hero.onLadder = false;
        hero.ladder = null;
        collectVisiblePlatforms(hero.y, gameCamera.y);
        const standingPlatform = findStandingPlatform();
        hero.grounded = standingPlatform !== null;
        hero.supportPlatform = standingPlatform;
      }
    }

    updateHighestRow(Math.max(hero.y, checkpoint.y));
    collectNearbyCollectibles();

    const ladderDropLimit = gameCamera.y - viewHeight * 0.98;
    if (hero.y < ladderDropLimit) {
      onHeroDeath();
    }

    return;
  }

  applyRidingPlatformMotion(delta);

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
      hero.supportPlatform = null;
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
      hero.supportPlatform = null;
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
  const landedPlatform = resolveLanding(previousY);
  hero.grounded = landedPlatform !== null;
  hero.supportPlatform = landedPlatform;

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
  collectVisibleLadders(hero.y, gameCamera.y);

  const shaderPlatforms = material.uniforms.uPlatforms.value;
  const shaderPlatformMotion = material.uniforms.uPlatformMotion.value;
  for (let i = 0; i < MAX_VISIBLE_PLATFORMS; i++) {
    const platform = platformPool[i];
    shaderPlatforms[i].set(platform.x, platform.y, platform.w, platform.h);
    shaderPlatformMotion[i] = platform.motion;
  }

  const shaderCollectibles = material.uniforms.uCollectibles.value;
  for (let i = 0; i < MAX_VISIBLE_COLLECTIBLES; i++) {
    const item = collectiblePool[i];
    shaderCollectibles[i].set(item.x, item.y, item.phase, 1);
  }

  const shaderLadders = material.uniforms.uLadders.value;
  for (let i = 0; i < MAX_VISIBLE_LADDERS; i++) {
    const ladder = ladderPool[i];
    shaderLadders[i].set(ladder.x, ladder.y, ladder.w, ladder.h);
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
  material.uniforms.uLadderCount.value = visibleLadderCount;
};

const onResize = () => {
  if (!container.value || !renderer || !material) {
    return;
  }

  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  viewHeight = height * WORLD_UNITS_PER_PIXEL;
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
  collectVisibleLadders(hero.y, gameCamera.y);
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
