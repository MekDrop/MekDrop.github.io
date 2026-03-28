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
import { StateMachine } from "yuka";
import { dom } from "quasar";
import { create as createBackgroundMaterial } from "assets/materials/background/material";
import {
  createCheckpoint,
  createGameCamera,
  createGameViewport,
  createHero,
  createInputState,
  createSnake,
  createSnakeAI,
  createVisiblePools,
  createWorldState,
} from "assets/game/objects";
import {
  SnakeAttackState,
  SnakeClimbState,
  SnakeEscapeState,
  SnakeLadderSeekState,
  SnakePatrolState,
  SnakeSpikeFearState,
} from "assets/game/objects/actors/states";

const MAX_VISIBLE_PLATFORMS = 48;
const MAX_VISIBLE_COLLECTIBLES = 12;
const MAX_VISIBLE_LADDERS = 40;
const MAX_VISIBLE_SPIKES = 20;
const MAX_VISIBLE_PORTALS = 16;
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
const LADDER_ENDPOINT_LOCK_X = LADDER_WIDTH * 1.1;
const LADDER_ENDPOINT_LOCK_Y = 0.08;
const COLLECTIBLE_LADDER_CLEARANCE_X = LADDER_WIDTH * 0.5 + 0.3;
const COLLECTIBLE_LADDER_CLEARANCE_Y = 0.26;
const WALL_SPIKE_SPAWN_CHANCE = 0.36;
const WALL_SPIKE_DEPTH = 0.62;
const WALL_SPIKE_BASE_HEIGHT = 1.04;
const WALL_PORTAL_CANDIDATE_CHANCE = 0.24;
const MAX_PORTAL_PAIRS_PER_SCREEN = 2;
const PORTAL_WIDTH = 0.66;
const PORTAL_BASE_HEIGHT = 1.56;
const PORTAL_EXIT_PADDING = 0.08;
const PORTAL_MIN_PAIR_DISTANCE = 5.4;
const PORTAL_COOLDOWN = 0.42;
const PORTAL_TRAVEL_DURATION = 0.75;
const BRITTLE_PLATFORM_CHANCE = 0.26;
const BRITTLE_PLATFORM_MAX_WIDTH = 3.35;
const BRITTLE_PLATFORM_STEP_WINDOW = 0.34;
const BRITTLE_PLATFORM_STEPS = 3;
const BRITTLE_PLATFORM_FALL_GRAVITY = -41;
const BRITTLE_PLATFORM_SHAKE_DECAY = 2.7;
const BRITTLE_PLATFORM_COLLAPSE_DAMAGE = 0.5;
const SNAKE_WIDTH = 0.88;
const SNAKE_HEIGHT = 0.6;
const SNAKE_MOVE_SPEED = 3.3;
const SNAKE_CLIMB_SPEED = 5.2;
const SNAKE_FALL_GRAVITY = -30;
const SNAKE_MAX_FALL_SPEED = -24;
const SNAKE_PATROL_SPEED = 1.8;
const SNAKE_BITE_RANGE_X = 0.68;
const SNAKE_BITE_RANGE_Y = 0.74;
const SNAKE_BITE_COOLDOWN = 1.65;
const SNAKE_ATTACK_LEVEL_DELTA = 0.72;
const SNAKE_LADDER_ATTACH_X = 0.16;
const SNAKE_LADDER_ATTACH_Y = 0.2;
const SNAKE_REPATH_INTERVAL = 0.35;
const SNAKE_LADDER_DECISION_INTERVAL = 0.95;
const SNAKE_LADDER_NEARBY_X = 1.55;
const SNAKE_LADDER_CURIOUS_CHANCE = 0.38;
const SNAKE_LADDER_INTENT_TIME = 1.15;
const SNAKE_SPIKE_FEAR_RADIUS_X = 2.25;
const SNAKE_SPIKE_FEAR_RADIUS_Y = 0.9;
const SNAKE_SPIKE_FEAR_SPEED = 4.1;
const SNAKE_ESCAPE_PLATFORM_RANGE_X = 4.2;
const SNAKE_ESCAPE_PLATFORM_RANGE_Y = 0.5;
const SNAKE_ESCAPE_SPEED_BONUS = 0.95;
const SNAKE_STATE_PATROL = "patrol";
const SNAKE_STATE_ATTACK = "attack";
const SNAKE_STATE_LADDER_SEEK = "ladderSeek";
const SNAKE_STATE_CLIMB = "climb";
const SNAKE_STATE_ESCAPE = "escape";
const SNAKE_STATE_SPIKE_FEAR = "spikeFear";
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
const MOVE_AGAINST_PLATFORM_FACTOR = 0.58;
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
const CAMERA_LOOK_DOWN_SPEED = 8.4;
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
let visiblePortalCount = 0;
let worldHalfWidth = WORLD_HALF_WIDTH;
let cameraLookDown = 0;
const gameViewportPx = createGameViewport();

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

const worldState = createWorldState();
const {
  worldPlatforms,
  worldCollectibles,
  worldLadders,
  worldSpikes,
  worldPortals,
  rowMilestones,
} = worldState;

const { platformPool, collectiblePool, ladderPool, spikePool, portalPool } = createVisiblePools({
  maxVisiblePlatforms: MAX_VISIBLE_PLATFORMS,
  maxVisibleCollectibles: MAX_VISIBLE_COLLECTIBLES,
  maxVisibleLadders: MAX_VISIBLE_LADDERS,
  maxVisibleSpikes: MAX_VISIBLE_SPIKES,
  maxVisiblePortals: MAX_VISIBLE_PORTALS,
});

