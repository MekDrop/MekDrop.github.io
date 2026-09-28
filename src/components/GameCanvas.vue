<template>
  <div
    ref="container"
    class="background-canvas fit"
    :data-game-ready="gameReady && !isLoading"
    :data-graphics-backend="graphicsBackend"
    :data-game-fps="debugVisible ? debugFramesPerSecond : undefined"
    :data-debug-visible="debugVisible"
    :data-map-name="currentMapName"
    :data-map-signature="currentMapSignature"
    :data-game-loading="isLoading"
    :aria-busy="isLoading"
    @contextmenu.prevent
  >
    <site-notice-dialog
      v-model="showGraphicsFallbackDialog"
      icon="fas fa-microchip"
      :message="t('game.graphics.webgl_fallback')"
    />
    <canvas
      ref="canvas"
      class="background-canvas__surface"
      :aria-label="
        gameOver
          ? `${t('game.game_over')}. ${t('game.restart_prompt')}`
          : t('game.lives_remaining', {
              current: heroLives,
              total: maxHeroLives,
            })
      "
    />
    <game-loading-scene :active="isLoading" :phase="loadingPhase" />
    <div
      v-if="firstPersonCameraEnabled"
      class="first-person-camera-status q-sr-only"
      role="status"
      aria-live="polite"
    >
      First-person camera — mouse look, click to pet, WASD/arrows move, Esc releases
    </div>
    <hero-mood-status :mood="heroMood" />
    <div
      v-if="!isLoading && interactionTarget && interactionPromptsVisible"
      class="interaction-prompt q-sr-only"
      role="status"
      aria-live="polite"
    >
      E {{ interactionLabel }}
    </div>
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

