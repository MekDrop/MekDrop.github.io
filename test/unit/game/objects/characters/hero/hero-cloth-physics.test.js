import assert from "node:assert/strict";
import { it } from "node:test";
import * as playCanvas from "playcanvas";
import { HeroClothPhysics } from "../../../../../../src/game/objects/characters/hero/HeroClothPhysics.js";

class TestMesh {
  clear() {}
  /**
   * @param {unknown} device
   */
  constructor(device) {
    this.device = device;
    this.positions = [];
    this.indices = [];
    this.aabb = new playCanvas.BoundingBox();
  }

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
    target.length = 0;
  }
  /**
   * @param {number} channel @param {number[]} target
   */
  getUvs(channel, target) {
    target.length = 0;
  }
  setNormals() {}
  setUvs() {}
  update() {
    const minimum = new playCanvas.Vec3(Infinity, Infinity, Infinity);
    const maximum = new playCanvas.Vec3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < this.positions.length; i += 3) {
      const point = new playCanvas.Vec3(...this.positions.slice(i, i + 3));
      minimum.min(point);
      maximum.max(point);
    }
    this.aabb.setMinMax(minimum, maximum);
  }
  destroy() {}
}

/**
 * @returns {{clone: () => ReturnType<typeof material>, update: () => void, destroy: () => void}}
 */
function material() {
  return {
    clone: material,
    update: () => {},
    destroy: () => {},
  };
}

/**
 * @param {string} name @param {TestMesh} mesh @param {import("playcanvas").Vec3} position
 */
function node(name, mesh, position) {
  const matrix = new playCanvas.Mat4();
  const entity = {
    name,
    position,
    getWorldTransform: () => matrix.setTranslate(position.x, position.y, position.z),
    render: { meshInstances: [] },
  };
  if (mesh) {
    entity.render.meshInstances.push({
      mesh,
      material: material(),
      node: entity,
    });
  }
  return entity;
}

it("cloth links retain garment length and a moving leg pushes the fabric outward", () => {
  const pc = {
    ...playCanvas,
    Mesh: TestMesh,
  };
  const mesh = new TestMesh();
  const positions = [];
  const indices = [];
  const rows = [-0.4, -0.3, -0.2, -0.15, 0, 0.3];
  for (const y of rows) {
    for (const x of [-0.18, -0.06, 0.06, 0.18]) {
      positions.push(x, y, 0);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let col = 0; col < 3; col++) {
      const first = row * 4 + col;
      indices.push(first, first + 1, first + 4, first + 1, first + 5, first + 4);
    }
  }
  mesh.setPositions(positions);
  mesh.setIndices(indices);
  mesh.update();
  const garment = node("Red lower tunic flap", mesh, new pc.Vec3(0, 0, 0.18));
  const legMesh = new TestMesh();
  legMesh.setPositions([-0.11, -0.12, -0.08, 0.11, 0.12, 0.08]);
  legMesh.update();
  const leg = node("Thick trouser leg", legMesh, new pc.Vec3(0, -0.32, 0));
  const fitted = node("Short red tunic", mesh, new pc.Vec3());
  const fittedInstance = fitted.render.meshInstances[0];
  const entities = new Map([[garment.name, garment], [leg.name, leg], [fitted.name, fitted]]);
  const root = {
    getPosition: () => new pc.Vec3(),
    getWorldTransform: () => new pc.Mat4(),
    findByName: name => entities.get(name),
  };
  const physics = new HeroClothPhysics({
    pc,
    modelRoot: root,
  });
  try {
    for (let frame = 0; frame < 240; frame++) {
      if (frame >= 120) {
        leg.position.z = Math.min(0.15, (frame - 120) * 0.0025);
      }
      physics.update(1 / 120);
      const current = garment.render.meshInstances[0].mesh.positions;
      for (let i = 0; i < current.length; i += 3) {
        const depth = Math.min(
          0.11 - Math.abs(current[i]),
          0.12 - Math.abs(current[i + 1] + 0.32),
          0.08 - Math.abs(current[i + 2] + 0.18 - leg.position.z),
        );
        assert.ok(depth <= 0.001, "moving leg must not pass through cloth vertices");
      }
      assert.equal(fittedInstance.mesh, mesh, "the fitted tunic remains rigid");
    }
    const result = garment.render.meshInstances[0].mesh.positions;
    assert.ok(result.every(Number.isFinite));
    assert.ok(Math.min(...result.filter((_, i) => i % 3 === 1)) > -0.46, "fabric must not free-fall away from its attachment");
    assert.ok(Math.max(...result.filter((_, i) => i % 3 === 2)) > 0.04, "the moving leg must deflect the fabric");
    for (let i = 0; i < positions.length; i += 3) {
      if (positions[i + 1] < 0.29) {
        continue;
      }
      assert.ok(Math.abs(result[i] - positions[i]) < 0.0001);
      assert.ok(Math.abs(result[i + 1] - positions[i + 1]) < 0.0001);
    }
  } finally {
    physics.destroy();
    assert.equal(garment.render.meshInstances[0].mesh, mesh, "teardown restores the authored mesh");
  }
});

