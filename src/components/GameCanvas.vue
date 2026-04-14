<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent></div>
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

</style>

<script setup>
import { List } from "@pixi/ui";
import { Application, Container, Graphics, Text } from "pixi.js";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { dom } from "quasar";
import { getHeroAnimation } from "assets/game/sprites/hero-sprite-registry";
import { CoinGameObject } from "src/game-objects/collectibles/CoinGameObject";
import { DebugGridGameObject } from "src/game-objects/debug/DebugGridGameObject";
import { EnemyGameObject } from "src/game-objects/enemy/EnemyGameObject";
import { HeroGameObject } from "src/game-objects/hero/HeroGameObject";
import { GameUiRowGameObject } from "src/game-objects/ui/GameUiRowGameObject";
import { LoadingBarGameObject } from "src/game-objects/ui/LoadingBarGameObject";
import { GoalGameObject } from "src/game-objects/world/GoalGameObject";
import { GroundSolidGameObject } from "src/game-objects/world/GroundSolidGameObject";
import { PlatformSolidGameObject } from "src/game-objects/world/PlatformSolidGameObject";
import { MarioLikeMapGenerator } from "src/strategies/map-generators/MarioLikeMapGenerator";

const BASE_PIXEL_SCALE = 8;
const MIN_WORLD_WIDTH = 1;
const MIN_WORLD_HEIGHT = 1;
const MAX_SOLIDS = 64;
const MAX_ENEMIES = 40;
const MAX_COINS = 40;
const STAGE_MAX_COLLECTIBLES = 10;
const GAME_HINT_TEXT = "A / D OR ARROWS MOVE · SPACE / W / UP JUMP · R RESET · G REGEN · F3 GRID DEBUG";
const PHASE_PLAYING = 0;
const PHASE_DEAD = 1;
const PHASE_CLEAR = 2;
const PLATFORM_GRID = 4;
const HERO_WORLD_SIZE = 16;
const COIN_WORLD_SIZE = PLATFORM_GRID;
const HERO_TURN_DURATION = 0.34;
const HERO_SCREEN_OFFSET_Y = 5;
const LOADER_GAME_OBJECT_TYPES = [
  HeroGameObject,
  EnemyGameObject,
  CoinGameObject,
  GoalGameObject,
  GroundSolidGameObject,
  PlatformSolidGameObject,
  DebugGridGameObject,
  GameUiRowGameObject,
  LoadingBarGameObject,
];

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

const createPlayer = () => new HeroGameObject({
  w: PLAYER.width,
  h: PLAYER.height,
  turnDuration: HERO_TURN_DURATION,
});

const createEnemy = (spawn) => new EnemyGameObject({
  ...spawn,
}, {
  width: ENEMY_WIDTH,
  height: ENEMY_HEIGHT,
});

const createCoin = (coin) => new CoinGameObject({
  ...coin,
});
const createGoal = (goalData) => new GoalGameObject({
  ...goalData,
});
const createSolid = (solid) => (
  solid.kind === "wall"
    ? new GroundSolidGameObject({ ...solid })
    : new PlatformSolidGameObject({ ...solid })
);

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
const mapGenerator = new MarioLikeMapGenerator({
  MIN_WORLD_WIDTH,
  MIN_WORLD_HEIGHT,
  PLATFORM_GRID,
  MAX_SOLIDS,
  MAX_ENEMIES,
  MAX_COINS,
  STAGE_MAX_COLLECTIBLES,
  PLAYER,
  ENEMY_WIDTH,
  ENEMY_HEIGHT,
  ENEMY_STOMP_HEADROOM,
  FIRST_ENEMY_MIN_WORLD_RATIO,
  DEFAULT_COIN_RADIUS,
  COIN_MIN_SEPARATION,
  COIN_PLATFORM_CLEARANCE,
  ENEMY_PLACEMENT_MIN_GAP,
  PLATFORM_ENEMY_TARGET_RATIO,
  FLYING_ROW_CLEARANCE,
  PATH_MIN_GAP,
  PATH_MAX_GAP,
  clamp,
  snapToPlatformGrid,
  createRng,
  randomInt,
  sortByX,
  overlap,
  spriteRect,
});