.background-canvas__surface {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.background-canvas--dragging .background-canvas__surface {
  cursor: grabbing;
}

html.game-viewport--dragging,
html.game-viewport--dragging * {
  cursor: grabbing !important;
}
</style>

<script setup>
import {
  computed,
  nextTick,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useResizeObserver } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import SiteNoticeDialog from "components/SiteNoticeDialog.vue";
import GameLoadingScene from "components/GameLoadingScene.vue";
import HeroMoodStatus from "components/HeroMoodStatus.vue";
import { generateMap } from "src/game/generator/map/MapGenerator.js";
import { PlayCanvasRenderer } from "src/game/PlayCanvasRenderer.js";
import { GameControls } from "src/game/GameControls.js";
import { createGameCommandRegistry } from "src/game/commands/index.js";
import { CloseModalAction } from "src/actions/CloseModalAction.js";
import { CameraPointerAction } from "src/game/actions/CameraPointerAction.js";
import { FirstPersonCameraAction } from "src/game/actions/FirstPersonCameraAction.js";
import { HeroDirectionAction } from "src/game/actions/HeroDirectionAction.js";
import { HeroJumpAction } from "src/game/actions/HeroJumpAction.js";
import { HeroMovementAction } from "src/game/actions/HeroMovementAction.js";
import { HeroPatAction } from "src/game/actions/HeroPatAction.js";
import { MoveCameraAction } from "src/game/actions/MoveCameraAction.js";
import { RegenerateMapAction } from "src/game/actions/RegenerateMapAction.js";
import { RestartGameAction } from "src/game/actions/RestartGameAction.js";
import { RotateViewAction } from "src/game/actions/RotateViewAction.js";
import { ToggleArrowsAction } from "src/game/actions/ToggleArrowsAction.js";
import { ToggleInventoryAction } from "src/game/actions/ToggleInventoryAction.js";
import { InteractionAction } from "src/game/actions/InteractionAction.js";
import { ZoomAction } from "src/game/actions/ZoomAction.js";
import {
  DEFAULT_CONTROLS,
  DEVELOPMENT_MAX_ZOOM,
} from "src/game/config/controls.js";
import { loadGameCanvasPluginConfig } from "src/game/config/game-canvas-plugins/index.js";
import { InteractionSuggestion } from "src/game/interaction/InteractionSuggestion.js";
import { GameCanvasPluginRegistry } from "src/game/plugins/game-canvas/index.js";
import { reportGlobalException } from "src/boot/runtime-errors.js";
import { useDebugStore } from "src/stores/debug-store.js";
import { useGraphicsSettingsStore } from "src/stores/graphics-settings-store.js";
import { useGameViewStore } from "src/stores/game-view-store.js";
import { useHeroConfigurationStore } from "src/stores/hero-configuration-store.js";
import { useHeroStateStore } from "src/stores/hero-state-store.js";

/**
 * @typedef {Error|string|{message?: string}|null|undefined} RuntimeErrorInput
 */

/**
 * @typedef {{invoke: (event?: Event) => boolean|void}} ControlAction
 */

/**
 * @typedef {string|{binding: string, action: ControlAction}} PluginControlEntry
 */

/**
 * @typedef {{object: string}} GeneratedMapObject
 */

/**
 * @typedef {{mapName: string, objects?: GeneratedMapObject[]}} GeneratedMap
 */

/**
 * @typedef {{labelKey?: string, label?: string, showHealth?: boolean, health?: number, maxHealth?: number}} InteractionTarget
 */

const container = ref(null);
const canvas = ref(null);
const gameReady = ref(false);
const loadingPhase = ref("initializing");
const isLoading = ref(true);
const graphicsBackend = ref("initializing");
const showGraphicsFallbackDialog = ref(false);
const interactionTarget = ref(null);
const interactionPromptsVisible = ref(true);
const firstPersonCameraEnabled = ref(false);
const currentMapName = ref("");
const currentMapSignature = computed(() => currentMapName.value);
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const graphicsSettingsStore = useGraphicsSettingsStore();
const debugStore = useDebugStore();
const gameViewStore = useGameViewStore();
const heroConfigurationStore = useHeroConfigurationStore();
const heroStateStore = useHeroStateStore();
const {
  lives: heroLives,
  maxLives: maxHeroLives,
  gameOver,
  mood: heroMood,
} = storeToRefs(heroStateStore);
const debugVisible = computed(() => debugStore.hasAny);
const debugFramesPerSecond = computed(() => debugStore.framesPerSecond);
const interactionLabel = computed(() =>
  interactionTarget.value?.labelKey
    ? t(interactionTarget.value.labelKey)
    : "",
);
let renderer = null;
let mapData = null;
let controls = null;
let stopMapRouteWatch = null;
let restartGameAction = null;
let mapFileLoader = null;
let mapNavigationId = 0;
let mapRouteLoadPromise = Promise.resolve();
let interactionSuggestion = null;
let gameCommandRegistry = null;
let loadingOperationId = 0;
let controlsConnected = false;
const pluginControlActions = {};
const pluginControlKeyboard = {
  keydownActions: [],
  keyupActions: [],
  keydownConsumeBindings: [],
};

function syncInteractionHud() {
  renderer?.setInteractionPrompt(
    interactionTarget.value,
    !isLoading.value && interactionPromptsVisible.value,
  );
}
const gameCanvasPluginRegistry = new GameCanvasPluginRegistry({
  target: globalThis,
  container: () => container.value,
  renderer: () => renderer,
  route: () => route,
  router,
  nextTick,
  mapRouteLocation,
  loadMapRoute,
  mapRouteLoadPromise: () => mapRouteLoadPromise,
  /**
   *
   * @param {Promise<void>} promise
   */
  setMapRouteLoadPromise: (promise) => {
    mapRouteLoadPromise = promise;
  },
  registerControlAction,
  debugStore,
});
const { stop: stopResizeObserver } = useResizeObserver(container, () => {
  renderer?.resize();
  gameCanvasPluginRegistry.resize();
});

/**
 *
 * @param {RuntimeErrorInput} error
 */
function reportRuntimeError(error) {
  reportGlobalException(error, { context: "Game" });
}

/**
 *
 * @param {string} listName
 * @param {PluginControlEntry} entry
 */
function addPluginControlEntry(listName, entry) {
  if (!pluginControlKeyboard[listName].includes(entry)) {
    pluginControlKeyboard[listName].push(entry);
  }
}

/**
 *
 * @param {string} listName
 * @param {PluginControlEntry} entry
 */
function removePluginControlEntry(listName, entry) {
  pluginControlKeyboard[listName] = pluginControlKeyboard[listName].filter(
    /**
     *
     * @param {PluginControlEntry} registeredEntry
     */
    (registeredEntry) => registeredEntry !== entry,
  );
}

/**
 *
 * @param {string} name
 * @param {ControlAction} action
 * @param {{binding?: string, keydown?: boolean, keyup?: boolean, consumeKeydown?: boolean}} options
 * @param {string} options.binding
 * @param {boolean} options.keydown
 * @param {boolean} options.keyup
 * @param {boolean} options.consumeKeydown
 */
function registerControlAction(
  name,
  action,
  { binding, keydown = false, keyup = false, consumeKeydown = false } = {},
) {
  pluginControlActions[name] = action;
  const entry = { binding, action };
  if (keydown) {
    addPluginControlEntry("keydownActions", entry);
  }
  if (keyup) {
    addPluginControlEntry("keyupActions", entry);
  }
  if (consumeKeydown) {
    addPluginControlEntry("keydownConsumeBindings", binding);
  }
  return () => {
    if (pluginControlActions[name] === action) {
      delete pluginControlActions[name];
    }
    removePluginControlEntry("keydownActions", entry);
    removePluginControlEntry("keyupActions", entry);
    removePluginControlEntry("keydownConsumeBindings", binding);
  };
}

function requestedMapName() {
  return typeof route.params.mapName === "string"
    ? route.params.mapName
    : null;
}

/**
 *
 * @param {string} mapName
 */
async function createMap(mapName = null) {
  if (!import.meta.env.DEV || !mapName?.startsWith("test_")) {
    mapFileLoader = null;
    return generateMap(mapName ? { mapName } : undefined);
  }
  const { MapFileLoader } = await import("src/game/MapFileLoader.js");
  mapFileLoader = MapFileLoader;
  return MapFileLoader.load(mapName);
}

/**
 *
 * @param {string} mapName
 */
function mapRouteLocation(mapName) {
  const params = { mapName };
  if (route.params.lang) {
    params.lang = route.params.lang;
  }
  return {
    name: "map",
    params,
    query: route.query,
    hash: route.hash,
  };
}

/**
 *
 * @param {GeneratedMap} generatedMap
 */
async function updateCurrentMap(generatedMap) {
  mapData = generatedMap;
  currentMapName.value = generatedMap.mapName;
  interactionPromptsVisible.value = !generatedMap.objects?.some(
    /**
     *
     * @param {GeneratedMapObject} options
     * @param {string} options.object
     */
    ({ object }) => object === "Hero",
  );
  syncInteractionHud();
  gameCanvasPluginRegistry.setState({
    testMapLoaded: mapFileLoader !== null,
  });
  await gameCanvasPluginRegistry.refresh();
}

/**
 *
 * @param {GeneratedMap} mapDataToRender
 */
function renderMap(mapDataToRender) {
  gameCanvasPluginRegistry.beforeRender();
  renderer.render(mapDataToRender);
  gameCanvasPluginRegistry.afterRender(mapDataToRender);
}

function connectControls() {
  if (!controls || controlsConnected || isLoading.value) {
    return;
  }
  controls.connect();
  controlsConnected = true;
}

function disconnectControls() {
  if (!controls || !controlsConnected) {
    return;
  }
  controls.disconnect();
  controlsConnected = false;
}

function waitForAnimationFrame() {
  return new Promise(/**
   *
   * @param {(value?: void|PromiseLike<void>) => void} resolve
   */
  (resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 *
 * @param {string} phase
 * @param {number} operationId
 */
async function showLoadingPhase(phase, operationId = null) {
  const nextOperationId = operationId ?? ++loadingOperationId;
  if (operationId !== null && operationId !== loadingOperationId) {
    return nextOperationId;
  }
  loadingPhase.value = phase;
  isLoading.value = true;
  interactionTarget.value = null;
  renderer?.setInteractionPrompt(null);
  disconnectControls();
  await nextTick();
  await waitForAnimationFrame();
  return nextOperationId;
}

/**
 *
 * @param {number} operationId
 */
function finishLoading(operationId) {
  if (operationId !== loadingOperationId) {
    return;
  }
  isLoading.value = false;
  if (gameReady.value) {
    connectControls();
  }
}

/**
 *
 * @param {string} mapName
 */
async function loadMapRoute(mapName) {
  const navigationId = ++mapNavigationId;
  const operationId = await showLoadingPhase("generating");
  try {
    if (navigationId !== mapNavigationId || !renderer) {
      return;
    }
    const generatedMap = await createMap(mapName);
    if (navigationId !== mapNavigationId || !renderer) {
      return;
    }

    await showLoadingPhase("rendering", operationId);
    if (navigationId !== mapNavigationId || !renderer) {
      return;
    }
    const viewport = renderer.viewport;
    renderMap(generatedMap);
    renderer.setViewport(viewport);
    await updateCurrentMap(generatedMap);

    if (!mapName) {
      await router.replace(mapRouteLocation(generatedMap.mapName));
    }
  } finally {
    finishLoading(operationId);
  }
}

async function init() {
  const loadingId = await showLoadingPhase("initializing");
  try {
    gameCanvasPluginRegistry.configure(
      await loadGameCanvasPluginConfig({
        development: import.meta.env.DEV,
        translate: t,
      }),
    );
    const bindings = DEFAULT_CONTROLS;
    const zoomSettings = import.meta.env.DEV
      ? { ...bindings.zoom, max: DEVELOPMENT_MAX_ZOOM }
      : bindings.zoom;
    interactionSuggestion = new InteractionSuggestion(/**
     *
     * @param {InteractionTarget|null} target
     */
    (target) => {
      interactionTarget.value = target;
      syncInteractionHud();
    });

  const activeRenderer = new PlayCanvasRenderer(canvas.value, container.value, {
    onRuntimeError: reportRuntimeError,
    /**
     *
     * @param {InteractionTarget|null} target
     */
    onInteractionChange: (target) => {
      interactionSuggestion?.update(target);
    },
    t,
    debugStore,
    gameViewStore,
    graphicsSettingsStore,
    heroConfigurationStore,
    heroStateStore,
  });
  renderer = activeRenderer;
  await activeRenderer.init();
  if (renderer !== activeRenderer) {
    return;
  }
  await gameCanvasPluginRegistry.refresh();
  graphicsBackend.value = activeRenderer.graphicsBackend;
  await showLoadingPhase("generating", loadingId);
  mapData = await createMap(requestedMapName());
  if (renderer !== activeRenderer) {
    return;
  }
  await showLoadingPhase("rendering", loadingId);
  renderMap(mapData);
  await updateCurrentMap(mapData);
  if (!requestedMapName()) {
    await router.replace(mapRouteLocation(mapData.mapName));
  }
  if (renderer !== activeRenderer) {
    return;
  }
  const regenerateMapAction = new RegenerateMapAction(renderer, generateMap, {
    beforeGeneration: () => showLoadingPhase("generating"),
    /**
     *
     * @param {GeneratedMap} _generatedMap
     * @param {number} operationId
     */
    beforeRender: async (_generatedMap, operationId) => {
      await showLoadingPhase("rendering", operationId);
      gameCanvasPluginRegistry.beforeRender();
    },
    /**
     *
     * @param {GeneratedMap} generatedMap
     */
    onGenerated: async (generatedMap) => {
      await updateCurrentMap(generatedMap);
      await router.push(mapRouteLocation(generatedMap.mapName));
    },
    onGenerationError: reportRuntimeError,
    /**
     *
     * @param {GeneratedMap} generatedMap
     */
    afterRender: (generatedMap) =>
      gameCanvasPluginRegistry.afterRender(generatedMap),
    onComplete: finishLoading,
    /**
     *
     * @param {Promise<void>} promise
     */
    onLifecycle: (promise) => {
      mapRouteLoadPromise = promise;
    },
  });
  restartGameAction = new RestartGameAction(renderer, regenerateMapAction);
  const heroMovementAction = new HeroMovementAction(renderer);
  const toggleInventoryAction = new ToggleInventoryAction(
    renderer,
    heroMovementAction,
  );
  const moveCameraAction = new MoveCameraAction(renderer, bindings.move);
  const heroDirectionActions = {
    up: new HeroDirectionAction(
      heroMovementAction,
      "up",
      bindings.dodge.doubleTapWindow,
    ),
    down: new HeroDirectionAction(
      heroMovementAction,
      "down",
      bindings.dodge.doubleTapWindow,
    ),
    left: new HeroDirectionAction(
      heroMovementAction,
      "left",
      bindings.dodge.doubleTapWindow,
    ),
    right: new HeroDirectionAction(
      heroMovementAction,
      "right",
      bindings.dodge.doubleTapWindow,
    ),
  };
  const rotateViewAction = new RotateViewAction(renderer);
  const zoomInAction = new ZoomAction(
    renderer,
    container.value,
    zoomSettings,
    zoomSettings.factor,
  );
  const zoomOutAction = new ZoomAction(
    renderer,
    container.value,
    zoomSettings,
    1 / zoomSettings.factor,
  );
  const patHeroAction = new HeroPatAction(renderer);
  const cameraPointerAction = new CameraPointerAction(
    renderer,
    container.value,
    patHeroAction,
    bindings.cameraPointer,
  );
  const actions = {
    zoomIn: zoomInAction,
    zoomOut: zoomOutAction,
    moveCamera: moveCameraAction,
    cameraPointer: cameraPointerAction,
    regenerateMap: regenerateMapAction,
    restartGame: restartGameAction,
    heroMovement: heroMovementAction,
    run: heroMovementAction,
    moveUp: heroDirectionActions.up,
    moveDown: heroDirectionActions.down,
    moveLeft: heroDirectionActions.left,
    moveRight: heroDirectionActions.right,
    jump: new HeroJumpAction(heroMovementAction),
    interact: new InteractionAction(renderer),
    toggleInventory: toggleInventoryAction,
    closeModal: new CloseModalAction([toggleInventoryAction]),
    rotateView: rotateViewAction,
    rotateAnticlockwise: rotateViewAction,
    toggleArrows: new ToggleArrowsAction(
      debugStore,
      undefined,
      () => !renderer.inventoryVisible,
    ),
    ...(import.meta.env.DEV
      ? {
          toggleFirstPersonCamera: new FirstPersonCameraAction(
            renderer,
            heroMovementAction,
            cameraPointerAction,
            /**
             *
             * @param {boolean} enabled
             */
            (enabled) => {
              firstPersonCameraEnabled.value = enabled;
            },
          ),
        }
      : {}),
    ...pluginControlActions,
  };

  controls = new GameControls(container.value, actions, pluginControlKeyboard);

  stopMapRouteWatch = watch(
    () => route.params.mapName,
    /**
     *
     * @param {string} mapName
     */
    (mapName) => {
      if (mapName === mapData?.mapName) {
        return;
      }
      mapRouteLoadPromise = loadMapRoute(
        typeof mapName === "string" ? mapName : null,
      );
      void mapRouteLoadPromise.catch(reportRuntimeError);
    },
  );
  showGraphicsFallbackDialog.value = graphicsBackend.value === "webgl2";
  gameCommandRegistry = createGameCommandRegistry({ target: window });
  gameCommandRegistry.install();
  gameReady.value = true;
  } finally {
    finishLoading(loadingId);
  }
}

onMounted(() => {
  mapRouteLoadPromise = init();
  void mapRouteLoadPromise.catch(reportRuntimeError);
});

onBeforeUnmount(() => {
  mapNavigationId += 1;
  gameReady.value = false;
  firstPersonCameraEnabled.value = false;
  gameCanvasPluginRegistry.destroy();
  gameCommandRegistry?.destroy();
  gameCommandRegistry = null;
  disconnectControls();
  stopMapRouteWatch?.();
  stopResizeObserver();
  const rendererToDestroy = renderer;
  renderer = null;
  try {
    rendererToDestroy?.destroy();
  } catch (error) {
    reportRuntimeError(error);
  }
  interactionSuggestion?.destroy();
  interactionSuggestion = null;
});
</script>
