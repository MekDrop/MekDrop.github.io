import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

class FakeGameOverHud {
  visible = false;

  attach() {}

  destroy() {}
}

const source = readFileSync(
  new URL(
    "../../../../../src/game/rendering/scene/GameOverScene.js",
    import.meta.url,
  ),
  "utf8",
).replace(/^import[^;]+;\r?\n/gm, "");
const dependencies = `
  const SCENE_OBJECT_TYPE = { MAP_OBJECT: "mapObject" };
  const GameOverHud = globalThis.__gameOverSceneTestHud;
`;
globalThis.__gameOverSceneTestHud = FakeGameOverHud;
const { GameOverScene } = await import(
  `data:text/javascript;base64,${Buffer.from(
    `${dependencies}\n${source}`,
  ).toString("base64")}`
);
delete globalThis.__gameOverSceneTestHud;

function createRoyal(id, calls) {
  return {
    beginGameOver() {
      calls.push(`${id}:begin`);
      return {
        focus: { x: 1, y: 2, z: 3 },
        visualSize: { x: 1, y: 2, z: 1 },
        viewRotation: 0,
      };
    },
    startGameOverPerformance() {
      calls.push(`${id}:start`);
    },
  };
}

function createScene(royals, calls) {
  return new GameOverScene({
    pc: {},
    app: {},
    translate: (key) => key,
    theme: {},
    sceneObjects: {
      getAll: () => royals,
    },
    getViewport: () => ({ panX: 0, panZ: 0, zoom: 1 }),
    getCameraPosition: () => ({ x: 0, y: 0, z: 0 }),
    getCameraState: () => ({
      rotation: 0,
      panX: 0,
      panZ: 0,
      targetY: 0,
      zoom: 1,
      baseOrthoHeight: 10,
    }),
    setCameraState: () => calls.push("camera:set"),
    clearCameraReturn: () => calls.push("camera:clear"),
    updateCamera: () => {},
    cameraPitch: 0,
    mapFitZoom: 1,
  });
}

it("starts no royal reaction before the hero's last life is gone", () => {
  const calls = [];
  const scene = createScene([createRoyal("king", calls)], calls);

  scene.syncHeroState({ lives: 2, gameOver: false });
  scene.syncHeroState({ lives: 1, gameOver: false });

  assert.deepEqual(calls, []);
});

it("starts every royal's own final-death performance once", () => {
  const calls = [];
  const royals = ["king", "queen", "princess"].map((id) =>
    createRoyal(id, calls),
  );
  const scene = createScene(royals, calls);

  scene.syncHeroState({ lives: 0, gameOver: true });
  scene.syncHeroState({ lives: 0, gameOver: true });

  assert.deepEqual(
    calls.filter((call) => /^(king|queen|princess):/.test(call)),
    [
      "king:begin",
      "queen:begin",
      "princess:begin",
      "king:start",
      "queen:start",
      "princess:start",
    ],
  );
});
