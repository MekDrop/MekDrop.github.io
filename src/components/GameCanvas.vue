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

const container = ref(null);
let app = null;
let renderer = null;
let mapData = null;
let resizeObserver = null;

function handleKeydown(e) {
  if (e.code === 'Pause' || e.key === 'Pause') {
    renderer.setArrowsVisible(!renderer._arrowsVisible);
  }
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
}

onMounted(init);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  resizeObserver?.disconnect();
  app?.destroy(true, { children: true });
});
</script>
