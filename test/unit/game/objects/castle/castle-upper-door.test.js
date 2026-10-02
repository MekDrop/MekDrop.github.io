import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { createCastleDoorCollision } from "../../../../../src/game/objects/castle/CastleDoorCollision.js";

const source = readFileSync(new URL("../../../../../src/game/objects/castle/CastleDoor.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");
const Door = new Function("interiorDoorUrl", "castleDoorsModelUrl", "CASTLE_DOOR_ANIMATION", "createCastleDoorCollision", `${source.replace("export class", "class")}\nreturn CastleDoor;`)("interior.glb", "doors.glb", { OPEN: "open" }, createCastleDoorCollision);

/**
 * @param {number} floorY
 * @returns {{door: object, entity: object}}
 */
function upperDoor(floorY = 3, side = "NORTH", main = false) {
  class Entity extends pc.Entity {
    addComponent(type) {
      if (type === "anim") this.anim = { baseLayer: layer, addAnimationState() {} };
    }
  }
  const entity = new Entity("doors");
  const left = new Entity("Left hinge"), right = new Entity("Right hinge");
  left.setLocalPosition(-1, 0, 0); right.setLocalPosition(1, 0, 0);
  entity.addChild(left); if (main) entity.addChild(right);
  const renders = (main ? [left, right] : [left]).map((hinge, index) => {
    const plank = new Entity("Castle door plank"); hinge.addChild(plank);
    const x = index === 0 ? [0, main ? 1 : 2] : [-1, 0];
    return { entity: plank, meshInstances: [{ mesh: { getPositions(out) {
      out.push(x[0], 0, -.05, x[1], 2.275, .05);
    } } }] };
  });
  entity.findComponents = () => renders;
  const layer = { play() {}, set activeStateCurrentTime(time) {
    left.setLocalEulerAngles(0, (main ? 105 : -90) * time, 0);
    right.setLocalEulerAngles(0, -105 * time, 0);
  } };
  const door = new Door({
    pc: { ...pc, Entity }, castlePosition: { x: 0, z: 0, width: 8, depth: 8, elevation: 0 },
    door: { side, offset: 3, width: main ? 2 : 1 },
    placement: main ? null : { x: 0, y: floorY, z: 2, yaw: 0, height: 2 },
    modelLibrary: { instantiate: () => entity, getAnimationTracks: () => new Map([["open", { duration: 1 }]]) },
    woodMaterial: {},
  });
  return { door, entity };
}

it("keeps an upstairs door closed for ground-floor visitors and clear of ground navigation", () => {
  const { door, entity } = upperDoor();
  assert.deepEqual(entity.getLocalScale().toArray(), [0.5, 2 / 2.3, 0.5]);
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
it("collides with an open leaf instead of the empty doorway", () => {
  const { door, entity } = upperDoor(0);
  door.updateHeroPosition({ x: 0, y: 0, z: 1.5 });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, .5, 2, .1), false);
  const point = entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(.5, .5, 0));
  assert.equal(door.blocksCameraAt(point.x, point.y, point.z, .1), true);
});

it("folds exterior leaves away from the castle walls in every orientation", () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const { door, entity } = upperDoor(0, side, true);
    door.openTemporarily(2); door.update(1);
    const tip = entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(.8, .5, 0));
    assert.ok(side === "NORTH" ? tip.z < 0 : side === "SOUTH" ? tip.z > 8 :
      side === "WEST" ? tip.x < 0 : tip.x > 8, `${side} door clears the exterior jamb`);
  }
});