const generateLevel = (nextWidth, nextHeight, seed = world.seed) => {
  for (let i = 0; i < world.solids.length; i++) {
    world.solids[i]?.detachSprite?.({ destroy: true });
  }
  goal?.detachSprite?.({ destroy: true });
  const generated = mapGenerator.generate(nextWidth, nextHeight, seed);
  generated.solids = generated.solids.map(createSolid);
  Object.assign(world, generated);
  goal = createGoal(world.goal);
  attachGoalSprite();
  invalidatePlatformSprites();
  attachSolidSprites();
  syncSceneSprites(debugGrid.enabled ? debugGrid.frozenTime : performance.now() * 0.001);
};

const regenerateMap = (width = world.width, height = world.height) => {
  generateLevel(width, height, createRandomSeed());
};

const regenerateMapWithLoading = async ({
  label = "Generating Stage",
  width = world.width,
  height = world.height,
  onComplete = null,
} = {}) => {
  setLoadingState(label, 0.1);
  await waitForPaint();
  regenerateMap(width, height);
  setLoadingState(label, 0.75);
  if (typeof onComplete === "function") {
    onComplete();
  }
  flushPlatformSprites();
  syncSceneSprites(debugGrid.enabled ? debugGrid.frozenTime : performance.now() * 0.001);
  setLoadingState(label, 1);
  await waitForPaint();
  hideLoadingState();
};

const container = ref(null);
const loadingState = ref({
  visible: true,
  label: "Loading Game",
  progress: 0,
});

const formatScore = (value) => Math.max(0, Math.floor(value)).toString().padStart(6, "0");
const formatCounter = (value, pad = 2) => Math.max(0, Math.floor(value)).toString().padStart(pad, "0");
const getHudStateLabel = () => (
  run.phase === PHASE_CLEAR
    ? "CLEAR"
    : run.phase === PHASE_DEAD
      ? "RESPAWN"
      : run.doorUnlocked
        ? "DOOR OPEN"
        : "COLLECT"
);
const getLoadingProgressPercent = () => Math.round(clamp(loadingState.value.progress, 0, 1) * 100);
const getLoadingProgressText = () => `${getLoadingProgressPercent()}%`;
const getHudPrimaryText = () => `SCORE ${formatScore(run.score)}   COINS ${formatCounter(run.coins)}   LIVES ${formatCounter(run.lives)}`;
const getHudSecondaryText = () => `TIME ${formatCounter(run.timer, 3)}   STATE ${getHudStateLabel()}   ENEMIES ${formatCounter(enemies.filter((enemy) => enemy.alive).length)}`;

const createPanelBackground = () => new Graphics();

const drawPanelBackground = (graphics, width, height, alpha = 0.88) => {
  graphics
    .clear()
    .roundRect(0, 0, width, height, 10)
    .fill({ color: 0x06120b, alpha })
    .stroke({ width: 1, color: 0x96ffe0, alpha: 0.34 });
};

const createUiText = (text, style) => new Text({ text, style });

const renderUiNow = () => {
  if (app?.renderer && app?.stage && uiScene) {
    app.render();
  }
};

const syncGameUi = () => {
  if (hudScoreText) hudScoreText.text = getHudPrimaryText();
  if (hudMetaText) hudMetaText.text = getHudSecondaryText();
  if (loadingLabelText) loadingLabelText.text = loadingState.value.label;
  if (loadingPercentText) loadingPercentText.text = getLoadingProgressText();
  if (loadingBar) loadingBar.setProgress(getLoadingProgressPercent());
  if (loadingOverlay) loadingOverlay.visible = loadingState.value.visible;
};

