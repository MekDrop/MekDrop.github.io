import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { GRAPHICS_DRIVER } from "src/game/enum/GraphicsDriver.js";
import { POWER_PREFERENCE } from "src/game/enum/PowerPreference.js";

export const useGraphicsSettingsStore = defineStore("graphics-settings", () => {
  // Graphics device options (applied when the renderer is created).
  const driver = ref(GRAPHICS_DRIVER.AUTO);
  const antialias = ref(true);
  const powerPreference = ref(POWER_PREFERENCE.HIGH_PERFORMANCE);
  const maxPixelRatio = ref(2);

  // Texture quality options (applied when textures are loaded).
  const mipmaps = ref(true);
  const anisotropy = ref(8);

  // Shadow quality options (applied when the scene is created).
  const shadows = ref(true);
  const shadowResolution = ref(2048);

  const rendererOptions = computed(() => ({
    driver: driver.value,
    antialias: antialias.value,
    powerPreference: powerPreference.value,
    maxPixelRatio: maxPixelRatio.value,
    mipmaps: mipmaps.value,
    anisotropy: anisotropy.value,
    shadows: shadows.value,
    shadowResolution: shadowResolution.value,
  }));

  return {
    driver,
    antialias,
    powerPreference,
    maxPixelRatio,
    mipmaps,
    anisotropy,
    shadows,
    shadowResolution,
    rendererOptions,
  };
});
