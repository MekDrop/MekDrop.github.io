export const DEVELOPMENT_GAME_CANVAS_PLUGINS = [
  {
    module:
      "/src/game/plugins/game-canvas/debug-ui/GameCanvasDebugUiPlugin.js",
    exportName: "GameCanvasDebugUiPlugin",
  },
  {
    module:
      "/src/game/plugins/game-canvas/movement-test-driver/GameCanvasMovementTestDriverPlugin.js",
    exportName: "GameCanvasMovementTestDriverPlugin",
    requires: { testMapLoaded: true },
  },
  {
    module:
      "/src/game/plugins/game-canvas/camera-test-driver/GameCanvasCameraTestDriverPlugin.js",
    exportName: "GameCanvasCameraTestDriverPlugin",
    queryParameter: "camera-test",
  },
];
