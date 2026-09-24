<template>
  <div
    ref="container"
    class="background-canvas fit"
    :class="{ 'background-canvas--recording': recordingState === GAME_RECORDING_STATE.RECORDING }"
    :data-recording-state="recordingState"
    :data-game-ready="gameReady"
    :data-graphics-backend="graphicsBackend"
    :data-game-fps="debugVisible ? debugFramesPerSecond : undefined"
    :data-debug-visible="debugVisible"
    :data-map-name="currentMapName"
    :data-map-signature="currentMapSignature"
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
    <span class="q-sr-only" role="status" aria-live="polite">
      {{ recordingState === GAME_RECORDING_STATE.RECORDING ? t("game.recording.active") : "" }}
    </span>
    <hero-mood-status :mood="heroMood" />
    <Transition name="interaction-prompt">
      <div
        v-if="interactionTarget && interactionPromptsVisible"
        class="interaction-prompt"
        role="status"
        aria-live="polite"
      >
        <kbd>E</kbd>
        <span>{{ interactionLabel }}</span>
        <span
          v-if="interactionTarget.showHealth"
          class="interaction-prompt__health"
          aria-hidden="true"
        >
          <i
            v-for="hitPoint in interactionTarget.maxHealth"
            :key="hitPoint"
            :class="{
              'interaction-prompt__pip--lost':
                hitPoint > interactionTarget.health,
            }"
          />
        </span>
      </div>
    </Transition>
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

.background-canvas--recording::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 20;
  box-shadow: inset 0 0 0 3px var(--q-negative);
  animation: recording-border-pulse 1.8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes recording-border-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .background-canvas--recording::after {
    animation: none;
  }
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

.interaction-prompt {
  position: absolute;
  left: 50%;
  bottom: clamp(var(--app-ui-space-lg), 8vh, calc(var(--app-ui-space-xl) * 2));
  display: flex;
  align-items: center;
  gap: var(--app-ui-space-sm);
  padding: var(--app-ui-space-sm) var(--app-ui-space-md);
  color: #f7fff6;
  font: 700 13px/1.2 var(--app-ui-font-family);
  letter-spacing: 0.025em;
  background: rgba(6, 18, 13, 0.86);
  border: 1px solid rgba(184, 236, 195, 0.42);
  border-radius: var(--app-ui-border-radius);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
  transform: translateX(-50%);
  pointer-events: none;
  backdrop-filter: blur(5px);
}

.interaction-prompt kbd {
  min-width: 25px;
  padding: var(--app-ui-space-xs) var(--app-ui-space-sm);
  color: #17331f;
  text-align: center;
  background: #d9f6d8;
  border: 0;
  border-radius: var(--app-ui-border-radius);
  box-shadow: 0 2px 0 #79a77e;
}

.interaction-prompt__health {
  display: flex;
  gap: var(--app-ui-space-xs);
  margin-left: var(--app-ui-space-xs);
}

.interaction-prompt__health i {
  width: 7px;
  height: 13px;
  background: #80d27d;
  border-radius: var(--app-ui-border-radius);
  transition:
    background 160ms ease,
    opacity 160ms ease;
}

.interaction-prompt__health .interaction-prompt__pip--lost {
  background: #667069;
  opacity: 0.45;
}

.interaction-prompt-enter-active,
.interaction-prompt-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.interaction-prompt-enter-from,
.interaction-prompt-leave-to {
  opacity: 0;
  transform: translate(-50%, 7px);
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
import { getCssVar } from "quasar";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import SiteNoticeDialog from "components/SiteNoticeDialog.vue";
import HeroMoodStatus from "components/HeroMoodStatus.vue";
import { generateMap } from "src/game/MapGenerator.js";
import { PlayCanvasRenderer } from "src/game/PlayCanvasRenderer.js";
import { GameControls } from "src/game/GameControls.js";
import { createGameCommandRegistry } from "src/game/commands/index.js";
import { CloseModalAction } from "src/actions/CloseModalAction.js";
import { GAME_RECORDING_STATE } from "src/game/enum/GameRecordingState.js";
import { CopyScreenshotAction } from "src/game/actions/CopyScreenshotAction.js";
import { HeroDirectionAction } from "src/game/actions/HeroDirectionAction.js";
import { HeroJumpAction } from "src/game/actions/HeroJumpAction.js";
import { HeroMovementAction } from "src/game/actions/HeroMovementAction.js";
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
import { InteractionSuggestion } from "src/game/interaction/InteractionSuggestion.js";
import {
  GameCanvasDebugUiPlugin,
  GameCanvasPluginRegistry,
  GameCanvasRecordingPlugin,
} from "src/game/plugins/game-canvas/index.js";
import { reportGlobalException } from "src/boot/runtime-errors.js";
import { useDebugStore } from "src/stores/debug-store.js";
import { useGraphicsSettingsStore } from "src/stores/graphics-settings-store.js";
import { useGameViewStore } from "src/stores/game-view-store.js";
import { useHeroConfigurationStore } from "src/stores/hero-configuration-store.js";

const container = ref(null);
const canvas = ref(null);
const gameReady = ref(false);
const recordingState = ref(GAME_RECORDING_STATE.IDLE);
const graphicsBackend = ref("initializing");
const showGraphicsFallbackDialog = ref(false);
const interactionTarget = ref(null);
const interactionPromptsVisible = ref(true);
const heroLives = ref(3);
const heroMood = ref(null);
const maxHeroLives = ref(3);
const gameOver = ref(false);
const currentMapName = ref("");
const currentMapSignature = computed(() => currentMapName.value);
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const graphicsSettingsStore = useGraphicsSettingsStore();
const debugStore = useDebugStore();
const gameViewStore = useGameViewStore();
const heroConfigurationStore = useHeroConfigurationStore();
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
let movementTestDriverPluginLoaded = false;
let stopRecordingStateWatch = null;
const pluginControlActions = {};
const pluginControlKeyboard = {
  keydownActions: [],
  keyupActions: [],
  keydownConsumeBindings: [],
};
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
  setMapRouteLoadPromise: (promise) => {
    mapRouteLoadPromise = promise;
  },
  registerControlAction,
  debugStore,
  uiTheme: gameUiTheme,
});
const { stop: stopResizeObserver } = useResizeObserver(container, () => {
  renderer?.resize();
  gameCanvasPluginRegistry.resize();
});

