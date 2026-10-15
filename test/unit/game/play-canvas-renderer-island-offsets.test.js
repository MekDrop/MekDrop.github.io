import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { SCENE_OBJECT_TYPE } from "../../../src/game/enum/SceneObjectType.js";

const source = readFileSync(new URL("../../../src/game/PlayCanvasRenderer.js", import.meta.url), "utf8");
const start = source.indexOf("  #updateIslandConnectorMotion(deltaTime) {");
const end = source.indexOf("  #updateFloatingIslandMotion", start);
const method = source.slice(start, end).replace(/\s*\/\*\*[\s\S]*?\*\/\s*$/, "");
const Driver = new Function("SCENE_OBJECT_TYPE", `return class {
  #islandConnectorMotion; #camera; #mapData; #terrainRenderer;
  #groundCover; #bridgeRailingKit; #sceneObjects;
  #firstPersonIslandOffsetsApplied = false;
  constructor(options) {
    this.#islandConnectorMotion = options.motion;
    this.#camera = options.camera;
    this.#mapData = { islandConnectorData: { islands: [0, 1] } };
    this.#terrainRenderer = options.target;
    this.#groundCover = options.target;
    this.#bridgeRailingKit = options.target;
    this.#sceneObjects = options.objects;
  }
  update(deltaTime) { this.#updateIslandConnectorMotion(deltaTime); }
  ${method}
}`)(SCENE_OBJECT_TYPE);

it("applies fixed first-person island transforms once and resumes floating updates on exit", () => {
  const calls = [];
  const camera = { firstPersonEnabled: true };
  const target = { setIslandOffsets: (...values) => calls.push(values) };
  const hero = { setIslandVisualOffsets: (...values) => calls.push(values) };
  const objects = [target];
  objects.getOne = () => hero;
  let motionUpdates = 0;
  const motion = {
    update() {
      motionUpdates += 1;
      return {
        near: 0.1,
        far: -0.2,
        groups: [0.1, -0.2],
      };
    },
  };
  const driver = new Driver({
    camera,
    target,
    objects,
    motion,
  });
  for (let frame = 0; frame < 120; frame += 1) {
    driver.update(1 / 60);
  }
  assert.equal(calls.length, 4);
  assert.equal(motionUpdates, 0);
  assert.ok(calls.every((values) => JSON.stringify(values) === "[0,0,[0,0]]"));

  camera.firstPersonEnabled = false;
  driver.update(1 / 60);
  driver.update(1 / 60);
  assert.equal(motionUpdates, 2);
  assert.equal(calls.length, 12);
  assert.deepEqual(calls.at(-1), [0.1, -0.2, [0.1, -0.2]]);

  camera.firstPersonEnabled = true;
  driver.update(1 / 60);
  assert.equal(calls.length, 16);
  assert.deepEqual(calls.at(-1), [0, 0, [0, 0]]);
});