const layoutGameUi = () => {
  if (!uiScene || !hudPanel || !hudRows || !loadingOverlay || !loadingPanel || !loadingBar) return;

  const compact = canvasSize.width <= 700;
  const hudWidth = Math.min(compact ? canvasSize.width - 16 : 992, Math.max(220, canvasSize.width - (compact ? 16 : 32)));
  const hudX = Math.max(8, (canvasSize.width - hudWidth) * 0.5);
  const hudY = compact ? 10 : 16;
  const rowMinHeight = compact ? 32 : 36;
  const hintMinHeight = compact ? 28 : 32;

  hudScoreText.style.fontSize = compact ? 9 : 11;
  hudScoreText.style.letterSpacing = compact ? 1.5 : 2.2;
  hudMetaText.style.fontSize = compact ? 9 : 11;
  hudMetaText.style.letterSpacing = compact ? 1.5 : 2.2;
  hudHintText.style.fontSize = compact ? 8 : 9;
  hudHintText.style.letterSpacing = compact ? 0.9 : 1.2;
  hudRowItems[0]?.resize(hudWidth, rowMinHeight);
  hudRowItems[1]?.resize(hudWidth, rowMinHeight);
  hudRowItems[2]?.resize(hudWidth, hintMinHeight);
  hudRows.arrangeChildren();
  hudPanel.position.set(hudX, hudY);

  loadingOverlay.removeChildren();
  const overlayBackground = createPanelBackground();
  overlayBackground
    .rect(0, 0, canvasSize.width, canvasSize.height)
    .fill({ color: 0x030604, alpha: 0.82 });
  loadingOverlay.addChild(overlayBackground, loadingPanel);

  const panelWidth = Math.min(compact ? canvasSize.width - 24 : 448, Math.max(240, canvasSize.width - 32));
  loadingLabelText.style.fontSize = compact ? 10 : 12;
  loadingLabelText.style.letterSpacing = compact ? 1.8 : 2.3;
  loadingPercentText.style.fontSize = compact ? 10 : 12;
  loadingPercentText.style.letterSpacing = compact ? 1.8 : 2.6;
  loadingLabelText.style.wordWrapWidth = panelWidth - 24;
  loadingPercentText.style.wordWrapWidth = panelWidth - 24;
  loadingBar.resize(panelWidth - 24, compact ? 12 : 14);
  drawPanelBackground(loadingPanel.background, panelWidth, Math.max(compact ? 94 : 106, loadingPanel.content.height + 24), 0.94);
  loadingPanel.content.arrangeChildren();
  loadingPanel.position.set((canvasSize.width - panelWidth) * 0.5, (canvasSize.height - loadingPanel.height) * 0.5);
};

const setDebugGridEnabled = (enabled, nowSeconds = performance.now() * 0.001) => {
  debugGrid.setEnabled(enabled, nowSeconds);
  if (enabled) {
    clearInput();
  }
  syncSceneSprites(debugGrid.enabled ? debugGrid.frozenTime : nowSeconds);
  renderUiNow();
};