function reportRuntimeError(error) {
  reportGlobalException(error, { context: "Game" });
}

function addPluginControlEntry(listName, entry) {
  if (!pluginControlKeyboard[listName].includes(entry)) {
    pluginControlKeyboard[listName].push(entry);
  }
}

function removePluginControlEntry(listName, entry) {
  pluginControlKeyboard[listName] = pluginControlKeyboard[listName].filter(
    (registeredEntry) => registeredEntry !== entry,
  );
}

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

function gameUiTheme() {
  const styles = window.getComputedStyle(document.documentElement);
  return {
    primary: getCssVar("primary"),
    secondary: getCssVar("secondary"),
    accent: getCssVar("accent"),
    positive: getCssVar("positive"),
    negative: getCssVar("negative"),
    info: getCssVar("info"),
    warning: getCssVar("warning"),
    dark: getCssVar("dark"),
    darkPage: getCssVar("dark-page"),
    fontFamily: styles.getPropertyValue("--app-ui-font-family").trim(),
    borderRadius: styles.getPropertyValue("--app-ui-border-radius").trim(),
    spaceXs: styles.getPropertyValue("--app-ui-space-xs").trim(),
    spaceSm: styles.getPropertyValue("--app-ui-space-sm").trim(),
    spaceMd: styles.getPropertyValue("--app-ui-space-md").trim(),
    spaceLg: styles.getPropertyValue("--app-ui-space-lg").trim(),
    spaceXl: styles.getPropertyValue("--app-ui-space-xl").trim(),
  };
}

function cameraTestRequested() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).has("camera-test");
}

function requestedMapName() {
  return typeof route.params.mapName === "string"
    ? route.params.mapName
    : null;
}

async function createMap(mapName = null) {
  if (!import.meta.env.DEV || !mapName?.startsWith("test_")) {
    mapFileLoader = null;
    return generateMap(mapName ? { mapName } : undefined);
  }
  const { MapFileLoader } = await import("src/game/MapFileLoader.js");
  mapFileLoader = MapFileLoader;
  return MapFileLoader.load(mapName);
}

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

async function updateMovementTestDriverPlugin() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return;
  }
  if (!mapFileLoader && !movementTestDriverPluginLoaded) {
    return;
  }

  const { GameCanvasMovementTestDriverPlugin } = await import(
    "src/game/plugins/game-canvas/GameCanvasMovementTestDriverPlugin.js"
  );
  if (!mapFileLoader) {
    gameCanvasPluginRegistry.unload(GameCanvasMovementTestDriverPlugin);
    movementTestDriverPluginLoaded = false;
    return;
  }

  gameCanvasPluginRegistry.load(GameCanvasMovementTestDriverPlugin);
  movementTestDriverPluginLoaded = true;
}

async function updateCameraTestDriverPlugin() {
  if (!cameraTestRequested()) {
    return;
  }

  const { GameCanvasCameraTestDriverPlugin } = await import(
    "src/game/plugins/game-canvas/GameCanvasCameraTestDriverPlugin.js"
  );
  gameCanvasPluginRegistry.load(GameCanvasCameraTestDriverPlugin);
}

async function updateCurrentMap(generatedMap) {
  mapData = generatedMap;
  currentMapName.value = generatedMap.mapName;
  interactionPromptsVisible.value =
    !generatedMap.heroAnimationPreview &&
    !generatedMap.heroPickupItemPreview &&
    !generatedMap.royalAnimationPreview;
  await updateMovementTestDriverPlugin();
}

