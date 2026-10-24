import { MapObjectReplacement } from "./rendering/scene/MapObjectReplacement.js";
import { SceneDecorationQueue } from "./rendering/scene/SceneDecorationQueue.js";
import { GameFrameLoop } from "./rendering/GameFrameLoop.js";
import { MapTestControls } from "./debug/MapTestControls.js";
import { MapTestControlsHud } from "./ui/MapTestControlsHud.js";
import { DirectionalShadowBudget } from "./rendering/DirectionalShadowBudget.js";
import { useDebounceFn } from "@vueuse/core";
import { AmmoRuntime } from "./physics/AmmoRuntime.js";
import * as playCanvas from "playcanvas/build/playcanvas/src/index.js";
import { woodTexture } from "./textures/shared-textures.js";
import castleStoneUrl from "src/assets/game/textures/castle-stone.png";
import glslangScriptUrl from "src/assets/game/wasm/glslang/glslang.js?url";
import glslangWasmUrl from "src/assets/game/wasm/glslang/glslang.wasm?url";
import twgslScriptUrl from "src/assets/game/wasm/twgsl/twgsl.js?url";
import twgslWasmUrl from "src/assets/game/wasm/twgsl/twgsl.wasm?url";
import waterSideUrl from "src/assets/game/tiles/water-side.png";
import waterTopUrl from "src/assets/game/tiles/water-top.png";

import { BridgeRailingKit } from "./objects/path/index.js";
import { Hero, HeroPatHand } from "./objects/characters/hero/index.js";
import { HeroPatGesture } from "./controls/HeroPatGesture.js";
import { KnifeTool, ShovelTool } from "./objects/characters/hero/tools/index.js";
import { Overpass } from "./objects/path/Overpass.js";
import { GroundCover } from "./objects/ground-cover/index.js";
import { CubeCloudField, IslandConnectorMotion } from "./objects/scenery/index.js";
import { BuriedTreasureField } from "./objects/treasure/index.js";
import { ScenePointerInteraction } from "./objects/shared/ScenePointerInteraction.js";
import { TileType } from "./generator/map/MapGenerator.js";
import { GRAPHICS_DRIVER } from "./enum/GraphicsDriver.js";
import { SCENE_OBJECT_TYPE } from "./enum/SceneObjectType.js";
import { ShaderTranspilerAssetsNotColocatedError } from "./errors/assets/index.js";
import {
  GroundCollisionWorld,
} from "./collision/index.js";
import { GameModelLibrary } from "./models/index.js";
import { GameTextureLibrary } from "./textures/GameTextureLibrary.js";
import { GameAudioLibrary } from "./audio/GameAudioLibrary.js";
import { EmbeddedTextureParser } from "./models/EmbeddedTextureParser.js";
import { ObjectDataCache } from "./cache/ObjectDataCache.js";
import { GameCamera, HeroVisibilityController } from "./camera/index.js";
import { CameraOrbitPivot } from "./camera/CameraOrbitPivot.js";
import {
  CoinHud,
  GameStatusHud,
  HeroLifeHud,
  HeroMoodHud,
  HudCollection,
} from "./ui/index.js";
import { colorFromHex } from "./helpers/colors.js";
import { MapObjectFactory } from "./objects/MapObjectFactory.js";
import { GameOverScene } from "./rendering/scene/GameOverScene.js";
import { InventoryScene } from "./rendering/scene/InventoryScene.js";
import { SceneObjectRegistry } from "./rendering/scene/SceneObjectRegistry.js";
import { TerrainRenderer } from "./rendering/terrain/TerrainRenderer.js";
import { PathSurfaceMaterials } from "./rendering/terrain/PathSurfaceMaterials.js";
import {
  CUBE_SCALE,
  FIXED_HEIGHTS,
} from "./rendering/terrain/TerrainMaterialMaps.js";

const MATERIAL_DEFINITIONS = {
  water: {
    color: 0xd8f2ff,
    texture: "water",
    gloss: 0.22,
  },
};

const SIDE_VARIANT_DEFINITIONS = {
  waterSide: {
    texture: "waterSide",
    colors: [0xd8f2ff, 0xcfeaff, 0xe0f5ff, 0xc9e7ff, 0xd5efff, 0xdff7ff],
    gloss: 0.18,
  },
};

const SIDE_VARIANT_TRANSFORMS = [
  {
    startU: 0,
    scaleU: 0.72,
    flipU: false,
  },
  {
    startU: 0.14,
    scaleU: 0.72,
    flipU: true,
  },
  {
    startU: 0.28,
    scaleU: 0.72,
    flipU: false,
  },
  {
    startU: 0,
    scaleU: 0.72,
    flipU: true,
  },
  {
    startU: 0.14,
    scaleU: 0.72,
    flipU: false,
  },
  {
    startU: 0.28,
    scaleU: 0.72,
    flipU: true,
  },
];
const CAMERA_PITCH = Math.atan(1 / Math.sqrt(2));
const CAMERA_DISTANCE = 80;
const SHADOW_DISTANCE = 150;
const FIRST_PERSON_SHADOW_DISTANCE = 24;
const MAP_FIT_ZOOM = 1;
const HERO_VIEWPORT_MARGIN = 32;
const HERO_CAMERA_CENTER_HEIGHT = 0.85;
// Preserve steering before the hero enters the deck's occluding footprint.
const HERO_BRIDGE_VISIBILITY_RADIUS = 1.5;
const HERO_CAMERA_RETURN_DURATION = 0.45;
const HERO_RESPAWN_CAMERA_RETURN_DURATION = 0.32;
const CAMERA_TARGET_HEIGHT = 3.2;
const MAX_CASTLE_LIVES = 3;
const INVENTORY_DROP_MIN_FALL_HEIGHT = 0.35;
const INVENTORY_DROP_MAX_FALL_HEIGHT = 12;

