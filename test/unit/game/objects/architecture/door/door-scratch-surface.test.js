import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { Door } from "../../../../../../src/game/objects/architecture/door/Door.js";
import { DoorScratchSurface } from "../../../../../../src/game/objects/architecture/door/DoorScratchSurface.js";

class CaptureMesh {
  vertexBuffer = { numVertices: 0 };
  clear() {}
  setPositions(positions) {
    this.positions = Array.from(positions);
  }
  setNormals(normals) {
    this.normals = normals;
  }
  setUvs(channel, uvs) {
    this.uvs = uvs;
  }
  setIndices(indices) {
    this.indices = indices;
  }
  setColors(colors) {
    this.colors = colors;
  }
  getPositions(output) {
    output.push(...this.positions);
  }
  getIndices(output) {
    output.push(...this.indices);
  }
  update() {
    this.vertexBuffer.numVertices = this.positions.length / 3;
  }
  destroy() {
    this.destroyed = true;
  }
}

const fixture = () => {
  const positions = [-0.4, 0, 0, 0.4, 0, 0, 0.4, 1, 0, -0.4, 1, 0, -0.4, 0, -0.15, 0.4, 0, -0.15, 0.4, 1, -0.15, -0.4, 1, -0.15];
  const uvs = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  const source = {
    device: {},
    getPositions: output => output.push(...positions),
    getIndices: output => output.push(0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6),
    getUvs: (channel, output) => output.push(...uvs),
  };
  const node = new pc.Entity("Entrance oak plank");
  node.render = { batchGroupId: 4 };
  const material = { name: "Warm oak timber" };
  const instance = {
    mesh: source,
    node,
    material,
  };
  const engine = {
    ...pc,
    Mesh: CaptureMesh,
  };
  const door = { getSurfaceMeshInstances: () => [instance] };
  const damage = new DoorScratchSurface(door, engine);
  const start = new pc.Vec3(-0.04, 0.7, 0), end = new pc.Vec3(0.04, 0.35, 0), origin = new pc.Vec3(0, 0.35, 1);

  return {
    positions,
    source,
    node,
    instance,
    material,
    engine,
    damage,
    start,
    end,
    origin,
  };
};

test("contact cuts actual textured wood, deepens repeated grooves and preserves shared assets", () => {
  const { damage, start, end, origin, instance, source, node, material } = fixture();
  const other = { mesh: source };
  assert.equal(damage.scratch(start, end, origin), 1);
  assert.notEqual(instance.mesh, source);
  assert.equal(other.mesh, source);
  assert.equal(instance.material, material);
  assert.equal(node.render.batchGroupId, -1);
  const firstDepth = damage.metrics.maximumDepth;
  assert.ok(firstDepth > 0.006 && firstDepth <= 0.008);
  assert.ok(instance.mesh.positions.length > 24, "sparse plank faces gain local geometric detail");
  assert.ok(instance.mesh.uvs.every(value => value >= 0 && value <= 1), "the timber UVs remain interpolated");
  assert.ok(instance.mesh.positions.some((value, index) => index % 3 === 2 && value < -0.001 && value > -0.1));
  assert.equal(damage.scratch(start, end, origin), 1);
  assert.ok(damage.metrics.maximumDepth > firstDepth * 1.9);
  assert.equal(damage.metrics.strokes, 2);
  const owned = instance.mesh;
  damage.destroy();
  assert.equal(instance.mesh, source);
  assert.equal(owned.destroyed, true);
});

test("grooves follow the animated leaf, stop at the surface, and ignore iron hardware", () => {
  const { damage, start, end, origin, node, instance } = fixture();
  assert.equal(damage.scratch(start, end, origin), 1);
  node.setEulerAngles(0, 45, 0);
  const transform = node.getWorldTransform();
  assert.equal(damage.scratch(transform.transformPoint(start), transform.transformPoint(end), transform.transformPoint(origin)), 1);
  assert.ok(damage.metrics.maximumDepth > 0.012);
  assert.equal(damage.scratch(new pc.Vec3(2, 2, 0), new pc.Vec3(2, 2.3, 0), origin), 0);
  instance.material = { name: "Forged iron hinge" };
  assert.equal(damage.scratch(start, end, origin), 0);
  damage.destroy();
});

