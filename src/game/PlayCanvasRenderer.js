import { useDebounceFn } from "@vueuse/core";
import castleFireParticleUrl from "src/assets/game/effects/castle-fire-particle.png?url";
import earthSideUrl from "src/assets/game/tiles/earth-side.png";
import grassSideUrl from "src/assets/game/tiles/grass-side.png";
import grassTopUrl from "src/assets/game/tiles/grass-top.png";
import pathSideUrl from "src/assets/game/tiles/path-sandstone-side.png";
import pathTopUrl from "src/assets/game/tiles/path-sandstone-top.png";
import waterSideUrl from "src/assets/game/tiles/water-side.png";
import waterTopUrl from "src/assets/game/tiles/water-top.png";
import grassTerrainFragmentShader from "./objects/ground-cover/GrassTerrain.frag?raw";
import grassSideFragmentShader from "./objects/ground-cover/GrassSide.frag?raw";
import grassTurfSideFragmentShader from "./objects/ground-cover/GrassTurfSide.frag?raw";
import { Castle } from "./objects/castle/index.js";
import {
  GATEWAY_BANNER_SIGNS,
  GATEWAY_COLORS,
  Gateway,
} from "./objects/gateway/index.js";
import {
  BridgeRailingKit,
  OverpassStairs,
  PathArrows,
} from "./objects/path/index.js";
import { RiverWater } from "./objects/water/index.js";
import { Hero, HeroPatHand } from "./objects/hero/index.js";
import { HeroPatGesture } from "./controls/HeroPatGesture.js";
import { HERO_MOOD } from "./enum/HeroMood.js";
import { AxeTool, KnifeTool, ShovelTool } from "./objects/hero/tools/index.js";
import { GrassSurface, GroundCover } from "./objects/ground-cover/index.js";
import { GrassCarpet } from "./objects/ground-cover/GrassCarpet.js";
import {
  CubeCloudField,
  FloatingIslandMotion,
  SkyIslandScenery,
} from "./objects/scenery/index.js";
import { VoxelVegetation } from "./objects/vegetation/index.js";
import { BuriedTreasureField } from "./objects/treasure/index.js";
import { ScenePointerInteraction } from "./objects/shared/ScenePointerInteraction.js";
import { TileType } from "./MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "./config/terrain.js";
import { isArray } from "./helpers/types.js";
import { GRAPHICS_DRIVER } from "./enum/GraphicsDriver.js";
import { SCENE_OBJECT_TYPE } from "./enum/SceneObjectType.js";
import { SLOPE_DIRECTION } from "./enum/SlopeDirection.js";
import {
  GroundCollisionWorld,
  PathOverpassCollider,
} from "./collision/index.js";
import { GameModelLibrary } from "./models/index.js";
import { CameraPanBounds, HeroVisibilityController } from "./camera/index.js";
import { CameraOrbitPivot } from "./camera/CameraOrbitPivot.js";
import { GameUiTheme, HeroLifeHud, CoinHud } from "./ui/index.js";
import { colorFromHex, shadeHexColor } from "./helpers/colors.js";
import { RoyalAnimationPreview } from "./debug/RoyalAnimationPreview.js";
import { HeroAnimationPreview } from "./debug/HeroAnimationPreview.js";
import { HeroAnimationSign } from "./debug/HeroAnimationSign.js";
import { RoyalCastleTriggerField } from "./debug/RoyalCastleTriggerField.js";
import { GameOverScene } from "./rendering/scene/GameOverScene.js";
import { InventoryScene } from "./rendering/scene/InventoryScene.js";
import { SceneObjectRegistry } from "./rendering/scene/SceneObjectRegistry.js";
import { TerrainRenderer } from "./rendering/terrain/TerrainRenderer.js";
import {
  CUBE_SCALE,
  FIXED_HEIGHTS,
  SURFACE_ELEVATION_BIAS,
  SURFACE_MATERIALS,
} from "./rendering/terrain/TerrainMaterialMaps.js";

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
const HERO_RESPAWN_CAMERA_RETURN_DURATION = 0.32;
const CAMERA_TARGET_HEIGHT = 3.2;
const MAX_CASTLE_LIVES = 3;
const INVENTORY_DROP_MIN_FALL_HEIGHT = 0.35;
const INVENTORY_DROP_MAX_FALL_HEIGHT = 12;

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
  #orbitPivot = null;
  #panLimitsEnabled = true;
  #fitCenterX = 0;
  #fitCenterZ = 0;
  #viewportManuallyMoved = false;
  #baseOrthoHeight = 24;
  #cameraTargetY = CAMERA_TARGET_HEIGHT;
  #cameraPanBounds = null;
  #pathArrows = null;
  #bridgeRailingKit = null;
  #sceneObjects = new SceneObjectRegistry();
  #royalCastleTriggerField = null;
  #royalAnimationPreview = null;
  #heroAnimationPreview = null;
  #heroPatGesture = null;
  #heroPatHand = null;
  #onHeroMoodChange = null;
  #heroMoodVisible = false;
  #lifeHud = null;
  #coinHud = null;
  #inventoryScene = null;
  #scene = null;
  #heroVisibility = null;
  #floatingIslandMotion = null;
  #floatingCameraLocalOffset = null;
  #floatingCloudOffset = null;
  #floatingCameraOffsetX = 0;
  #floatingCameraOffsetY = 0;
  #floatingCameraOffsetApplied = false;
  #groundCover = null;
  #grassSurface = null;
  #grassCarpet = null;
  #riverWater = null;
  #vegetation = null;
  #buriedTreasure = null;
  #interactionProviders = [];
  #cloudField = null;
  #pathArrowsVisible = false;
  #collisionWorld = new GroundCollisionWorld();
  #terrainRenderer = null;
  #pathOverpassCollider = null;
  #modelLibrary = null;
  #gatewayColors = [...GATEWAY_COLORS];
  #pointerInteraction = null;
  #heroLookPointer = null;
  #interactionTarget = null;
  #interactionSignature = null;
  #onInteractionChange = null;
  #onHeroStateChange = null;
  #onInventoryFull = null;
  #viewportSignature = "";
  #viewportPersistenceEnabled = false;
  #saveViewportDebounced = null;
  #heroCameraReturnTransition = null;
  #debugStore = null;
  #gameViewStore = null;
  #graphicsSettingsStore = null;
  #heroConfigurationStore = null;
  #stopDebugStoreSubscription = null;
  #devWireframeInspectorEnabled = false;
  #devWireframeInspector = null;
  #translate = (key) => key;
  #uiTheme = null;
  #destroyed = false;
  #onRuntimeError;
  #frameUpdateFailed = false;

  constructor(
    canvas,
    container,
    {
      onRuntimeError = null,
      onInteractionChange = null,
      onHeroStateChange = null,
      onHeroMoodChange = null,
      onInventoryFull = null,
      t = (key) => key,
      debugStore,
      gameViewStore,
      graphicsSettingsStore,
      heroConfigurationStore,
      uiTheme,
      enableDevWireframeInspector = false,
    } = {},
  ) {
    this.#onRuntimeError = onRuntimeError;
    this.canvas = canvas;
    this.container = container;
    this.#onInteractionChange = onInteractionChange;
    this.#onHeroStateChange = onHeroStateChange;
    this.#onHeroMoodChange = onHeroMoodChange;
    this.#onInventoryFull = onInventoryFull;
    this.#debugStore = debugStore;
    this.#gameViewStore = gameViewStore;
    this.#graphicsSettingsStore = graphicsSettingsStore;
    this.#heroConfigurationStore = heroConfigurationStore;
    this.#devWireframeInspectorEnabled = enableDevWireframeInspector;
    this.#uiTheme = new GameUiTheme(uiTheme);
    this.#heroConfigurationStore.normalizeInventorySlots();
    this.#translate = t;
    this.#saveViewportDebounced = useDebounceFn(() => {
      this.#saveViewport();
    }, 150);
    this.#pointerInteraction = new ScenePointerInteraction({
      canvas,
      sceneObjects: this.#sceneObjects,
      pointerRay: (event) => this.#pointerRay(event),
      onMousePointerMove: this.#trackHeroLookPointer,
      onMousePointerLeave: () => this.#clearHeroIdleLookTarget(),
    });
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
    const [{ default: Ammo }, playCanvas] = await Promise.all([
      import("sync-ammo"),
      import("playcanvas/build/playcanvas/src/index.js"),
    ]);
    globalThis.Ammo ??= Ammo;
    this.#pc = playCanvas;
    if (this.#destroyed) {
      return;
    }
    const pc = this.#pc;
    this.#floatingCameraLocalOffset = new pc.Vec3();
    this.#floatingCloudOffset = new pc.Vec3();

    const graphicsDevice = await pc.createGraphicsDevice(this.canvas, {
      deviceTypes: this.#resolveDeviceTypes(pc),
      glslangUrl: GLSLANG_URL,
      twgslUrl: TWGSL_URL,
      antialias: this.#graphicsSettingsStore.antialias,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: this.#graphicsSettingsStore.powerPreference,
    });
    if (this.#destroyed) {
      graphicsDevice.destroy();
      return;
    }
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
    this.#inventoryScene = new InventoryScene({
      pc,
      app: this.#app,
      modelLibrary: this.#modelLibrary,
      heroConfigurationStore: this.#heroConfigurationStore,
      translate: this.#translate,
      theme: this.#uiTheme,
      getHero: () => this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO),
      getMapRoot: () => this.#mapRoot,
      getDropPlacement: (clientX, clientY, heightClientX, heightClientY) =>
        this.#inventoryDropPlacement(
          clientX,
          clientY,
          heightClientX,
          heightClientY,
        ),
    });
    this.#scene = new GameOverScene({
      pc,
      app: this.#app,
      translate: this.#translate,
      theme: this.#uiTheme,
      sceneObjects: this.#sceneObjects,
      getViewport: () => this.viewport,
      getCameraPosition: () => this.#camera?.getPosition() ?? null,
      getCameraState: () => this.#cameraState,
      setCameraState: (state) => this.#setCameraState(state),
      clearCameraReturn: () => {
        this.#heroCameraReturnTransition = null;
        this.#orbitPivot = null;
      },
      updateCamera: () => this.#updateCamera(),
      cameraPitch: CAMERA_PITCH,
      mapFitZoom: MAP_FIT_ZOOM,
    });

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
        ...Hero.modelUrls,
        HeroPatHand.modelUrl,
        ...(import.meta.env.DEV ? [HeroAnimationSign.modelUrl] : []),
        ...InventoryScene.modelUrls,
        Gateway.modelUrl,
        ...BridgeRailingKit.modelUrls,
        OverpassStairs.modelUrl,
        ...Castle.modelUrls,
        ...GroundCover.modelUrls,
        ...GrassCarpet.modelUrls,
        ...VoxelVegetation.modelUrls,
        ...BuriedTreasureField.modelUrls,
        ...RiverWater.modelUrls,
      ]),
    ]);
    if (this.#destroyed) {
      return;
    }
    this.resize();
    this.#applyDebugSettings();
    this.#stopDebugStoreSubscription = this.#debugStore.$subscribe(() => {
      this.#applyDebugSettings();
    });
    this.#app.start();
    this.#connectPointerInteractions();
    if (this.#devWireframeInspectorEnabled) {
      const { DevWireframeInspector } = await import(
        "./debug/DevWireframeInspector.js"
      );
      if (this.#destroyed) {
        return;
      }
      this.#devWireframeInspector = new DevWireframeInspector({
        pc,
        app: this.#app,
        canvas: this.canvas,
        camera: this.#camera.camera,
      });
      if (this.#debugStore.hasAny) {
        this.#devWireframeInspector.connect();
      }
    }
  }

  render(mapData) {
    this.#devWireframeInspector?.refresh();
    let initialViewport = null;
    if (!this.#mapData) {
      this.#gameViewStore.updateViewport(this.#gameViewStore.$state);
      initialViewport = { ...this.#gameViewStore.$state };
    }
    this.#inventoryScene.visible = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    this.#mapData = mapData;
    this.#cameraPanBounds = new CameraPanBounds(mapData);
    this.#scene?.reset();
    this.#zoom = 1;
    this.#rotation = 0;
    this.#panX = 0;
    this.#panZ = 0;
    this.#cameraTargetY = CAMERA_TARGET_HEIGHT;
    this.#viewportManuallyMoved = false;
    this.#heroCameraReturnTransition = null;
    this.#updateFitCenter();
    this.#panX = this.#fitCenterX;
    this.#panZ = this.#fitCenterZ;
    this.#rebuildScene();
    this.#fitCamera();
    this.#updateCamera();
    this.#heroVisibility?.schedule();
    if (this.#royalAnimationPreview) {
      initialViewport = {
        zoom: 2.5,
        rotation: 0,
        panX: 0,
        panZ: 0,
        manuallyMoved: true,
      };
    }
    if (this.#heroAnimationPreview) {
      initialViewport = {
        zoom: 1.5,
        rotation: 0,
        panX: 0,
        panZ: 0,
        manuallyMoved: true,
      };
    }
    if (initialViewport) {
      this.setViewport(initialViewport);
      this.#viewportPersistenceEnabled = true;
      this.#saveViewport();
    }
  }

  #applyDebugSettings() {
    this.pathArrowsVisible = this.#debugStore.pathArrows;
    this.panLimitsEnabled = !this.#debugStore.hasAny;
    if (this.#debugStore.hasAny) {
      this.#devWireframeInspector?.connect();
    } else {
      this.#devWireframeInspector?.disconnect();
    }
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

  set arrowsVisible(visible) {
    this.pathArrowsVisible = visible;
  }

  get arrowsVisible() {
    return this.#pathArrowsVisible;
  }

  get zoom() {
    return this.#zoom;
  }

  get canPan() {
    return (
      !this.#cameraLocked &&
      (!this.#panLimitsEnabled || this.#zoom > MAP_FIT_ZOOM)
    );
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

  get heroState() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!hero) {
      return null;
    }
    return {
      position: hero.position,
      animation: hero.animationState,
      animationTransitioning: hero.animationTransitioning,
      grounded: hero.grounded,
      drowning: hero.drowning,
      burning: hero.burning,
      ashes: hero.ashes,
      respawning: hero.isRespawning,
      facing: hero.facingDirection,
      headLookYaw: hero.headLookYaw,
      mood: hero.mood,
      buffs: hero.buffs,
      stats: hero.stats,
      movement: hero.movementState,
      patScreenPosition: this.#heroPatScreenPosition(),
      footPlacement: hero.footPlacementState,
      wallet: hero.wallet,
      inventory: this.inventoryState,
    };
  }

  get royalCastleStates() {
    return this.#sceneObjects
      .getAll(SCENE_OBJECT_TYPE.CASTLE)
      .map((castle) => castle.leisureState);
  }

  get royalTriggerPhysicsState() {
    return this.#royalCastleTriggerField?.physicsState ?? [];
  }

  get inventoryState() {
    return this.#inventoryScene?.state ?? {
      capacity: Hero.inventoryCapacity,
      items: [],
      visible: false,
    };
  }

  get inventoryVisible() {
    return this.#inventoryScene?.visible ?? false;
  }

  get inventoryFullReactionVisible() {
    return this.#inventoryScene?.fullReactionVisible ?? false;
  }

  get thrownInventoryItemCount() {
    return this.#inventoryScene?.thrownItemCount ?? 0;
  }

  get thrownInventoryItemStates() {
    return this.#inventoryScene?.thrownItemStates ?? [];
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
    const gateways = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.GATEWAY);
    gateways[index]?.setColor(color);
    this.#pathArrows?.setColor(paletteIndex, color);
  }

  setGatewayColors(colors) {
    if (!isArray(colors) || colors.length === 0) {
      return;
    }
    this.#gatewayColors = [...colors];
    const gateways = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.GATEWAY);
    gateways.forEach((gateway, index) => {
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

  get panLimitsEnabled() {
    return this.#panLimitsEnabled;
  }

  set panLimitsEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (this.#panLimitsEnabled === nextEnabled) {
      return;
    }
    this.#panLimitsEnabled = nextEnabled;
    this.#updateCamera();
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

  get hero() {
    return this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO) ?? null;
  }

  returnCameraToHero() {
    return this.#startHeroCameraReturn(true);
  }

  isGameOver() {
    return this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.isGameOver ?? false;
  }

  get gameOverReturnViewport() {
    return this.#scene?.returnViewport ?? this.viewport;
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
    this.#inventoryScene?.setVisible(nextVisible);
  }

  pressInventoryPointer(clientX, clientY) {
    return this.#inventoryScene?.pointerDown(clientX, clientY) ?? false;
  }

  moveInventoryPointer(clientX, clientY) {
    return this.#inventoryScene?.pointerMove(clientX, clientY) ?? false;
  }

  releaseInventoryPointer(clientX, clientY) {
    if (!this.inventoryVisible) {
      return false;
    }
    const shouldClose = this.#inventoryScene.pointerUp(clientX, clientY);
    return shouldClose ? this.closeInventory() : false;
  }

  leaveInventoryPointer() {
    this.#inventoryScene?.pointerLeave();
  }

  cancelInventoryPointer() {
    this.#inventoryScene?.cancelPointer();
  }

  setViewport({
    zoom,
    rotation = 0,
    panX = 0,
    panZ = 0,
    manuallyMoved = false,
  }) {
    if (this.#cameraLocked) {
      return;
    }
    this.#heroCameraReturnTransition = null;
    this.#orbitPivot = null;
    this.#zoom = Math.max(MAP_FIT_ZOOM, zoom);
    this.#rotation = rotation;
    this.#updateFitCenter();
    const fitted = this.#panLimitsEnabled && this.#zoom === MAP_FIT_ZOOM;
    this.#panX = fitted ? this.#fitCenterX : panX;
    this.#panZ = fitted ? this.#fitCenterZ : panZ;
    this.#viewportManuallyMoved = fitted ? false : manuallyMoved;
    this.#updateCamera();
  }

  zoomTo(newZoom, pivotX, pivotY) {
    if (this.#cameraLocked) {
      return;
    }
    this.#heroCameraReturnTransition = null;
    this.#orbitPivot = null;
    const previousZoom = this.#zoom;
    const constrainedZoom = Math.max(MAP_FIT_ZOOM, newZoom);
    const before = this.#screenOffsetToGround(pivotX, pivotY, this.#zoom);
    const after = this.#screenOffsetToGround(pivotX, pivotY, constrainedZoom);
    this.#panX += before.x - after.x;
    this.#panZ += before.z - after.z;
    this.#zoom = constrainedZoom;

    if (this.#panLimitsEnabled && constrainedZoom < previousZoom) {
      const previousDistance = previousZoom - MAP_FIT_ZOOM;
      const nextDistance = constrainedZoom - MAP_FIT_ZOOM;
      const centerRetention =
        previousDistance > 0 ? nextDistance / previousDistance : 0;
      this.#panX =
        this.#fitCenterX + (this.#panX - this.#fitCenterX) * centerRetention;
      this.#panZ =
        this.#fitCenterZ + (this.#panZ - this.#fitCenterZ) * centerRetention;
    }
    if (this.#panLimitsEnabled && constrainedZoom === MAP_FIT_ZOOM) {
      this.#panX = this.#fitCenterX;
      this.#panZ = this.#fitCenterZ;
      this.#viewportManuallyMoved = false;
    }
    this.#updateCamera();
  }

  panBy(deltaX, deltaY) {
    if (this.#cameraLocked) {
      return;
    }
    this.#heroCameraReturnTransition = null;
    this.#orbitPivot = null;
    if (this.#panLimitsEnabled && this.#zoom <= MAP_FIT_ZOOM) {
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
    if (this.#cameraLocked) {
      return this.#rotation;
    }
    this.#heroCameraReturnTransition = null;
    const preserveFocus = this.#zoom > MAP_FIT_ZOOM;
    if (preserveFocus && !this.#orbitPivot && this.#camera && this.#mapRoot) {
      this.#orbitPivot = new CameraOrbitPivot(this.#pc).find(
        this.#camera.camera,
        this.#mapRoot,
        this.#mapData,
        this.container.clientWidth,
        this.container.clientHeight,
      );
    }
    this.#rotation = (((this.#rotation + quarterTurns) % 4) + 4) % 4;
    if (preserveFocus && this.#orbitPivot) {
      const yaw = Math.PI / 4 + this.#rotation * (Math.PI / 2);
      const offset = (this.#cameraTargetY - this.#orbitPivot.y) / Math.tan(CAMERA_PITCH);
      this.#panX = this.#orbitPivot.x + Math.sin(yaw) * offset;
      this.#panZ = this.#orbitPivot.z + Math.cos(yaw) * offset;
      this.#viewportManuallyMoved = true;
    }
    this.#updateCamera(null, preserveFocus);
    this.#heroVisibility?.schedule();
    return this.#rotation;
  }

  resize() {
    this.#orbitPivot = null;
    if (!this.#app || !this.container) {
      return;
    }
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.#app.resizeCanvas(width, height);
    this.#fitCamera();
    this.#updateCamera();
    if (!this.#cameraLocked) {
      this.#heroVisibility?.schedule();
    }
  }

  get app() {
    return this.#app;
  }

  get playCanvas() {
    return this.#pc;
  }

  get canvasElement() {
    return this.canvas;
  }

  destroy() {
    this.#destroyed = true;
    this.#stopDebugStoreSubscription?.();
    this.#stopDebugStoreSubscription = null;
    this.#saveViewportDebounced?.flush();
    this.#disconnectPointerInteractions();
    this.#devWireframeInspector?.destroy();
    this.#devWireframeInspector = null;
    this.#app?.off("update", this.#updateFrame);
    this.#clearScene();
    this.#pathArrows?.destroy();
    this.#pathArrows = null;
    this.#lifeHud?.destroy();
    this.#lifeHud = null;
    this.#coinHud?.destroy();
    this.#coinHud = null;
    this.#inventoryScene?.destroy();
    this.#inventoryScene = null;
    this.#scene?.destroy();
    this.#scene = null;
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
    }
    if (name.startsWith("grassTopSide-")) {
      material.shaderChunks.glsl.set("diffusePS", grassTurfSideFragmentShader);
      material.setParameter("uGrassSurfaceLift", GRASS_SURFACE_LIFT);
    } else if (name.startsWith("grassEarthSide-")) {
      material.shaderChunks.glsl.set("diffusePS", grassSideFragmentShader);
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
      zoom: this.#zoom,
    });

    const scenery = new SkyIslandScenery(this.#mapData);
    const cubeBatches = new Map();
    this.#bridgeRailingKit = new BridgeRailingKit({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      materials: this.#materials,
      root: this.#mapRoot,
    });
    this.#terrainRenderer = new TerrainRenderer({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      root: this.#mapRoot,
      bridgeRailingKit: this.#bridgeRailingKit,
      cubeMaterials: (type, topCube, col, row, level) =>
        this.#cubeMaterials(type, topCube, col, row, level),
      pathEarthSideMaterial: (col, row, level) =>
        this.#pathEarthSideMaterial(col, row, level),
      grassEarthSideMaterial: (col, row, level) =>
        this.#grassEarthSideMaterial(col, row, level),
      sideVariant: (material, col, row, level) =>
        this.#sideVariant(material, col, row, level),
      addCubeMatrix: (...args) => this.#addCubeMatrix(...args),
      addBoxMatrix: (...args) => this.#addBoxMatrix(...args),
    });
    this.#buildIslandUndersideMatrices(
      cubeBatches,
      scenery.createUndersideVoxels(),
    );
    this.#terrainRenderer.buildBatches(cubeBatches);
    this.#createInstancedBatches(cubeBatches, this.#mapRoot, true);
    this.#vertexBuffers.push(...this.#bridgeRailingKit.build());
    this.#vertexBuffers.push(
      ...new OverpassStairs({
        pc: this.#pc,
        overpass: this.#mapData.overpassData,
        cols: this.#mapData.cols,
        rows: this.#mapData.rows,
        modelLibrary: this.#modelLibrary,
        materials: this.#materials,
        root: this.#mapRoot,
      }).build(),
    );
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
      zoom: this.#zoom,
    });
    this.#mapRoot.addChild(this.#riverWater.entity);
    this.#grassCarpet = new GrassCarpet({
      pc: this.#pc,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      zoom: this.#zoom,
    });
    this.#mapRoot.addChild(this.#grassCarpet.entity);
    this.#grassSurface = new GrassSurface({
      app: this.#app,
      pc: this.#pc,
      mapData: this.#mapData,
      terrainMaterials: [
        this.#grassCarpet.material,
      ].filter(Boolean),
      zoom: this.#zoom,
      getImpressionContacts: () => [
        ...(
          this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)
            ?.grassFootContacts ?? []
        ),
        ...(this.#inventoryScene?.grassImpressionContacts ?? []),
        ...(this.#groundCover?.grassImpressionContacts ?? []),
      ],
      getSurfaceContacts: () =>
        this.#royalCastleTriggerField?.grassSurfaceContacts ?? [],
      getWeightAt: (x, y, z) =>
        this.#collisionWorld.grassWeightAt(x, z, y),
    });

    this.#cloudField = new CubeCloudField({
      pc: this.#pc,
      app: this.#app,
      camera: this.#camera.camera,
      mapData: this.#mapData,
      layerId: this.#cloudLayer.id,
    });
    this.#app.root.addChild(this.#cloudField.entity);
    this.#buildCastle();
    this.#buildRoyalCastleTriggerField();
    if (import.meta.env.DEV && this.#mapData.royalAnimationPreview) {
      this.#royalAnimationPreview = new RoyalAnimationPreview({
        pc: this.#pc,
        app: this.#app,
        modelLibrary: this.#modelLibrary,
      });
      this.#mapRoot.addChild(this.#royalAnimationPreview.entity);
    }
    if (import.meta.env.DEV && this.#mapData.heroAnimationPreview) {
      this.#heroAnimationPreview = new HeroAnimationPreview({
        pc: this.#pc,
        app: this.#app,
        modelLibrary: this.#modelLibrary,
        canvas: this.canvas,
      });
      this.#mapRoot.addChild(this.#heroAnimationPreview.entity);
    }
    this.#lifeHud?.setCastleLives(
      this.#sceneObjects.getFirst(SCENE_OBJECT_TYPE.CASTLE)
        ? MAX_CASTLE_LIVES
        : 0,
      MAX_CASTLE_LIVES,
    );
    this.#buildGateways();
    this.#buildVegetation();
    this.#buildGroundCover();
    this.#buildBuriedTreasure();
    this.#terrainRenderer.buildPhysicsSurface(this.#collisionWorld);
    this.#buildHero();
    this.#connectHeroTools();
    this.#grassSurface.refreshObstacles();
    this.#updateInteractionTarget();

    this.#mapRoot.addChild(this.#pathArrows.render(this.#mapData));
    this.#captureCameraVisualBounds();
  }

  #captureCameraVisualBounds() {
    this.#mapRoot?.syncHierarchy();
    const castles = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.CASTLE);
    const gateways = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.GATEWAY);
    const roots = [
      ...castles.map((castle, index) => ({
        name: `castle-${index}`,
        protectAtPanLimit: true,
        centerReachableAtEveryZoom: true,
        root: castle.entity,
      })),
      ...gateways.map((gateway, index) => ({
        name: `gateway-${index}`,
        protectAtPanLimit: true,
        root: gateway.entity,
      })),
      ...[this.#heroAnimationPreview, this.#royalAnimationPreview].flatMap(
        (preview) => (preview?.entity.children ?? []).map((root) => ({
          name: `animation-preview-${root.name}`,
          protectAtPanLimit: true,
          centerReachableAtEveryZoom: true,
          root,
        })),
      ),
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
    if (this.#mapData.heroAnimationPreview || this.#mapData.royalAnimationPreview) {
      return;
    }
    const hero = new Hero({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      spawnCenter: { x: this.#fitCenterX, z: this.#fitCenterZ },
      getViewRotation: () => this.#rotation,
      onPositionChange: this.#handleHeroPositionChange,
      onFacingChange: this.#handleHeroFacingChange,
      onStateChange: this.#handleHeroStateChange,
      onInventoryFull: this.#handleInventoryFull,
      onMovementInput: () => this.#startHeroCameraReturn(),
      heroConfigurationStore: this.#heroConfigurationStore,
      collisionWorld: this.#collisionWorld,
      modelLibrary: this.#modelLibrary,
    });
    this.#sceneObjects.setOne(SCENE_OBJECT_TYPE.HERO, hero);
    this.#mapRoot.addChild(hero.entity);
    this.#heroPatHand = new HeroPatHand({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      getPatPosition: () => hero.patPosition,
      getViewRotation: () => this.#rotation,
      onContact: () => hero.pat(),
    });
    this.#mapRoot.addChild(this.#heroPatHand.entity);
    this.#heroPatGesture = new HeroPatGesture(this.canvas, {
      hitTest: (event) => this.#isHeroPatHit(event),
      pat: () => {
        if (hero.canBePatted) {
          this.#heroPatHand?.pat();
        }
      },
    });
    this.#heroVisibility = new HeroVisibilityController({
      pc: this.#pc,
      app: this.#app,
      canvas: this.canvas,
      camera: this.#camera.camera,
      hero: hero.entity,
      getRotation: () => this.#rotation,
      setRotation: (rotation) => {
        if (
          this.#cameraLocked ||
          hero.isInDeathSequence ||
          (this.#orbitPivot && this.#viewportManuallyMoved)
        ) {
          return;
        }
        this.#rotation = rotation;
        this.#updateCamera();
      },
      shouldPreserveRotation: () => {
        if (this.#orbitPivot && this.#viewportManuallyMoved) {
          return true;
        }
        const position = hero.position;
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
    this.#updateCastlesForHero(hero.position);
    this.#groundCover?.applyHeroInteraction(
      hero.position,
      hero.movementState,
    );
    this.#buriedTreasure?.applyHeroPosition(hero.position);
  }

  #connectHeroTools() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (hero?.tools) {
      this.#groundCover.tool = hero.tools.get(KnifeTool.name);
      this.#vegetation.tool = hero.tools.get(AxeTool.name);
      this.#buriedTreasure.tool = hero.tools.get(ShovelTool.name);
    }
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
      onVegetationRemoved: (vegetation) => {
        this.#buriedTreasure?.removeVegetation(vegetation);
        this.#grassSurface?.refreshObstacles(vegetation);
      },
    });
    this.#collisionWorld.add(this.#vegetation, { physicsSurface: false });
    this.#mapRoot.addChild(this.#vegetation.entity);
  }

  #buildGroundCover() {
    this.#groundCover = new GroundCover({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      onCollect: (item) =>
        this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.collectInventoryItem(item) ?? false,
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
        this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.collectCoin(type, amount),
      onInteractionChange: () => this.#updateInteractionTarget(),
      onTerrainExcavated: (position, radius) =>
        this.#grassCarpet?.clearAt(position, radius),
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
      this.#sceneObjects.add(SCENE_OBJECT_TYPE.GATEWAY, gateway);
    });
  }

  #buildCastle() {
    const { castle, castles, cols, rows, heightmap } = this.#mapData;
    const definitions = castles?.length ? castles : castle ? [castle] : [];
    for (const definition of definitions) {
      if (!definition?.position || !definition.doors?.length) {
        continue;
      }
      const builtCastle = new Castle({
        pc: this.#pc,
        app: this.#app,
        position: {
          x: definition.position.col - (cols - 1) / 2 - CUBE_SCALE / 2,
          z: definition.position.row - (rows - 1) / 2 - CUBE_SCALE / 2,
          width: definition.position.width,
          depth: definition.position.depth,
          elevation: definition.position.elevation,
        },
        doors: definition.doors.map(({ side, offset, width, cells = [] }) => {
          const approachElevations = cells
            .map(({ col, row }) => heightmap?.[row]?.[col])
            .filter(Number.isFinite);
          return {
            side,
            offset,
            width,
            approachElevation: approachElevations.length
              ? Math.max(...approachElevations)
              : definition.position.elevation,
          };
        }),
        style: definition.style,
        occupantSeed: definition.occupantSeed,
        modelLibrary: this.#modelLibrary,
        fireParticleTexture: this.#castleFireParticleTexture,
        onRuntimeError: this.#onRuntimeError,
      });
      this.#sceneObjects.add(SCENE_OBJECT_TYPE.CASTLE, builtCastle);
      this.#collisionWorld.add(builtCastle);
      this.#mapRoot.addChild(builtCastle.entity);
    }
  }

  #buildRoyalCastleTriggerField() {
    const triggers = this.#mapData.royalCastleTriggers ?? [];
    if (!import.meta.env.DEV || !triggers.length) {
      return;
    }
    this.#royalCastleTriggerField = new RoyalCastleTriggerField({
      pc: this.#pc,
      app: this.#app,
      triggers,
      cols: this.#mapData.cols,
      rows: this.#mapData.rows,
      tileHeightAt: (col, row) => this.#tileHeight(col, row),
      getGrassSupportPoints: (position, radius) =>
        this.#grassCarpet.supportPointsWithin(position, radius),
    });
    this.#collisionWorld.add(this.#royalCastleTriggerField);
    this.#mapRoot.addChild(this.#royalCastleTriggerField.entity);
  }

  #updateCastlesForHero(position) {
    this.#royalCastleTriggerField?.updateHeroPosition(position);
    const triggers = this.#mapData.royalCastleTriggers ?? [];
    for (const [index, castle] of this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.CASTLE).entries()) {
      castle.updateHeroPosition(position);
      const trigger = triggers.find((entry) =>
        entry.castleIndex === index || entry.castleIndexes?.includes(index));
      if (!trigger) {
        continue;
      }
      const triggerX = trigger.col - (this.#mapData.cols - 1) / 2;
      const triggerZ = trigger.row - (this.#mapData.rows - 1) / 2;
      const standingOnTrigger =
        Math.abs(position.x - triggerX) <= 0.48 &&
        Math.abs(position.z - triggerZ) <= 0.48 &&
        Math.abs(position.y - this.#tileHeight(trigger.col, trigger.row)) < 2;
      castle.setLeisurePresent(standingOnTrigger);
    }
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
    if (this.#frameUpdateFailed) {
      return;
    }
    try {
      this.#updateRuntimeSystems(deltaTime);
    } catch (error) {
      this.#frameUpdateFailed = true;
      if (this.#onRuntimeError) {
        this.#onRuntimeError(error);
        return;
      }
      throw error;
    }
  };

  #updateRuntimeSystems(deltaTime) {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    const mood = hero?.mood;
    if (mood && mood.kind !== HERO_MOOD.CALM) {
      this.#heroMoodVisible = true;
      this.#onHeroMoodChange?.({
        ...mood,
        screen: this.#heroPatScreenPosition(),
      });
    } else if (this.#heroMoodVisible) {
      this.#heroMoodVisible = false;
      this.#onHeroMoodChange?.(null);
    }
    this.#riverWater?.update(deltaTime, hero, this.#camera?.camera);
    this.#heroPatHand?.update(deltaTime);
    const inventoryVisibilityChange =
      this.#inventoryScene?.syncConfiguredVisibility();
    if (inventoryVisibilityChange === true) {
      this.#setInteractionTarget(null);
    } else if (inventoryVisibilityChange === false) {
      this.#updateInteractionTarget();
    }
    this.#inventoryScene?.update(
      deltaTime,
      this.#inventoryFullIndicatorScreenPosition(),
    );
    this.#cloudField?.update(deltaTime);
    this.#updateHeroCameraReturn(deltaTime);
    this.#scene?.update(deltaTime);
    this.#updateFloatingIslandMotion(deltaTime);
  }

  #updateFloatingIslandMotion(deltaTime) {
    if (
      !this.#floatingIslandMotion ||
      !this.#camera?.camera ||
      !this.#cloudField?.entity
    ) {
      return;
    }
    const offset = this.#floatingIslandMotion.update(deltaTime);
    // Express the motion in screen pixels so the hover remains consistent
    // without adding a full-screen filter over thin geometry.
    const worldUnitsPerPixel =
      (2 * this.#camera.camera.orthoHeight) /
      Math.max(1, this.canvas.clientHeight);
    this.#setFloatingCameraOffset(
      -offset.x * worldUnitsPerPixel,
      -offset.y * worldUnitsPerPixel,
    );
  }

  #setFloatingCameraOffset(x, y) {
    if (!this.#camera) {
      return;
    }
    if (this.#floatingCameraOffsetApplied) {
      this.#camera.translateLocal(
        -this.#floatingCameraOffsetX,
        -this.#floatingCameraOffsetY,
        0,
      );
    }
    this.#floatingCameraOffsetX = x;
    this.#floatingCameraOffsetY = y;
    this.#floatingCameraLocalOffset.set(
      this.#floatingCameraOffsetX,
      this.#floatingCameraOffsetY,
      0,
    );
    this.#camera
      .getRotation()
      .transformVector(
        this.#floatingCameraLocalOffset,
        this.#floatingCloudOffset,
      );
    this.#camera.translateLocal(
      this.#floatingCameraOffsetX,
      this.#floatingCameraOffsetY,
      0,
    );
    this.#floatingCameraOffsetApplied = true;
    if (this.#cloudField) {
      this.#cloudField.floatingOffset = this.#floatingCloudOffset;
    }
  }

  #handleInventoryFull = (inventory) => {
    this.#inventoryScene?.showFullReaction(
      this.#inventoryFullIndicatorScreenPosition(),
    );
    this.#onInventoryFull?.(inventory);
  };

  #inventoryFullIndicatorScreenPosition() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!hero || !this.#camera?.camera) {
      return null;
    }
    const position = hero.inventoryFullIndicatorPosition;
    return this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(position.x, position.y, position.z),
    );
  }

  #heroPatScreenPosition() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    const position = hero?.patPosition;
    if (!position || !this.#camera?.camera) {
      return null;
    }
    const center = this.#camera.camera.worldToScreen(position);
    const edge = this.#camera.camera.worldToScreen(
      position.clone().add(this.#camera.right.clone().mulScalar(0.42)),
    );
    return {
      x: center.x,
      y: center.y,
      radius: Math.max(5, Math.abs(edge.x - center.x)),
    };
  }

  #isHeroPatHit(event) {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (this.inventoryVisible || !hero?.canBePatted) {
      return false;
    }
    const head = this.#heroPatScreenPosition();
    const rect = this.canvas.getBoundingClientRect();
    if (
      !head ||
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return false;
    }
    return (
      Math.hypot(
        event.clientX - rect.left - head.x,
        (event.clientY - rect.top - head.y) / 0.85,
      ) <= head.radius
    );
  }

  #cubeMaterials(type, topCube, col, row, level) {
    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      // The castle hides the terrain directly beneath it. Any foundation top
      // that remains visible at an outer edge should still read as landscape;
      // the grass carpet separately excludes these structure-owned cells.
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
    for (const direction of Object.values(SLOPE_DIRECTION)) {
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

    // Terrain cubes are stacked into cliffs. Their visible wall faces span the
    // complete tile so adjacent cubes meet coplanarly; per-cube edge bevels
    // otherwise form dark horizontal and vertical grooves through one wall.
    for (const sign of [-1, 1]) {
      addFace("wallSides", [
        [sign * half, -half, -half],
        [sign * half, half, -half],
        [sign * half, half, half],
        [sign * half, -half, half],
      ]);
      addFace("wallSides", [
        [-half, -half, sign * half],
        [half, -half, sign * half],
        [half, half, sign * half],
        [-half, half, sign * half],
      ]);
    }

    const surfaceY = half + SURFACE_ELEVATION_BIAS;
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
        if (direction === SLOPE_DIRECTION.NORTH) {
          return z < 0 ? high : low;
        }
        if (direction === SLOPE_DIRECTION.SOUTH) {
          return z > 0 ? high : low;
        }
        if (direction === SLOPE_DIRECTION.EAST) {
          return x > 0 ? high : low;
        }
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
    if (this.#panLimitsEnabled && this.#zoom === MAP_FIT_ZOOM) {
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
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    this.#orbitPivot = null;
    this.#updateCastlesForHero({ x, y, z });
    this.#groundCover?.applyHeroInteraction(
      { x, y, z },
      hero?.movementState,
    );
    this.#buriedTreasure?.applyHeroPosition({ x, y, z });
    this.#updateInteractionTarget({ x, y, z });
    if (this.#cameraLocked) {
      return;
    }
    const heroWorldPosition = hero.entity.getPosition();
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

    if (hero?.isRespawning) {
      if (heroIsOutOfBounds) {
        this.#startHeroCameraReturn(false, {
          allowAutomatic: true,
          duration: HERO_RESPAWN_CAMERA_RETURN_DURATION,
          preserveFocus: true,
        });
      }
      this.#heroVisibility?.schedule();
      return;
    }

    if (hero?.isInDeathSequence) {
      return;
    }

    if (this.#viewportManuallyMoved) {
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

  #startHeroCameraReturn(
    force = false,
    {
      allowAutomatic = false,
      duration = HERO_CAMERA_RETURN_DURATION,
      preserveFocus = false,
    } = {},
  ) {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (
      this.#heroCameraReturnTransition ||
      this.#cameraLocked ||
      (!allowAutomatic && !this.#viewportManuallyMoved) ||
      !hero ||
      !this.#camera
    ) {
      return Boolean(this.#heroCameraReturnTransition);
    }
    const heroWorldPosition = hero.entity.getPosition();
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
      duration,
      preserveFocus,
    };
    this.#orbitPivot = null;
    return true;
  }

  #updateHeroCameraReturn(deltaTime) {
    const transition = this.#heroCameraReturnTransition;
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (
      !transition ||
      this.#cameraLocked ||
      !hero ||
      !this.#camera
    ) {
      return;
    }
    transition.elapsed += Math.max(0, deltaTime);
    const progress = Math.min(
      1,
      transition.elapsed / transition.duration,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    const heroWorldPosition = hero.entity.getPosition();
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
    this.#updateCamera(null, transition.preserveFocus);
    this.#heroVisibility?.schedule();
  }

  #handleHeroFacingChange = () => {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!hero?.isUsingTool && !hero?.isCollecting) {
      this.#updateInteractionTarget();
    }
  };

  #handleHeroStateChange = (state) => {
    this.#lifeHud?.setLives(state.lives, state.maxLives);
    this.#coinHud?.setWallet(state.wallet);
    this.#inventoryScene?.setInventory(state.inventory);
    this.#scene?.syncHeroState?.(state);
    this.#onHeroStateChange?.(state);
  };

  get #cameraLocked() {
    return this.#scene?.cameraLocked ?? false;
  }

  get #cameraState() {
    return {
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      targetY: this.#cameraTargetY,
      zoom: this.#zoom,
      baseOrthoHeight: this.#baseOrthoHeight,
    };
  }

  #setCameraState(state) {
    if (Number.isFinite(state.rotation)) {
      this.#rotation = state.rotation;
    }
    if (Number.isFinite(state.panX)) {
      this.#panX = state.panX;
    }
    if (Number.isFinite(state.panZ)) {
      this.#panZ = state.panZ;
    }
    if (Number.isFinite(state.targetY)) {
      this.#cameraTargetY = state.targetY;
    }
    if (Number.isFinite(state.zoom)) {
      this.#zoom = state.zoom;
    }
    if (Object.hasOwn(state, "viewportManuallyMoved")) {
      this.#viewportManuallyMoved = Boolean(state.viewportManuallyMoved);
    }
  }

  #updateCamera(panOrigin = null, preserveFocus = false) {
    if (!this.#camera || !this.#mapData) {
      return;
    }
    if (this.#panLimitsEnabled && this.#zoom === MAP_FIT_ZOOM) {
      this.#updateFitCenter();
      this.#panX = this.#fitCenterX;
      this.#panZ = this.#fitCenterZ;
    }
    if (
      this.#panLimitsEnabled &&
      !this.#cameraLocked &&
      !preserveFocus
    ) {
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
    this.#floatingCameraOffsetApplied = false;
    this.#camera.setPosition(
      target.x + Math.sin(yaw) * horizontalDistance,
      target.y + Math.sin(CAMERA_PITCH) * CAMERA_DISTANCE,
      target.z + Math.cos(yaw) * horizontalDistance,
    );
    this.#camera.lookAt(target);
    this.#camera.camera.orthoHeight = this.#baseOrthoHeight / this.#zoom;
    if (this.#floatingIslandMotion) {
      this.#floatingIslandMotion.zoom = this.#zoom;
    }
    if (this.#groundCover) {
      this.#groundCover.zoom = this.#zoom;
    }
    if (this.#grassSurface) {
      this.#grassSurface.zoom = this.#zoom;
      this.#grassCarpet.zoom = this.#zoom;
    }
    this.#cloudField?.setCameraState({
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      zoom: this.#zoom,
    });
    this.#setFloatingCameraOffset(
      this.#floatingCameraOffsetX,
      this.#floatingCameraOffsetY,
    );
    this.#updateHeroIdleLookTarget();
    this.#notifyViewportChange();
  }

  #notifyViewportChange() {
    if (this.#cameraLocked) {
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
    void this.#saveViewportDebounced();
  }

  #saveViewport() {
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

  #connectPointerInteractions() {
    this.#pointerInteraction?.connect();
  }

  #disconnectPointerInteractions() {
    this.#pointerInteraction?.disconnect();
    this.#clearHeroIdleLookTarget();
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

  #inventoryDropPlacement(clientX, clientY, heightClientX, heightClientY) {
    const ray = this.#pointerRay({ clientX, clientY });
    const heightRay = this.#pointerRay({
      clientX: heightClientX ?? clientX,
      clientY: heightClientY ?? clientY,
    });
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!ray || !heightRay || !hero) {
      return null;
    }
    const hit = this.#inventoryDropRaycast(heightRay);
    const position = this.#inventoryDropScreenPosition(
      hit?.point?.y ?? hero.position.y,
      clientX,
      clientY,
    );
    if (!position) {
      return null;
    }
    const direction = {
      x: position.x - hero.position.x,
      z: position.z - hero.position.z,
    };
    if (Math.hypot(direction.x, direction.z) <= 0.000001) {
      return {
        position,
        direction: hero.facingDirection,
        dropStartY: this.#inventoryDropStartY(
          position,
          heightClientY ?? clientY,
        ),
      };
    }
    return {
      position,
      direction,
      dropStartY: this.#inventoryDropStartY(position, heightClientY ?? clientY),
    };
  }

  #inventoryDropRaycast(ray) {
    const hits = this.#app?.systems.rigidbody?.raycastAll?.(
      ray.start,
      ray.end,
      { sort: true },
    ) ?? [];
    return hits.find((hit) => hit.normal?.y >= 0.35) ?? null;
  }

  #inventoryDropScreenPosition(height, clientX, clientY) {
    if (!this.#camera?.camera || !this.canvas) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const center = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(this.#panX, height, this.#panZ),
    );
    const correction = this.#screenDeltaToGround(
      clientX - rect.left - center.x,
      clientY - rect.top - center.y,
      this.#zoom,
    );
    return new this.#pc.Vec3(
      this.#panX + correction.x,
      height,
      this.#panZ + correction.z,
    );
  }

  #inventoryDropStartY(position, clientY) {
    if (!this.#camera?.camera || !this.canvas) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const screenPosition = this.#camera.camera.worldToScreen(position);
    const worldPerPixel =
      (2 * this.#baseOrthoHeight) /
      Math.max(1, this.canvas.clientHeight) /
      this.#zoom;
    const cursorY = clientY - rect.top;
    const upwardScreenDistance = screenPosition.y - cursorY;
    if (upwardScreenDistance <= 0) {
      return null;
    }
    const fallHeight =
      (upwardScreenDistance * worldPerPixel) / Math.cos(CAMERA_PITCH);
    return position.y + Math.max(
      INVENTORY_DROP_MIN_FALL_HEIGHT,
      Math.min(INVENTORY_DROP_MAX_FALL_HEIGHT, fallHeight),
    );
  }

  #inventoryDropPlanePosition(ray, height) {
    const rayY = ray.end.y - ray.start.y;
    if (Math.abs(rayY) <= 0.000001) {
      return null;
    }
    const distance = (height - ray.start.y) / rayY;
    if (distance < 0 || distance > 1) {
      return null;
    }
    return new this.#pc.Vec3(
      ray.start.x + (ray.end.x - ray.start.x) * distance,
      height,
      ray.start.z + (ray.end.z - ray.start.z) * distance,
    );
  }

  #trackHeroLookPointer = (event) => {
    this.#heroLookPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    this.#updateHeroIdleLookTarget();
  };

  #updateHeroIdleLookTarget() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!this.#heroLookPointer || !hero) {
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
    const distance = (hero.position.y - ray.start.y) / rayY;
    if (distance < 0 || distance > 1) {
      return;
    }
    hero.idleLookTarget = {
      x: ray.start.x + (ray.end.x - ray.start.x) * distance,
      z: ray.start.z + (ray.end.z - ray.start.z) * distance,
    };
  }

  #clearHeroIdleLookTarget() {
    this.#heroLookPointer = null;
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (hero) {
      hero.idleLookTarget = null;
    }
  }

  #updateInteractionTarget() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (
      !hero ||
      this.inventoryVisible ||
      hero.isCollecting ||
      hero.isReacting
    ) {
      this.#setInteractionTarget(null);
      return;
    }
    if (hero.isUsingTool) {
      return;
    }
    let target = null;
    for (const provider of this.#interactionProviders) {
      const candidate = provider.findInteraction({
        hero,
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
    this.#orbitPivot = null;
    this.#heroPatGesture?.destroy();
    this.#heroPatGesture = null;
    this.#heroPatHand?.destroy();
    this.#heroPatHand = null;
    this.#heroMoodVisible = false;
    this.#onHeroMoodChange?.(null);
    this.#pointerInteraction?.cancelActivePointer();
    this.#pathArrows?.clear();
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.GATEWAY);
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.CASTLE);
    this.#royalCastleTriggerField?.destroy();
    this.#royalCastleTriggerField = null;
    this.#royalAnimationPreview?.destroy();
    this.#royalAnimationPreview = null;
    this.#heroAnimationPreview?.destroy();
    this.#heroAnimationPreview = null;
    this.#heroVisibility?.destroy();
    this.#heroVisibility = null;
    this.#floatingIslandMotion = null;
    this.#floatingCameraOffsetX = 0;
    this.#floatingCameraOffsetY = 0;
    this.#floatingCameraOffsetApplied = false;
    this.#interactionProviders = [];
    this.#inventoryScene?.clearWorldItems();
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.HERO);
    this.#terrainRenderer?.destroy();
    this.#terrainRenderer = null;
    this.#vegetation?.destroy();
    this.#vegetation = null;
    this.#buriedTreasure?.destroy();
    this.#buriedTreasure = null;
    this.#groundCover?.destroy();
    this.#groundCover = null;
    this.#grassSurface?.destroy();
    this.#grassSurface = null;
    this.#grassCarpet?.destroy();
    this.#grassCarpet = null;
    this.#riverWater?.destroy();
    this.#riverWater = null;
    this.#cloudField?.destroy();
    this.#cloudField = null;
    this.#setInteractionTarget(null);
    this.#mapRoot?.destroy();
    this.#mapRoot = null;
    this.#bridgeRailingKit = null;
    this.#collisionWorld.clear();
    this.#pathOverpassCollider = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
  }
}
