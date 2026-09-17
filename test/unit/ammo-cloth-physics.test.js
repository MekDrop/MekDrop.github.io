import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { AmmoClothPhysics } from "../../src/game/objects/shared/AmmoClothPhysics.js";
import {
  resetAmbientWindSpeed,
  setAmbientWindSpeed,
} from "../../src/game/objects/shared/AmbientWind.js";

const previousAmmo = globalThis.Ammo;

before(() => {
  globalThis.Ammo = Ammo;
});

after(() => {
  globalThis.Ammo = previousAmmo;
});

describe("AmmoClothPhysics", () => {
  it("constructs multiple soft bodies without Ammo's array bridge", () => {
    const physics = new AmmoClothPhysics();
    const createCloth = (offset) => {
      const positions = new Float32Array([
        -0.5 + offset,
        0,
        0,
        0.5 + offset,
        0,
        0,
        -0.5 + offset,
        -1,
        0,
        0.5 + offset,
        -1,
        0,
      ]);
      return {
        cloth: physics.createCloth({
          positions,
          indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
          pinnedIndices: [0, 1],
        }),
        positions,
      };
    };

    const first = createCloth(0);
    const second = createCloth(2);
    physics.step(1 / 60);
    physics.writePositions(first.cloth, first.positions);
    physics.writePositions(second.cloth, second.positions);

    assert.equal(first.positions[0], -0.5);
    assert.equal(second.positions[0], 1.5);
    physics.destroy();
  });

  it("enables cluster self-collision only when requested", () => {
    const physics = new AmmoClothPhysics();
    const cloth = physics.createCloth({
      positions: new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0,
      ]),
      indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
      pinnedIndices: [0, 1],
      selfCollision: true,
    });

    assert.equal(cloth.body.get_m_cfg().get_collisions() & 0x40, 0x40);
    physics.destroy();
  });

  it("pins the mount edge while Ammo simulates the free cloth", () => {
    const physics = new AmmoClothPhysics();
    const positions = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0,
    ]);
    const cloth = physics.createCloth({
      positions,
      indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
      pinnedIndices: [0, 1],
      vertexUv: new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]),
    });

    for (let frame = 0; frame < 120; frame += 1) {
      physics.step(1 / 60);
    }
    physics.writePositions(cloth, positions);

    assert.deepEqual(
      Array.from(positions.slice(0, 6)),
      [-0.5, 0, 0, 0.5, 0, 0],
    );
    assert.ok(Math.abs(positions[8]) > 0.01);
    assert.ok(Math.abs(positions[11]) > 0.01);
    physics.destroy();
  });

  it("keeps a flag fluttering under sustained strong wind", () => {
    setAmbientWindSpeed(10);
    const physics = new AmmoClothPhysics();
    try {
      const positions = new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0,
      ]);
      const cloth = physics.createCloth({
        positions,
        indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
        pinnedIndices: [0, 1],
      });
      const trailingPositions = [];

      for (let frame = 0; frame < 360; frame += 1) {
        physics.step(1 / 60);
        if (frame >= 180) {
          physics.writePositions(cloth, positions);
          trailingPositions.push(positions[11]);
        }
      }

      assert.ok(
        Math.max(...trailingPositions) - Math.min(...trailingPositions) >
          0.02,
      );
    } finally {
      physics.destroy();
      resetAmbientWindSpeed();
    }
  });

  it("turns pointer movement into a physical cloth impulse", () => {
    const physics = new AmmoClothPhysics();
    const positions = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0,
    ]);
    const cloth = physics.createCloth({
      positions,
      indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
      pinnedIndices: [0, 1],
      vertexUv: new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]),
    });
    physics.beginPointer(cloth, { x: -0.5, y: -1, z: 0 });
    physics.applyPointer(cloth, { x: -0.2, y: -0.75, z: 0 }, 1 / 60);
    physics.step(1 / 60);
    physics.writePositions(cloth, positions);

    assert.ok(positions[6] > -0.5);
    const sample = physics.sample(cloth, -1, 1);
    assert.ok(sample.position.z > 0);
    physics.endPointer(cloth);
    physics.destroy();
  });

  it("caps cloth stretch after a strong pointer impulse", () => {
    const physics = new AmmoClothPhysics();
    const positions = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0,
    ]);
    const cloth = physics.createCloth({
      positions,
      indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
      pinnedIndices: [0, 1],
    });
    physics.beginPointer(cloth, { x: -0.5, y: -1, z: 0 });
    physics.applyPointer(cloth, { x: 8, y: 4, z: 12 }, 1 / 120);
    for (let frame = 0; frame < 120; frame += 1) {
      physics.step(1 / 60);
    }
    physics.writePositions(cloth, positions);

    const distance = (left, right) => {
      const leftOffset = left * 3;
      const rightOffset = right * 3;
      return Math.hypot(
        positions[rightOffset] - positions[leftOffset],
        positions[rightOffset + 1] - positions[leftOffset + 1],
        positions[rightOffset + 2] - positions[leftOffset + 2],
      );
    };
    assert.ok(distance(0, 2) <= 1.09);
    assert.ok(distance(1, 3) <= 1.09);
    assert.ok(distance(0, 3) <= Math.SQRT2 * 1.09);
    physics.destroy();
  });

  it("keeps wall-mounted cloth on the exterior side of its wall", () => {
    const physics = new AmmoClothPhysics();
    const positions = new Float32Array([
      -0.5, 0, -0.25, 0.5, 0, -0.25, -0.5, -1, -0.25, 0.5, -1, -0.25,
    ]);
    const cloth = physics.createCloth({
      positions,
      indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
      pinnedIndices: [],
      wallPlane: 0,
    });
    physics.step(1 / 60);
    physics.writePositions(cloth, positions);

    for (let index = 2; index < positions.length; index += 3) {
      assert.ok(positions[index] >= 0);
    }
    physics.destroy();
  });

  it("blocks wind emerging through a wall and discards along-wall drag", () => {
    setAmbientWindSpeed(10);
    const physics = new AmmoClothPhysics();
    try {
      const positions = new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0,
      ]);
      const cloth = physics.createCloth({
        positions,
        indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
        pinnedIndices: [0, 1],
        wallPlane: 0,
      });

      for (let frame = 0; frame < 240; frame += 1) {
        physics.step(1 / 60);
      }
      physics.writePositions(cloth, positions);

      const freeEdgeCenterX = (positions[6] + positions[9]) / 2;
      const freeEdgeCenterZ = (positions[8] + positions[11]) / 2;
      assert.ok(Math.abs(freeEdgeCenterX) < 0.05);
      assert.ok(Math.abs(freeEdgeCenterZ) < 0.05);
    } finally {
      physics.destroy();
      resetAmbientWindSpeed();
    }
  });

  it("lets wind emerging through an opening catch the exposed cloth", () => {
    setAmbientWindSpeed(10);
    const physics = new AmmoClothPhysics();
    try {
      const positions = new Float32Array([
        0, 0, -0.5, 0, 0, 0.5,
        0, -0.5, -0.5, 0, -0.5, 0.5,
        0, -1, -0.5, 0, -1, 0.5,
      ]);
      const cloth = physics.createCloth({
        positions,
        indices: new Uint16Array([
          0, 2, 1, 1, 2, 3,
          2, 4, 3, 3, 4, 5,
        ]),
        pinnedIndices: [0, 1],
        normalAxis: 0,
        wallPlane: 0,
        wallOpeningWindExposure: new Float32Array([0, 0, 0, 0, 1, 1]),
      });

      for (let frame = 0; frame < 240; frame += 1) {
        physics.step(1 / 60);
      }
      physics.writePositions(cloth, positions);

      const shelteredCenterX = (positions[6] + positions[9]) / 2;
      const exposedCenterX = (positions[12] + positions[15]) / 2;
      const shelteredCenterZ = (positions[8] + positions[11]) / 2;
      const exposedCenterZ = (positions[14] + positions[17]) / 2;
      assert.ok(exposedCenterX > shelteredCenterX + 0.03);
      assert.ok(exposedCenterZ > shelteredCenterZ + 0.03);
    } finally {
      physics.destroy();
      resetAmbientWindSpeed();
    }
  });

  it("keeps portal-exposed cloth on the visible side of its wall", () => {
    setAmbientWindSpeed(10);
    class Vector {
      constructor(x = 0, y = 0, z = 0) {
        this.set(x, y, z);
      }

      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
    }
    class InverseTransform {
      copy() {
        return this;
      }

      invert() {
        return this;
      }

      transformVector(source, target) {
        return target.set(-source.x, source.y, -source.z);
      }
    }
    const physics = new AmmoClothPhysics({
      pc: { Mat4: InverseTransform, Vec3: Vector },
    });
    try {
      const positions = new Float32Array([
        0, 0, -0.5, 0, 0, 0.5,
        0, -0.5, -0.5, 0, -0.5, 0.5,
        0, -1, -0.5, 0, -1, 0.5,
      ]);
      const cloth = physics.createCloth({
        positions,
        indices: new Uint16Array([
          0, 2, 1, 1, 2, 3,
          2, 4, 3, 3, 4, 5,
        ]),
        pinnedIndices: [0, 1],
        root: { getWorldTransform: () => ({}) },
        normalAxis: 0,
        wallPlane: 0,
        wallOpeningWindExposure: new Float32Array([0, 0, 0, 0, 1, 1]),
      });

      for (let frame = 0; frame < 240; frame += 1) {
        physics.step(1 / 60);
      }
      physics.writePositions(cloth, positions);

      const shelteredCenterX = (positions[6] + positions[9]) / 2;
      const exposedCenterX = (positions[12] + positions[15]) / 2;
      const shelteredCenterZ = (positions[8] + positions[11]) / 2;
      const exposedCenterZ = (positions[14] + positions[17]) / 2;
      assert.ok(shelteredCenterX >= -0.0001);
      assert.ok(exposedCenterX >= -0.0001);
      assert.ok(exposedCenterZ < shelteredCenterZ - 0.03);
    } finally {
      physics.destroy();
      resetAmbientWindSpeed();
    }
  });

  it("deflects tower flags along the sloped roof surface", () => {
    const physics = new AmmoClothPhysics();
    const positions = new Float32Array([
      0, 0.25, 0, 0.5, 0.1, 0, 0, 0.1, 0.5,
    ]);
    const cloth = physics.createCloth({
      positions,
      indices: new Uint16Array([0, 1, 2]),
      pinnedIndices: [],
      roofCollider: {
        baseY: 0,
        halfWidth: 1,
        halfDepth: 1,
        height: 1,
      },
    });
    for (let frame = 0; frame < 60; frame += 1) {
      physics.step(1 / 60);
    }
    physics.writePositions(cloth, positions);

    const roofSurfaceAt = (x, z) =>
      1 - Math.max(Math.abs(x), Math.abs(z));
    for (let index = 0; index < positions.length; index += 3) {
      assert.ok(
        positions[index + 1] >=
          roofSurfaceAt(positions[index], positions[index + 2]),
      );
    }
    assert.ok(positions[3] > 0.5);
    assert.ok(positions[8] > 0.5);
    physics.destroy();
  });

  it("keeps cloth faces above the roof between their vertices", () => {
    const physics = new AmmoClothPhysics();
    const positions = new Float32Array([
      -0.8, 0.3, 0, 0.8, 0.3, 0, 0, 0.3, 0.8,
    ]);
    const cloth = physics.createCloth({
      positions,
      indices: new Uint16Array([0, 1, 2]),
      pinnedIndices: [],
      roofCollider: {
        baseY: 0,
        halfWidth: 1,
        halfDepth: 1,
        height: 1,
      },
    });
    physics.step(1 / 60);
    physics.writePositions(cloth, positions);

    const assertSurfaceContact = (weights) => {
      const point = [0, 0, 0];
      for (let vertex = 0; vertex < 3; vertex += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
          point[axis] += positions[vertex * 3 + axis] * weights[vertex];
        }
      }
      const roofY = 1 - Math.max(Math.abs(point[0]), Math.abs(point[2]));
      assert.ok(point[1] >= roofY + 0.065 - 0.0001);
    };
    assertSurfaceContact([0.5, 0.5, 0]);
    assertSurfaceContact([1 / 3, 1 / 3, 1 / 3]);
    physics.destroy();
  });

  it("keeps a tower flag bounded during prolonged roof contact", () => {
    const physics = new AmmoClothPhysics();
    const columns = 6;
    const rows = 5;
    const width = 1.25;
    const height = 0.625;
    const poleHeight = 1.25;
    const trailingEdgeHeightRatio = 0.2;
    const positions = [];
    const indices = [];
    const centerY = poleHeight - height / 2 - 0.12;
    for (let column = 0; column < columns; column += 1) {
      const freedom = column / (columns - 1);
      const halfHeight =
        (height / 2) *
        (1 - freedom * (1 - trailingEdgeHeightRatio));
      for (let row = 0; row <= rows; row += 1) {
        const vertical = 1 - (row / rows) * 2;
        positions.push(width * freedom, centerY + vertical * halfHeight, 0);
      }
    }
    const rowLength = rows + 1;
    for (let column = 0; column < columns - 1; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const topLeft = column * rowLength + row;
        const bottomLeft = topLeft + 1;
        const topRight = topLeft + rowLength;
        const bottomRight = topRight + 1;
        indices.push(
          topLeft,
          bottomRight,
          topRight,
          topLeft,
          bottomLeft,
          bottomRight,
        );
      }
    }
    const animatedPositions = Float32Array.from(positions);
    const restPositions = Float32Array.from(positions);
    const meshIndices = Uint16Array.from(indices);
    const cloth = physics.createCloth({
      positions: animatedPositions,
      indices: meshIndices,
      pinnedIndices: Array.from({ length: rows + 1 }, (_, index) => index),
      roofCollider: {
        baseY: -0.6,
        halfWidth: 0.7,
        halfDepth: 0.7,
        height: 0.85,
      },
      bendingStiffness: 0.18,
    });
    for (let frame = 0; frame < 900; frame += 1) {
      physics.step(1 / 60);
    }
    physics.writePositions(cloth, animatedPositions);

    const edges = new Set();
    for (let index = 0; index < meshIndices.length; index += 3) {
      const triangle = [
        meshIndices[index],
        meshIndices[index + 1],
        meshIndices[index + 2],
      ];
      for (let edge = 0; edge < 3; edge += 1) {
        const left = Math.min(triangle[edge], triangle[(edge + 1) % 3]);
        const right = Math.max(triangle[edge], triangle[(edge + 1) % 3]);
        edges.add(`${left}:${right}`);
      }
    }
    const distance = (values, left, right) => {
      const leftOffset = left * 3;
      const rightOffset = right * 3;
      return Math.hypot(
        values[rightOffset] - values[leftOffset],
        values[rightOffset + 1] - values[leftOffset + 1],
        values[rightOffset + 2] - values[leftOffset + 2],
      );
    };
    for (const edge of edges) {
      const [left, right] = edge.split(":").map(Number);
      assert.ok(
        distance(animatedPositions, left, right) <=
          distance(restPositions, left, right) * 1.09,
      );
      assert.ok(
        distance(animatedPositions, left, right) >=
          distance(restPositions, left, right) * 0.79,
      );
    }
    for (let index = 0; index < animatedPositions.length; index += 3) {
      const x = animatedPositions[index];
      const z = animatedPositions[index + 2];
      const roofRatio = Math.max(Math.abs(x) / 0.7, Math.abs(z) / 0.7);
      if (roofRatio <= 1) {
        const roofY = -0.6 + 0.85 * (1 - roofRatio) + 0.065;
        assert.ok(animatedPositions[index + 1] >= roofY - 0.0001);
      }
    }
    for (let index = 0; index < meshIndices.length; index += 3) {
      const face = [
        meshIndices[index],
        meshIndices[index + 1],
        meshIndices[index + 2],
      ];
      for (const weights of [
        [0.5, 0.5, 0],
        [0, 0.5, 0.5],
        [0.5, 0, 0.5],
        [1 / 3, 1 / 3, 1 / 3],
      ]) {
        const point = [0, 0, 0];
        for (let vertex = 0; vertex < face.length; vertex += 1) {
          const offset = face[vertex] * 3;
          for (let axis = 0; axis < 3; axis += 1) {
            point[axis] += animatedPositions[offset + axis] * weights[vertex];
          }
        }
        const roofRatio = Math.max(
          Math.abs(point[0]) / 0.7,
          Math.abs(point[2]) / 0.7,
        );
        if (roofRatio <= 1) {
          const roofY = -0.6 + 0.85 * (1 - roofRatio) + 0.065;
          assert.ok(point[1] >= roofY - 0.0001);
        }
      }
    }
    physics.destroy();
  });
});
