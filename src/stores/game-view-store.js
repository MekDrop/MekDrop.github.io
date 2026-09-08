import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CONTROLS } from "src/game/config/controls.js";

const DEFAULT_ZOOM = DEFAULT_CONTROLS.zoom.min;
const MAX_ZOOM = DEFAULT_CONTROLS.zoom.max;

function finiteValue(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export const useGameViewStore = defineStore(
  "game-view",
  () => {
    const zoom = ref(DEFAULT_ZOOM);
    const rotation = ref(0);
    const panX = ref(0);
    const panZ = ref(0);
    const manuallyMoved = ref(false);

    const viewport = computed(() => ({
      zoom: Math.max(
        DEFAULT_ZOOM,
        Math.min(MAX_ZOOM, finiteValue(zoom.value, DEFAULT_ZOOM)),
      ),
      rotation:
        ((Math.round(finiteValue(rotation.value, 0)) % 4) + 4) % 4,
      panX: finiteValue(panX.value, 0),
      panZ: finiteValue(panZ.value, 0),
      manuallyMoved: Boolean(manuallyMoved.value),
    }));

    const updateViewport = (nextViewport) => {
      const normalized = {
        zoom: Math.max(
          DEFAULT_ZOOM,
          Math.min(
            MAX_ZOOM,
            finiteValue(nextViewport?.zoom, DEFAULT_ZOOM),
          ),
        ),
        rotation:
          ((Math.round(finiteValue(nextViewport?.rotation, 0)) % 4) + 4) % 4,
        panX: finiteValue(nextViewport?.panX, 0),
        panZ: finiteValue(nextViewport?.panZ, 0),
        manuallyMoved: Boolean(nextViewport?.manuallyMoved),
      };
      zoom.value = normalized.zoom;
      rotation.value = normalized.rotation;
      panX.value = normalized.panX;
      panZ.value = normalized.panZ;
      manuallyMoved.value = normalized.manuallyMoved;
    };

    return {
      zoom,
      rotation,
      panX,
      panZ,
      manuallyMoved,
      viewport,
      updateViewport,
    };
  },
  {
    persist: {
      key: "game-view",
      pick: ["zoom", "rotation", "panX", "panZ", "manuallyMoved"],
    },
  },
);
