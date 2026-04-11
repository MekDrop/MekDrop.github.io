<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent></div>
  <div class="game-hud">
    <div class="game-hud__row">SCORE <span>{{ hudScore }}</span> COINS <span>{{ hudCoins }}</span> LIVES <span>{{ hudLives }}</span></div>
    <div class="game-hud__row">TIME <span>{{ hudTimer }}</span> STATE <span>{{ hudState }}</span> ENEMIES <span>{{ hudEnemies }}</span></div>
    <div class="hint">A / D OR ARROWS MOVE · SPACE / W / UP JUMP · R RESET · ONE SCREEN · GENERATED STAGE</div>
  </div>
</template>

<style lang="scss">
.background-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  background: #030604;
  pointer-events: auto;
}

.game-hud {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
  width: min(62rem, calc(100% - 2rem));
  text-align: left;
  font-family: "Courier New", monospace;
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  color: #baf6d4;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(150, 255, 224, 0.24);
  text-transform: uppercase;
}

.game-hud__row,
.hint {
  border: 1px solid rgba(150, 255, 224, 0.34);
  padding: 0.48rem 0.72rem;
  background: linear-gradient(180deg, rgba(6, 18, 11, 0.58), rgba(2, 10, 6, 0.18));
  box-shadow: inset 0 0 10px rgba(150, 255, 224, 0.07), 0 0 14px rgba(150, 255, 224, 0.06);
}

.game-hud__row + .game-hud__row,
.hint {
  margin-top: 0.38rem;
}

.game-hud span {
  display: inline-block;
  min-width: 4ch;
  text-align: right;
  margin-right: 1.25rem;
  color: #edfff3;
}

.hint {
  color: rgba(190, 255, 220, 0.72);
  font-size: 0.54rem;
  line-height: 1.55;
}

@media (max-width: 700px) {
  .game-hud {
    top: 0.65rem;
    width: calc(100% - 1rem);
    font-size: 0.56rem;
    letter-spacing: 0.14em;
  }

  .game-hud__row,
  .hint {
    padding: 0.38rem 0.5rem;
  }

  .hint {
    font-size: 0.48rem;
  }
}
</style>

<script setup>
import * as THREE from "three";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dom } from "quasar";
import { getHeroAnimation } from "assets/game/sprites/hero-sprite-registry";
import coinGoldSprite from "assets/game/sprites/collectibles/coin-gold.png";
import enemyWalkFrame0 from "assets/game/sprites/enemies/mushroom-stomper-walk-0.png";
import enemyWalkFrame1 from "assets/game/sprites/enemies/mushroom-stomper-walk-1.png";
import portalFrame from "assets/game/sprites/goal/portal-frame-0.png";
import platformCenterSprite from "assets/game/sprites/platforms/platform-center.png";
import platformWallSprite from "assets/game/sprites/platforms/platform-wall.png";
import platformStairSprite from "assets/game/sprites/platforms/platform-stair.png";

const BASE_PIXEL_SCALE = 8;
const MIN_WORLD_WIDTH = 1;
const MIN_WORLD_HEIGHT = 1;
const MAX_SOLIDS = 64;
const MAX_ENEMIES = 40;
const MAX_COINS = 40;
const STAGE_MAX_COLLECTIBLES = 10;
const PHASE_PLAYING = 0;
const PHASE_DEAD = 1;
const PHASE_CLEAR = 2;
const HERO_WORLD_SIZE = 16;
const COIN_WORLD_SIZE = HERO_WORLD_SIZE / 3;
const HERO_TURN_DURATION = 0.34;
const HERO_SCREEN_OFFSET_Y = 5;
const PLATFORM_CENTER_CROP = {
  x: 4 / 64,
  y: 7 / 32,
  w: 55 / 64,
  h: 18 / 32,
};
const PLATFORM_WALL_CROP = {
  x: 0 / 32,
  y: 12 / 32,
  w: 32 / 32,
  h: 10 / 32,
};
const PLATFORM_STAIR_CROP = {
  x: 5 / 64,
  y: 3 / 32,
  w: 54 / 64,
  h: 26 / 32,
};

const PLAYER = {
  width: 7,
  height: 13,
  maxSpeed: 34,
  groundAccel: 190,
  airAccel: 120,
  friction: 240,
  gravity: -150,
  jumpGravityHeld: -132,
  jumpGravityReleased: -250,
  fallGravity: -210,
  maxFallSpeed: -110,
  jumpVelocity: 76,
  jumpReleaseVelocity: 34,
  stompBounce: 42,
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
};
const ENEMY_WIDTH = 7;
const ENEMY_HEIGHT = 8;
const ENEMY_STOMP_HEADROOM = PLAYER.height + 4;
const FIRST_ENEMY_MIN_WORLD_RATIO = 0.2;
const DEFAULT_COIN_RADIUS = COIN_WORLD_SIZE * 0.5;
const COIN_MIN_SEPARATION = 0.75;
const COIN_PLATFORM_CLEARANCE = 1.25;
const PLATFORM_GRID = 4;
const ENEMY_PLACEMENT_MIN_GAP = ENEMY_WIDTH + PLATFORM_GRID;
const PLATFORM_ENEMY_TARGET_RATIO = 0.45;
const FLYING_ROW_CLEARANCE = PLAYER.height;
const PATH_MIN_GAP = 6;
const PATH_MAX_GAP = 13;

const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));
const snapToPlatformGrid = (value) => Math.round(value / PLATFORM_GRID) * PLATFORM_GRID;
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const randomInt = (rng, min, max) => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(rng() * (hi - lo + 1)) + lo;
};
const sortByX = (a, b) => a.x - b.x;

const createRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const createRandomSeed = () => {
  const seed = Math.floor(Math.random() * 4294967296) >>> 0;
  return seed === 0 ? 1 : seed;
};
const pickEvenlyDistributed = (items, count) => {
  if (items.length <= count) return [...items];
  if (count <= 0) return [];
  if (count === 1) return [items[Math.floor(items.length * 0.5)]];

  const picks = [];
  const used = new Set();
  const denominator = Math.max(1, count - 1);

  for (let i = 0; i < count; i++) {
    const target = Math.round((i * (items.length - 1)) / denominator);
    let index = target;
    while (used.has(index) && index < items.length - 1) {
      index += 1;
    }
    while (used.has(index) && index > 0) {
      index -= 1;
    }
    if (used.has(index)) continue;
    used.add(index);
    picks.push(items[index]);
  }

  return picks.sort(sortByX);
};

const createPlayer = () => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  w: PLAYER.width,
  h: PLAYER.height,
  facing: 1,
  grounded: false,
  coyote: 0,
  invulnerable: 0,
  anim: 0,
  prevY: 0,
  turnTimer: 0,
});

const createEnemy = (spawn) => ({
  ...spawn,
  vx: spawn.speed * spawn.dir,
  vy: 0,
  w: ENEMY_WIDTH,
  h: ENEMY_HEIGHT,
  grounded: false,
  alive: true,
  anim: Math.random() * Math.PI * 2,
});

const createCoin = (coin) => ({
  ...coin,
  collected: false,
  phase: (coin.x + coin.y) * 0.1,
});

const bodyRect = (body) => ({
  x: body.x - body.w * 0.5,
  y: body.y,
  w: body.w,
  h: body.h,
});

