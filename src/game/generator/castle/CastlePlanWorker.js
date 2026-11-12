import { CastleGenerator } from "./CastleGenerator.js";

/**
 * Generate the same serializable plan without blocking the renderer.
 * @param {MessageEvent<import("./CastleGenerator.js").CastleGenerationOptions>} event
 */
globalThis.onmessage = async ({ data }) => {
  try {
    const plan = await CastleGenerator.generate(data);
    globalThis.postMessage({ plan });
  } catch (error) {
    globalThis.postMessage({ error });
  }
};
