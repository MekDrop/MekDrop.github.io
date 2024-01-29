import { defineStore } from "pinia";
import { computed, ref } from "vue";
import * as THREE from "three";
import { LoadingBar } from "quasar";

export const useBackgroundImageStore = defineStore("background-image", () => {
  const texture = ref(null);
  const loading = ref(false);
  const lastLoadedUrl = ref(null);
  const maxTries = 10;

  const loadFromUrl = (url) => {
    let tries = 0;
    return new Promise((resolve, reject) => {
      loading.value = true;
      lastLoadedUrl.value = null;
      texture.value = null;
      LoadingBar.start();

      const tryLoad = () => {
        tries++;
        const textureLoader = new THREE.TextureLoader();
        texture.value = textureLoader.load(
          url,
          (imageTexture) => {
            loading.value = false;
            texture.value = imageTexture;
            lastLoadedUrl.value = url;
            LoadingBar.stop();
            resolve();
          },
          undefined,
          (e) => {
            if (tries >= maxTries) {
              reject(e);
              return;
            }

            setTimeout(tryLoad, 250);
          }
        );
      };

      tryLoad();
    });
  };

  const safeLoadFromUrl = async (url) => {
    try {
      await loadFromUrl(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  let lastId = 0;
  const load = () => {
    lastId++;
    return (
      safeLoadFromUrl(
        "https://picsum.photos/" + window.innerWidth + "?item=" + lastId
      ) || safeLoadFromUrl("https://picsum.photos/1024?item=" + lastId)
    );
  };

  return {
    isLoading: computed(() => loading.value),
    isLoaded: computed(() => !!texture.value),
    texture,
    load,
    lastLoadedUrl: computed(() => lastLoadedUrl.value),
  };
});
