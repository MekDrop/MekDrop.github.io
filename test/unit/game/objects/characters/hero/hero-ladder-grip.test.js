import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { HERO_MODEL_SCALE } from "../../../../../../src/game/config/character-size.js";
import { HeroLadderGrip, ladderHandReach } from "../../../../../../src/game/objects/characters/hero/HeroLadderGrip.js";

it("plants hands and boots on physical rungs without stretching the limbs", () => {
  const bytes = readFileSync(new URL("../../../../../../src/game/models/hero/hero.glb", import.meta.url));
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  const nodes = gltf.nodes.map(node => {
    const entity = new pc.Entity(node.name);
    entity.setLocalPosition(...(node.translation ?? [0, 0, 0]));
    entity.setLocalRotation(...(node.rotation ?? [0, 0, 0, 1]));
    entity.setLocalScale(...(node.scale ?? [1, 1, 1]));
    if (node.mesh !== undefined) {
      const bounds = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
      const min = new pc.Vec3(...bounds.min), max = new pc.Vec3(...bounds.max);
      const aabb = new pc.BoundingBox();
      aabb.setMinMax(min, max);
      entity.render = { meshInstances: [{ mesh: { aabb } }] };
    }

    return entity;
  });
  gltf.nodes.forEach((node, index) => node.children?.forEach(child => nodes[index].addChild(nodes[child])));
  const climb = gltf.animations.find(clip => clip.name === "Climb");
  for (const channel of climb.channels) {
    if (["translation", "rotation"].includes(channel.target.path)) {
      const accessor = gltf.accessors[climb.samplers[channel.sampler].output];
      const view = gltf.bufferViews[accessor.bufferView];
      const start = 28 + bytes.readUInt32LE(12) + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const node = nodes[channel.target.node];
      if (channel.target.path === "translation") {
        node.setLocalPosition(...[0, 4, 8].map(offset => bytes.readFloatLE(start + offset)));
      } else {
        node.setLocalRotation(...[0, 4, 8, 12].map(offset => bytes.readFloatLE(start + offset)));
      }
    }
  }
  const root = new pc.Entity("hero");
  for (const index of gltf.scenes[gltf.scene ?? 0].nodes) {
    root.addChild(nodes[index]);
  }
  root.setLocalScale(HERO_MODEL_SCALE, HERO_MODEL_SCALE, HERO_MODEL_SCALE);
  const grip = new HeroLadderGrip(pc, root);
  const spacing = 0.27 * 3 / 3.7;
  const ladder = {
    climbFacing: {
      x: 0,
      z: 1,
    },
    handhold: (index, side) => new pc.Vec3(side * 0.2, (0.255 + Math.max(0, Math.min(12, index)) * 0.27) * 3 / 3.7, -0.015),
    foothold: (index, side) => new pc.Vec3(side * 0.2, (index < 0 ? 0 : 0.2385 + Math.min(12, index) * 0.27) * 3 / 3.7, -0.01),
  };
  for (let height = 0.1; height < 2.1; height += 0.02) {
    grip.restore();
    root.setPosition(0, height, -0.33);
    grip.update({
      ladder,
      transferring: false,
    }, {
      x: 0,
      y: height,
      z: -0.33,
    }, 0.02 / 0.6);
    for (const [name, side, offset] of [["Left", -1, 0], ["Right", 1, 0.5]]) {
      const phase = (height + 0.62 - ladder.handhold(0, 0).y) / spacing + offset;
      if (phase % 1 < 0.55) {
        const hand = root.findByName(`${name} white glove`).getPosition();
        assert.ok(hand.distance(ladder.handhold(Math.floor(phase), side)) < 0.025, `${name} grip at height ${height}: ${JSON.stringify({
          hand,
          target: ladder.handhold(Math.floor(phase), side),
          shoulder: root.findByName(`${name} arm`).getPosition(),
        })}`);
        const knuckle = root.findByName(`${name} middle 3`).getPosition();
        assert.ok(knuckle.z > hand.z + 0.03, "fingers reach over the rung toward the ladder");
        const palm = root.findByName(`${name} white glove`).getRotation().transformVector(new pc.Vec3(0, 0, 1));
        assert.ok(palm.y < -0.99, "palm faces down instead of presenting an upright fist");
        const thumb = root.findByName(`${name} thumb 2`).getPosition();
        assert.ok(thumb.y < hand.y - 0.02, "thumb opposes the fingers below the palm rather than pointing upward");
      }
      const elbow = root.findByName(`${name} elbow`), arm = root.findByName(`${name} arm`);
      assert.ok(Math.abs(arm.getPosition().distance(elbow.getPosition()) - 0.31 * HERO_MODEL_SCALE) < 0.001);
    }
    for (const [name, side, offset, suffix] of [["Left", -1, 0.25, ""], ["Right", 1, 0.75, ".001"]]) {
      const phase = (height + 0.14 - ladder.foothold(0, 0).y) / spacing + offset;
      const sole = root.findByName(`Boot sole${suffix}`);
      const bounds = sole.render.meshInstances[0].mesh.aabb;
      const ball = sole.getWorldTransform().transformPoint(new pc.Vec3(bounds.center.x,
        bounds.center.y - bounds.halfExtents.y, bounds.center.z + bounds.halfExtents.z * 0.45));
      if (phase % 1 < 0.5) {
        assert.ok(ball.distance(ladder.foothold(Math.floor(phase), side)) < 0.01,
          `${name} boot must rest on the rung at height ${height}: ${JSON.stringify(ball)}`);
      }
      const hip = root.findByName(`${name} leg`), knee = root.findByName(`${name} knee`);
      const ankle = root.findByName(`${name} ankle`);
      assert.ok(Math.abs(hip.getPosition().distance(knee.getPosition()) - 0.18 * HERO_MODEL_SCALE) < 0.001);
      assert.ok(Math.abs(knee.getPosition().distance(ankle.getPosition()) - 0.4 * HERO_MODEL_SCALE) < 0.001);
      assert.ok(ankle.getRotation().transformVector(pc.Vec3.UP).y > 0.999, "boot sole stays level on the rung");
    }
  }
  grip.restore();
  const arm = root.findByName("Left arm"), rest = arm.getLocalRotation().clone();
  grip.update({
    ladder,
    transferring: false,
  }, root.getPosition());
  grip.restore();
  grip.update(null, root.getPosition(), 1 / 60);
  assert.ok(grip.active, "release is eased rather than snapping back on one frame");
  for (let frame = 0; frame < 20; frame++) {
    grip.restore();
    grip.update(null, root.getPosition(), 1 / 60);
  }
  grip.restore();
  assert.equal(grip.active, false);
  const restored = arm.getLocalRotation();
  assert.ok(Math.abs(restored.x * rest.x + restored.y * rest.y + restored.z * rest.z + restored.w * rest.w) > 0.999999);
  root.setPosition(0, 0.1, -0.33);
  const pausedGrip = new HeroLadderGrip(pc, root);
  pausedGrip.update({
    ladder,
    transferring: false,
    velocity: { y: 0.6 },
  }, root.getPosition());
  for (let frame = 0; frame < 30; frame++) {
    pausedGrip.restore();
    pausedGrip.update({
      ladder,
      transferring: false,
      velocity: { y: 0 },
    }, root.getPosition());
  }
  for (const name of ["Left", "Right"]) {
    assert.ok(Math.abs(root.findByName(`${name} middle 1`).getLocalEulerAngles().x + 20) < 0.01,
      "both hands finish gripping when climbing is paused");
  }
  pausedGrip.restore();
});

it("releases before lifting and settles before closing the next grip", () => {
  assert.equal(ladderHandReach(0.1).lift, 0);
  assert.ok(ladderHandReach(0.1).withdraw > 0);
  assert.equal(ladderHandReach(0.5).withdraw, 1);
  assert.equal(ladderHandReach(0.5).open, 1);
  assert.equal(ladderHandReach(0.9).lift, 1);
  assert.ok(ladderHandReach(0.9).open > 0);
  assert.deepEqual(ladderHandReach(1), {
    lift: 1,
    withdraw: 0,
    open: 0,
  });
});