test("claw width and damage deepen directional cuts in the actual wood", () => {
  const thin = fixture(), worn = fixture();
  const start = new pc.Vec3(0, 0.8, 0), end = new pc.Vec3(0, 0.2, 0), origin = new pc.Vec3(0, 0.5, 1);
  thin.damage.scratch(start, end, origin, {
    width: 0.025,
    damageRatio: 0,
  });
  worn.damage.scratch(start, end, origin, {
    width: 0.1,
    damageRatio: 1,
  });
  const sample = (surface, x, y) => surface.point(new pc.Vec3(x, y, 0), new pc.Vec3(x, y, 1)).z;
  assert.ok(worn.damage.metrics.maximumDepth > 0.045, "late damage removes visibly deep wood");
  assert.ok(worn.damage.metrics.maximumDepth > thin.damage.metrics.maximumDepth * 2);
  assert.ok(sample(worn.damage, 0.035, 0.5) < -0.008, "wide claws carve away wood beside the stroke center");
  assert.ok(sample(thin.damage, 0.035, 0.5) > -0.001, "narrow claws retain nearby timber");
  assert.ok(sample(worn.damage, 0, 0.3) < sample(worn.damage, 0, 0.7) - 0.005, "the trailing end bites deeper in the actual stroke direction");
  thin.damage.destroy();
  worn.damage.destroy();
});

test("recess shading owns its material and leaves untouched timber white", () => {
  const { damage, instance, start, end, origin } = fixture();
  const clone = {
    update: () => {},
    destroy() {
      this.destroyed = true;
    },
  };
  const material = {
    name: "Oak wood",
    clone: () => clone,
  };
  instance.material = material;
  damage.scratch(start, end, origin, {
    width: 0.1,
    damageRatio: 1,
  });
  assert.equal(instance.material, clone);
  assert.equal(clone.diffuseVertexColor, true);
  assert.equal(material.diffuseVertexColor, undefined);
  const colors = instance.mesh.colors;
  assert.equal(colors.length, instance.mesh.positions.length / 3 * 4);
  assert.ok(colors.some((value, index) => index % 4 === 0 && value < 0.4), "deep cuts expose dark timber");
  assert.ok(colors.some((value, index) => index % 4 === 0 && value === 1), "intact timber retains its authored color");
  assert.ok(colors.every((value, index) => index % 4 !== 3 || value === 1));
  damage.destroy();
  assert.equal(instance.material, material);
  assert.equal(clone.destroyed, true);
});

test("colored geometry replaces the render instance after upload and restores it on cleanup", () => {
  const f = fixture();
  class FormatInstance {
    constructor(mesh, material, node) {
      this.mesh = mesh;
      this.material = material;
      this.node = node;
      this.sawUploadedColors = Boolean(mesh.colors?.length && mesh.vertexBuffer.numVertices);
    }
    destroy() {
      this.destroyed = true;
    }
  }
  f.engine.MeshInstance = FormatInstance;
  const original = new FormatInstance(f.source, f.material, f.node);
  const render = {
    meshInstances: [original],
    removeFromLayers: () => {},
    addToLayers: () => {},
  };
  f.node.render = render;
  f.damage.door.getSurfaceMeshInstances = () => render.meshInstances;
  f.damage.scratch(f.start, f.end, f.origin);
  const replacement = render.meshInstances[0];
  assert.notEqual(replacement, original);
  assert.equal(replacement.sawUploadedColors, true, "shader format is selected after the color stream exists");
  assert.equal(original.mesh, f.source);
  f.damage.scratch(f.start, f.end, f.origin);
  assert.equal(render.meshInstances[0], replacement, "later strokes retain the correctly formatted instance");
  assert.equal(f.damage.metrics.strokes, 2);
  f.damage.destroy();
  assert.equal(render.meshInstances[0], original);
  assert.equal(replacement.destroyed, true);
  assert.equal(replacement.mesh, null);
});

