import { DEFAULT_GAME_CANVAS_PLUGINS } from "./default.js";

/**
 *
 * @param {{development: boolean}} options
 * @param {boolean} options.development
 * @param {(key: string, values?: {[key: string]: string|number}) => string} options.translate
 */
export async function loadGameCanvasPluginConfig({
  development = false,
  translate,
} = {}) {
  const entries = [...DEFAULT_GAME_CANVAS_PLUGINS];
  if (development) {
    const { DEVELOPMENT_GAME_CANVAS_PLUGINS } = await import(
      "./development.js"
    );
    entries.push(...DEVELOPMENT_GAME_CANVAS_PLUGINS);
  }
  return entries.map(/**
   *
   * @param {{messageKeys: string[]}} options
   * @param {string[]} options.messageKeys
   */
  ({ messageKeys, ...entry }) => ({
    ...entry,
    messages: Object.fromEntries(
      Object.entries(messageKeys ?? {}).map(/**
       *
       * @param {{"0": Array, "1": Array}} options
       * @param {Array} options."0"
       * @param {Array} options."1"
       */
      ([name, key]) => [
        name,
        translate?.(key) ?? key,
      ]),
    ),
  }));
}