const spriteRect = (x, y, w, h) => ({ x: x - w * 0.5, y, w, h });
const coinRect = (coin, padding = 0) => ({
  x: coin.x - coin.r - padding,
  y: coin.y - coin.r - padding,
  w: coin.r * 2 + padding * 2,
  h: coin.r * 2 + padding * 2,
});
const isCoinClearOfSolids = (coin, solids) => {
  const rect = coinRect(coin, COIN_PLATFORM_CLEARANCE);
  return !solids.some((solid) => overlap(rect, solid));
};

const world = {
  width: MIN_WORLD_WIDTH,
  height: MIN_WORLD_HEIGHT,
  seed: createRandomSeed(),
  floorHeight: 12,
  solids: [],
  enemySpawns: [],
  coins: [],
  spawn: { x: 12, y: 12 },
  goal: { x: 130, y: 12, h: 40 },
};

const snapSolidToGrid = (solid) => {
  const snapped = { ...solid };
  snapped.y = snapToPlatformGrid(snapped.y);
  snapped.h = Math.max(PLATFORM_GRID, snapToPlatformGrid(snapped.h));

  if (snapped.type !== 0) {
    snapped.x = snapToPlatformGrid(snapped.x);
    snapped.w = Math.max(PLATFORM_GRID, snapToPlatformGrid(snapped.w));
  }

  return snapped;
};

const pushSolid = (list, solid) => {
  if (list.length >= MAX_SOLIDS) return;
  list.push(snapSolidToGrid(solid));
};

const pushCoin = (list, coin) => {
  if (list.length >= MAX_COINS) return;
  const candidate = {
    ...coin,
    r: coin.r ?? DEFAULT_COIN_RADIUS,
  };
  const minDistance = candidate.r * 2 + COIN_MIN_SEPARATION;
  const minDistanceSq = minDistance * minDistance;
  for (let i = 0; i < list.length; i++) {
    const other = list[i];
    const dx = candidate.x - other.x;
    const dy = candidate.y - other.y;
    if (dx * dx + dy * dy < minDistanceSq) {
      return;
    }
  }
  list.push(candidate);
};

const pushEnemy = (list, enemy) => {
  if (list.length >= MAX_ENEMIES) return;
  list.push(enemy);
};

const addPlatformCoins = (coins, x, y, w, count) => {
  if (count <= 0) return;
  const step = w / (count + 1);
  for (let i = 0; i < count; i++) {
    pushCoin(coins, {
      x: x + step * (i + 1),
      y,
      r: DEFAULT_COIN_RADIUS,
    });
  }
};

const hasStompHeadroomAtX = (x, enemyGroundY, solids) => {
  const enemyTop = enemyGroundY + ENEMY_HEIGHT;
  const enemyHalf = ENEMY_WIDTH * 0.45;
  let nearestCeilingBottom = Number.POSITIVE_INFINITY;

  for (let i = 0; i < solids.length; i++) {
    const solid = solids[i];
    if (solid.y <= enemyTop + 0.01) continue;
    const overlapsX = x + enemyHalf > solid.x && x - enemyHalf < solid.x + solid.w;
    if (!overlapsX) continue;
    nearestCeilingBottom = Math.min(nearestCeilingBottom, solid.y);
  }

  return nearestCeilingBottom - enemyTop >= ENEMY_STOMP_HEADROOM;
};
const isEnemyBodyClearAtX = (x, enemyGroundY, solids) => {
  const rect = spriteRect(x, enemyGroundY, ENEMY_WIDTH, ENEMY_HEIGHT);
  for (let i = 0; i < solids.length; i++) {
    if (overlap(rect, solids[i])) return false;
  }
  return true;
};
const hasEnemySupportAtX = (x, enemyGroundY, solids, probe = 1.25) => {
  const rect = {
    x: x - ENEMY_WIDTH * 0.5 + 0.35,
    y: enemyGroundY - probe,
    w: ENEMY_WIDTH - 0.7,
    h: probe,
  };
  for (let i = 0; i < solids.length; i++) {
    if (overlap(rect, solids[i])) return true;
  }
  return false;
};

const normalizeEnemyPatrolForHeadroom = (spawn, solids) => {
  const minX = Math.min(spawn.minX, spawn.maxX);
  const maxX = Math.max(spawn.minX, spawn.maxX);
  const scanStep = 1;
  const validXs = [];
  for (let x = minX; x <= maxX + 0.01; x += scanStep) {
    if (!hasStompHeadroomAtX(x, spawn.y, solids)) continue;
    if (!isEnemyBodyClearAtX(x, spawn.y, solids)) continue;
    if (!hasEnemySupportAtX(x, spawn.y, solids)) continue;
    validXs.push(x);
  }
  if (validXs.length === 0) {
    return null;
  }
  let bestX = validXs[0];
  let bestDistance = Math.abs(validXs[0] - spawn.x);
  for (let i = 1; i < validXs.length; i++) {
    const distance = Math.abs(validXs[i] - spawn.x);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestX = validXs[i];
    }
  }

  if (spawn.lockPlatformPatrol) {
    return {
      ...spawn,
      minX,
      maxX,
      x: bestX,
    };
  }

  return {
    ...spawn,
    minX,
    maxX,
    x: bestX,
  };
};

