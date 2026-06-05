<template>
  <div ref="container" class="background-canvas fit" @contextmenu.prevent></div>
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
</style>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Application } from 'pixi.js';
import { generateMap } from 'src/game/MapGenerator.js';
import { VoxelRenderer } from 'src/game/VoxelRenderer.js';
import { CONTROLS } from 'src/game/config/controls.js';

const container = ref(null);
let app = null;
let renderer = null;
let mapData = null;
let resizeObserver = null;

// --- actions (callable from any input source: keyboard, wheel, button, …) ---

function toggleArrows() {
  renderer.setArrowsVisible(!renderer._arrowsVisible);
}

function zoomIn(pivotX, pivotY) {
  const { factor, max } = CONTROLS.zoom;
  renderer.zoomTo(Math.min(max, renderer._zoom * factor), pivotX, pivotY);
}

function zoomOut(pivotX, pivotY) {
  const { factor, min } = CONTROLS.zoom;
  renderer.zoomTo(Math.max(min, renderer._zoom / factor), pivotX, pivotY);
}

function regenerateMap() {
  const prevZoom = renderer._zoom;
  const prevContainerX = renderer._containerX;
  const prevContainerY = renderer._containerY;

  mapData = generateMap();
  renderer.render(mapData);

  renderer._zoom = prevZoom;
  renderer._containerX = prevContainerX;
  renderer._containerY = prevContainerY;
  renderer.container.scale.set(prevZoom);
  renderer.container.position.set(prevContainerX, prevContainerY);
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
