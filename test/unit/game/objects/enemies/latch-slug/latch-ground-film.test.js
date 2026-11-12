import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { LatchGroundFilm } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGroundFilm.js";
import { LatchGroundRunoff } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGroundRunoff.js";

test("runoff spreads forward and sideways while accounting for absorption", () => {
  const f = new LatchGroundFilm({
    minX: -1,
    maxX: 1,
    depth: 1.8,
    columns: 41,
    rows: 37,
    support: (x, z) => z < 1.4 && Math.abs(x) < 0.8 ? 0 : null,
  });
  assert.equal(f.deposit(0, 0.04), 0.04);
  for (let i = 0; i < 120; i++) {
    f.update(1 / 60);
  }
  let front = 0, side = 0;
  for (let i = 0; i < f.height.length; i++) {
    const x = f.minX + i % f.columns * f.dx, z = Math.floor(i / f.columns) * f.dz;
    if (z > 0.2) {
      front += f.height[i] * f.area;
    }
    if (Math.abs(x) > 0.2) {
      side += f.height[i] * f.area;
    }
    if (!Number.isFinite(f.support[i])) {
      assert.equal(f.height[i], 0);
    }
  }
  assert.ok(front > 0.0001, "runoff moves forward from the sill");
  assert.ok(side > 0.0001, "runoff spreads sideways");
  assert.ok(Math.abs(f.volume + f.absorbedVolume - 0.04) < 1e-9);
});

test("runoff cannot cross a gap in floor support", () => {
  const f = new LatchGroundFilm({
    minX: -0.5,
    maxX: 0.5,
    depth: 1,
    columns: 21,
    rows: 21,
    support: (x, z) => z >= 0.3 && z <= 0.4 ? null : 0,
  });
  f.deposit(0, 0.02);
  for (let i = 0; i < 600; i++) {
    f.update(1 / 60);
  }
  for (let i = 0; i < f.height.length; i++) {
    if (Math.floor(i / f.columns) * f.dz > 0.4) {
      assert.equal(f.height[i], 0);
    }
  }
  assert.ok(Math.abs(f.volume + f.absorbedVolume - 0.02) < 1e-9);
});

test("a wet edge extends the sampled floor instead of stopping at the grid boundary", () => {
  const f = new LatchGroundFilm({
    minX: -0.1,
    maxX: 0.1,
    depth: 0.2,
    columns: 5,
    rows: 5,
    support: () => 0,
  });
  f.deposit(0, 0.02);
  for (let i = 0; i < 300; i++) {
    f.update(1 / 60);
  }
  assert.ok(f.rows > 5 && f.columns > 5);
  assert.ok(Math.abs(f.volume + f.absorbedVolume - 0.02) < 1e-9);
});

test("downhill flow remains connected and eventually absorbs into the ground", () => {
  const f = new LatchGroundFilm({
    minX: -0.5,
    maxX: 0.5,
    depth: 2,
    columns: 21,
    rows: 41,
    support: (x, z) => -0.03 * z,
  });
  f.deposit(0, 0.04);
  for (let frame = 0; frame < 120; frame++) {
    f.update(1 / 60);
  }
  const wet = new Set();
  for (let i = 0; i < f.height.length; i++) {
    if (f.height[i] > 0.002) {
      wet.add(i);
    }
  }
  assert.ok(wet.size > 0, "some goo is still visible while it is drying");
  const pending = [wet.values().next().value];
  wet.delete(pending[0]);
  while (pending.length) {
    const current = pending.pop(), x = current % f.columns, z = Math.floor(current / f.columns);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz, next = nz * f.columns + nx;
        if (nx >= 0 && nx < f.columns && nz >= 0 && nz < f.rows && wet.delete(next)) {
          pending.push(next);
        }
      }
    }
  }
  assert.equal(wet.size, 0, "there is no detached visible patch ahead of the flow");
  assert.ok(f.absorbedVolume > 0 && f.volume < 0.04);
  for (let frame = 0; frame < 7200; frame++) {
    f.update(1 / 60);
  }
  assert.ok(f.volume < 1e-7, "the ground residue eventually disappears");
  assert.ok(Math.abs(f.volume + f.absorbedVolume - 0.04) < 1e-8);
});

test("a shallow slope does not pull thin gel into a long narrow tail", () => {
  const f = new LatchGroundFilm({
    minX: -1,
    maxX: 1,
    depth: 3,
    columns: 41,
    rows: 61,
    support: (x, z) => -0.03 * z,
  });
  f.deposit(0, 0.04);
  for (let frame = 0; frame < 120; frame++) {
    f.update(1 / 60);
  }
  let left = Infinity, right = -Infinity, front = 0;
  for (let i = 0; i < f.height.length; i++) {
    if (f.height[i] > 0.002) {
      const x = f.minX + i % f.columns * f.dx;
      left = Math.min(left, x);
      right = Math.max(right, x);
      front = Math.max(front, Math.floor(i / f.columns) * f.dz);
    }
  }
  assert.ok(front > 0.1 && right > left, "gel still spreads on the floor");
  assert.ok(front < (right - left) * 1.5, "the visible puddle stays compact");
});

test("ground contact absorbs most of its volume within a few seconds", () => {
  const f = new LatchGroundFilm({
    minX: -1,
    maxX: 1,
    depth: 1.8,
    columns: 41,
    rows: 37,
    support: () => 0,
  });
  f.deposit(0, 0.04);
  for (let frame = 0; frame < 180; frame++) {
    f.update(1 / 60);
  }
  assert.ok(f.volume < 0.004, "at least 90% is absorbed after three seconds");
  assert.ok(Math.abs(f.volume + f.absorbedVolume - 0.04) < 1e-9);
});

test("ground runoff exposes collectible points and removes only contacted mass", () => {
  const runoff = Object.create(LatchGroundRunoff.prototype);
  runoff.surface = {
    owner: { pc },
    splash: { entity: new pc.Entity() },
    normalSign: 1,
    floor: 0,
  };
  runoff.film = new LatchGroundFilm({
    minX: -0.5,
    maxX: 0.5,
    depth: 1,
    columns: 21,
    rows: 21,
    support: () => 0,
  });
  runoff.film.deposit(0, 0.02);
  for (let i = 0; i < 120; i++) {
    runoff.film.update(1 / 60);
  }
  assert.ok(runoff.candidates(new pc.Vec3(0, 0, 0), 0.5).length > 0);
  const before = runoff.film.volume;
  const removed = runoff.cut(new pc.Vec3(0, 0, 0), new pc.Vec3(0, 0, 0.15), 0.15);
  assert.ok(removed.volume > 0);
  assert.ok(removed.positions.length > 0);
  assert.ok(Math.abs(runoff.film.volume + removed.volume - before) < 1e-9);
});

test("a missing floor returns runoff to its original wall cell", () => {
  const runoff = Object.create(LatchGroundRunoff.prototype);
  let refreshed = false;
  runoff.surface = {
    film: {
      nx: 1,
      minX: 0,
      dx: 0.1,
      runoff: new Float64Array([0.01]),
      runoffSource: new Int32Array([1]),
      heights: new Float64Array(2),
      areas: new Float64Array([0.01, 0.02]),
      refresh: () => {
        refreshed = true;
      },
    },
  };
  runoff.film = new LatchGroundFilm({
    minX: -0.5,
    maxX: 0.5,
    depth: 1,
    columns: 11,
    rows: 11,
    support: () => null,
  });
  runoff.update(0.01);
  assert.equal(runoff.film.volume, 0);
  assert.equal(runoff.surface.film.heights[1], 0.5);
  assert.equal(refreshed, true);
});