const checkpoint = createCheckpoint(START_POS);
const inputState = createInputState();
const hero = createHero(START_POS);
const snake = createSnake(START_POS);
const snakeAI = createSnakeAI(new StateMachine(), SNAKE_PATROL_SPEED);
const gameCamera = createGameCamera();
const portalTransition = {
  active: false,
  targetPortal: null,
  elapsed: 0,
  duration: PORTAL_TRAVEL_DURATION,
  startCameraY: 0,
  targetCameraY: 0,
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

const getCurrentViewBoundsY = () => {
  const half = getVisibleHalfHeightWorld();
  return {
    min: gameCamera.y - half,
    max: gameCamera.y + half,
  };
};

const snakeStateContext = {
  hero,
  moveSpeed: SNAKE_MOVE_SPEED,
  patrolSpeed: SNAKE_PATROL_SPEED,
  escapeSpeedBonus: SNAKE_ESCAPE_SPEED_BONUS,
  snake,
  snakeAI,
  spikeFearSpeed: SNAKE_SPIKE_FEAR_SPEED,
};

const initSnakeStateMachine = () => {
  snakeAI.stateMachine
    .add(SNAKE_STATE_PATROL, new SnakePatrolState(snakeStateContext))
    .add(SNAKE_STATE_ATTACK, new SnakeAttackState(snakeStateContext))
    .add(SNAKE_STATE_LADDER_SEEK, new SnakeLadderSeekState(snakeStateContext))
    .add(SNAKE_STATE_ESCAPE, new SnakeEscapeState(snakeStateContext))
    .add(SNAKE_STATE_SPIKE_FEAR, new SnakeSpikeFearState(snakeStateContext))
    .add(SNAKE_STATE_CLIMB, new SnakeClimbState(snakeStateContext))
    .changeTo(SNAKE_STATE_PATROL);
};

const setSnakeState = (stateId) => {
  if (!snakeAI.stateMachine.in(stateId)) {
    snakeAI.stateMachine.changeTo(stateId);
  }
};

initSnakeStateMachine();

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
    id: worldState.nextCollectibleId++,
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
  worldPortals.length = 0;
  rowMilestones.length = 0;
  worldState.nextCollectibleId = 1;

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
  const screenHeight = Math.max(8, viewHeight / VERTICAL_WORLD_SCALE);
  const getScreenBucket = (positionY) => {
    return Math.floor(Math.max(0, positionY) / screenHeight);
  };
  const portalCandidates = [];
  const touchesAnyLadderEndpoint = (x, bottom, top) => {
    for (let i = 0; i < worldLadders.length; i++) {
      const ladder = worldLadders[i];
      const sameTrack = Math.abs(ladder.x - x) <= LADDER_ENDPOINT_LOCK_X;
      if (!sameTrack) {
        continue;
      }

      const ladderBottom = ladder.y;
      const ladderTop = ladder.y + ladder.h;
      if (
        Math.abs(ladderTop - bottom) <= LADDER_ENDPOINT_LOCK_Y ||
        Math.abs(ladderBottom - top) <= LADDER_ENDPOINT_LOCK_Y
      ) {
        return true;
      }
    }

    return false;
  };

  const isCollectibleOnAnyLadder = (collectible) => {
    for (let i = 0; i < worldLadders.length; i++) {
      const ladder = worldLadders[i];
      const withinX = Math.abs(collectible.x - ladder.x) <= COLLECTIBLE_LADDER_CLEARANCE_X;
      const withinY =
        collectible.y >= ladder.y - COLLECTIBLE_LADDER_CLEARANCE_Y &&
        collectible.y <= ladder.y + ladder.h + COLLECTIBLE_LADDER_CLEARANCE_Y;
      if (withinX && withinY) {
        return true;
      }
    }

    return false;
  };

  const addLaddersBetweenRows = (lowerRow, upperRow) => {
    if (!lowerRow.length || !upperRow.length) {
      return 0;
    }

    const ladderPadding = LADDER_WIDTH * 0.72 + 0.1;
    const placedLadders = [];
    let addedCount = 0;

    for (let lowerIndex = 0; lowerIndex < lowerRow.length; lowerIndex++) {
      const lowerPlatform = lowerRow[lowerIndex];
      if (!lowerPlatform || lowerPlatform.kind === 1) {
        continue;
      }

      for (let upperIndex = 0; upperIndex < upperRow.length; upperIndex++) {
        const upperPlatform = upperRow[upperIndex];
        if (!upperPlatform || upperPlatform.kind === 1) {
          continue;
        }

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

        const ladderX = (overlapStart + overlapEnd) * 0.5;
        let tooClose = false;
        for (let placedIndex = 0; placedIndex < placedLadders.length; placedIndex++) {
          const placed = placedLadders[placedIndex];
          if (Math.abs(placed.bottom - bottom) <= 0.08 && Math.abs(placed.x - ladderX) <= LADDER_WIDTH * 1.2) {
            tooClose = true;
            break;
          }
        }

        if (tooClose) {
          continue;
        }

        if (touchesAnyLadderEndpoint(ladderX, bottom, top)) {
          continue;
        }

        worldLadders.push({
          x: ladderX,
          y: bottom,
          w: LADDER_WIDTH,
          h: top - bottom,
        });
        placedLadders.push({
          x: ladderX,
          bottom,
        });
        addedCount++;
      }
    }

    return addedCount;
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

  const addWallPortalCandidate = (platform, side, seed) => {
    if (!platform || platform.y < 2.0) {
      return false;
    }

    if (platform.w < 1.45 || seededNoise(seed) > WALL_PORTAL_CANDIDATE_CHANCE) {
      return false;
    }

    const portalHeight = PORTAL_BASE_HEIGHT + seededNoise(seed + 0.21) * 0.42;
    const anchorY = platform.y + platform.h + 0.02 + seededNoise(seed + 0.39) * 0.18;
    const wallInset = 0.06;
    const x = side < 0
      ? -worldHalfWidth + wallInset
      : worldHalfWidth - PORTAL_WIDTH - wallInset;
    portalCandidates.push({
      x,
      y: anchorY,
      w: PORTAL_WIDTH,
      h: portalHeight,
      side,
      seed,
      screenBucket: getScreenBucket(anchorY + portalHeight * 0.5),
    });
    return true;
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

    addLaddersBetweenRows(previousRowPlatforms, rowPlatforms);
    const leftWallPlatform = rowPlatforms[0] || null;
    const rightWallPlatform = rowPlatforms[rowPlatforms.length - 1] || null;
    if (
      leftWallPlatform &&
      leftWallPlatform.x <= -worldHalfWidth + 0.2 &&
      leftWallPlatform.w > 1.2
    ) {
      if (!addWallPortalCandidate(leftWallPlatform, -1, row * 17.03 + 0.13)) {
        addWallSpikes(leftWallPlatform, -1, row * 13.07 + 0.13);
      }
    }

    if (
      rightWallPlatform &&
      rightWallPlatform.x + rightWallPlatform.w >= worldHalfWidth - 0.2 &&
      rightWallPlatform.w > 1.2
    ) {
      if (!addWallPortalCandidate(rightWallPlatform, 1, row * 17.03 + 0.61)) {
        addWallSpikes(rightWallPlatform, 1, row * 13.07 + 0.61);
      }
    }
    previousRowPlatforms = rowPlatforms;
    row++;
  }

  const pairsPerScreen = new Map();
  const canAddPairToScreen = (screenBucket) => {
    return (pairsPerScreen.get(screenBucket) || 0) < MAX_PORTAL_PAIRS_PER_SCREEN;
  };
  const markPairForScreens = (screenA, screenB) => {
    const uniqueScreens =
      screenA === screenB ? [screenA] : [screenA, screenB];
    for (let i = 0; i < uniqueScreens.length; i++) {
      const screen = uniqueScreens[i];
      pairsPerScreen.set(screen, (pairsPerScreen.get(screen) || 0) + 1);
    }
  };
  const sortedCandidates = portalCandidates
    .map((candidate, index) => {
      return {
        ...candidate,
        index,
        sortKey: seededNoise(candidate.seed + index * 0.47),
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);
  const usedCandidateIndexes = new Set();

  for (let i = 0; i < sortedCandidates.length; i++) {
    const source = sortedCandidates[i];
    if (usedCandidateIndexes.has(source.index)) {
      continue;
    }

    if (!canAddPairToScreen(source.screenBucket)) {
      continue;
    }

    let bestMatch = null;
    let bestScore = -Number.POSITIVE_INFINITY;

    for (let j = 0; j < sortedCandidates.length; j++) {
      const target = sortedCandidates[j];
      if (target.index === source.index || usedCandidateIndexes.has(target.index)) {
        continue;
      }

      if (!canAddPairToScreen(target.screenBucket)) {
        continue;
      }

      const sourceCenterY = source.y + source.h * 0.5;
      const targetCenterY = target.y + target.h * 0.5;
      const verticalDistance = Math.abs(sourceCenterY - targetCenterY);
      if (verticalDistance < PORTAL_MIN_PAIR_DISTANCE) {
        continue;
      }

      const oppositeWallBonus = source.side !== target.side ? 1.4 : 0.3;
      const screenDistance = Math.abs(source.screenBucket - target.screenBucket) * 0.36;
      const score =
        verticalDistance +
        oppositeWallBonus +
        screenDistance +
        seededNoise(source.seed * 0.71 + target.seed * 1.09);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = target;
      }
    }

    if (!bestMatch) {
      continue;
    }

    usedCandidateIndexes.add(source.index);
    usedCandidateIndexes.add(bestMatch.index);
    markPairForScreens(source.screenBucket, bestMatch.screenBucket);

    const pairId = worldPortals.length * 0.5;
    const sourcePortal = {
      x: source.x,
      y: source.y,
      w: source.w,
      h: source.h,
      side: source.side,
      pairId,
      target: null,
    };
    const targetPortal = {
      x: bestMatch.x,
      y: bestMatch.y,
      w: bestMatch.w,
      h: bestMatch.h,
      side: bestMatch.side,
      pairId,
      target: null,
    };
    sourcePortal.target = targetPortal;
    targetPortal.target = sourcePortal;
    worldPortals.push(sourcePortal, targetPortal);
  }

  for (let i = worldCollectibles.length - 1; i >= 0; i--) {
    if (isCollectibleOnAnyLadder(worldCollectibles[i])) {
      worldCollectibles.splice(i, 1);
    }
  }

  worldPlatforms.sort((a, b) => a.y - b.y);
  worldCollectibles.sort((a, b) => a.y - b.y);
  worldLadders.sort((a, b) => a.y - b.y);
  worldSpikes.sort((a, b) => a.y - b.y);
  worldPortals.sort((a, b) => a.y - b.y);
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

const collectVisiblePortals = (heroY, cameraY) => {
  const minY = Math.min(heroY, cameraY) - viewHeight * 1.0 - 2;
  const maxY = Math.max(heroY, cameraY) + viewHeight * 1.04 + 2;
  let index = 0;

  for (let i = 0; i < worldPortals.length && index < MAX_VISIBLE_PORTALS; i++) {
    const portal = worldPortals[i];
    if (portal.y + portal.h < minY) {
      continue;
    }

    if (portal.y > maxY) {
      break;
    }

    portalPool[index].x = portal.x;
    portalPool[index].y = portal.y;
    portalPool[index].w = portal.w;
    portalPool[index].h = portal.h;
    portalPool[index].side = portal.side;
    portalPool[index].ref = portal;
    index++;
  }

  for (let i = index; i < MAX_VISIBLE_PORTALS; i++) {
    portalPool[i].x = -9999;
    portalPool[i].y = -9999;
    portalPool[i].w = 0;
    portalPool[i].h = 0;
    portalPool[i].side = 0;
    portalPool[i].ref = null;
  }

  visiblePortalCount = index;
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
  hero.portalCooldown = 0;
  portalTransition.active = false;
  portalTransition.targetPortal = null;
  portalTransition.elapsed = 0;
  cameraLookDown = 0;
  gameCamera.x = 0;
  const startCameraY = shouldSnapToGround
    ? getGroundAnchoredCameraY()
    : hero.y + CAMERA_BASE_OFFSET;
  gameCamera.y = Math.max(CAMERA_MIN_Y, startCameraY);
};

const pickSnakeSpawnPlatform = () => {
  const viewBounds = getCurrentViewBoundsY();
  const groundTop = getGroundTop();
  const candidates = [];

  for (let i = 0; i < worldPlatforms.length; i++) {
    const platform = worldPlatforms[i];
    if (!platform || platform.removed || platform.falling) {
      continue;
    }

    const top = platform.y + platform.h;
    if (top <= groundTop + 0.9) {
      continue;
    }

    if (Math.abs(top - hero.y) < 1.0) {
      continue;
    }

    if (top < viewBounds.min + 0.2 || top > viewBounds.max - 0.5) {
      continue;
    }

    if (platform.w < 1.6) {
      continue;
    }

    candidates.push(platform);
  }

  if (!candidates.length) {
    for (let i = 0; i < worldPlatforms.length; i++) {
      const platform = worldPlatforms[i];
      if (!platform || platform.removed || platform.falling) {
        continue;
      }

      if (platform.y + platform.h > groundTop + 0.9 && platform.w >= 1.6) {
        candidates.push(platform);
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[clamp(index, 0, candidates.length - 1)];
};

const resetSnake = () => {
  const spawnPlatform = pickSnakeSpawnPlatform();
  if (!spawnPlatform) {
    snake.alive = false;
    snake.ladderDecisionCooldown = 0;
    snake.ladderIntentLeft = 0;
    snakeAI.desiredDir = 0;
    snakeAI.desiredSpeed = 0;
    snakeAI.escapeTarget = null;
    snakeAI.spikeThreat = null;
    return;
  }

  const margin = Math.min(0.46, spawnPlatform.w * 0.25);
  const minX = spawnPlatform.x + margin;
  const maxX = spawnPlatform.x + spawnPlatform.w - margin;
  const spawnX =
    minX < maxX ? THREE.MathUtils.lerp(minX, maxX, Math.random()) : spawnPlatform.x + spawnPlatform.w * 0.5;

  snake.x = spawnX;
  snake.y = spawnPlatform.y + spawnPlatform.h;
  snake.vx = 0;
  snake.vy = 0;
  snake.facing = hero.x >= spawnX ? 1 : -1;
  snake.grounded = true;
  snake.supportPlatform = spawnPlatform;
  snake.onLadder = false;
  snake.ladder = null;
  snake.homePlatform = spawnPlatform;
  snake.patrolDir = Math.random() < 0.5 ? -1 : 1;
  snake.targetLadder = null;
  snake.targetLadderRefresh = 0;
  snake.ladderDecisionCooldown = 0;
  snake.ladderIntentLeft = 0;
  snake.biteCooldown = 0.9;
  snake.alive = true;
  snakeAI.desiredDir = snake.patrolDir;
  snakeAI.desiredSpeed = SNAKE_PATROL_SPEED;
  snakeAI.attackMode = false;
  snakeAI.heroAbove = false;
  snakeAI.escapeTarget = null;
  snakeAI.spikeThreat = null;
  setSnakeState(SNAKE_STATE_PATROL);
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
    resetSnake();
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

const entityTouchesSpike = (left, right, bottom, top) => {
  for (let i = 0; i < visibleSpikeCount; i++) {
    const spike = spikePool[i];
    const spikeLeft = spike.x;
    const spikeRight = spike.x + spike.w;
    const spikeBottom = spike.y;
    const spikeTop = spike.y + spike.h;

    const overlapX = right > spikeLeft && left < spikeRight;
    const overlapY = top > spikeBottom && bottom < spikeTop;

    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
};

const heroTouchesSpike = () => {
  const heroLeft = hero.x - HERO_WIDTH * 0.44;
  const heroRight = hero.x + HERO_WIDTH * 0.44;
  const heroBottom = hero.y + 0.03;
  const heroTop = hero.y + HERO_HEIGHT - 0.05;
  return entityTouchesSpike(heroLeft, heroRight, heroBottom, heroTop);
};

const snakeTouchesSpike = () => {
  if (!snake.alive) {
    return false;
  }

  const snakeLeft = snake.x - SNAKE_WIDTH * 0.46;
  const snakeRight = snake.x + SNAKE_WIDTH * 0.46;
  const snakeBottom = snake.y + 0.04;
  const snakeTop = snake.y + SNAKE_HEIGHT - 0.03;
  return entityTouchesSpike(snakeLeft, snakeRight, snakeBottom, snakeTop);
};

const findTouchedPortal = (left, right, bottom, top) => {
  for (let i = 0; i < visiblePortalCount; i++) {
    const portal = portalPool[i];
    if (!portal.ref || !portal.ref.target) {
      continue;
    }

    const portalLeft = portal.x;
    const portalRight = portal.x + portal.w;
    const portalBottom = portal.y;
    const portalTop = portal.y + portal.h;
    const overlapX = right > portalLeft && left < portalRight;
    const overlapY = top > portalBottom && bottom < portalTop;
    if (overlapX && overlapY) {
      return portal.ref;
    }
  }

  return null;
};

const teleportHeroThroughPortal = () => {
  if (hero.portalCooldown > 0 || portalTransition.active) {
    return false;
  }

  const heroLeft = hero.x - HERO_WIDTH * 0.44;
  const heroRight = hero.x + HERO_WIDTH * 0.44;
  const heroBottom = hero.y + 0.03;
  const heroTop = hero.y + HERO_HEIGHT - 0.05;
  const sourcePortal = findTouchedPortal(heroLeft, heroRight, heroBottom, heroTop);
  if (!sourcePortal || !sourcePortal.target) {
    return false;
  }

  const targetPortal = sourcePortal.target;
  const minCameraY = Math.max(CAMERA_MIN_Y, getGroundAnchoredCameraY());
  portalTransition.active = true;
  portalTransition.targetPortal = targetPortal;
  portalTransition.elapsed = 0;
  portalTransition.duration = PORTAL_TRAVEL_DURATION;
  portalTransition.startCameraY = gameCamera.y;
  portalTransition.targetCameraY = clamp(
    targetPortal.y + CAMERA_BASE_OFFSET,
    minCameraY,
    WORLD_TOP_LIMIT,
  );

  hero.vx = 0;
  hero.vy = 0;
  hero.crouch = 0;
  hero.facing = targetPortal.side < 0 ? 1 : -1;
  hero.grounded = false;
  hero.supportPlatform = null;
  hero.onLadder = false;
  hero.ladder = null;
  hero.ladderRegrabLock = LADDER_REGRAB_LOCK_TIME;
  hero.coyoteLeft = 0;
  hero.jumpBufferLeft = 0;
  hero.superJumpCharge = 0;
  hero.superJumpWindow = 0;
  hero.portalCooldown = PORTAL_COOLDOWN;
  inputState.jumpQueued = false;
  inputState.jumpFromSpace = false;

  return true;
};

const finalizeHeroPortalTransition = () => {
  if (!portalTransition.targetPortal) {
    portalTransition.active = false;
    return;
  }

  const targetPortal = portalTransition.targetPortal;
  const exitsFromLeftWall = targetPortal.side < 0;
  const rawExitX = exitsFromLeftWall
    ? targetPortal.x + targetPortal.w + HERO_WIDTH * 0.5 + PORTAL_EXIT_PADDING
    : targetPortal.x - HERO_WIDTH * 0.5 - PORTAL_EXIT_PADDING;
  const leftBound = -worldHalfWidth + HERO_WIDTH * 0.5;
  const rightBound = worldHalfWidth - HERO_WIDTH * 0.5;
  hero.x = clamp(rawExitX, leftBound, rightBound);
  hero.y = targetPortal.y + 0.02;
  hero.vx = (exitsFromLeftWall ? 1 : -1) * 3.2;
  hero.vy = 0;
  hero.facing = exitsFromLeftWall ? 1 : -1;
  hero.grounded = false;
  hero.supportPlatform = null;
  hero.airJumpsLeft = 1;
  hero.coyoteLeft = 0;
  hero.portalCooldown = PORTAL_COOLDOWN;

  const minCameraY = Math.max(CAMERA_MIN_Y, getGroundAnchoredCameraY());
  gameCamera.y = clamp(hero.y + CAMERA_BASE_OFFSET, minCameraY, WORLD_TOP_LIMIT);

  collectVisiblePlatforms(hero.y, gameCamera.y);
  collectVisibleSpikes(hero.y, gameCamera.y);
  collectVisiblePortals(hero.y, gameCamera.y);
  const standingPlatform = findStandingPlatform();
  if (standingPlatform) {
    hero.y = standingPlatform.y + standingPlatform.h;
    hero.vy = 0;
    hero.grounded = true;
    hero.supportPlatform = standingPlatform;
    hero.coyoteLeft = COYOTE_TIME;
  }

  portalTransition.active = false;
  portalTransition.targetPortal = null;
  portalTransition.elapsed = 0;
};

const stepPortalTransition = (delta) => {
  if (!portalTransition.active) {
    return false;
  }

  portalTransition.elapsed += delta;
  const progress = clamp(
    portalTransition.elapsed / Math.max(0.001, portalTransition.duration),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);
  gameCamera.y = THREE.MathUtils.lerp(
    portalTransition.startCameraY,
    portalTransition.targetCameraY,
    easedProgress,
  );

  if (progress >= 1) {
    finalizeHeroPortalTransition();
  }

  return true;
};

const findSnakeSpikeThreat = () => {
  if (!snake.alive || !snake.grounded) {
    return null;
  }

  const snakeCenterY = snake.y + SNAKE_HEIGHT * 0.5;
  const heading = Math.sign(snake.vx) || snake.patrolDir || snake.facing || 1;
  let bestThreat = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < visibleSpikeCount; i++) {
    const spike = spikePool[i];
    const spikeCenterY = spike.y + spike.h * 0.5;
    if (Math.abs(spikeCenterY - snakeCenterY) > SNAKE_SPIKE_FEAR_RADIUS_Y) {
      continue;
    }

    const spikeCenterX = spike.x + spike.w * 0.5;
    const dx = spikeCenterX - snake.x;
    const distance = Math.abs(dx);
    if (distance > SNAKE_SPIKE_FEAR_RADIUS_X) {
      continue;
    }

    const isAhead = dx * heading >= -0.05;
    const score = distance + (isAhead ? 0 : 0.75);
    if (score < bestScore) {
      bestScore = score;
      bestThreat = { dx, distance };
    }
  }

  return bestThreat;
};

const resolveSnakeLanding = (previousY) => {
  if (snake.vy > 0) {
    return null;
  }

  const left = snake.x - SNAKE_WIDTH * 0.5 + 0.05;
  const right = snake.x + SNAKE_WIDTH * 0.5 - 0.05;
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

    if (previousY >= platformTop - 0.02 && snake.y <= platformTop) {
      if (platformTop > bestLanding) {
        bestLanding = platformTop;
        bestPlatform = platform.ref;
      }
    }
  }

  if (bestLanding > -Infinity) {
    snake.y = bestLanding;
    snake.vy = 0;
    return bestPlatform;
  }

  return null;
};

const findSnakeStandingPlatform = () => {
  const left = snake.x - SNAKE_WIDTH * 0.5 + 0.05;
  const right = snake.x + SNAKE_WIDTH * 0.5 - 0.05;
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

    if (Math.abs(snake.y - platformTop) <= 0.16 && platformTop > bestTop) {
      bestTop = platformTop;
      bestPlatform = platform.ref;
    }
  }

  return bestPlatform;
};

const findSnakeLadderTarget = ({
  preferHero = true,
  maxDistanceX = Number.POSITIVE_INFINITY,
} = {}) => {
  if (!snake.supportPlatform) {
    return null;
  }

  const basePlatform = snake.supportPlatform;
  const baseTop = basePlatform.y + basePlatform.h;
  const minX = basePlatform.x + 0.14;
  const maxX = basePlatform.x + basePlatform.w - 0.14;
  let bestLadder = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < worldLadders.length; i++) {
    const ladder = worldLadders[i];
    if (ladder.x < minX || ladder.x > maxX) {
      continue;
    }

    const snakeDx = Math.abs(ladder.x - snake.x);
    if (snakeDx > maxDistanceX) {
      continue;
    }

    if (Math.abs(ladder.y - baseTop) > 0.3) {
      continue;
    }

    const ladderTop = ladder.y + ladder.h;
    if (ladderTop <= snake.y + 0.45) {
      continue;
    }

    let score = snakeDx;
    if (preferHero) {
      score +=
        Math.abs(ladder.x - hero.x) +
        Math.abs(ladderTop - hero.y) * 0.26 +
        snakeDx * 0.45;
    } else {
      score += Math.abs(ladderTop - snake.y) * 0.18;
    }

    if (score < bestScore) {
      bestScore = score;
      bestLadder = ladder;
    }
  }

  return bestLadder;
};

const findSnakeEscapePlatform = () => {
  if (
    !snake.supportPlatform ||
    snake.supportPlatform.falling ||
    snake.supportPlatform.removed
  ) {
    return null;
  }

  const supportMotion =
    snake.supportPlatform.moveDir * snake.supportPlatform.moveSpeed;
  if (Math.abs(supportMotion) < 0.01) {
    return null;
  }

  const supportTop = snake.supportPlatform.y + snake.supportPlatform.h;
  let bestCandidate = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < visiblePlatformCount; i++) {
    const platform = platformPool[i]?.ref;
    if (
      !platform ||
      platform === snake.supportPlatform ||
      platform.falling ||
      platform.removed
    ) {
      continue;
    }

    const platformMotion = platform.moveDir * platform.moveSpeed;
    if (Math.abs(platformMotion) > 0.01) {
      continue;
    }

    const top = platform.y + platform.h;
    if (Math.abs(top - supportTop) > SNAKE_ESCAPE_PLATFORM_RANGE_Y) {
      continue;
    }

    if (platform.w < 1.1) {
      continue;
    }

    const center = platform.x + platform.w * 0.5;
    const dx = center - snake.x;
    if (Math.abs(dx) > SNAKE_ESCAPE_PLATFORM_RANGE_X) {
      continue;
    }

    const forward = Math.sign(supportMotion) || snake.patrolDir || 1;
    const forwardPenalty = dx * forward < 0 ? 1.2 : 0;
    const score = Math.abs(dx) + forwardPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestCandidate = platform;
    }
  }

  return bestCandidate;
};

const stepSnake = (delta) => {
  if (!snake.alive) {
    return;
  }

  snake.biteCooldown = Math.max(0, snake.biteCooldown - delta);
  snake.targetLadderRefresh = Math.max(0, snake.targetLadderRefresh - delta);
  snake.ladderDecisionCooldown = Math.max(0, snake.ladderDecisionCooldown - delta);
  snake.ladderIntentLeft = Math.max(0, snake.ladderIntentLeft - delta);
  collectVisiblePlatforms(Math.max(hero.y, snake.y), gameCamera.y);
  collectVisibleSpikes(Math.max(hero.y, snake.y), gameCamera.y);

  const snakeEyeY = snake.y + SNAKE_HEIGHT * 0.55;
  const heroEyeY = hero.y + 0.74;
  const sameLevel = Math.abs(snakeEyeY - heroEyeY) <= SNAKE_ATTACK_LEVEL_DELTA;
  let sightBlocked = false;
  if (sameLevel) {
    const rayMinX = Math.min(snake.x, hero.x);
    const rayMaxX = Math.max(snake.x, hero.x);

    for (let i = 0; i < visiblePlatformCount; i++) {
      const platform = platformPool[i];
      if (!platform.ref || platform.ref.falling || platform.ref.removed) {
        continue;
      }

      const platformLeft = platform.x;
      const platformRight = platform.x + platform.w;
      if (rayMaxX <= platformLeft || rayMinX >= platformRight) {
        continue;
      }

      const insideVerticalBody =
        snakeEyeY >= platform.y + 0.02 &&
        snakeEyeY <= platform.y + platform.h - 0.02;
      if (insideVerticalBody) {
        sightBlocked = true;
        break;
      }
    }
  }

  const attackMode = sameLevel && !sightBlocked;
  const heroAbove = hero.y > snake.y + 0.45;
  const spikeThreat = findSnakeSpikeThreat();
  snakeAI.attackMode = attackMode;
  snakeAI.heroAbove = heroAbove;
  snakeAI.escapeTarget = findSnakeEscapePlatform();
  snakeAI.spikeThreat = spikeThreat;
  if (
    snake.grounded &&
    snake.supportPlatform &&
    !snake.supportPlatform.falling &&
    !snake.supportPlatform.removed
  ) {
    snake.x +=
      snake.supportPlatform.moveDir * snake.supportPlatform.moveSpeed * delta;
    snake.x = clamp(
      snake.x,
      -worldHalfWidth + SNAKE_WIDTH * 0.5,
      worldHalfWidth - SNAKE_WIDTH * 0.5,
    );
  }

  if (snake.onLadder && snake.ladder) {
    setSnakeState(SNAKE_STATE_CLIMB);
    snakeAI.stateMachine.update();
    const activeLadder = snake.ladder;
    const ladderTop = activeLadder.y + activeLadder.h;
    snake.x = approach(snake.x, activeLadder.x, delta * 12);
    snake.y += SNAKE_CLIMB_SPEED * delta;
    snake.vx = 0;
    snake.vy = 0;
    snake.facing = hero.x >= snake.x ? 1 : -1;

    if (snake.y >= ladderTop - 0.02) {
      snake.y = ladderTop;
      snake.onLadder = false;
      snake.ladder = null;
      snake.targetLadder = null;
      collectVisiblePlatforms(snake.y, gameCamera.y);
      const standing = findSnakeStandingPlatform();
      snake.grounded = standing !== null;
      snake.supportPlatform = standing;
    }
  } else {
    let moveDir = 0;
    let targetMoveSpeed = SNAKE_PATROL_SPEED;
    const patrolPlatform =
      snake.grounded &&
      snake.supportPlatform &&
      !snake.supportPlatform.falling &&
      !snake.supportPlatform.removed
        ? snake.supportPlatform
        : snake.homePlatform;

    if (patrolPlatform && snake.grounded) {
      const leftPatrolEdge = patrolPlatform.x + SNAKE_WIDTH * 0.5 + 0.06;
      const rightPatrolEdge =
        patrolPlatform.x + patrolPlatform.w - SNAKE_WIDTH * 0.5 - 0.06;
      if (rightPatrolEdge <= leftPatrolEdge) {
        snake.patrolDir = 0;
      } else if (snake.x <= leftPatrolEdge) {
        snake.patrolDir = 1;
      } else if (snake.x >= rightPatrolEdge) {
        snake.patrolDir = -1;
      }
    }

    const canUseLadders =
      snake.grounded &&
      snake.supportPlatform &&
      !snake.supportPlatform.falling &&
      !snake.supportPlatform.removed;
    const activeLadderInvalid =
      !canUseLadders ||
      !snake.targetLadder ||
      snake.targetLadder.h <= 0 ||
      Math.abs(
        snake.targetLadder.y - (snake.supportPlatform.y + snake.supportPlatform.h),
      ) > 0.35;

    if (activeLadderInvalid) {
      snake.targetLadder = null;
    }

    if (
      canUseLadders &&
      !spikeThreat &&
      !attackMode &&
      !snakeAI.escapeTarget &&
      snake.ladderDecisionCooldown <= 0
    ) {
      const curiousLadder = findSnakeLadderTarget({
        preferHero: false,
        maxDistanceX: SNAKE_LADDER_NEARBY_X,
      });
      snake.ladderDecisionCooldown = curiousLadder ? SNAKE_LADDER_DECISION_INTERVAL : 0.4;
      if (curiousLadder && Math.random() < SNAKE_LADDER_CURIOUS_CHANCE) {
        snake.targetLadder = curiousLadder;
        snake.targetLadderRefresh = SNAKE_REPATH_INTERVAL;
        snake.ladderIntentLeft = SNAKE_LADDER_INTENT_TIME;
      }
    }

    if (canUseLadders && heroAbove) {
      if (!snake.targetLadder || snake.targetLadderRefresh <= 0) {
        snake.targetLadder = findSnakeLadderTarget();
        snake.targetLadderRefresh = SNAKE_REPATH_INTERVAL;
      }

      if (snake.targetLadder) {
        snake.ladderIntentLeft = Math.max(snake.ladderIntentLeft, 0.32);
      }
    }

    if (spikeThreat) {
      snake.targetLadder = null;
      snake.ladderIntentLeft = 0;
      setSnakeState(SNAKE_STATE_SPIKE_FEAR);
    } else if (snakeAI.escapeTarget) {
      snake.targetLadder = null;
      snake.ladderIntentLeft = 0;
      setSnakeState(SNAKE_STATE_ESCAPE);
    } else if (attackMode) {
      snake.targetLadder = null;
      snake.ladderIntentLeft = 0;
      setSnakeState(SNAKE_STATE_ATTACK);
    } else if (canUseLadders && snake.ladderIntentLeft > 0) {
      if (!snake.targetLadder || snake.targetLadderRefresh <= 0) {
        snake.targetLadder = findSnakeLadderTarget({
          preferHero: heroAbove,
          maxDistanceX: heroAbove ? Number.POSITIVE_INFINITY : SNAKE_LADDER_NEARBY_X * 1.35,
        });
        snake.targetLadderRefresh = SNAKE_REPATH_INTERVAL;
      }

      if (snake.targetLadder) {
        setSnakeState(SNAKE_STATE_LADDER_SEEK);
      } else {
        snake.ladderIntentLeft = 0;
        setSnakeState(SNAKE_STATE_PATROL);
      }
    } else {
      snake.targetLadder = null;
      snake.ladderIntentLeft = 0;
      setSnakeState(SNAKE_STATE_PATROL);
    }

    snakeAI.stateMachine.update();
    moveDir = snakeAI.desiredDir;
    targetMoveSpeed = snakeAI.desiredSpeed;

    if (
      snakeAI.stateMachine.in(SNAKE_STATE_LADDER_SEEK) &&
      snake.targetLadder
    ) {
      const ladderDx = snake.targetLadder.x - snake.x;
      if (
        Math.abs(ladderDx) <= SNAKE_LADDER_ATTACH_X &&
        Math.abs(snake.y - snake.targetLadder.y) <= SNAKE_LADDER_ATTACH_Y
      ) {
        snake.onLadder = true;
        snake.ladder = snake.targetLadder;
        snake.ladderIntentLeft = 0;
        snake.grounded = false;
        snake.supportPlatform = null;
        snake.vx = 0;
        snake.vy = 0;
        setSnakeState(SNAKE_STATE_CLIMB);
        snakeAI.stateMachine.update();
        moveDir = 0;
        targetMoveSpeed = 0;
      }
    }

    snake.vx = approach(
      snake.vx,
      moveDir * targetMoveSpeed,
      (snake.grounded ? 22 : 12) * delta,
    );
    if (moveDir === 0) {
      snake.vx = approach(snake.vx, 0, 15 * delta);
    }

    if (Math.abs(snake.vx) > 0.08) {
      snake.facing = snake.vx > 0 ? 1 : -1;
    }

    snake.vy = Math.max(
      SNAKE_MAX_FALL_SPEED,
      snake.vy + SNAKE_FALL_GRAVITY * delta,
    );

    const previousY = snake.y;
    snake.x += snake.vx * delta;
    snake.x = clamp(
      snake.x,
      -worldHalfWidth + SNAKE_WIDTH * 0.5,
      worldHalfWidth - SNAKE_WIDTH * 0.5,
    );
    snake.y += snake.vy * delta;

    collectVisiblePlatforms(snake.y, gameCamera.y);
    const landed = resolveSnakeLanding(previousY);
    snake.grounded = landed !== null;
    snake.supportPlatform = landed;
    if (snake.grounded) {
      snake.vy = 0;
      snake.targetLadder = null;
    }
  }

  if (snakeTouchesSpike()) {
    snake.alive = false;
    return;
  }

  const snakeDropLimit = gameCamera.y - viewHeight * 0.98;
  if (snake.y < snakeDropLimit) {
    snake.alive = false;
    return;
  }

  const biteCenterY = snake.y + SNAKE_HEIGHT * 0.54;
  const heroCenterY = hero.y + 0.74;
  if (
    attackMode &&
    snake.biteCooldown <= 0 &&
    Math.abs(snake.x - hero.x) <= SNAKE_BITE_RANGE_X &&
    Math.abs(biteCenterY - heroCenterY) <= SNAKE_BITE_RANGE_Y
  ) {
    snake.biteCooldown = SNAKE_BITE_COOLDOWN;
    applyDamage(1);
  }
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
  cameraLookDown = approach(
    cameraLookDown,
    inputState.down ? 1 : 0,
    delta * CAMERA_LOOK_DOWN_SPEED,
  );
  updateBrittlePlatforms(delta);
  hero.ladderRegrabLock = Math.max(0, hero.ladderRegrabLock - delta);
  hero.portalCooldown = Math.max(0, hero.portalCooldown - delta);
  if (stepPortalTransition(delta)) {
    return;
  }
  collectVisibleLadders(hero.y, gameCamera.y);
  collectVisibleSpikes(hero.y, gameCamera.y);
  collectVisiblePortals(hero.y, gameCamera.y);
  stepSnake(delta);
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
    if (teleportHeroThroughPortal()) {
      return;
    }

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
  const supportMotion =
    hero.grounded &&
    hero.supportPlatform &&
    !hero.supportPlatform.falling &&
    !hero.supportPlatform.removed
      ? hero.supportPlatform.moveDir * hero.supportPlatform.moveSpeed
      : 0;
  const movingAgainstPlatform =
    horizontalInput !== 0 && Math.abs(supportMotion) > 0.01 && horizontalInput * supportMotion < 0;
  const moveSpeedLimit = movingAgainstPlatform
    ? MAX_MOVE_SPEED * MOVE_AGAINST_PLATFORM_FACTOR
    : MAX_MOVE_SPEED;

  hero.vx = approach(hero.vx, horizontalInput * moveSpeedLimit, acceleration * delta);

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
  if (teleportHeroThroughPortal()) {
    return;
  }
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
  gameCamera.x = 0;
  if (!portalTransition.active) {
    const groundTop = getGroundTop();
    const isNearGround = hero.y <= groundTop + 0.95;
    const anchoredDefaultY = isNearGround
      ? Math.max(hero.y + CAMERA_BASE_OFFSET, getGroundAnchoredCameraY())
      : hero.y + CAMERA_BASE_OFFSET;
    const defaultY = anchoredDefaultY;
    const lookDownY = defaultY - getVisibleHalfHeightWorld() * 0.5;
    const targetCameraY = THREE.MathUtils.lerp(defaultY, lookDownY, cameraLookDown);
    const bottomCameraBoundY = Math.max(CAMERA_MIN_Y, getGroundAnchoredCameraY());
    const clampedTargetY = clamp(targetCameraY, bottomCameraBoundY, WORLD_TOP_LIMIT);
    const viewBounds = getCurrentViewBoundsY();
    const heroOutOfView = hero.y < viewBounds.min || hero.y > viewBounds.max;
    const shouldBypassDeadzone = cameraLookDown > 0.02 || heroOutOfView;
    const verticalCameraTarget = shouldBypassDeadzone
      ? clampedTargetY
      : applyVerticalCameraDeadzone(clampedTargetY);
    const cameraLerp = cameraLookDown > 0.05 || heroOutOfView
      ? CAMERA_SCROLL_SMOOTH_CROUCH
      : CAMERA_SCROLL_SMOOTH;
    gameCamera.y = THREE.MathUtils.lerp(gameCamera.y, verticalCameraTarget, cameraLerp);
  }

  const visibilityAnchorY = portalTransition.active ? gameCamera.y : hero.y;
  collectVisiblePlatforms(visibilityAnchorY, gameCamera.y);
  collectVisibleCollectibles(gameCamera.y);
  collectVisibleLadders(visibilityAnchorY, gameCamera.y);
  collectVisibleSpikes(visibilityAnchorY, gameCamera.y);
  collectVisiblePortals(visibilityAnchorY, gameCamera.y);

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

  const shaderPortals = material.uniforms.uPortals.value;
  const shaderPortalSide = material.uniforms.uPortalSide.value;
  for (let i = 0; i < MAX_VISIBLE_PORTALS; i++) {
    const portal = portalPool[i];
    shaderPortals[i].set(portal.x, portal.y, portal.w, portal.h);
    shaderPortalSide[i] = portal.side;
  }

  material.uniforms.uTime.value = timeSeconds;
  material.uniforms.uCameraPos.value.set(gameCamera.x, gameCamera.y);
  material.uniforms.uHeroPos.value.set(hero.x, hero.y);
  material.uniforms.uHeroVelocity.value.set(hero.vx, hero.vy);
  material.uniforms.uHeroFacing.value = hero.facing;
  material.uniforms.uHeroGrounded.value = hero.grounded ? 1.0 : 0.0;
  material.uniforms.uHeroCrouch.value = hero.crouch;
  material.uniforms.uHeroVisible.value = portalTransition.active ? 0.0 : 1.0;
  material.uniforms.uSnakePos.value.set(snake.x, snake.y);
  material.uniforms.uSnakeVelocity.value.set(snake.vx, snake.vy);
  material.uniforms.uSnakeFacing.value = snake.facing;
  material.uniforms.uSnakeAlive.value = snake.alive ? 1.0 : 0.0;
  material.uniforms.uSnakeOnLadder.value = snake.onLadder ? 1.0 : 0.0;
  material.uniforms.uPlatformCount.value = visiblePlatformCount;
  material.uniforms.uCollectibleCount.value = visibleCollectibleCount;
  material.uniforms.uLadderCount.value = visibleLadderCount;
  material.uniforms.uSpikeCount.value = visibleSpikeCount;
  material.uniforms.uPortalCount.value = visiblePortalCount;
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
  gameViewportPx.x = gameX;
  gameViewportPx.y = 0;
  gameViewportPx.w = gameWidth;
  gameViewportPx.h = height;

  material.uniforms.uResolution.value.set(width, height);
  material.uniforms.uGameViewport.value.set(gameX, 0, gameWidth, height);
  material.uniforms.uViewSize.value.set(viewWidth, viewHeight);

  worldHalfWidth = calculateWorldHalfWidth();
  generateWorld();

  checkpoint.x = START_POS.x;
  checkpoint.y = START_POS.y;
  livesLeft.value = START_LIVES;
  highestRow.value = 0;
  resetCollectiblesProgress();
  resetHero(START_POS.x, START_POS.y);
  resetSnake();
  collectVisiblePlatforms(hero.y, gameCamera.y);
  collectVisibleCollectibles(gameCamera.y);
  collectVisibleLadders(hero.y, gameCamera.y);
  collectVisibleSpikes(hero.y, gameCamera.y);
  collectVisiblePortals(hero.y, gameCamera.y);
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
