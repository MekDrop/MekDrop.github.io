import { test } from "node:test";
import assert from "node:assert/strict";
import { bridgeSlimeImplicitSurface, bridgeSlimeImplicitVolume } from "../../../../../src/game/objects/path/BridgeSlimeImplicitSurface.js";

test("implicit liquid joins unequal lobes into a closed volume-conserving mesh", () => {
  const mesh = bridgeSlimeImplicitSurface({
    lobes: [
      {
        center: [4, 2, -3],
        radii: [0.8, 0.3, 0.7],
      },
      {
        center: [4.7, 2, -2.8],
        radii: [0.6, 0.24, 0.32],
      },
      {
        center: [5.15, 2.02, -2.6],
        radii: [0.35, 0.2, 0.4],
      },
    ],
    volume: 0.7,
    maxCells: 12000,
  });
  assert.ok(mesh.positions.length > 100);
  assert.ok(mesh.cellCount <= 12000);
  assert.ok(Math.abs(bridgeSlimeImplicitVolume(mesh.positions, mesh.indices) - 0.7) < 0.007);
  assert.ok(mesh.positions.every(Number.isFinite));
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    for (let side = 0; side < 3; side++) {
      const a = mesh.indices[i + side], b = mesh.indices[i + (side + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2), "every surface edge has exactly two faces");
});

test("zero liquid volume produces no surface", () => {
  assert.equal(bridgeSlimeImplicitSurface({
    lobes: [],
    volume: 0,
  }).indices.length, 0);
});

test("weighted overlapping crests conserve volume with closed topology and unit normals", () => {
  const mesh = bridgeSlimeImplicitSurface({
    lobes: [
      {
        center: [0, 0, 0],
        radii: [0.8, 0.35, 0.6],
        weight: 1,
      },
      {
        center: [0.5, 0, 0],
        radii: [0.7, 0.3, 0.4],
        weight: 0.12,
      },
      {
        center: [0.9, 0.1, 0],
        radii: [0.55, 0.45, 0.5],
        weight: 1.4,
      },
    ],
    volume: 0.8,
    maxCells: 8000,
    smoothPasses: 1,
  });
  assert.ok(Math.abs(mesh.volume - 0.8) < 1e-8);
  const edges = new Map();
  for (let index = 0; index < mesh.indices.length; index += 3) {
    for (let side = 0; side < 3; side++) {
      const a = mesh.indices[index + side], b = mesh.indices[index + (side + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2));
  for (let index = 0; index < mesh.normals.length; index += 3) {
    assert.ok(Math.abs(Math.hypot(mesh.normals[index], mesh.normals[index + 1], mesh.normals[index + 2]) - 1) < 1e-8);
  }
});

test("analytic Gaussian normals are unit length and point out of a translated ellipsoid", () => {
  const center = [2, -1, 4];
  const mesh = bridgeSlimeImplicitSurface({
    lobes: [{
      center,
      radii: [0.8, 0.35, 0.5],
    }],
    volume: 0.4,
    maxCells: 8000,
  });
  assert.equal(mesh.normals.length, mesh.positions.length);
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const normal = mesh.normals.slice(index, index + 3);
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-8);
    const dot = normal[0] * (mesh.positions[index] - center[0]) + normal[1] * (mesh.positions[index + 1] - center[1]) + normal[2] * (mesh.positions[index + 2] - center[2]);
    assert.ok(dot > 0);
  }
});

test("animated warm starts bound extraction fits while retaining measured volume", () => {
  const lobes = [
    {
      center: [0, 0, 0],
      radii: [0.8, 0.3, 0.7],
    },
    {
      center: [0.7, 0, 0.2],
      radii: [0.6, 0.24, 0.32],
    },
  ];
  const previous = bridgeSlimeImplicitSurface({
    lobes,
    volume: 0.6,
    maxCells: 20000,
  });
  lobes[1].center[2] += 0.025;
  const next = bridgeSlimeImplicitSurface({
    lobes,
    volume: 0.61,
    spacing: 0.17,
    maxCells: 20000,
    initialIsovalue: previous.isovalue,
    maxFits: 3,
  });
  assert.ok(next.fits <= 3);
  assert.ok(next.isovalue > 0);
  assert.ok(next.cellCount <= 20000);
  assert.ok(Math.abs(next.volume - 0.61) / 0.61 < 0.01);
  assert.ok(Math.abs(next.correctionScale - 1) < 0.03);
});

test("six metre overlapping tongue retains a closed surface within its cell budget", () => {
  const lobes = [];
  for (let index = 0; index < 25; index++) {
    lobes.push({
      center: [index * 0.25, 0, Math.sin(index) * 0.04],
      radii: index === 0 ? [0.8, 0.3, 0.7] : [0.36, 0.2, 0.42],
    });
  }
  const mesh = bridgeSlimeImplicitSurface({
    lobes,
    volume: 3,
    spacing: 0.14,
    maxCells: 20000,
  });
  assert.ok(mesh.cellCount <= 20000);
  assert.ok(mesh.spacing < 0.18);
  assert.ok(Math.abs(mesh.volume - 3) < 0.03);
  const edges = new Map();
  for (let index = 0; index < mesh.indices.length; index += 3) {
    for (let side = 0; side < 3; side++) {
      const a = mesh.indices[index + side], b = mesh.indices[index + (side + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2));
});

test("one smoothing pass retains topology, exact volume and outward analytic normals", () => {
  const lobes = [];
  for (let index = 0; index < 25; index++) {
    lobes.push({
      center: [index * 0.25, Math.sin(index * 0.3) * 0.12, Math.sin(index) * 0.04],
      radii: index === 0 ? [0.8, 0.3, 0.7] : [0.36, 0.2, 0.42],
    });
  }
  const options = {
    lobes,
    volume: 3,
    maxCells: 8000,
  };
  const raw = bridgeSlimeImplicitSurface(options);
  const smooth = bridgeSlimeImplicitSurface({
    ...options,
    smoothPasses: 1,
  });
  assert.deepEqual(smooth.indices, raw.indices);
  assert.ok(Math.abs(smooth.volume - 3) < 1e-8);
  assert.ok(smooth.cellCount <= 8000);
  for (let index = 0; index < smooth.indices.length; index += 3) {
    const a = smooth.indices[index] * 3, b = smooth.indices[index + 1] * 3, c = smooth.indices[index + 2] * 3;
    const p = smooth.positions, n = smooth.normals;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const dot = (uy * vz - uz * vy) * (n[a] + n[b] + n[c]) + (uz * vx - ux * vz) * (n[a + 1] + n[b + 1] + n[c + 1]) + (ux * vy - uy * vx) * (n[a + 2] + n[b + 2] + n[c + 2]);
    assert.ok(dot > 0);
  }
});
