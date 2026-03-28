<template>
  <div ref="container" class="background-canvas fit"></div>
  <div class="game-hud">
    <div class="game-hud__line">
      ITEMS <span class="game-hud__value game-hud__value--items">{{ hudItems }}</span>
      &nbsp; LIVES
      <span class="game-hud__value game-hud__value--lives game-hud__hearts">
        <span
          v-for="(heartState, heartIndex) in hudHeartSlots"
          :key="`heart-${heartIndex}`"
          class="game-hud__heart"
          :class="`game-hud__heart--${heartState}`"
        >
          {{ heartState === "empty" ? "♡" : "♥" }}
        </span>
      </span>
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
  min-width: 3ch;
}

.game-hud__value--score {
  min-width: 7ch;
}

.game-hud__hearts {
  letter-spacing: 0.06em;
}

.game-hud__heart {
  display: inline-block;
  min-width: 1ch;
  text-align: center;
}

.game-hud__heart--full {
  color: #8effde;
}

.game-hud__heart--half {
  color: #8effde;
  opacity: 0.55;
}

.game-hud__heart--empty {
  color: rgba(142, 255, 222, 0.35);
}
</style>

<script setup>
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dom } from "quasar";
import { create as createBackgroundMaterial } from "assets/materials/background/material";

const MAX_VISIBLE_PLATFORMS = 48;
const MAX_VISIBLE_COLLECTIBLES = 12;
const MAX_VISIBLE_LADDERS = 20;
const MAX_VISIBLE_SPIKES = 20;
const GAME_VIEWPORT_WIDTH_RATIO = 0.95;
const VERTICAL_WORLD_SCALE = 0.5625;
const BASE_VIEW_HEIGHT = 22;
const BASE_REFERENCE_HEIGHT = 900;
const WORLD_UNITS_PER_PIXEL = BASE_VIEW_HEIGHT / BASE_REFERENCE_HEIGHT;
const WORLD_HALF_WIDTH = 17;
const WORLD_TOP_LIMIT = 520;
const JUMP_GAP_SCALE = 1.5;
const HERO_WIDTH = 0.74;
const HERO_HEIGHT = 1.46;
const PLATFORM_GAP_MULTIPLIER = 1.8;
const MOVING_PLATFORM_CHANCE = 0.3;
const MOVING_PLATFORM_SPEED = 2.25;
const LADDER_WIDTH = 0.32;
const LADDER_CLIMB_SPEED = 7.6;
const LADDER_GRAB_RADIUS_X = 0.45;
const LADDER_GRAB_RADIUS_Y = 0.75;
const LADDER_REGRAB_LOCK_TIME = 0.2;
const WALL_SPIKE_SPAWN_CHANCE = 0.36;
const WALL_SPIKE_DEPTH = 0.62;
const WALL_SPIKE_BASE_HEIGHT = 1.04;
const BRITTLE_PLATFORM_CHANCE = 0.26;
const BRITTLE_PLATFORM_MAX_WIDTH = 3.35;
const BRITTLE_PLATFORM_STEP_WINDOW = 0.34;
const BRITTLE_PLATFORM_STEPS = 3;
const BRITTLE_PLATFORM_FALL_GRAVITY = -41;
const BRITTLE_PLATFORM_SHAKE_DECAY = 2.7;
const BRITTLE_PLATFORM_COLLAPSE_DAMAGE = 0.5;
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
const CAMERA_GROUND_PADDING = 0.55;
const CAMERA_SCROLL_TRIGGER_RATIO = 0.72;
const CAMERA_SCROLL_SMOOTH = 0.2;
const CAMERA_SCROLL_SMOOTH_CROUCH = 0.28;
const START_POS = { x: 0, y: 1.12 };
const START_LIVES = 3;