const createGameUi = () => {
  if (!uiScene) return;

  const hudTextStyle = {
    fill: 0xbaf6d4,
    fontFamily: "Courier New",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.2,
  };
  const hintStyle = {
    fill: 0xbeffdc,
    alpha: 0.82,
    fontFamily: "Courier New",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    wordWrap: true,
  };
  const loadingTextStyle = {
    fill: 0xd9ffea,
    fontFamily: "Courier New",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.3,
  };

  hudRows = new List({ type: "vertical", elementsMargin: 6 });
  hudRowItems = [
    new GameUiRowGameObject({ text: "", style: hudTextStyle }),
    new GameUiRowGameObject({ text: "", style: hudTextStyle }),
    new GameUiRowGameObject({ text: GAME_HINT_TEXT, style: hintStyle }),
  ];
  hudRowItems.forEach((row) => {
    hudRows.addChild(row.sprite);
  });
  hudScoreText = hudRowItems[0].label;
  hudMetaText = hudRowItems[1].label;
  hudHintText = hudRowItems[2].label;
  hudPanel = new Container();
  hudPanel.zIndex = 50;
  hudPanel.addChild(hudRows);

  loadingLabelText = createUiText(loadingState.value.label, loadingTextStyle);
  loadingPercentText = createUiText(getLoadingProgressText(), {
    ...loadingTextStyle,
    fill: 0xbeffdc,
  });
  loadingBar = new LoadingBarGameObject({
    width: 320,
    height: 14,
    progress: getLoadingProgressPercent(),
  });
  loadingPanel = new Container();
  loadingPanel.background = createPanelBackground();
  loadingPanel.content = new List({ type: "vertical", elementsMargin: 10 });
  loadingPanel.content.position.set(12, 12);
  loadingPanel.content.addChild(loadingLabelText);
  loadingPanel.content.addChild(loadingBar.sprite);
  loadingPanel.content.addChild(loadingPercentText);
  loadingPanel.addChild(loadingPanel.background, loadingPanel.content);
  loadingOverlay = new Container();
  loadingOverlay.zIndex = 60;
  loadingOverlay.visible = loadingState.value.visible;

  uiScene.addChild(hudPanel, loadingOverlay);
  syncGameUi();
  layoutGameUi();
};

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
let goal = createGoal(world.goal);
let enemies = [];
let coins = [];

let app;
let spriteScene;
let uiScene;
let hudPanel;
let hudRows;
let hudRowItems = [];
let hudScoreText;
let hudMetaText;
let hudHintText;
let loadingOverlay;
let loadingPanel;
let loadingLabelText;
let loadingPercentText;
let loadingBar;
let frameId = null;
let previousTimeMs = 0;
let playerLandingEvent = null;
let lastHeroRenderFacing = 1;
let platformSpritesDirty = true;
const canvasSize = {
  width: 1,
  height: 1,
};

const invalidatePlatformSprites = () => {
  platformSpritesDirty = true;
};

const createRenderContext = (time = 0) => ({
  scene: spriteScene,
  uiScene,
  time,
  viewport,
  basePixelScale: BASE_PIXEL_SCALE,
  platformGrid: PLATFORM_GRID,
  world,
  enemies,
  coins,
  player,
  run,
  phaseDead: PHASE_DEAD,
  heroWorldSize: HERO_WORLD_SIZE,
  heroScreenOffsetY: HERO_SCREEN_OFFSET_Y,
  getHeroAnimation,
  coinWorldSize: COIN_WORLD_SIZE,
});

const syncRenderableObjects = (objects, renderContext) => {
  for (let i = 0; i < objects.length; i++) {
    const renderable = objects[i];
    if (!renderable?.syncRender) continue;
    const result = renderable.syncRender(renderContext);
    if (renderable === player && result !== undefined) {
      lastHeroRenderFacing = result;
    }
  }
};

const getDynamicRenderables = () => [
  ...enemies,
  ...coins,
  goal,
  player,
  debugGrid,
];
const viewport = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};
const debugGrid = new DebugGridGameObject();

const getLoaderSteps = (gameObjectTypes = LOADER_GAME_OBJECT_TYPES) => (
  gameObjectTypes.flatMap((GameObjectType) => {
    if (typeof GameObjectType?.getLoaderSteps !== "function") return [];
    return GameObjectType.getLoaderSteps() ?? [];
  })
);

const loadRequiredTextures = async (gameObjectTypes, onProgress) => {
  const steps = getLoaderSteps(gameObjectTypes);
  const total = steps.length;
  let completed = 0;

  if (typeof onProgress === "function") {
    onProgress({ loaded: 0, total });
  }

  await Promise.all(steps.map((stepPromise) => Promise.resolve(stepPromise).finally(() => {
    completed += 1;
    if (typeof onProgress === "function") {
      onProgress({ loaded: completed, total });
    }
  })));
};

