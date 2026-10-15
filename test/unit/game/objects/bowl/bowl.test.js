import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import Ammo from "sync-ammo/dist/ammo.module.js";
import * as pc from "playcanvas";
import { BowlPacking } from "../../../../../src/game/objects/bowl/BowlPacking.js";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".glb?url")) {
      return { url: `data:text/javascript,export default ${JSON.stringify(specifier)}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { Bowl } = await import("../../../../../src/game/objects/bowl/Bowl.js");
hooks.deregister();

test("bowls accept ordinary game objects, freeze snapshots, and pack only once", () => {
  class BowlWithoutPhysics extends Bowl {
    static get hasAuthoredCollision() { return false; }
  }
  const requests = [];
  const modelLibrary = { instantiate(url) { requests.push(url); return new pc.Entity(url); } };
  const items = [{ object: "Apple" }, { object: "ClosedReadingBook", scale: 0.2 }];
  const definition = { id: "mixed", object: "Bowl", position: { x: 2, y: 3, z: 4 },
    rotation: 90, scale: 2, items };
  const created = [], destroyed = [];
  const runtime = { createObject(item) {
    created.push(item);
    const entity = new pc.Entity(item.id);
    entity.clone = () => new pc.Entity(item.id);
    return { entity, destroy() { destroyed.push(item.id); entity.destroy(); } };
  } };
  const engine = { ...pc, Application: { getApplication: () => ({}) } };
  const originalGeometry = BowlPacking.geometry, originalSettle = BowlPacking.settle;
  BowlPacking.geometry = () => ({ bounds: new pc.BoundingBox(pc.Vec3.ZERO, new pc.Vec3(0.15, 0.1, 0.15)) });
  // Vite can load distinct Engine entry points; solver results must not rely
  // on instanceof checks against the renderer's Vec3 or Quat constructor.
  BowlPacking.settle = (shell, geometries) => geometries.map((_, index) => ({
    position: { x: index * 0.01, y: 0.04, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
  }));
  try {
    const bowl = new BowlWithoutPhysics({ pc: engine, modelLibrary, definition, runtime });
    bowl.onSceneReady();
    bowl.onSceneReady();
    const shell = bowl.visualRoots[0].children[0];
    assert.equal(shell.children.length, 2);
    assert.deepEqual(created.map(item => item.object), ["Apple", "ClosedReadingBook"]);
    assert.equal(created[1].scale, 0.2);
    assert.deepEqual(destroyed, ["mixed-item-0", "mixed-item-1"]);
    assert.deepEqual(requests, [Bowl.modelUrl]);
    assert.deepEqual(shell.getLocalScale().toArray(), [2, 2, 2]);
    assert.equal(shell.children[0].getLocalPosition().y, 0.04);
    assert.deepEqual(shell.children[1].getLocalPosition().toArray(), [0.01, 0.04, 0]);
    assert.deepEqual(shell.children[0].getLocalRotation().toArray(), [0, 0, 0, 1]);
    const empty = new BowlWithoutPhysics({ pc: engine, modelLibrary, runtime,
      definition: { ...definition, id: "empty", items: [] } });
    empty.onSceneReady();
    assert.equal(empty.visualRoots[0].children[0].children.length, 0);
    bowl.destroy();
    empty.destroy();
  } finally {
    BowlPacking.geometry = originalGeometry;
    BowlPacking.settle = originalSettle;
  }
});

test("shell tint clones materials and never recolors shared assets or contents", () => {
  const original = new pc.StandardMaterial();
  original.diffuse.set(0.8, 0.7, 0.6);
  const mesh = { material: original };
  const clones = [];
  Bowl.prototype.prepareModel.call({ definition: { color: "#804020" },
    cloneMaterial(material) { const clone = material.clone(); clones.push(clone); return clone; } },
  { findComponents: () => [{ meshInstances: [mesh] }] }, false);
  assert.notEqual(mesh.material, original);
  assert.deepEqual(original.diffuse.toArray(), [0.8, 0.7, 0.6, 1]);
  assert.ok(mesh.material.diffuse.r < original.diffuse.r);
  assert.ok(mesh.material.diffuse.g < original.diffuse.g);
  for (const clone of clones) { clone.destroy(); }
  original.destroy();
});

test("real Engine objects survive source destruction and remain fixed after Ammo packing", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const device = new pc.NullGraphicsDevice({ width: 1, height: 1 });
  const app = new pc.AppBase({ id: "bowl-packing" });
  app.init({ graphicsDevice: device, componentSystems: [pc.RenderComponentSystem,
    pc.CollisionComponentSystem, pc.RigidBodyComponentSystem], resourceHandlers: [] });
  app.systems.rigidbody.onLibraryLoaded();
  const material = new pc.StandardMaterial();
  const shellMesh = pc.Mesh.fromGeometry(device, new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.15, 0.01, 0.15) }));
  /**
   * @returns {import("playcanvas").Entity}
   */
  const instantiate = () => {
    const entity = new pc.Entity("shell");
    entity.addComponent("render", { meshInstances: [new pc.MeshInstance(shellMesh, material, entity)] });
    return entity;
  };
  let disposed = 0;
  const runtime = { createObject(definition) {
    const entity = new pc.Entity(definition.object);
    const mesh = pc.Mesh.fromGeometry(device, new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.03, 0.02, 0.01) }));
    entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material, entity)] });
    return { entity, destroy() { disposed++; entity.destroy(); mesh.destroy(); } };
  } };
  let bowl;
  try {
    bowl = new Bowl({ pc, app, modelLibrary: { instantiate }, runtime, definition: {
      id: "physics-bowl", object: "Bowl", position: { x: 2, y: 3, z: 4 },
      items: [{ object: "ClosedReadingBook" }, { object: "WoodenCrate" }],
    } });
    app.root.addChild(bowl.entity);
    bowl.onSceneReady();
    assert.equal(disposed, 2, "source behaviors and resources were released");
    const shell = bowl.visualRoots[0].children[0];
    assert.equal(shell.children.length, 2);
    const before = shell.children.map(entity => entity.getLocalPosition().clone());
    for (const entity of shell.children) {
      const mesh = entity.findComponents("render")[0].meshInstances[0].mesh;
      const vertices = [];
      assert.ok(mesh.getPositions(vertices) > 0, "snapshot owns live vertex buffers");
      assert.ok(entity.getLocalPosition().y > 0.01);
      assert.equal(entity.findComponents("rigidbody").length, 0);
    }
    app.systems.rigidbody.onUpdate(1);
    assert.deepEqual(shell.children.map(entity => entity.getLocalPosition()), before);
    bowl.onSceneReady();
    assert.equal(disposed, 2);
  } finally {
    bowl?.destroy();
    shellMesh.destroy();
    material.destroy();
    app.destroy();
    globalThis.Ammo = previousAmmo;
  }
});
