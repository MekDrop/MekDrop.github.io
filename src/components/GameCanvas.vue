<template>
  <div
    ref="container"
    class="background-canvas fit"
    :data-game-ready="gameReady"
    :data-graphics-backend="graphicsBackend"
    :data-game-fps="debugVisible ? debugFramesPerSecond : undefined"
    :data-debug-visible="debugVisible"
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
  cursor: grab;
}

.background-canvas--dragging .background-canvas__surface {
  cursor: grabbing;
}

.interaction-prompt {
  position: absolute;
  left: 50%;
  bottom: clamp(28px, 8vh, 84px);
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  color: #f7fff6;
  font:
    700 13px/1.2 system-ui,
    sans-serif;
  letter-spacing: 0.025em;
  background: rgba(6, 18, 13, 0.86);
  border: 1px solid rgba(184, 236, 195, 0.42);
  border-radius: 10px;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
  transform: translateX(-50%);
  pointer-events: none;
  backdrop-filter: blur(5px);
}

.interaction-prompt kbd {
  min-width: 25px;
  padding: 4px 6px;
  color: #17331f;
  text-align: center;
  background: #d9f6d8;
  border: 0;
  border-radius: 5px;
  box-shadow: 0 2px 0 #79a77e;
}

.interaction-prompt__health {
  display: flex;
  gap: 3px;
  margin-left: 3px;
}

.interaction-prompt__health i {
  width: 7px;
  height: 13px;
  background: #80d27d;
  border-radius: 2px;
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
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { Notify } from "quasar";
import { useI18n } from "vue-i18n";
import SiteNoticeDialog from "components/SiteNoticeDialog.vue";
import { generateMap } from "src/game/MapGenerator.js";
import { PlayCanvasRenderer } from "src/game/PlayCanvasRenderer.js";
import { GameControls } from "src/game/GameControls.js";
import { CopyScreenshotAction } from "src/game/actions/CopyScreenshotAction.js";
import { HeroMovementAction } from "src/game/actions/HeroMovementAction.js";
import { MoveCameraAction } from "src/game/actions/MoveCameraAction.js";
import { RegenerateMapAction } from "src/game/actions/RegenerateMapAction.js";
import { RestartGameAction } from "src/game/actions/RestartGameAction.js";
import { RotateViewAction } from "src/game/actions/RotateViewAction.js";
import { ToggleArrowsAction } from "src/game/actions/ToggleArrowsAction.js";
import { InteractionAction } from "src/game/actions/InteractionAction.js";
import { ZoomAction } from "src/game/actions/ZoomAction.js";
import { DEFAULT_CONTROLS } from "src/game/config/controls.js";
import { useDebugStore } from "src/stores/debug-store.js";
import { useGraphicsSettingsStore } from "src/stores/graphics-settings-store.js";
import { useGameViewStore } from "src/stores/game-view-store.js";

const container = ref(null);
const canvas = ref(null);
const gameReady = ref(false);
const graphicsBackend = ref("initializing");
const showGraphicsFallbackDialog = ref(false);
const debugVisible = ref(false);
const debugFramesPerSecond = ref(0);
const interactionTarget = ref(null);
const heroLives = ref(3);
const maxHeroLives = ref(3);
const gameOver = ref(false);
const { t } = useI18n();
const graphicsStore = useGraphicsSettingsStore();
const debugStore = useDebugStore();
const gameViewStore = useGameViewStore();
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
let stopGraphicsWatch = null;
let restartGameAction = null;
let movementTestMapFactory = null;
let viewportSaveTimer = null;
let viewportPersistenceEnabled = false;

function saveViewport() {
  viewportSaveTimer = null;
  if (renderer) {
    gameViewStore.updateViewport(renderer.viewport);
  }
}

function scheduleViewportSave() {
  if (!viewportPersistenceEnabled) {
    return;
  }
  if (viewportSaveTimer !== null) {
    window.clearTimeout(viewportSaveTimer);
  }
  viewportSaveTimer = window.setTimeout(saveViewport, 150);
}

function cameraTestRequested() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).has("camera-test");
}

