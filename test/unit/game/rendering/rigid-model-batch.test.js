import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { RigidModelBatch } from "../../../../src/game/rendering/RigidModelBatch.js";

/**
 * @returns {{app: pc.AppBase, owner: pc.Entity, model: pc.Entity, mesh: pc.Mesh, material: pc.StandardMaterial}}
 */
function fixture() {
  const device = new pc.NullGraphicsDevice({
    width: 1,
    height: 1,
  });
  const app = new pc.AppBase({ id: "rigid-model-batch" });
  app.init({
    graphicsDevice: device,
    componentSystems: [pc.RenderComponentSystem],
    resourceHandlers: [],
  });
  const owner = new pc.Entity("moving prop");
  owner.setLocalPosition(7, 3, -5);
  owner.setLocalEulerAngles(0, 37, 0);
  owner.setLocalScale(1.3, 0.7, 2);
  app.root.addChild(owner);
  const model = new pc.Entity("imported model");
  model.setLocalPosition(0.1, 0.2, 0.3);
  model.setLocalEulerAngles(10, 20, 0);
  model.setLocalScale(0.7, 1.2, 0.9);
  owner.addChild(model);
  const mesh = pc.Mesh.fromGeometry(device, new pc.BoxGeometry());
  const material = new pc.StandardMaterial();
  for (const x of [-0.5, 0.5]) {
    const part = new pc.Entity("board");
    part.setLocalPosition(x, 0.5, -0.2);
    part.setLocalScale(0.5, 2, 1);
    model.addChild(part);
    part.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, material, part)],
      castShadows: false,
      receiveShadows: false,
    });
  }
  app.root.syncHierarchy();

  return {
    app,
    owner,
    model,
    mesh,
    material,
  };
}

/**
 * @param {pc.MeshInstance[]} instances
 * @returns {number[]}
 */
function positions(instances) {
  const result = [];
  for (const instance of instances) {
    const values = [];
    instance.mesh.getPositions(values);
    const matrix = instance.node.getWorldTransform();
    for (let index = 0; index < values.length; index += 3) {
      const point = matrix.transformPoint(new pc.Vec3(values[index], values[index + 1], values[index + 2]));
      result.push(point.x, point.y, point.z);
    }
  }

  return result;
}

test("rigid parts retain local placement, shadow settings and parent motion without bone palettes", () => {
  const { app, owner, model, material } = fixture();
  try {
    const before = positions(model.findComponents("render").flatMap((render) => render.meshInstances));
    RigidModelBatch.merge(pc, app, model);
    const active = owner.findComponents("render").filter((render) => render.entity.enabled);
    assert.equal(active.length, 1);
    assert.equal(model.enabled, false);
    assert.equal(owner.children[0], model, "authored node lookup order stays stable");
    assert.equal(active[0].castShadows, false);
    assert.equal(active[0].receiveShadows, false);
    const instances = active[0].meshInstances;
    assert.equal(instances[0].skinInstance, null);
    const after = positions(instances);
    assert.equal(after.length, before.length);
    for (let index = 0; index < before.length; index++) {
      assert.ok(Math.abs(after[index] - before[index]) < 0.00001, "world vertices survive float32 local baking");
    }
    owner.setLocalPosition(10, 4, -7);
    const moved = positions(instances);
    const delta = [3, 1, -2];
    for (let index = 0; index < moved.length; index++) {
      assert.ok(Math.abs(moved[index] - after[index] - delta[index % 3]) < 0.00001);
    }
    const combinedMesh = instances[0].mesh;
    owner.destroy();
    assert.equal(combinedMesh.vertexBuffer, null, "the owner releases generated geometry");
  } finally {
    app.destroy();
    material.destroy();
  }
});

test("vertex-deforming materials retain their authored live hierarchy", () => {
  const { app, owner, model, material } = fixture();
  try {
    material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("transformVS", "authored deformation");
    RigidModelBatch.merge(pc, app, model);
    assert.equal(model.enabled, true);
    assert.equal(owner.children.length, 1);
    assert.equal(model.findComponents("render").length, 2);
  } finally {
    app.destroy();
    material.destroy();
  }
});