const setLoadingState = (label, progress) => {
  loadingState.value = {
    visible: true,
    label,
    progress: clamp(progress, 0, 1),
  };
  syncGameUi();
  layoutGameUi();
  renderUiNow();
};

const hideLoadingState = () => {
  loadingState.value = {
    visible: false,
    label: "",
    progress: 1,
  };
  syncGameUi();
  renderUiNow();
};

const waitForPaint = async () => {
  await nextTick();
  await new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
};

const syncHud = () => {
  syncGameUi();
};

const detachObjectSprites = (items = []) => {
  for (let i = 0; i < items.length; i++) {
    items[i]?.detachSprite?.({ destroy: true });
  }
};

const resetPlayer = () => {
  player.reset(0);
  player.x = world.spawn.x;
  player.y = world.spawn.y;
  player.prevY = world.spawn.y;
  lastHeroRenderFacing = player.facing;
};

const attachEnemyControllers = () => {
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) continue;
    enemy.setRuntime({
      moveBody,
      solidSupportBelow,
      solidSupportAhead,
      enemyAhead,
      getPlayerLandingEvent: () => playerLandingEvent,
    });
  }
};

const attachPlayerSprite = () => {
  if (!spriteScene) return;
  player.attach(spriteScene);
};

const attachEnemySprites = () => {
  if (!spriteScene) return;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) continue;
    enemy.attach(spriteScene);
  }
};

const attachCoinSprites = () => {
  if (!spriteScene) return;
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    if (!coin) continue;
    coin.attach(spriteScene);
  }
};

const attachGoalSprite = () => {
  if (!spriteScene || !goal) return;
  goal.attach(spriteScene);
};

const attachSolidSprites = () => {
  if (!spriteScene) return;
  for (let i = 0; i < world.solids.length; i++) {
    const solid = world.solids[i];
    if (!solid) continue;
    solid.attach(spriteScene);
  }
};

const attachDebugGridSprites = () => {
  if (!spriteScene || !uiScene) return;
  debugGrid.attach(spriteScene);
  debugGrid.attachPanel(uiScene);
};

