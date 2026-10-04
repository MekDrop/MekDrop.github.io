import Ammo from "sync-ammo/dist/ammo.module.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { createCastleDoorCollision } from "../../../../../src/game/objects/castle/CastleDoorCollision.js";

const source = readFileSync(new URL("../../../../../src/game/objects/castle/CastleDoor.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");
const Door = new Function("interiorDoorUrl", "castleDoorsModelUrl", "CASTLE_DOOR_ANIMATION", "createCastleDoorCollision", `${source.replace("export class", "class")}\nreturn CastleDoor;`)("interior.glb", "doors.glb", { OPEN: "open", OPEN_WIDE: "wide" }, createCastleDoorCollision);

/**
 * @param {number} floorY
 * @returns {{door: object, entity: object}}
 */
function upperDoor(floorY = 3, side = "NORTH", main = false, placement = null) {
  class Entity extends pc.Entity {
    addComponent(type) {
      if (type === "anim") this.anim = { baseLayer: layer, addAnimationState() {}, update() {} };
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
  let wide = false;
  const layer = { play(name) { wide = name === "wide"; }, set activeStateCurrentTime(time) {
    left.setLocalEulerAngles(0, (main ? wide ? 179 : 105 : wide ? -179 : -90) * time, 0);
    right.setLocalEulerAngles(0, (wide ? -179 : -105) * time, 0);
  } };
  const door = new Door({
    pc: { ...pc, Entity }, castlePosition: { x: 0, z: 0, width: 8, depth: 8, elevation: 0 },
    door: { side, offset: 3, width: main ? 2 : 1 },
    placement: placement ?? (main ? null : { x: 0, y: floorY, z: 2, yaw: 0, height: 2 }),
    modelLibrary: { instantiate: () => entity, getAnimationTracks: () => new Map([["open", { duration: 1 }], ["wide", { duration: 1 }]]) },
    woodMaterial: {},
  });
  return { door, entity };
}

it("keeps an upstairs door closed for ground-floor visitors and clear of ground navigation", () => {
  const { door, entity } = upperDoor();
  assert.deepEqual(entity.getLocalScale().toArray(), [0.5, 2 / 2.4, 0.5]);
  door.updateHeroPosition({ x: 0, y: 0, z: 2 });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2.155, 0.1), true);
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
  assert.equal(door.blocksCameraAt(0, 3.5, 2.155, 0.1), true);
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

it("swings authored inward entrance leaves into the castle in every orientation", () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const yaw = { NORTH: 0, SOUTH: 180, WEST: 90, EAST: -90 }[side];
    const { door, entity } = upperDoor(0, side, true,
      { x: 4, y: 0, z: 4, yaw, height: 2.3, arched: true, swing: "inward" });
    door.openTemporarily(2); door.update(1);
    for (const [index, hinge] of entity.children.entries()) {
      const tip = hinge.getWorldTransform().transformPoint(new pc.Vec3(index === 0 ? .8 : -.8, .5, 0));
      assert.ok(side === "NORTH" ? tip.z > 4 : side === "SOUTH" ? tip.z < 4 :
        side === "WEST" ? tip.x > 4 : tip.x < 4, `${side} leaf ${index} opens inside`);
    }
  }
});

it("keeps every wide-open interior door leaf solid while clearing its aperture", () => {
  const { door, entity } = upperDoor(0, "NORTH", false,
    { x: 0, y: 0, z: 2, yaw: 0, height: 2 });
  door.openTemporarily(2); door.update(1);
  const point = entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(1, .5, 0));
  assert.equal(door.blocksCameraAt(point.x, point.y, point.z, .1), true);
  assert.equal(door.blocksCameraAt(0, .5, 2, .1), false);
});

it("stops an interior swing at a real Ammo wall and resumes when it is removed", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const resources = [];
  const { door, entity } = upperDoor(0);
  entity._enabledInHierarchy = true;
  const colliders = entity.findComponents("render").map(render => render.entity.children[0]);
  for (const collider of colliders) {
    collider._enabledInHierarchy = true;
    const extents = new Ammo.btVector3(.5, .95, .025);
    const shape = new Ammo.btBoxShape(extents);
    const nativeBody = new Ammo.btPairCachingGhostObject();
    nativeBody.setCollisionShape(shape);
    world.addCollisionObject(nativeBody, 2, -1);
    collider.rigidbody = { system: { dynamicsWorld: world }, body: nativeBody, syncEntityToBody() {} };
    resources.push(nativeBody, shape, extents);
  }
  const wallExtents = new Ammo.btVector3(2, 2, .05);
  const wallShape = new Ammo.btBoxShape(wallExtents);
  const wall = new Ammo.btPairCachingGhostObject();
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const position = new Ammo.btVector3(0, 1, 2.75);
  transform.setOrigin(position);
  wall.setCollisionShape(wallShape);
  wall.setCollisionFlags(1);
  wall.setWorldTransform(transform);
  world.addCollisionObject(wall, 1, -1);
  resources.push(wall, wallShape, wallExtents, transform, position);
  try {
    door.openTemporarily(10);
    door.update(1);
    const stopped = Math.abs(entity.children[0].getLocalEulerAngles().y);
    assert.ok(stopped > 20 && stopped < 80, "wall stops the leaf before its full swing");
    door.update(.1);
    assert.ok(Math.abs(Math.abs(entity.children[0].getLocalEulerAngles().y) - stopped) < .01,
      "blocked opening does not creep through the wall");
    world.removeCollisionObject(wall);
    door.update(1);
    assert.ok(Math.abs(entity.children[0].getLocalRotation().w) < .018, "clear door uses the full swing");
    door.update(20);
    assert.ok(Math.abs(entity.children[0].getLocalEulerAngles().y) < .01, "door still closes");
  } finally {
    world.removeCollisionObject(wall);
    door.destroy();
    for (const collider of colliders) world.removeCollisionObject(collider.rigidbody.body);
    for (const resource of resources) Ammo.destroy(resource);
    for (const resource of [world, solver, broadphase, dispatcher, configuration]) Ammo.destroy(resource);
    globalThis.Ammo = previousAmmo;
  }
});

it("clicks the moving leaf at closed, intermediate and fully open poses", () => {
  const { door, entity } = upperDoor(0);
  const collider = entity.findComponents("render")[0].entity.children[0];
  for (const step of [0, .2, 1]) {
    door.openTemporarily(10); door.update(step);
    const transform = collider.getWorldTransform();
    const start = transform.transformPoint(new pc.Vec3(0, 0, -.5));
    const end = transform.transformPoint(new pc.Vec3(0, 0, .5));
    const hit = door.getPointerHit(start, end);
    assert.equal(hit?.pointerTarget, door, "click follows the leaf rather than the closed doorway");
    assert.ok(hit.distance >= 0 && hit.distance <= 1);
    assert.equal(hit.pointerTarget.handlePointerDown(), true);
  }
  assert.equal(door.getPointerHit(new pc.Vec3(10, 1, 0), new pc.Vec3(10, 1, 4)), null);
});