let camera, scene, renderer, material, quad;
let frameId = null;
let previousTimeMs = 0;
let viewWidth = BASE_VIEW_HEIGHT;
let viewHeight = BASE_VIEW_HEIGHT;
let visiblePlatformCount = 0;
let visibleCollectibleCount = 0;
let visibleLadderCount = 0;
let visibleSpikeCount = 0;
let worldHalfWidth = WORLD_HALF_WIDTH;
const gameViewportPx = {
  x: 0,
  y: 0,
  w: 1,
  h: 1,
};

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
const hudHeartSlots = computed(() => {
  const hearts = Math.max(0, Math.min(START_LIVES, livesLeft.value));
  return Array.from({ length: START_LIVES }, (_, index) => {
    const remaining = hearts - index;
    if (remaining >= 1) {
      return "full";
    }

    if (remaining >= 0.5) {
      return "half";
    }

    return "empty";
  });
});
const hudScore = computed(() => formatHudNumber(score.value, 7));

const worldPlatforms = [];
const worldCollectibles = [];
const worldLadders = [];
const worldSpikes = [];
const rowMilestones = [];
let nextCollectibleId = 1;

const platformPool = Array.from({ length: MAX_VISIBLE_PLATFORMS }, () => ({
  x: -9999,
  y: -9999,
  w: 0,
  h: 0,
  motion: 0,
  type: 0,
  shake: 0,
  durability: 1,
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

const spikePool = Array.from({ length: MAX_VISIBLE_SPIKES }, () => ({
  x: -9999,
  y: -9999,
  w: 0,
  h: 0,
  dir: 0,
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
  jumpFromSpace: false,
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
  ladderRegrabLock: 0,
};

const gameCamera = {
  x: 0,
  y: 6.5,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => value - Math.floor(value);
const calculateWorldHalfWidth = () => {
  return Math.max(WORLD_HALF_WIDTH, viewWidth * 0.5);
};

const getGroundTop = () => {
  const ground = worldPlatforms[0];
  return ground ? ground.y + ground.h : START_POS.y;
};

const getGroundAnchoredCameraY = () => {
  return getGroundTop() + viewHeight * 0.5 / VERTICAL_WORLD_SCALE - CAMERA_GROUND_PADDING;
};

const getVisibleHalfHeightWorld = () => {
  return (viewHeight * 0.5) / VERTICAL_WORLD_SCALE;
};

const applyVerticalCameraDeadzone = (targetY) => {
  const triggerRange = getVisibleHalfHeightWorld() * CAMERA_SCROLL_TRIGGER_RATIO;
  let deadzonedY = gameCamera.y;

  if (targetY > gameCamera.y + triggerRange) {
    deadzonedY = targetY - triggerRange;
  } else if (targetY < gameCamera.y - triggerRange) {
    deadzonedY = targetY + triggerRange;
  }

  return deadzonedY;
};

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
    inputState.jumpFromSpace = event.code === "Space";
  }

  return true;
};

const clearInputState = () => {
  inputState.left = false;
  inputState.right = false;
  inputState.up = false;
  inputState.down = false;
  inputState.jumpQueued = false;
  inputState.jumpFromSpace = false;
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
  worldSpikes.length = 0;
  rowMilestones.length = 0;
  nextCollectibleId = 1;

  const groundPlatform = {
    x: -worldHalfWidth,
    y: 0,
    w: worldHalfWidth * 2,
    h: 1.12,
    moveDir: 0,
    moveSpeed: 0,
    kind: 0,
    brittleStepsLeft: 0,
    brittleStepTimer: 0,
    brittleShake: 0,
    falling: false,
    fallVy: 0,
    removed: false,
  };
  worldPlatforms.push(groundPlatform);

  const minPlatformWidth = 1.9;
  const fixedGapWidth = HERO_WIDTH * PLATFORM_GAP_MULTIPLIER;
  const maxGapsPerRow = 3;
  const addLadderBetweenRows = (lowerRow, upperRow, seed) => {
    if (!lowerRow.length || !upperRow.length) {
      return false;
    }

    const ladderPadding = LADDER_WIDTH * 0.72 + 0.1;
    const ladderCandidates = [];

    for (let lowerIndex = 0; lowerIndex < lowerRow.length; lowerIndex++) {
      const lowerPlatform = lowerRow[lowerIndex];
      for (let upperIndex = 0; upperIndex < upperRow.length; upperIndex++) {
        const upperPlatform = upperRow[upperIndex];
        const overlapStart = Math.max(
          lowerPlatform.x + ladderPadding,
          upperPlatform.x + ladderPadding,
        );
        const overlapEnd = Math.min(
          lowerPlatform.x + lowerPlatform.w - ladderPadding,
          upperPlatform.x + upperPlatform.w - ladderPadding,
        );

        if (overlapEnd <= overlapStart) {
          continue;
        }

        const bottom = lowerPlatform.y + lowerPlatform.h;
        const top = upperPlatform.y + upperPlatform.h;
        if (top <= bottom + 0.4) {
          continue;
        }

        ladderCandidates.push({
          start: overlapStart,
          end: overlapEnd,
          bottom,
          top,
        });
      }
    }

    if (!ladderCandidates.length) {
      return false;
    }

    const pickIndex = Math.floor(
      seededNoise(seed + 0.27) * ladderCandidates.length,
    );
    const picked = ladderCandidates[
      clamp(pickIndex, 0, ladderCandidates.length - 1)
    ];
    const ladderX = THREE.MathUtils.lerp(
      picked.start,
      picked.end,
      seededNoise(seed + 0.79),
    );

    worldLadders.push({
      x: ladderX,
      y: picked.bottom,
      w: LADDER_WIDTH,
      h: picked.top - picked.bottom,
    });

    return true;
  };

  const createRowPlatform = (x, y, width, seedBase) => {
    const isBrittle =
      y > 3.2 &&
      width <= BRITTLE_PLATFORM_MAX_WIDTH &&
      seededNoise(seedBase + 0.91) < BRITTLE_PLATFORM_CHANCE;
    const moving = seededNoise(seedBase + 0.17) < MOVING_PLATFORM_CHANCE;
    return {
      x,
      y,
      w: width,
      h: 0.82 + seededNoise(seedBase + 0.43) * 0.12,
      moveDir:
        !isBrittle && moving ? (seededNoise(seedBase + 0.71) < 0.5 ? -1 : 1) : 0,
      moveSpeed: !isBrittle && moving ? MOVING_PLATFORM_SPEED : 0,
      kind: isBrittle ? 1 : 0,
      brittleStepsLeft: isBrittle ? BRITTLE_PLATFORM_STEPS : 0,
      brittleStepTimer: 0,
      brittleShake: 0,
      falling: false,
      fallVy: 0,
      removed: false,
    };
  };

  const addWallSpikes = (platform, side, seed) => {
    if (!platform || platform.y < 2.0) {
      return;
    }

    if (platform.w < 1.45 || seededNoise(seed) > WALL_SPIKE_SPAWN_CHANCE) {
      return;
    }

    const spikeDepth = WALL_SPIKE_DEPTH + seededNoise(seed + 0.21) * 0.18;
    const spikeHeight = WALL_SPIKE_BASE_HEIGHT + seededNoise(seed + 0.49) * 0.36;
    const anchorY = platform.y + platform.h + 0.08 + seededNoise(seed + 0.63) * 0.08;
    const wallInset = 0.05;
    const x = side < 0 ? -worldHalfWidth + wallInset : worldHalfWidth - spikeDepth - wallInset;
    worldSpikes.push({
      x,
      y: anchorY,
      w: spikeDepth,
      h: spikeHeight,
      dir: side < 0 ? 1 : -1,
    });
  };

  let y = 2.1;
  let row = 0;
  let previousRowPlatforms = [groundPlatform];

  while (y < WORLD_TOP_LIMIT) {
    const spacingBase = (2.15 + seededNoise(row * 0.83) * 1.15) * JUMP_GAP_SCALE;
    const spacing = row === 0 ? spacingBase * 0.35 : spacingBase;
    y += spacing;
    rowMilestones.push(y);

    let gapCount = 1 + Math.floor(seededNoise(row * 2.21 + 0.33) * maxGapsPerRow);
    if (row === 0) {
      gapCount = Math.min(gapCount, 2);
    }

    const rowWidth = worldHalfWidth * 2;
    let gapWidths = [];
    while (gapCount >= 1) {
      gapWidths = Array.from({ length: gapCount }, (_, index) => {
        return fixedGapWidth * (1.0 + seededNoise(row * 4.17 + index * 0.77) * 0.95);
      });

      const totalGapWidth = gapWidths.reduce((sum, value) => sum + value, 0);
      const platformCount = gapCount + 1;
      if (rowWidth - totalGapWidth >= platformCount * minPlatformWidth) {
        break;
      }

      gapCount--;
    }

    if (gapCount < 1) {
      gapCount = 1;
      gapWidths = [Math.min(fixedGapWidth, rowWidth - minPlatformWidth * 2)];
    }

    const platformCount = gapCount + 1;
    const totalGapWidth = gapWidths.reduce((sum, value) => sum + value, 0);
    const totalPlatformWidth = rowWidth - totalGapWidth;
    const basePlatformWidth = minPlatformWidth;
    const extraPlatformWidth = Math.max(
      0,
      totalPlatformWidth - basePlatformWidth * platformCount,
    );
    const platformWeights = Array.from({ length: platformCount }, (_, index) => {
      return 0.28 + seededNoise(row * 5.61 + index * 0.93) * 0.92;
    });
    const weightSum = platformWeights.reduce((sum, value) => sum + value, 0);
    const platformWidths = platformWeights.map((weight) => {
      return basePlatformWidth + (extraPlatformWidth * weight) / weightSum;
    });
    const usedWidth =
      platformWidths.reduce((sum, value) => sum + value, 0) + totalGapWidth;
    platformWidths[platformWidths.length - 1] += rowWidth - usedWidth;

    const rowPlatforms = [];
    let cursorX = -worldHalfWidth;
    for (let index = 0; index < platformCount; index++) {
      const platform = createRowPlatform(
        cursorX,
        y,
        platformWidths[index],
        row * 7.37 + index * 1.19,
      );
      rowPlatforms.push(platform);
      worldPlatforms.push(platform);
      if (platform.kind === 0) {
        addCollectibleForPlatform(platform, row * 8.11 + index * 0.67);
      }

      cursorX += platformWidths[index];
      if (index < gapCount) {
        cursorX += gapWidths[index];
      }
    }

    addLadderBetweenRows(previousRowPlatforms, rowPlatforms, row * 12.31 + 0.19);
    const leftWallPlatform = rowPlatforms[0] || null;
    const rightWallPlatform = rowPlatforms[rowPlatforms.length - 1] || null;
    if (
      leftWallPlatform &&
      leftWallPlatform.x <= -worldHalfWidth + 0.2 &&
      leftWallPlatform.w > 1.2
    ) {
      addWallSpikes(leftWallPlatform, -1, row * 13.07 + 0.13);
    }

    if (
      rightWallPlatform &&
      rightWallPlatform.x + rightWallPlatform.w >= worldHalfWidth - 0.2 &&
      rightWallPlatform.w > 1.2
    ) {
      addWallSpikes(rightWallPlatform, 1, row * 13.07 + 0.61);
    }
    previousRowPlatforms = rowPlatforms;
    row++;
  }

  worldPlatforms.sort((a, b) => a.y - b.y);
  worldCollectibles.sort((a, b) => a.y - b.y);
  worldLadders.sort((a, b) => a.y - b.y);
  worldSpikes.sort((a, b) => a.y - b.y);
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
    if (platform.removed) {
      continue;
    }

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
    platformPool[index].type = platform.kind || 0;
    platformPool[index].shake = platform.brittleShake || 0;
    platformPool[index].durability =
      platform.kind === 1
        ? clamp(platform.brittleStepsLeft / BRITTLE_PLATFORM_STEPS, 0, 1)
        : 1;
    platformPool[index].ref = platform;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_PLATFORMS; i++) {
    platformPool[i].x = -9999;
    platformPool[i].y = -9999;
    platformPool[i].w = 0;
    platformPool[i].h = 0;
    platformPool[i].motion = 0;
    platformPool[i].type = 0;
    platformPool[i].shake = 0;
    platformPool[i].durability = 1;
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

const collectVisibleSpikes = (heroY, cameraY) => {
  const minY = Math.min(heroY, cameraY) - viewHeight * 0.98 - 2;
  const maxY = Math.max(heroY, cameraY) + viewHeight * 1.02 + 2;
  let index = 0;

  for (let i = 0; i < worldSpikes.length && index < MAX_VISIBLE_SPIKES; i++) {
    const spike = worldSpikes[i];
    if (spike.y + spike.h < minY) {
      continue;
    }

    if (spike.y > maxY) {
      break;
    }

    spikePool[index].x = spike.x;
    spikePool[index].y = spike.y;
    spikePool[index].w = spike.w;
    spikePool[index].h = spike.h;
    spikePool[index].dir = spike.dir || 0;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_SPIKES; i++) {
    spikePool[i].x = -9999;
    spikePool[i].y = -9999;
    spikePool[i].w = 0;
    spikePool[i].h = 0;
    spikePool[i].dir = 0;
  }

  visibleSpikeCount = index;
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
  const groundPlatform = worldPlatforms[0] || null;
  const groundTop = groundPlatform ? groundPlatform.y + groundPlatform.h : y;
  const isInsideGroundX = groundPlatform
    ? x >= groundPlatform.x + HERO_WIDTH * 0.35 &&
      x <= groundPlatform.x + groundPlatform.w - HERO_WIDTH * 0.35
    : false;
  const shouldSnapToGround = isInsideGroundX && y <= groundTop + 0.2;

  hero.x = x;
  hero.y = shouldSnapToGround ? groundTop : y;
  hero.vx = 0;
  hero.vy = 0;
  hero.facing = 1;
  hero.grounded = shouldSnapToGround;
  hero.coyoteLeft = shouldSnapToGround ? COYOTE_TIME : 0;
  hero.jumpBufferLeft = 0;
  hero.crouch = 0;
  hero.superJumpCharge = 0;
  hero.superJumpWindow = 0;
  hero.airJumpsLeft = 1;
  hero.supportPlatform = shouldSnapToGround ? groundPlatform : null;
  hero.onLadder = false;
  hero.ladder = null;
  hero.ladderRegrabLock = 0;
  gameCamera.x = 0;
  const startCameraY = shouldSnapToGround
    ? getGroundAnchoredCameraY()
    : hero.y + CAMERA_BASE_OFFSET;
  gameCamera.y = Math.max(CAMERA_MIN_Y, startCameraY);
};

const applyDamage = (amount) => {
  livesLeft.value = Math.max(0, livesLeft.value - amount);

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

const onHeroDeath = () => {
  applyDamage(1);
};

const updateBrittlePlatforms = (delta) => {
  for (let i = 0; i < worldPlatforms.length; i++) {
    const platform = worldPlatforms[i];
    if (!platform || platform.kind !== 1 || platform.removed) {
      continue;
    }

    if (platform.falling) {
      platform.fallVy = Math.max(
        MAX_FALL_SPEED * 1.9,
        platform.fallVy + BRITTLE_PLATFORM_FALL_GRAVITY * delta,
      );
      platform.y += platform.fallVy * delta;
      if (platform.y + platform.h < gameCamera.y - viewHeight * 1.6) {
        platform.removed = true;
      }
      continue;
    }

    platform.brittleShake = Math.max(
      0,
      platform.brittleShake - delta * BRITTLE_PLATFORM_SHAKE_DECAY,
    );
  }
};

const collapseBrittlePlatform = (platform, causedByHero) => {
  if (!platform || platform.kind !== 1 || platform.falling || platform.removed) {
    return;
  }

  platform.falling = true;
  platform.fallVy = -4.5;
  platform.moveDir = 0;
  platform.moveSpeed = 0;
  platform.brittleShake = 1;

  if (causedByHero) {
    hero.grounded = false;
    hero.supportPlatform = null;
    hero.coyoteLeft = 0;
    hero.vy = Math.min(hero.vy, -3.5);
    applyDamage(BRITTLE_PLATFORM_COLLAPSE_DAMAGE);
  }
};

const processBrittleSupport = (delta) => {
  if (!hero.grounded || !hero.supportPlatform) {
    return false;
  }

  const platform = hero.supportPlatform;
  if (
    platform.kind !== 1 ||
    platform.falling ||
    platform.removed ||
    platform.brittleStepsLeft <= 0
  ) {
    return false;
  }

  const stepRate = Math.abs(hero.vx) > 0.35 ? 1.45 : 1.0;
  platform.brittleStepTimer += delta * stepRate;
  platform.brittleShake = Math.min(1, platform.brittleShake + delta * 3.6);

  while (platform.brittleStepTimer >= BRITTLE_PLATFORM_STEP_WINDOW) {
    platform.brittleStepTimer -= BRITTLE_PLATFORM_STEP_WINDOW;
    platform.brittleStepsLeft = Math.max(0, platform.brittleStepsLeft - 1);
    platform.brittleShake = 1;
  }

  if (platform.brittleStepsLeft <= 0) {
    collapseBrittlePlatform(platform, true);
    return true;
  }

  return false;
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
    if (!platform.ref || platform.ref.falling || platform.ref.removed) {
      continue;
    }

    const platformTop = platform.y + platform.h;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.w;

    if (right <= platformLeft + 0.02 || left >= platformRight - 0.02) {
      continue;
    }

    if (previousY >= platformTop - 0.02 && hero.y <= platformTop) {
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

const resolveCeiling = (previousY) => {
  if (hero.vy <= 0) {
    return false;
  }

  const left = hero.x - HERO_WIDTH * 0.5 + 0.04;
  const right = hero.x + HERO_WIDTH * 0.5 - 0.04;
  const previousTop = previousY + HERO_HEIGHT;
  const currentTop = hero.y + HERO_HEIGHT;
  let hitBottom = Number.POSITIVE_INFINITY;

  for (let i = 0; i < visiblePlatformCount; i++) {
    const platform = platformPool[i];
    if (!platform.ref || platform.ref.falling || platform.ref.removed) {
      continue;
    }

    const platformBottom = platform.y;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.w;

    if (right <= platformLeft + 0.02 || left >= platformRight - 0.02) {
      continue;
    }

    if (previousTop <= platformBottom + 0.01 && currentTop >= platformBottom) {
      hitBottom = Math.min(hitBottom, platformBottom);
    }
  }

  if (hitBottom < Number.POSITIVE_INFINITY) {
    hero.y = hitBottom - HERO_HEIGHT - 0.001;
    hero.vy = 0;
    return true;
  }

  return false;
};

const findStandingPlatform = () => {
  const left = hero.x - HERO_WIDTH * 0.5 + 0.04;
  const right = hero.x + HERO_WIDTH * 0.5 - 0.04;
  let bestPlatform = null;
  let bestTop = -Infinity;

  for (let i = 0; i < visiblePlatformCount; i++) {
    const platform = platformPool[i];
    if (!platform.ref || platform.ref.falling || platform.ref.removed) {
      continue;
    }

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

const heroTouchesSpike = () => {
  const heroLeft = hero.x - HERO_WIDTH * 0.44;
  const heroRight = hero.x + HERO_WIDTH * 0.44;
  const heroBottom = hero.y + 0.03;
  const heroTop = hero.y + HERO_HEIGHT - 0.05;

  for (let i = 0; i < visibleSpikeCount; i++) {
    const spike = spikePool[i];
    const spikeLeft = spike.x;
    const spikeRight = spike.x + spike.w;
    const spikeBottom = spike.y;
    const spikeTop = spike.y + spike.h;

    const overlapX = heroRight > spikeLeft && heroLeft < spikeRight;
    const overlapY = heroTop > spikeBottom && heroBottom < spikeTop;

    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
};

const applyRidingPlatformMotion = (delta) => {
  if (!hero.grounded || !hero.supportPlatform) {
    return;
  }

  const platform = hero.supportPlatform;
  if (platform.falling || platform.removed) {
    return;
  }

  const platformMotion = platform.moveDir * platform.moveSpeed;
  if (platformMotion === 0) {
    return;
  }

  hero.x += platformMotion * delta;
};

const stepGame = (delta) => {
  const wasGrounded = hero.grounded;
  updateBrittlePlatforms(delta);
  hero.ladderRegrabLock = Math.max(0, hero.ladderRegrabLock - delta);
  collectVisibleLadders(hero.y, gameCamera.y);
  collectVisibleSpikes(hero.y, gameCamera.y);
  const nearbyLadder = findNearbyLadder();
  const canGrabLadderFromGround =
    hero.grounded &&
    nearbyLadder &&
    inputState.up &&
    hero.y <= nearbyLadder.y + 0.18;
  const wantsLadderGrab = !hero.grounded || inputState.down || canGrabLadderFromGround;

  if (
    !hero.onLadder &&
    nearbyLadder &&
    (inputState.up || inputState.down) &&
    wantsLadderGrab &&
    hero.ladderRegrabLock <= 0
  ) {
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
    inputState.jumpFromSpace = false;
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

    const canJumpOffLadder =
      inputState.jumpQueued &&
      (inputState.jumpFromSpace || (!inputState.up && !inputState.down));
    if (canJumpOffLadder) {
      inputState.jumpQueued = false;
      inputState.jumpFromSpace = false;
      hero.onLadder = false;
      hero.ladder = null;
      hero.ladderRegrabLock = LADDER_REGRAB_LOCK_TIME;
      hero.vy = JUMP_VELOCITY * 0.9;
      hero.grounded = false;
      hero.coyoteLeft = 0;
      hero.supportPlatform = null;
      hero.airJumpsLeft = 1;
    } else {
      const reachedTop = climbInput > 0 && hero.y >= ladderTop - 0.01;
      const reachedBottom = climbInput < 0 && hero.y <= ladderBottom + 0.01;

      if (reachedTop || reachedBottom) {
        hero.y = reachedTop ? ladderTop : ladderBottom;
        hero.onLadder = false;
        hero.ladder = null;
        hero.ladderRegrabLock = LADDER_REGRAB_LOCK_TIME;
        collectVisiblePlatforms(hero.y, gameCamera.y);
        const standingPlatform = findStandingPlatform();
        hero.grounded = standingPlatform !== null;
        hero.supportPlatform = standingPlatform;
        hero.coyoteLeft = COYOTE_TIME;
        if (standingPlatform) {
          hero.y = standingPlatform.y + standingPlatform.h;
        }
      }
    }

    updateHighestRow(Math.max(hero.y, checkpoint.y));
    collectNearbyCollectibles();

    if (heroTouchesSpike()) {
      onHeroDeath();
      return;
    }

    const ladderDropLimit = gameCamera.y - viewHeight * 0.98;
    if (hero.y < ladderDropLimit) {
      onHeroDeath();
    }

    return;
  }

  applyRidingPlatformMotion(delta);
  if (processBrittleSupport(delta)) {
    return;
  }

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
    inputState.jumpFromSpace = false;
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
  const leftBound = -worldHalfWidth + HERO_WIDTH * 0.5;
  const rightBound = worldHalfWidth - HERO_WIDTH * 0.5;
  const clampedX = clamp(hero.x, leftBound, rightBound);
  if (clampedX !== hero.x) {
    hero.vx = 0;
    hero.x = clampedX;
  }

  hero.y += hero.vy * delta;
  collectVisiblePlatforms(hero.y, gameCamera.y);
  resolveCeiling(previousY);
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
  if (heroTouchesSpike()) {
    onHeroDeath();
    return;
  }

  const verticalDropLimit = gameCamera.y - viewHeight * 0.98;
  if (hero.y < verticalDropLimit) {
    onHeroDeath();
  }
};

const syncUniforms = (timeSeconds) => {
  const groundTop = getGroundTop();
  const isNearGround = hero.y <= groundTop + 0.95;
  const anchoredDefaultY = isNearGround
    ? Math.max(hero.y + CAMERA_BASE_OFFSET, getGroundAnchoredCameraY())
    : hero.y + CAMERA_BASE_OFFSET;
  const defaultY = anchoredDefaultY;
  const lookDownY = hero.y - viewHeight * 0.43;
  const targetCameraY = THREE.MathUtils.lerp(defaultY, lookDownY, hero.crouch);
  const clampedTargetY = clamp(targetCameraY, CAMERA_MIN_Y, WORLD_TOP_LIMIT);
  const deadzonedTargetY = applyVerticalCameraDeadzone(clampedTargetY);

  gameCamera.x = 0;
  gameCamera.y = THREE.MathUtils.lerp(
    gameCamera.y,
    deadzonedTargetY,
    hero.crouch > 0.05 ? CAMERA_SCROLL_SMOOTH_CROUCH : CAMERA_SCROLL_SMOOTH,
  );

  collectVisiblePlatforms(hero.y, gameCamera.y);
  collectVisibleCollectibles(gameCamera.y);
  collectVisibleLadders(hero.y, gameCamera.y);
  collectVisibleSpikes(hero.y, gameCamera.y);

  const shaderPlatforms = material.uniforms.uPlatforms.value;
  const shaderPlatformMotion = material.uniforms.uPlatformMotion.value;
  const shaderPlatformType = material.uniforms.uPlatformType.value;
  const shaderPlatformShake = material.uniforms.uPlatformShake.value;
  const shaderPlatformDurability = material.uniforms.uPlatformDurability.value;
  for (let i = 0; i < MAX_VISIBLE_PLATFORMS; i++) {
    const platform = platformPool[i];
    shaderPlatforms[i].set(platform.x, platform.y, platform.w, platform.h);
    shaderPlatformMotion[i] = platform.motion;
    shaderPlatformType[i] = platform.type;
    shaderPlatformShake[i] = platform.shake;
    shaderPlatformDurability[i] = platform.durability;
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

  const shaderSpikes = material.uniforms.uSpikes.value;
  const shaderSpikeDir = material.uniforms.uSpikeDir.value;
  for (let i = 0; i < MAX_VISIBLE_SPIKES; i++) {
    const spike = spikePool[i];
    shaderSpikes[i].set(spike.x, spike.y, spike.w, spike.h);
    shaderSpikeDir[i] = spike.dir;
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
  material.uniforms.uSpikeCount.value = visibleSpikeCount;
};

const onResize = () => {
  if (!container.value || !renderer || !material) {
    return;
  }

  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));
  const toolbarElement =
    typeof document !== "undefined"
      ? document.getElementById("side_toolbar")
      : null;
  const toolbarWidth = toolbarElement
    ? Math.max(0, toolbarElement.getBoundingClientRect().width)
    : 0;
  const availableWidth = Math.max(1, width - toolbarWidth);
  const gameWidth = Math.max(
    1,
    Math.floor(availableWidth * GAME_VIEWPORT_WIDTH_RATIO),
  );
  const gameX = toolbarWidth + (availableWidth - gameWidth) * 0.5;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  viewHeight = height * WORLD_UNITS_PER_PIXEL;
  viewWidth = (gameWidth / height) * viewHeight;
  if (worldPlatforms.length === 0) {
    worldHalfWidth = calculateWorldHalfWidth();
  }
  gameViewportPx.x = gameX;
  gameViewportPx.y = 0;
  gameViewportPx.w = gameWidth;
  gameViewportPx.h = height;

  material.uniforms.uResolution.value.set(width, height);
  material.uniforms.uGameViewport.value.set(gameX, 0, gameWidth, height);
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
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;

  renderer = await createRenderer();
  renderer.domElement.classList.add("fit");
  container.value.appendChild(renderer.domElement);

  material = createBackgroundMaterial(1, 1);
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  onResize();
  generateWorld();

  checkpoint.x = START_POS.x;
  checkpoint.y = START_POS.y;
  livesLeft.value = START_LIVES;
  highestRow.value = 0;
  resetCollectiblesProgress();
  resetHero(START_POS.x, START_POS.y);
  collectVisiblePlatforms(hero.y, gameCamera.y);
  collectVisibleCollectibles(gameCamera.y);
  collectVisibleLadders(hero.y, gameCamera.y);
  collectVisibleSpikes(hero.y, gameCamera.y);

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
