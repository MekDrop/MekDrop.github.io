import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { it } from "node:test";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("patting-hand.glb?url")) {
      return {
        url: "data:text/javascript,export default %22patting-hand.glb%22",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { HeroPatHand } = await import(
  "../../src/game/objects/hero/HeroPatHand.js"
);
hooks.deregister();

class FakeEntity {
  enabled = true;
  children = [];
  components = new Map();
  position = { x: 0, y: 0, z: 0 };
  rotation = { x: 0, y: 0, z: 0, w: 1 };
  angles = null;
  scale = null;
  destroyed = false;

  constructor(name) {
    this.name = name;
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type, options) {
    this.components.set(type, options);
    if (type === "anim") {
      this.anim = {
        speed: 1,
        states: [],
        baseLayer: {
          played: [],
          play: (name) => this.anim.baseLayer.played.push(name),
        },
        addAnimationState: (...args) => this.anim.states.push(args),
      };
    }
  }

  setPosition(positionOrX, y, z) {
    this.position = y === undefined
      ? { ...positionOrX }
      : { x: positionOrX, y, z };
  }

  setEulerAngles(x, y, z) {
    this.angles = { x, y, z };
  }

  getPosition() {
    return this.position;
  }

  setRotation(rotation) {
    this.rotation = rotation;
  }

  getRotation() {
    return this.rotation;
  }

  setLocalScale(x, y, z) {
    this.scale = { x, y, z };
  }

  destroy() {
    this.destroyed = true;
  }
}

it("plays one camera-facing double pat at the clicked scalp position, then hides", () => {
  const model = new FakeEntity("Patting hand model");
  const track = { duration: 26 / 24 };
  let patPosition = { x: 3, y: 4, z: 5 };
  let viewRotation = 2;
  let contacts = 0;
  const hand = new HeroPatHand({
    pc: {
      BODYGROUP_USER_3: 512,
      BODYGROUP_USER_4: 1024,
      BODYTYPE_KINEMATIC: "kinematic",
      Entity: FakeEntity,
      Vec3: class {
        constructor(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
      },
    },
    modelLibrary: {
      instantiate: (url) => {
        assert.equal(url, "patting-hand.glb");
        return model;
      },
      getAnimationTracks: (url, names) => {
        assert.equal(url, "patting-hand.glb");
        assert.deepEqual(names, ["Pat"]);
        return new Map([["Pat", track]]);
      },
    },
    getPatPosition: () => patPosition,
    getViewRotation: () => viewRotation,
    onContact: () => { contacts += 1; },
  });

  assert.equal(hand.entity.enabled, false);
  const collider = hand.entity.children[1];
  assert.equal(collider.name, "Hero patting hand collider");
  assert.equal(collider.components.get("collision").type, "box");
  assert.equal(collider.components.get("collision").halfExtents.x, 0.31);
  assert.equal(collider.components.get("collision").halfExtents.y, 0.05);
  assert.equal(collider.components.get("collision").halfExtents.z, 0.34);
  assert.deepEqual(collider.components.get("rigidbody"), {
    type: "kinematic",
    friction: 0,
    restitution: 0,
    group: 1024,
    mask: 512,
  });
  assert.deepEqual(model.scale, { x: 0.75, y: 0.75, z: 0.75 });
  assert.equal(model.anim.speed, 1);
  assert.equal(hand.pat(), true);
  assert.equal(hand.entity.enabled, true);
  assert.deepEqual(hand.entity.position, { x: 3, y: 4, z: 5 });
  assert.deepEqual(hand.entity.angles, { x: 0, y: 225, z: 0 });
  assert.deepEqual(model.anim.baseLayer.played, ["Pat"]);
  assert.equal(hand.pat(), false);
  assert.deepEqual(model.anim.baseLayer.played, ["Pat"]);

  hand.update(0.41);
  assert.equal(hand.entity.enabled, true);
  assert.equal(contacts, 0);
  hand.update(0.01);
  assert.equal(contacts, 1);
  hand.update(0.24);
  assert.equal(contacts, 1);
  hand.update(0.01);
  assert.equal(contacts, 2);
  hand.update(0.42);
  assert.equal(hand.entity.enabled, false);

  for (const [rotation, yaw] of [
    [0, 45],
    [1, 135],
    [2, 225],
    [3, 315],
  ]) {
    viewRotation = rotation;
    assert.equal(hand.pat(), true);
    assert.deepEqual(hand.entity.angles, { x: 0, y: yaw, z: 0 });
    hand.update(2);
    assert.equal(hand.entity.enabled, false);
  }

  assert.equal(hand.pat(), true);
  patPosition = { x: 8, y: 9, z: 10 };
  viewRotation = 3;
  hand.update(0.7);
  assert.equal(hand.entity.enabled, true);
  assert.deepEqual(hand.entity.position, { x: 3, y: 4, z: 5 });
  hand.update(0.4);
  assert.equal(hand.entity.enabled, false);

  hand.destroy();
  assert.equal(hand.entity, null);
});
