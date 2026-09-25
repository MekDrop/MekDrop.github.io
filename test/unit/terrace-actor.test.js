import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerraceActor } from "../../src/game/objects/castle/TerraceActor.js";
import { TERRACE_ACTOR_ANIMATION } from "../../src/game/enum/TerraceActorAnimation.js";

// Exercise the authored object hierarchy without a GPU context.
function royalModel(kind) {
  const directory = kind.endsWith("servant") ? "leisure" : "royals";
  const buffer = readFileSync(new URL(
    `../../src/game/models/castle/${directory}/${kind}.glb`, import.meta.url,
  ));
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
  const nodes = gltf.nodes.map((node) => {
    const entity = new pc.Entity(node.name);
    entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
    entity.setLocalRotation(new pc.Quat(...(node.rotation ?? [0, 0, 0, 1])));
    entity.setLocalScale(...(node.scale ?? [1, 1, 1]));
    return entity;
  });
  const meshes = [];
  gltf.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      nodes[index].addChild(nodes[child]);
    }
    for (const primitive of gltf.meshes[node.mesh]?.primitives ?? []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      const local = new pc.BoundingBox();
      local.setMinMax(new pc.Vec3(...accessor.min), new pc.Vec3(...accessor.max));
      meshes.push({
        node: nodes[index],
        get aabb() {
          const transformed = new pc.BoundingBox();
          transformed.setFromTransformedAabb(local, nodes[index].getWorldTransform());
          return transformed;
        },
      });
    }
  });
  const root = new pc.Entity("Imported royal");
  for (const index of gltf.scenes[gltf.scene].nodes) {
    root.addChild(nodes[index]);
  }
  root.findComponents = (type) => type === "render" ? [{ meshInstances: meshes }] : [];
  return { root, meshes, gltf };
}

for (const kind of ["king", "queen", "princess", "servant", "elder-servant"]) {
  it(`normalizes ${kind} and preserves placement and facial attachments`, () => {
    const { root, meshes } = royalModel(kind);
    const actor = new TerraceActor({ pc, kind, modelUrl: kind, modelLibrary: { instantiate: () => root } });
    const bodyMeshes = meshes.filter((mesh) => !/sword|tear|handkerchief/i.test(mesh.node.name));
    const bottom = Math.min(...bodyMeshes.map((mesh) => mesh.aabb.center.y - mesh.aabb.halfExtents.y));
    const top = Math.max(...bodyMeshes.map((mesh) => mesh.aabb.center.y + mesh.aabb.halfExtents.y));
    assert.ok(Math.abs(bottom) < 0.00001, `feet at ${bottom}`);
    assert.ok(Math.abs(top - 2.2) < 0.00001, `height ${top}`);
    const head = root.findByName("Royal head rig");
    const eye = root.findByName("Royal right eye");
    const eyeOffset = eye?.getLocalPosition().clone();
    actor.entity.setLocalPosition(8, 3, 5);
    actor.entity.setLocalEulerAngles(0, 45, 0);
    actor.entity.setLocalScale(0.3, 0.3, 0.3);
    for (const action of ["walk", "carry", "place", "pour", "sit", "drink",
      "mountSunbed", "recline", "read", "sword", "idle"]) {
      for (const time of [0, 1.5, 4.5, 7.5]) {
        actor.pose(action, time, 0.5);
        if (eye) {
          assert.equal(eye.parent, head);
          assert.ok(eye.getLocalPosition().equals(eyeOffset));
        }
        assert.ok(actor.entity.getLocalPosition().equals(new pc.Vec3(8, 3, 5)));
        for (const mesh of meshes) {
          assert.ok(Array.from(mesh.node.getWorldTransform().data).every(Number.isFinite));
        }
      }
    }
    assert.notEqual(root.findByName("Royal tear right")?.enabled, true);
    actor.destroy();
  });
}

it("keeps the authored sword attached to the animated king hand", () => {
  const { root } = royalModel("king");
  const actor = new TerraceActor({ pc, kind: "king", modelUrl: "king", modelLibrary: { instantiate: () => root } });
  const sword = root.findByName("King sword");
  const grip = sword.getLocalPosition().clone();
  assert.equal(sword.parent, actor.leftHand);
  assert.ok(sword.getLocalPosition().equals(grip));
  actor.destroy();
});