/**
 *
 * @param {string} scriptUrl
 * @param {string} wasmUrl
 */
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
  /**
   * @type {boolean}
   */
  #replacingScene = false;
  /**
   * @type {Hero|null}
   */
  #replacementHero = null;

  /**
   * Allow the browser to paint before continuing construction.
   * @param {() => void} resolve
   */
  static #yieldReplacementFrame(resolve) {
    let pending = true;
    const finish = () => {
      if (pending) {
        pending = false;
        clearTimeout(fallback);
        resolve();
      }
    };
    const fallback = globalThis.setTimeout(finish, 100);
    requestAnimationFrame(() => globalThis.setTimeout(finish, 0));
  }

  /**
   * @type {SceneDecorationQueue}
   */
  #decorations;
  /**
   * @type {boolean}
   */
  #decorationsEnabled = false;
  /**
   *
   * @type {typeof playCanvas|null}
   */
  #pc = null;
  /**
   *
   * @type {playCanvas.Application|null}
   */
  #app = null;
  /**
   * @type {GameFrameLoop|null}
   */
  #frameLoop = null;
  /**
   * @type {DirectionalShadowBudget|null}
   */
  #shadowBudget = null;
  /**
   *
   * @type {GameCamera|null}
   */
  #camera = null;
  /**
   *
   * @type {playCanvas.Layer|null}
   */
  #cloudLayer = null;
  /**
   *
   * @type {playCanvas.Entity|null}
   */
  #mapRoot = null;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameMapData|null}
   */
  #mapData = null;
  /**
   *
   * @type {Map<string, playCanvas.StandardMaterial>}
   */
  #materials = new Map();
  /**
   * @type {MapObjectReplacement|null}
   */
  #mapObjectReplacement = null;
  /**
   * @type {Map<string, playCanvas.Asset>}
   */
  #textureAssets = new Map();
  /**
   * @type {GameTextureLibrary}
   */
  #textureLibrary;
  /**
   * @type {GameAudioLibrary}
   */
  #audioLibrary;
  /**
   * @type {WeakMap<import("./GameContracts.js").GameMapData, MapObjectReplacement>}
   */
  #preparedMaps = new WeakMap();
  /**
   *
   * @type {playCanvas.VertexBuffer[]}
   */
  #vertexBuffers = [];
  /**
   *
   * @type {BridgeRailingKit|null}
   */
  #bridgeRailingKit = null;
  /**
   *
   * @type {SceneObjectRegistry}
   */
  #sceneObjects = new SceneObjectRegistry();
  /**
   *
   * @type {HeroPatGesture|null}
   */
  #heroPatGesture = null;
  /**
   *
   * @type {HeroPatHand|null}
   */
  #heroPatHand = null;
  /**
   *
   * @type {HudCollection|null}
   */
  #huds = null;
  /**
   *
   * @type {InventoryScene|null}
   */
  #inventoryScene = null;
  /**
   *
   * @type {GameOverScene|null}
   */
  #scene = null;
  /**
   *
   * @type {HeroVisibilityController|null}
   */
  #heroVisibility = null;

  /**
   * @type {boolean}
   */
  #islandOffsetsApplied = false;
  /**
   * @type {IslandConnectorMotion}
   */
  #islandConnectorMotion = new IslandConnectorMotion();
  /**
   * @returns {GroundCover|null}
   */
  get #groundCover() {
    return this.#sceneObjects.getFirstByClass(GroundCover.name);
  }
  /**
   *
   * @type {BuriedTreasureField|null}
   */
  #buriedTreasure = null;
  /**
   *
   * @type {import("src/game/GameContracts.js").InteractionProvider[]}
   */
  #interactionProviders = [];
  /**
   *
   * @type {CubeCloudField|null}
   */
  #cloudField = null;
  /**
   *
   * @type {GroundCollisionWorld}
   */
  #collisionWorld = new GroundCollisionWorld();
  /**
   *
   * @type {TerrainRenderer|null}
   */
  #terrainRenderer = null;
  /**
   * @returns {Overpass|null}
   */
  get #pathOverpassCollider() {
    return this.#sceneObjects.getFirstByClass(Overpass.name);
  }
  /**
   *
   * @type {GameModelLibrary|null}
   */
  #modelLibrary = null;
  /**
   *
   * @type {ScenePointerInteraction|null}
   */
  #pointerInteraction = null;
  /**
   *
   * @type {import("src/game/GameContracts.js").CameraPointer|null}
   */
  #heroLookPointer = null;
  /**
   *
   * @type {import("src/game/GameContracts.js").SceneInteraction|null}
   */
  #interactionTarget = null;
  /**
   *
   * @type {string|null}
   */
  #interactionSignature = null;
  /**
   *
   * @type {((description: import("src/game/GameContracts.js").InteractionDescription|null) => void)|null}
   */
  #onInteractionChange = null;
  /**
   *
   * @type {string}
   */
  #viewportSignature = "";
  /**
   *
   * @type {boolean}
   */
  #viewportPersistenceEnabled = false;
  /**
   *
   * @type {ReturnType<typeof useDebounceFn>|null}
   */
  #saveViewportDebounced = null;
  /**
   *
   * @type {ReturnType<typeof import("src/stores/debug-store.js").useDebugStore>|null}
   */
  #debugStore = null;
  /**
   *
   * @type {ReturnType<typeof import("src/stores/game-view-store.js").useGameViewStore>|null}
   */
  #gameViewStore = null;
  /**
   *
   * @type {ReturnType<typeof import("src/stores/graphics-settings-store.js").useGraphicsSettingsStore>|null}
   */
  #graphicsSettingsStore = null;
  /**
   *
   * @type {ReturnType<typeof import("src/stores/hero-configuration-store.js").useHeroConfigurationStore>|null}
   */
  #heroConfigurationStore = null;
  /**
   *
   * @type {ReturnType<typeof import("src/stores/hero-state-store.js").useHeroStateStore>|null}
   */
  #heroStateStore = null;
  /**
   *
   * @type {(() => void)|null}
   */
  #stopDebugStoreSubscription = null;
  /**
   *
   * @param {string} key
   * @type {import("src/game/GameContracts.js").Translate}
   */
  #translate = (key) => key;
  /**
   *
   * @type {boolean}
   */
  #destroyed = false;
  /**
   *
   * @type {((error: Error) => void)|null}
   */
  #onRuntimeError;
  /**
   *
   * @type {boolean}
   */
  #frameUpdateFailed = false;

  /**
   *
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   * @param {import("src/game/GameContracts.js").RendererOptions} [options]
   * @param {((error: Error) => void)|null} [options.onRuntimeError]
   * @param {((description: import("src/game/GameContracts.js").InteractionDescription|null) => void)|null} [options.onInteractionChange]
   * @param {import("src/game/GameContracts.js").Translate} [options.t]
   * @param {ReturnType<typeof import("src/stores/debug-store.js").useDebugStore>} options.debugStore
   * @param {ReturnType<typeof import("src/stores/game-view-store.js").useGameViewStore>} options.gameViewStore
   * @param {ReturnType<typeof import("src/stores/graphics-settings-store.js").useGraphicsSettingsStore>} options.graphicsSettingsStore
   * @param {ReturnType<typeof import("src/stores/hero-configuration-store.js").useHeroConfigurationStore>} options.heroConfigurationStore
   * @param {ReturnType<typeof import("src/stores/hero-state-store.js").useHeroStateStore>} options.heroStateStore
   */
  constructor(
    canvas,
    container,
    {
      onRuntimeError = null,
      onInteractionChange = null,
      /**
       *
       * @param {string} key
       */
      t = (key) => key,
      debugStore,
      gameViewStore,
      graphicsSettingsStore,
      heroConfigurationStore,
      heroStateStore,
    } = {},
  ) {
    this.#onRuntimeError = onRuntimeError;
    this.#decorations = new SceneDecorationQueue(this.#reportDecorationError.bind(this));
    /**
     *
     * @type {HTMLCanvasElement}
     */
    this.canvas = canvas;
    /**
     *
     * @type {HTMLElement}
     */
    this.container = container;
    this.#onInteractionChange = onInteractionChange;
    this.#debugStore = debugStore;
    this.#gameViewStore = gameViewStore;
    this.#graphicsSettingsStore = graphicsSettingsStore;
    this.#heroConfigurationStore = heroConfigurationStore;
    this.#heroStateStore = heroStateStore;
    this.#heroConfigurationStore.normalizeInventorySlots();
    this.#translate = t;
    this.#saveViewportDebounced = useDebounceFn(
      this.#useDebounceFn.bind(this),
      150,
    );
    this.#pointerInteraction = new ScenePointerInteraction({
      canvas,
      sceneObjects: this.#sceneObjects,
      /**
       *
       * @param {import("src/game/GameContracts.js").CameraPointer} event
       */
      pointerRay: this.#pointerRay2.bind(this),
      onMousePointerMove: this.#trackHeroLookPointer,
      onMousePointerLeave: this.#onMousePointerLeave.bind(this),
    });
  }

  /**
   *
   * @param {string} key
   * @param {{[key: string]: string|number}} values
   */
  t(key, values) {
    return this.#translate(key, values);
  }

  /**
   *
   * @param {typeof pc} pc
   */
  #resolveDeviceTypes(pc) {
    if (this.#graphicsSettingsStore.driver === GRAPHICS_DRIVER.WEBGPU) {
      return [pc.DEVICETYPE_WEBGPU];
    }
    if (this.#graphicsSettingsStore.driver === GRAPHICS_DRIVER.WEBGL2) {
      return [pc.DEVICETYPE_WEBGL2];
    }
    // Dense maps currently submit faster through WebGL2. Explicit driver
    // selections above still take precedence, with WebGPU available as fallback.
    return [pc.DEVICETYPE_WEBGL2, pc.DEVICETYPE_WEBGPU];
  }

  /**
   * @param {(key: string, values?: Record<string, string|number>, progress?: number) => void} onProgress
   */
  async init(onProgress = null) {
    onProgress?.("cache");
    await ObjectDataCache.preload();
    onProgress?.("physics");
    await AmmoRuntime.initialize(playCanvas);
    this.#pc = playCanvas;
    if (this.#destroyed) {
      return;
    }
    const pc = this.#pc;

    onProgress?.("graphics");
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
    // Own the backing size in resize(); automatic resolution clamps it to display DPR.
    this.#app.setCanvasResolution(pc.RESOLUTION_FIXED, this.canvas.width, this.canvas.height);
    // Keep MSAA at display resolution: forced 1.5x supersampling adds 125%
    // more fragment work, especially when first-person masonry fills the view.
    const pixelRatio = window.devicePixelRatio || 1;
    this.#app.graphicsDevice.maxPixelRatio = Math.min(
      pixelRatio,
      this.#graphicsSettingsStore.maxPixelRatio,
    );

    // Cool fill keeps shaded armor and cliff faces readable under the warm key.
    this.#app.scene.ambientLight = new pc.Color(0.42, 0.5, 0.61);
    this.#cloudLayer = new pc.Layer({ name: "Cloud backdrop" });
    this.#app.scene.layers.insert(this.#cloudLayer, 0);
    this.#app.on("update", this.#updateFrame);
    EmbeddedTextureParser.install(this.#app);
    this.#textureLibrary = new GameTextureLibrary({
      pc,
      app: this.#app,
      onProgress: PlayCanvasRenderer.#reportAssetProgress.bind(null, onProgress, "texture"),
    });
    this.#audioLibrary = new GameAudioLibrary({
      pc,
      app: this.#app,
    });
    this.#modelLibrary = new GameModelLibrary({
      pc,
      app: this.#app,
      textureLibrary: this.#textureLibrary,
    });
    this.#huds = new HudCollection({
      pc,
      app: this.#app,
    });
    this.addHud(HeroLifeHud);
    this.addHud(CoinHud);
    this.addHud(GameStatusHud);
    this.addHud(HeroMoodHud, { getMood: this.#getMood.bind(this) });
    this.#inventoryScene = new InventoryScene({
      pc,
      app: this.#app,
      modelLibrary: this.#modelLibrary,
      heroConfigurationStore: this.#heroConfigurationStore,
      translate: this.#translate,
      getHero: this.#getHero.bind(this),
      getMapRoot: this.#getMapRoot.bind(this),
      /**
       *
       * @param {number} clientX
       * @param {number} clientY
       * @param {number} heightClientX
       * @param {number} heightClientY
       */
      getDropPlacement: this.#getDropPlacement.bind(this),
    });
    this.#scene = new GameOverScene({
      pc,
      app: this.#app,
      translate: this.#translate,
      sceneObjects: this.#sceneObjects,
      getViewport: this.#getViewport.bind(this),
      getCameraPosition: this.#getCameraPosition.bind(this),
      getCameraState: this.#getCameraState.bind(this),
      /**
       *
       * @param {import("src/game/GameContracts.js").CameraState} state
       */
      setCameraState: this.#setCameraState2.bind(this),
      clearCameraReturn: this.#clearCameraReturn.bind(this),
      updateCamera: this.#updateCamera2.bind(this),
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
      color: new pc.Color(1, 0.94, 0.84),
      intensity: 1.95,
      castShadows: this.#graphicsSettingsStore.shadows,
      shadowType: pc.SHADOW_PCF5,
      shadowDistance: SHADOW_DISTANCE,
      shadowResolution: this.#graphicsSettingsStore.shadowResolution,
      shadowIntensity: 0.82,
      // Keep small feet and trunks attached to their shadows without extra passes.
      shadowBias: 0.14,
      normalOffsetBias: 0.035,
      numCascades: 1,
    });
    sunlight.setEulerAngles(48, 132, 0);
    this.#app.root.addChild(sunlight);
    this.#shadowBudget = new DirectionalShadowBudget(pc, sunlight.light);

    if (this.#destroyed) {
      return;
    }
    this.resize();
    this.#applyDebugSettings();
    this.#stopDebugStoreSubscription = this.#debugStore.$subscribe(
      this.#$subscribe.bind(this),
    );
    this.#app.start();
    this.#frameLoop = new GameFrameLoop(this.#app);
    this.#frameLoop.pause();
    this.#connectPointerInteractions();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   * @param {((key:string, values:Record<string,string|number>, progress:number)=>void)|null} onProgress
   */
  async prepareMapAssets(mapData, onProgress = null) {
    this.#prepareMap(mapData);
    const assets = MapObjectFactory.assetsFor(mapData.objects ?? []);
    const tileTypes = new Set((mapData.grid ?? []).flat());
    const textureUrls = { ...assets.textureUrls };
    if (tileTypes.has(TileType.WATER)) {
      Object.assign(textureUrls, {
        water: waterTopUrl,
        waterSide: waterSideUrl,
      });
    }
    if (tileTypes.has(TileType.PATH) || tileTypes.has(TileType.ENTRY)) {
      Object.assign(textureUrls, PathSurfaceMaterials.textureUrls);
    }
    if (tileTypes.has(TileType.CASTLE_WALL) || tileTypes.has(TileType.CASTLE_TOWER)) {
      Object.assign(textureUrls, {
        castleDoor: woodTexture.url,
        castleStone: castleStoneUrl,
      });
    }
    try {
      await Promise.all([
        this.#createMaterials(textureUrls, onProgress),
        this.#audioLibrary.load(MapObjectFactory.audioUrlsFor(mapData.objects ?? []),
          PlayCanvasRenderer.#reportAssetProgress.bind(null, onProgress, "audio")),
        this.#modelLibrary.load([
          ...Hero.modelUrls,
          HeroPatHand.modelUrl,
          ...assets.modelUrls,
          ...InventoryScene.modelUrls,
          ...(tileTypes.has(TileType.PATH) || tileTypes.has(TileType.ENTRY) ? BridgeRailingKit.modelUrls : []),
          ...(tileTypes.has(TileType.GRASS) || tileTypes.has(TileType.CASTLE_WALL) || tileTypes.has(TileType.CASTLE_TOWER) || mapData.riverData?.length
            ? BuriedTreasureField.modelUrls : []),
        ], /**
         *
         * @param {string} url
         * @param {number} completed
         * @param {number} total
         */
        (url, completed, total) => {
          onProgress?.("model", {
            name: url.split("/").pop().split("?")[0],
            completed,
            total,
          }, total ? completed / total : 1);
        }),
      ]);
    } catch (error) {
      if (this.#destroyed) {
        return;
      }
      throw error;
    }
  }

  /**
   * @param {import("./GameContracts.js").GameMapData} mapData
   */
  #prepareMap(mapData) {
    if (!this.#preparedMaps.has(mapData)) {
      const replacement = new MapObjectReplacement(mapData);
      MapObjectFactory.prepareMap(mapData);
      this.#preparedMaps.set(mapData, replacement);
    }
  }

  /**
   * @param {((key:string, values:Record<string,string|number>, progress:number)=>void)|null} onProgress
   * @param {string} type
   * @param {string} url
   * @param {number} completed
   * @param {number} total
   */
  static #reportAssetProgress(onProgress, type, url, completed, total) {
    onProgress?.(type, {
      name: url.split("/").pop().split("?")[0],
      completed,
      total,
    }, total ? completed / total : 1);
  }

  /**
   * @param {import("./GameContracts.js").GameMapData} mapData
   */
  render(mapData) {
    this.#replacingScene = false;
    for (const step of this.#renderSteps(mapData)) {
      void step;
    }
  }

  /**
   * @param {import("./GameContracts.js").GameMapData} mapData
   */
  *#renderSteps(mapData) {
    this.#islandOffsetsApplied = false;
    let initialViewport = null;
    if (!this.#mapData) {
      this.#gameViewStore.updateViewport(this.#gameViewStore.$state);
      initialViewport = { ...this.#gameViewStore.$state };
    }
    this.#inventoryScene.visible = Boolean(
      this.#heroConfigurationStore.inventory.visible,
    );
    this.#mapData = mapData;
    this.#prepareMap(mapData);
    this.#mapObjectReplacement = this.#preparedMaps.get(mapData);
    const retainedCameraState = this.#replacingScene ? this.#cameraState : null;
    this.#camera.reset(mapData, CAMERA_TARGET_HEIGHT);
    if (retainedCameraState) {
      this.#setCameraState(retainedCameraState);
    }
    this.#scene?.reset();
    this.#updateFitCenter();
    if (!this.#replacingScene) {
      this.#camera.panX = this.#camera.fitCenterX;
      this.#camera.panZ = this.#camera.fitCenterZ;
    }
    yield* this.#rebuildScene();
    this.#huds.remove(MapTestControlsHud);
    if (mapData.testControls?.panels?.length) {
      this.#huds.add(MapTestControlsHud, {
        panels: mapData.testControls.panels,
        controls: new MapTestControls({
          getObjects: this.#getObjects.bind(this),
          getMap: this.#getMap.bind(this),
          onRuntimeError: this.#onRuntimeError,
          /**
           * @param {{zoom: number, rotation: number, panX: number, panZ: number}} viewport
           */
          setViewport: this.#setViewport.bind(this),
          /**
           * @param {boolean} enabled
           */
          setFirstPerson: this.#setFirstPerson.bind(this),
        }),
      });
    }
    this.#fitCamera();
    this.#updateCamera();
    this.#heroVisibility?.schedule();
    if (!this.#replacingScene && this.#mapData.animationViewport) {
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
    if (this.#decorationsEnabled) {
      this.#decorations.start();
    }
  }

  #applyDebugSettings() {
    this.panLimitsEnabled =
      !this.#debugStore.hasAny && !this.#camera.firstPersonEnabled;
  }

  /**
   *
   * @returns {number}
   */
  get zoom() {
    return this.#camera.zoom;
  }

  /**
   *
   * @returns {boolean}
   */
  get canPan() {
    return (
      !this.#cameraLocked &&
      !this.#camera.firstPersonEnabled &&
      (!this.#camera.panLimitsEnabled || this.#camera.zoom > MAP_FIT_ZOOM)
    );
  }

  /**
   *
   * @returns {pc.Vec3}
   */
  get rotation() {
    return this.#camera.rotation;
  }

  /**
   *
   * @returns {number}
   */
  get windSpeed() {
    return this.#cloudField?.windSpeed ?? 0;
  }

  /**
   *
   * @returns {pc.GraphicsDevice|null}
   */
  get graphicsBackend() {
    return this.#app?.graphicsDevice?.deviceType ?? null;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").StoreContract}
   */
  get heroState() {
    const hero = this.hero;
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
      action: hero.actionState,
      buffs: hero.buffs,
      stats: hero.stats,
      movement: hero.movementState,
      patScreenPosition: this.#heroPatScreenPosition(),
      footPlacement: hero.footPlacementState,
      wallet: hero.wallet,
      inventory: this.inventoryState,
    };
  }

  /**
   * @returns {import("./objects/ObjectTypes.js").MapObjectDefinition[]}
   */
  get authoredObjectDefinitions() {
    return (
      this.#mapData?.objects.filter(PlayCanvasRenderer.#filterDefinition) ?? []
    );
  }

  /**
   *
   * @returns {Array<import("./objects/castle/rooms/terrace/CastleTerraceActivity.js").CastleTerraceActivity["state"]|null>}
   */
  get royalCastleStates() {
    return this.#sceneObjects
      .getAll(SCENE_OBJECT_TYPE.CASTLE)
      .map(PlayCanvasRenderer.#mapCastle);
  }

  /**
   *
   * @returns {{capacity: number, items: GameObjectDefinition[]}}
   */
  get inventoryState() {
    return (
      this.#inventoryScene?.state ?? {
        capacity: Hero.inventoryCapacity,
        items: [],
        visible: false,
      }
    );
  }

  /**
   *
   * @returns {boolean}
   */
  get inventoryVisible() {
    return this.#inventoryScene?.visible ?? false;
  }

  /**
   *
   * @returns {boolean}
   */
  get inventoryFullReactionVisible() {
    return this.#inventoryScene?.fullReactionVisible ?? false;
  }

  /**
   *
   * @returns {number}
   */
  get thrownInventoryItemCount() {
    return this.#inventoryScene?.thrownItemCount ?? 0;
  }

  /**
   *
   * @returns {Array<import("./objects/inventory/ThrownInventoryItem.js").ThrownInventoryItem["state"]>}
   */
  get thrownInventoryItemStates() {
    return this.#inventoryScene?.thrownItemStates ?? [];
  }

  /**
   *
   * @returns {{speed: number, direction?: pc.Vec3}}
   */
  get wind() {
    return (
      this.#cloudField?.wind ?? {
        direction: {
          x: 0,
          y: 0,
          z: 0,
        },
        speed: 0,
      }
    );
  }

  /**
   *
   * @returns {Readonly<Record<string, number>>}
   */
  get debugDirections() {
    return this.#camera?.debugDirections ?? null;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").ViewportRect}
   */
  get viewport() {
    return this.#camera.viewport;
  }

  /**
   *
   * @returns {boolean}
   */
  get panLimitsEnabled() {
    return this.#camera.panLimitsEnabled;
  }

  /**
   *
   * @returns {boolean}
   */
  get firstPersonCameraEnabled() {
    return this.#camera.firstPersonEnabled;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").CameraState}
   */
  get firstPersonCameraState() {
    return this.#camera.firstPersonState;
  }

  /**
   *
   * @returns {number}
   */
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
    this.#islandOffsetsApplied = false;
    this.#shadowBudget.limited = nextEnabled;
    const sunlight = this.#app.root.findByName("Sunlight");
    if (sunlight?.light) {
      sunlight.light.shadowDistance = nextEnabled
        ? FIRST_PERSON_SHADOW_DISTANCE
        : SHADOW_DISTANCE;
    }
    const statusHud = this.getHud(GameStatusHud);
    if (statusHud) {
      statusHud.firstPersonVisible = nextEnabled;
    }
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

  /**
   *
   * @returns {{visible: boolean, opacity?: number}}
   */
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

  /**
   *
   * @returns {{visible: boolean, message?: string}}
   */
  get gameStatusHudState() {
    return (
      this.getHud(GameStatusHud)?.state ?? {
        firstPersonVisible: false,
        interaction: null,
      }
    );
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").InteractionDescription|null} target
   * @param {boolean} visible
   */
  setInteractionPrompt(target, visible = true) {
    const prompt =
      visible && target?.labelKey
        ? {
          ...target,
          label: this.t(target.labelKey),
        }
        : null;
    this.getHud(GameStatusHud)?.setInteraction(prompt);
  }

  /**
   *
   * @returns {boolean}
   */
  get cameraReturningToHero() {
    return this.#camera.returnTransition !== null;
  }

  /**
   *
   * @returns {Hero|null}
   */
  get hero() {
    return this.#replacementHero ?? this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO) ?? null;
  }

  returnCameraToHero() {
    return this.#startHeroCameraReturn(true);
  }

  /**
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  teleportHeroAtPointer(event) {
    const hero = this.hero;
    if (
      !hero || this.inventoryVisible || hero.isGameOver
    ) {
      return false;
    }
    const ray = this.#pointerRay(event);
    if (!ray) {
      return false;
    }
    const hit = this.#app.systems.rigidbody.raycastFirst(ray.start, ray.end, {
      /**
       * @param {pc.Entity} entity
       */
      filterCallback: (entity) =>
        entity !== hero.entity && !entity.isDescendantOf(hero.entity),
    });
    if (!hit || hit.normal.y < 0.35) {
      return false;
    }
    return hero.teleport(hit.point);
  }

  isGameOver() {
    return (
      this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.isGameOver ||
      this.#heroStateStore.gameOver
    );
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").ViewportRect}
   */
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

  /**
   *
   * @param {boolean} visible
   */
  #setInventoryVisible(visible) {
    const nextVisible = Boolean(visible);
    this.#inventoryScene?.setVisible(nextVisible);
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  pressInventoryPointer(clientX, clientY) {
    return this.#inventoryScene?.pointerDown(clientX, clientY) ?? false;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
  moveInventoryPointer(clientX, clientY) {
    return this.#inventoryScene?.pointerMove(clientX, clientY) ?? false;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   */
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

  /**
   *
   * @param {{zoom: number, rotation: pc.Vec3, panX: number, panZ: number, manuallyMoved: boolean}} options
   * @param {number} options.zoom
   * @param {pc.Vec3} options.rotation
   * @param {number} options.panX
   * @param {number} options.panZ
   * @param {boolean} options.manuallyMoved
   */
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

  /**
   *
   * @param {number} newZoom
   * @param {number} pivotX
   * @param {number} pivotY
   */
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

  /**
   *
   * @param {number} deltaX
   * @param {number} deltaY
   */
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
    const panOrigin = {
      x: this.#camera.panX,
      z: this.#camera.panZ,
    };
    const offset = this.#screenDeltaToGround(deltaX, deltaY, this.#camera.zoom);
    this.#camera.panX -= offset.x;
    this.#camera.panZ -= offset.z;
    this.#camera.manuallyMoved = true;
    this.#updateCamera(panOrigin);
  }

  /**
   *
   * @param {number} quarterTurns
   * @param {number} verticalQuarterTurns
   */
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

  /**
   *
   * @param {number} yawDegrees
   * @param {number} pitchDegrees
   */
  lookFirstPersonBy(yawDegrees, pitchDegrees) {
    if (!this.#camera.firstPersonEnabled) {
      return;
    }
    this.#camera.lookFirstPersonBy(yawDegrees, pitchDegrees);
    this.#updateCamera();
  }

  /**
   *
   * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string}} input
   */
  cameraPointerDown(input) {
    return this.#camera.pointerDown(input);
  }

  /**
   *
   * @param {{position?: import("src/game/GameContracts.js").GridPoint, doors?: import("src/game/GameContracts.js").CastleOpening[], style?: string}} input
   */
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
    // Apply the configured DPR cap consistently to the backing buffer.
    const pixelRatio = this.#app.graphicsDevice.maxPixelRatio;
    this.#app.graphicsDevice.setResolution(
      Math.max(1, Math.floor(width * pixelRatio)),
      Math.max(1, Math.floor(height * pixelRatio)),
    );
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

  /**
   *
   * @returns {pc.Entity}
   */
  get camera() {
    return this.#camera.entity;
  }

  get canvasElement() {
    return this.canvas;
  }

  get mapRoot() {
    return this.#mapRoot;
  }

  /**
   *
   * @param {typeof import("./ui/GamePanelHud.js").GamePanelHud} HudClass
   * @param {{mapName?: string, numPaths?: number, numRivers?: number, signal?: AbortSignal}} options
   */
  addHud(HudClass, options = {}) {
    return this.#huds?.add(HudClass, options) ?? null;
  }

  /**
   *
   * @param {typeof import("./ui/GamePanelHud.js").GamePanelHud} HudClass
   */
  getHud(HudClass) {
    return this.#huds?.getHud(HudClass) ?? null;
  }

  /**
   *
   * @param {typeof import("./ui/GamePanelHud.js").GamePanelHud} HudClass
   */
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
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
    this.#textureAssets.clear();
    this.#modelLibrary?.destroy();
    this.#modelLibrary = null;
    this.#textureLibrary?.destroy();
    this.#audioLibrary?.destroy();
    if (this.#cloudLayer) {
      this.#app?.scene.layers.remove(this.#cloudLayer);
      this.#cloudLayer = null;
    }
    this.#app?.destroy();
    this.#app = null;
    this.#frameLoop = null;
    this.#shadowBudget = null;
  }

  /**
   * @param {Record<string,string>} textureUrls
   * @param {((key:string, values:Record<string,string|number>, progress:number)=>void)|null} onProgress
   */
  async #createMaterials(textureUrls, onProgress) {
    await this.#textureLibrary.loadNamed(textureUrls,
      PlayCanvasRenderer.#reportAssetProgress.bind(null, onProgress, "texture"));
    /**
     * @type {Map<string, playCanvas.Texture>}
     */
    const textures = new Map();
    await Promise.all(
      Object.entries(textureUrls).map(/**
       *
       * @param {[string, string]} entry
       */
        async ([name, url]) => {
          textures.set(name, await this.#loadTexture(name, url));
        }),
    );
    for (const [name, asset] of this.#textureAssets) {
      textures.set(name, asset.resource);
    }
    for (const [name, definition] of Object.entries(MATERIAL_DEFINITIONS)) {
      this.#materials.set(
        name,
        this.#createMaterial(name, definition, textures),
      );
    }

    for (const [name, definition] of Object.entries(SIDE_VARIANT_DEFINITIONS)) {
      SIDE_VARIANT_TRANSFORMS.forEach(/**
       *
       * @param {typeof SIDE_VARIANT_TRANSFORMS[number]} transform
       * @param {number} index
       */
        (transform, index) => {
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

    MapObjectFactory.registerMaterials(
      this.#materials,
      /**
       *
       * @param {string} name
       * @param {import("src/game/GameContracts.js").MaterialDefinition} definition
       */
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
    PathSurfaceMaterials.register(
      this.#materials,
      /**
       *
       * @param {string} name
       * @param {import("src/game/GameContracts.js").MaterialDefinition} definition
       */
      (name, definition) => this.#createMaterial(name, definition, textures),
      SIDE_VARIANT_TRANSFORMS,
    );
  }

  /**
   *
   * @param {string} name
   * @param {import("src/game/GameContracts.js").MaterialDefinition} definition
   * @param {Map<string, playCanvas.Texture>} textures
   */
  #createMaterial(name, definition, textures = new Map()) {
    const pc = this.#pc;
    const material = this.#materials.get(name) ?? new pc.StandardMaterial();
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

  /**
   *
   * @param {string} name
   * @param {string} url
   */
  async #loadTexture(name, url) {
    const pc = this.#pc;
    const asset = this.#textureLibrary.get(url, name);
    this.#textureAssets.set(name, asset);
    const texture = asset.resource;
    texture.mipmaps = this.#graphicsSettingsStore.mipmaps;
    texture.minFilter = texture.mipmaps
      ? pc.FILTER_LINEAR_MIPMAP_LINEAR
      : pc.FILTER_LINEAR;
    texture.magFilter =
      name === "castleStone" ? pc.FILTER_NEAREST : pc.FILTER_LINEAR;
    texture.anisotropy = this.#graphicsSettingsStore.anisotropy;
    texture.addressU = url === woodTexture.url ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV =
      name === "castleDoor" ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
    MapObjectFactory.configureTexture(
      pc,
      name,
      texture,
      this.#graphicsSettingsStore.mipmaps,
    );

    return texture;
  }

  *#rebuildScene() {
    // Keep the old terrain visible until the replacement is fully constructed.
    const retired = this.#replacingScene ? {
      terrain: this.#terrainRenderer,
      root: this.#mapRoot,
      buffers: this.#vertexBuffers,
      objects: this.#sceneObjects.detach(),
    } : null;
    if (retired) {
      this.#terrainRenderer = null;
      this.#mapRoot = null;
      this.#vertexBuffers = [];
    }
    try {
      this.#clearScene();
      this.#mapRoot = new this.#pc.Entity("Voxel map");
      this.#app.root.addChild(this.#mapRoot);
      this.#mapRoot.enabled = !this.#replacingScene;
      this.#islandOffsetsApplied = false;
      this.#islandConnectorMotion = new IslandConnectorMotion(this.#mapData);

      this.#bridgeRailingKit = new BridgeRailingKit({
        pc: this.#pc,
        modelLibrary: this.#modelLibrary,
        materials: this.#materials,
        root: this.#mapRoot,
        mapData: this.#mapData,
      });
      this.#terrainRenderer = new TerrainRenderer({
        pc: this.#pc,
        app: this.#app,
        mapData: this.#mapData,
        root: this.#mapRoot,
        materials: this.#materials,
        bridgeRailingKit: this.#bridgeRailingKit,
        modelLibrary: this.#modelLibrary,
      });
      yield* this.#buildMapObjects();
      yield;
      this.#terrainRenderer.build();
      yield;
      this.#vertexBuffers.push(...this.#bridgeRailingKit.build());
      this.#decorations.add(this.#buildClouds.bind(this));
      this.getHud(HeroLifeHud)?.setCastleLives(
        this.#sceneObjects.getFirst(SCENE_OBJECT_TYPE.CASTLE)
          ? MAX_CASTLE_LIVES
          : 0,
        MAX_CASTLE_LIVES,
      );
      yield;
      this.#buildBuriedTreasure();
      yield;
      this.#terrainRenderer.buildPhysicsSurface(this.#collisionWorld);
      yield;
      this.#buildHero();
      yield;
      this.#connectHeroTools();
      for (const object of this.#sceneObjects) {
        if (this.#replacingScene && object.onSceneReadyAsync) {
          yield object.onSceneReadyAsync();
        } else {
          object.onSceneReady?.();
          yield;
        }
      }
      this.#updateInteractionTarget();

      if (this.#replacingScene && this.#decorationsEnabled) {
        yield this.#decorations.start();
      }
      const previousHero = retired?.objects.getOne(SCENE_OBJECT_TYPE.HERO);
      const nextHero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
      if (previousHero && nextHero) {
        nextHero.continueMovementFrom(previousHero);
      }
      this.#replacementHero = null;
      this.#mapRoot.enabled = true;
      this.#captureCameraVisualBounds();
    } finally {
      for (const object of retired?.objects ?? []) {
        object.destroy?.();
      }
      retired?.objects.clear();
      retired?.terrain?.destroy();
      retired?.root?.destroy();
      for (const buffer of retired?.buffers ?? []) {
        buffer.destroy();
      }
    }
  }

  /**
   * @param {import("./objects/ObjectTypes.js").MapObjectDefinition} definition
   * @param {MapObjectReplacement} replacement
   * @returns {Promise<boolean>}
   */
  async #replaceObjectDefinition(definition, replacement) {
    if (this.#destroyed || this.#replacingScene || replacement !== this.#mapObjectReplacement) {
      return false;
    }
    const map = replacement.replace(definition, this.#mapData.objects, this.hero.position);
    if (!map) {
      return false;
    }
    const viewport = { ...this.viewport };
    const camera = this.firstPersonCameraState;
    await this.prepareMapAssets(map);
    if (this.#destroyed || replacement !== this.#mapObjectReplacement) {
      return false;
    }
    this.#replacementHero = this.hero;
    this.#replacingScene = true;
    try {
      let lastYield = performance.now();
      for (const step of this.#renderSteps(map)) {
        await step;
        if (this.#destroyed || this.#mapData !== map) {
          return false;
        }
        if (performance.now() - lastYield >= 6) {
          await new Promise(PlayCanvasRenderer.#yieldReplacementFrame);
          if (this.#destroyed || this.#mapData !== map) {
            return false;
          }
          lastYield = performance.now();
        }
      }
      if (this.#decorationsEnabled) {
        await this.#decorations.start();
      }
      if (this.#destroyed || this.#mapData !== map) {
        return false;
      }
    } finally {
      this.#replacementHero = null;
      if (this.#mapData === map) {
        this.#replacingScene = false;
      }
    }
    this.setViewport(viewport);
    if (camera) {
      const current = this.firstPersonCameraState;
      const degrees = 180 / Math.PI;
      this.lookFirstPersonBy(
        (Math.atan2(camera.direction.x, camera.direction.z) - Math.atan2(current.direction.x, current.direction.z)) * degrees,
        (Math.asin(current.direction.y) - Math.asin(camera.direction.y)) * degrees,
      );
    }
    return true;
  }

  /**
   * @returns {Promise<boolean>}
   */
  startDecorations() {
    this.#decorationsEnabled = true;

    return this.#decorations.start();
  }

  /**
   * @param {Error} error
   */
  #reportDecorationError(error) {
    if (this.#onRuntimeError) {
      this.#onRuntimeError(error);
    } else {
      throw error;
    }
  }

  pauseDecorations() {
    this.#decorationsEnabled = false;
    this.#decorations.pause();
  }

  pauseAnimations() {
    this.#frameLoop?.pause();
  }

  resumeAnimations() {
    this.#frameLoop?.resume();
  }

  #buildClouds() {
    if (this.#cloudField) {
      return;
    }
    this.#cloudField = new CubeCloudField({
      pc: this.#pc,
      app: this.#app,
      camera: this.#camera.camera,
      mapData: this.#mapData,
      layerId: this.#cloudLayer.id,
    });
    this.#app.root.addChild(this.#cloudField.entity);
    this.#updateCamera();
  }

  *#buildMapObjects() {
    const replacement = this.#mapObjectReplacement;
    for (const object of MapObjectFactory.createEach({
      pc: this.#pc,
      app: this.#app,
      modelLibrary: this.#modelLibrary,
      definitions: this.#mapData.objects ?? [],
      runtime: {
        audioLibrary: this.#audioLibrary,
        deferDecoration: this.#decorations.add.bind(this.#decorations),
        mapData: this.#mapData,
        materials: this.#materials,
        getHero: this.#getHero2.bind(this),
        /**
         * @param {import("./objects/ground-cover/GroundCoverCollectible.js").GroundCoverCollectible} item
         */
        onCollectibleRemoved: this.#onCollectibleRemoved.bind(this),
        objects: this.#sceneObjects,
        /**
         * @param {import("./objects/ObjectTypes.js").MapObjectDefinition} definition
         */
        replaceObjectDefinition: (definition) => this.#replaceObjectDefinition(definition, replacement),
        textureAssets: this.#textureAssets,
        root: this.#mapRoot,
        camera: this.#camera,
        collisionWorld: this.#collisionWorld,
        instanceRenderer: this.#terrainRenderer.instanceRenderer,
        /**
         * @param {(value: string) => string} value
         */
        setMaterialResolver: this.#setMaterialResolver.bind(this),
        sideVariantCount: SIDE_VARIANT_TRANSFORMS.length,
        getContactProviders: this.#getContactProviders.bind(this),
        /**
         * @param {import("src/game/GameContracts.js").GameObjectContract} removedObject
         */
        onObjectRemoved: this.#onObjectRemoved.bind(this),
        onRuntimeError: this.#onRuntimeError,
      },
      /**
       *
       * @param {import("src/game/GameContracts.js").GameObjectContract} object
       */
      onCreate: this.#onCreate.bind(this),
    })) {
      this.#mapRoot.addChild(object.entity);
      if (object.isGroundCollider) {
        this.#collisionWorld.add(object, {
          physicsSurface: object.physicsSurface !== false,
        });
      }
      yield;
    }
  }

  #captureCameraVisualBounds() {
    this.#mapRoot?.syncHierarchy();
    const castles = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.CASTLE);
    const gateways = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.GATEWAY);
    const roots = [
      ...castles.map(PlayCanvasRenderer.#mapCastle2),
      ...gateways.map(PlayCanvasRenderer.#mapGateway),
      ...this.#sceneObjects
        .getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)
        .flatMap(PlayCanvasRenderer.#flatMapObject),
      {
        name: "ground-cover",
        root: this.#groundCover?.entity,
      },
    ].filter(PlayCanvasRenderer.#filter);
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
    /**
     *
     * @param {{object: import("src/game/GameContracts.js").GameObjectContract}} options
     * @param {import("src/game/GameContracts.js").GameObjectContract} options.object
     */
    const isHeroDefinition = PlayCanvasRenderer.#isHeroDefinition;
    if (this.#mapData.objects?.some(isHeroDefinition)) {
      return;
    }
    /**
     *
     * @param {typeof import("./ui/GamePanelHud.js").GamePanelHud} HudClass
     */
    const getHud = this.#getHud.bind(this);
    const hero = new Hero({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      spawnCenter: {
        x: this.#camera.fitCenterX,
        z: this.#camera.fitCenterZ,
      },
      getViewRotation: this.#getViewRotation.bind(this),
      getViewDirection: this.#getViewDirection.bind(this),
      onPositionChange: this.#handleHeroPositionChange,
      onFacingChange: this.#handleHeroFacingChange,
      onMovementInput: this.#onMovementInput.bind(this),
      heroConfigurationStore: this.#heroConfigurationStore,
      graphicsSettingsStore: this.#graphicsSettingsStore,
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
        getMoodScreenPosition: this.#getMoodScreenPosition.bind(this),
        getInventoryFullScreenPosition:
          this.#getInventoryFullScreenPosition.bind(this),
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
      getViewRotation: this.#getViewRotation2.bind(this),
      onContact: () => hero.pat(),
    });
    this.#mapRoot.addChild(this.#heroPatHand.entity);
    this.#heroPatGesture = new HeroPatGesture(this.canvas, {
      /**
       *
       * @param {import("src/game/GameContracts.js").CameraPointer} event
       */
      hitTest: this.#hitTest.bind(this),
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
      getRotation: this.#getRotation.bind(this),
      /**
       *
       * @param {pc.Vec3} rotation
       */
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
      ...mapObjects.filter(PlayCanvasRenderer.#filter2),
    ];
  }

  #buildBuriedTreasure() {
    this.#buriedTreasure = new BuriedTreasureField({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      modelLibrary: this.#modelLibrary,
      /**
       *
       * @param {string} type
       * @param {number} amount
       */
      onCollectCoin: this.#onCollectCoin.bind(this),
      onInteractionChange: this.#onInteractionChange2.bind(this),
      /**
       *
       * @param {pc.Vec3} position
       * @param {number} radius
       * @param {number|null} [fillDepth] Filled soil height relative to the cube top.
       * @param {Array<Array<number>>|null} [outline] Authored XZ surface perimeter.
       */
      onTerrainExcavated: this.#onTerrainExcavated.bind(this),
    });
    this.#collisionWorld.add(this.#buriedTreasure);
    this.#sceneObjects.add(SCENE_OBJECT_TYPE.MAP_OBJECT, this.#buriedTreasure);
    this.#mapRoot.addChild(this.#buriedTreasure.entity);
  }

  /**
   *
   * @param {pc.Vec3} position
   */
  #updateCastlesForHero(position) {
    const castles = this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.CASTLE);
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    const heroPosition = hero?.position ?? position;
    const activeCastle = castles.find(/**
     *
     * @param {import("src/game/GameContracts.js").CastleLayout} castle
     */
      (castle) =>
        castle.isRoyalActivityTriggerAt(heroPosition),
    );
    if (hero) {
      hero.boostingCountryFinances = Boolean(activeCastle);
    }
    for (const castle of castles) {
      castle.setRoyalActivityTriggered(
        hero?.actionState.boostingCountryFinances && castle === activeCastle,
      );
      castle.updateHeroPosition(position);
    }
    for (const object of this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)) {
      object.updateHeroPosition?.(position);
    }
  }

  /**
   *
   * @param {number} deltaTime
   * @type {(deltaTime: number) => void}
   */
  #updateFrame = (deltaTime) => {
    this.#shadowBudget?.update(deltaTime);
    if (this.#frameUpdateFailed) {
      return;
    }
    try {
      if (this.#replacingScene) {
        this.#cloudField?.update(deltaTime);

        return;
      }
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

  /**
   *
   * @param {number} deltaTime
   */
  #updateRuntimeSystems(deltaTime) {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    for (const object of this.#sceneObjects.getWithMethod("onFrame")) {
      object.onFrame?.(deltaTime, hero, this.#camera?.camera);
    }
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
    this.#updateIslandConnectorMotion(deltaTime);
  }

  /**
   * @param {number} deltaTime
   */
  #updateIslandConnectorMotion(deltaTime) {
    if (!this.#mapData.islandConnectorData) {
      return;
    }
    const count = this.#mapData.islandConnectorData.islands?.length ?? 2;
    const firstPerson = this.#camera.firstPersonEnabled;
    const hero = this.hero;
    const focus = hero && !this.#camera.manuallyMoved
      ? new this.#pc.Vec2(hero.position.x, hero.position.z)
      : new this.#pc.Vec2(this.#camera.panX, this.#camera.panZ);
    const offsets = firstPerson
      ? {
        near: 0,
        far: 0,
        groups: new Array(count).fill(0),
      }
      : this.#islandConnectorMotion.update(deltaTime, count, this.#camera.zoom, focus);
    const grounded = firstPerson;
    // Avoid rewriting static instance buffers once the close view has settled.
    if (grounded && this.#islandOffsetsApplied) {
      return;
    }
    this.#terrainRenderer?.setIslandOffsets(offsets.near, offsets.far, offsets.groups);
    this.#bridgeRailingKit?.setIslandOffsets(offsets.near, offsets.far, offsets.groups);
    for (const object of this.#sceneObjects.getWithMethod("setIslandOffsets")) {
      object.setIslandOffsets(offsets.near, offsets.far, offsets.groups);
    }
    this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO)?.setIslandVisualOffsets(
      offsets.near,
      offsets.far,
      offsets.groups,
    );
    this.#islandOffsetsApplied = grounded;
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

  /**
   * @param {number} heightOffset World-space height above the hair contact point.
   */
  #heroPatScreenPosition(heightOffset = 0) {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    const position = hero?.patPosition;
    if (!position || !this.#camera?.camera) {
      return null;
    }
    position.y += heightOffset;
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

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraPointer} event
   */
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

  /**
   *
   * @param {number} col
   * @param {number} row
   */
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
        if (grid[row][col] === TileType.WATER) {
          continue;
        }
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

  /**
   *
   * @param {{x: number, y: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @type {(arg0: {x: number, y: number, z: number}) => void}
   */
  #handleHeroPositionChange = ({ x, y, z }) => {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!hero || this.#replacingScene) {
      return;
    }
    this.#camera.orbitPivot = null;
    this.#updateCastlesForHero({
      x,
      y,
      z,
    });
    this.#groundCover?.applyHeroInteraction({
      x,
      y,
      z,
    }, hero?.movementState);
    this.#buriedTreasure?.applyHeroPosition({
      x,
      y,
      z,
    });
    this.#updateInteractionTarget({
      x,
      y,
      z,
    });
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

  /**
   *
   * @param {boolean} force
   * @param {{allowAutomatic: boolean, duration: number, preserveFocus: boolean}} options
   * @param {boolean} options.allowAutomatic
   * @param {number} options.duration
   * @param {boolean} options.preserveFocus
   */
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

  /**
   *
   * @param {number} deltaTime
   */
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

  /**
   *
   * @type {() => void}
   */
  #handleHeroFacingChange = () => {
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (this.#camera.firstPersonEnabled) {
      this.#updateCamera();
    }
    if (!hero?.isUsingTool && !hero?.isCollecting) {
      this.#updateInteractionTarget();
    }
  };

  /**
   *
   * @returns {boolean}
   */
  get #cameraLocked() {
    return this.#scene?.cameraLocked ?? false;
  }

  /**
   *
   * @returns {import("src/game/GameContracts.js").CameraState}
   */
  get #cameraState() {
    return this.#camera.state;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraState} state
   */
  #setCameraState(state) {
    this.#camera.setState(state);
  }

  /**
   *
   * @param {{x: number, z: number}|null} [panOrigin]
   * @param {boolean} preserveFocus
   */
  #updateCamera(panOrigin = null, preserveFocus = false) {
    if (!this.#camera || !this.#mapData || this.#replacingScene) {
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
        // Floor support and door proximity follow the actor's feet, even when
        // the first-person camera is above them at eye height.
        this.#updateCastlesForHero(hero?.position ?? update.position);
      }
    } else {
      if (this.#groundCover) {
        this.#groundCover.zoom = this.#camera.zoom;
      }
      for (const object of this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)) {
        object.onCameraChanged?.();
      }
      this.#cloudField?.setCameraState({
        rotation: this.#camera.rotation,
        panX: this.#camera.panX,
        panZ: this.#camera.panZ,
        zoom: this.#camera.zoom,
      });
    }
    this.#updateHeroIdleLookTarget();
    this.#notifyViewportChange();
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   */
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
      MapObjectFactory.surfaceLiftForTile(type)
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

  /**
   *
   * @returns {import("src/game/GameContracts.js").CameraView}
   */
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

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} zoom
   */
  #screenOffsetToGround(x, y, zoom) {
    return this.#screenDeltaToGround(
      x - this.container.clientWidth / 2,
      y - this.container.clientHeight / 2,
      zoom,
    );
  }

  /**
   *
   * @param {number} deltaX
   * @param {number} deltaY
   * @param {number} zoom
   */
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

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraPointer} event
   */
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

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} heightClientX
   * @param {number} heightClientY
   */
  #inventoryDropPlacement(clientX, clientY, heightClientX, heightClientY) {
    const ray = this.#pointerRay({
      clientX,
      clientY,
    });
    const heightRay = this.#pointerRay({
      clientX: heightClientX ?? clientX,
      clientY: heightClientY ?? clientY,
    });
    const hero = this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
    if (!ray || !heightRay || !hero) {
      return null;
    }
    const hit = this.#inventoryDropRaycast(heightRay);
    const position = hit?.point?.clone() ?? this.#inventoryDropPlanePosition(
      ray,
      hero.position.y,
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

  /**
   *
   * @param {import("./objects/shared/ScenePointerInteraction.js").ScenePointerRay} ray
   */
  #inventoryDropRaycast(ray) {
    const hits =
      this.#app?.systems.rigidbody?.raycastAll?.(ray.start, ray.end, {
        sort: true,
      }) ?? [];

    return hits.find(PlayCanvasRenderer.#findHit) ?? null;
  }

  /**
   *
   * @param {pc.Vec3} position
   * @param {number} clientY
   */
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

  /**
   *
   * @param {import("./objects/shared/ScenePointerInteraction.js").ScenePointerRay} ray
   * @param {number} height
   */
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

  /**
   *
   * @param {MouseEvent} event
   * @type {(event: MouseEvent) => void}
   */
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

  /**
   *
   * @param {import("src/game/GameContracts.js").SceneInteraction|null} target
   */
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

  /**
   *
   * @type {() => void}
   */
  #refreshInteractionTarget = () => {
    this.#setInteractionTarget(this.#interactionTarget);
  };

  /**
   *
   * @type {() => void}
   */
  #completeInteraction = () => {
    this.#setInteractionTarget(null);
    // Tool completion fires during state exit; query after the transition finishes.
    queueMicrotask(this.#updateInteractionTarget.bind(this));
  };

  #clearScene() {
    this.#decorations.clear();
    if (this.#camera) {
      this.#camera.orbitPivot = null;
    }
    this.#heroPatGesture?.destroy();
    this.#heroPatGesture = null;
    this.#heroPatHand?.destroy();
    this.#heroPatHand = null;
    this.#pointerInteraction?.cancelActivePointer();
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.GATEWAY);
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.MAP_OBJECT);
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.CASTLE);
    this.#heroVisibility?.destroy();
    this.#heroVisibility = null;
    this.#islandOffsetsApplied = false;
    this.#interactionProviders = [];
    this.#inventoryScene?.clearWorldItems();
    this.#sceneObjects.destroyType(SCENE_OBJECT_TYPE.HERO);
    this.#terrainRenderer?.destroy();
    this.#terrainRenderer = null;
    this.#buriedTreasure = null;
    if (!this.#replacingScene || this.#destroyed) {
      this.#cloudField?.destroy();
      this.#cloudField = null;
    }
    this.#setInteractionTarget(null);
    this.#mapRoot?.destroy();
    this.#mapRoot = null;
    this.#bridgeRailingKit = null;
    this.#collisionWorld.clear();
    for (const buffer of this.#vertexBuffers) {
      buffer.destroy();
    }
    this.#vertexBuffers = [];
  }

  #useDebounceFn() {
    this.#saveViewport();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraPointer} event
   */
  #pointerRay2(event) {
    return this.#camera.firstPersonEnabled ? null : this.#pointerRay(event);
  }

  #onMousePointerLeave() {
    return this.#clearHeroIdleLookTarget();
  }

  #getMood() {
    return this.#heroStateStore?.mood ?? null;
  }

  #getHero() {
    return this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
  }

  #getMapRoot() {
    return this.#mapRoot;
  }

  /**
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} heightClientX
   * @param {number} heightClientY
   */
  #getDropPlacement(clientX, clientY, heightClientX, heightClientY) {
    return this.#inventoryDropPlacement(
      clientX,
      clientY,
      heightClientX,
      heightClientY,
    );
  }

  #getViewport() {
    return this.viewport;
  }

  #getCameraPosition() {
    return this.#camera?.getPosition() ?? null;
  }

  #getCameraState() {
    return this.#cameraState;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraState} state
   */
  #setCameraState2(state) {
    return this.#setCameraState(state);
  }

  #clearCameraReturn() {
    this.#camera.returnTransition = null;
    this.#camera.orbitPivot = null;
  }

  #updateCamera2() {
    return this.#updateCamera();
  }

  #$subscribe() {
    this.#applyDebugSettings();
  }

  #getObjects() {
    return this.#sceneObjects;
  }

  #getMap() {
    return this.#mapData;
  }

  /**
   * @param {{zoom: number, rotation: number, panX: number, panZ: number}} viewport
   */
  #setViewport(viewport) {
    return this.setViewport(viewport);
  }

  /**
   * @param {boolean} enabled
   */
  #setFirstPerson(enabled) {
    this.firstPersonCameraEnabled = enabled;
  }

  /**
   * @param {import("./objects/ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return !definition.generated;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CastleLayout} castle
   */
  static #mapCastle(castle) {
    return castle.royalActivityState;
  }

  #getHero2() {
    return this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO);
  }

  /**
   * @param {import("./objects/ground-cover/GroundCoverCollectible.js").GroundCoverCollectible} item
   */
  #onCollectibleRemoved(item) {
    return this.#buriedTreasure?.removeGroundCover(item);
  }

  /**
   * @param {(value: string) => string} value
   */
  #setMaterialResolver(value) {
    this.#terrainRenderer.resolveMaterial = value;
  }

  #getContactProviders() {
    return [this.#sceneObjects.getOne(SCENE_OBJECT_TYPE.HERO), this.#inventoryScene, this.#groundCover];
  }

  /**
   * @param {import("src/game/GameContracts.js").GameObjectContract} removedObject
   */
  #onObjectRemoved(removedObject) {
    this.#buriedTreasure?.removeMapObject(removedObject);
    for (const object of this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT)) {
      object.onObjectRemoved?.(removedObject);
    }
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameObjectContract} object
   */
  #onCreate(object) {
    return this.#sceneObjects.add(
      object.sceneObjectType ?? SCENE_OBJECT_TYPE.MAP_OBJECT,
      object,
    );
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CastleLayout} castle
   * @param {number} index
   */
  static #mapCastle2(castle, index) {
    return {
      name: `castle-${index}`,
      protectAtPanLimit: true,
      centerReachableAtEveryZoom: true,
      root: castle.entity,
    };
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameObjectContract} gateway
   * @param {number} index
   */
  static #mapGateway(gateway, index) {
    return {
      name: `gateway-${index}`,
      protectAtPanLimit: true,
      root: gateway.entity,
    };
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameObjectContract} object
   */
  static #flatMapObject(object) {
    return (object.visualRoots ?? []).map(PlayCanvasRenderer.#mapRoot2);
  }

  /**
   *
   * @param {{root: pc.Entity}} options
   * @param {pc.Entity} options.root
   */
  static #filter({ root }) {
    return root;
  }

  /**
   *
   * @param {{object: import("src/game/GameContracts.js").GameObjectContract}} options
   * @param {import("src/game/GameContracts.js").GameObjectContract} options.object
   */
  static #isHeroDefinition({ object }) {
    return object === Hero.name;
  }

  /**
   *
   * @param {typeof import("./ui/GamePanelHud.js").GamePanelHud} HudClass
   */
  #getHud(HudClass) {
    return this.getHud(HudClass);
  }

  #getViewRotation() {
    return this.#camera.rotation;
  }

  #getViewDirection() {
    const state = this.#camera.firstPersonState;

    return state ? {
      ...state.direction,
      right: state.right,
    } : null;
  }

  #onMovementInput() {
    return this.#startHeroCameraReturn();
  }

  #getMoodScreenPosition() {
    return this.#heroPatScreenPosition(0.12);
  }

  #getInventoryFullScreenPosition() {
    return this.#inventoryFullIndicatorScreenPosition();
  }

  #getViewRotation2() {
    return this.#camera.rotation;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraPointer} event
   */
  #hitTest(event) {
    return this.#isHeroPatHit(event);
  }

  #getRotation() {
    return this.#camera.rotation;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").InteractionProvider} options
   * @param {import("src/game/GameContracts.js").InteractionProvider["findInteraction"]} options.findInteraction
   */
  static #filter2({ findInteraction }) {
    return findInteraction;
  }

  /**
   *
   * @param {string} type
   * @param {number} amount
   */
  #onCollectCoin(type, amount) {
    return this.#sceneObjects
      .getOne(SCENE_OBJECT_TYPE.HERO)
      ?.collectCoin(type, amount);
  }

  #onInteractionChange2() {
    return this.#updateInteractionTarget();
  }

  /**
   *
   * @param {pc.Vec3} position
   * @param {number} radius
   * @param {number|null} [fillDepth] Filled soil height relative to the cube top.
   * @param {Array<Array<number>>|null} [outline] Authored XZ surface perimeter.
   */
  #onTerrainExcavated(position, radius, fillDepth = null, outline = null) {
    return this.#sceneObjects.getAll(SCENE_OBJECT_TYPE.MAP_OBJECT).forEach(
      /**
           * @param {import("src/game/GameContracts.js").GameObjectContract} object
           */
      (object) => object.onTerrainExcavated?.(position, radius, fillDepth, outline));
  }

  /**
   *
   * @param {playCanvas.RaycastResult} hit
   */
  static #findHit(hit) {
    return hit.normal?.y >= 0.35;
  }

  /**
   *
   * @param {pc.Entity} root
   */
  static #mapRoot2(root) {
    return {
      name: `map-object-${root.name}`,
      protectAtPanLimit: true,
      centerReachableAtEveryZoom: true,
      root,
    };
  }
}

// Native Ammo state cannot survive Vue hot replacement of the game scene.
// Reload at this boundary when the renderer or its game dependencies change.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
