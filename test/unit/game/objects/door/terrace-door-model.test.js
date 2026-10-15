import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { it } from "node:test";
import * as pc from "playcanvas";
import { Door } from "../../../../../src/game/objects/door/Door.js";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/terrace-(door|stairhead)\.glb\?url$/.test(specifier)) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { terraceDoorModel } = await import("../../../../../src/game/objects/door/DoorModels.js");
hooks.deregister();

function fixture() {
  const hinge = new pc.Entity("Terrace door hinge");
  hinge.setLocalPosition(-0.5, 0, 0.31);
  const layer = {
    play() {},
    activeStateCurrentTime: 0,
  };
  let clicks = 0;
  const door = new Door({
    ...terraceDoorModel,
    pc,
    onOpen: () => { clicks += 1;

      return true; },
    modelLibrary: {
      instantiate(url) {
        const root = new pc.Entity("Imported model");
        if (url.includes("terrace-door")) {
          root.addChild(hinge);
          root.addComponent = () => {
            root.anim = {
              addAnimationState() {},
              update() {},
              baseLayer: layer,
            };
          };
        }
        return root;
      },
      getAnimationTracks: () => new Map([["Open", { duration: 2 }]]),
    },
  });
  const ray = (x, y) => {
    const matrix = hinge.getWorldTransform();

    return [matrix.transformPoint(new pc.Vec3(x, y, 2)),
      matrix.transformPoint(new pc.Vec3(x, y, -2))];
  };

  return {
    door,
    hinge,
    layer,
    ray,
    clicks: () => clicks,
  };
}

it("picks the actual swinging leaf through rotated and translated castle transforms", () => {
  const f = fixture();
  f.door.entity.setLocalPosition(8, 4, -6);
  f.door.entity.setLocalEulerAngles(0, 90, 0);
  for (const yaw of [0, -45, -100]) {
    f.hinge.setLocalEulerAngles(0, yaw, 0);
    const hit = f.door.getPointerHit(...f.ray(0.8, 0.64));
    assert.ok(hit);
    assert.ok(Math.abs(hit.distance - 0.5) < 0.00001);
    assert.equal(hit.pointerTarget, f.door);
    assert.equal(f.door.getPointerHit(...f.ray(1.2, 0.64)), null);
    assert.equal(f.door.getPointerHit(...f.ray(0.8, 1.5)), null);
  }
  assert.equal(f.door.handlePointerDown(), true);
  assert.equal(f.clicks(), 1);
  f.door.destroy();
  assert.equal(f.door.getPointerHit(new pc.Vec3(), new pc.Vec3()), null);
});

it("samples the embedded opening clip slowly for wind and closes fully", () => {
  const { door, layer } = fixture();
  door.update(0.5, true, 0.65);
  assert.equal(door.openAmount, 0.325);
  assert.equal(layer.activeStateCurrentTime, 0.65);
  door.update(2, true, 0.65);
  assert.equal(door.openAmount, 1);
  door.openAmount = 0.5;
  assert.equal(layer.activeStateCurrentTime, 1);
  door.openAmount = -1;
  assert.equal(door.openAmount, 0);
  door.update(1, false);
  assert.equal(door.openAmount, 0);
  assert.equal(layer.activeStateCurrentTime, 0);
  door.destroy();
});

it("owns the structure separately from its door and destroys both together", () => {
  const { door } = fixture();
  const parent = new pc.Entity("Terrace");
  parent.addChild(door.entity);
  assert.equal(door.entity.children.length, 1);
  assert.equal(door.insideHandle, null);
  door.destroy();
  assert.equal(parent.children.length, 0);
  assert.equal(door.entity, null);
});
