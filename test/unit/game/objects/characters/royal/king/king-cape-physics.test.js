import assert from "node:assert/strict";
import { afterEach, beforeEach, it } from "node:test";
import Ammo from "sync-ammo/dist/ammo.module.js";
import * as playCanvas from "playcanvas";
import { KingCapePhysics } from "../../../../../../../src/game/objects/characters/royal/king/KingCapePhysics.js";

const previousAmmo = globalThis.Ammo;
beforeEach(() => {
  globalThis.Ammo = Ammo;
});
afterEach(() => {
  globalThis.Ammo = previousAmmo;
});

class TestMesh {
  /**
   * @param {null} device
   */
  constructor(device = null) {
    this.device = device;
    this.positions = [];
    this.indices = [];
    this.weights = [];
    this.joints = [];
    this.normals = [];
    this.destroyed = false;
    this.aabb = new playCanvas.BoundingBox();
  }

  clear() {}
  /**
   * @param {number[]} values
   */
  setPositions(values) {
    this.positions = [...values];
  }
  /**
   * @param {number[]} values
   */
  setIndices(values) {
    this.indices = [...values];
  }
  /**
   * @param {number[]} values
   */
  setNormals(values) {
    this.normals = [...values];
  }
  setUvs() {}
  /**
   * @param {number[]} target
   */
  getPositions(target) {
    target.push(...this.positions);
  }
  /**
   * @param {number[]} target
   */
  getIndices(target) {
    target.push(...this.indices);
  }
  /**
   * @param {number[]} target
   */
  getNormals(target) {
    target.push(...this.normals);
  }
  /**
   * @param {number} channel
   * @param {number[]} target
   */
  getUvs(channel, target) {
    target.length = 0;
  }
  /**
   * @param {string} semantic
   * @param {number[]} target
   */
  getVertexStream(semantic, target) {
    target.push(...(semantic === playCanvas.SEMANTIC_BLENDINDICES ? this.joints : this.weights));
  }
  update() {
    const minimum = new playCanvas.Vec3(Infinity, Infinity, Infinity);
    const maximum = new playCanvas.Vec3(-Infinity, -Infinity, -Infinity);
    for (let vertex = 0; vertex < this.positions.length; vertex += 3) {
      const point = new playCanvas.Vec3(...this.positions.slice(vertex, vertex + 3));
      minimum.min(point);
      maximum.max(point);
    }
    this.aabb.setMinMax(minimum, maximum);
  }
  destroy() {
    this.destroyed = true;
  }
}

class TestMaterial {
  destroyed = false;
  clone() {
    return new TestMaterial();
  }
  update() {}
  destroy() {
    this.destroyed = true;
  }
}

/**
 * @returns {{pc: typeof playCanvas, root: playCanvas.Entity, chest: playCanvas.Entity, app: playCanvas.EventHandler, instances: Array<{mesh: TestMesh, material: TestMaterial, node: playCanvas.Entity, skinInstance: {bones: playCanvas.Entity[], skin: {inverseBindPose: playCanvas.Mat4[]}}}>, physics: KingCapePhysics, frame: (dt?: number) => void}}
 */