async function loadMapRoute(mapName) {
  const navigationId = ++mapNavigationId;
  const generatedMap = await createMap(mapName);
  if (navigationId !== mapNavigationId || !renderer) {
    return;
  }

  const viewport = renderer.viewport;
  renderer.render(generatedMap);
  renderer.setViewport(viewport);
  await updateCurrentMap(generatedMap);

  if (!mapName) {
    await router.replace(mapRouteLocation(generatedMap.mapName));
  }
}

async function init() {
  const bindings = DEFAULT_CONTROLS;
  const zoomSettings = import.meta.env.DEV
    ? { ...bindings.zoom, max: DEVELOPMENT_MAX_ZOOM }
    : bindings.zoom;
  interactionSuggestion = new InteractionSuggestion((target) => {
    interactionTarget.value = target;
  });

  const activeRenderer = new PlayCanvasRenderer(canvas.value, container.value, {
    onRuntimeError: reportRuntimeError,
    onInteractionChange: (target) => {
      interactionSuggestion?.update(target);
    },
    onHeroStateChange: (state) => {
      heroLives.value = state.lives;
      maxHeroLives.value = state.maxLives;
      gameOver.value = state.gameOver;
    },
    onHeroMoodChange: (mood) => {
      heroMood.value = mood;
    },
    t,
    debugStore,
    gameViewStore,
    graphicsSettingsStore,
    heroConfigurationStore,
    uiTheme: gameUiTheme(),
    enableDevWireframeInspector: import.meta.env.DEV,
  });
  renderer = activeRenderer;
  await activeRenderer.init();
  if (renderer !== activeRenderer) {
    return;
  }
  graphicsBackend.value = activeRenderer.graphicsBackend;
  mapData = await createMap(requestedMapName());
  if (renderer !== activeRenderer) {
    return;
  }
  activeRenderer.render(mapData);
  await updateCurrentMap(mapData);
  if (!requestedMapName()) {
    await router.replace(mapRouteLocation(mapData.mapName));
  }
  if (renderer !== activeRenderer) {
    return;
  }
  await updateCameraTestDriverPlugin();
  gameCanvasPluginRegistry.load(GameCanvasDebugUiPlugin);
  const recordingPlugin = gameCanvasPluginRegistry.load(
    GameCanvasRecordingPlugin,
  );
  stopRecordingStateWatch = recordingPlugin.onStateChange((state) => {
    recordingState.value = state;
  });

  const regenerateMapAction = new RegenerateMapAction(
    renderer,
    generateMap,
    (generatedMap) => {
      void updateCurrentMap(generatedMap).catch(reportRuntimeError);
      void router.push(mapRouteLocation(generatedMap.mapName));
    },
  );
  restartGameAction = new RestartGameAction(renderer, regenerateMapAction);
  const heroMovementAction = new HeroMovementAction(renderer);
  const toggleInventoryAction = new ToggleInventoryAction(
    renderer,
    heroMovementAction,
  );
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
  const actions = {
    zoomIn: zoomInAction,
    zoomOut: zoomOutAction,
    moveCamera: new MoveCameraAction(renderer, bindings.move),
    regenerateMap: regenerateMapAction,
    restartGame: restartGameAction,
    heroMovement: heroMovementAction,
    run: heroMovementAction,
    moveUp: new HeroDirectionAction(
      heroMovementAction,
      "up",
      bindings.dodge.doubleTapWindow,
    ),
    moveDown: new HeroDirectionAction(
      heroMovementAction,
      "down",
      bindings.dodge.doubleTapWindow,
    ),
    moveLeft: new HeroDirectionAction(
      heroMovementAction,
      "left",
      bindings.dodge.doubleTapWindow,
    ),
    moveRight: new HeroDirectionAction(
      heroMovementAction,
      "right",
      bindings.dodge.doubleTapWindow,
    ),
    jump: new HeroJumpAction(heroMovementAction),
    interact: new InteractionAction(renderer),
    toggleInventory: toggleInventoryAction,
    closeModal: new CloseModalAction([toggleInventoryAction]),
    rotateView: rotateViewAction,
    rotateAnticlockwise: rotateViewAction,
    copyScreenshot: new CopyScreenshotAction(renderer),
    toggleArrows: new ToggleArrowsAction(
      debugStore,
      undefined,
      () => !renderer.inventoryVisible,
    ),
    ...pluginControlActions,
  };

  controls = new GameControls(container.value, actions, pluginControlKeyboard);
  controls.connect();

  stopMapRouteWatch = watch(
    () => route.params.mapName,
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
}

onMounted(() => {
  void init().catch(reportRuntimeError);
});

onBeforeUnmount(() => {
  mapNavigationId += 1;
  gameReady.value = false;
  stopRecordingStateWatch?.();
  stopRecordingStateWatch = null;
  gameCanvasPluginRegistry.destroy();
  movementTestDriverPluginLoaded = false;
  gameCommandRegistry?.destroy();
  gameCommandRegistry = null;
  controls?.disconnect();
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
