import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as THREE from 'three'

export const useBackgroundImageStore = defineStore('background-image', () => {

  const texture = ref(null);
  const loading = ref(false);
  const lastLoadedUrl = ref(null);
  const maxTries = 10;

  const loadFromUrl = (url) => {
    let tries = 0;
    return new Promise((resolve, reject) => {
        loading.value = true;
        lastLoadedUrl.value = null;

        const tryLoad = () => {
          tries++;
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            url,
            (imageTexture) => {
              loading.value = false;
              texture.value = imageTexture;
              lastLoadedUrl.value = url;
              resolve();
            },
            undefined,
            (e) => {
              if (tries >= maxTries) {
                reject(e);
                return;
              }

              setTimeout(tryLoad,250);
            }
          );
        }

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

  const load = () => {
    return safeLoadFromUrl('https://picsum.photos/' + window.innerWidth) ||
           safeLoadFromUrl('https://picsum.photos/1024');
  };

  return {
    isLoading: computed(() => loading.value),
    isLoaded: computed(() => !!texture.value),
    texture,
    load,
    lastLoadedUrl: computed(()=>lastLoadedUrl.value),
  };
});
