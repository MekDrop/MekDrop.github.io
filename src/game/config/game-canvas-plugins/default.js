export const DEFAULT_GAME_CANVAS_PLUGINS = [
  {
    module:
      "/src/game/plugins/game-canvas/teleport/GameCanvasTeleportPlugin.js",
    exportName: "GameCanvasTeleportPlugin",
  },
  {
    module:
      "/src/game/plugins/game-canvas/screenshot/GameCanvasScreenshotPlugin.js",
    exportName: "GameCanvasScreenshotPlugin",
  },
  {
    module:
      "/src/game/plugins/game-canvas/recording/GameCanvasRecordingPlugin.js",
    exportName: "GameCanvasRecordingPlugin",
    messageKeys: {
      active: "game.recording.active",
    },
  },
];