const expectedAnimations = new Map([
  ["queen", [
    TERRACE_ACTOR_ANIMATION.IDLE,
    TERRACE_ACTOR_ANIMATION.WALK,
    TERRACE_ACTOR_ANIMATION.MOUNT_SUNBED,
    TERRACE_ACTOR_ANIMATION.RECLINE,
    TERRACE_ACTOR_ANIMATION.READ,
  ]],
  ["princess", [
    TERRACE_ACTOR_ANIMATION.IDLE,
    TERRACE_ACTOR_ANIMATION.WALK,
    TERRACE_ACTOR_ANIMATION.SIT,
    TERRACE_ACTOR_ANIMATION.DRINK,
  ]],
  ["servant", [
    TERRACE_ACTOR_ANIMATION.CLOSE_DOOR,
    TERRACE_ACTOR_ANIMATION.IDLE,
    TERRACE_ACTOR_ANIMATION.WALK,
    TERRACE_ACTOR_ANIMATION.CARRY,
    TERRACE_ACTOR_ANIMATION.PLACE,
    TERRACE_ACTOR_ANIMATION.POUR,
  ]],
  ["elder-servant", [
    TERRACE_ACTOR_ANIMATION.IDLE,
    TERRACE_ACTOR_ANIMATION.WALK,
    TERRACE_ACTOR_ANIMATION.CARRY,
    TERRACE_ACTOR_ANIMATION.PLACE,
    TERRACE_ACTOR_ANIMATION.POUR,
  ]],
]);

for (const [kind, names] of expectedAnimations) {
  it(`embeds ${kind} terrace motion in the editable model export`, () => {
    const { gltf } = royalModel(kind);
    const animations = new Map(
      gltf.animations.map((animation) => [animation.name, animation]),
    );
    for (const name of names) {
      const animation = animations.get(name);
      assert.ok(animation, `missing embedded animation ${name}`);
      const targets = new Set(animation.channels.map((channel) =>
        gltf.nodes[channel.target.node].name));
      for (const target of [
        "Royal animation rig",
        "Royal head rig",
        "Royal left arm rig",
        "Royal right arm rig",
        "Royal left leg rig",
        "Royal right leg rig",
      ]) {
        assert.ok(targets.has(target), `${name} does not animate ${target}`);
      }
    }
  });
}

it("articulates the servant's boots below knee joints and embeds knee bends", () => {
  const { gltf } = royalModel("servant");
  for (const side of ["left", "right"]) {
    const index = gltf.nodes.findIndex(({ name }) => name === `Servant ${side} knee`);
    assert.ok(index >= 0);
    const descendants = gltf.nodes[index].children.map((child) => gltf.nodes[child].name);
    assert.ok(descendants.includes(`${side} boot`));
    assert.ok(descendants.includes(`${side} lower trouser`));
    for (const name of ["TerraceWalk", "TerraceCarry", "TerraceTurn", "TerraceCloseDoor"]) {
      const clip = gltf.animations.find((animation) => animation.name === name);
      const channel = clip.channels.find(({ target }) => target.node === index && target.path === "rotation");
      assert.ok(channel, `${name} must animate the ${side} knee`);
      assert.ok(gltf.accessors[clip.samplers[channel.sampler].output].count > 2);
    }
  }
});

for (const kind of ["servant", "elder-servant"]) {
  it(`${kind} keeps forearms and cuffs centered on the elbow and wrist`, () => {
    const { root, meshes } = royalModel(kind);
    for (const side of ["left", "right"]) {
      const elbow = root.findByName(`Servant ${side} elbow`);
      const forearm = root.findByName(`${side} forearm`);
      const cuff = root.findByName(`${side} rolled linen cuff`);
      const joint = root.findByName(`${side} covered elbow joint`);
      const hand = root.findByName(`Royal ${side} hand`);
      assert.equal(forearm.parent, elbow);
      assert.equal(cuff.parent, elbow);
      assert.equal(joint.parent, elbow);
      assert.equal(hand.parent, elbow);
      assert.ok(Math.abs(forearm.getLocalPosition().x) < 0.001);
      assert.ok(Math.abs(cuff.getLocalPosition().x) < 0.001);
      // The forearm reaches the elbow pivot, rather than floating beside it.
      const bounds = meshes.find((mesh) => mesh.node === forearm).aabb;
      assert.ok(bounds.containsPoint(elbow.getPosition()));
    }
  });
}
