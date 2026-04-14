import { Assets } from "pixi.js";

const inFlightLoadsSymbol = Symbol("gameObjectTextureInFlightLoads");
const textureUrlsByKeySymbol = Symbol("gameObjectTextureUrlsByKey");

const getInFlightLoads = (loadedTextures) => {
  if (!loadedTextures[inFlightLoadsSymbol]) {
    loadedTextures[inFlightLoadsSymbol] = new Map();
  }
  return loadedTextures[inFlightLoadsSymbol];
};

const getTextureUrlsByKey = (loadedTextures) => {
  if (!loadedTextures[textureUrlsByKeySymbol]) {
    loadedTextures[textureUrlsByKeySymbol] = new Map();
  }
  return loadedTextures[textureUrlsByKeySymbol];
};

export const createTextureLoadStep = (loadedTextures, key, url) => {
  if (!loadedTextures || !key || !url) return Promise.resolve();
  if (loadedTextures.has(key)) return Promise.resolve(loadedTextures.get(key));

  const inFlightLoads = getInFlightLoads(loadedTextures);
  if (inFlightLoads.has(key)) return inFlightLoads.get(key);

  const textureUrlsByKey = getTextureUrlsByKey(loadedTextures);
  textureUrlsByKey.set(key, url);
  const loadPromise = Assets.load(url)
    .then((texture) => {
      texture.source.scaleMode = "nearest";
      loadedTextures.set(key, texture);
      return texture;
    })
    .finally(() => {
      inFlightLoads.delete(key);
    });
  inFlightLoads.set(key, loadPromise);
  return loadPromise;
};

export const getLoadedTextureAssetKeys = (loadedTextures) => {
  if (!loadedTextures) return [];
  return [...getTextureUrlsByKey(loadedTextures).keys()];
};

export const unloadLoadedTextureAssets = async (loadedTextures, keys = getLoadedTextureAssetKeys(loadedTextures)) => {
  if (!loadedTextures || !keys?.length) return;
  const textureUrlsByKey = getTextureUrlsByKey(loadedTextures);
  await Promise.allSettled(keys.map(async (key) => {
    const url = textureUrlsByKey.get(key);
    loadedTextures.delete(key);
    textureUrlsByKey.delete(key);
    if (url) {
      await Assets.unload(url);
    }
  }));
};

