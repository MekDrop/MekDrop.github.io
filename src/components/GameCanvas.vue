<template>
  <div
    ref="container"
    class="background-canvas fit"
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
    <Transition name="interaction-prompt">
      <div
        v-if="interactionTarget"
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
import { getCssVar } from "quasar";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import SiteNoticeDialog from "components/SiteNoticeDialog.vue";
import { generateMap } from "src/game/MapGenerator.js";
import { PlayCanvasRenderer } from "src/game/PlayCanvasRenderer.js";
import { GameControls } from "src/game/GameControls.js";
import { CloseModalAction } from "src/actions/CloseModalAction.js";
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
import { DEFAULT_CONTROLS } from "src/game/config/controls.js";
import { InteractionSuggestion } from "src/game/interaction/InteractionSuggestion.js";
import { useDebugStore } from "src/stores/debug-store.js";
import { useGraphicsSettingsStore } from "src/stores/graphics-settings-store.js";
import { useGameViewStore } from "src/stores/game-view-store.js";
import { useHeroConfigurationStore } from "src/stores/hero-configuration-store.js";

const container = ref(null);
const canvas = ref(null);
const gameReady = ref(false);
const graphicsBackend = ref("initializing");
const showGraphicsFallbackDialog = ref(false);
const debugFramesPerSecond = ref(0);
const interactionTarget = ref(null);
const heroLives = ref(3);
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
const interactionLabel = computed(() =>
  interactionTarget.value?.labelKey
    ? t(interactionTarget.value.labelKey)
    : "",
);
let renderer = null;
let mapData = null;
let controls = null;
let resizeObserver = null;
let debugStatsTimer = null;
let stopMapRouteWatch = null;
let restartGameAction = null;
let mapFileLoader = null;
let mapNavigationId = 0;
let mapRouteLoadPromise = Promise.resolve();
let interactionSuggestion = null;

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

function updateCurrentMap(generatedMap) {
  mapData = generatedMap;
  currentMapName.value = generatedMap.mapName;
  installMovementTestDriver();
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
  updateCurrentMap(generatedMap);

  if (!mapName) {
    await router.replace(mapRouteLocation(generatedMap.mapName));
  }
}

function installMovementTestDriver() {
  if (!mapFileLoader) {
    delete window.gameMovementTest;
    return;
  }
  window.gameMovementTest = {
    async loadScenario(scenario) {
      const mapName = scenario.startsWith("test_")
        ? scenario
        : `test_${scenario}`;
      const reloadCurrentRoute =
        route.name === "map" && route.params.mapName === mapName;
      await router.push(mapRouteLocation(mapName));
      await nextTick();
      if (reloadCurrentRoute) {
        mapRouteLoadPromise = loadMapRoute(mapName);
      }
      await mapRouteLoadPromise;
      return renderer.heroState;
    },
    moveForward(active = true) {
      renderer.setHeroMovement(0, active ? -1 : 0);
    },
    move(inputX, inputY, running = false) {
      renderer.setHeroMovement(inputX, inputY, running);
    },
    jump() {
      renderer.jumpHero();
    },
    dodge(inputX, inputY, direction = "forward") {
      return renderer.dodgeHero(inputX, inputY, direction);
    },
    interact() {
      return renderer.interact();
    },
    droppedInventoryItemCount() {
      return renderer.thrownInventoryItemCount;
    },
    inventoryFullReactionVisible() {
      return renderer.inventoryFullReactionVisible;
    },
    state() {
      return renderer.heroState;
    },
  };
}

function installCameraTestDriver() {
  if (!cameraTestRequested()) {
    return;
  }
  window.gameCameraTest = {
    setZoom(zoom) {
      renderer.setViewport({ zoom: 1 });
      renderer.zoomTo(
        zoom,
        container.value.clientWidth / 2,
        container.value.clientHeight / 2,
      );
      return this.state();
    },
    setRotation(rotation) {
      renderer.setViewport({
        ...renderer.viewport,
        rotation,
      });
      return this.state();
    },
    moveHero(inputX, inputY, running = false) {
      return renderer.setHeroMovement(inputX, inputY, running);
    },
    returnToHero() {
      return renderer.returnCameraToHero();
    },
    state() {
      return {
        cameraReturningToHero: renderer.cameraReturningToHero,
        hero: renderer.heroState,
        viewport: renderer.viewport,
        visibility: renderer.mapVisibility,
      };
    },
  };
}

function updateDebugStats() {
  debugFramesPerSecond.value = renderer?.framesPerSecond ?? 0;
}

async function init() {
  const bindings = DEFAULT_CONTROLS;
  interactionSuggestion = new InteractionSuggestion((target) => {
    interactionTarget.value = target;
  });

  renderer = new PlayCanvasRenderer(canvas.value, container.value, {
    onInteractionChange: (target) => {
      interactionSuggestion.update(target);
    },
    onHeroStateChange: (state) => {
      heroLives.value = state.lives;
      maxHeroLives.value = state.maxLives;
      gameOver.value = state.gameOver;
    },
    t,
    debugStore,
    gameViewStore,
    graphicsSettingsStore,
    heroConfigurationStore,
    uiTheme: gameUiTheme(),
  });
  await renderer.init();
  graphicsBackend.value = renderer.graphicsBackend;
  mapData = await createMap(requestedMapName());
  renderer.render(mapData);
  updateCurrentMap(mapData);
  if (!requestedMapName()) {
    await router.replace(mapRouteLocation(mapData.mapName));
  }
  installCameraTestDriver();
  updateDebugStats();

  const regenerateMapAction = new RegenerateMapAction(
    renderer,
    generateMap,
    (generatedMap) => {
      updateCurrentMap(generatedMap);
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
    bindings.zoom,
    bindings.zoom.factor,
  );
  const zoomOutAction = new ZoomAction(
    renderer,
    container.value,
    bindings.zoom,
    1 / bindings.zoom.factor,
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
  };

  controls = new GameControls(container.value, actions);
  controls.connect();

  resizeObserver = new ResizeObserver(() => renderer.resize());
  resizeObserver.observe(container.value);
  stopMapRouteWatch = watch(
    () => route.params.mapName,
    (mapName) => {
      if (mapName === mapData?.mapName) {
        return;
      }
      mapRouteLoadPromise = loadMapRoute(
        typeof mapName === "string" ? mapName : null,
      );
    },
  );
  debugStatsTimer = window.setInterval(() => {
    if (debugVisible.value) updateDebugStats();
  }, 100);
  showGraphicsFallbackDialog.value = graphicsBackend.value === "webgl2";
  gameReady.value = true;
}

onMounted(init);

onBeforeUnmount(() => {
  interactionSuggestion?.destroy();
  interactionSuggestion = null;
  if (typeof window !== "undefined") {
    delete window.gameMovementTest;
    delete window.gameCameraTest;
  }
  controls?.disconnect();
  stopMapRouteWatch?.();
  resizeObserver?.disconnect();
  if (debugStatsTimer !== null) window.clearInterval(debugStatsTimer);
  renderer?.destroy();
});
</script>
