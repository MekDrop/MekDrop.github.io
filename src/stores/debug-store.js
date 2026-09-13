import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useDebugStore = defineStore(
  "debug",
  () => {
    // Debug overlays (applied live while the game runs).
    const pathArrows = ref(false);
    const debugAxesHud = ref(false);
    const debugFpsHud = ref(false);

    const hasAny = computed(
      () => pathArrows.value || debugAxesHud.value || debugFpsHud.value,
    );

    const toggleAll = () => {
      const shouldEnable =
        !pathArrows.value || !debugAxesHud.value || !debugFpsHud.value;
      pathArrows.value = shouldEnable;
      debugAxesHud.value = shouldEnable;
      debugFpsHud.value = shouldEnable;
      return shouldEnable;
    };

    return {
      pathArrows,
      debugAxesHud,
      debugFpsHud,
      hasAny,
      toggleAll,
    };
  },
  {
    persist: {
      key: "debug",
      pick: ["pathArrows", "debugAxesHud", "debugFpsHud"],
      storage: process.env.CLIENT ? sessionStorage : undefined,
    },
  },
);
