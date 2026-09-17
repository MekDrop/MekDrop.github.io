import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { TerraceActor } from "../../src/game/objects/castle/TerraceActor.js";

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
  return { root, meshes };
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

it("keeps the sword attached to its hand throughout distinct tai chi poses", () => {
  const { root, meshes } = royalModel("king");
  const actor = new TerraceActor({ pc, kind: "king", modelUrl: "king", modelLibrary: { instantiate: () => root } });
  const sword = root.findByName("King sword");
  const grip = sword.getLocalPosition().clone();
  actor.pose("sword", 0);
  const first = sword.getPosition().clone();
  actor.pose("sword", 4);
  assert.equal(sword.parent, actor.leftHand);
  assert.ok(sword.getLocalPosition().equals(grip));
  assert.ok(first.distance(sword.getPosition()) > 0.2);
  for (let time = 0; time < 13; time += 0.1) {
    actor.pose("sword", time);
    assert.ok(root.findByName("King sword tip").getPosition().x < -1, "blade hidden within body silhouette");
    for (const mesh of meshes.filter((item) => /sword/i.test(item.node.name))) {
      assert.ok(mesh.aabb.center.y - mesh.aabb.halfExtents.y > 0.1, `blade below terrace at ${time}`);
    }
  }
  actor.destroy();
});

it("blends from standing without accumulating frame-dependent motion", () => {
  const { root } = royalModel("princess");
  const actor = new TerraceActor({ pc, kind: "princess", modelUrl: "princess", modelLibrary: { instantiate: () => root } });
  actor.pose("sit", 1, 0.5);
  const first = actor.rightHand.getPosition().clone();
  actor.pose("sit", 1, 0.5);
  assert.ok(first.equals(actor.rightHand.getPosition()));
  actor.pose("drink", 4, 0);
  const neutral = actor.rightHand.getPosition().clone();
  actor.pose("idle", 4);
  assert.ok(neutral.equals(actor.rightHand.getPosition()));
  actor.destroy();
});

it("sets furniture down without marching and finishes upright", () => {
  const { root } = royalModel("servant");
  const actor = new TerraceActor({ pc, kind: "servant", modelUrl: "servant", modelLibrary: { instantiate: () => root } });
  const leg = root.findByName("Royal left leg rig");
  const rest = leg.getLocalRotation().clone();
  for (const time of [0, 0.5, 1, 1.5, 2]) {
    actor.pose("place", time);
    assert.ok(leg.getLocalRotation().equals(rest));
  }
  const finished = actor.rightHand.getPosition().clone();
  actor.pose("idle", 2);
  assert.ok(finished.distance(actor.rightHand.getPosition()) < 0.00001);
  actor.destroy();
});

it("fits the walking king and sword inside the terrace doorway", () => {
  const { root, meshes } = royalModel("king");
  const actor = new TerraceActor({ pc, kind: "king", modelUrl: "king", modelLibrary: { instantiate: () => root } });
  for (let time = 0; time < 2; time += 0.05) {
    actor.pose("walk", time);
    for (const mesh of meshes.filter((item) => !/tear|handkerchief/i.test(item.node.name))) {
      const bounds = mesh.aabb;
      assert.ok((bounds.center.y + bounds.halfExtents.y) * 0.45 < 1.25);
      assert.ok((Math.abs(bounds.center.x) + bounds.halfExtents.x) * 0.45 < 0.5);
      if (/sword/i.test(mesh.node.name)) {
        assert.ok(bounds.center.y - bounds.halfExtents.y > 0);
      }
    }
  }
  actor.destroy();
});
it("holds a sipping cup near the princess mouth while seated in front of the chair", () => {
  const { root } = royalModel("princess");
  const actor = new TerraceActor({ pc, kind: "princess", modelUrl: "princess", modelLibrary: { instantiate: () => root } });
  actor.pose("drink", 3);
  const mouth = root.findByName("Royal head rig").getWorldTransform().transformPoint(new pc.Vec3(0, -0.084, 0.538));
  const cupRim = actor.rightHand.getPosition().clone().add(new pc.Vec3(0, 0.251, 0));
  assert.ok(Math.abs(cupRim.y - mouth.y) < 0.07);
  assert.ok(Math.abs(cupRim.x - mouth.x) < 0.18);
  assert.ok(Math.abs(cupRim.z - mouth.z) < 0.1);
  assert.ok(Math.abs(root.findByName("Royal left leg rig").getLocalEulerAngles().x) > 50);
  const body = root.findByName("Royal animation rig").getLocalPosition();
  const hip = root.findByName("Royal left leg rig").getPosition();
  assert.ok(body.z > 0.15, "gown stays forward of the chair back");
  assert.ok(Math.abs(hip.y - 0.4) < 0.04, "hips meet the lowered chair cushion");
  actor.destroy();
});

it("rests the queen on the sunbed and turns pages at irregular intervals", () => {
  const { root } = royalModel("queen");
  const actor = new TerraceActor({ pc, kind: "queen", modelUrl: "queen", modelLibrary: { instantiate: () => root } });
  actor.pose("read", 6);
  const hip = root.findByName("Royal left leg rig").getPosition();
  assert.ok(Math.abs(hip.y - 0.58) < 0.03, `hips rest at ${hip.y}`);
  assert.ok(Math.abs(root.findByName("Royal animation rig").getLocalEulerAngles().x + 40) < 0.01);
  assert.ok(Math.abs(root.findByName("Royal left leg rig").getLocalEulerAngles().x + 45) < 0.01);
  const restingArm = root.findByName("Royal right arm rig").getLocalEulerAngles().clone();
  actor.pose("read", 7.39);
  const turningArm = root.findByName("Royal right arm rig").getLocalEulerAngles();
  assert.ok(restingArm.distance(turningArm) > 10, "right hand visibly turns a page");
  actor.destroy();
});

it("sits the queen first, then lifts her feet before reclining", () => {
  const { root } = royalModel("queen");
  const actor = new TerraceActor({ pc, kind: "queen", modelUrl: "queen", modelLibrary: { instantiate: () => root } });
  const body = root.findByName("Royal animation rig");
  const leg = root.findByName("Royal left leg rig");
  actor.pose("mountSunbed", 0.28);
  assert.ok(Math.abs(body.getLocalEulerAngles().x) < 0.01, "queen remains upright while sitting");
  assert.ok(leg.getLocalEulerAngles().x < -60, "feet remain down at the side");
  actor.pose("mountSunbed", 0.62);
  assert.ok(Math.abs(body.getLocalEulerAngles().x) < 0.01, "queen remains upright while lifting her feet");
  assert.ok(Math.abs(leg.getLocalEulerAngles().x + 45) < 0.01, "feet extend along the mattress");
  actor.pose("mountSunbed", 1);
  assert.ok(Math.abs(body.getLocalEulerAngles().x + 40) < 0.01, "queen reclines only after her feet are up");
  actor.destroy();
});
