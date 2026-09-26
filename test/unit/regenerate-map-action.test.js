import assert from "node:assert/strict";
import { it } from "node:test";
import { RegenerateMapAction } from "../../src/game/actions/RegenerateMapAction.js";
import { RestartGameAction } from "../../src/game/actions/RestartGameAction.js";

it("awaits each regeneration phase before rendering and exposes the full lifecycle", async () => {
  const events = [];
  const mapData = { mapName: "new-map" };
  const viewport = { x: 4, y: 7 };
  let lifecycle;
  const renderer = {
    viewport,
    render: (map) => events.push(["render", map]),
    setViewport: (value) => events.push(["viewport", value]),
  };
  const action = new RegenerateMapAction(renderer, async () => {
    events.push("generate");
    return mapData;
  }, {
    beforeGeneration: async () => {
      events.push("generating");
      return 42;
    },
    beforeRender: async (map, operation) =>
      events.push(["rendering", map, operation]),
    afterRender: async (map, operation) =>
      events.push(["rendered", map, operation]),
    onGenerated: async (map, operation) =>
      events.push(["generated", map, operation]),
    onComplete: async (operation) => events.push(["complete", operation]),
    onLifecycle: (promise) => {
      lifecycle = promise;
    },
  });

  const resultPromise = action.regenerateMap();

  assert.equal(lifecycle, resultPromise);
  assert.equal(await resultPromise, mapData);
  assert.deepEqual(events, [
    "generating",
    "generate",
    ["rendering", mapData, 42],
    ["render", mapData],
    ["rendered", mapData, 42],
    ["viewport", viewport],
    ["generated", mapData, 42],
    ["complete", 42],
  ]);
});

it("reports generation errors, skips rendering, and still completes cleanup", async () => {
  const error = new TypeError("map generation failed");
  const events = [];
  const renderer = {
    viewport: {},
    render: () => events.push("render"),
    setViewport: () => events.push("viewport"),
  };
  const action = new RegenerateMapAction(renderer, () => {
    events.push("generate");
    throw error;
  }, {
    beforeGeneration: () => {
      events.push("generating");
      return "operation";
    },
    onGenerationError: (caughtError, operation) =>
      events.push(["error", caughtError, operation]),
    onComplete: (operation) => events.push(["complete", operation]),
  });

  assert.equal(await action.regenerateMap(), null);
  assert.deepEqual(events, [
    "generating",
    "generate",
    ["error", error, "operation"],
    ["complete", "operation"],
  ]);
});

it("restarts only after game over and preserves the return viewport", async () => {
  const viewport = { x: 9 };
  const calls = [];
  let gameOver = false;
  const renderer = {
    gameOverReturnViewport: viewport,
    isGameOver: () => gameOver,
  };
  const action = new RestartGameAction(renderer, {
    regenerateMap: async (value) => calls.push(value),
  });

  assert.equal(action.restart(), false);
  gameOver = true;
  assert.equal(action.restart(), true);
  await Promise.resolve();
  assert.deepEqual(calls, [viewport]);
});