function fixture() {
  const pc = {
    ...playCanvas,
    Mesh: TestMesh,
  };
  const world = new pc.Entity("World");
  world._enabledInHierarchy = true;
  const root = new pc.Entity("King model");
  world.addChild(root);
  const chest = new pc.Entity("Royal chest");
  root.addChild(chest);
  chest.setLocalPosition(0, 1.1, 0);
  const cape = new pc.Entity("Folded royal mantle back");
  root.addChild(cape);
  const skin = {
    bones: [chest],
    skin: { inverseBindPose: [chest.getWorldTransform().clone().invert()] },
  };
  const grid = [];
  for (let row = 0; row < 7; row++) {
    const fraction = row / 6;
    for (let column = 0; column < 7; column++) {
      const x = (column / 6 * 2 - 1) * (0.45 + 0.16 * fraction);
      grid.push([x, 1.2 - fraction * 1.05, -0.28 - 0.09 * fraction - 0.08 * (1 - Math.abs(column / 3 - 1))]);
    }
  }
  const meshes = [new TestMesh(), new TestMesh()];
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < 6; column++) {
      const a = row * 7 + column;
      const mesh = meshes[column < 3 ? 0 : 1];
      for (const index of [a, a + 1, a + 7, a + 1, a + 8, a + 7]) {
        mesh.indices.push(mesh.positions.length / 3);
        mesh.positions.push(...grid[index]);
        mesh.joints.push(0, 0, 0, 0);
        mesh.weights.push(1, 0, 0, 0);
      }
    }
  }
  const instances = meshes.map((mesh) => ({
    mesh,
    material: new TestMaterial(),
    node: cape,
    skinInstance: skin,
  }));
  cape.render = { meshInstances: instances };
  const panel = new pc.Entity("Indigo bodice front");
  root.addChild(panel);
  const panelMesh = new TestMesh();
  panelMesh.setPositions([-0.3, 0.6, 0.16, 0.3, 1.1, 0.2]);
  panelMesh.update();
  panel.render = {
    meshInstances: [{
      mesh: panelMesh,
      material: new TestMaterial(),
      node: panel,
      skinInstance: null,
    }],
  };
  root.anim = { baseLayer: { activeState: "TerraceWalk" } };
  const app = new pc.EventHandler();
  const physics = new KingCapePhysics({
    pc,
    app,
    modelRoot: root,
  });

  return {
    pc,
    root,
    chest,
    app,
    instances,
    physics,
    frame: (dt = 1 / 60) => {
      app.fire("update", dt);
      app.fire("prerender");
    },
  };
}

it("lazily initializes visible capes, deduplicates seams, and restores shared assets", () => {
  const scene = fixture();
  const originals = scene.instances.map((instance) => ({
    mesh: instance.mesh,
    material: instance.material,
    skin: instance.skinInstance,
  }));
  try {
    scene.root.enabled = false;
    scene.frame();
    assert.equal(scene.physics.testState.initialized, false);
    scene.root.enabled = true;
    globalThis.Ammo = undefined;
    scene.frame();
    assert.equal(scene.physics.testState.initialized, false, "mock environments without Ammo remain safe");
    globalThis.Ammo = Ammo;
    scene.frame();
    const state = scene.physics.testState;
    assert.equal(state.initialized, true);
    assert.equal(state.nodes.length, 49, "duplicate face and material vertices must share physical nodes");
    assert.equal(state.pins.length, 7, "only the top seam is sewn to the chest");
    for (let index = 0; index < scene.instances.length; index++) {
      assert.notEqual(scene.instances[index].mesh, originals[index].mesh);
      assert.notEqual(scene.instances[index].material, originals[index].material);
      assert.equal(scene.instances[index].skinInstance, null, "cape deformation replaces skinning, rather than applying both");
      assert.equal(originals[index].mesh.destroyed, false);
    }
    const clones = scene.instances.map((instance) => instance.mesh);
    scene.physics.destroy();
    for (let index = 0; index < scene.instances.length; index++) {
      assert.equal(scene.instances[index].mesh, originals[index].mesh);
      assert.equal(scene.instances[index].material, originals[index].material);
      assert.equal(scene.instances[index].skinInstance, originals[index].skin);
      assert.equal(clones[index].destroyed, true);
    }
    assert.equal(scene.app.hasEvent("update"), false);
    assert.equal(scene.app.hasEvent("prerender"), false);
  } finally {
    scene.physics.destroy();
  }
});

