import castleFireParticleUrl from "src/assets/game/effects/castle-fire-particle.png?url";
import earthSideUrl from "src/assets/game/tiles/earth-side.png";
import grassSideUrl from "src/assets/game/tiles/grass-side.png";
import grassTopUrl from "src/assets/game/tiles/grass-top.png";
import pathSideUrl from "src/assets/game/tiles/path-sandstone-side.png";
import pathTopUrl from "src/assets/game/tiles/path-sandstone-top.png";
import waterSideUrl from "src/assets/game/tiles/water-side.png";
import waterTopUrl from "src/assets/game/tiles/water-top.png";
import grassTerrainFragmentShader from "./objects/ground-cover/GrassTerrain.frag?raw";
import { Castle } from "./objects/castle/index.js";
import {
  GATEWAY_BANNER_SIGNS,
  GATEWAY_COLORS,
  Gateway,
} from "./objects/gateway/index.js";
import { PathArrows } from "./objects/path/index.js";
import { RiverWater } from "./objects/water/index.js";
import { Hero } from "./objects/hero/index.js";
import {
  AxeTool,
  KnifeTool,
  ShovelTool,
} from "./objects/hero/tools/index.js";
import { GrassSurface, GroundCover } from "./objects/ground-cover/index.js";
import {
  CubeCloudField,
  FloatingIslandMotion,
  SkyIslandScenery,
} from "./objects/scenery/index.js";
import { VoxelVegetation } from "./objects/vegetation/index.js";
import { BuriedTreasureField } from "./objects/treasure/index.js";
import { ThrownInventoryItem } from "./objects/inventory/index.js";
import { TileType } from "./MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "./config/terrain.js";
import { GRAPHICS_DRIVER } from "./enum/GraphicsDriver.js";
import { POINTER_TYPE } from "./enum/PointerType.js";
import { TILE_SHAPE } from "./enum/TileShape.js";
import {
  GroundCollisionWorld,
  PathOverpassCollider,
} from "./collision/index.js";
import { GameModelLibrary } from "./models/index.js";
import { CameraPanBounds, HeroVisibilityController } from "./camera/index.js";
import {
  DebugAxesHud,
  DebugFpsHud,
  GameOverHud,
  GameUiTheme,
  HeroLifeHud,
  CoinHud,
  InventoryHud,
} from "./ui/index.js";
import { colorFromHex, shadeHexColor } from "./helpers/colors.js";