const generateLevel = (nextWidth, nextHeight, seed = world.seed) => {
  const width = Math.max(MIN_WORLD_WIDTH, Math.floor(nextWidth));
  const height = Math.max(MIN_WORLD_HEIGHT, Math.floor(nextHeight));
  const rng = createRng(seed);
  const floorMin = Math.ceil(6 / PLATFORM_GRID) * PLATFORM_GRID;
  const floorMaxRaw = Math.max(6, Math.floor(height * 0.22));
  const floorMax = Math.max(floorMin, Math.floor(floorMaxRaw / PLATFORM_GRID) * PLATFORM_GRID);
  const floorHeight = clamp(snapToPlatformGrid(Math.round(height * 0.15)), floorMin, floorMax);
  const spawn = {
    x: clamp(Math.round(width * 0.08), 6, Math.max(6, Math.floor(width * 0.16))),
    y: floorHeight,
  };

  const solids = [];
  const coins = [];
  const enemySpawns = [];
  const mapRightMargin = clamp(Math.round(width * 0.05), 4, 12);
  const safeLeft = Math.min(width - 20, spawn.x + 10);
  const goal = {
    x: clamp(
      randomInt(rng, Math.floor(width * 0.68), Math.floor(width * 0.9)),
      safeLeft + 24,
      width - mapRightMargin - 2,
    ),
    y: floorHeight,
    h: clamp(Math.round(height * 0.18), 11, 16),
  };
  const safeRight = Math.max(safeLeft + 16, goal.x - 14);
  const stairCount = clamp(Math.floor(width / 56), 2, 5);
  const stepWidth = clamp(Math.floor(width * 0.05), 6, 8);
  const stairStart = goal.x - 10 - stairCount * stepWidth;
  const stairEnd = goal.x + stepWidth;
  const flyingPlatformHeight = 4;
  const flyingBandBottom = clamp(
    snapToPlatformGrid(floorHeight + PLAYER.height + 2),
    floorHeight + PLATFORM_GRID,
    Math.max(floorHeight + PLATFORM_GRID, height - flyingPlatformHeight - 10),
  );
  const flyingBandTop = clamp(
    snapToPlatformGrid(height - flyingPlatformHeight - 10),
    flyingBandBottom,
    height - flyingPlatformHeight - 6,
  );
  const minPlatformGap = PLATFORM_GRID;
  const flyingRowStep = Math.ceil((flyingPlatformHeight + FLYING_ROW_CLEARANCE) / PLATFORM_GRID) * PLATFORM_GRID;
  const flyingRows = [];
  for (let y = flyingBandBottom; y <= flyingBandTop; y += flyingRowStep) {
    flyingRows.push(y);
  }
  if (flyingRows.length === 0) {
    flyingRows.push(flyingBandBottom);
  }

  pushSolid(solids, { x: 0, y: 0, w: width, h: floorHeight, type: 0 });

  const touchesOtherPlatform = (candidate, gap = minPlatformGap) => {
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (solid.type === 0) continue;
      const intersectsWithGap =
        candidate.x < solid.x + solid.w + gap &&
        candidate.x + candidate.w > solid.x - gap &&
        candidate.y < solid.y + solid.h + gap &&
        candidate.y + candidate.h > solid.y - gap;
      if (intersectsWithGap) {
        return true;
      }
    }
    return false;
  };

  const createFlyingPlatform = (x, width, type, rowY = flyingRows[0]) => {
    if (solids.length >= MAX_SOLIDS) return null;
    const candidate = snapSolidToGrid({
      x,
      y: rowY,
      w: width,
      h: flyingPlatformHeight,
      type,
    });
    const overlapsStairZone =
      candidate.x < stairEnd + minPlatformGap &&
      candidate.x + candidate.w > stairStart - minPlatformGap;
    if (overlapsStairZone) {
      return null;
    }
    if (touchesOtherPlatform(candidate)) {
      return null;
    }
    solids.push(candidate);
    return candidate;
  };
  const hasLaneEnemyGap = (x, y) => {
    return !enemySpawns.some((enemy) => {
      const sameLane = Math.abs(enemy.y - y) < PLATFORM_GRID;
      return sameLane && Math.abs(enemy.x - x) < ENEMY_PLACEMENT_MIN_GAP;
    });
  };
  const tryPlacePlatformEnemy = (platform, chance) => {
    if (!platform || platform.w < 14 || rng() >= chance) return;
    const enemyHalf = ENEMY_WIDTH * 0.5;
    const laneY = platform.y + platform.h;
    const leftX = platform.x + enemyHalf + 1;
    const rightX = platform.x + platform.w - enemyHalf - 1;
    const centerX = clamp(platform.x + platform.w * 0.5, leftX, rightX);
    const preferredXs = [centerX, leftX, rightX];
    for (let i = 0; i < preferredXs.length; i++) {
      const enemyX = preferredXs[i];
      if (!hasLaneEnemyGap(enemyX, laneY)) continue;
      pushEnemy(enemySpawns, {
        x: enemyX,
        y: laneY,
        minX: platform.x + enemyHalf,
        maxX: platform.x + platform.w - enemyHalf,
        lockPlatformPatrol: true,
        speed: randomInt(rng, 7, 10),
        dir: rng() < 0.5 ? -1 : 1,
      });
      break;
    }
  };

  const starterPlatformWidth = clamp(Math.floor(width * 0.12), 10, 16);
  let starterPlatform = createFlyingPlatform(safeLeft, starterPlatformWidth, 1);
  if (!starterPlatform) {
    starterPlatform = snapSolidToGrid({
      x: safeLeft,
      y: flyingRows[0],
      w: starterPlatformWidth,
      h: flyingPlatformHeight,
      type: 1,
    });
    if (solids.length < MAX_SOLIDS) {
      solids.push(starterPlatform);
    }
  }

  const starterPlatformY = starterPlatform.y;
  const starterPlatformHeight = starterPlatform.h;
  addPlatformCoins(
    coins,
    starterPlatform.x,
    starterPlatformY + starterPlatformHeight + 6,
    starterPlatform.w,
    2,
  );

  let cursorX = starterPlatform.x + starterPlatform.w;

  while (cursorX < safeRight - 18) {
    cursorX += randomInt(rng, PATH_MIN_GAP, PATH_MAX_GAP);
    if (cursorX >= safeRight - 18) {
      break;
    }

    const platformWidth = clamp(Math.floor(randomInt(rng, 10, Math.max(10, Math.floor(width * 0.16)))), 10, 24);
    const placed = createFlyingPlatform(cursorX, platformWidth, rng() < 0.5 ? 1 : 4);
    if (!placed) {
      continue;
    }

    addPlatformCoins(
      coins,
      placed.x,
      placed.y + placed.h + 6,
      placed.w,
      clamp(Math.floor(placed.w / 6), 1, 4),
    );
    tryPlacePlatformEnemy(placed, 0.95);
    cursorX += placed.w;
  }

  // Add upper fixed rows within the allowed flying band.
  for (let rowIndex = 1; rowIndex < flyingRows.length; rowIndex++) {
    const rowY = flyingRows[rowIndex];
    let rowCursor = safeLeft + randomInt(rng, 0, PATH_MAX_GAP);
    let placedInRow = 0;

    while (rowCursor < safeRight - 10) {
      const platformWidth = clamp(randomInt(rng, 8, 16), 8, 20);
      const placed = createFlyingPlatform(rowCursor, platformWidth, rng() < 0.5 ? 1 : 4, rowY);
      if (placed) {
        placedInRow += 1;
        addPlatformCoins(
          coins,
          placed.x,
          placed.y + placed.h + 6,
          placed.w,
          clamp(Math.floor(placed.w / 8), 1, 3),
        );
        tryPlacePlatformEnemy(placed, 0.75);
        rowCursor += placed.w + randomInt(rng, PATH_MIN_GAP, PATH_MAX_GAP + 4);
      } else {
        rowCursor += PLATFORM_GRID;
      }
    }

    // Guarantee at least one platform in every upper row.
    if (placedInRow === 0) {
      const guaranteedWidth = clamp(randomInt(rng, 10, 14), 10, 18);
      const anchors = [
        safeLeft + rowIndex * (PATH_MIN_GAP + 2),
        safeLeft + ((safeRight - safeLeft) * 0.35),
        safeLeft + ((safeRight - safeLeft) * 0.6),
      ];
      for (let i = 0; i < anchors.length; i++) {
        const placed = createFlyingPlatform(anchors[i], guaranteedWidth, rng() < 0.5 ? 1 : 4, rowY);
        if (!placed) continue;
        addPlatformCoins(
          coins,
          placed.x,
          placed.y + placed.h + 6,
          placed.w,
          clamp(Math.floor(placed.w / 8), 1, 2),
        );
        tryPlacePlatformEnemy(placed, 0.65);
        break;
      }
    }
  }

  const desiredStepHeight = Math.max(
    PLATFORM_GRID,
    snapToPlatformGrid(clamp(Math.floor((height - floorHeight) * 0.12), 4, 8)),
  );
  const maxTotalStairHeight = Math.max(PLATFORM_GRID, flyingRows[0] - floorHeight - minPlatformGap);
  const maxStepHeight = Math.max(PLATFORM_GRID, Math.floor(maxTotalStairHeight / stairCount / PLATFORM_GRID) * PLATFORM_GRID);
  const stepHeight = clamp(desiredStepHeight, PLATFORM_GRID, maxStepHeight);
  for (let i = 0; i < stairCount; i++) {
    pushSolid(solids, {
      x: stairStart + i * stepWidth,
      y: floorHeight,
      w: stepWidth,
      h: stepHeight * (i + 1),
      type: 3,
    });
  }
  addPlatformCoins(coins, stairStart, floorHeight + stepHeight * stairCount + 7, stairCount * stepWidth, stairCount);

  if (coins.length === 0) {
    pushCoin(coins, {
      x: safeLeft + starterPlatformWidth * 0.5,
      y: starterPlatformY + starterPlatformHeight + 6,
      r: DEFAULT_COIN_RADIUS,
    });
  }

  let walkerX = safeLeft + 4;
  while (walkerX < safeRight - 12) {
    if (rng() < 0.42) {
      pushEnemy(enemySpawns, {
        x: walkerX,
        y: floorHeight,
        minX: clamp(walkerX - randomInt(rng, 8, 16), 4, safeRight),
        maxX: clamp(walkerX + randomInt(rng, 8, 18), 8, safeRight),
        speed: randomInt(rng, 8, 12),
        dir: rng() < 0.5 ? -1 : 1,
      });
    }
    walkerX += randomInt(rng, 16, 28);
  }

  const filteredSolids = solids
    .sort(sortByX)
    .slice(0, MAX_SOLIDS);

  const filteredCoinCandidates = coins
    .filter((coin) =>
      coin.x > spawn.x + 8 &&
      coin.x < goal.x - 4 &&
      coin.y < height - 2 &&
      isCoinClearOfSolids(coin, filteredSolids),
    )
    .sort(sortByX);
  let filteredCoins = pickEvenlyDistributed(filteredCoinCandidates, STAGE_MAX_COLLECTIBLES);

  if (filteredCoins.length === 0) {
    const fallbackCoin = {
      x: safeLeft + starterPlatformWidth * 0.5,
      y: starterPlatformY + starterPlatformHeight + DEFAULT_COIN_RADIUS + COIN_PLATFORM_CLEARANCE + 1.5,
      r: DEFAULT_COIN_RADIUS,
    };
    if (isCoinClearOfSolids(fallbackCoin, filteredSolids)) {
      filteredCoins = [fallbackCoin];
    }
  }

  const minEnemyX = Math.max(
    spawn.x + 12,
    Math.min(goal.x - 12, Math.floor(width * FIRST_ENEMY_MIN_WORLD_RATIO)),
  );
  const targetEnemyCount = Math.min(MAX_ENEMIES, Math.max(0, Math.floor(width / 30)));
  const enemySpan = Math.max(0, goal.x - 12 - minEnemyX);
  const enemyMinSpacing = clamp(
    Math.floor(enemySpan / Math.max(2, targetEnemyCount + 1)),
    PLATFORM_GRID,
    12,
  );
  const enemyInitialCandidates = enemySpawns
    .filter((enemy) => enemy.x >= minEnemyX && enemy.x < goal.x - 12)
    .sort(sortByX)
    .map((enemy) => normalizeEnemyPatrolForHeadroom(enemy, filteredSolids))
    .filter((enemy) => enemy !== null);
  const platformEnemyCandidates = enemyInitialCandidates
    .filter((enemy) => enemy.lockPlatformPatrol)
    .sort(sortByX);
  const nonPlatformEnemyCandidates = enemyInitialCandidates
    .filter((enemy) => !enemy.lockPlatformPatrol)
    .sort(sortByX);
  let filteredEnemies = [];

  const tryAppendEnemy = (candidate, minSpacing = enemyMinSpacing) => {
    if (!candidate) return false;
    if (candidate.x < minEnemyX || candidate.x >= goal.x - 12) return false;
    const normalized = normalizeEnemyPatrolForHeadroom(candidate, filteredSolids);
    if (!normalized) return false;
    const requiredSpacing = Math.max(minSpacing, ENEMY_PLACEMENT_MIN_GAP);
    if (requiredSpacing > 0) {
      const tooClose = filteredEnemies.some((enemy) => {
        const sameLane = Math.abs(enemy.y - normalized.y) < PLATFORM_GRID;
        return sameLane && Math.abs(enemy.x - normalized.x) < requiredSpacing;
      });
      if (tooClose) return false;
    }
    filteredEnemies.push(normalized);
    return true;
  };

  const platformEnemyTarget = Math.min(
    platformEnemyCandidates.length,
    Math.max(1, Math.floor(targetEnemyCount * PLATFORM_ENEMY_TARGET_RATIO)),
  );
  for (let i = 0; i < platformEnemyCandidates.length && filteredEnemies.length < platformEnemyTarget; i++) {
    tryAppendEnemy(platformEnemyCandidates[i], enemyMinSpacing);
  }
  const seededEnemyCandidates = [...platformEnemyCandidates, ...nonPlatformEnemyCandidates];
  for (let i = 0; i < seededEnemyCandidates.length && filteredEnemies.length < targetEnemyCount; i++) {
    tryAppendEnemy(seededEnemyCandidates[i], enemyMinSpacing);
  }

  let attempts = 0;
  const maxAttempts = Math.max(60, targetEnemyCount * 80);
  while (filteredEnemies.length < targetEnemyCount && attempts < maxAttempts) {
    attempts += 1;
    const x = randomInt(rng, Math.floor(minEnemyX), Math.floor(goal.x - 16));
    const patrolHalf = randomInt(rng, 6, 14);
    tryAppendEnemy({
      x,
      y: floorHeight,
      minX: clamp(x - patrolHalf, 4, safeRight),
      maxX: clamp(x + patrolHalf, 8, safeRight),
      speed: randomInt(rng, 8, 12),
      dir: rng() < 0.5 ? -1 : 1,
    }, enemyMinSpacing);
  }

  const relaxedMinSpacing = Math.max(2, Math.floor(enemyMinSpacing * 0.66));
  for (let i = 0; i < targetEnemyCount && filteredEnemies.length < targetEnemyCount; i++) {
    const anchorRatio = (i + 0.5) / Math.max(1, targetEnemyCount);
    const anchorX = minEnemyX + enemySpan * anchorRatio;
    const jitter = Math.max(1, Math.floor(enemyMinSpacing * 0.4));
    const x = clamp(
      snapToPlatformGrid(Math.round(anchorX + randomInt(rng, -jitter, jitter))),
      Math.floor(minEnemyX),
      Math.floor(goal.x - 16),
    );
    const patrolHalf = randomInt(rng, 6, 14);
    tryAppendEnemy({
      x,
      y: floorHeight,
      minX: clamp(x - patrolHalf, 4, safeRight),
      maxX: clamp(x + patrolHalf, 8, safeRight),
      speed: randomInt(rng, 8, 12),
      dir: rng() < 0.5 ? -1 : 1,
    }, relaxedMinSpacing);
  }

  for (
    let x = snapToPlatformGrid(Math.floor(minEnemyX));
    filteredEnemies.length < targetEnemyCount && x < goal.x - 12;
    x += PLATFORM_GRID
  ) {
    tryAppendEnemy({
      x,
      y: floorHeight,
      minX: clamp(x - 4, 4, safeRight),
      maxX: clamp(x + 4, 8, safeRight),
      speed: randomInt(rng, 8, 12),
      dir: rng() < 0.5 ? -1 : 1,
    }, relaxedMinSpacing);
  }

  filteredEnemies = filteredEnemies
    .sort(sortByX)
    .slice(0, targetEnemyCount);

  world.width = width;
  world.height = height;
  world.seed = seed;
  world.floorHeight = floorHeight;
  world.solids = filteredSolids;
  world.enemySpawns = filteredEnemies;
  world.coins = filteredCoins;
  world.spawn = spawn;
  world.goal = goal;
};

