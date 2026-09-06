<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent>
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
        <span class="interaction-prompt__health" aria-hidden="true">
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
    <div
      v-if="debugVisible"
      class="debug-axes"
      aria-label="Debug axes and wind direction overlay"
    >
      <svg
        viewBox="0 0 200 120"
        class="debug-axes__svg"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="axis-arrow-red"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#ff6b6b" />
          </marker>
          <marker
            id="axis-arrow-green"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#7dff88" />
          </marker>
          <marker
            id="axis-arrow-blue"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#7cc8ff" />
          </marker>
          <marker
            id="wind-arrow-amber"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#ffd166" />
          </marker>
        </defs>
        <circle
          :cx="DEBUG_WIND_ORIGIN.x"
          :cy="DEBUG_WIND_ORIGIN.y"
          r="27"
          class="debug-axes__wind-dial"
        />
        <line
          :x1="DEBUG_WIND_ORIGIN.x"
          :y1="DEBUG_WIND_ORIGIN.y"
          :x2="debugWind.endX"
          :y2="debugWind.endY"
          class="debug-axes__wind"
          marker-end="url(#wind-arrow-amber)"
        />
        <circle
          :cx="DEBUG_WIND_ORIGIN.x"
          :cy="DEBUG_WIND_ORIGIN.y"
          r="3"
          class="debug-axes__wind-origin"
        />
        <line
          :x1="DEBUG_AXIS_ORIGIN.x"
          :y1="DEBUG_AXIS_ORIGIN.y"
          :x2="debugAxes.x.endX"
          :y2="debugAxes.x.endY"
          class="debug-axes__line debug-axes__line--x"
          marker-end="url(#axis-arrow-red)"
        />
        <line
          :x1="DEBUG_AXIS_ORIGIN.x"
          :y1="DEBUG_AXIS_ORIGIN.y"
          :x2="debugAxes.y.endX"
          :y2="debugAxes.y.endY"
          class="debug-axes__line debug-axes__line--y"
          marker-end="url(#axis-arrow-green)"
        />
        <line
          :x1="DEBUG_AXIS_ORIGIN.x"
          :y1="DEBUG_AXIS_ORIGIN.y"
          :x2="debugAxes.z.endX"
          :y2="debugAxes.z.endY"
          class="debug-axes__line debug-axes__line--z"
          marker-end="url(#axis-arrow-blue)"
        />
        <text
          :x="debugAxes.x.labelX"
          :y="debugAxes.x.labelY"
          class="debug-axes__label debug-axes__label--x"
        >
          X
        </text>
        <text
          :x="debugAxes.y.labelX"
          :y="debugAxes.y.labelY"
          class="debug-axes__label debug-axes__label--y"
        >
          Y
        </text>
        <text
          :x="debugAxes.z.labelX"
          :y="debugAxes.z.labelY"
          class="debug-axes__label debug-axes__label--z"
        >
          Z
        </text>
        <line
          x1="126"
          y1="22"
          x2="126"
          y2="98"
          class="debug-axes__divider"
        />
        <text
          x="161"
          y="20"
          class="debug-axes__wind-label"
          text-anchor="middle"
        >
          WIND
        </text>
        <text
          x="161"
          y="34"
          class="debug-axes__wind-speed"
          text-anchor="middle"
        >
          {{ windSpeedLabel }}
        </text>
      </svg>
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
  font: 700 13px/1.2 system-ui, sans-serif;
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
  transition: background 160ms ease, opacity 160ms ease;
}

.interaction-prompt__health .interaction-prompt__pip--lost {
  background: #667069;
  opacity: 0.45;
}

.interaction-prompt-enter-active,
.interaction-prompt-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
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

