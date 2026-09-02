<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent>
    <canvas ref="canvas" class="background-canvas__surface" />
    <div v-if="debugVisible" class="debug-axes" aria-label="Debug axes overlay">
      <svg
        viewBox="0 0 120 120"
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
        </defs>
        <line
          x1="60"
          y1="84"
          :x2="debugAxes.x.endX"
          :y2="debugAxes.x.endY"
          class="debug-axes__line debug-axes__line--x"
          marker-end="url(#axis-arrow-red)"
        />
        <line
          x1="60"
          y1="84"
          :x2="debugAxes.y.endX"
          :y2="debugAxes.y.endY"
          class="debug-axes__line debug-axes__line--y"
          marker-end="url(#axis-arrow-green)"
        />
        <line
          x1="60"
          y1="84"
          x2="60"
          y2="28"
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
        <text x="52" y="22" class="debug-axes__label debug-axes__label--z">
          Z
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
}

.debug-axes {
  position: absolute;
  left: 14px;
  bottom: 14px;
  width: 120px;
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
</style>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { Notify } from "quasar";
import { generateMap } from "src/game/MapGenerator.js";
import { PlayCanvasRenderer } from "src/game/PlayCanvasRenderer.js";
import { GameControls } from "src/game/GameControls.js";
import { CopyScreenshotAction } from "src/game/actions/CopyScreenshotAction.js";
import { MoveCameraAction } from "src/game/actions/MoveCameraAction.js";
import { RegenerateMapAction } from "src/game/actions/RegenerateMapAction.js";
import { RotateViewAction } from "src/game/actions/RotateViewAction.js";
import { ToggleArrowsAction } from "src/game/actions/ToggleArrowsAction.js";
import { ZoomAction } from "src/game/actions/ZoomAction.js";
import { CONTROLS } from "src/game/config/controls.js";

const DEBUG_AXIS_ROTATIONS = [
  {
    x: { endX: 98, endY: 64, labelX: 103, labelY: 61 },
    y: { endX: 98, endY: 104, labelX: 103, labelY: 112 },
  },
  {
    x: { endX: 22, endY: 104, labelX: 8, labelY: 112 },
    y: { endX: 22, endY: 64, labelX: 8, labelY: 61 },
  },
  {
    x: { endX: 22, endY: 64, labelX: 8, labelY: 61 },
    y: { endX: 22, endY: 104, labelX: 8, labelY: 112 },
  },
  {
    x: { endX: 98, endY: 104, labelX: 103, labelY: 112 },
    y: { endX: 98, endY: 64, labelX: 103, labelY: 61 },
  },
];

const container = ref(null);
const canvas = ref(null);
const debugVisible = ref(false);
const viewRotation = ref(0);
const debugAxes = computed(() => DEBUG_AXIS_ROTATIONS[viewRotation.value]);
let renderer = null;
let mapData = null;
let controls = null;
let resizeObserver = null;

async function init() {
  renderer = new PlayCanvasRenderer(canvas.value, container.value);
  await renderer.init();
  mapData = generateMap();
  renderer.render(mapData);
  debugVisible.value = renderer.getArrowsVisible();
  viewRotation.value = renderer.getRotation();

  const actions = {
    zoom: new ZoomAction(renderer, container.value, CONTROLS.zoom),
    moveCamera: new MoveCameraAction(renderer, CONTROLS.move),
    rotateView: new RotateViewAction(renderer, (rotation) => {
      viewRotation.value = rotation;
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
    }),
    regenerateMap: new RegenerateMapAction(
      renderer,
      generateMap,
      (generated) => {
        mapData = generated;
      },
    ),
  };

  controls = new GameControls(container.value, CONTROLS, actions);
  controls.connect();

  resizeObserver = new ResizeObserver(() => renderer.resize());
  resizeObserver.observe(container.value);
}

onMounted(init);

onBeforeUnmount(() => {
  controls?.disconnect();
  resizeObserver?.disconnect();
  renderer?.destroy();
});
</script>