const regenerateMap = (width = world.width, height = world.height) => {
  generateLevel(width, height, createRandomSeed());
};

const container = ref(null);
const hudScoreValue = ref(0);
const hudCoinsValue = ref(0);
const hudLivesValue = ref(3);
const hudTimerValue = ref(95);
const hudStateValue = ref("RUN");
const hudEnemiesValue = ref(0);

const hudScore = computed(() => Math.max(0, Math.floor(hudScoreValue.value)).toString().padStart(6, "0"));
const hudCoins = computed(() => Math.max(0, Math.floor(hudCoinsValue.value)).toString().padStart(2, "0"));
const hudLives = computed(() => Math.max(0, Math.floor(hudLivesValue.value)).toString().padStart(2, "0"));
const hudTimer = computed(() => Math.max(0, Math.floor(hudTimerValue.value)).toString().padStart(3, "0"));
const hudState = computed(() => hudStateValue.value);
const hudEnemies = computed(() => Math.max(0, Math.floor(hudEnemiesValue.value)).toString().padStart(2, "0"));

const input = {
  left: false,
  right: false,
  jumpHeld: false,
  jumpQueued: 0,
};

const run = {
  score: 0,
  coins: 0,
  coinsInStage: 0,
  collectedInStage: 0,
  doorUnlocked: false,
  lives: 3,
  timer: 95,
  phase: PHASE_PLAYING,
  phaseTimer: 0,
  stagePulse: 0,
  regenerateOnRespawn: false,
};