.debug-axes {
  position: absolute;
  left: 14px;
  bottom: 14px;
  width: 200px;
  height: 120px;
  padding: 6px;
  border: 1px solid rgba(210, 244, 228, 0.22);
  border-radius: 12px;
  background: rgba(3, 10, 8, 0.72);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.debug-axes__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.debug-axes__line {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
}

.debug-axes__wind {
  fill: none;
  stroke: #ffd166;
  stroke-width: 4;
  stroke-linecap: round;
}

.debug-axes__wind-dial {
  fill: rgba(255, 209, 102, 0.035);
  stroke: rgba(255, 226, 154, 0.34);
  stroke-width: 1.5;
  stroke-dasharray: 2 4;
}

.debug-axes__wind-origin {
  fill: #fff3ca;
  stroke: rgba(3, 10, 8, 0.88);
  stroke-width: 1.5;
}

.debug-axes__line--x {
  stroke: #ff6b6b;
}

.debug-axes__line--y {
  stroke: #7dff88;
}

.debug-axes__line--z {
  stroke: #7cc8ff;
}

.debug-axes__label {
  font: 700 14px/1 monospace;
  letter-spacing: 0.08em;
}

.debug-axes__label--x {
  fill: #ff8e8e;
}

.debug-axes__label--y {
  fill: #9cff8f;
}

.debug-axes__label--z {
  fill: #90d8ff;
}

.debug-axes__wind-label {
  fill: #ffe29a;
  font: 700 9px/1 monospace;
  letter-spacing: 0.08em;
  paint-order: stroke;
  stroke: rgba(3, 10, 8, 0.9);
  stroke-width: 3px;
}

.debug-axes__wind-speed {
  fill: #fff3ca;
  font: 700 8px/1 monospace;
  paint-order: stroke;
  stroke: rgba(3, 10, 8, 0.9);
  stroke-width: 3px;
}

.debug-axes__divider {
  stroke: rgba(210, 244, 228, 0.18);
  stroke-width: 1;
}
</style>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { Notify } from "quasar";
import { useI18n } from "vue-i18n";
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
import { VegetationInteractionAction } from "src/game/actions/VegetationInteractionAction.js";
import { ZoomAction } from "src/game/actions/ZoomAction.js";
import { CONTROLS } from "src/game/config/controls.js";
import { AMBIENT_WIND_DIRECTION } from "src/game/objects/shared/BannerWind.js";

const DEBUG_AXIS_ORIGIN = Object.freeze({ x: 60, y: 62 });
const DEBUG_GROUND_AXIS_LENGTH = 40;
const DEBUG_VERTICAL_AXIS_LENGTH = 45;
const DEBUG_WIND_ORIGIN = Object.freeze({ x: 162, y: 82 });
const DEBUG_WIND_ARROW_LENGTH = 23;
const DEFAULT_DEBUG_DIRECTIONS = Object.freeze({
  x: { x: 0.88, y: -0.47 },
  y: { x: 0.88, y: 0.47 },
  z: { x: 0, y: -1 },
});

const container = ref(null);
const canvas = ref(null);
const debugVisible = ref(false);
const debugDirections = ref(DEFAULT_DEBUG_DIRECTIONS);
const windSpeed = ref(0);
const windDirection = ref({ ...AMBIENT_WIND_DIRECTION });
const interactionTarget = ref(null);
const heroLives = ref(3);
const maxHeroLives = ref(3);
const gameOver = ref(false);
const { t } = useI18n();
const interactionLabel = computed(() => {
  if (interactionTarget.value?.cutting) {
    return t("game.interaction.stop_cutting");
  }
  return interactionTarget.value?.kind === "bush"
    ? t("game.interaction.clear_bush")
    : t("game.interaction.chop_tree");
});
const debugAxes = computed(() => {
  const createAxis = (direction, length) => ({
    endX: DEBUG_AXIS_ORIGIN.x + direction.x * length,
    endY: DEBUG_AXIS_ORIGIN.y + direction.y * length,
    labelX: Math.max(
      9,
      Math.min(111, DEBUG_AXIS_ORIGIN.x + direction.x * (length + 8)),
    ),
    labelY: Math.max(
      10,
      Math.min(
        112,
        DEBUG_AXIS_ORIGIN.y +
          direction.y * (length + 8) +
          (direction.y > 0 ? 5 : 0),
      ),
    ),
  });
  return {
    x: createAxis(debugDirections.value.x, DEBUG_GROUND_AXIS_LENGTH),
    y: createAxis(debugDirections.value.y, DEBUG_GROUND_AXIS_LENGTH),
    z: createAxis(debugDirections.value.z, DEBUG_VERTICAL_AXIS_LENGTH),
  };
});
const debugWind = computed(() => {
  const projected = {
    x:
      windDirection.value.x * debugDirections.value.x.x +
      windDirection.value.z * debugDirections.value.y.x +
      windDirection.value.y * debugDirections.value.z.x,
    y:
      windDirection.value.x * debugDirections.value.x.y +
      windDirection.value.z * debugDirections.value.y.y +
      windDirection.value.y * debugDirections.value.z.y,
  };
  const length = Math.max(0.001, Math.hypot(projected.x, projected.y));
  const x = (projected.x / length) * DEBUG_WIND_ARROW_LENGTH;
  const y = (projected.y / length) * DEBUG_WIND_ARROW_LENGTH;
  return {
    endX: DEBUG_WIND_ORIGIN.x + x,
    endY: DEBUG_WIND_ORIGIN.y + y,
  };
});
const windSpeedLabel = computed(() => `${windSpeed.value.toFixed(2)} u/s`);
let renderer = null;
let mapData = null;
let controls = null;
let resizeObserver = null;
let windSpeedTimer = null;
let restartGameAction = null;

function updateWindDebug() {
  const wind = renderer?.getWind();
  if (!wind) return;
  windSpeed.value = wind.speed;
  windDirection.value = wind.direction;
  debugDirections.value =
    renderer.getDebugDirections() ?? DEFAULT_DEBUG_DIRECTIONS;
}

async function init() {
  renderer = new PlayCanvasRenderer(canvas.value, container.value, {
    onInteractionChange: (target) => {
      interactionTarget.value = target;
    },
    onHeroStateChange: (state) => {
      heroLives.value = state.lives;
      maxHeroLives.value = state.maxLives;
      gameOver.value = state.gameOver;
    },
    gameOverTitle: t("game.game_over"),
    restartPrompt: t("game.restart_prompt"),
  });
  await renderer.init();
  mapData = generateMap();
  renderer.render(mapData);
  debugVisible.value = renderer.getArrowsVisible();
  updateWindDebug();

  const regenerateMapAction = new RegenerateMapAction(
    renderer,
    generateMap,
    (generatedMap) => {
      mapData = generatedMap;
      interactionTarget.value = null;
      debugVisible.value = renderer.getArrowsVisible();
      updateWindDebug();
    },
  );
  restartGameAction = new RestartGameAction(renderer, regenerateMapAction);
  const actions = {
    zoom: new ZoomAction(renderer, container.value, CONTROLS.zoom),
    moveCamera: new MoveCameraAction(renderer, CONTROLS.move),
    regenerateMap: regenerateMapAction,
    restartGame: restartGameAction,
    heroMovement: new HeroMovementAction(renderer),
    vegetationInteraction: new VegetationInteractionAction(renderer),
    rotateView: new RotateViewAction(renderer, () => {
      updateWindDebug();
    }),
    copyScreenshot: new CopyScreenshotAction(renderer, () => {
      Notify.create({
        type: "positive",
        position: "bottom-right",
        message: "Screenshot taken and copied to clipboard.",
        timeout: 2000,
      });
    }),
    toggleArrows: new ToggleArrowsAction(renderer, (visible) => {
      debugVisible.value = visible;
      if (visible) updateWindDebug();
    }),
  };

  controls = new GameControls(container.value, CONTROLS, actions);
  controls.connect();

  resizeObserver = new ResizeObserver(() => renderer.resize());
  resizeObserver.observe(container.value);
  windSpeedTimer = window.setInterval(() => {
    if (debugVisible.value) updateWindDebug();
  }, 100);
}

onMounted(init);

onBeforeUnmount(() => {
  controls?.disconnect();
  resizeObserver?.disconnect();
  if (windSpeedTimer !== null) window.clearInterval(windSpeedTimer);
  renderer?.destroy();
});
</script>