it("root motion generates cape inertia while the seam follows same-frame movement", () => {
  const scene = fixture();
  try {
    for (let frame = 0; frame < 90; frame++) {
      scene.frame();
    }
    let maximumLag = 0;
    for (let frame = 0; frame < 120; frame++) {
      // The resident moves after app.update, just as production navigation does.
      scene.app.fire("update", 1 / 60);
      scene.root.setPosition(0.2 * Math.sin(frame / 18), 0, frame / 180);
      scene.root.setEulerAngles(0, Math.sin(frame / 15) * 35, 0);
      scene.app.fire("prerender");
      const state = scene.physics.testState;
      assert.ok(state.nodes.flat().every(Number.isFinite));
      assert.ok(state.maxPinError < 0.00001, "no one-frame pin lag after root motion");
      assert.ok(Math.min(...state.nodes.map((point) => point[1])) > -0.015, "the floor must support the cape");
      const hem = new scene.pc.Vec3(...state.nodes.at(-1));
      scene.root.getWorldTransform().clone().invert().transformPoint(hem, hem);
      maximumLag = Math.max(maximumLag, Math.abs(hem.z + 0.37));
    }
    assert.ok(maximumLag > 0.015, "a rigidly parented cape has no world-space inertia");
    for (const instance of scene.instances) {
      assert.ok(instance.mesh.normals.every(Number.isFinite));
      assert.ok(instance.mesh.aabb.halfExtents.length() > 0.1, "dynamic bounds must cover the deformed cape");
    }
  } finally {
    scene.physics.destroy();
  }
});

it("clamps catch-up work, resets teleports and resumes, and preserves momentum across clip changes", () => {
  const scene = fixture();
  try {
    scene.frame();
    scene.frame(5);
    assert.equal(scene.physics.testState.substeps, 6);
    const before = scene.physics.testState.resets;
    scene.root.setPosition(12, 3, -8);
    scene.frame();
    assert.equal(scene.physics.testState.resets, before + 1);
    assert.ok(scene.physics.testState.maxPinError < 0.00001);
    scene.root.anim.baseLayer.activeState = "RoyalSit";
    scene.frame();
    assert.equal(scene.physics.testState.resets, before + 1, "changing locomotion must not erase cape momentum");
    scene.root.enabled = false;
    scene.frame();
    scene.root.setPosition(13, 3, -8);
    scene.root.enabled = true;
    scene.frame();
    assert.equal(scene.physics.testState.resets, before + 2);
    assert.ok(scene.physics.testState.nodes.flat().every(Number.isFinite));
    assert.ok(scene.physics.testState.maxPinError < 0.00001);
    assert.ok(scene.physics.testState.maxSpeed < 20, "resetting must not inherit a teleport impulse");
  } finally {
    scene.physics.destroy();
  }
});

it("failed initialization restores every shared asset and does not resume a partial solver", () => {
  const scene = fixture();
  const originals = scene.instances.map((instance) => ({
    mesh: instance.mesh,
    material: instance.material,
    skin: instance.skinInstance,
  }));
  let clones = 0;
  class CapeCloneAllocationFailure extends Error {}
  class FailingMesh extends TestMesh {
    constructor() {
      super();

      clones++;
      if (clones === 2) {
        throw new CapeCloneAllocationFailure();
      }
    }
  }
  scene.pc.Mesh = FailingMesh;
  try {
    assert.throws(() => scene.frame(), CapeCloneAllocationFailure);
    assert.equal(scene.physics.testState.initialized, false);
    assert.equal(scene.physics.testState.nodes.length, 0);
    for (let index = 0; index < scene.instances.length; index++) {
      assert.equal(scene.instances[index].mesh, originals[index].mesh);
      assert.equal(scene.instances[index].material, originals[index].material);
      assert.equal(scene.instances[index].skinInstance, originals[index].skin);
    }
    assert.doesNotThrow(() => scene.frame(), "later frames must not access partially cloned cape meshes");
    assert.equal(clones, 2, "failed initialization must not allocate repeatedly each render");
  } finally {
    scene.physics.destroy();
  }
});