const player = createPlayer();
let enemies = [];
let coins = [];

let spriteCamera;
let spriteScene;
let renderer;
let heroSprite;
let heroMaterial;
let heroTextures = new Map();
let goalSprite;
let goalMaterial;
let goalTexture;
let coinTexture;
let coinMaterial;
let coinSprites = [];
let platformTextures = {};
let platformMaterials = {};
let platformSprites = [];
let enemyTextures = [];
let enemyMaterials = [];
let enemySprites = [];
let frameId = null;
let previousTimeMs = 0;
const canvasSize = {
  width: 1,
  height: 1,
};
const viewport = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

const syncHud = () => {
  hudScoreValue.value = run.score;
  hudCoinsValue.value = run.coins;
  hudLivesValue.value = run.lives;
  hudTimerValue.value = run.timer;
  hudEnemiesValue.value = enemies.filter((enemy) => enemy.alive).length;
  hudStateValue.value = run.phase === PHASE_CLEAR
    ? "CLEAR"
    : run.phase === PHASE_DEAD
      ? "RESPAWN"
      : run.doorUnlocked
        ? "DOOR OPEN"
        : "COLLECT";
};

const resetPlayer = () => {
  player.x = world.spawn.x;
  player.y = world.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = false;
  player.coyote = 0;
  player.invulnerable = 0;
  player.anim = 0;
  player.prevY = world.spawn.y;
  player.turnTimer = 0;
};

const resetLevel = () => {
  run.timer = clamp(Math.round(world.width * 0.55), 90, 180);
  run.phase = PHASE_PLAYING;
  run.phaseTimer = 0;
  run.stagePulse = 0;
  run.regenerateOnRespawn = false;
  resetPlayer();
  enemies = world.enemySpawns.map(createEnemy);
  coins = world.coins.map(createCoin);
  run.coinsInStage = coins.length;
  run.collectedInStage = 0;
  run.doorUnlocked = run.coinsInStage === 0;
  syncHud();
};

const resetRun = () => {
  run.score = 0;
  run.coins = 0;
  run.lives = 3;
  run.coinsInStage = 0;
  run.collectedInStage = 0;
  run.doorUnlocked = false;
  run.regenerateOnRespawn = false;
  resetLevel();
};

const preservePlayerAfterResize = () => {
  player.x = clamp(player.x, player.w * 0.5, world.width - player.w * 0.5);
  player.y = clamp(player.y, 0, Math.max(0, world.height - player.h));

  for (let i = 0; i < world.solids.length; i++) {
    const solid = world.solids[i];
    const rect = bodyRect(player);
    if (!overlap(rect, solid)) continue;
    player.y = solid.y + solid.h;
  }

  player.grounded = solidSupportBelow(player, 1.25);
  if (player.grounded) {
    player.vy = Math.max(0, player.vy);
  }
};

const regenerateWorld = (widthPx, heightPx, resetProgress = false) => {
  const nextWidth = Math.max(MIN_WORLD_WIDTH, Math.floor(widthPx / BASE_PIXEL_SCALE));
  const nextHeight = Math.max(MIN_WORLD_HEIGHT, Math.floor(heightPx / BASE_PIXEL_SCALE));
  const changed = nextWidth !== world.width || nextHeight !== world.height;
  if (!changed) return;

  const preservedPlayer = {
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    grounded: player.grounded,
    coyote: player.coyote,
    invulnerable: player.invulnerable,
    anim: player.anim,
    prevY: player.prevY,
    facing: player.facing,
    turnTimer: player.turnTimer,
  };

  generateLevel(nextWidth, nextHeight, world.seed);
  if (resetProgress) {
    resetRun();
  } else {
    player.x = preservedPlayer.x;
    player.y = preservedPlayer.y;
    player.vx = preservedPlayer.vx;
    player.vy = preservedPlayer.vy;
    player.grounded = preservedPlayer.grounded;
    player.coyote = preservedPlayer.coyote;
    player.invulnerable = preservedPlayer.invulnerable;
    player.anim = preservedPlayer.anim;
    player.prevY = preservedPlayer.prevY;
    player.facing = preservedPlayer.facing;
    player.turnTimer = preservedPlayer.turnTimer;
    enemies = world.enemySpawns.map(createEnemy);
    coins = world.coins.map(createCoin);
    run.coinsInStage = coins.length;
    run.collectedInStage = 0;
    run.doorUnlocked = run.coinsInStage === 0;
    preservePlayerAfterResize();
    syncHud();
  }
};

const takeLife = () => {
  if (run.phase !== PHASE_PLAYING) return;
  run.phase = PHASE_DEAD;
  run.phaseTimer = 1.15;
  player.invulnerable = 1.25;
  player.vx = 0;
  player.vy = 28;
  run.lives -= 1;
  run.regenerateOnRespawn = run.lives <= 0;
  syncHud();
};

const clearStage = () => {
  if (run.phase !== PHASE_PLAYING) return;
  run.phase = PHASE_CLEAR;
  run.phaseTimer = 2.8;
  run.score += 1000 + Math.floor(run.timer * 10);
  syncHud();
};

const solidSupportBelow = (body, probe = 1.5) => {
  const rect = {
    x: body.x - body.w * 0.5 + 0.35,
    y: body.y - probe,
    w: body.w - 0.7,
    h: probe,
  };
  return world.solids.some((solid) => overlap(rect, solid));
};

