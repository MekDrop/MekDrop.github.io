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
import { List, ProgressBar } from "@pixi/ui";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from "pixi.js";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { dom } from "quasar";
import { getHeroAnimation, getHeroAnimationSources } from "assets/game/sprites/hero-sprite-registry";
import { MarioLikeMapGenerator } from "src/strategies/map-generators/MarioLikeMapGenerator";
import coinGoldSprite from "assets/game/sprites/collectibles/coin-gold.png";
import enemyWalkFrame0 from "assets/game/sprites/enemies/mushroom-stomper-walk-0.png";
import enemyWalkFrame1 from "assets/game/sprites/enemies/mushroom-stomper-walk-1.png";
import portalFrame from "assets/game/sprites/goal/portal-frame-0.png";
import platformFlyingPlatformSprite from "assets/game/sprites/platforms/platform-flying-platform-manual.png";
import platformWallSprite from "assets/game/sprites/platforms/platform-wall.png";
import platformStairSprite from "assets/game/sprites/platforms/platform-stair.png";

const BASE_PIXEL_SCALE = 8;
const MIN_WORLD_WIDTH = 1;
const MIN_WORLD_HEIGHT = 1;
const MAX_SOLIDS = 64;
const MAX_ENEMIES = 40;
const MAX_COINS = 40;
const STAGE_MAX_COLLECTIBLES = 10;
const GAME_HINT_TEXT = "A / D OR ARROWS MOVE · SPACE / W / UP JUMP · R RESET · ONE SCREEN · GENERATED STAGE";
const PHASE_PLAYING = 0;
const PHASE_DEAD = 1;
const PHASE_CLEAR = 2;
const HERO_WORLD_SIZE = 16;
const COIN_WORLD_SIZE = HERO_WORLD_SIZE / 3;
const HERO_TURN_DURATION = 0.34;
const HERO_SCREEN_OFFSET_Y = 5;
const PLATFORM_FLYING_PLATFORM_CROP = {
  x: 0 / 64,
  y: 0 / 24,
  w: 64 / 64,
  h: 24 / 24,
};
const PLATFORM_FLYING_PLATFORM_TILE_SCALE = {
  x: 55 / 64,
  y: 2,
};
const PLATFORM_WALL_CROP = {
  x: 0 / 32,
  y: 12 / 32,
  w: 32 / 32,
  h: 10 / 32,
};
const PLATFORM_WALL_TOP_CROP = {
  x: 0 / 32,
  y: 12 / 32,
  w: 32 / 32,
  h: 4 / 32,
};
const PLATFORM_WALL_FILL_CROP = {
  x: 0 / 32,
  y: 16 / 32,
  w: 32 / 32,
  h: 4 / 32,
};
const PLATFORM_STAIR_CROP = {
  x: 5 / 64,
  y: 3 / 32,
  w: 54 / 64,
  h: 26 / 32,
};
const REQUIRED_TEXTURE_KEYS = [
  "coinGold",
  "enemyWalkFrame0",
  "enemyWalkFrame1",
  "portalFrame",
  "platformFlyingPlatform",
  "platformWall",
  "platformStair",
];
const HERO_TEXTURE_SOURCES = getHeroAnimationSources();
const HERO_TEXTURE_KEYS = HERO_TEXTURE_SOURCES.map((_, index) => `hero:${index}`);
const TEXTURE_URLS = Object.fromEntries([
  ...HERO_TEXTURE_SOURCES.map((url, index) => [`hero:${index}`, url]),
  ["coinGold", coinGoldSprite],
  ["enemyWalkFrame0", enemyWalkFrame0],
  ["enemyWalkFrame1", enemyWalkFrame1],
  ["portalFrame", portalFrame],
  ["platformFlyingPlatform", platformFlyingPlatformSprite],
  ["platformWall", platformWallSprite],
  ["platformStair", platformStairSprite],
]);
const loadedTextures = new Map();
const loadedTexturesByUrl = new Map();
const getUsedTextureKeys = () => [
  ...HERO_TEXTURE_KEYS,
  ...REQUIRED_TEXTURE_KEYS,
];
const getTextureUrlByKey = (key) => TEXTURE_URLS[key] ?? null;
const getLoadedTextureByKey = (key) => loadedTextures.get(key) ?? null;
const getLoadedTextureByUrl = (url) => loadedTexturesByUrl.get(url) ?? null;

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
  Object.assign(world, mapGenerator.generate(nextWidth, nextHeight, seed));
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

