import { useDebounceFn } from "@vueuse/core";
import Ammo from "sync-ammo";
import * as playCanvas from "playcanvas/build/playcanvas/src/index.js";
import castleDoorUrl from "src/assets/game/textures/castle-door.png";
import castleStoneUrl from "src/assets/game/textures/castle-stone.png";
import castleFireParticleUrl from "src/assets/game/effects/castle-fire-particle.png?url";
import glslangScriptUrl from "src/assets/game/wasm/glslang/glslang.js?url";
import glslangWasmUrl from "src/assets/game/wasm/glslang/glslang.wasm?url";
import twgslScriptUrl from "src/assets/game/wasm/twgsl/twgsl.js?url";
import twgslWasmUrl from "src/assets/game/wasm/twgsl/twgsl.wasm?url";
import waterSideUrl from "src/assets/game/tiles/water-side.png";
import waterTopUrl from "src/assets/game/tiles/water-top.png";
import { Castle } from "./objects/castle/index.js";
import { GATEWAY_BANNER_SIGNS, Gateway } from "./objects/gateway/index.js";
import { BridgeRailingKit, OverpassStairs } from "./objects/path/index.js";
import { RiverWater } from "./objects/water/index.js";
import { Hero, HeroPatHand } from "./objects/hero/index.js";
import { HeroPatGesture } from "./controls/HeroPatGesture.js";
import { KnifeTool, ShovelTool } from "./objects/hero/tools/index.js";
import { GrassSurface, GroundCover } from "./objects/ground-cover/index.js";
import { GrassCarpet } from "./objects/ground-cover/GrassCarpet.js";
import {
  CubeCloudField,
  FloatingIslandMotion,
  SkyIslandScenery,
} from "./objects/scenery/index.js";
import { CliffVines } from "./objects/vegetation/index.js";
import { BuriedTreasureField } from "./objects/treasure/index.js";
import { ScenePointerInteraction } from "./objects/shared/ScenePointerInteraction.js";
import { TileType } from "./MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "./config/terrain.js";
import { GRAPHICS_DRIVER } from "./enum/GraphicsDriver.js";
import { SCENE_OBJECT_TYPE } from "./enum/SceneObjectType.js";
import { ShaderTranspilerAssetsNotColocatedError } from "./errors/assets/index.js";
import {
  GroundCollisionWorld,
  PathOverpassCollider,
} from "./collision/index.js";
import { GameModelLibrary } from "./models/index.js";
import { GameCamera, HeroVisibilityController } from "./camera/index.js";
import { CameraOrbitPivot } from "./camera/CameraOrbitPivot.js";
import {
  CoinHud,
  GameUiTheme,
  HeroLifeHud,
  HudCollection,
} from "./ui/index.js";
import { colorFromHex } from "./helpers/colors.js";
import { MapObjectFactory } from "./objects/MapObjectFactory.js";
import { GameOverScene } from "./rendering/scene/GameOverScene.js";
import { InventoryScene } from "./rendering/scene/InventoryScene.js";
import { SceneObjectRegistry } from "./rendering/scene/SceneObjectRegistry.js";
import { TerrainRenderer } from "./rendering/terrain/TerrainRenderer.js";
import { GrassSurfaceMaterials } from "./rendering/terrain/GrassSurfaceMaterials.js";
import { EarthSurfaceMaterials } from "./rendering/terrain/EarthSurfaceMaterials.js";
import { TerrainMaterialSelector } from "./rendering/terrain/TerrainMaterialSelector.js";
import { PathSurfaceMaterials } from "./rendering/terrain/PathSurfaceMaterials.js";
import {
  CUBE_SCALE,
  FIXED_HEIGHTS,
  GRASS_SURFACE_TILES,
  SURFACE_MATERIALS,
} from "./rendering/terrain/TerrainMaterialMaps.js";

const TEXTURE_URLS = {
  ...GrassSurfaceMaterials.textureUrls,
  ...EarthSurfaceMaterials.textureUrls,
  ...PathSurfaceMaterials.textureUrls,
  water: waterTopUrl,
  waterSide: waterSideUrl,
  castleDoor: castleDoorUrl,
  castleStone: castleStoneUrl,
  castleFireParticle: castleFireParticleUrl,
};

const MATERIAL_DEFINITIONS = {
  water: { color: 0xd8f2ff, texture: "water", gloss: 0.22 },
};

const SIDE_VARIANT_DEFINITIONS = {
  waterSide: {
    texture: "waterSide",
    colors: [0xd8f2ff, 0xcfeaff, 0xe0f5ff, 0xc9e7ff, 0xd5efff, 0xdff7ff],
    gloss: 0.18,
  },
};

const SIDE_VARIANT_TRANSFORMS = [
  { startU: 0, scaleU: 0.72, flipU: false },
  { startU: 0.14, scaleU: 0.72, flipU: true },
  { startU: 0.28, scaleU: 0.72, flipU: false },
  { startU: 0, scaleU: 0.72, flipU: true },
  { startU: 0.14, scaleU: 0.72, flipU: false },
  { startU: 0.28, scaleU: 0.72, flipU: true },
];
const CAMERA_PITCH = Math.atan(1 / Math.sqrt(2));
const CAMERA_DISTANCE = 80;
const SHADOW_DISTANCE = 150;
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