const resetLevel = () => {
  run.timer = clamp(Math.round(world.width * 0.55), 90, 180);
  run.phase = PHASE_PLAYING;
  run.phaseTimer = 0;
  run.stagePulse = 0;
  run.regenerateOnRespawn = false;
  resetPlayer();
  detachObjectSprites(enemies);
  detachObjectSprites(coins);
  enemies = world.enemySpawns.map(createEnemy);
  attachEnemyControllers();
  attachEnemySprites();
  coins = world.coins.map(createCoin);
  attachCoinSprites();
  run.coinsInStage = coins.length;
  run.collectedInStage = 0;
  run.doorUnlocked = run.coinsInStage === 0;
  syncHud();
  syncSceneSprites(debugGrid.enabled ? debugGrid.frozenTime : performance.now() * 0.001);
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
  player.captureRuntimeState();

  generateLevel(nextWidth, nextHeight, world.seed);
  if (resetProgress) {
    resetRun();
  } else {
    if (!player.restoreRuntimeState()) {
      player.reset(0);
      player.x = world.spawn.x;
      player.y = world.spawn.y;
      player.prevY = world.spawn.y;
    }
    detachObjectSprites(enemies);
    detachObjectSprites(coins);
    enemies = world.enemySpawns.map(createEnemy);
    attachEnemyControllers();
    attachEnemySprites();
    coins = world.coins.map(createCoin);
    attachCoinSprites();
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
  player.deathFacing = lastHeroRenderFacing;
  player.facing = player.deathFacing;
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

const solidSupportAhead = (body, direction, ahead = 0.9, probe = 1.25) => {
  const footX = body.x + direction * (body.w * 0.5 + ahead);
  const rect = {
    x: footX - 0.2,
    y: body.y - probe,
    w: 0.4,
    h: probe,
  };
  return world.solids.some((solid) => overlap(rect, solid));
};

const enemyAhead = (self, direction, maxDistance = ENEMY_WIDTH + 0.5, laneTolerance = PLATFORM_GRID * 0.5) => {
  if (!self?.alive) return false;

  for (let i = 0; i < enemies.length; i++) {
    const other = enemies[i];
    if (!other || !other.alive || other === self) continue;
    if (Math.abs(other.y - self.y) > laneTolerance) continue;

    const distanceX = other.x - self.x;
    const aheadDistance = direction > 0 ? distanceX : -distanceX;
    if (aheadDistance <= 0) continue;
    if (aheadDistance <= maxDistance) return true;
  }

  return false;
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
    enemy.updateState(delta);
  }
};

const stepPlayer = (delta) => {
  const moveInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const targetSpeed = moveInput * PLAYER.maxSpeed;
  const accel = player.grounded ? PLAYER.groundAccel : PLAYER.airAccel;
  const wasGrounded = player.grounded;

  player.prevY = player.y;
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  player.anim += delta * (Math.abs(player.vx) * 0.22 + 1.2);
  run.stagePulse = approach(run.stagePulse, run.phase === PHASE_CLEAR ? 1 : 0, delta * 1.6);

  if (run.phase === PHASE_PLAYING) {
    if (moveInput !== 0) {
      player.vx = approach(player.vx, targetSpeed, accel * delta);
      const nextFacing = moveInput > 0 ? 1 : -1;
      if (nextFacing !== player.facing) {
        player.requestTurn();
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
  if (run.phase === PHASE_PLAYING && !wasGrounded && player.grounded) {
    playerLandingEvent = {
      x: player.x,
      y: player.y,
    };
  }

  if (run.phase === PHASE_PLAYING) {
    collectCoins();
    resolveEnemyCollisions();
    if (run.doorUnlocked && overlap(bodyRect(player), goal.getHitbox())) {
      clearStage();
    }
    if (player.y < -18 || run.timer <= 0) {
      takeLife();
    }
  }

  player.updateAnimationState(delta, {
    runPhase: run.phase,
    PHASE_DEAD,
    PHASE_CLEAR,
    invulnerable: player.invulnerable,
    grounded: player.grounded,
    vy: player.vy,
    vx: player.vx,
  });
};

const stepPhase = (delta) => {
  if (loadingState.value.visible) return;
  if (run.phase === PHASE_PLAYING) {
    run.timer = Math.max(0, run.timer - delta);
    return;
  }

  run.phaseTimer -= delta;
  if (run.phaseTimer > 0) return;

  if (run.phase === PHASE_CLEAR) {
    void regenerateMapWithLoading({
      label: "Building Next Stage",
      onComplete: () => {
        resetLevel();
      },
    });
    return;
  }

  if (run.regenerateOnRespawn) {
    void regenerateMapWithLoading({
      label: "Rebuilding Stage",
      onComplete: () => {
        resetRun();
      },
    });
  } else {
    resetLevel();
  }
};

const stepGame = (delta) => {
  if (loadingState.value.visible) return;
  playerLandingEvent = null;
  stepPlayer(delta);
  if (run.phase !== PHASE_DEAD) {
    stepEnemies(delta);
  }
  stepPhase(delta);
  syncHud();
};

const flushPlatformSprites = () => {
  if (!platformSpritesDirty || !spriteScene) return;
  syncRenderableObjects(world.solids, createRenderContext());
  platformSpritesDirty = false;
};

const syncSceneSprites = (time) => {
  const renderContext = createRenderContext(time);
  syncRenderableObjects(getDynamicRenderables(), renderContext);
};

const onResize = () => {
  if (!container.value || !app) return;
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
  app.renderer.resolution = Math.min(window.devicePixelRatio || 1, 2);
  app.renderer.resize(width, height);
  regenerateWorld(viewportWidth, viewportHeight, false);
  invalidatePlatformSprites();
  flushPlatformSprites();
  layoutGameUi();
  syncGameUi();
  syncSceneSprites(debugGrid.enabled ? debugGrid.frozenTime : performance.now() * 0.001);
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
    void regenerateMapWithLoading({
      label: "Rebuilding Stage",
      onComplete: () => {
        resetRun();
      },
    });
    return true;
  }
  if (value && code === "KeyG") {
    void regenerateMapWithLoading({
      label: "Generating Stage",
      onComplete: () => {
        resetLevel();
      },
    });
    return true;
  }
  if (value && code === "F3") {
    setDebugGridEnabled(!debugGrid.enabled);
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

const initPixi = async () => {
  app = new Application();
  await app.init({
    width: Math.max(1, dom.width(container.value)),
    height: Math.max(1, dom.height(container.value)),
    background: "#030604",
    preference: "webgpu",
    powerPreference: "high-performance",
    antialias: false,
    autoDensity: true,
    autoStart: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  app.canvas.classList.add("fit");
  app.canvas.style.position = "absolute";
  app.canvas.style.inset = "0";
  app.canvas.style.zIndex = "1";
  container.value.appendChild(app.canvas);

  app.stage.sortableChildren = true;
  spriteScene = new Container();
  spriteScene.sortableChildren = true;
  uiScene = new Container();
  uiScene.sortableChildren = true;
  uiScene.eventMode = "none";
  app.stage.addChild(spriteScene, uiScene);
  attachPlayerSprite();
  attachDebugGridSprites();
  createGameUi();

  setLoadingState("Loading Sprites", 0.08);
  await waitForPaint();
  await loadRequiredTextures(LOADER_GAME_OBJECT_TYPES, ({ loaded, total }) => {
    const spriteProgress = total > 0 ? loaded / total : 1;
    setLoadingState("Loading Sprites", 0.08 + spriteProgress * 0.62);
  });
  setLoadingState("Preparing Textures", 0.74);
  flushPlatformSprites();
  attachGoalSprite();

  const width = Math.max(1, dom.width(container.value));
  const height = Math.max(1, dom.height(container.value));
  const viewportWidth = Math.max(BASE_PIXEL_SCALE, Math.floor(width / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE);
  const viewportHeight = Math.max(BASE_PIXEL_SCALE, Math.floor(height / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE);
  setLoadingState("Generating Stage", 0.84);
  await waitForPaint();
  regenerateMap(
    Math.max(MIN_WORLD_WIDTH, Math.floor(viewportWidth / BASE_PIXEL_SCALE)),
    Math.max(MIN_WORLD_HEIGHT, Math.floor(viewportHeight / BASE_PIXEL_SCALE)),
  );
  setLoadingState("Spawning Run", 0.96);
  resetRun();
  onResize();
  setLoadingState("Ready", 1);
  await waitForPaint();
  hideLoadingState();

  previousTimeMs = performance.now();
  const animate = (nowMs) => {
    const delta = clamp((nowMs - previousTimeMs) / 1000, 0, 1 / 24);
    previousTimeMs = nowMs;
    if (!debugGrid.enabled) {
      stepGame(delta);
    }
    syncSceneSprites(debugGrid.enabled ? debugGrid.frozenTime : nowMs * 0.001);
    app.render();
    frameId = requestAnimationFrame(animate);
  };
  frameId = requestAnimationFrame(animate);
};

onMounted(async () => {
  await initPixi();
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
  player.detachSprite({ destroy: true });
  goal.detachSprite({ destroy: true });
  detachObjectSprites(enemies);
  detachObjectSprites(coins);
  detachObjectSprites(world.solids);
  void Promise.allSettled(
    LOADER_GAME_OBJECT_TYPES.flatMap((GameObjectType) => {
      const manager = GameObjectType.assetsManager;
      if (!manager) return [];
      return [...manager.textures.keys()].map((key) => manager.unloadTexture(key));
    }),
  );
  if (app) {
    const canvas = app.canvas;
    app.destroy();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
});
</script>
