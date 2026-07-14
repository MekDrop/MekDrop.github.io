<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent>
    <div v-if="debugVisible" class="debug-axes" aria-label="Debug axes overlay">
      <svg viewBox="0 0 120 120" class="debug-axes__svg" role="img" aria-hidden="true">
        <defs>
          <marker id="axis-arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#ff6b6b" />
          </marker>
          <marker id="axis-arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#7dff88" />
          </marker>
          <marker id="axis-arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#7cc8ff" />
          </marker>
        </defs>
        <line x1="28" y1="92" x2="84" y2="64" class="debug-axes__line debug-axes__line--x" marker-end="url(#axis-arrow-red)" />
        <line x1="28" y1="92" x2="84" y2="104" class="debug-axes__line debug-axes__line--y" marker-end="url(#axis-arrow-green)" />
        <line x1="28" y1="92" x2="28" y2="28" class="debug-axes__line debug-axes__line--z" marker-end="url(#axis-arrow-blue)" />
        <text x="90" y="63" class="debug-axes__label debug-axes__label--x">X</text>
        <text x="90" y="110" class="debug-axes__label debug-axes__label--y">Y</text>
        <text x="20" y="22" class="debug-axes__label debug-axes__label--z">Z</text>
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Application } from 'pixi.js';
import { generateMap } from 'src/game/MapGenerator.js';
import { VoxelRenderer } from 'src/game/VoxelRenderer.js';
import { CONTROLS } from 'src/game/config/controls.js';

const container = ref(null);
const debugVisible = ref(false);
let app = null;
let renderer = null;
let mapData = null;
let resizeObserver = null;

// --- actions (callable from any input source: keyboard, wheel, button, …) ---

function toggleArrows() {
  renderer.setArrowsVisible(!renderer.getArrowsVisible());
  debugVisible.value = renderer.getArrowsVisible();
}

function zoomIn(pivotX, pivotY) {
  const { factor, max } = CONTROLS.zoom;
  renderer.zoomTo(Math.min(max, renderer.getZoom() * factor), pivotX, pivotY);
}

function zoomOut(pivotX, pivotY) {
  const { factor, min } = CONTROLS.zoom;
  renderer.zoomTo(Math.max(min, renderer.getZoom() / factor), pivotX, pivotY);
}

function regenerateMap() {
  const viewport = renderer.getViewport();

  mapData = generateMap();
  renderer.render(mapData);
  renderer.setViewport(viewport);
}

// --- device listeners (dispatch to actions based on config) ---

function handleKeydown(e) {
  const id = e.code || e.key;
  if (CONTROLS.toggleArrows.keys.includes(id)) toggleArrows();
  if (id === 'KeyR' || id === 'r' || id === 'R') regenerateMap();
}

function handleWheel(e) {
  e.preventDefault();
  const rect = container.value.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  if (e.deltaY < 0) zoomIn(px, py);
  else               zoomOut(px, py);
}

async function init() {
  app = new Application();
  await app.init({
    resizeTo: container.value,
    background: 0x0a1428,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  container.value.appendChild(app.canvas);

  renderer = new VoxelRenderer(app);
  mapData = generateMap();
  renderer.render(mapData);
  debugVisible.value = renderer.getArrowsVisible();

  resizeObserver = new ResizeObserver(() => renderer.render(mapData));
  resizeObserver.observe(container.value);

  window.addEventListener('keydown', handleKeydown);
  container.value.addEventListener('wheel', handleWheel, { passive: false });
}

onMounted(init);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  container.value?.removeEventListener('wheel', handleWheel);
  resizeObserver?.disconnect();
  app?.destroy(true, { children: true });
});
</script>