const moveBody = (body, delta) => {
  let hitX = false;

  body.x += body.vx * delta;
  let rect = bodyRect(body);
  for (let i = 0; i < world.solids.length; i++) {
    const solid = world.solids[i];
    if (!overlap(rect, solid)) continue;
    if (body.vx > 0) {
      body.x = solid.x - body.w * 0.5;
      hitX = true;
    } else if (body.vx < 0) {
      body.x = solid.x + solid.w + body.w * 0.5;
      hitX = true;
    }
    body.vx = 0;
    rect = bodyRect(body);
  }

  body.y += body.vy * delta;
  body.grounded = false;
  rect = bodyRect(body);
  for (let i = 0; i < world.solids.length; i++) {
    const solid = world.solids[i];
    if (!overlap(rect, solid)) continue;
    if (body.vy < 0) {
      body.y = solid.y + solid.h;
      body.grounded = true;
    } else if (body.vy > 0) {
      body.y = solid.y - body.h;
    }
    body.vy = 0;
    rect = bodyRect(body);
  }

  if (body.x - body.w * 0.5 < 0) {
    body.x = body.w * 0.5;
    body.vx = 0;
    hitX = true;
  }
  if (body.x + body.w * 0.5 > world.width) {
    body.x = world.width - body.w * 0.5;
    body.vx = 0;
    hitX = true;
  }

  return { hitX };
};

const collectCoins = () => {
  const playerHitbox = bodyRect(player);
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    if (coin.collected) continue;
    const hitbox = spriteRect(coin.x, coin.y - coin.r, coin.r * 2, coin.r * 2);
    if (!overlap(playerHitbox, hitbox)) continue;
    coin.collected = true;
    run.score += 100;
    run.coins += 1;
    run.collectedInStage += 1;
    if (run.collectedInStage >= run.coinsInStage) {
      run.doorUnlocked = true;
    }
    if (run.coins > 0 && run.coins % 10 === 0) {
      run.lives += 1;
    }
    syncHud();
  }
};

const goalHitbox = () => ({
  x: world.goal.x - 2.2,
  y: world.goal.y,
  w: 4.4,
  h: world.goal.h,
});

const stompEnemy = (enemy) => {
  enemy.alive = false;
  enemy.vx = 0;
  enemy.vy = 0;
  player.vy = PLAYER.stompBounce;
  player.grounded = false;
  player.coyote = 0;
  run.score += 200;
  syncHud();
};

const resolveEnemyCollisions = () => {
  const playerHitbox = bodyRect(player);
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    const enemyHitbox = bodyRect(enemy);
    if (!overlap(playerHitbox, enemyHitbox)) continue;
    const playerWasAbove = player.prevY >= enemy.y + enemy.h - 1.2;
    if (player.vy < -16 && playerWasAbove) {
      stompEnemy(enemy);
    } else if (player.invulnerable <= 0) {
      takeLife();
    }
  }
};

const stepEnemies = (delta) => {
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    enemy.anim += delta * 5;
    enemy.vx = enemy.dir * enemy.speed;
    enemy.vy = Math.max(enemy.vy + PLAYER.gravity * delta, -82);
    const moved = moveBody(enemy, delta);
    if (moved.hitX || enemy.x <= enemy.minX || enemy.x >= enemy.maxX || !solidSupportBelow(enemy, 1.25)) {
      enemy.dir *= -1;
      enemy.vx = enemy.dir * enemy.speed;
      enemy.x = clamp(enemy.x, enemy.minX, enemy.maxX);
    }
  }
};

const stepPlayer = (delta) => {
  const moveInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const targetSpeed = moveInput * PLAYER.maxSpeed;
  const accel = player.grounded ? PLAYER.groundAccel : PLAYER.airAccel;

  player.prevY = player.y;
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  player.anim += delta * (Math.abs(player.vx) * 0.22 + 1.2);
  player.turnTimer = Math.max(0, player.turnTimer - delta);
  run.stagePulse = approach(run.stagePulse, run.phase === PHASE_CLEAR ? 1 : 0, delta * 1.6);

  if (run.phase === PHASE_PLAYING) {
    if (moveInput !== 0) {
      player.vx = approach(player.vx, targetSpeed, accel * delta);
      const nextFacing = moveInput > 0 ? 1 : -1;
      if (nextFacing !== player.facing) {
        player.turnTimer = HERO_TURN_DURATION;
      }
      player.facing = nextFacing;
    } else if (player.grounded) {
      player.vx = approach(player.vx, 0, PLAYER.friction * delta);
    } else {
      player.vx = approach(player.vx, 0, PLAYER.airAccel * 0.3 * delta);
    }
  } else if (run.phase === PHASE_CLEAR) {
    player.vx = approach(player.vx, 14, PLAYER.groundAccel * delta);
    player.facing = 1;
  } else {
    player.vx = approach(player.vx, 0, PLAYER.friction * delta);
  }

  if (run.phase === PHASE_PLAYING) {
    input.jumpQueued = Math.max(0, input.jumpQueued - delta);
    if (input.jumpQueued > 0 && (player.grounded || player.coyote > 0)) {
      player.vy = PLAYER.jumpVelocity;
      player.grounded = false;
      player.coyote = 0;
      input.jumpQueued = 0;
    }
  } else {
    input.jumpQueued = 0;
  }

  const gravity = player.vy > 0
    ? (input.jumpHeld ? PLAYER.jumpGravityHeld : PLAYER.jumpGravityReleased)
    : PLAYER.fallGravity;
  player.vy = Math.max(player.vy + gravity * delta, PLAYER.maxFallSpeed);
  moveBody(player, delta);
  if (player.grounded) {
    player.coyote = PLAYER.coyoteTime;
  } else {
    player.coyote = Math.max(0, player.coyote - delta);
  }

  if (run.phase === PHASE_PLAYING) {
    collectCoins();
    resolveEnemyCollisions();
    if (run.doorUnlocked && overlap(bodyRect(player), goalHitbox())) {
      clearStage();
    }
    if (player.y < -18 || run.timer <= 0) {
      takeLife();
    }
  }
};

const stepPhase = (delta) => {
  if (run.phase === PHASE_PLAYING) {
    run.timer = Math.max(0, run.timer - delta);
    return;
  }

  run.phaseTimer -= delta;
  if (run.phaseTimer > 0) return;

  if (run.phase === PHASE_CLEAR) {
    regenerateMap();
    resetLevel();
    return;
  }

  if (run.regenerateOnRespawn) {
    regenerateMap();
    resetRun();
  } else {
    resetLevel();
  }
};

const stepGame = (delta) => {
  stepPlayer(delta);
  if (run.phase !== PHASE_DEAD) {
    stepEnemies(delta);
  } else {
    for (let i = 0; i < enemies.length; i++) {
      enemies[i].anim += delta * 2.2;
    }
  }
  stepPhase(delta);
  syncHud();
};

const getHeroAnimationName = () => {
  if (run.phase === PHASE_DEAD) return "death";
  if (run.phase === PHASE_CLEAR) return "clear";
  if (player.invulnerable > 0.9) return "hurt";
  if (player.turnTimer > 0) return "turn";
  if (!player.grounded) return player.vy > 0 ? "jump" : "fall";
  if (player.grounded && Math.abs(player.vx) > 4) return "run";
  return "idle";
};

const getHeroFrameIndex = (animationName) => {
  const animation = getHeroAnimation(animationName);
  if (!animation || animation.frames <= 1) return 0;

  if (animationName === "turn") {
    const progress = clamp(1 - player.turnTimer / HERO_TURN_DURATION, 0, 0.9999);
    return Math.min(animation.frames - 1, Math.floor(progress * animation.frames));
  }

  if (animationName === "death") {
    const deathElapsed = Math.max(0, 1.15 - run.phaseTimer);
    return Math.min(animation.frames - 1, Math.floor(deathElapsed * animation.fps));
  }

  return Math.floor(player.anim) % animation.frames;
};

