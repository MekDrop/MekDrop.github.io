/**
 * Static shared image bindings. Behaviour belongs in dynamic texture providers.
 */
export const woodTexture = {
  imageName: "timber-grain",
  url: new URL("./wood/timber-grain.png", import.meta.url).href,
  assetData: { srgb: true },
};

export const sharedTextures = [woodTexture];