const createHudRow = (text, style) => {
  const row = new Container();
  const background = createPanelBackground();
  const label = createUiText(text, style);
  label.x = 12;
  label.y = 8;
  row.addChild(background, label);
  row.background = background;
  row.label = label;
  return row;
};

const resizeHudRow = (row, width, minHeight) => {
  const labelWidth = Math.max(1, width - 24);
  row.label.style.wordWrapWidth = labelWidth;
  drawPanelBackground(row.background, width, Math.max(minHeight, row.label.height + 16), 0.78);
};

const createLoadingBarView = (width, height, fillColor) => {
  const view = new Graphics();
  view
    .roundRect(0, 0, width, height, 6)
    .fill(fillColor)
    .stroke({ width: 1, color: 0x96ffe0, alpha: fillColor === 0x06120b ? 0.34 : 0.18 });
  return view;
};

const renderUiNow = () => {
  if (app && uiScene) {
    app.render();
  }
};

const syncGameUi = () => {
  if (hudScoreText) hudScoreText.text = getHudPrimaryText();
  if (hudMetaText) hudMetaText.text = getHudSecondaryText();
  if (loadingLabelText) loadingLabelText.text = loadingState.value.label;
  if (loadingPercentText) loadingPercentText.text = getLoadingProgressText();
  if (loadingBar) loadingBar.progress = getLoadingProgressPercent();
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
  resizeHudRow(hudRowItems[0], hudWidth, rowMinHeight);
  resizeHudRow(hudRowItems[1], hudWidth, rowMinHeight);
  resizeHudRow(hudRowItems[2], hudWidth, hintMinHeight);
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
  loadingBar.width = panelWidth - 24;
  loadingBar.height = compact ? 12 : 14;
  drawPanelBackground(loadingPanel.background, panelWidth, Math.max(compact ? 94 : 106, loadingPanel.content.height + 24), 0.94);
  loadingPanel.content.arrangeChildren();
  loadingPanel.position.set((canvasSize.width - panelWidth) * 0.5, (canvasSize.height - loadingPanel.height) * 0.5);
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

  hudScoreText = createUiText("", hudTextStyle);
  hudMetaText = createUiText("", hudTextStyle);
  hudHintText = createUiText(GAME_HINT_TEXT, hintStyle);
  hudRows = new List({ type: "vertical", elementsMargin: 6 });
  hudRowItems = [
    createHudRow("", hudTextStyle),
    createHudRow("", hudTextStyle),
    createHudRow(GAME_HINT_TEXT, hintStyle),
  ];
  hudRowItems.forEach((row) => hudRows.addChild(row));
  hudRowItems[0].removeChild(hudRowItems[0].label);
  hudRowItems[0].addChild(hudScoreText);
  hudScoreText.x = 12;
  hudScoreText.y = 8;
  hudRowItems[0].label = hudScoreText;
  hudRowItems[1].removeChild(hudRowItems[1].label);
  hudRowItems[1].addChild(hudMetaText);
  hudMetaText.x = 12;
  hudMetaText.y = 8;
  hudRowItems[1].label = hudMetaText;
  hudRowItems[2].removeChild(hudRowItems[2].label);
  hudRowItems[2].addChild(hudHintText);
  hudHintText.x = 12;
  hudHintText.y = 8;
  hudRowItems[2].label = hudHintText;
  hudPanel = new Container();
  hudPanel.zIndex = 50;
  hudPanel.addChild(hudRows);

  loadingLabelText = createUiText(loadingState.value.label, loadingTextStyle);
  loadingPercentText = createUiText(getLoadingProgressText(), {
    ...loadingTextStyle,
    fill: 0xbeffdc,
  });
  loadingBar = new ProgressBar({
    bg: createLoadingBarView(320, 14, 0x06120b),
    fill: createLoadingBarView(320, 14, 0x6ff0b5),
    progress: getLoadingProgressPercent(),
  });
  loadingPanel = new Container();
  loadingPanel.background = createPanelBackground();
  loadingPanel.content = new List({ type: "vertical", elementsMargin: 10 });
  loadingPanel.content.position.set(12, 12);
  loadingPanel.content.addChild(loadingLabelText);
  loadingPanel.content.addChild(loadingBar);
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
let enemies = [];
let coins = [];

let app;
let spriteScene;
let uiScene;
let heroSprite;
let heroTextures = new Map();
let goalSprite;
let goalTexture;
let coinTexture;
let coinSprites = [];
let platformTextures = {};
let platformSprites = [];
let enemyTextures = [];
let enemySprites = [];
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

const loadRequiredTextures = async (keys, onProgress) => {
  const uniqueKeys = [...new Set(keys)].filter((key) => !!getTextureUrlByKey(key));
  const total = uniqueKeys.length;
  let completed = 0;

  if (typeof onProgress === "function") {
    onProgress({ loaded: 0, total });
  }

  await Promise.all(uniqueKeys.map(async (key) => {
    if (!loadedTextures.has(key)) {
      const url = getTextureUrlByKey(key);
      const texture = await Assets.load(url);
      texture.source.scaleMode = "nearest";
      loadedTextures.set(key, texture);
      loadedTexturesByUrl.set(url, texture);
    }

    completed += 1;
    if (typeof onProgress === "function") {
      onProgress({ loaded: completed, total });
    }
  }));
};

const unloadRequiredTextures = async (keys) => {
  const uniqueKeys = [...new Set(keys)].filter((key) => !!getTextureUrlByKey(key));
  await Promise.allSettled(uniqueKeys.map(async (key) => {
    const url = getTextureUrlByKey(key);
    loadedTextures.delete(key);
    loadedTexturesByUrl.delete(url);
    await Assets.unload(url);
  }));
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

const configurePixelTexture = (texture) => {
  texture.source.scaleMode = "nearest";
  return texture;
};

const cloneTexture = (texture) => {
  if (!texture) return null;
  return configurePixelTexture(new Texture({
    source: texture.source,
    frame: texture.frame,
    orig: texture.orig,
    trim: texture.trim,
    rotate: texture.rotate,
    defaultAnchor: texture.defaultAnchor,
    defaultBorders: texture.defaultBorders,
    label: texture.label,
  }));
};

const createCroppedTexture = (texture, crop) => {
  if (!texture) return null;
  const frame = new Rectangle(
    Math.round(texture.width * crop.x),
    Math.round(texture.height * crop.y),
    Math.round(texture.width * crop.w),
    Math.round(texture.height * crop.h),
  );

  return configurePixelTexture(new Texture({
    source: texture.source,
    frame,
  }));
};

const getHeroTexture = (src) => {
  if (!heroTextures.has(src)) {
    const texture = getLoadedTextureByUrl(src);
    if (!texture) return null;
    heroTextures.set(src, texture);
  }
  return heroTextures.get(src);
};

const getHeroFrameTexture = (src, animation, frameIndex) => {
  const cacheKey = `${src}:${animation.columns}x${animation.rows}:${frameIndex}`;
  if (heroTextures.has(cacheKey)) {
    return heroTextures.get(cacheKey);
  }

  const texture = getHeroTexture(src);
  if (!texture) return null;
  const frameWidth = Math.floor(texture.width / animation.columns);
  const frameHeight = Math.floor(texture.height / animation.rows);
  const frameColumn = frameIndex % animation.columns;
  const frameRow = Math.floor(frameIndex / animation.columns);
  const frame = new Rectangle(
    frameColumn * frameWidth,
    frameRow * frameHeight,
    frameWidth,
    frameHeight,
  );
  const frameTexture = configurePixelTexture(new Texture({
    source: texture.source,
    frame,
  }));

  heroTextures.set(cacheKey, frameTexture);
  return frameTexture;
};

const ensureHeroSprite = () => {
  if (heroSprite || !spriteScene) return;
  heroSprite = new Sprite();
  heroSprite.anchor.set(0.5, 0);
  heroSprite.zIndex = 20;
  spriteScene.addChild(heroSprite);
};

const ensureGoalSprite = () => {
  if (goalSprite || !spriteScene || !goalTexture) return;
  goalSprite = new Sprite(goalTexture);
  goalSprite.anchor.set(0.5, 0);
  goalSprite.zIndex = 18;
  goalSprite.visible = false;
  spriteScene.addChild(goalSprite);
};

const ensureCoinSprites = () => {
  if (!spriteScene || !coinTexture) return;
  while (coinSprites.length < MAX_COINS) {
    const sprite = new Sprite(coinTexture);
    sprite.anchor.set(0.5, 0.5);
    sprite.visible = false;
    sprite.zIndex = 12;
    coinSprites.push(sprite);
    spriteScene.addChild(sprite);
  }
};

const ensurePlatformSprites = () => {
  if (!spriteScene || !platformTextures.flyingPlatform) return;
  while (platformSprites.length < MAX_SOLIDS) {
    const container = new Container();
    const middle = new TilingSprite({
      texture: platformTextures.flyingPlatform,
      width: platformTextures.flyingPlatform.width,
      height: platformTextures.flyingPlatform.height,
    });
    const left = new TilingSprite({
      texture: platformTextures.wallTop,
      width: platformTextures.wallTop.width,
      height: platformTextures.wallTop.height,
    });
    const right = new TilingSprite({
      texture: platformTextures.wallFill,
      width: platformTextures.wallFill.width,
      height: platformTextures.wallFill.height,
    });
    container.visible = false;
    container.zIndex = 8;
    left.visible = false;
    right.visible = false;
    container.middle = middle;
    container.left = left;
    container.right = right;
    container.addChild(middle, right, left);
    platformSprites.push(container);
    spriteScene.addChild(container);
  }
};

const ensureEnemySprites = () => {
  if (!spriteScene || enemyTextures.length === 0) return;

  while (enemySprites.length < MAX_ENEMIES) {
    const sprite = new Sprite(enemyTextures[0]);
    sprite.anchor.set(0.5, 0);
    sprite.visible = false;
    sprite.zIndex = 10;
    enemySprites.push(sprite);
    spriteScene.addChild(sprite);
  }
};

const syncHeroSprite = (time) => {
  ensureHeroSprite();
  if (!heroSprite) return;

  const animationName = getHeroAnimationName();
  const animation = getHeroAnimation(animationName);
  const frameIndex = getHeroFrameIndex(animationName);
  const sizePx = HERO_WORLD_SIZE * BASE_PIXEL_SCALE;
  const blinkHidden = player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
  const facingKey = player.facing > 0 ? "right" : "left";
  const spriteSrc = animation.srcByFacing?.[facingKey] ?? animation.srcByFacing?.left ?? animation.src;
  const mirrorFacing = animation.mirrorByFacing?.[facingKey] ?? (animation.mirror && player.facing > 0);
  const frameOffset = animation.frameOffsets?.[frameIndex] ?? animation.frameOffsets?.[0] ?? { x: 0, y: 0 };
  const offsetX = (mirrorFacing ? -frameOffset.x : frameOffset.x) * BASE_PIXEL_SCALE;
  const offsetY = frameOffset.y * BASE_PIXEL_SCALE;
  const frameTexture = getHeroFrameTexture(spriteSrc, animation, frameIndex);
  if (!frameTexture) {
    heroSprite.visible = false;
    return;
  }
  heroSprite.texture = frameTexture;
  heroSprite.visible = !blinkHidden;
  const left = viewport.x + (player.x - HERO_WORLD_SIZE * 0.5) * BASE_PIXEL_SCALE + offsetX;
  const top = viewport.y + viewport.height - (player.y + HERO_WORLD_SIZE) * BASE_PIXEL_SCALE + offsetY + HERO_SCREEN_OFFSET_Y;
  heroSprite.position.set(left + sizePx * 0.5, top);
  heroSprite.width = mirrorFacing ? -sizePx : sizePx;
  heroSprite.height = sizePx;
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
    sprite.position.set(left + sizePx * 0.5, top + sizePx * 0.5);
    sprite.width = sizePx * spinScale;
    sprite.height = sizePx;
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

    const frameIndex = Math.floor(enemy.anim * 0.7) % enemyTextures.length;
    const bobOffset = Math.sin(time * 8 + enemy.x * 0.3) * 0.35;
    const left = viewport.x + (enemy.x - enemy.w * 0.5) * BASE_PIXEL_SCALE - 2;
    const top = viewport.y + viewport.height - (enemy.y + enemy.h + bobOffset) * BASE_PIXEL_SCALE - 4;
    sprite.visible = true;
    sprite.texture = enemyTextures[frameIndex];
    sprite.position.set(left + sizePx * 0.5, top);
    sprite.width = enemy.dir > 0 ? -sizePx : sizePx;
    sprite.height = sizePx;
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
    const textureKey = solid.type === 0 ? "wall" : solid.type === 3 ? "stair" : "flyingPlatform";
    const texture = platformTextures[textureKey];
    const left = viewport.x + solid.x * BASE_PIXEL_SCALE;
    const top = viewport.y + viewport.height - (solid.y + solid.h) * BASE_PIXEL_SCALE;
    if (!texture) {
      sprite.visible = false;
      continue;
    }
    sprite.visible = true;
    sprite.position.set(left, top);
    sprite.middle.position.set(0, 0);
    sprite.middle.tileScale = textureKey === "flyingPlatform"
      ? PLATFORM_FLYING_PLATFORM_TILE_SCALE
      : 1;
    sprite.middle.tilePosition = { x: 0, y: 0 };
    sprite.left.tileScale = 1;
    sprite.left.tilePosition = { x: 0, y: 0 };
    sprite.right.tileScale = 1;
    sprite.right.tilePosition = { x: 0, y: 0 };

    if (textureKey === "wall") {
      const topHeightPx = Math.min(heightPx, platformTextures.wallTop.height);
      const fillHeightPx = Math.max(0, heightPx - topHeightPx);
      sprite.middle.visible = false;
      sprite.left.visible = true;
      sprite.right.visible = fillHeightPx > 0;
      sprite.left.texture = platformTextures.wallTop;
      sprite.left.width = widthPx;
      sprite.left.height = topHeightPx;
      sprite.left.position.set(0, 0);
      sprite.right.texture = platformTextures.wallFill;
      sprite.right.width = widthPx;
      sprite.right.height = fillHeightPx;
      sprite.right.position.set(0, topHeightPx);
      continue;
    }

    sprite.left.visible = false;
    sprite.right.visible = false;
    sprite.middle.visible = true;
    sprite.middle.texture = texture;
    sprite.middle.width = widthPx;
    sprite.middle.height = heightPx;
  }
};

const syncGoalSprite = (time) => {
  ensureGoalSprite();
  if (!goalSprite) return;

  const pulse = run.doorUnlocked ? 1 + Math.sin(time * 3.2) * 0.04 : 0.9;
  const widthPx = 48 * pulse;
  const heightPx = 64 * pulse;
  const left = viewport.x + world.goal.x * BASE_PIXEL_SCALE - widthPx * 0.5;
  const top = viewport.y + viewport.height - (world.goal.y + heightPx / BASE_PIXEL_SCALE) * BASE_PIXEL_SCALE;
  goalSprite.visible = run.doorUnlocked;
  goalSprite.position.set(left + widthPx * 0.5, top);
  goalSprite.width = widthPx;
  goalSprite.height = heightPx;
};

const syncSceneSprites = (time) => {
  syncPlatformSprites();
  syncGoalSprite(time);
  syncEnemySprites(time);
  syncCoinSprites(time);
  syncHeroSprite(time);
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
  layoutGameUi();
  syncGameUi();
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
  createGameUi();

  const requiredTextureKeys = getUsedTextureKeys();
  setLoadingState("Loading Sprites", 0.08);
  await waitForPaint();
  await loadRequiredTextures(requiredTextureKeys, ({ loaded, total }) => {
    const spriteProgress = total > 0 ? loaded / total : 1;
    setLoadingState("Loading Sprites", 0.08 + spriteProgress * 0.62);
  });
  setLoadingState("Preparing Textures", 0.74);

  goalTexture = cloneTexture(getLoadedTextureByKey("portalFrame"));
  coinTexture = cloneTexture(getLoadedTextureByKey("coinGold"));
  platformTextures = {
    flyingPlatform: createCroppedTexture(getLoadedTextureByKey("platformFlyingPlatform"), PLATFORM_FLYING_PLATFORM_CROP),
    wall: createCroppedTexture(getLoadedTextureByKey("platformWall"), PLATFORM_WALL_CROP),
    wallTop: createCroppedTexture(getLoadedTextureByKey("platformWall"), PLATFORM_WALL_TOP_CROP),
    wallFill: createCroppedTexture(getLoadedTextureByKey("platformWall"), PLATFORM_WALL_FILL_CROP),
    stair: createCroppedTexture(getLoadedTextureByKey("platformStair"), PLATFORM_STAIR_CROP),
  };
  enemyTextures = [
    cloneTexture(getLoadedTextureByKey("enemyWalkFrame0")),
    cloneTexture(getLoadedTextureByKey("enemyWalkFrame1")),
  ];
  ensureHeroSprite();
  ensureGoalSprite();
  ensureCoinSprites();
  ensurePlatformSprites();
  ensureEnemySprites();

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
    stepGame(delta);
    syncSceneSprites(nowMs * 0.001);
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
  if (heroSprite?.parent) heroSprite.parent.removeChild(heroSprite);
  if (goalSprite?.parent) goalSprite.parent.removeChild(goalSprite);
  coinSprites.forEach((sprite) => {
    if (sprite.parent) sprite.parent.removeChild(sprite);
  });
  platformSprites.forEach((sprite) => {
    if (sprite.parent) sprite.parent.removeChild(sprite);
  });
  enemySprites.forEach((sprite) => {
    if (sprite.parent) sprite.parent.removeChild(sprite);
  });
  for (const texture of heroTextures.values()) {
    if (!texture?.destroyed) texture.destroy(false);
  }
  heroTextures.clear();
  Object.values(platformTextures).forEach((texture) => {
    if (!texture?.destroyed) texture.destroy(false);
  });
  enemyTextures.forEach((texture) => {
    if (!texture?.destroyed) texture.destroy(false);
  });
  if (goalTexture && !goalTexture.destroyed) goalTexture.destroy(false);
  if (coinTexture && !coinTexture.destroyed) coinTexture.destroy(false);
  const requiredTextureKeys = getUsedTextureKeys();
  void unloadRequiredTextures(requiredTextureKeys);
  if (app) {
    const canvas = app.canvas;
    app.destroy();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
});
</script>
