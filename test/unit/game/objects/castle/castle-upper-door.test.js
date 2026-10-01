import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../../../../../src/game/objects/castle/CastleDoor.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");
const Door = new Function("castleDoorsModelUrl", "CASTLE_DOOR_ANIMATION", `${source.replace("export class", "class")}\nreturn CastleDoor;`)("doors.glb", { OPEN: "open" });

/**
 * @param {number} floorY
 * @returns {{door: object, entity: object}}
 */
function upperDoor(floorY = 3) {
  const layer = { activeStateCurrentTime: 0, play() {} };
  const entity = {
    name: "doors", children: [], scale: null,
    setLocalPosition() {}, setLocalEulerAngles() {},
    setLocalScale(...scale) { this.scale = scale; },
    addComponent() { this.anim = { baseLayer: layer, addAnimationState() {} }; },
  };
  const door = new Door({
    pc: {}, castlePosition: { x: 0, z: 0, width: 8, depth: 8, elevation: 0 },
    door: { side: "NORTH", width: 1 },
    placement: { x: 0, y: floorY, z: 2, yaw: 0, height: 2 },
    modelLibrary: { instantiate: () => entity, getAnimationTracks: () => new Map([["open", { duration: 1 }]]) },
    woodMaterial: {},
  });
  return { door, entity };
}

it("keeps an upstairs door closed for ground-floor visitors and clear of ground navigation", () => {
  const { door, entity } = upperDoor();
  assert.deepEqual(entity.scale, [0.5, 2 / 2.3, 1]);
  door.updateHeroPosition({ x: 0, y: 0, z: 2 });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2, 0.1), true);
  assert.equal(door.intersectsFootprint(0, 2, 0.1), false);
  assert.equal(door.blocksCameraAt(0, 0.5, 2, 0.1), false);
});

it("opens the authored door animation for visitors on the bedroom floor and closes when they leave", () => {
  const { door } = upperDoor();
  door.updateHeroPosition({ x: 0, y: 3, z: 1.5 });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2, 0.1), false);
  door.updateHeroPosition({ x: 0, y: 0, z: 1.5 });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2, 0.1), true);
});
it("keeps a generated ground courtyard doorway solid until its animation opens", () => {
  const { door } = upperDoor(0);
  assert.equal(door.intersectsFootprint(0, 2, 0.18), true);
  door.updateHeroPosition({ x: 0, y: 0, z: 1.5 });
  door.update(1);
  assert.equal(door.intersectsFootprint(0, 2, 0.18), false);
});