function getShaderTranspilerScriptUrl(scriptUrl, wasmUrl) {
  const expectedWasmUrl = scriptUrl.replace(/\.js$/, ".wasm");
  if (expectedWasmUrl !== wasmUrl) {
    throw new ShaderTranspilerAssetsNotColocatedError(scriptUrl, wasmUrl);
  }
  return scriptUrl;
}

const GLSLANG_URL = getShaderTranspilerScriptUrl(
  glslangScriptUrl,
  glslangWasmUrl,
);
const TWGSL_URL = getShaderTranspilerScriptUrl(twgslScriptUrl, twgslWasmUrl);

export class PlayCanvasRenderer {
  #pc = null;
  #app = null;
  #camera = null;
  #cloudLayer = null;
  #mapRoot = null;
  #mapData = null;
  #materials = new Map();
  #textureAssets = new Map();
  #vertexBuffers = [];
  #bridgeRailingKit = null;
  #sceneObjects = new SceneObjectRegistry();
  #heroPatGesture = null;
  #heroPatHand = null;
  #huds = null;
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
  #grassMaterials = null;
  #earthMaterials = null;
  #terrainMaterialSelector = null;
  #riverWater = null;
  #buriedTreasure = null;
  #interactionProviders = [];
  #cloudField = null;
  #collisionWorld = new GroundCollisionWorld();
  #terrainRenderer = null;
  #pathOverpassCollider = null;
  #modelLibrary = null;
  #pointerInteraction = null;
  #heroLookPointer = null;
  #interactionTarget = null;
  #interactionSignature = null;
  #onInteractionChange = null;
  #viewportSignature = "";
  #viewportPersistenceEnabled = false;
  #saveViewportDebounced = null;
  #debugStore = null;
  #gameViewStore = null;
  #graphicsSettingsStore = null;
  #heroConfigurationStore = null;
  #heroStateStore = null;
  #stopDebugStoreSubscription = null;
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
      t = (key) => key,
      debugStore,
      gameViewStore,
      graphicsSettingsStore,
      heroConfigurationStore,
      heroStateStore,
      uiTheme,
    } = {},
  ) {
    this.#onRuntimeError = onRuntimeError;
    this.canvas = canvas;
    this.container = container;
    this.#onInteractionChange = onInteractionChange;
    this.#debugStore = debugStore;
    this.#gameViewStore = gameViewStore;
    this.#graphicsSettingsStore = graphicsSettingsStore;
    this.#heroConfigurationStore = heroConfigurationStore;
    this.#heroStateStore = heroStateStore;
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
    this.#huds = new HudCollection({
      pc,
      app: this.#app,
      theme: this.#uiTheme,
    });
    this.addHud(HeroLifeHud);
    this.addHud(CoinHud);
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
        this.#camera.returnTransition = null;
        this.#camera.orbitPivot = null;
      },
      updateCamera: () => this.#updateCamera(),
      cameraPitch: CAMERA_PITCH,
      mapFitZoom: MAP_FIT_ZOOM,
    });

    this.#camera = new GameCamera({
      pc,
      app: this.#app,
      cloudLayerId: this.#cloudLayer.id,
      targetY: CAMERA_TARGET_HEIGHT,
    });

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
        ...MapObjectFactory.modelUrls,
        ...InventoryScene.modelUrls,
        Gateway.modelUrl,
        ...BridgeRailingKit.modelUrls,
        OverpassStairs.modelUrl,
        ...Castle.modelUrls,
        ...GroundCover.modelUrls,
        ...GrassCarpet.modelUrls,
        ...CliffVines.modelUrls,
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
  }

  render(mapData) {
    let initialViewport = null;
    if (!this.#mapData) {
      this.#gameViewStore.updateViewport(this.#gameViewStore.$state);
      initialViewport = { ...this.#gameViewStore.$state };
    }
    this.#inventoryScene.visible = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    this.#mapData = mapData;
    this.#grassMaterials = new GrassSurfaceMaterials(mapData);
    this.#earthMaterials = new EarthSurfaceMaterials(mapData);
    this.#terrainMaterialSelector = new TerrainMaterialSelector(
      this.#grassMaterials,
      this.#earthMaterials,
      SIDE_VARIANT_TRANSFORMS.length,
    );
    this.#camera.reset(mapData, CAMERA_TARGET_HEIGHT);
    this.#scene?.reset();
    this.#updateFitCenter();
    this.#camera.panX = this.#camera.fitCenterX;
    this.#camera.panZ = this.#camera.fitCenterZ;
    this.#rebuildScene();
    this.#fitCamera();
    this.#updateCamera();
    this.#heroVisibility?.schedule();
    if (this.#mapData.animationViewport) {
      initialViewport = {
        zoom: 1.5,
        rotation: 0,
        panX: 0,
        panZ: 0,
        ...this.#mapData.animationViewport,
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
    this.panLimitsEnabled =
      !this.#debugStore.hasAny && !this.#camera.firstPersonEnabled;
  }

  get zoom() {
    return this.#camera.zoom;
  }

  get canPan() {
    return (
      !this.#cameraLocked &&
      !this.#camera.firstPersonEnabled &&
      (!this.#camera.panLimitsEnabled || this.#camera.zoom > MAP_FIT_ZOOM)
    );
  }

  get rotation() {
    return this.#camera.rotation;
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

  get inventoryState() {
    return (
      this.#inventoryScene?.state ?? {
        capacity: Hero.inventoryCapacity,
        items: [],
        visible: false,
      }
    );
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

  get viewport() {
    return this.#camera.viewport;
  }

  get panLimitsEnabled() {
    return this.#camera.panLimitsEnabled;
  }

  get firstPersonCameraEnabled() {
    return this.#camera.firstPersonEnabled;
  }

  get firstPersonCameraState() {
    return this.#camera.firstPersonState;
  }

  get cameraPointerInputActive() {
    return this.#camera.pointerInputActive;
  }

  set firstPersonCameraEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (
      !this.#camera.setFirstPersonEnabled(nextEnabled, {
        mapData: this.#mapData,
      })
    ) {
      return;
    }
    this.#camera.returnTransition = null;
    this.#camera.orbitPivot = null;
    this.#camera.manuallyMoved = nextEnabled;
    if (!nextEnabled) {
      this.#captureCameraVisualBounds();
    }
    if (!nextEnabled && this.#camera.zoom > MAP_FIT_ZOOM) {
      const heroPosition = this.hero?.position;
      if (heroPosition) {
        this.#camera.panX = heroPosition.x;
        this.#camera.panZ = heroPosition.z;
        this.#updateCastlesForHero(heroPosition);
      }
    }
    this.#applyDebugSettings();
    this.#updateCamera();
  }

  set panLimitsEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (this.#camera.panLimitsEnabled === nextEnabled) {
      return;
    }
    this.#camera.panLimitsEnabled = nextEnabled;
    this.#updateCamera();
  }

  get mapVisibility() {
    return (
      this.#camera.panBounds?.visibility(this.#cameraView) ?? {
        safeVisibleTileCenters: 0,
        totalTileCenters: 0,
        insetPixels: 0,
        panWithinBounds: true,
      }
    );
  }

  get cameraReturningToHero() {
    return this.#camera.returnTransition !== null;
  }

  get hero() {
    return this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO) ?? null;
  }

  returnCameraToHero() {
    return this.#startHeroCameraReturn(true);
  }

  isGameOver() {
    return (
      this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.isGameOver ?? false
    );
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

  patHero() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!hero?.canBePatted) {
      return false;
    }
    return this.#heroPatHand?.pat() ?? false;
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
    this.#camera.returnTransition = null;
    this.#camera.orbitPivot = null;
    this.#camera.zoom = Math.max(MAP_FIT_ZOOM, zoom);
    this.#camera.rotation = rotation;
    this.#updateFitCenter();
    const fitted =
      this.#camera.panLimitsEnabled && this.#camera.zoom === MAP_FIT_ZOOM;
    this.#camera.panX = fitted ? this.#camera.fitCenterX : panX;
    this.#camera.panZ = fitted ? this.#camera.fitCenterZ : panZ;
    this.#camera.manuallyMoved = fitted ? false : manuallyMoved;
    this.#updateCamera();
  }

  zoomTo(newZoom, pivotX, pivotY) {
    if (this.#cameraLocked) {
      return;
    }
    this.#camera.returnTransition = null;
    this.#camera.orbitPivot = null;
    const previousZoom = this.#camera.zoom;
    const constrainedZoom = Math.max(MAP_FIT_ZOOM, newZoom);
    const before = this.#screenOffsetToGround(
      pivotX,
      pivotY,
      this.#camera.zoom,
    );
    const after = this.#screenOffsetToGround(pivotX, pivotY, constrainedZoom);
    this.#camera.panX += before.x - after.x;
    this.#camera.panZ += before.z - after.z;
    this.#camera.zoom = constrainedZoom;

    if (this.#camera.panLimitsEnabled && constrainedZoom < previousZoom) {
      const previousDistance = previousZoom - MAP_FIT_ZOOM;
      const nextDistance = constrainedZoom - MAP_FIT_ZOOM;
      const centerRetention =
        previousDistance > 0 ? nextDistance / previousDistance : 0;
      this.#camera.panX =
        this.#camera.fitCenterX +
        (this.#camera.panX - this.#camera.fitCenterX) * centerRetention;
      this.#camera.panZ =
        this.#camera.fitCenterZ +
        (this.#camera.panZ - this.#camera.fitCenterZ) * centerRetention;
    }
    if (this.#camera.panLimitsEnabled && constrainedZoom === MAP_FIT_ZOOM) {
      this.#camera.panX = this.#camera.fitCenterX;
      this.#camera.panZ = this.#camera.fitCenterZ;
      this.#camera.manuallyMoved = false;
    }
    this.#updateCamera();
  }

  panBy(deltaX, deltaY) {
    if (this.#cameraLocked) {
      return;
    }
    if (this.#camera.firstPersonEnabled) {
      return;
    }
    this.#camera.returnTransition = null;
    this.#camera.orbitPivot = null;
    if (this.#camera.panLimitsEnabled && this.#camera.zoom <= MAP_FIT_ZOOM) {
      this.#camera.panX = this.#camera.fitCenterX;
      this.#camera.panZ = this.#camera.fitCenterZ;
      this.#camera.manuallyMoved = false;
      this.#updateCamera();
      return;
    }
    const panOrigin = { x: this.#camera.panX, z: this.#camera.panZ };
    const offset = this.#screenDeltaToGround(deltaX, deltaY, this.#camera.zoom);
    this.#camera.panX -= offset.x;
    this.#camera.panZ -= offset.z;
    this.#camera.manuallyMoved = true;
    this.#updateCamera(panOrigin);
  }

  rotateBy(quarterTurns, verticalQuarterTurns = 0) {
    if (this.#cameraLocked) {
      return this.#camera.rotation;
    }
    if (this.#camera.firstPersonEnabled) {
      return this.#camera.rotation;
    }
    this.#camera.returnTransition = null;
    const preserveFocus = this.#camera.zoom > MAP_FIT_ZOOM;
    if (
      preserveFocus &&
      !this.#camera.orbitPivot &&
      this.#camera &&
      this.#mapRoot
    ) {
      this.#camera.orbitPivot = new CameraOrbitPivot(this.#pc).find(
        this.#camera.camera,
        this.#mapRoot,
        this.#mapData,
        this.container.clientWidth,
        this.container.clientHeight,
      );
    }
    this.#camera.rotation =
      (((this.#camera.rotation + quarterTurns) % 4) + 4) % 4;
    if (preserveFocus && this.#camera.orbitPivot) {
      const yaw = Math.PI / 4 + this.#camera.rotation * (Math.PI / 2);
      const offset =
        (this.#camera.targetY - this.#camera.orbitPivot.y) /
        Math.tan(CAMERA_PITCH);
      this.#camera.panX = this.#camera.orbitPivot.x + Math.sin(yaw) * offset;
      this.#camera.panZ = this.#camera.orbitPivot.z + Math.cos(yaw) * offset;
      this.#camera.manuallyMoved = true;
    }
    this.#updateCamera(null, preserveFocus);
    this.#heroVisibility?.schedule();
    return this.#camera.rotation;
  }

  lookFirstPersonBy(yawDegrees, pitchDegrees) {
    if (!this.#camera.firstPersonEnabled) {
      return;
    }
    this.#camera.lookFirstPersonBy(yawDegrees, pitchDegrees);
    this.#updateCamera();
  }

  cameraPointerDown(input) {
    return this.#camera.pointerDown(input);
  }

  cameraPointerMove(input) {
    if (!this.#camera.pointerMove(input)) {
      return false;
    }
    this.#updateCamera();
    return true;
  }

  resize() {
    if (this.#camera) {
      this.#camera.orbitPivot = null;
    }
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

  get camera() {
    return this.#camera.entity;
  }

  get canvasElement() {
    return this.canvas;
  }

  get mapRoot() {
    return this.#mapRoot;
  }

  addHud(HudClass, options = {}) {
    return this.#huds?.add(HudClass, options) ?? null;
  }

  getHud(HudClass) {
    return this.#huds?.getHud(HudClass) ?? null;
  }

  removeHud(HudClass) {
    return this.#huds?.remove(HudClass) ?? false;
  }

  destroy() {
    this.#destroyed = true;
    this.#stopDebugStoreSubscription?.();
    this.#stopDebugStoreSubscription = null;
    this.#saveViewportDebounced?.flush();
    this.#disconnectPointerInteractions();
    this.#app?.off("update", this.#updateFrame);
    this.#clearScene();
    this.#huds?.destroy();
    this.#huds = null;
    this.#inventoryScene?.destroy();
    this.#inventoryScene = null;
    this.#scene?.destroy();
    this.#scene = null;
    this.#uiTheme = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    for (const asset of this.#textureAssets.values()) {
      asset.unload();
      this.#app?.assets.remove(asset);
    }
    this.#textureAssets.clear();
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

    GrassSurfaceMaterials.register(
      this.#materials,
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
    EarthSurfaceMaterials.register(
      this.#materials,
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
    PathSurfaceMaterials.register(
      this.#materials,
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
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
          ? (definition.startU ?? 0) + scaleU
          : (definition.startU ?? 0);
        const tilingV = definition.flipV ? -scaleV : scaleV;
        material.diffuseMapTiling = new pc.Vec2(tilingU, tilingV);
        material.diffuseMapOffset = new pc.Vec2(
          offsetU,
          definition.flipV
            ? 1 - (definition.startV ?? 0)
            : definition.startV === undefined
              ? 0
              : 1 - scaleV - definition.startV,
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
    material.update();
    return material;
  }

  #loadTexture(name, url) {
    const pc = this.#pc;
    const asset = new pc.Asset(name, "texture", { url });
    this.#textureAssets.set(name, asset);
    this.#app.assets.add(asset);

    return new Promise((resolve, reject) => {
      asset.ready((loadedAsset) => {
        const texture = loadedAsset.resource;
        texture.mipmaps = this.#graphicsSettingsStore.mipmaps;
        texture.minFilter = texture.mipmaps
          ? pc.FILTER_LINEAR_MIPMAP_LINEAR
          : pc.FILTER_LINEAR;
        texture.magFilter =
          name === "castleStone" ? pc.FILTER_NEAREST : pc.FILTER_LINEAR;
        texture.anisotropy = this.#graphicsSettingsStore.anisotropy;
        texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV =
          name === "castleDoor" ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
        GrassSurfaceMaterials.configureTexture(
          pc,
          name,
          texture,
          this.#graphicsSettingsStore.mipmaps,
        );
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
      zoom: this.#camera.zoom,
    });

    const scenery = new SkyIslandScenery(this.#mapData);
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
      materials: this.#materials,
      bridgeRailingKit: this.#bridgeRailingKit,
      cubeMaterials: (type, topCube, col, row, level) =>
        this.#terrainMaterialSelector.cubeMaterials(
          type,
          topCube,
          col,
          row,
          level,
        ),
      pathEarthSideMaterial: (col, row, level) =>
        this.#earthMaterials.overpassSideForTile(col, row, level),
      earthSideMaterial: (col, row, level) =>
        this.#earthMaterials.sideForTile(col, row, level),
      sideVariant: (material, col, row, level) =>
        this.#terrainMaterialSelector.sideVariant(material, col, row, level),
    });
    this.#terrainRenderer.build(scenery.createUndersideVoxels());
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
      zoom: this.#camera.zoom,
    });
    this.#mapRoot.addChild(this.#riverWater.entity);
    this.#grassCarpet = new GrassCarpet({
      pc: this.#pc,
      device: this.#app.graphicsDevice,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      tileColors: GrassSurfaceMaterials.tileColors,
      variantForTile: (col, row, level) =>
        this.#grassMaterials.variantForTile(col, row, level),
      zoom: this.#camera.zoom,
    });
    this.#mapRoot.addChild(this.#grassCarpet.entity);
    this.#grassSurface = new GrassSurface({
      app: this.#app,
      pc: this.#pc,
      mapData: this.#mapData,
      terrainMaterials: [this.#grassCarpet.material].filter(Boolean),
      zoom: this.#camera.zoom,
      getImpressionContacts: () => [
        ...(this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)
          ?.grassFootContacts ?? []),
        ...(this.#inventoryScene?.grassImpressionContacts ?? []),
        ...(this.#groundCover?.grassImpressionContacts ?? []),
      ],
      getSurfaceContacts: () =>
        this.#sceneObjects
          .getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)
          .flatMap(({ grassSurfaceContacts = [] }) => grassSurfaceContacts),
      getWeightAt: (x, y, z) => this.#collisionWorld.grassWeightAt(x, z, y),
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
    this.#buildMapObjects();
    this.getHud(HeroLifeHud)?.setCastleLives(
      this.#sceneObjects.getFirst(SCENE_OBJECT_TYPE.CASTLE)
        ? MAX_CASTLE_LIVES
        : 0,
      MAX_CASTLE_LIVES,
    );
    this.#buildGateways();
    this.#buildCliffVines();
    this.#buildGroundCover();
    this.#buildBuriedTreasure();
    this.#terrainRenderer.buildPhysicsSurface(this.#collisionWorld);
    this.#buildHero();
    this.#connectHeroTools();
    this.#grassSurface.refreshObstacles();
    this.#updateInteractionTarget();

    this.#captureCameraVisualBounds();
  }

  #buildMapObjects() {
    for (const object of MapObjectFactory.createAll({
      pc: this.#pc,
      app: this.#app,
      modelLibrary: this.#modelLibrary,
      definitions: this.#mapData.objects ?? [],
      runtime: {
        objects: this.#sceneObjects,
        getGrassSupportPoints: (position, radius) =>
          this.#grassCarpet.supportPointsWithin(position, radius),
        onObjectRemoved: (removedObject) => {
          this.#buriedTreasure?.removeMapObject(removedObject);
          this.#grassSurface?.refreshObstacles(removedObject);
        },
        onRuntimeError: this.#onRuntimeError,
      },
    })) {
      this.#sceneObjects.add(SCENE_OBJECT_TYPE.MAP_OBJECT, object);
      this.#mapRoot.addChild(object.entity);
      if (object.isGroundCollider) {
        this.#collisionWorld.add(object, {
          physicsSurface: object.physicsSurface !== false,
        });
      }
    }
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
      ...this.#sceneObjects
        .getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)
        .flatMap((object) =>
          object.visualRoots.map((root) => ({
            name: `map-object-${root.name}`,
            protectAtPanLimit: true,
            centerReachableAtEveryZoom: true,
            root,
          })),
        ),
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
          this.#camera.panBounds?.addVisualBounds(center, halfExtents, {
            group: name,
            protectAtPanLimit,
            centerReachableAtEveryZoom,
          });
        }
      }
    }
  }

  #buildHero() {
    if (this.#mapData.objects?.some(({ object }) => object === Hero.name)) {
      return;
    }
    const getHud = (HudClass) => this.getHud(HudClass);
    const hero = new Hero({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      spawnCenter: {
        x: this.#camera.fitCenterX,
        z: this.#camera.fitCenterZ,
      },
      getViewRotation: () => this.#camera.rotation,
      getViewDirection: () => {
        const state = this.#camera.firstPersonState;
        return state
          ? { ...state.direction, right: state.right }
          : null;
      },
      onPositionChange: this.#handleHeroPositionChange,
      onFacingChange: this.#handleHeroFacingChange,
      onMovementInput: () => this.#startHeroCameraReturn(),
      heroConfigurationStore: this.#heroConfigurationStore,
      presentation: {
        get lifeHud() {
          return getHud(HeroLifeHud);
        },
        get coinHud() {
          return getHud(CoinHud);
        },
        inventoryScene: this.#inventoryScene,
        gameOverScene: this.#scene,
        stateStore: this.#heroStateStore,
        getMoodScreenPosition: () => this.#heroPatScreenPosition(),
        getInventoryFullScreenPosition: () =>
          this.#inventoryFullIndicatorScreenPosition(),
      },
      collisionWorld: this.#collisionWorld,
      modelLibrary: this.#modelLibrary,
    });
    this.#sceneObjects.setOne(SCENE_OBJECT_TYPE.HERO, hero);
    this.#mapRoot.addChild(hero.entity);
    this.#heroPatHand = new HeroPatHand({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      getPatPosition: () => hero.patPosition,
      getViewRotation: () => this.#camera.rotation,
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
      getRotation: () => this.#camera.rotation,
      setRotation: (rotation) => {
        if (
          this.#cameraLocked ||
          hero.isInDeathSequence ||
          (this.#camera.orbitPivot && this.#camera.manuallyMoved)
        ) {
          return;
        }
        this.#camera.rotation = rotation;
        this.#updateCamera();
      },
      shouldPreserveRotation: () => {
        if (this.#camera.orbitPivot && this.#camera.manuallyMoved) {
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
    this.#groundCover?.applyHeroInteraction(hero.position, hero.movementState);
    this.#buriedTreasure?.applyHeroPosition(hero.position);
  }

  #connectHeroTools() {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    const mapObjects = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT);
    if (hero?.tools) {
      this.#groundCover.tool = hero.tools.get(KnifeTool.name);
      for (const object of mapObjects) {
        if (object.toolName) {
          object.tool = hero.tools.get(object.toolName);
        }
      }
      this.#buriedTreasure.tool = hero.tools.get(ShovelTool.name);
    }
    this.#interactionProviders = [
      this.#groundCover,
      ...mapObjects.filter(({ findInteraction }) => findInteraction),
      this.#buriedTreasure,
    ];
  }

  #buildCliffVines() {
    const cliffVines = new CliffVines({
      pc: this.#pc,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
    });
    this.#sceneObjects.setOne(SCENE_OBJECT_TYPE.CLIFF_VINES, cliffVines);
    this.#mapRoot.addChild(cliffVines.entity);
  }

  #buildGroundCover() {
    this.#groundCover = new GroundCover({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      getHeroFootContacts: () =>
        this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.grassFootContacts ??
        [],
      onCollect: (item) =>
        this.#sceneObjects
          .getOne(SCENE_OBJECT_TYPE.HERO)
          ?.collectInventoryItem(item) ?? false,
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
        this.#sceneObjects
          .getOne(SCENE_OBJECT_TYPE.HERO)
          ?.collectCoin(type, amount),
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
        color: entry.color,
        cubeSize: CUBE_SCALE / 4,
        surfaceLift: GRASS_SURFACE_LIFT,
        symbol: signs[index % signs.length],
        modelLibrary: this.#modelLibrary,
      });
      this.#collisionWorld.add(gateway);
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
        doorTexture: this.#textureAssets.get("castleDoor").resource,
        stoneTexture: this.#textureAssets.get("castleStone").resource,
        fireParticleTexture:
          this.#textureAssets.get("castleFireParticle").resource,
        onRuntimeError: this.#onRuntimeError,
      });
      this.#sceneObjects.add(SCENE_OBJECT_TYPE.CASTLE, builtCastle);
      this.#collisionWorld.add(builtCastle);
      this.#mapRoot.addChild(builtCastle.entity);
    }
  }

  #updateCastlesForHero(position) {
    for (const castle of this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.CASTLE)) {
      castle.updateHeroPosition(position);
    }
    for (const object of this.#sceneObjects.getAll(
      SCENE_OBJECT_TYPE.MAP_OBJECT,
    )) {
      object.updateHeroPosition?.(position);
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
    this.#riverWater?.update(deltaTime, hero, this.#camera?.camera);
    this.#heroPatHand?.update(deltaTime);
    this.#huds?.update(deltaTime);
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
    if (this.#camera.firstPersonEnabled) {
      this.#setFloatingCameraOffset(0, 0);
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
    if (
      this.inventoryVisible ||
      this.#camera.firstPersonEnabled ||
      !hero?.canBePatted
    ) {
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

  #tileHeight(col, row) {
    const type = this.#mapData.grid[row][col];
    return type in FIXED_HEIGHTS
      ? FIXED_HEIGHTS[type]
      : this.#mapData.heightmap[row][col];
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
    this.#camera.baseOrthoHeight =
      Math.max(halfHeight, halfWidth / aspect) * 0.84;
    this.#updateFitCenter();
    if (this.#camera.panLimitsEnabled && this.#camera.zoom === MAP_FIT_ZOOM) {
      this.#camera.panX = this.#camera.fitCenterX;
      this.#camera.panZ = this.#camera.fitCenterZ;
    }
  }

  #updateFitCenter() {
    if (!this.#mapData) {
      return;
    }
    const { grid, cols, rows } = this.#mapData;
    const yaw = Math.PI / 4 + this.#camera.rotation * (Math.PI / 2);
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
      this.#camera.fitCenterX = 0;
      this.#camera.fitCenterZ = 0;
      return;
    }

    const centerProjection = (minimumProjection + maximumProjection) / 2;
    this.#camera.fitCenterX = rightX * centerProjection;
    this.#camera.fitCenterZ = rightZ * centerProjection;
  }

  #handleHeroPositionChange = ({ x, y, z }) => {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    this.#camera.orbitPivot = null;
    this.#updateCastlesForHero({ x, y, z });
    this.#groundCover?.applyHeroInteraction({ x, y, z }, hero?.movementState);
    this.#buriedTreasure?.applyHeroPosition({ x, y, z });
    this.#updateInteractionTarget({ x, y, z });
    if (this.#cameraLocked) {
      return;
    }
    if (this.#camera.firstPersonEnabled) {
      this.#updateCamera();
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

    if (this.#camera.manuallyMoved) {
      this.#heroVisibility?.schedule();
      return;
    } else if (this.#camera.zoom > MAP_FIT_ZOOM) {
      this.#camera.panX = heroWorldPosition.x;
      this.#camera.panZ = heroWorldPosition.z;
    } else if (!heroIsOutOfBounds) {
      this.#heroVisibility?.schedule();
      return;
    } else {
      const correction = this.#screenDeltaToGround(
        screenPosition.x - boundedX,
        screenPosition.y - boundedY,
        this.#camera.zoom,
      );
      this.#camera.panX += correction.x;
      this.#camera.panZ += correction.z;
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
      this.#camera.returnTransition ||
      this.#cameraLocked ||
      (!allowAutomatic && !this.#camera.manuallyMoved) ||
      !hero ||
      !this.#camera
    ) {
      return Boolean(this.#camera.returnTransition);
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
    this.#camera.returnTransition = {
      elapsed: 0,
      startPanX: this.#camera.panX,
      startPanZ: this.#camera.panZ,
      duration,
      preserveFocus,
    };
    this.#camera.orbitPivot = null;
    return true;
  }

  #updateHeroCameraReturn(deltaTime) {
    const transition = this.#camera.returnTransition;
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!transition || this.#cameraLocked || !hero || !this.#camera) {
      return;
    }
    transition.elapsed += Math.max(0, deltaTime);
    const progress = Math.min(1, transition.elapsed / transition.duration);
    const easedProgress = progress * progress * (3 - 2 * progress);
    const heroWorldPosition = hero.entity.getPosition();
    this.#camera.panX =
      transition.startPanX +
      (heroWorldPosition.x - transition.startPanX) * easedProgress;
    this.#camera.panZ =
      transition.startPanZ +
      (heroWorldPosition.z - transition.startPanZ) * easedProgress;
    if (progress >= 1) {
      this.#camera.returnTransition = null;
      this.#camera.manuallyMoved = false;
    }
    this.#updateCamera(null, transition.preserveFocus);
    this.#heroVisibility?.schedule();
  }

  #handleHeroFacingChange = () => {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (this.#camera.firstPersonEnabled) {
      this.#updateCamera();
    }
    if (!hero?.isUsingTool && !hero?.isCollecting) {
      this.#updateInteractionTarget();
    }
  };

  get #cameraLocked() {
    return this.#scene?.cameraLocked ?? false;
  }

  get #cameraState() {
    return this.#camera.state;
  }

  #setCameraState(state) {
    this.#camera.setState(state);
  }

  #updateCamera(panOrigin = null, preserveFocus = false) {
    if (!this.#camera || !this.#mapData) {
      return;
    }
    if (
      !this.#camera.firstPersonEnabled &&
      this.#camera.panLimitsEnabled &&
      this.#camera.zoom === MAP_FIT_ZOOM
    ) {
      this.#updateFitCenter();
      this.#camera.panX = this.#camera.fitCenterX;
      this.#camera.panZ = this.#camera.fitCenterZ;
    }
    if (
      !this.#camera.firstPersonEnabled &&
      this.#camera.panLimitsEnabled &&
      !this.#cameraLocked &&
      !preserveFocus
    ) {
      const constrainedPan = this.#camera.panBounds?.constrain(
        this.#cameraView,
        panOrigin,
      );
      if (constrainedPan) {
        this.#camera.panX = constrainedPan.x;
        this.#camera.panZ = constrainedPan.z;
      }
    }
    this.#floatingCameraOffsetApplied = false;
    const hero = this.hero;
    if (hero) {
      hero.firstPersonCameraEnabled = this.#camera.firstPersonEnabled;
    }
    const update = this.#camera.update({
      cameraDistance: CAMERA_DISTANCE,
      cameraPitch: CAMERA_PITCH,
      hero,
    });
    if (update.firstPerson) {
      if (update.position) {
        this.#updateCastlesForHero(update.position);
      }
    } else {
      if (this.#floatingIslandMotion) {
        this.#floatingIslandMotion.zoom = this.#camera.zoom;
      }
      if (this.#groundCover) {
        this.#groundCover.zoom = this.#camera.zoom;
      }
      if (this.#grassSurface) {
        this.#grassSurface.zoom = this.#camera.zoom;
        this.#grassCarpet.zoom = this.#camera.zoom;
      }
      this.#cloudField?.setCameraState({
        rotation: this.#camera.rotation,
        panX: this.#camera.panX,
        panZ: this.#camera.panZ,
        zoom: this.#camera.zoom,
      });
    }
    this.#setFloatingCameraOffset(
      this.#floatingCameraOffsetX,
      this.#floatingCameraOffsetY,
    );
    this.#updateHeroIdleLookTarget();
    this.#notifyViewportChange();
  }

  #terrainHeightAtWorldPosition(x, z) {
    if (!this.#mapData) {
      return null;
    }
    const { cols, rows, grid } = this.#mapData;
    const col = Math.round(x + (cols - 1) / 2);
    const row = Math.round(z + (rows - 1) / 2);
    if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return null;
    }
    const type = grid[row][col];
    if (type === TileType.WATER) {
      return null;
    }
    return (
      this.#tileHeight(col, row) +
      (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0)
    );
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
      panX: this.#camera.panX,
      panZ: this.#camera.panZ,
      centerX: this.#camera.fitCenterX,
      centerZ: this.#camera.fitCenterZ,
      targetY: this.#camera.targetY,
      rotation: this.#camera.rotation,
      pitch: CAMERA_PITCH,
      zoom: this.#camera.zoom,
      baseOrthoHeight: this.#camera.baseOrthoHeight,
      orthoHeight: this.#camera.baseOrthoHeight / this.#camera.zoom,
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
    const yaw = Math.PI / 4 + this.#camera.rotation * (Math.PI / 2);
    const worldPerPixel =
      (2 * this.#camera.baseOrthoHeight) /
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
    const hits =
      this.#app?.systems.rigidbody?.raycastAll?.(ray.start, ray.end, {
        sort: true,
      }) ?? [];
    return hits.find((hit) => hit.normal?.y >= 0.35) ?? null;
  }

  #inventoryDropScreenPosition(height, clientX, clientY) {
    if (!this.#camera?.camera || !this.canvas) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const center = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(this.#camera.panX, height, this.#camera.panZ),
    );
    const correction = this.#screenDeltaToGround(
      clientX - rect.left - center.x,
      clientY - rect.top - center.y,
      this.#camera.zoom,
    );
    return new this.#pc.Vec3(
      this.#camera.panX + correction.x,
      height,
      this.#camera.panZ + correction.z,
    );
  }

  #inventoryDropStartY(position, clientY) {
    if (!this.#camera?.camera || !this.canvas) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const screenPosition = this.#camera.camera.worldToScreen(position);
    const worldPerPixel =
      (2 * this.#camera.baseOrthoHeight) /
      Math.max(1, this.canvas.clientHeight) /
      this.#camera.zoom;
    const cursorY = clientY - rect.top;
    const upwardScreenDistance = screenPosition.y - cursorY;
    if (upwardScreenDistance <= 0) {
      return null;
    }
    const fallHeight =
      (upwardScreenDistance * worldPerPixel) / Math.cos(CAMERA_PITCH);
    return (
      position.y +
      Math.max(
        INVENTORY_DROP_MIN_FALL_HEIGHT,
        Math.min(INVENTORY_DROP_MAX_FALL_HEIGHT, fallHeight),
      )
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
    if (this.#camera) {
      this.#camera.orbitPivot = null;
    }
    this.#heroPatGesture?.destroy();
    this.#heroPatGesture = null;
    this.#heroPatHand?.destroy();
    this.#heroPatHand = null;
    this.#pointerInteraction?.cancelActivePointer();
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.GATEWAY);
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.CASTLE);
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.MAP_OBJECT);
    this.#heroVisibility?.destroy();
    this.#heroVisibility = null;
    this.#floatingIslandMotion = null;
    this.#floatingCameraOffsetX = 0;
    this.#floatingCameraOffsetY = 0;
    this.#floatingCameraOffsetApplied = false;
    this.#interactionProviders = [];
    this.#inventoryScene?.clearWorldItems();
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.HERO);
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.CLIFF_VINES);
    this.#terrainRenderer?.destroy();
    this.#terrainRenderer = null;
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
