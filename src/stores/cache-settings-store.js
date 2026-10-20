import { defineStore } from "pinia";
import { ref } from "vue";

export const useCacheSettingsStore = defineStore(
  "cache-settings",
  () => {
    // Applied to subsequent map generation, including workers.
    const roomLayoutCache = ref(true);
    const castlePlanCache = ref(true);
    const compiledMapCache = ref(true);

    return {
      roomLayoutCache,
      castlePlanCache,
      compiledMapCache,
    };
  },
  {
    persist: {
      key: "cache-settings",
      pick: ["roomLayoutCache", "castlePlanCache", "compiledMapCache"],
    },
  },
);
