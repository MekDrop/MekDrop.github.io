import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec2 } from "playcanvas";
import { IslandConnectorMotion } from "../../../src/game/objects/scenery/IslandConnectorMotion.js";
import { SCENE_OBJECT_TYPE } from "../../../src/game/enum/SceneObjectType.js";

const mapData = {
  cols: 3,
  rows: 1,
  islandConnectorData: { islands: [["0,0"], ["2,0"]] },
};
const source = readFileSync(new URL("../../../src/game/PlayCanvasRenderer.js", import.meta.url), "utf8");
const start = source.indexOf("  #updateIslandConnectorMotion(deltaTime) {");
const end = source.indexOf("  #inventoryFullIndicatorScreenPosition", start);
const method = source.slice(start, end);
const Driver = new Function("SCENE_OBJECT_TYPE", "IslandConnectorMotion", "Vec2", "mapData", `return class {
  #camera; #mapData = mapData; #terrainRenderer;
  #bridgeRailingKit; #sceneObjects;
  #pc = { Vec2 };
  #islandOffsetsApplied = false;
  #islandConnectorMotion = new IslandConnectorMotion(mapData);
  constructor(options) {
    this.#camera = options.camera;
    this.#terrainRenderer = options.target;
    this.#bridgeRailingKit = options.target;
    this.#sceneObjects = options.objects;
  }
  get hero() { return this.#sceneObjects.getOne(); }
  update(deltaTime) { this.#updateIslandConnectorMotion(deltaTime); }
  ${method}
}`)(SCENE_OBJECT_TYPE, IslandConnectorMotion, Vec2, mapData);

it("keeps the nearby island steady while its neighbour moves relative to it", () => {
  const motion = new IslandConnectorMotion(mapData);
  const heights = [];
  for (let frame = 0; frame < 600; frame += 1) {
    const offsets = motion.update(1 / 60, 2, 3, new Vec2(-1, 0));
    assert.equal(offsets.groups[0], 0);
    heights.push(offsets.groups[1]);
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.1);
});

it("shows both islands floating from high above and preserves their relative heights at close range", () => {
  const distant = new IslandConnectorMotion(mapData);
  const close = new IslandConnectorMotion(mapData);
  const a = distant.update(1, 2, 1, new Vec2(1, 0));
  const b = close.update(1, 2, 3, new Vec2(1, 0));
  assert.ok(Math.abs(a.groups[0]) > 0.01);
  assert.ok(Math.abs(a.groups[1]) > 0.01);
  assert.equal(b.groups[1], 0);
  assert.ok(Math.abs((a.groups[1] - a.groups[0]) - (b.groups[1] - b.groups[0])) < 1e-12);
});

it("updates attached visuals together and keeps first-person transforms static", () => {
  const calls = [];
  const camera = {
    firstPersonEnabled: true,
    zoom: 3,
    panX: -1,
    panZ: 0,
  };
  const target = { setIslandOffsets: (...values) => calls.push(values) };
  const hero = {
    position: {
      x: -1,
      z: 0,
    },
    setIslandVisualOffsets: (...values) => calls.push(values),
  };
  const objects = [target];
  objects.getOne = () => hero;
  objects.getWithMethod = () => objects;
  const driver = new Driver({
    camera,
    target,
    objects,
  });
  for (let frame = 0; frame < 120; frame += 1) {
    driver.update(1 / 60);
  }
  assert.equal(calls.length, 4);
  camera.firstPersonEnabled = false;
  driver.update(1);
  assert.equal(calls.length, 8);
  assert.equal(calls.at(-1)[2][0], 0);
  assert.ok(Math.abs(calls.at(-1)[2][1]) > 0.001);
  assert.deepEqual(calls.slice(-4), Array(4).fill(calls.at(-1)));
});