function requestedMovementTestScenario() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("movement-test");
}

async function createInitialMap() {
  const scenario = requestedMovementTestScenario();
  if (!scenario) {
    return generateMap();
  }
  const { MovementTestMap } = await import(
    "src/game/testing/MovementTestMap.js"
  );
  movementTestMapFactory = MovementTestMap;
  return MovementTestMap.create(scenario);
}

function installMovementTestDriver() {
  if (!movementTestMapFactory) {
    return;
  }
  window.gameMovementTest = {
    loadScenario(scenario) {
      mapData = movementTestMapFactory.create(scenario);
      renderer.render(mapData);
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

function applyGraphicsSettings() {
  if (!renderer) {
    return;
  }

  renderer.pathArrowsVisible = debugStore.pathArrows;
  renderer.debugAxesHudVisible = debugStore.debugAxesHud;
  renderer.debugFpsHudVisible = debugStore.debugFpsHud;
  debugVisible.value = debugStore.hasAny;
}

async function init() {
  const bindings = DEFAULT_CONTROLS;

  renderer = new PlayCanvasRenderer(canvas.value, container.value, {
    onInteractionChange: (target) => {
      interactionTarget.value = target;
    },
    onHeroStateChange: (state) => {
      heroLives.value = state.lives;
      maxHeroLives.value = state.maxLives;
      gameOver.value = state.gameOver;
    },
    onViewportChange: scheduleViewportSave,
    gameOverTitle: t("game.game_over"),
    restartPrompt: t("game.restart_prompt"),
    graphics: graphicsStore.rendererOptions,
  });
  await renderer.init();
  graphicsBackend.value = renderer.graphicsBackend;
  mapData = await createInitialMap();
  renderer.render(mapData);
  renderer.setViewport(gameViewStore.viewport);
  gameViewStore.updateViewport(renderer.viewport);
  viewportPersistenceEnabled = true;
  installMovementTestDriver();
  installCameraTestDriver();
  applyGraphicsSettings();
  updateDebugStats();

  const regenerateMapAction = new RegenerateMapAction(
    renderer,
    generateMap,
    (generatedMap) => {
      mapData = generatedMap;
      interactionTarget.value = null;
      applyGraphicsSettings();
    },
  );
  restartGameAction = new RestartGameAction(renderer, regenerateMapAction);
  const actions = {
    zoom: new ZoomAction(renderer, container.value, bindings.zoom),
    moveCamera: new MoveCameraAction(renderer, bindings.move),
    regenerateMap: regenerateMapAction,
    restartGame: restartGameAction,
    heroMovement: new HeroMovementAction(renderer),
    interaction: new InteractionAction(renderer),
    rotateView: new RotateViewAction(renderer),
    copyScreenshot: new CopyScreenshotAction(renderer, () => {
      Notify.create({
        type: "positive",
        position: "bottom-right",
        message: "Screenshot taken and copied to clipboard.",
        timeout: 2000,
      });
    }),
    toggleArrows: new ToggleArrowsAction(debugStore),
  };

  controls = new GameControls(container.value, actions);
  controls.connect();

  resizeObserver = new ResizeObserver(() => renderer.resize());
  resizeObserver.observe(container.value);
  stopGraphicsWatch = watch(
    () => [
      debugStore.pathArrows,
      debugStore.debugAxesHud,
      debugStore.debugFpsHud,
    ],
    applyGraphicsSettings,
  );
  debugStatsTimer = window.setInterval(() => {
    if (debugVisible.value) updateDebugStats();
  }, 100);
  showGraphicsFallbackDialog.value = graphicsBackend.value === "webgl2";
  gameReady.value = true;
}

onMounted(init);

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    delete window.gameMovementTest;
    delete window.gameCameraTest;
  }
  controls?.disconnect();
  if (viewportSaveTimer !== null) {
    window.clearTimeout(viewportSaveTimer);
    saveViewport();
  }
  stopGraphicsWatch?.();
  resizeObserver?.disconnect();
  if (debugStatsTimer !== null) window.clearInterval(debugStatsTimer);
  renderer?.destroy();
});
</script>