const createPixelTexture = (src) => {
  const texture = new THREE.TextureLoader().load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

const applyTextureCrop = (texture, crop) => {
  texture.repeat.set(crop.w, crop.h);
  texture.offset.set(crop.x, 1 - crop.y - crop.h);
  texture.needsUpdate = true;
};

const toBottomAnchoredY = (topPx, heightPx) => canvasSize.height - topPx - heightPx;
const toCenteredY = (topPx, heightPx) => canvasSize.height - topPx - heightPx * 0.5;

const getHeroTexture = (src) => {
  if (!heroTextures.has(src)) {
    heroTextures.set(src, createPixelTexture(src));
  }
  return heroTextures.get(src);
};

const ensureHeroSprite = () => {
  if (heroSprite || !spriteScene || !heroMaterial) return;
  heroSprite = new THREE.Sprite(heroMaterial);
  heroSprite.center.set(0.5, 0.0);
  heroSprite.renderOrder = 20;
  spriteScene.add(heroSprite);
};

const ensureGoalSprite = () => {
  if (goalSprite || !spriteScene || !goalMaterial) return;
  goalSprite = new THREE.Sprite(goalMaterial);
  goalSprite.center.set(0.5, 0.0);
  goalSprite.renderOrder = 18;
  goalSprite.visible = false;
  spriteScene.add(goalSprite);
};

const ensureCoinSprites = () => {
  if (!spriteScene || !coinMaterial) return;
  while (coinSprites.length < MAX_COINS) {
    const sprite = new THREE.Sprite(coinMaterial);
    sprite.center.set(0.5, 0.5);
    sprite.visible = false;
    sprite.renderOrder = 12;
    coinSprites.push(sprite);
    spriteScene.add(sprite);
  }
};

const ensurePlatformSprites = () => {
  if (!spriteScene) return;
  while (platformSprites.length < MAX_SOLIDS) {
    const sprite = new THREE.Sprite(platformMaterials.center);
    sprite.center.set(0.5, 0.0);
    sprite.visible = false;
    sprite.renderOrder = 8;
    platformSprites.push(sprite);
    spriteScene.add(sprite);
  }
};

const ensureEnemySprites = () => {
  if (!spriteScene) return;

  while (enemySprites.length < MAX_ENEMIES) {
    const sprite = new THREE.Sprite(enemyMaterials[0]);
    sprite.center.set(0.5, 0.0);
    sprite.visible = false;
    sprite.renderOrder = 10;
    enemySprites.push(sprite);
    spriteScene.add(sprite);
  }
};

const syncHeroSprite = (time) => {
  ensureHeroSprite();
  if (!heroSprite || !heroMaterial) return;

  const animationName = getHeroAnimationName();
  const animation = getHeroAnimation(animationName);
  const frameIndex = getHeroFrameIndex(animationName);
  const frameColumn = frameIndex % animation.columns;
  const frameRow = Math.floor(frameIndex / animation.columns);
  const sizePx = HERO_WORLD_SIZE * BASE_PIXEL_SCALE;
  const blinkHidden = player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
  const facingKey = player.facing > 0 ? "right" : "left";
  const spriteSrc = animation.srcByFacing?.[facingKey] ?? animation.srcByFacing?.left ?? animation.src;
  const mirrorFacing = animation.mirrorByFacing?.[facingKey] ?? (animation.mirror && player.facing > 0);
  const frameOffset = animation.frameOffsets?.[frameIndex] ?? animation.frameOffsets?.[0] ?? { x: 0, y: 0 };
  const offsetX = (mirrorFacing ? -frameOffset.x : frameOffset.x) * BASE_PIXEL_SCALE;
  const offsetY = frameOffset.y * BASE_PIXEL_SCALE;
  const texture = getHeroTexture(spriteSrc);

  texture.repeat.set(1 / animation.columns, 1 / animation.rows);
  texture.offset.set(frameColumn / animation.columns, 1 - ((frameRow + 1) / animation.rows));
  heroMaterial.map = texture;
  heroMaterial.needsUpdate = true;
  heroSprite.visible = !blinkHidden;
  const left = viewport.x + (player.x - HERO_WORLD_SIZE * 0.5) * BASE_PIXEL_SCALE + offsetX;
  const top = viewport.y + viewport.height - (player.y + HERO_WORLD_SIZE) * BASE_PIXEL_SCALE + offsetY + HERO_SCREEN_OFFSET_Y;
  heroSprite.position.set(
    left + sizePx * 0.5,
    toBottomAnchoredY(top, sizePx),
    0,
  );
  heroSprite.scale.set(mirrorFacing ? -sizePx : sizePx, sizePx, 1);
};

const syncCoinSprites = (time) => {
  ensureCoinSprites();
  const sizePx = COIN_WORLD_SIZE * BASE_PIXEL_SCALE;

  for (let i = 0; i < coinSprites.length; i++) {
    const sprite = coinSprites[i];
    const coin = coins[i];
    if (!sprite || !coin || coin.collected) {
      if (sprite) sprite.visible = false;
      continue;
    }

    const bobOffset = Math.sin(time * 3.4 + coin.phase) * 0.35;
    const spinPhase = time * 4.5 + coin.phase * 1.4;
    const spinScale = Math.max(0.16, Math.abs(Math.sin(spinPhase)));
    const left = viewport.x + (coin.x - COIN_WORLD_SIZE * 0.5) * BASE_PIXEL_SCALE;
    const top = viewport.y + viewport.height - (coin.y + COIN_WORLD_SIZE * 0.5 + bobOffset) * BASE_PIXEL_SCALE;
    sprite.visible = true;
    sprite.position.set(
      left + sizePx * 0.5,
      toCenteredY(top, sizePx),
      0,
    );
    sprite.scale.set(sizePx * spinScale, sizePx, 1);
  }
};

const syncEnemySprites = (time) => {
  ensureEnemySprites();
  const sizePx = ENEMY_HEIGHT * BASE_PIXEL_SCALE;

  for (let i = 0; i < enemySprites.length; i++) {
    const sprite = enemySprites[i];
    const enemy = enemies[i];
    if (!sprite || !enemy || !enemy.alive) {
      if (sprite) sprite.visible = false;
      continue;
    }

    const frameIndex = Math.floor(enemy.anim * 0.7) % enemyMaterials.length;
    const bobOffset = Math.sin(time * 8 + enemy.x * 0.3) * 0.35;
    const left = viewport.x + (enemy.x - enemy.w * 0.5) * BASE_PIXEL_SCALE - 2;
    const top = viewport.y + viewport.height - (enemy.y + enemy.h + bobOffset) * BASE_PIXEL_SCALE - 4;
    sprite.visible = true;
    sprite.material = enemyMaterials[frameIndex];
    sprite.position.set(
      left + sizePx * 0.5,
      toBottomAnchoredY(top, sizePx),
      0,
    );
    sprite.scale.set(enemy.dir > 0 ? -sizePx : sizePx, sizePx, 1);
  }
};

const syncPlatformSprites = () => {
  ensurePlatformSprites();

  for (let i = 0; i < platformSprites.length; i++) {
    const sprite = platformSprites[i];
    const solid = world.solids[i];
    if (!sprite || !solid) {
      if (sprite) sprite.visible = false;
      continue;
    }

    const widthPx = solid.w * BASE_PIXEL_SCALE;
    const heightPx = solid.h * BASE_PIXEL_SCALE;
    const textureKey = solid.type === 0 ? "wall" : solid.type === 3 ? "stair" : "center";
    const left = viewport.x + solid.x * BASE_PIXEL_SCALE;
    const top = viewport.y + viewport.height - (solid.y + solid.h) * BASE_PIXEL_SCALE;
    sprite.visible = true;
    sprite.material = platformMaterials[textureKey];
    sprite.position.set(
      left + widthPx * 0.5,
      toBottomAnchoredY(top, heightPx),
      0,
    );
    sprite.scale.set(widthPx, heightPx, 1);
  }
};

const syncGoalSprite = (time) => {
  ensureGoalSprite();
  if (!goalSprite || !goalMaterial) return;

  const pulse = run.doorUnlocked ? 1 + Math.sin(time * 3.2) * 0.04 : 0.9;
  const widthPx = 48 * pulse;
  const heightPx = 64 * pulse;
  const left = viewport.x + world.goal.x * BASE_PIXEL_SCALE - widthPx * 0.5;
  const top = viewport.y + viewport.height - (world.goal.y + heightPx / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE;
  goalSprite.visible = run.doorUnlocked;
  goalSprite.position.set(
    left + widthPx * 0.5,
    toBottomAnchoredY(top, heightPx),
    0,
  );
  goalSprite.scale.set(widthPx, heightPx, 1);
};

const syncSceneSprites = (time) => {
  syncPlatformSprites();
  syncGoalSprite(time);
  syncEnemySprites(time);
  syncCoinSprites(time);
  syncHeroSprite(time);
};

const onResize = () => {
  if (!container.value || !renderer) return;
  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));
  const viewportWidth = Math.max(BASE_PIXEL_SCALE, Math.floor(width / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE);
  const viewportHeight = Math.max(BASE_PIXEL_SCALE, Math.floor(height / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE);
  const viewportX = Math.floor((width - viewportWidth) * 0.5);
  const viewportY = Math.floor((height - viewportHeight) * 0.5);
  viewport.x = viewportX;
  viewport.y = viewportY;
  viewport.width = viewportWidth;
  viewport.height = viewportHeight;
  canvasSize.width = width;
  canvasSize.height = height;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  if (spriteCamera) {
    spriteCamera.left = 0;
    spriteCamera.right = width;
    spriteCamera.top = height;
    spriteCamera.bottom = 0;
    spriteCamera.updateProjectionMatrix();
  }
  regenerateWorld(viewportWidth, viewportHeight, false);
};

const ignoreKey = (event) => {
  const target = event.target;
  if (!target) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

const setKey = (code, value) => {
  if (code === "KeyA" || code === "ArrowLeft") {
    input.left = value;
    return true;
  }
  if (code === "KeyD" || code === "ArrowRight") {
    input.right = value;
    return true;
  }
  if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
    if (value && !input.jumpHeld) {
      input.jumpQueued = PLAYER.jumpBuffer;
    }
    if (!value && input.jumpHeld && player.vy > PLAYER.jumpReleaseVelocity) {
      player.vy = PLAYER.jumpReleaseVelocity;
    }
    input.jumpHeld = value;
    return true;
  }
  if (value && code === "KeyR") {
    regenerateMap();
    resetRun();
    return true;
  }
  return false;
};

const onKeyDown = (event) => {
  if (ignoreKey(event)) return;
  if (setKey(event.code, true)) {
    event.preventDefault();
  }
};

const onKeyUp = (event) => {
  if (setKey(event.code, false)) {
    event.preventDefault();
  }
};

const clearInput = () => {
  input.left = false;
  input.right = false;
  input.jumpHeld = false;
  input.jumpQueued = 0;
};

const initGL = async () => {
  spriteScene = new THREE.Scene();
  spriteCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  spriteCamera.position.z = 1;
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x030604, 1);
  renderer.domElement.classList.add("fit");
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "1";
  container.value.appendChild(renderer.domElement);
  heroMaterial = new THREE.SpriteMaterial({ transparent: true });
  goalTexture = createPixelTexture(portalFrame);
  goalMaterial = new THREE.SpriteMaterial({ map: goalTexture, transparent: true });
  coinTexture = createPixelTexture(coinGoldSprite);
  coinMaterial = new THREE.SpriteMaterial({ map: coinTexture, transparent: true });
  platformTextures = {
    center: createPixelTexture(platformCenterSprite),
    wall: createPixelTexture(platformWallSprite),
    stair: createPixelTexture(platformStairSprite),
  };
  applyTextureCrop(platformTextures.center, PLATFORM_CENTER_CROP);
  applyTextureCrop(platformTextures.wall, PLATFORM_WALL_CROP);
  applyTextureCrop(platformTextures.stair, PLATFORM_STAIR_CROP);
  platformMaterials = {
    center: new THREE.SpriteMaterial({ map: platformTextures.center, transparent: true }),
    wall: new THREE.SpriteMaterial({ map: platformTextures.wall, transparent: true }),
    stair: new THREE.SpriteMaterial({ map: platformTextures.stair, transparent: true }),
  };
  enemyTextures = [
    createPixelTexture(enemyWalkFrame0),
    createPixelTexture(enemyWalkFrame1),
  ];
  enemyMaterials = enemyTextures.map((texture) => new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  }));
  ensureHeroSprite();
  ensureGoalSprite();
  ensureCoinSprites();
  ensurePlatformSprites();
  ensureEnemySprites();

  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));
  const viewportWidth = Math.max(BASE_PIXEL_SCALE, Math.floor(width / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE);
  const viewportHeight = Math.max(BASE_PIXEL_SCALE, Math.floor(height / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE);
  regenerateMap(
    Math.max(MIN_WORLD_WIDTH, Math.floor(viewportWidth / BASE_PIXEL_SCALE)),
    Math.max(MIN_WORLD_HEIGHT, Math.floor(viewportHeight / BASE_PIXEL_SCALE)),
  );
  resetRun();
  onResize();

  previousTimeMs = performance.now();
  const animate = (nowMs) => {
    const delta = clamp((nowMs - previousTimeMs) / 1000, 0, 1 / 24);
    previousTimeMs = nowMs;
    stepGame(delta);
    syncSceneSprites(nowMs * 0.001);
    renderer.clear();
    renderer.render(spriteScene, spriteCamera);
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
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", clearInput);

  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  if (heroSprite?.parent) heroSprite.parent.remove(heroSprite);
  if (goalSprite?.parent) goalSprite.parent.remove(goalSprite);
  coinSprites.forEach((sprite) => {
    if (sprite.parent) sprite.parent.remove(sprite);
  });
  platformSprites.forEach((sprite) => {
    if (sprite.parent) sprite.parent.remove(sprite);
  });
  enemySprites.forEach((sprite) => {
    if (sprite.parent) sprite.parent.remove(sprite);
  });
  heroMaterial?.dispose();
  goalMaterial?.dispose();
  goalTexture?.dispose();
  coinMaterial?.dispose();
  coinTexture?.dispose();
  for (const texture of heroTextures.values()) {
    texture.dispose();
  }
  Object.values(platformMaterials).forEach((spriteMaterial) => spriteMaterial.dispose());
  Object.values(platformTextures).forEach((texture) => texture.dispose());
  enemyMaterials.forEach((spriteMaterial) => spriteMaterial.dispose());
  enemyTextures.forEach((texture) => texture.dispose());
  if (renderer) {
    renderer.dispose();
    if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
});
</script>
