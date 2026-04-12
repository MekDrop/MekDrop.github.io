import { defineStore } from "pinia";
import { Assets, Texture } from "pixi.js";
import { computed, ref } from "vue";
import { getHeroAnimationSources } from "assets/game/sprites/hero-sprite-registry";
import coinGoldSprite from "assets/game/sprites/collectibles/coin-gold.png";
import enemyWalkFrame0 from "assets/game/sprites/enemies/mushroom-stomper-walk-0.png";
import enemyWalkFrame1 from "assets/game/sprites/enemies/mushroom-stomper-walk-1.png";
import portalFrame from "assets/game/sprites/goal/portal-frame-0.png";
import platformCenterSprite from "assets/game/sprites/platforms/platform-center.png";
import platformWallSprite from "assets/game/sprites/platforms/platform-wall.png";
import platformStairSprite from "assets/game/sprites/platforms/platform-stair.png";

const heroSpriteUrls = getHeroAnimationSources();

const spriteEntries = [
  ...heroSpriteUrls.map((url, index) => [`hero:${index}`, url]),
  ["coinGold", coinGoldSprite],
  ["enemyWalkFrame0", enemyWalkFrame0],
  ["enemyWalkFrame1", enemyWalkFrame1],
  ["portalFrame", portalFrame],
  ["platformCenter", platformCenterSprite],
  ["platformWall", platformWallSprite],
  ["platformStair", platformStairSprite],
];

const SPRITE_URLS = Object.fromEntries(spriteEntries);

export const useSpritesStore = defineStore("sprites", () => {
  const textures = new Map();
  const pendingLoads = new Map();

  const loadedTextures = ref([]);
  const pendingTextures = ref([]);
  const failedTextures = ref([]);
  const textureUrls = ref({ ...SPRITE_URLS });

  const createTextureRecord = (key, texture = null) => ({
    key,
    url: SPRITE_URLS[key],
    texture,
  });

  const syncDebugState = () => {
    loadedTextures.value = loadedTextures.value.map((entry) => createTextureRecord(entry.key, textures.get(entry.key) ?? null));
    pendingTextures.value = [...pendingLoads.keys()].map((key) => createTextureRecord(key));
  };

  const markFailed = (key) => {
    if (!failedTextures.value.some((entry) => entry.key === key)) {
      failedTextures.value = [...failedTextures.value, createTextureRecord(key)];
    }
  };

  const clearFailed = (key) => {
    if (failedTextures.value.some((entry) => entry.key === key)) {
      failedTextures.value = failedTextures.value.filter((entry) => entry.key !== key);
    }
  };

  const cacheTexture = (key, texture) => {
    texture.source.scaleMode = "nearest";
    textures.set(key, texture);
    clearFailed(key);
    syncDebugState();
    return texture;
  };

  const loadTexture = async (key) => {
    const url = SPRITE_URLS[key];
    if (!url) return null;
    if (textures.has(key)) return textures.get(key);
    if (pendingLoads.has(key)) return pendingLoads.get(key);

    const promise = Assets.load(url)
      .then((texture) => cacheTexture(key, texture))
      .catch((error) => {
        markFailed(key);
        throw error;
      })
      .finally(() => {
        pendingLoads.delete(key);
        syncDebugState();
      });

    pendingLoads.set(key, promise);
    syncDebugState();
    return promise;
  };

  const loadTextures = async (keys, onProgress) => {
    const uniqueKeys = [...new Set(keys)].filter((key) => !!SPRITE_URLS[key]);
    const total = uniqueKeys.length;
    let completed = 0;

    if (typeof onProgress === "function") {
      onProgress({ loaded: 0, total });
    }

    await Promise.all(uniqueKeys.map((key) => loadTexture(key)
      .finally(() => {
        completed += 1;
        if (typeof onProgress === "function") {
          onProgress({ loaded: completed, total });
        }
      })));
  };

  const unloadTexture = async (key) => {
    const url = SPRITE_URLS[key];
    if (!url) return;
    textures.delete(key);
    pendingLoads.delete(key);
    clearFailed(key);
    syncDebugState();
    await Assets.unload(url);
  };

  const unloadTextures = async (keys) => {
    const uniqueKeys = [...new Set(keys)].filter((key) => !!SPRITE_URLS[key]);
    await Promise.allSettled(uniqueKeys.map((key) => unloadTexture(key)));
  };

  return {
    loadedTextures,
    pendingTextures: computed(() => pendingTextures.value),
    failedTextures: computed(() => failedTextures.value),
    textureUrls: computed(() => textureUrls.value),
    loadTexture,
    loadTextures,
    unloadTexture,
    unloadTextures,
  };
});
