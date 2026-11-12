/**
 * Static shared image bindings. Behaviour belongs in dynamic texture providers.
 */
export const woodTexture = {
  imageName: "timber-grain",
  url: new URL("./wood/timber-grain.png", import.meta.url).href,
  assetData: { srgb: true },
};

export const amberGlassTexture = {
  imageName: "amber-frosted",
  url: new URL("./glass/amber-frosted.png", import.meta.url).href,
  assetData: { srgb: true },
};

export const windowFrostedTexture = {
  imageName: "window-frosted",
  url: new URL("./glass/window-frosted.png", import.meta.url).href,
  assetData: { srgb: true },
};

export const windowWarmthTexture = {
  imageName: "window-warmth",
  url: new URL("./glass/window-warmth.png", import.meta.url).href,
  assetData: { srgb: true },
};

export const sharedTextures = [woodTexture, amberGlassTexture, windowFrostedTexture, windowWarmthTexture];