const FIXED_HEIGHTS = {
  [TileType.WATER]: 0,
};
const GRASS_SURFACE_TILES = new Set([
  TileType.GRASS,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);

const TEXTURE_URLS = {
  grass: grassTopUrl,
  path: pathTopUrl,
  water: waterTopUrl,
  earthSide: earthSideUrl,
  grassSide: grassSideUrl,
  pathSide: pathSideUrl,
  waterSide: waterSideUrl,
  castleFireParticle: castleFireParticleUrl,
};

const MATERIAL_DEFINITIONS = {
  earth: { color: 0xe8c4a0, texture: "earthSide", gloss: 0.08 },
  grass: {
    color: 0xffffff,
    texture: "grass",
    gloss: 0.05,
    continuousTexture: true,
  },
  path: { color: 0xe8d6b5, texture: "path", gloss: 0.05 },
  water: { color: 0xd8f2ff, texture: "water", gloss: 0.22 },
  islandRock: { color: 0x667482, texture: "earthSide", gloss: 0.03 },
};

const SIDE_VARIANT_DEFINITIONS = {
  grassSide: {
    texture: "grassSide",
    colors: [0xffffff, 0xf9f5ee, 0xf2f7ed, 0xf8fbf5, 0xf5f1e9, 0xfbf8f2],
    gloss: 0.05,
  },
  pathSide: {
    texture: "pathSide",
    colors: [0xead8b9, 0xe2ceb0, 0xecd5b4, 0xdcc6a7, 0xe8d1b0, 0xdfc9a9],
    gloss: 0.04,
  },
  waterSide: {
    texture: "waterSide",
    colors: [0xd8f2ff, 0xcfeaff, 0xe0f5ff, 0xc9e7ff, 0xd5efff, 0xdff7ff],
    gloss: 0.18,
  },
};

const EARTH_SIDE_TEXTURE_TRANSFORMS = [
  { startU: 0.01, startV: 0.01, scaleU: 0.32, scaleV: 0.32, flipU: false },
  { startU: 0.67, startV: 0.01, scaleU: 0.32, scaleV: 0.32, flipU: true },
  { startU: 0.01, startV: 0.67, scaleU: 0.32, scaleV: 0.32, flipU: true },
  { startU: 0.67, startV: 0.67, scaleU: 0.32, scaleV: 0.32, flipU: false },
];
const EARTH_DETAIL_TEXTURE_TRANSFORMS = [
  { startU: 0.34, startV: 0.02, scaleU: 0.32, scaleV: 0.32, flipU: false },
  { startU: 0.34, startV: 0.34, scaleU: 0.32, scaleV: 0.32, flipU: true },
  { startU: 0.34, startV: 0.66, scaleU: 0.32, scaleV: 0.32, flipU: false },
];
const EARTH_SIDE_HIGHEST_LEVEL = 1;
const EARTH_SIDE_DEPTH_SHADES = [
  1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.53, 0.47, 0.42, 0.38,
];

const SIDE_VARIANT_TRANSFORMS = [
  { startU: 0, scaleU: 0.72, flipU: false },
  { startU: 0.14, scaleU: 0.72, flipU: true },
  { startU: 0.28, scaleU: 0.72, flipU: false },
  { startU: 0, scaleU: 0.72, flipU: true },
  { startU: 0.14, scaleU: 0.72, flipU: false },
  { startU: 0.28, scaleU: 0.72, flipU: true },
];
const GRASS_EARTH_SIDE_TRANSFORMS = SIDE_VARIANT_TRANSFORMS.map(
  (transform) => ({
    ...transform,
    startV: 0.18,
    scaleV: 0.82,
  }),
);
const OVERPASS_EARTH_SIDE_TRANSFORMS = SIDE_VARIANT_TRANSFORMS.map(
  (transform) => ({
    ...transform,
    startV: 0.4,
    scaleV: 0.6,
  }),
);

const GRASS_TOP_VARIANTS = [{ color: 0xffffff }];

const SURFACE_MATERIALS = {
  [TileType.GRASS]: "grass",
  [TileType.PATH]: "path",
  [TileType.WATER]: "water",
  [TileType.ENTRY]: "path",
};

const SIDE_MATERIALS = {
  [TileType.GRASS]: "grassSide",
  [TileType.PATH]: "pathSide",
  [TileType.WATER]: "waterSide",
  [TileType.ENTRY]: "pathSide",
};

const CUBE_SCALE = 1;
const CAMERA_PITCH = Math.atan(1 / Math.sqrt(2));
const CAMERA_DISTANCE = 80;
const SHADOW_DISTANCE = 150;
const GLSLANG_URL = "/game/wasm/glslang/glslang.js";
const TWGSL_URL = "/game/wasm/twgsl/twgsl.js";
const MAP_FIT_ZOOM = 1;
const HERO_VIEWPORT_MARGIN = 32;
const HERO_CAMERA_CENTER_HEIGHT = 0.85;
const HERO_BRIDGE_VISIBILITY_RADIUS = 0.5;
const HERO_CAMERA_RETURN_DURATION = 0.45;
const CAMERA_TARGET_HEIGHT = 3.2;
const GAME_OVER_FALLBACK_ZOOM = 1.75;
const GAME_OVER_CAMERA_DURATION = 0.8;
const GAME_OVER_ROYAL_VIEWPORT_HEIGHT = 0.6;
const MAX_CASTLE_LIVES = 3;

export class PlayCanvasRenderer {
  #pc = null;
  #app = null;
  #camera = null;
  #cloudLayer = null;
  #mapRoot = null;
  #mapData = null;
  #cubeMeshes = null;
  #materials = new Map();
  #textureAssets = [];
  #castleFireParticleTexture = null;
  #vertexBuffers = [];
  #zoom = 1;
  #rotation = 0;
  #panX = 0;
  #panZ = 0;
  #fitCenterX = 0;
  #fitCenterZ = 0;
  #viewportManuallyMoved = false;
  #baseOrthoHeight = 24;
  #cameraTargetY = CAMERA_TARGET_HEIGHT;
  #cameraPanBounds = null;
  #pathArrows = null;
  #gateways = [];
  #castle = null;
  #hero = null;
  #debugAxesHud = null;
  #debugFpsHud = null;
  #lifeHud = null;
  #coinHud = null;
  #inventoryHud = null;
  #thrownInventoryItems = [];
  #gameOverHud = null;
  #heroVisibility = null;
  #floatingIslandMotion = null;
  #groundCover = null;
  #grassSurface = null;
  #riverWater = null;
  #vegetation = null;
  #buriedTreasure = null;
  #axeTool = null;
  #knifeTool = null;
  #shovelTool = null;
  #interactionProviders = [];
  #cloudField = null;
  #pathArrowsVisible = false;
  #debugAxesHudVisible = false;
  #debugFpsHudVisible = false;
  #collisionWorld = new GroundCollisionWorld();
  #pathOverpassCollider = null;
  #modelLibrary = null;
  #gatewayColors = [...GATEWAY_COLORS];
  #bannerWindTarget = null;
  #bannerWindPointerId = null;
  #bannerWindLastTime = 0;
  #bannerInteractionConnected = false;
  #heroLookPointer = null;
  #interactionTarget = null;
  #interactionSignature = null;
  #onInteractionChange = null;
  #onHeroStateChange = null;
  #onInventoryFull = null;
  #viewportSignature = "";
  #viewportPersistenceEnabled = false;
  #viewportSaveTimer = null;
  #heroCameraReturnTransition = null;
  #gameOverCameraTransition = null;
  #gameOverCameraLocked = false;
  #gameOverReturnViewport = null;
  #debugStore = null;
  #gameViewStore = null;
  #graphicsSettingsStore = null;
  #heroConfigurationStore = null;
  #stopDebugStoreSubscription = null;
  #translate = (key) => key;
  #uiTheme = null;

  constructor(
    canvas,
    container,
    {
      onInteractionChange = null,
      onHeroStateChange = null,
      onInventoryFull = null,
      t = (key) => key,
      debugStore,
      gameViewStore,
      graphicsSettingsStore,
      heroConfigurationStore,
      uiTheme,
    } = {},
  ) {
    this.canvas = canvas;
    this.container = container;
    this.#onInteractionChange = onInteractionChange;
    this.#onHeroStateChange = onHeroStateChange;
    this.#onInventoryFull = onInventoryFull;
    this.#debugStore = debugStore;
    this.#gameViewStore = gameViewStore;
    this.#graphicsSettingsStore = graphicsSettingsStore;
    this.#heroConfigurationStore = heroConfigurationStore;
    this.#uiTheme = new GameUiTheme(uiTheme);
    this.#heroConfigurationStore.normalizeInventorySlots();
    this.#translate = t;
  }

  t(key, values) {
    return this.#translate(key, values);
  }

  #resolveDeviceTypes(pc) {
    if (this.#graphicsSettingsStore.driver === GRAPHICS_DRIVER.WEBGPU) {
      return [pc.DEVICETYPE_WEBGPU];
    }
    if (this.#graphicsSettingsStore.driver === GRAPHICS_DRIVER.WEBGL2) {
      return [pc.DEVICETYPE_WEBGL2];
    }
    return [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2];
  }

  async init() {
    // Keep WebGPU validation scopes out of the render loop. The package's
    // development export is intentionally diagnostic and is far too costly
    // for this continuously rendered game, even when Quasar runs in dev mode.
    this.#pc = await import("playcanvas/build/playcanvas/src/index.js");
    const pc = this.#pc;

    const graphicsDevice = await pc.createGraphicsDevice(this.canvas, {
      deviceTypes: this.#resolveDeviceTypes(pc),
      glslangUrl: GLSLANG_URL,
      twgslUrl: TWGSL_URL,
      antialias: this.#graphicsSettingsStore.antialias,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: this.#graphicsSettingsStore.powerPreference,
    });
    this.#app = new pc.Application(this.canvas, { graphicsDevice });
    this.#app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.#app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.#app.graphicsDevice.maxPixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.#graphicsSettingsStore.maxPixelRatio,
    );

    this.#app.scene.ambientLight = new pc.Color(0.5, 0.57, 0.64);
    this.#cloudLayer = new pc.Layer({ name: "Cloud backdrop" });
    this.#app.scene.layers.insert(this.#cloudLayer, 0);
    this.#app.on("update", this.#updateFrame);
    this.#modelLibrary = new GameModelLibrary({ pc, app: this.#app });
    this.#cubeMeshes = this.#createCubeMeshes();
    this.#pathArrows = new PathArrows({
      pc,
      app: this.#app,
      colors: this.#gatewayColors,
    });
    this.#debugFpsHud = new DebugFpsHud({
      pc,
      app: this.#app,
      theme: this.#uiTheme,
    });
    this.#debugFpsHud.attach();
    this.#debugAxesHud = new DebugAxesHud({
      pc,
      app: this.#app,
      gameCanvas: this,
      theme: this.#uiTheme,
    });
    this.#debugAxesHud.attach();
    this.#lifeHud = new HeroLifeHud({
      pc,
      app: this.#app,
      theme: this.#uiTheme,
    });
    this.#lifeHud.attach();
    this.#coinHud = new CoinHud({
      pc,
      app: this.#app,
      theme: this.#uiTheme,
    });
    this.#coinHud.attach();
    this.#inventoryHud = new InventoryHud({
      pc,
      app: this.#app,
      modelLibrary: this.#modelLibrary,
      translate: this.#translate,
      theme: this.#uiTheme,
      onMoveItem: (fromSlot, toSlot) =>
        this.#moveInventoryItem(fromSlot, toSlot),
      onDropItem: (slot, clientX, clientY) =>
        this.#dropInventoryItem(slot, clientX, clientY),
    });
    this.#inventoryHud.attach();
    this.#inventoryHud.visible = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    this.#gameOverHud = new GameOverHud({
      pc,
      app: this.#app,
      translate: this.#translate,
      theme: this.#uiTheme,
    });
    this.#gameOverHud.attach();

    this.#camera = new pc.Entity("Isometric camera");
    this.#camera.addComponent("camera", {
      clearColor: new pc.Color(0.055, 0.45, 0.72),
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      nearClip: 0.1,
      farClip: 250,
    });
    this.#camera.camera.layers = [
      this.#cloudLayer.id,
      ...this.#camera.camera.layers,
    ];
    this.#app.root.addChild(this.#camera);

    const sunlight = new pc.Entity("Sunlight");
    sunlight.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 0.93, 0.8),
      intensity: 2.1,
      castShadows: this.#graphicsSettingsStore.shadows,
      shadowType: pc.SHADOW_PCF5,
      shadowDistance: SHADOW_DISTANCE,
      shadowResolution: this.#graphicsSettingsStore.shadowResolution,
      shadowIntensity: 0.72,
      shadowBias: 0.18,
      normalOffsetBias: 0.035,
      numCascades: 1,
    });
    sunlight.setEulerAngles(48, 132, 0);
    this.#app.root.addChild(sunlight);

    await Promise.all([
      this.#createMaterials(),
      this.#modelLibrary.load([
        Hero.modelUrl,
        AxeTool.modelUrl,
        KnifeTool.modelUrl,
        ShovelTool.modelUrl,
        InventoryHud.modelUrl,
        Gateway.modelUrl,
        ...Castle.modelUrls,
        ...GroundCover.modelUrls,
        ...VoxelVegetation.modelUrls,
        ...BuriedTreasureField.modelUrls,
        ...RiverWater.modelUrls,
      ]),
    ]);
    this.resize();
    this.#applyDebugSettings();
    this.#stopDebugStoreSubscription = this.#debugStore.$subscribe(() => {
      this.#applyDebugSettings();
    });
    this.#app.start();
    this.#connectBannerInteraction();
  }

  render(mapData) {
    const initialViewport = this.#mapData
      ? null
      : { ...this.#gameViewStore.viewport };
    this.#inventoryHud.visible = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    this.#mapData = mapData;
    this.#cameraPanBounds = new CameraPanBounds(mapData);
    this.#gameOverReturnViewport = null;
    this.#zoom = 1;
    this.#rotation = 0;
    this.#panX = 0;
    this.#panZ = 0;
    this.#cameraTargetY = CAMERA_TARGET_HEIGHT;
    this.#viewportManuallyMoved = false;
    this.#heroCameraReturnTransition = null;
    this.#gameOverCameraTransition = null;
    this.#gameOverCameraLocked = false;
    this.#updateFitCenter();
    this.#panX = this.#fitCenterX;
    this.#panZ = this.#fitCenterZ;
    this.#rebuildScene();
    this.#fitCamera();
    this.#updateCamera();
    this.#heroVisibility?.schedule();
    if (initialViewport) {
      this.setViewport(initialViewport);
      this.#viewportPersistenceEnabled = true;
      this.#saveViewport();
    }
  }

  #applyDebugSettings() {
    this.pathArrowsVisible = this.#debugStore.pathArrows;
    this.debugAxesHudVisible = this.#debugStore.debugAxesHud;
    this.debugFpsHudVisible = this.#debugStore.debugFpsHud;
  }

  set pathArrowsVisible(visible) {
    this.#pathArrowsVisible = Boolean(visible);
    if (this.#pathArrows) {
      this.#pathArrows.visible = this.#pathArrowsVisible;
    }
  }

  get pathArrowsVisible() {
    return this.#pathArrowsVisible;
  }

  set debugAxesHudVisible(visible) {
    this.#debugAxesHudVisible = Boolean(visible);
    if (this.#debugAxesHud) {
      this.#debugAxesHud.visible = this.#debugAxesHudVisible;
    }
  }

  get debugAxesHudVisible() {
    return this.#debugAxesHudVisible;
  }

  set debugFpsHudVisible(visible) {
    this.#debugFpsHudVisible = Boolean(visible);
    if (this.#debugFpsHud) {
      this.#debugFpsHud.visible = this.#debugFpsHudVisible;
    }
  }

  get debugFpsHudVisible() {
    return this.#debugFpsHudVisible;
  }

  set arrowsVisible(visible) {
    const nextVisible = Boolean(visible);
    this.pathArrowsVisible = nextVisible;
    this.debugAxesHudVisible = nextVisible;
    this.debugFpsHudVisible = nextVisible;
  }

  get arrowsVisible() {
    return (
      this.#pathArrowsVisible ||
      this.#debugAxesHudVisible ||
      this.#debugFpsHudVisible
    );
  }

  get zoom() {
    return this.#zoom;
  }

  get canPan() {
    return !this.#gameOverCameraLocked && this.#zoom > MAP_FIT_ZOOM;
  }

  get rotation() {
    return this.#rotation;
  }

  get windSpeed() {
    return this.#cloudField?.windSpeed ?? 0;
  }

  get graphicsBackend() {
    return this.#app?.graphicsDevice?.deviceType ?? null;
  }

  get framesPerSecond() {
    return this.#debugFpsHud?.framesPerSecond ?? 0;
  }

  get heroState() {
    if (!this.#hero) {
      return null;
    }
    return {
      position: this.#hero.position,
      animation: this.#hero.animationState,
      animationTransitioning: this.#hero.animationTransitioning,
      grounded: this.#hero.grounded,
      drowning: this.#hero.drowning,
      burning: this.#hero.burning,
      ashes: this.#hero.ashes,
      facing: this.#hero.facingDirection,
      headLookYaw: this.#hero.headLookYaw,
      footPlacement: this.#hero.footPlacementState,
      wallet: this.#hero.wallet,
      inventory: this.inventoryState,
    };
  }

  get inventoryState() {
    return {
      ...(this.#hero?.inventory ?? {
        capacity: Hero.inventoryCapacity,
        items: [],
      }),
      visible: this.#inventoryHud?.visible ?? false,
    };
  }

  get inventoryVisible() {
    return this.#inventoryHud?.visible ?? false;
  }

  get inventoryFullReactionVisible() {
    return this.#inventoryHud?.fullReactionVisible ?? false;
  }

  get thrownInventoryItemCount() {
    return this.#thrownInventoryItems.length;
  }

  get wind() {
    return (
      this.#cloudField?.wind ?? {
        direction: { x: 0, y: 0, z: 0 },
        speed: 0,
      }
    );
  }

  get debugDirections() {
    if (!this.#pc || !this.#camera?.camera) {
      return null;
    }
    const pc = this.#pc;
    const origin = this.#camera.camera.worldToScreen(new pc.Vec3(0, 0, 0));
    const projectDirection = (point) => {
      const endpoint = this.#camera.camera.worldToScreen(point);
      const x = endpoint.x - origin.x;
      const y = endpoint.y - origin.y;
      const length = Math.max(0.0001, Math.hypot(x, y));
      return { x: x / length, y: y / length };
    };

    return {
      x: projectDirection(new pc.Vec3(1, 0, 0)),
      y: projectDirection(new pc.Vec3(0, 0, 1)),
      z: projectDirection(new pc.Vec3(0, 1, 0)),
    };
  }

  getGatewayColor(index = 0) {
    return this.#gatewayColors[index % this.#gatewayColors.length];
  }

  setGatewayColor(color, index = 0) {
    const paletteIndex = index % this.#gatewayColors.length;
    this.#gatewayColors[paletteIndex] = color;
    this.#gateways[index]?.setColor(color);
    this.#pathArrows?.setColor(paletteIndex, color);
  }

  setGatewayColors(colors) {
    if (!Array.isArray(colors) || colors.length === 0) {
      return;
    }
    this.#gatewayColors = [...colors];
    this.#gateways.forEach((gateway, index) => {
      const color = colors[index % colors.length];
      gateway.setColor(color);
    });
    this.#pathArrows?.setColors(colors);
  }

  get viewport() {
    return {
      zoom: this.#zoom,
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      manuallyMoved: this.#viewportManuallyMoved,
    };
  }

  get mapVisibility() {
    return (
      this.#cameraPanBounds?.visibility(this.#cameraView) ?? {
        safeVisibleTileCenters: 0,
        totalTileCenters: 0,
        insetPixels: 0,
        panWithinBounds: true,
      }
    );
  }

  get cameraReturningToHero() {
    return this.#heroCameraReturnTransition !== null;
  }

  setHeroMovement(inputX, inputY, running = false) {
    this.#hero?.setMovement(inputX, inputY, running);
    if (inputX === 0 && inputY === 0) {
      return false;
    }
    return this.#startHeroCameraReturn();
  }

  returnCameraToHero() {
    return this.#startHeroCameraReturn(true);
  }

  jumpHero() {
    this.#hero?.jump();
  }

  isGameOver() {
    return this.#hero?.isGameOver ?? false;
  }

  get gameOverReturnViewport() {
    return this.#gameOverReturnViewport
      ? { ...this.#gameOverReturnViewport }
      : this.viewport;
  }

  dodgeHero(inputX, inputY, direction) {
    return this.#hero?.dodge(inputX, inputY, direction) ?? false;
  }

  interact() {
    if (this.inventoryVisible || !this.#interactionTarget?.canInteract) {
      return false;
    }
    return this.#interactionTarget.interact();
  }

  toggleInventory() {
    if (this.isGameOver()) {
      return false;
    }
    if (this.inventoryVisible) {
      return this.closeInventory();
    }
    this.#setInventoryVisible(true);
    this.#setInteractionTarget(null);
    return true;
  }

  closeInventory() {
    if (!this.inventoryVisible) {
      return false;
    }
    this.#setInventoryVisible(false);
    this.#updateInteractionTarget();
    return true;
  }

  #setInventoryVisible(visible) {
    const nextVisible = Boolean(visible);
    this.#inventoryHud.visible = nextVisible;
    this.#heroConfigurationStore.setInventoryVisible(nextVisible);
    if (!nextVisible) {
      this.#fadeThrownInventoryItems();
    }
  }

  #moveInventoryItem(fromSlot, toSlot) {
    const moved =
      this.#heroConfigurationStore.moveInventoryItem(fromSlot, toSlot);
    if (moved) {
      this.#inventoryHud?.setInventory(this.inventoryState);
    }
    return moved;
  }

  #dropInventoryItem(slot) {
    const inventoryItem = this.#heroConfigurationStore.inventory.items.find(
      (item) => item.slot === slot,
    );
    if (!inventoryItem?.modelUrl || !this.#hero || !this.#mapRoot) {
      return null;
    }
    const thrownItem = new ThrownInventoryItem({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      item: inventoryItem,
      position: this.#hero.position,
      direction: this.#hero.facingDirection,
    });
    const droppedItem =
      this.#heroConfigurationStore.dropInventoryItem(slot);
    if (!droppedItem) {
      thrownItem.destroy();
      return null;
    }
    this.#mapRoot.addChild(thrownItem.entity);
    this.#thrownInventoryItems.push(thrownItem);
    this.#inventoryHud?.setInventory(this.inventoryState);
    return droppedItem;
  }

  #fadeThrownInventoryItems() {
    for (const thrownItem of this.#thrownInventoryItems) {
      thrownItem.beginFade();
    }
  }

  pressInventoryPointer(clientX, clientY) {
    return this.#inventoryHud?.pointerDown(clientX, clientY) ?? false;
  }

  moveInventoryPointer(clientX, clientY) {
    return this.#inventoryHud?.pointerMove(clientX, clientY) ?? false;
  }

  releaseInventoryPointer(clientX, clientY) {
    if (!this.inventoryVisible) {
      return false;
    }
    const shouldClose = this.#inventoryHud.pointerUp(clientX, clientY);
    return shouldClose ? this.closeInventory() : false;
  }

  leaveInventoryPointer() {
    this.#inventoryHud?.pointerLeave();
  }

  cancelInventoryPointer() {
    this.#inventoryHud?.cancelPointer();
  }

  setViewport({
    zoom,
    rotation = 0,
    panX = 0,
    panZ = 0,
    manuallyMoved = false,
  }) {
    if (this.#gameOverCameraLocked) {
      return;
    }
    this.#heroCameraReturnTransition = null;
    this.#zoom = Math.max(MAP_FIT_ZOOM, zoom);
    this.#rotation = rotation;
    this.#updateFitCenter();
    const fitted = this.#zoom === MAP_FIT_ZOOM;
    this.#panX = fitted ? this.#fitCenterX : panX;
    this.#panZ = fitted ? this.#fitCenterZ : panZ;
    this.#viewportManuallyMoved = fitted ? false : manuallyMoved;
    this.#updateCamera();
  }

  zoomTo(newZoom, pivotX, pivotY) {
    if (this.#gameOverCameraLocked) {
      return;
    }
    this.#heroCameraReturnTransition = null;
    const previousZoom = this.#zoom;
    const constrainedZoom = Math.max(MAP_FIT_ZOOM, newZoom);
    const before = this.#screenOffsetToGround(pivotX, pivotY, this.#zoom);
    const after = this.#screenOffsetToGround(pivotX, pivotY, constrainedZoom);
    this.#panX += before.x - after.x;
    this.#panZ += before.z - after.z;
    this.#zoom = constrainedZoom;

    if (constrainedZoom < previousZoom) {
      const previousDistance = previousZoom - MAP_FIT_ZOOM;
      const nextDistance = constrainedZoom - MAP_FIT_ZOOM;
      const centerRetention =
        previousDistance > 0 ? nextDistance / previousDistance : 0;
      this.#panX =
        this.#fitCenterX + (this.#panX - this.#fitCenterX) * centerRetention;
      this.#panZ =
        this.#fitCenterZ + (this.#panZ - this.#fitCenterZ) * centerRetention;
    }
    if (constrainedZoom === MAP_FIT_ZOOM) {
      this.#panX = this.#fitCenterX;
      this.#panZ = this.#fitCenterZ;
      this.#viewportManuallyMoved = false;
    }
    this.#updateCamera();
  }

  panBy(deltaX, deltaY) {
    if (this.#gameOverCameraLocked) {
      return;
    }
    this.#heroCameraReturnTransition = null;
    this.#grassSurface?.applyViewInteraction(deltaX, deltaY);
    if (this.#zoom <= MAP_FIT_ZOOM) {
      this.#panX = this.#fitCenterX;
      this.#panZ = this.#fitCenterZ;
      this.#viewportManuallyMoved = false;
      this.#updateCamera();
      return;
    }
    const panOrigin = { x: this.#panX, z: this.#panZ };
    const offset = this.#screenDeltaToGround(deltaX, deltaY, this.#zoom);
    this.#panX -= offset.x;
    this.#panZ -= offset.z;
    this.#viewportManuallyMoved = true;
    this.#updateCamera(panOrigin);
  }

  rotateBy(quarterTurns) {
    if (this.#gameOverCameraLocked) {
      return this.#rotation;
    }
    this.#heroCameraReturnTransition = null;
    this.#grassSurface?.applyViewInteraction(quarterTurns * 18, 0);
    this.#rotation = (((this.#rotation + quarterTurns) % 4) + 4) % 4;
    this.#updateCamera();
    this.#heroVisibility?.schedule();
    return this.#rotation;
  }

  resize() {
    if (!this.#app || !this.container) {
      return;
    }
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.#app.resizeCanvas(width, height);
    this.#debugAxesHud?.resize(width, height);
    this.#debugFpsHud?.resize(width, height);
    this.#fitCamera();
    this.#updateCamera();
    if (!this.#gameOverCameraLocked) this.#heroVisibility?.schedule();
  }

  get canvasElement() {
    return this.canvas;
  }

  destroy() {
    this.#stopDebugStoreSubscription?.();
    this.#stopDebugStoreSubscription = null;
    if (this.#viewportSaveTimer !== null) {
      window.clearTimeout(this.#viewportSaveTimer);
      this.#saveViewport();
    }
    this.#disconnectBannerInteraction();
    this.#app?.off("update", this.#updateFrame);
    this.#clearScene();
    this.#pathArrows?.destroy();
    this.#pathArrows = null;
    this.#debugAxesHud?.destroy();
    this.#debugAxesHud = null;
    this.#debugFpsHud?.destroy();
    this.#debugFpsHud = null;
    this.#lifeHud?.destroy();
    this.#lifeHud = null;
    this.#coinHud?.destroy();
    this.#coinHud = null;
    this.#inventoryHud?.destroy();
    this.#inventoryHud = null;
    this.#gameOverHud?.destroy();
    this.#gameOverHud = null;
    this.#uiTheme = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    for (const asset of this.#textureAssets) {
      asset.unload();
      this.#app?.assets.remove(asset);
    }
    this.#textureAssets = [];
    this.#castleFireParticleTexture = null;
    if (this.#cubeMeshes) {
      this.#destroyMesh(this.#cubeMeshes.sides);
      this.#destroyMesh(this.#cubeMeshes.wallSides);
      this.#destroyMesh(this.#cubeMeshes.bridgeHorizontalSides);
      this.#destroyMesh(this.#cubeMeshes.bridgeVerticalSides);
      this.#destroyMesh(this.#cubeMeshes.underlay);
      for (const slope of Object.values(this.#cubeMeshes.slopes)) {
        this.#destroyMesh(slope.sides);
        this.#destroyMesh(slope.surface);
      }
      for (const mesh of Object.values(this.#cubeMeshes.surfaces)) {
        this.#destroyMesh(mesh);
      }
    }
    this.#cubeMeshes = null;
    this.#modelLibrary?.destroy();
    this.#modelLibrary = null;
    if (this.#cloudLayer) {
      this.#app?.scene.layers.remove(this.#cloudLayer);
      this.#cloudLayer = null;
    }
    this.#app?.destroy();
    this.#app = null;
  }

  async #createMaterials() {
    const textures = new Map();
    await Promise.all(
      Object.entries(TEXTURE_URLS).map(async ([name, url]) => {
        textures.set(name, await this.#loadTexture(name, url));
      }),
    );
    this.#castleFireParticleTexture = textures.get("castleFireParticle");
    for (const [name, definition] of Object.entries(MATERIAL_DEFINITIONS)) {
      this.#materials.set(
        name,
        this.#createMaterial(name, definition, textures),
      );
    }

    for (const [name, definition] of Object.entries(SIDE_VARIANT_DEFINITIONS)) {
      SIDE_VARIANT_TRANSFORMS.forEach((transform, index) => {
        const variantName = `${name}-${index}`;
        this.#materials.set(
          variantName,
          this.#createMaterial(
            variantName,
            {
              ...definition,
              ...transform,
              color: definition.colors[index],
            },
            textures,
          ),
        );
      });
    }

    EARTH_SIDE_DEPTH_SHADES.forEach((shade, depth) => {
      EARTH_SIDE_TEXTURE_TRANSFORMS.forEach((transform, variant) => {
        const name = `earthSide-depth-${depth}-${variant}`;
        this.#materials.set(
          name,
          this.#createMaterial(
            name,
            {
              color: shadeHexColor(0xffffff, shade),
              texture: "earthSide",
              gloss: 0.08,
              ...transform,
            },
            textures,
          ),
        );
      });
      EARTH_DETAIL_TEXTURE_TRANSFORMS.forEach((transform, variant) => {
        const name = `earthDetailSide-depth-${depth}-${variant}`;
        this.#materials.set(
          name,
          this.#createMaterial(
            name,
            {
              color: shadeHexColor(0xffffff, shade),
              texture: "earthSide",
              gloss: 0.08,
              ...transform,
            },
            textures,
          ),
        );
      });
      GRASS_EARTH_SIDE_TRANSFORMS.forEach((transform, variant) => {
        const earthName = `grassEarthSide-depth-${depth}-${variant}`;
        this.#materials.set(
          earthName,
          this.#createMaterial(
            earthName,
            {
              color: shadeHexColor(0xffffff, shade),
              texture: "grassSide",
              gloss: 0.05,
              ...transform,
            },
            textures,
          ),
        );
        const topName = `grassTopSide-depth-${depth}-${variant}`;
        this.#materials.set(
          topName,
          this.#createMaterial(
            topName,
            {
              color: shadeHexColor(0xffffff, shade),
              texture: "grassSide",
              gloss: 0.05,
              ...SIDE_VARIANT_TRANSFORMS[variant],
            },
            textures,
          ),
        );
      });
      OVERPASS_EARTH_SIDE_TRANSFORMS.forEach((transform, variant) => {
        const name = `overpassEarthSide-depth-${depth}-${variant}`;
        this.#materials.set(
          name,
          this.#createMaterial(
            name,
            {
              color: shadeHexColor(0xffffff, shade),
              texture: "grassSide",
              gloss: 0.05,
              ...transform,
            },
            textures,
          ),
        );
      });
    });

    GRASS_TOP_VARIANTS.forEach((variant, index) => {
      const name = `grass-${index}`;
      this.#materials.set(
        name,
        this.#createMaterial(
          name,
          { ...MATERIAL_DEFINITIONS.grass, ...variant },
          textures,
        ),
      );
    });
  }

  #createMaterial(name, definition, textures = new Map()) {
    const pc = this.#pc;
    const material = new pc.StandardMaterial();
    material.name = name;
    material.diffuse = colorFromHex(pc, definition.color);
    material.gloss = definition.gloss ?? 0.08;
    material.metalness = 0;
    material.useMetalness = true;
    material.useLighting = definition.useLighting ?? true;
    if (definition.texture) {
      material.diffuseMap = textures.get(definition.texture) ?? null;
      if (definition.scaleU || definition.scaleV) {
        const scaleU = definition.scaleU ?? 1;
        const scaleV = definition.scaleV ?? 1;
        const tilingU = definition.flipU ? -scaleU : scaleU;
        const offsetU = definition.flipU
          ? definition.startU + scaleU
          : definition.startU;
        material.diffuseMapTiling = new pc.Vec2(tilingU, scaleV);
        material.diffuseMapOffset = new pc.Vec2(
          offsetU,
          definition.startV === undefined ? 0 : 1 - scaleV - definition.startV,
        );
      }
    }
    if (definition.emissive) {
      material.emissive = colorFromHex(pc, definition.emissive);
      material.emissiveIntensity = definition.emissiveIntensity ?? 0.45;
    }
    if (definition.opacity !== undefined) {
      material.opacity = definition.opacity;
      material.blendType = pc.BLEND_NORMAL;
      material.depthWrite = false;
    }
    if (definition.continuousTexture) {
      material.shaderChunks.glsl.set("diffusePS", grassTerrainFragmentShader);
      material.setParameter("uGrassHeroPosition", [0, -1000, 0]);
      material.setParameter("uGrassHeroDirection", [0, 1]);
      material.setParameter("uGrassHeroInfluence", 0);
      material.setParameter("uGrassMotionInfluence", 0);
    }
    material.update();
    return material;
  }

  #loadTexture(name, url) {
    const pc = this.#pc;
    const asset = new pc.Asset(name, "texture", { url });
    this.#textureAssets.push(asset);
    this.#app.assets.add(asset);

    return new Promise((resolve, reject) => {
      asset.ready((loadedAsset) => {
        loadedAsset.resource.mipmaps = this.#graphicsSettingsStore.mipmaps;
        loadedAsset.resource.minFilter = this.#graphicsSettingsStore.mipmaps
          ? pc.FILTER_LINEAR_MIPMAP_LINEAR
          : pc.FILTER_LINEAR;
        loadedAsset.resource.magFilter = pc.FILTER_LINEAR;
        loadedAsset.resource.anisotropy =
          this.#graphicsSettingsStore.anisotropy;
        const addressMode =
          name === "grass"
            ? pc.ADDRESS_MIRRORED_REPEAT
            : pc.ADDRESS_CLAMP_TO_EDGE;
        loadedAsset.resource.addressU = addressMode;
        loadedAsset.resource.addressV = addressMode;
        resolve(loadedAsset.resource);
      });
      asset.once("error", reject);
      this.#app.assets.load(asset);
    });
  }

  #rebuildScene() {
    this.#clearScene();
    this.#mapRoot = new this.#pc.Entity("Voxel map");
    this.#app.root.addChild(this.#mapRoot);
    this.#floatingIslandMotion = new FloatingIslandMotion({
      app: this.#app,
      entity: this.#mapRoot,
      zoom: this.#zoom,
    });

    const scenery = new SkyIslandScenery(this.#mapData);
    const cubeBatches = new Map();
    this.#buildIslandUndersideMatrices(
      cubeBatches,
      scenery.createUndersideVoxels(),
    );
    this.#buildTerrainMatrices(cubeBatches);
    this.#createInstancedBatches(cubeBatches, this.#mapRoot, true);
    if (this.#mapData.overpassData) {
      this.#pathOverpassCollider = new PathOverpassCollider({
        overpass: this.#mapData.overpassData,
        cols: this.#mapData.cols,
        rows: this.#mapData.rows,
      });
      this.#collisionWorld.add(this.#pathOverpassCollider);
    }
    this.#riverWater = new RiverWater({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
    });
    this.#mapRoot.addChild(this.#riverWater.entity);
    this.#grassSurface = new GrassSurface({
      app: this.#app,
      terrainMaterials: [
        this.#materials.get("grass"),
        this.#materials.get("grass-0"),
      ].filter(Boolean),
    });

    this.#cloudField = new CubeCloudField({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      layerId: this.#cloudLayer.id,
    });
    this.#app.root.addChild(this.#cloudField.entity);
    this.#buildCastle();
    this.#lifeHud?.setCastleLives(
      this.#castle ? MAX_CASTLE_LIVES : 0,
      MAX_CASTLE_LIVES,
    );
    this.#buildGateways();
    this.#buildVegetation();
    this.#buildGroundCover();
    this.#buildBuriedTreasure();
    this.#buildHero();
    this.#buildTools();
    this.#updateInteractionTarget();

    this.#mapRoot.addChild(this.#pathArrows.render(this.#mapData));
    this.#captureCameraVisualBounds();
  }

  #captureCameraVisualBounds() {
    this.#mapRoot?.syncHierarchy();
    const roots = [
      {
        name: "castle",
        protectAtPanLimit: true,
        centerReachableAtEveryZoom: true,
        root: this.#castle?.entity,
      },
      ...this.#gateways.map((gateway, index) => ({
        name: `gateway-${index}`,
        protectAtPanLimit: true,
        root: gateway.entity,
      })),
      { name: "vegetation", root: this.#vegetation?.entity },
      { name: "ground-cover", root: this.#groundCover?.entity },
    ].filter(({ root }) => root);
    for (const {
      name,
      protectAtPanLimit,
      centerReachableAtEveryZoom,
      root,
    } of roots) {
      for (const render of root.findComponents("render")) {
        for (const meshInstance of render.meshInstances) {
          const { center, halfExtents } = meshInstance.aabb;
          this.#cameraPanBounds?.addVisualBounds(center, halfExtents, {
            group: name,
            protectAtPanLimit,
            centerReachableAtEveryZoom,
          });
        }
      }
    }
  }

  #buildHero() {
    this.#hero = new Hero({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      spawnCenter: { x: this.#fitCenterX, z: this.#fitCenterZ },
      getViewRotation: () => this.#rotation,
      onPositionChange: this.#handleHeroPositionChange,
      onFacingChange: this.#handleHeroFacingChange,
      onStateChange: this.#handleHeroStateChange,
      onInventoryFull: this.#handleInventoryFull,
      heroConfigurationStore: this.#heroConfigurationStore,
      getGatewayRepulsion: this.#getGatewayRepulsion,
      collisionWorld: this.#collisionWorld,
      modelLibrary: this.#modelLibrary,
    });
    this.#mapRoot.addChild(this.#hero.entity);
    this.#heroVisibility = new HeroVisibilityController({
      pc: this.#pc,
      app: this.#app,
      canvas: this.canvas,
      camera: this.#camera.camera,
      hero: this.#hero.entity,
      getRotation: () => this.#rotation,
      setRotation: (rotation) => {
        if (this.#gameOverCameraLocked || this.#hero?.isInDeathSequence) {
          return;
        }
        this.#rotation = rotation;
        this.#updateCamera();
      },
      shouldPreserveRotation: () => {
        const position = this.#hero?.position;
        if (!position || !this.#pathOverpassCollider) {
          return false;
        }
        return this.#pathOverpassCollider.isBelowDeckAt(
          position.x,
          position.z,
          position.y,
          HERO_BRIDGE_VISIBILITY_RADIUS,
        );
      },
    });
    this.#castle?.updateHeroPosition(this.#hero.position);
    this.#groundCover?.applyHeroInteraction(
      this.#hero.position,
      this.#hero.movementState,
    );
    this.#grassSurface?.applyHeroInteraction(
      this.#hero.position,
      this.#hero.movementState,
    );
    this.#buriedTreasure?.applyHeroPosition(this.#hero.position);
  }

  #buildTools() {
    this.#axeTool = new AxeTool({ modelLibrary: this.#modelLibrary });
    this.#knifeTool = new KnifeTool({ modelLibrary: this.#modelLibrary });
    this.#shovelTool = new ShovelTool({ modelLibrary: this.#modelLibrary });
    this.#groundCover.tool = this.#knifeTool;
    this.#vegetation.tool = this.#axeTool;
    this.#buriedTreasure.tool = this.#shovelTool;
    this.#interactionProviders = [
      this.#groundCover,
      this.#vegetation,
      this.#buriedTreasure,
    ];
  }

  #buildVegetation() {
    this.#vegetation = new VoxelVegetation({
      pc: this.#pc,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      onVegetationRemoved: (vegetation) =>
        this.#buriedTreasure?.removeVegetation(vegetation),
    });
    this.#collisionWorld.add(this.#vegetation);
    this.#mapRoot.addChild(this.#vegetation.entity);
  }

  #buildGroundCover() {
    this.#groundCover = new GroundCover({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      onCollect: (item) =>
        this.#hero?.collectInventoryItem(item) ?? false,
      onCollectibleRemoved: (groundCover) =>
        this.#buriedTreasure?.removeGroundCover(groundCover),
    });
    this.#mapRoot.addChild(this.#groundCover.entity);
  }

  #buildBuriedTreasure() {
    this.#buriedTreasure = new BuriedTreasureField({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      onCollectCoin: (type, amount) =>
        this.#hero?.collectCoin(type, amount),
      onInteractionChange: () => this.#updateInteractionTarget(),
    });
    this.#collisionWorld.add(this.#buriedTreasure);
    this.#mapRoot.addChild(this.#buriedTreasure.entity);
  }

  #buildGateways() {
    const { entries = [], cols, rows } = this.#mapData;
    const signs = [...GATEWAY_BANNER_SIGNS];
    for (let index = signs.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [signs[index], signs[swapIndex]] = [signs[swapIndex], signs[index]];
    }
    entries.forEach((entry, index) => {
      const gateRows = entry.rows ?? [entry.row, entry.row + 1];
      const x = entry.col - (cols - 1) / 2;
      const z =
        gateRows.reduce((sum, row) => sum + row, 0) / gateRows.length -
        (rows - 1) / 2;
      const groundHeight = Math.max(
        ...gateRows.map((row) => this.#tileHeight(entry.col, row)),
      );
      const gateway = new Gateway({
        pc: this.#pc,
        app: this.#app,
        color: entry.color ?? this.getGatewayColor(index),
        cubeSize: CUBE_SCALE / 4,
        surfaceLift: GRASS_SURFACE_LIFT,
        symbol: signs[index % signs.length],
        modelLibrary: this.#modelLibrary,
      });
      this.#collisionWorld.add(gateway);
      this.#pathArrows.setColor(
        index,
        entry.color ?? this.getGatewayColor(index),
      );
      gateway.entity.setPosition(x, groundHeight, z);
      if (entry.side === "RIGHT") gateway.entity.setEulerAngles(0, 180, 0);
      this.#mapRoot.addChild(gateway.entity);
      this.#gateways.push(gateway);
    });
  }

  #buildCastle() {
    const { castle, cols, rows, heightmap } = this.#mapData;
    if (!castle?.position || !castle.doors?.length) {
      return;
    }

    this.#castle = new Castle({
      pc: this.#pc,
      app: this.#app,
      position: {
        x: castle.position.col - (cols - 1) / 2 - CUBE_SCALE / 2,
        z: castle.position.row - (rows - 1) / 2 - CUBE_SCALE / 2,
        width: castle.position.width,
        depth: castle.position.depth,
        elevation: castle.position.elevation + GRASS_SURFACE_LIFT,
      },
      doors: castle.doors.map(({ side, offset, width, cells = [] }) => {
        const approachElevations = cells
          .map(({ col, row }) => heightmap?.[row]?.[col])
          .filter(Number.isFinite);
        return {
          side,
          offset,
          width,
          approachElevation: approachElevations.length
            ? Math.max(...approachElevations)
            : castle.position.elevation + GRASS_SURFACE_LIFT,
        };
      }),
      style: castle.style,
      occupantSeed: castle.occupantSeed,
      modelLibrary: this.#modelLibrary,
      fireParticleTexture: this.#castleFireParticleTexture,
    });
    this.#collisionWorld.add(this.#castle);
    this.#mapRoot.addChild(this.#castle.entity);
  }

  #buildTerrainMatrices(batches) {
    const { grid, heightmap, tileMeta, cols, rows } = this.#mapData;
    const processedBridgeCells = new Set();
    const riverCells = new Map(
      (this.#mapData.riverData ?? []).flatMap((river) =>
        river.cells.map((cell) => [`${cell.col},${cell.row}`, cell]),
      ),
    );
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const type = grid[row][col];
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        const renderMode = tileMeta?.[row]?.[col]?.renderMode ?? "SOLID";
        const height =
          type in FIXED_HEIGHTS ? FIXED_HEIGHTS[type] : heightmap[row][col];

        if (type === TileType.WATER) {
          const riverCell = riverCells.get(`${col},${row}`);
          if (riverCell && !riverCell.underBridge) {
            const riverbedHeight = riverCell.bedElevation;
            if (riverbedHeight > 0.01) {
              this.#addBoxMatrix(
                batches,
                "earth",
                this.#earthSideMaterial(col, row, riverbedHeight - 1),
                x,
                riverbedHeight / 2,
                z,
                0,
                CUBE_SCALE,
                riverbedHeight,
                CUBE_SCALE,
                "full",
                "earth",
              );
            }
          }
          continue;
        }

        const slope = tileMeta?.[row]?.[col]?.slope;
        if (tileMeta?.[row]?.[col]?.shape === TILE_SHAPE.SLOPE && slope) {
          const baseHeight = Math.floor(
            Math.min(slope.lowHeight, slope.highHeight),
          );
          for (let level = 0; level < baseHeight; level += 1) {
            this.#addCubeMatrix(
              batches,
              "earth",
              this.#pathEarthSideMaterial(col, row, level),
              x,
              level + 0.5,
              z,
              "wallSidesOnly",
              level === 0 ? "earth" : "none",
            );
          }
          const stage =
            Math.min(slope.lowHeight, slope.highHeight) - baseHeight < 0.25
              ? "Lower"
              : "Upper";
          const coverage = `slope${slope.riseDirection}${stage}`;
          this.#addBoxMatrix(
            batches,
            SURFACE_MATERIALS[type],
            this.#pathEarthSideMaterial(col, row, baseHeight),
            x,
            baseHeight,
            z,
            0,
            CUBE_SCALE,
            CUBE_SCALE,
            CUBE_SCALE,
            coverage,
            "none",
          );
          continue;
        }

        if (renderMode === "BRIDGE") {
          const bridgeKey = `${col},${row}`;
          if (processedBridgeCells.has(bridgeKey)) {
            continue;
          }
          const direction = tileMeta[row][col].direction;
          const span = this.#collectBridgeSpan(
            grid,
            heightmap,
            tileMeta,
            col,
            row,
            direction,
          );
          const railingMaterial = this.#sideVariant(
            SIDE_MATERIALS[type],
            col,
            row,
            height - 1,
          );
          const fasciaMaterial = tileMeta[row][col].overpassId
            ? this.#pathEarthSideMaterial(col, row, height - 1)
            : railingMaterial;
          for (const cell of span.cells) {
            processedBridgeCells.add(`${cell.col},${cell.row}`);
            const groundHeight = tileMeta[cell.row][cell.col].bridgeGroundHeight;
            if (Number.isFinite(groundHeight)) {
              this.#addBridgeGround(
                batches,
                cell.col,
                cell.row,
                groundHeight,
                cols,
                rows,
                Boolean(tileMeta[cell.row][cell.col].overpassId),
              );
            }
          }
          for (let position = span.start; position <= span.end; position += 1) {
            const deckCenterCol = span.horizontal ? position : span.crossCenter;
            const deckCenterRow = span.horizontal ? span.crossCenter : position;
            this.#addBoxMatrix(
              batches,
              SURFACE_MATERIALS[type],
              fasciaMaterial,
              deckCenterCol - (cols - 1) / 2,
              height - 0.12,
              deckCenterRow - (rows - 1) / 2,
              0,
              span.horizontal ? CUBE_SCALE : 2,
              0.24,
              span.horizontal ? 2 : CUBE_SCALE,
              "surfaceOnly",
              "none",
            );
          }
          this.#addBoxMatrix(
            batches,
            SURFACE_MATERIALS[type],
            fasciaMaterial,
            (span.horizontal ? span.center : span.crossCenter) -
              (cols - 1) / 2,
            height - 0.12,
            (span.horizontal ? span.crossCenter : span.center) -
              (rows - 1) / 2,
            0,
            span.horizontal ? span.length : 2,
            0.24,
            span.horizontal ? 2 : span.length,
            span.horizontal
              ? "bridgeHorizontalSidesOnly"
              : "bridgeVerticalSidesOnly",
            "none",
          );
          this.#addBridgeSpanRailings(
            batches,
            span,
            height,
            railingMaterial,
            cols,
            rows,
          );
          continue;
        }

        for (let level = 0; level < height; level += 1) {
          const topCube = level === height - 1;
          const overpassFill = Boolean(
            tileMeta?.[row]?.[col]?.overpassId &&
              !tileMeta[row][col].overpass,
          );
          const { top, sides, underlay } = overpassFill
            ? {
                top: topCube ? SURFACE_MATERIALS[type] : "earth",
                sides: this.#pathEarthSideMaterial(col, row, level),
                underlay: "earth",
              }
            : this.#cubeMaterials(type, topCube, col, row, level);
          this.#addCubeMatrix(
            batches,
            top,
            sides,
            x,
            level + 0.5,
            z,
            this.#surfaceCoverage(topCube),
            level === 0 ? underlay : "none",
            topCube && GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0,
          );
        }
      }
    }

    for (const river of this.#mapData.riverData ?? []) {
      this.#addRiverSourceCap(batches, river.cells[0], cols, rows);
    }
    this.#addOverpassDeck(batches, cols, rows);
  }

  #addOverpassDeck(batches, cols, rows) {
    const overpass = this.#mapData.overpassData;
    if (!overpass) {
      return;
    }

    const { col, row } = overpass.crossing;
    const deckThickness = overpass.deckThickness ?? 0.24;
    const railingMaterial = this.#sideVariant(
      SIDE_MATERIALS[TileType.PATH],
      col,
      row,
      overpass.deckElevation - 1,
    );
    const fasciaMaterial = this.#pathEarthSideMaterial(
      col,
      row,
      overpass.deckElevation - 1,
    );
    for (let deckRow = row; deckRow <= row + 1; deckRow += 1) {
      this.#addBoxMatrix(
        batches,
        SURFACE_MATERIALS[TileType.PATH],
        fasciaMaterial,
        col + 0.5 - (cols - 1) / 2,
        overpass.deckElevation - deckThickness / 2,
        deckRow - (rows - 1) / 2,
        0,
        2,
        deckThickness,
        CUBE_SCALE,
        "surfaceOnly",
        "none",
      );
    }
    const span = {
      horizontal: false,
      start: row,
      end: row + 1,
      center: row + 0.5,
      crossCenter: col + 0.5,
      length: 2,
    };
    this.#addBoxMatrix(
      batches,
      SURFACE_MATERIALS[TileType.PATH],
      fasciaMaterial,
      span.crossCenter - (cols - 1) / 2,
      overpass.deckElevation - deckThickness / 2,
      span.center - (rows - 1) / 2,
      0,
      2,
      deckThickness,
      span.length,
      "bridgeVerticalSidesOnly",
      "none",
    );
    this.#addOverpassRailings(
      batches,
      overpass,
      railingMaterial,
      cols,
      rows,
    );
  }

  #addBridgeGround(batches, col, row, height, cols, rows, dirtOnly = false) {
    const x = col - (cols - 1) / 2;
    const z = row - (rows - 1) / 2;
    for (let level = 0; level < height; level += 1) {
      const topCube = level === height - 1;
      const { top, sides, underlay } = dirtOnly
        ? {
            top: "earth",
            sides: this.#pathEarthSideMaterial(col, row, level),
            underlay: "earth",
          }
        : this.#cubeMaterials(TileType.GRASS, topCube, col, row, level);
      this.#addCubeMatrix(
        batches,
        top,
        sides,
        x,
        level + 0.5,
        z,
        this.#surfaceCoverage(topCube),
        level === 0 ? underlay : "none",
        topCube && !dirtOnly ? GRASS_SURFACE_LIFT : 0,
      );
    }
  }

  #addRiverSourceCap(batches, source, cols, rows) {
    if (!source) {
      return;
    }

    const capHeight = 1 / 3;
    const level = source.terrainHeight - 1;
    const { top, sides } = this.#cubeMaterials(
      TileType.GRASS,
      true,
      source.col,
      source.row,
      level,
    );
    this.#addBoxMatrix(
      batches,
      top,
      sides,
      source.col - (cols - 1) / 2,
      source.terrainHeight - capHeight / 2 + GRASS_SURFACE_LIFT / 2,
      source.row - (rows - 1) / 2,
      0,
      CUBE_SCALE,
      capHeight + GRASS_SURFACE_LIFT,
      CUBE_SCALE,
      "full",
      "earth",
    );
  }

  #bridgeMateCell(grid, tileMeta, col, row, direction) {
    const horizontal = direction === "EAST" || direction === "WEST";
    const candidates = horizontal
      ? [
          { col, row: row - 1 },
          { col, row: row + 1 },
        ]
      : [
          { col: col - 1, row },
          { col: col + 1, row },
        ];
    return (
      candidates.find(
        (candidate) =>
          grid[candidate.row]?.[candidate.col] === TileType.PATH &&
          tileMeta[candidate.row]?.[candidate.col]?.renderMode === "BRIDGE" &&
          tileMeta[candidate.row][candidate.col].direction === direction,
      ) ?? null
    );
  }

  #collectBridgeSpan(grid, heightmap, tileMeta, col, row, direction) {
    const horizontal = direction === "EAST" || direction === "WEST";
    const mate = this.#bridgeMateCell(grid, tileMeta, col, row, direction);
    const crossStart = mate
      ? Math.min(horizontal ? row : col, horizontal ? mate.row : mate.col)
      : horizontal
        ? row
        : col;
    const crossEnd = mate ? crossStart + 1 : crossStart;
    const height = heightmap[row][col];
    const isStation = (position) => {
      for (let cross = crossStart; cross <= crossEnd; cross += 1) {
        const stationCol = horizontal ? position : cross;
        const stationRow = horizontal ? cross : position;
        if (
          grid[stationRow]?.[stationCol] !== TileType.PATH ||
          tileMeta[stationRow]?.[stationCol]?.renderMode !== "BRIDGE" ||
          tileMeta[stationRow][stationCol].direction !== direction ||
          heightmap[stationRow]?.[stationCol] !== height
        ) {
          return false;
        }
      }
      return true;
    };
    let start = horizontal ? col : row;
    let end = start;
    while (isStation(start - 1)) {
      start -= 1;
    }
    while (isStation(end + 1)) {
      end += 1;
    }
    const cells = [];
    for (let position = start; position <= end; position += 1) {
      for (let cross = crossStart; cross <= crossEnd; cross += 1) {
        cells.push({
          col: horizontal ? position : cross,
          row: horizontal ? cross : position,
        });
      }
    }
    return {
      cells,
      horizontal,
      start,
      end,
      center: (start + end) / 2,
      crossCenter: (crossStart + crossEnd) / 2,
      length: end - start + 1,
    };
  }

  #addBridgeSpanRailings(batches, span, height, sideMaterial, cols, rows) {
    const centerX =
      (span.horizontal ? span.center : span.crossCenter) - (cols - 1) / 2;
    const centerZ =
      (span.horizontal ? span.crossCenter : span.center) - (rows - 1) / 2;
    const postPositions = [span.start - 0.34, span.end + 0.34];
    for (let position = span.start + 0.5; position < span.end; position += 1) {
      postPositions.push(position);
    }

    for (const side of [-1, 1]) {
      const railX = span.horizontal ? centerX : centerX + side * 0.93;
      const railZ = span.horizontal ? centerZ + side * 0.93 : centerZ;
      const uniquePostPositions = [...new Set(postPositions)].sort(
        (left, right) => left - right,
      );
      for (let index = 1; index < uniquePostPositions.length; index += 1) {
        const segmentStart = uniquePostPositions[index - 1];
        const segmentEnd = uniquePostPositions[index];
        const railGap = 0.012;
        const postHalfWidth = 0.05;
        const segmentLength = Math.max(
          0.01,
          segmentEnd - segmentStart - postHalfWidth * 2 - railGap * 2,
        );
        const segmentCenter = (segmentStart + segmentEnd) / 2;
        this.#addBoxMatrix(
          batches,
          "path",
          sideMaterial,
          span.horizontal
            ? segmentCenter - (cols - 1) / 2
            : railX,
          height + 0.34,
          span.horizontal
            ? railZ
            : segmentCenter - (rows - 1) / 2,
          0,
          span.horizontal ? segmentLength : 0.1,
          0.1,
          span.horizontal ? 0.1 : segmentLength,
          "full",
          sideMaterial,
        );
      }
      for (const position of uniquePostPositions) {
        this.#addBoxMatrix(
          batches,
          "path",
          sideMaterial,
          span.horizontal ? position - (cols - 1) / 2 : railX,
          height + 0.17,
          span.horizontal ? railZ : position - (rows - 1) / 2,
          0,
          0.1,
          0.38,
          0.1,
          "full",
          sideMaterial,
        );
      }
    }
  }

  #addOverpassRailings(batches, overpass, sideMaterial, cols, rows) {
    const pathCells = [
      ...overpass.slopeCells,
      ...overpass.approachCells,
      ...overpass.crossingCells,
    ];
    const start = Math.min(...pathCells.map((cell) => cell.row));
    const end = Math.max(...pathCells.map((cell) => cell.row));
    const postPositions = [start - 0.34, end + 0.34];
    for (let position = start + 0.5; position < end; position += 1) {
      postPositions.push(position);
    }
    postPositions.sort((left, right) => left - right);

    const centerX =
      overpass.crossing.col +
      (overpass.crossing.width - 1) / 2 -
      (cols - 1) / 2;
    for (const side of [-1, 1]) {
      const railX = centerX + side * 0.93;
      for (let index = 1; index < postPositions.length; index += 1) {
        const segmentStart = postPositions[index - 1];
        const segmentEnd = postPositions[index];
        const startHeight = this.#overpassRailHeightAt(
          overpass,
          segmentStart,
        );
        const endHeight = this.#overpassRailHeightAt(overpass, segmentEnd);
        const run = segmentEnd - segmentStart;
        const rise = endHeight - startHeight;
        const fullLength = Math.hypot(run, rise);
        const segmentLength = Math.max(0.01, fullLength - 0.124);
        const pitch = (Math.atan2(rise, run) * 180) / Math.PI;
        this.#addBoxMatrix(
          batches,
          "path",
          sideMaterial,
          railX,
          (startHeight + endHeight) / 2 + 0.34,
          (segmentStart + segmentEnd) / 2 - (rows - 1) / 2,
          0,
          0.1,
          0.1,
          segmentLength,
          "full",
          sideMaterial,
          -pitch,
        );
      }

      for (const position of postPositions) {
        const height = this.#overpassRailHeightAt(overpass, position);
        this.#addBoxMatrix(
          batches,
          "path",
          sideMaterial,
          railX,
          height + 0.17,
          position - (rows - 1) / 2,
          0,
          0.1,
          0.38,
          0.1,
          "full",
          sideMaterial,
        );
      }
    }
  }

  #overpassRailHeightAt(overpass, position) {
    for (const slope of overpass.slopeCells) {
      if (position < slope.row - 0.5 || position > slope.row + 0.5) {
        continue;
      }
      const localPosition = position - slope.row + 0.5;
      const progress =
        slope.riseDirection === "NORTH"
          ? 1 - localPosition
          : localPosition;
      return (
        slope.lowHeight +
        (slope.highHeight - slope.lowHeight) * progress
      );
    }
    return overpass.deckElevation;
  }

  #buildIslandUndersideMatrices(batches, voxels) {
    const { cols, rows } = this.#mapData;
    for (const { col, row, level, rocky } of voxels) {
      const x = col - (cols - 1) / 2;
      const z = row - (rows - 1) / 2;
      const topMaterial = rocky ? "islandRock" : "earth";
      const sideMaterial = this.#grassEarthSideMaterial(col, row, level);
      this.#addCubeMatrix(
        batches,
        topMaterial,
        sideMaterial,
        x,
        level + 0.5,
        z,
        "full",
        topMaterial,
      );
    }
  }

  #updateFrame = (deltaTime) => {
    this.#riverWater?.update(deltaTime);
    this.#syncInventoryVisibility();
    this.#inventoryHud?.update(
      deltaTime,
      this.#inventoryFullIndicatorScreenPosition(),
    );
    this.#updateThrownInventoryItems(deltaTime);
    this.#cloudField?.update(deltaTime);
    this.#updateHeroCameraReturn(deltaTime);
    this.#updateGameOverCamera(deltaTime);
  };

  #handleInventoryFull = (inventory) => {
    this.#inventoryHud?.showFullReaction(
      this.#inventoryFullIndicatorScreenPosition(),
    );
    this.#onInventoryFull?.(inventory);
  };

  #inventoryFullIndicatorScreenPosition() {
    if (!this.#hero || !this.#camera?.camera) {
      return null;
    }
    const position = this.#hero.inventoryFullIndicatorPosition;
    return this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(position.x, position.y, position.z),
    );
  }

  #updateThrownInventoryItems(deltaTime) {
    const remainingItems = [];
    for (const thrownItem of this.#thrownInventoryItems) {
      thrownItem.advance(deltaTime);
      if (thrownItem.expired) {
        thrownItem.destroy();
      } else {
        remainingItems.push(thrownItem);
      }
    }
    this.#thrownInventoryItems = remainingItems;
  }

  #syncInventoryVisibility() {
    if (!this.#inventoryHud || !this.#heroConfigurationStore) {
      return;
    }
    const configuredVisibility = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    if (this.#inventoryHud.visible === configuredVisibility) {
      return;
    }
    this.#inventoryHud.visible = configuredVisibility;
    if (configuredVisibility) {
      this.#setInteractionTarget(null);
    } else {
      this.#fadeThrownInventoryItems();
      this.#updateInteractionTarget();
    }
  }

  #cubeMaterials(type, topCube, col, row, level) {
    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      if (!topCube) {
        return {
          top: "earth",
          sides: this.#grassEarthSideMaterial(col, row, level),
          underlay: "earth",
        };
      }
      return {
        top: `grass-${this.#variantIndex(col, row, level, 11, GRASS_TOP_VARIANTS.length)}`,
        sides: this.#grassTopSideMaterial(col, row, level),
        underlay: "earth",
      };
    }
    if (!topCube) {
      return {
        top: "earth",
        sides: this.#grassEarthSideMaterial(col, row, level),
        underlay: "earth",
      };
    }
    return {
      top:
        type === TileType.GRASS
          ? `grass-${this.#variantIndex(col, row, level, 11, GRASS_TOP_VARIANTS.length)}`
          : SURFACE_MATERIALS[type],
      sides:
        type === TileType.GRASS
          ? this.#grassTopSideMaterial(col, row, level)
          : this.#grassEarthSideMaterial(col, row, level),
      underlay: type === TileType.WATER ? "water" : "earth",
    };
  }

  #earthSideMaterial(col, row, level, allowDetail = false) {
    const shadeIndex = Math.max(
      0,
      Math.min(
        EARTH_SIDE_DEPTH_SHADES.length - 1,
        EARTH_SIDE_HIGHEST_LEVEL - Math.floor(level),
      ),
    );
    const showDetail =
      allowDetail && this.#variantIndex(col, row, level, 109, 9) === 0;
    const transforms = showDetail
      ? EARTH_DETAIL_TEXTURE_TRANSFORMS
      : EARTH_SIDE_TEXTURE_TRANSFORMS;
    const variant = this.#variantIndex(col, row, level, 71, transforms.length);
    const material = showDetail ? "earthDetailSide" : "earthSide";
    return `${material}-depth-${shadeIndex}-${variant}`;
  }

  #grassEarthSideMaterial(col, row, level) {
    return `grassEarthSide-depth-${this.#grassSideDepth(level)}-${this.#grassSideVariant(col, row)}`;
  }

  #pathEarthSideMaterial(col, row, level) {
    return `overpassEarthSide-depth-${this.#grassSideDepth(level)}-${this.#grassSideVariant(col, row)}`;
  }

  #grassTopSideMaterial(col, row, level) {
    return `grassTopSide-depth-${this.#grassSideDepth(level)}-${this.#grassSideVariant(col, row)}`;
  }

  #grassSideDepth(level) {
    return Math.max(
      0,
      Math.min(
        EARTH_SIDE_DEPTH_SHADES.length - 1,
        EARTH_SIDE_HIGHEST_LEVEL - Math.floor(level),
      ),
    );
  }

  #grassSideVariant(col, row) {
    const surfaceLevel = this.#tileHeight(col, row) - 1;
    return this.#variantIndex(
      col,
      row,
      surfaceLevel,
      83,
      GRASS_EARTH_SIDE_TRANSFORMS.length,
    );
  }

  #sideVariant(material, col, row, level) {
    if (material === "castleWall" || material === "castleTower") {
      return material;
    }
    const index = this.#variantIndex(
      col,
      row,
      level,
      37,
      SIDE_VARIANT_TRANSFORMS.length,
    );
    return `${material}-${index}`;
  }

  #variantIndex(col, row, level, salt, count) {
    const hash =
      Math.imul(col + 17, 73856093) ^
      Math.imul(row + 31, 19349663) ^
      Math.imul(level + 7, 83492791) ^
      salt;
    return (hash >>> 0) % count;
  }

  #surfaceCoverage(topCube) {
    if (!topCube) {
      return "none";
    }
    return "full";
  }

  #tileHeight(col, row) {
    const type = this.#mapData.grid[row][col];
    return type in FIXED_HEIGHTS
      ? FIXED_HEIGHTS[type]
      : this.#mapData.heightmap[row][col];
  }

  #addCubeMatrix(
    batches,
    topMaterial,
    sideMaterial,
    x,
    y,
    z,
    coverage = "full",
    underlayMaterial = sideMaterial,
    surfaceLift = 0,
  ) {
    this.#addBoxMatrix(
      batches,
      topMaterial,
      sideMaterial,
      x,
      y + surfaceLift / 2,
      z,
      0,
      CUBE_SCALE,
      CUBE_SCALE + surfaceLift,
      CUBE_SCALE,
      coverage,
      underlayMaterial,
    );
  }

  #addBoxMatrix(
    batches,
    topMaterial,
    sideMaterial,
    x,
    y,
    z,
    yaw,
    sx,
    sy,
    sz,
    coverage = "full",
    underlayMaterial = sideMaterial,
    pitch = 0,
  ) {
    const pc = this.#pc;
    const matrix = new pc.Mat4();
    const rotation = new pc.Quat();
    rotation.setFromEulerAngles(pitch, yaw, 0);
    matrix.setTRS(new pc.Vec3(x, y, z), rotation, new pc.Vec3(sx, sy, sz));
    const materialBatch = `${topMaterial}|${sideMaterial}|${underlayMaterial}|${coverage}`;
    const data = batches.get(materialBatch) ?? [];
    for (const value of matrix.data) data.push(value);
    batches.set(materialBatch, data);
  }

  #createInstancedBatches(batches, root, castsShadows, layerIds = null) {
    const pc = this.#pc;
    for (const [materialBatch, matrices] of batches.entries()) {
      if (matrices.length === 0) continue;
      const [topMaterial, sideMaterial, underlayMaterial, coverage] =
        materialBatch.split("|");
      const batchCastsShadows = castsShadows;
      const instanceCount = matrices.length / 16;
      const vertexBuffer = new pc.VertexBuffer(
        this.#app.graphicsDevice,
        pc.VertexFormat.getDefaultInstancingFormat(this.#app.graphicsDevice),
        instanceCount,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const entity = new pc.Entity(`${topMaterial}/${sideMaterial} cubes`);
      const bridgeSideMesh =
        coverage === "bridgeHorizontal" ||
        coverage === "bridgeHorizontalSidesOnly"
          ? this.#cubeMeshes.bridgeHorizontalSides
          : coverage === "bridgeVertical" ||
              coverage === "bridgeVerticalSidesOnly"
            ? this.#cubeMeshes.bridgeVerticalSides
            : null;
      const slopeMeshes = this.#cubeMeshes.slopes[coverage] ?? null;
      const sidesOnly = coverage.endsWith("SidesOnly");
      const surfaceOnly = coverage === "surfaceOnly";
      const sideMeshInstance = surfaceOnly
        ? null
        : new pc.MeshInstance(
            slopeMeshes?.sides ??
              bridgeSideMesh ??
              this.#cubeMeshes.wallSides,
            this.#materials.get(sideMaterial),
          );
      const surfaceMesh = surfaceOnly
        ? this.#cubeMeshes.surfaces.full
        : sidesOnly
          ? null
          : slopeMeshes?.surface ??
            this.#cubeMeshes.surfaces[coverage] ??
            (bridgeSideMesh ? this.#cubeMeshes.surfaces.full : null);
      const topMeshInstance = surfaceMesh
        ? new pc.MeshInstance(surfaceMesh, this.#materials.get(topMaterial))
        : null;
      const underlayMeshInstance =
        underlayMaterial === "none"
          ? null
          : new pc.MeshInstance(
              this.#cubeMeshes.underlay,
              this.#materials.get(underlayMaterial),
            );
      const meshInstances = [
        sideMeshInstance,
        underlayMeshInstance,
        topMeshInstance,
      ].filter(Boolean);
      entity.addComponent("render", {
        meshInstances,
        castShadows: batchCastsShadows,
        receiveShadows: batchCastsShadows,
      });
      if (layerIds) entity.render.layers = layerIds;
      for (const meshInstance of meshInstances) {
        meshInstance.setInstancing(vertexBuffer, false);
        meshInstance.castShadow = batchCastsShadows;
        meshInstance.receiveShadow = batchCastsShadows;
      }
      root.addChild(entity);
    }
  }

  #createCubeMeshes() {
    const pc = this.#pc;
    const groups = {
      underlay: { positions: [], normals: [], uvs: [], indices: [] },
      sides: { positions: [], normals: [], uvs: [], indices: [] },
      wallSides: { positions: [], normals: [], uvs: [], indices: [] },
      bridgeHorizontalSides: {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      },
      bridgeVerticalSides: {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
      },
      full: { positions: [], normals: [], uvs: [], indices: [] },
      block: { positions: [], normals: [], uvs: [], indices: [] },
    };
    const slopeGroupNames = {};
    for (const direction of ["NORTH", "SOUTH", "EAST", "WEST"]) {
      for (const stage of ["Lower", "Upper"]) {
        const coverage = `slope${direction}${stage}`;
        const surface = `${coverage}Surface`;
        const sides = `${coverage}Sides`;
        groups[surface] = { positions: [], normals: [], uvs: [], indices: [] };
        groups[sides] = { positions: [], normals: [], uvs: [], indices: [] };
        slopeGroupNames[coverage] = { surface, sides };
      }
    }
    const half = 0.5;
    const inner = 0.49;

    const addFace = (groupName, sourcePoints) => {
      const group = groups[groupName];
      const points = sourcePoints.map((point) => [...point]);
      const edgeA = points[1].map((value, axis) => value - points[0][axis]);
      const edgeB = points[2].map((value, axis) => value - points[0][axis]);
      let normal = [
        edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
        edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
        edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0],
      ];
      const center = [0, 1, 2].map(
        (axis) =>
          points.reduce((sum, point) => sum + point[axis], 0) / points.length,
      );
      if (
        normal.reduce((sum, value, axis) => sum + value * center[axis], 0) < 0
      ) {
        points.reverse();
        normal = normal.map((value) => -value);
      }
      const normalLength = Math.hypot(...normal);
      normal = normal.map((value) => value / normalLength);

      const start = group.positions.length / 3;
      const xRange =
        Math.max(...points.map((point) => point[0])) -
        Math.min(...points.map((point) => point[0]));
      const zRange =
        Math.max(...points.map((point) => point[2])) -
        Math.min(...points.map((point) => point[2]));
      const horizontalAxis = xRange >= zRange ? 0 : 2;
      const minX = Math.min(...points.map((point) => point[0]));
      const maxX = Math.max(...points.map((point) => point[0]));
      const minZ = Math.min(...points.map((point) => point[2]));
      const maxZ = Math.max(...points.map((point) => point[2]));
      points.forEach((point) => {
        group.positions.push(...point);
        group.normals.push(...normal);
        if (!groupName.toLowerCase().endsWith("sides")) {
          group.uvs.push(
            (point[0] - minX) / Math.max(0.001, maxX - minX),
            (point[2] - minZ) / Math.max(0.001, maxZ - minZ),
          );
        } else {
          group.uvs.push(point[horizontalAxis] + half, half - point[1]);
        }
      });
      for (let index = 1; index < points.length - 1; index += 1) {
        group.indices.push(start, start + index, start + index + 1);
      }
    };

    for (const sign of [-1, 1]) {
      addFace("sides", [
        [sign * half, -inner, -inner],
        [sign * half, half, -inner],
        [sign * half, half, inner],
        [sign * half, -inner, inner],
      ]);
      addFace(sign === 1 ? "underlay" : "sides", [
        [-inner, sign * half, -inner],
        [-inner, sign * half, inner],
        [inner, sign * half, inner],
        [inner, sign * half, -inner],
      ]);
      addFace("sides", [
        [-inner, -inner, sign * half],
        [inner, -inner, sign * half],
        [inner, half, sign * half],
        [-inner, half, sign * half],
      ]);
    }

    const axisPairs = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 2, 0],
    ];
    for (const [axisA, axisB, freeAxis] of axisPairs) {
      for (const signA of [-1, 1]) {
        for (const signB of [-1, 1]) {
          const point = (onAxis, freeValue) => {
            const result = [0, 0, 0];
            result[axisA] = signA * (onAxis === axisA ? half : inner);
            result[axisB] = signB * (onAxis === axisB ? half : inner);
            result[freeAxis] = freeValue;
            const touchesTopEdge =
              (axisA === 1 && signA === 1) ||
              (axisB === 1 && signB === 1) ||
              (freeAxis === 1 && freeValue === inner);
            if (touchesTopEdge) result[1] = half;
            return result;
          };
          addFace("sides", [
            point(axisA, -inner),
            point(axisA, inner),
            point(axisB, inner),
            point(axisB, -inner),
          ]);
        }
      }
    }

    for (const signX of [-1, 1]) {
      for (const signY of [-1, 1]) {
        for (const signZ of [-1, 1]) {
          addFace("sides", [
            [signX * half, signY === 1 ? half : -inner, signZ * inner],
            [signX * inner, signY * half, signZ * inner],
            [signX * inner, signY === 1 ? half : -inner, signZ * half],
          ]);
        }
      }
    }

    for (const sign of [-1, 1]) {
      addFace("bridgeHorizontalSides", [
        [-half, -half, sign * half],
        [half, -half, sign * half],
        [half, half, sign * half],
        [-half, half, sign * half],
      ]);
      addFace("bridgeVerticalSides", [
        [sign * half, -half, -half],
        [sign * half, half, -half],
        [sign * half, half, half],
        [sign * half, -half, half],
      ]);
    }

    // Terrain cubes are stacked into cliffs. Their visible walls must meet on
    // the same vertical plane; beveling each cube's horizontal boundary makes
    // every internal level read as a recessed stripe.
    for (const sign of [-1, 1]) {
      addFace("wallSides", [
        [sign * half, -half, -inner],
        [sign * half, half, -inner],
        [sign * half, half, inner],
        [sign * half, -half, inner],
      ]);
      addFace("wallSides", [
        [-inner, -half, sign * half],
        [inner, -half, sign * half],
        [inner, half, sign * half],
        [-inner, half, sign * half],
      ]);
    }

    for (const signX of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        addFace("wallSides", [
          [signX * half, -half, signZ * inner],
          [signX * half, half, signZ * inner],
          [signX * inner, half, signZ * half],
          [signX * inner, -half, signZ * half],
        ]);
      }
    }

    const surfaceY = half + 0.0002;
    addFace("full", [
      [-half, surfaceY, -half],
      [-half, surfaceY, half],
      [half, surfaceY, half],
      [half, surfaceY, -half],
    ]);
    addFace("block", [
      [-inner, surfaceY, -inner],
      [-inner, surfaceY, inner],
      [inner, surfaceY, inner],
      [inner, surfaceY, -inner],
    ]);

    for (const [coverage, groupNames] of Object.entries(slopeGroupNames)) {
      const direction = coverage.match(/^slope(NORTH|SOUTH|EAST|WEST)/)?.[1];
      const isUpper = coverage.endsWith("Upper");
      const low = isUpper ? 0.5 : 0;
      const high = isUpper ? 1 : 0.5;
      const cornerHeight = (x, z) => {
        if (direction === "NORTH") return z < 0 ? high : low;
        if (direction === "SOUTH") return z > 0 ? high : low;
        if (direction === "EAST") return x > 0 ? high : low;
        return x < 0 ? high : low;
      };
      const northWest = [-half, cornerHeight(-half, -half), -half];
      const southWest = [-half, cornerHeight(-half, half), half];
      const southEast = [half, cornerHeight(half, half), half];
      const northEast = [half, cornerHeight(half, -half), -half];
      addFace(groupNames.surface, [
        northWest,
        southWest,
        southEast,
        northEast,
      ]);
      const addSlopeSide = (bottomA, bottomB, topB, topA) => {
        if (topA[1] <= 0 && topB[1] <= 0) {
          return;
        }
        addFace(groupNames.sides, [bottomA, bottomB, topB, topA]);
      };
      addSlopeSide(
        [-half, 0, -half],
        [-half, 0, half],
        southWest,
        northWest,
      );
      addSlopeSide(
        [half, 0, half],
        [half, 0, -half],
        northEast,
        southEast,
      );
      addSlopeSide(
        [half, 0, -half],
        [-half, 0, -half],
        northWest,
        northEast,
      );
      addSlopeSide(
        [-half, 0, half],
        [half, 0, half],
        southEast,
        southWest,
      );
    }

    const createMesh = (group) => {
      const geometry = new pc.Geometry();
      geometry.positions = group.positions;
      geometry.normals = group.normals;
      geometry.uvs = group.uvs;
      geometry.indices = group.indices;
      const mesh = pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
      mesh.incRefCount();
      return mesh;
    };

    return {
      sides: createMesh(groups.sides),
      wallSides: createMesh(groups.wallSides),
      bridgeHorizontalSides: createMesh(groups.bridgeHorizontalSides),
      bridgeVerticalSides: createMesh(groups.bridgeVerticalSides),
      underlay: createMesh(groups.underlay),
      slopes: Object.fromEntries(
        Object.entries(slopeGroupNames).map(
          ([coverage, groupNames]) => [
            coverage,
            {
              surface: createMesh(groups[groupNames.surface]),
              sides: createMesh(groups[groupNames.sides]),
            },
          ],
        ),
      ),
      surfaces: {
        full: createMesh(groups.full),
        block: createMesh(groups.block),
      },
    };
  }

  #destroyMesh(mesh) {
    mesh.decRefCount();
    if (mesh.refCount < 1) mesh.destroy();
  }

  #fitCamera() {
    if (!this.#mapData || !this.#camera) {
      return;
    }
    const aspect = Math.max(0.35, this.canvas.width / this.canvas.height);
    const { cols, rows } = this.#mapData;
    const maxHeight = 9;
    const halfWidth = (cols + rows) / (2 * Math.sqrt(2)) + 1;
    const halfHeight =
      ((cols + rows) * Math.sin(CAMERA_PITCH)) / (2 * Math.sqrt(2)) +
      maxHeight * Math.cos(CAMERA_PITCH) +
      1;
    this.#baseOrthoHeight = Math.max(halfHeight, halfWidth / aspect) * 0.84;
    this.#updateFitCenter();
    if (this.#zoom === MAP_FIT_ZOOM) {
      this.#panX = this.#fitCenterX;
      this.#panZ = this.#fitCenterZ;
    }
  }

  #updateFitCenter() {
    if (!this.#mapData) {
      return;
    }
    const { grid, cols, rows } = this.#mapData;
    const yaw = Math.PI / 4 + this.#rotation * (Math.PI / 2);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    let minimumProjection = Number.POSITIVE_INFINITY;
    let maximumProjection = Number.NEGATIVE_INFINITY;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (grid[row][col] === TileType.WATER) continue;
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        const projection = x * rightX + z * rightZ;
        minimumProjection = Math.min(minimumProjection, projection);
        maximumProjection = Math.max(maximumProjection, projection);
      }
    }

    if (!Number.isFinite(minimumProjection)) {
      this.#fitCenterX = 0;
      this.#fitCenterZ = 0;
      return;
    }

    const centerProjection = (minimumProjection + maximumProjection) / 2;
    this.#fitCenterX = rightX * centerProjection;
    this.#fitCenterZ = rightZ * centerProjection;
  }

  #handleHeroPositionChange = ({ x, y, z }) => {
    this.#castle?.updateHeroPosition({ x, y, z });
    this.#groundCover?.applyHeroInteraction(
      { x, y, z },
      this.#hero?.movementState,
    );
    this.#grassSurface?.applyHeroInteraction(
      { x, y, z },
      this.#hero?.movementState,
    );
    this.#buriedTreasure?.applyHeroPosition({ x, y, z });
    this.#updateInteractionTarget({ x, y, z });
    if (this.#gameOverCameraLocked || this.#hero?.isInDeathSequence) {
      return;
    }
    const heroWorldPosition = this.#hero.entity.getPosition();
    const screenPosition = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(
        heroWorldPosition.x,
        heroWorldPosition.y + HERO_CAMERA_CENTER_HEIGHT,
        heroWorldPosition.z,
      ),
    );
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const marginX = Math.min(HERO_VIEWPORT_MARGIN, width / 4);
    const marginY = Math.min(HERO_VIEWPORT_MARGIN, height / 4);
    const boundedX = Math.max(
      marginX,
      Math.min(width - marginX, screenPosition.x),
    );
    const boundedY = Math.max(
      marginY,
      Math.min(height - marginY, screenPosition.y),
    );
    const heroIsOutOfBounds =
      boundedX !== screenPosition.x || boundedY !== screenPosition.y;

    if (this.#viewportManuallyMoved) {
      if (!heroIsOutOfBounds) {
        this.#heroVisibility?.schedule();
        return;
      }
      this.#startHeroCameraReturn();
      this.#heroVisibility?.schedule();
      return;
    } else if (this.#zoom > MAP_FIT_ZOOM) {
      this.#panX = heroWorldPosition.x;
      this.#panZ = heroWorldPosition.z;
    } else if (!heroIsOutOfBounds) {
      this.#heroVisibility?.schedule();
      return;
    } else {
      const correction = this.#screenDeltaToGround(
        screenPosition.x - boundedX,
        screenPosition.y - boundedY,
        this.#zoom,
      );
      this.#panX += correction.x;
      this.#panZ += correction.z;
    }
    this.#updateCamera();
    this.#heroVisibility?.schedule();
  };

  #startHeroCameraReturn(force = false) {
    if (
      this.#heroCameraReturnTransition ||
      this.#gameOverCameraLocked ||
      !this.#viewportManuallyMoved ||
      !this.#hero ||
      !this.#camera
    ) {
      return Boolean(this.#heroCameraReturnTransition);
    }
    const heroWorldPosition = this.#hero.entity.getPosition();
    const screenPosition = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(
        heroWorldPosition.x,
        heroWorldPosition.y + HERO_CAMERA_CENTER_HEIGHT,
        heroWorldPosition.z,
      ),
    );
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const marginX = Math.min(HERO_VIEWPORT_MARGIN, width / 4);
    const marginY = Math.min(HERO_VIEWPORT_MARGIN, height / 4);
    const heroIsOutOfBounds =
      screenPosition.x < marginX ||
      screenPosition.x > width - marginX ||
      screenPosition.y < marginY ||
      screenPosition.y > height - marginY;
    if (!force && !heroIsOutOfBounds) {
      return false;
    }
    this.#heroCameraReturnTransition = {
      elapsed: 0,
      startPanX: this.#panX,
      startPanZ: this.#panZ,
    };
    return true;
  }

  #updateHeroCameraReturn(deltaTime) {
    const transition = this.#heroCameraReturnTransition;
    if (
      !transition ||
      this.#gameOverCameraLocked ||
      !this.#hero ||
      !this.#camera
    ) {
      return;
    }
    transition.elapsed += Math.max(0, deltaTime);
    const progress = Math.min(
      1,
      transition.elapsed / HERO_CAMERA_RETURN_DURATION,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    const heroWorldPosition = this.#hero.entity.getPosition();
    this.#panX =
      transition.startPanX +
      (heroWorldPosition.x - transition.startPanX) * easedProgress;
    this.#panZ =
      transition.startPanZ +
      (heroWorldPosition.z - transition.startPanZ) * easedProgress;
    if (progress >= 1) {
      this.#heroCameraReturnTransition = null;
      this.#viewportManuallyMoved = false;
    }
    this.#updateCamera();
    this.#heroVisibility?.schedule();
  }

  #handleHeroFacingChange = () => {
    if (!this.#hero?.isUsingTool && !this.#hero?.isCollecting) {
      this.#updateInteractionTarget();
    }
  };

  #handleHeroStateChange = (state) => {
    this.#lifeHud?.setLives(state.lives, state.maxLives);
    this.#coinHud?.setWallet(state.wallet);
    this.#inventoryHud?.setInventory(state.inventory);
    if (this.#gameOverHud) {
      this.#gameOverHud.visible = state.gameOver;
    }
    this.#onHeroStateChange?.(state);
    if (!state.gameOver || !this.#castle || !this.#camera) {
      return;
    }
    const presentation = this.#castle.beginGameOver(() =>
      this.#camera?.getPosition(),
    );
    if (!presentation) {
      return;
    }
    this.#gameOverReturnViewport = this.viewport;
    this.#gameOverCameraLocked = true;
    this.#heroCameraReturnTransition = null;
    const { focus, visualSize, viewRotation } = presentation;
    const rotationDelta =
      ((((viewRotation - this.#rotation + 2) % 4) + 4) % 4) - 2;
    this.#gameOverCameraTransition = {
      elapsed: 0,
      startRotation: this.#rotation,
      rotationDelta,
      startPanX: this.#panX,
      startPanZ: this.#panZ,
      endPanX: focus.x,
      endPanZ: focus.z,
      startTargetY: this.#cameraTargetY,
      endTargetY: focus.y,
      startZoom: this.#zoom,
      endZoom: this.#getGameOverZoom(visualSize, viewRotation),
    };
    this.#viewportManuallyMoved = true;
    this.#castle.startGameOverPerformance();
  };

  #updateGameOverCamera(deltaTime) {
    const transition = this.#gameOverCameraTransition;
    if (!transition) {
      return;
    }
    transition.elapsed += Math.max(0, deltaTime);
    const progress = Math.min(
      1,
      transition.elapsed / GAME_OVER_CAMERA_DURATION,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    this.#rotation =
      transition.startRotation + transition.rotationDelta * easedProgress;
    this.#panX =
      transition.startPanX +
      (transition.endPanX - transition.startPanX) * easedProgress;
    this.#panZ =
      transition.startPanZ +
      (transition.endPanZ - transition.startPanZ) * easedProgress;
    this.#cameraTargetY =
      transition.startTargetY +
      (transition.endTargetY - transition.startTargetY) * easedProgress;
    this.#zoom =
      transition.startZoom +
      (transition.endZoom - transition.startZoom) * easedProgress;
    this.#updateCamera();
    if (progress < 1) {
      return;
    }
    this.#rotation = ((this.#rotation % 4) + 4) % 4;
    this.#gameOverCameraTransition = null;
    this.#updateCamera();
  }

  #getGameOverZoom(visualSize, viewRotation) {
    if (
      !visualSize ||
      !Number.isFinite(visualSize.x) ||
      !Number.isFinite(visualSize.y) ||
      !Number.isFinite(visualSize.z)
    ) {
      return GAME_OVER_FALLBACK_ZOOM;
    }
    const yaw = Math.PI / 4 + viewRotation * (Math.PI / 2);
    const horizontalDepth =
      Math.abs(Math.sin(yaw)) * visualSize.x +
      Math.abs(Math.cos(yaw)) * visualSize.z;
    const projectedHeight =
      visualSize.y * Math.cos(CAMERA_PITCH) +
      horizontalDepth * Math.sin(CAMERA_PITCH);
    if (projectedHeight <= 0.001) {
      return GAME_OVER_FALLBACK_ZOOM;
    }
    return Math.max(
      MAP_FIT_ZOOM,
      (2 * this.#baseOrthoHeight * GAME_OVER_ROYAL_VIEWPORT_HEIGHT) /
        projectedHeight,
    );
  }

  #getGatewayRepulsion = (fromX, fromZ, toX, toZ, radius) => {
    for (const gateway of this.#gateways) {
      const direction = gateway.repulsionForMovement(
        fromX,
        fromZ,
        toX,
        toZ,
        radius,
      );
      if (direction) {
        return direction;
      }
    }
    return null;
  };

  #updateCamera(panOrigin = null) {
    if (!this.#camera || !this.#mapData) {
      return;
    }
    if (this.#zoom === MAP_FIT_ZOOM) {
      this.#updateFitCenter();
      this.#panX = this.#fitCenterX;
      this.#panZ = this.#fitCenterZ;
    }
    if (!this.#gameOverCameraLocked) {
      const constrainedPan = this.#cameraPanBounds?.constrain(
        this.#cameraView,
        panOrigin,
      );
      if (constrainedPan) {
        this.#panX = constrainedPan.x;
        this.#panZ = constrainedPan.z;
      }
    }
    const yaw = Math.PI / 4 + this.#rotation * (Math.PI / 2);
    const horizontalDistance = CAMERA_DISTANCE * Math.cos(CAMERA_PITCH);
    const target = new this.#pc.Vec3(
      this.#panX,
      this.#cameraTargetY,
      this.#panZ,
    );
    this.#camera.setPosition(
      target.x + Math.sin(yaw) * horizontalDistance,
      target.y + Math.sin(CAMERA_PITCH) * CAMERA_DISTANCE,
      target.z + Math.cos(yaw) * horizontalDistance,
    );
    this.#camera.lookAt(target);
    this.#camera.camera.orthoHeight = this.#baseOrthoHeight / this.#zoom;
    this.#floatingIslandMotion?.setZoom(this.#zoom);
    this.#cloudField?.setCameraState({
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      zoom: this.#zoom,
    });
    this.#updateHeroIdleLookTarget();
    this.#notifyViewportChange();
  }

  #notifyViewportChange() {
    if (this.#gameOverCameraLocked) {
      return;
    }
    const viewport = this.viewport;
    const signature = [
      viewport.zoom,
      viewport.rotation,
      viewport.panX,
      viewport.panZ,
      viewport.manuallyMoved,
    ].join(":");
    if (signature === this.#viewportSignature) {
      return;
    }
    this.#viewportSignature = signature;
    if (!this.#viewportPersistenceEnabled) {
      return;
    }
    if (this.#viewportSaveTimer !== null) {
      window.clearTimeout(this.#viewportSaveTimer);
    }
    this.#viewportSaveTimer = window.setTimeout(() => {
      this.#saveViewport();
    }, 150);
  }

  #saveViewport() {
    this.#viewportSaveTimer = null;
    this.#gameViewStore.updateViewport(this.viewport);
  }

  get #cameraView() {
    return {
      panX: this.#panX,
      panZ: this.#panZ,
      centerX: this.#fitCenterX,
      centerZ: this.#fitCenterZ,
      targetY: this.#cameraTargetY,
      rotation: this.#rotation,
      pitch: CAMERA_PITCH,
      zoom: this.#zoom,
      baseOrthoHeight: this.#baseOrthoHeight,
      orthoHeight: this.#baseOrthoHeight / this.#zoom,
      viewportWidth: this.container.clientWidth,
      viewportHeight: this.container.clientHeight,
    };
  }

  #screenOffsetToGround(x, y, zoom) {
    return this.#screenDeltaToGround(
      x - this.container.clientWidth / 2,
      y - this.container.clientHeight / 2,
      zoom,
    );
  }

  #screenDeltaToGround(deltaX, deltaY, zoom) {
    const yaw = Math.PI / 4 + this.#rotation * (Math.PI / 2);
    const worldPerPixel =
      (2 * this.#baseOrthoHeight) /
      Math.max(1, this.container.clientHeight) /
      zoom;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const downX = Math.sin(yaw);
    const downZ = Math.cos(yaw);
    const verticalScale = worldPerPixel / Math.sin(CAMERA_PITCH);
    return {
      x: rightX * deltaX * worldPerPixel + downX * deltaY * verticalScale,
      z: rightZ * deltaX * worldPerPixel + downZ * deltaY * verticalScale,
    };
  }

  #connectBannerInteraction() {
    if (this.#bannerInteractionConnected || !this.canvas) {
      return;
    }
    this.canvas.addEventListener("pointerdown", this.#handleBannerPointerDown);
    this.canvas.addEventListener("pointermove", this.#handleBannerPointerMove);
    this.canvas.addEventListener("pointerup", this.#handleBannerPointerUp);
    this.canvas.addEventListener("pointercancel", this.#handleBannerPointerUp);
    this.canvas.addEventListener("pointerleave", this.#handlePointerLeave);
    this.#bannerInteractionConnected = true;
  }

  #disconnectBannerInteraction() {
    if (!this.#bannerInteractionConnected || !this.canvas) {
      return;
    }
    this.canvas.removeEventListener(
      "pointerdown",
      this.#handleBannerPointerDown,
    );
    this.canvas.removeEventListener(
      "pointermove",
      this.#handleBannerPointerMove,
    );
    this.canvas.removeEventListener("pointerup", this.#handleBannerPointerUp);
    this.canvas.removeEventListener(
      "pointercancel",
      this.#handleBannerPointerUp,
    );
    this.canvas.removeEventListener("pointerleave", this.#handlePointerLeave);
    this.#finishBannerWindGesture();
    this.#clearHeroIdleLookTarget();
    this.#bannerInteractionConnected = false;
  }

  #pointerRay(event) {
    if (!this.#camera?.camera || !this.canvas) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    return {
      start: this.#camera.camera.screenToWorld(
        screenX,
        screenY,
        this.#camera.camera.nearClip,
      ),
      end: this.#camera.camera.screenToWorld(
        screenX,
        screenY,
        this.#camera.camera.farClip,
      ),
    };
  }

  #handleBannerPointerDown = (event) => {
    if (event.button !== 0 || this.#bannerWindTarget) {
      return;
    }
    const ray = this.#pointerRay(event);
    if (!ray) {
      return;
    }

    let closest = null;
    for (const gateway of this.#gateways) {
      const hit = gateway.getBannerHit(ray.start, ray.end);
      if (!hit || (closest && hit.distance >= closest.hit.distance)) continue;
      closest = { kind: "wind", target: gateway, hit };
    }
    const castleHit = this.#castle?.getBannerHit(ray.start, ray.end);
    if (castleHit && (!closest || castleHit.distance < closest.hit.distance)) {
      closest = { kind: "wind", target: this.#castle, hit: castleHit };
    }
    const doorHit = this.#castle?.getDoorHit(ray.start, ray.end);
    if (doorHit && (!closest || doorHit.distance < closest.hit.distance)) {
      closest = { kind: "door", target: this.#castle, hit: doorHit };
    }
    if (!closest) {
      return;
    }

    event.preventDefault();
    if (closest.kind === "door") {
      closest.target.openDoor(closest.hit);
      return;
    }
    this.#bannerWindTarget = closest.target;
    this.#bannerWindPointerId = event.pointerId;
    this.#bannerWindLastTime = event.timeStamp;
    closest.target.beginWindGesture(closest.hit);
    this.canvas.setPointerCapture(event.pointerId);
  };

  #handleBannerPointerMove = (event) => {
    if (event.pointerType === POINTER_TYPE.MOUSE) {
      this.#heroLookPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      this.#updateHeroIdleLookTarget();
    }
    if (!this.#bannerWindTarget) {
      return;
    }
    if (event.pointerId !== this.#bannerWindPointerId) {
      return;
    }
    const ray = this.#pointerRay(event);
    if (!ray) {
      return;
    }

    event.preventDefault();
    const deltaTime = (event.timeStamp - this.#bannerWindLastTime) / 1000;
    this.#bannerWindLastTime = event.timeStamp;
    this.#bannerWindTarget.applyMouseWind(ray.start, ray.end, deltaTime);
  };

  #handlePointerLeave = (event) => {
    if (event.pointerType === POINTER_TYPE.MOUSE) {
      this.#clearHeroIdleLookTarget();
    }
  };

  #updateHeroIdleLookTarget() {
    if (!this.#heroLookPointer || !this.#hero) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (
      this.#heroLookPointer.clientX < rect.left ||
      this.#heroLookPointer.clientX > rect.right ||
      this.#heroLookPointer.clientY < rect.top ||
      this.#heroLookPointer.clientY > rect.bottom
    ) {
      this.#clearHeroIdleLookTarget();
      return;
    }
    const ray = this.#pointerRay(this.#heroLookPointer);
    if (!ray) {
      return;
    }
    const rayY = ray.end.y - ray.start.y;
    if (Math.abs(rayY) <= 0.000001) {
      return;
    }
    const distance = (this.#hero.position.y - ray.start.y) / rayY;
    if (distance < 0 || distance > 1) {
      return;
    }
    this.#hero.idleLookTarget = {
      x: ray.start.x + (ray.end.x - ray.start.x) * distance,
      z: ray.start.z + (ray.end.z - ray.start.z) * distance,
    };
  }

  #clearHeroIdleLookTarget() {
    this.#heroLookPointer = null;
    if (this.#hero) {
      this.#hero.idleLookTarget = null;
    }
  }

  #handleBannerPointerUp = (event) => {
    if (event.pointerId !== this.#bannerWindPointerId) {
      return;
    }
    event.preventDefault();
    this.#finishBannerWindGesture();
  };

  #finishBannerWindGesture() {
    this.#bannerWindTarget?.endWindGesture();
    if (
      this.#bannerWindPointerId !== null &&
      this.canvas?.hasPointerCapture(this.#bannerWindPointerId)
    ) {
      this.canvas.releasePointerCapture(this.#bannerWindPointerId);
    }
    this.#bannerWindTarget = null;
    this.#bannerWindPointerId = null;
    this.#bannerWindLastTime = 0;
  }

  #updateInteractionTarget() {
    if (
      this.inventoryVisible ||
      this.#hero?.isCollecting ||
      this.#hero?.isReacting
    ) {
      this.#setInteractionTarget(null);
      return;
    }
    if (this.#hero?.isUsingTool) {
      return;
    }
    let target = null;
    for (const provider of this.#interactionProviders) {
      const candidate = provider.findInteraction({
        hero: this.#hero,
        onChange: this.#refreshInteractionTarget,
        onComplete: this.#completeInteraction,
      });
      if (candidate?.canInteract) {
        target = candidate;
        break;
      }
    }
    this.#setInteractionTarget(target);
  }

  #setInteractionTarget(target) {
    const interaction = target?.canInteract ? target : null;
    const description = interaction?.description ?? null;
    const nextSignature = description
      ? `${description.id}:${description.labelKey}:${description.health ?? ""}`
      : null;
    this.#interactionTarget = interaction;
    if (this.#interactionSignature !== nextSignature) {
      this.#interactionSignature = nextSignature;
      this.#onInteractionChange?.(description);
    }
  }

  #refreshInteractionTarget = () => {
    this.#setInteractionTarget(this.#interactionTarget);
  };

  #completeInteraction = () => {
    this.#setInteractionTarget(null);
    this.#updateInteractionTarget();
  };

  #clearScene() {
    this.#finishBannerWindGesture();
    this.#pathArrows?.clear();
    for (const gateway of this.#gateways) gateway.destroy();
    this.#gateways = [];
    this.#castle?.destroy();
    this.#castle = null;
    this.#heroVisibility?.destroy();
    this.#heroVisibility = null;
    this.#floatingIslandMotion?.destroy();
    this.#floatingIslandMotion = null;
    this.#axeTool?.destroy();
    this.#axeTool = null;
    this.#knifeTool?.destroy();
    this.#knifeTool = null;
    this.#shovelTool?.destroy();
    this.#shovelTool = null;
    this.#interactionProviders = [];
    for (const thrownItem of this.#thrownInventoryItems) {
      thrownItem.destroy();
    }
    this.#thrownInventoryItems = [];
    this.#hero?.destroy();
    this.#hero = null;
    this.#vegetation?.destroy();
    this.#vegetation = null;
    this.#buriedTreasure?.destroy();
    this.#buriedTreasure = null;
    this.#groundCover?.destroy();
    this.#groundCover = null;
    this.#grassSurface?.destroy();
    this.#grassSurface = null;
    this.#riverWater?.destroy();
    this.#riverWater = null;
    this.#cloudField?.destroy();
    this.#cloudField = null;
    this.#setInteractionTarget(null);
    this.#mapRoot?.destroy();
    this.#mapRoot = null;
    this.#collisionWorld.clear();
    this.#pathOverpassCollider = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
  }
}
