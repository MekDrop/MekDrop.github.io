import { DEFAULT_GAME_CANVAS_PLUGINS } from "./default.js";

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
  return entries.map(({ messageKeys, ...entry }) => ({
    ...entry,
    messages: Object.fromEntries(
      Object.entries(messageKeys ?? {}).map(([name, key]) => [
        name,
        translate?.(key) ?? key,
      ]),
    ),
  }));
}
