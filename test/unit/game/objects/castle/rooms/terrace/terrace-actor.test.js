import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerraceActor } from "../../../../../../../src/game/objects/castle/rooms/terrace/TerraceActor.js";
import { TERRACE_ACTOR_ANIMATION } from "../../../../../../../src/game/enum/TerraceActorAnimation.js";

// Exercise the authored object hierarchy without a GPU context.
function royalModel(kind) {
  const directory = kind.endsWith("servant") ? "leisure" : "royals";
  const buffer = readFileSync(new URL(
    `../../../../../../../src/game/models/castle/${directory}/${kind}.glb`, import.meta.url,
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

  return {
    root,
    meshes,
    gltf,
    buffer,
  };
}

for (const kind of ["king", "queen", "princess", "servant", "elder-servant"]) {
  it(`normalizes ${kind} and preserves placement and facial attachments`, () => {
    const { root, meshes } = royalModel(kind);
    const actor = new TerraceActor({
      pc,
      kind,
      modelUrl: kind,
      modelLibrary: { instantiate: () => root },
    });
    if (kind.endsWith("servant")) {
      for (const side of ["left", "right"]) {
        const grip = side === "left" ? actor.leftHand : actor.rightHand;
        assert.equal(grip.name, `Servant ${side} grip`);
        assert.equal(grip.parent.name, `Royal ${side} hand`);
        const offset = grip.getPosition().distance(grip.parent.getPosition());
        assert.ok(offset > 0.03 && offset < 0.07, `palm offset ${offset}`);
      }
    }
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

it("absorbs a completed sidestep into navigation without moving the visible model", () => {
  const { root } = royalModel("king");
  const actor = new TerraceActor({
    pc,
    kind: "king",
    modelUrl: "king",
    modelLibrary: { instantiate: () => root },
  });
  actor.entity.setPosition(8, 3, 5);
  actor.entity.setEulerAngles(0, 45, 0);
  actor.entity.setLocalScale(0.3, 0.3, 0.3);
  const reactionRoot = actor.entity.findByName("NPC doorway reaction");
  reactionRoot.setLocalPosition(1, 0, -0.5);
  const visible = root.getPosition().clone();
  const navigation = reactionRoot.getPosition().clone();
  assert.equal(actor.settleNavigationOffset(), true);
  assert.ok(root.getPosition().distance(visible) < 0.00001);
  assert.ok(actor.entity.getPosition().distance(navigation) < 0.00001);
  assert.ok(reactionRoot.getLocalPosition().equals(pc.Vec3.ZERO));
  assert.equal(actor.settleNavigationOffset(), false);
  actor.destroy();
});

it("keeps the authored sword attached to the animated king hand", () => {
  const { root } = royalModel("king");
  const actor = new TerraceActor({
    pc,
    kind: "king",
    modelUrl: "king",
    modelLibrary: { instantiate: () => root },
  });
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

for (const kind of ["servant", "elder-servant"]) {
  it(`${kind} exports deforming knees, wrists and all five finger chains`, () => {
    const { gltf, buffer } = royalModel(kind);
    const binaryOffset = 28 + buffer.readUInt32LE(12);
    const values = (index) => {
      const accessor = gltf.accessors[index];
      const view = gltf.bufferViews[accessor.bufferView];
      const components = {
        SCALAR: 1,
        VEC3: 3,
        VEC4: 4,
      }[accessor.type];
      const bytes = {
        5121: 1,
        5123: 2,
        5126: 4,
      }[accessor.componentType];
      const result = [];
      for (let item = 0; item < accessor.count; item++) {
        for (let component = 0; component < components; component++) {
          const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) +
          item * (view.byteStride ?? components * bytes) + component * bytes;
          result.push(bytes === 4 ? buffer.readFloatLE(offset) : bytes === 2 ? buffer.readUInt16LE(offset) : buffer.readUInt8(offset));
        }
      }

      return result;
    };
    const influenced = new Set();
    for (const node of gltf.nodes) {
      if (node.skin === undefined) {
        continue;
      }
      const skin = gltf.skins[node.skin];
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const joints = values(primitive.attributes.JOINTS_0);
        const weights = values(primitive.attributes.WEIGHTS_0);
        for (let index = 0; index < joints.length; index++) {
          if (weights[index] > 0.01) {
            influenced.add(gltf.nodes[skin.joints[joints[index]]].name);
          }
        }
      }
    }
    for (const side of ["left", "right"]) {
      const index = gltf.nodes.findIndex(({ name }) => name === `Servant ${side} knee`);
      assert.ok(index >= 0);
      assert.ok(influenced.has(`Servant ${side} knee`));
      assert.ok(influenced.has(`Servant ${side} elbow`));
      assert.ok(influenced.has(`Royal ${side} hand`));
      for (const finger of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
        for (let segment = 1; segment <= 3; segment++) {
          assert.ok(influenced.has(`mixamorig:${side === "left" ? "Left" : "Right"}Hand${finger}${segment}`));
        }
      }
      for (const name of ["TerraceWalk", "TerraceCarry", "TerraceTurn", "TerraceCloseDoor",
        "TerraceStairUp", "TerraceStairDown", "TerraceCarryStairUp", "TerraceCarryStairDown"]) {
        const clip = gltf.animations.find((animation) => animation.name === name);
        const channel = clip.channels.find(({ target }) => target.node === index && target.path === "rotation");
        assert.ok(channel, `${name} must animate the ${side} knee`);
        assert.ok(gltf.accessors[clip.samplers[channel.sampler].output].count > 2, `${kind} ${name} ${side} knee is static`);
        for (const sampler of clip.samplers) {
          assert.ok(values(sampler.output).every(Number.isFinite), `${name} contains non-finite motion`);
        }
      }
    }
  });
}

for (const kind of ["servant", "elder-servant"]) {
  it(`${kind} keeps both palms on prop grips at different furniture scales`, async () => {
    const { TerracePropGrip } = await import("../../../../../../../src/game/objects/castle/rooms/terrace/TerracePropGrip.js");
    for (const scale of [0.26, 0.45, 0.68]) {
      const { root, gltf, buffer } = royalModel(kind);
      const actor = new TerraceActor({
        pc,
        kind: "servant",
        modelUrl: kind,
        modelLibrary: {instantiate: () => root},
      });
      const scene = new pc.Entity();
      scene.addChild(actor.entity);
      actor.entity.setLocalPosition(3, 2, 4);
      actor.entity.setLocalScale(0.62, 0.62, 0.62);
      actor.entity.setLocalEulerAngles(0, 73, 0);
      const binary = 28 + buffer.readUInt32LE(12);
      const read = (accessorIndex, count) => {
        const accessor = gltf.accessors[accessorIndex];
        const view = gltf.bufferViews[accessor.bufferView];
        const offset = binary + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

        return Array.from({length: accessor.count}, (_, i) => Array.from({length: count}, (_, j) =>
          buffer.readFloatLE(offset + i * (view.byteStride ?? count * 4) + j * 4)));
      };
      const clip = gltf.animations.find(a => a.name === "TerraceCarry");
      for (const channel of clip.channels) {
        const sampler = clip.samplers[channel.sampler];
        const node = root.findByName(gltf.nodes[channel.target.node].name);
        const values = read(sampler.output, channel.target.path === "rotation" ? 4 : 3);
        const value = values[Math.min(values.length - 1, 10)];
        if (channel.target.path === "rotation") {
          node.setLocalRotation(new pc.Quat(...value));
        }
        if (channel.target.path === "translation") {
          node.setLocalPosition(...value);
        }
      }
      const stage = new pc.Entity();
      stage.setLocalScale(scale, scale, scale);
      stage.setLocalEulerAngles(0, -31, 0);
      scene.addChild(stage);
      const saved = actor.leftHand.getPosition().clone();
      for (const grips of [
        [[-0.415, 1.069, -0.468], [0.415, 1.069, -0.468]],
        [[-0.19, 0.43, 0], [0.19, 0.43, 0]],
        [[-0.425, 0.09, 0.335], [0.425, 0.09, 0.335]],
        [[-0.55, 0.105, 0], [0.55, 0.105, 0]],
      ]) {
        const prop = new pc.Entity(); stage.addChild(prop);
        prop.setRotation(actor.entity.getRotation());
        prop.setLocalPosition(TerracePropGrip.carryPosition(pc, stage, prop, actor, grips));
        TerracePropGrip.align(pc, prop, actor, grips);
        const points = grips.map(p => prop.getWorldTransform().transformPoint(new pc.Vec3(...p)));
        for (const hand of [actor.leftHand, actor.rightHand]) {
          assert.ok(Math.min(...points.map(p => p.distance(hand.getPosition()))) < 0.0001,
            `${kind} scale ${scale}: grip separation ${points.map(p => p.distance(hand.getPosition()))}`);
        }
        actor.pose("idle");
        assert.ok(saved.distance(actor.leftHand.getPosition()) < 0.0001, "contact adjustments restore before the next pose");
        prop.destroy();
      }
      actor.destroy();stage.destroy();scene.destroy();
    }
  });
}