test("toe queries read recessed rendered wood and reject hardware without changing it", () => {
  const { damage, start, end, origin, instance, source } = fixture();
  const aim = new pc.Vec3(0, 0.525, 0.1);
  const rayOrigin = new pc.Vec3(0, 0.525, 1);
  const initial = damage.point(aim, rayOrigin);
  assert.ok(initial && Math.abs(initial.z) < 1e-8);
  assert.equal(instance.mesh, source);
  assert.equal(damage.metrics.strokes, 0);
  damage.scratch(start, end, origin);
  const recessed = damage.point(aim, rayOrigin);
  assert.ok(recessed && recessed.z < -0.004, "the claw must enter the actual recessed groove");
  assert.equal(damage.metrics.strokes, 1, "surface sampling cannot add damage");
  const wood = instance;
  const metalNode = new pc.Entity("Iron reinforcement");
  metalNode.setPosition(0, 0, 0.04);
  const metal = {
    mesh: source,
    node: metalNode,
    material: { name: "Forged iron brace" },
  };
  damage.door.getSurfaceMeshInstances = () => [wood, metal];
  assert.equal(damage.point(aim, rayOrigin), null, "wood behind a brace is not reachable");
  damage.destroy();
});

test("door API rejects occluded and open-door contacts before changing health or geometry", () => {
  const { engine, instance, node, start, end } = fixture();
  const entity = new pc.Entity("Door frame");
  entity.addChild(node);
  entity.addComponent = () => {
    entity.anim = {
      addAnimationState: () => {},
      speed: 0,
      playing: false,
      update: () => {},
      baseLayer: { play: () => {} },
    };
  };
  const door = new Door({
    pc: engine,
    entity,
    modelUrl: "door.glb",
    animationName: "open",
    modelLibrary: { getAnimationTracks: () => new Map([["open", { duration: 1 }]]) },
    automatic: false,
    collision: {
      raycast: (from, to) => {
        // The native plank hull conservatively protrudes beyond rendered wood.
        const fraction = (0.08 - from.z) / (to.z - from.z);
        const y = from.y + (to.y - from.y) * fraction;

        return fraction >= 0 && fraction <= 1 && y >= 0 && y <= 1 ? fraction : null;
      },
      getSurfaceMeshes: () => [instance],
      blocksAt: () => true,
      ownsLeaf: () => false,
      destroy: () => {},
    },
  });
  const wall = new pc.Entity("Wall between bug and door");
  const sounds = [];
  door.audio = { play: name => sounds.push(name) };
  let hits = [{ entity: wall }];
  const actor = {
    pc: engine,
    position: new pc.Vec3(0, 0, 1),
    entity: new pc.Entity(),
    app: { systems: { rigidbody: { raycastAll: () => hits } } },
  };
  assert.equal(door.scratchSurface(start, end, actor), 0);
  assert.equal(door.getScratchPoint(start, actor.position, actor), null);
  assert.equal(door.health, 48);
  assert.equal(door.scratchMetrics.strokes, 0);
  hits = [];
  const skin = door.getScratchPoint(start.clone().add(new pc.Vec3(0, 0, 0.08)), actor.position, actor);
  assert.ok(skin && Math.abs(skin.z) < 1e-8);
  assert.equal(door.scratchMetrics.strokes, 0);
  assert.equal(door.scratchSurface(start, end, actor), 8);
  assert.equal(door.health, 40);
  assert.equal(door.scratchMetrics.strokes, 1);
  assert.deepEqual(sounds, ["scratch"]);
  assert.equal(door.scratchSurface(start, end, actor, 0.045, false), 8);
  assert.deepEqual(sounds, ["scratch"], "committing an already sounded drag is silent");
  door.openAmount = 0.2;
  assert.equal(door.getScratchPoint(start, actor.position, actor), null);
  assert.equal(door.scratchSurface(start, end, actor), 0);
  assert.equal(door.health, 32);
  door.openAmount = 0;
  door.receiveDamage(32, actor, "hit", false);
  assert.deepEqual(sounds, ["scratch", "break"], "the final collapse still sounds");
  door.destroy();
});
