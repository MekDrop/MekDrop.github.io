import assert from "node:assert/strict";
import test from "node:test";
import { LatchDoorFilm } from "../../../../../../src/game/objects/enemies/latch-slug/LatchDoorFilm.js";

function film() {
  return new LatchDoorFilm({
    positions: new Float32Array([-0.4,0,0.12,0.4,0,0.12,0.4,0.7,0.12,-0.4,0.7,0.12]),
    indices: [0,1,2,0,2,3],
    field: { height: (x,y) => 0.02 + 0.01 * Math.sin(x*8+y*4) },
    floor: -1,
    volume: 0.04,
  });
}

test("deposit conservation leaves the dry padding of the impact mesh dry", () => {
  const positions = [], indices = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const px = x / 4 - 1, py = y / 4 - 1;
      positions.push(px, py, Math.hypot(px, py) < 0.4 ? 0.03 : 0);
      if (x < 8 && y < 8) {
        const a = y * 9 + x;
        indices.push(a, a + 1, a + 10, a, a + 10, a + 9);
      }
    }
  }
  const f = new LatchDoorFilm({
    positions: new Float32Array(positions),
    indices,
    field: { height: () => 0 },
    floor: -2,
    volume: 0.04,
  });
  for (let i = 0; i < f.count; i++) {
    if (Math.abs(f.base[i * 3]) > 0.55 || Math.abs(f.base[i * 3 + 1]) > 0.55) {
      assert.equal(f.heights[i], 0, "mass redistribution must not wet dry template triangles");
    }
  }
  assert.ok(Math.abs(f.volume - 0.04) < 1e-10);
});

test("raised hardware between impact vertices cannot erase a fresh deposit", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.4, 0, 0.03, 0.4, 0, 0.03, 0.4, 0.7, 0.03, -0.4, 0.7, 0.03]),
    indices: [0, 1, 2, 0, 2, 3],
    field: { height: (x, y) => Math.abs(x) < 0.399 && y > 0.001 && y < 0.699 ? 0.3 : 0 },
    floor: -1,
    volume: 0.01,
  });

  assert.ok(Math.abs(f.volume - 0.01) < 1e-10);
  assert.equal(f.drained, false);
  assert.ok(f.renderIndices.length > 0);
  f.update(1 / 60);
  assert.ok(Math.abs(f.volume - 0.01) < 1e-10);
  assert.equal(f.drained, false);
});

test("a nearly empty raster redistributes gel without amplifying one sample into a spike", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.4, 0, -0.1, 0.4, 0, -0.1, 0.4, 0.7, -0.1, -0.4, 0.7, 0.04]),
    indices: [0, 1, 2, 0, 2, 3],
    field: { height: () => 0 },
    floor: -1,
    volume: 0.04,
  });

  assert.ok(Math.abs(f.volume - 0.04) < 1e-10);
  assert.ok(Math.max(...f.heights) <= 0.12 + 1e-10);
  assert.ok(f.renderIndices.length > 0);
  for (let frame = 0; frame < 60; frame++) {
    f.update(1 / 60);
  }
  assert.ok(Math.abs(f.volume - 0.04) < 1e-10);
  assert.ok(Math.max(...f.heights) < 0.13);
});

test("actual impact skin seeds a bounded single-valued film with exact mass", () => {
  const f = film();
  assert.ok(f.count <= 4096);
  assert.ok(Math.abs(f.volume - 0.04) < 1e-10);
  assert.equal(f.density,1200);
  assert.ok(Math.abs(f.mass-48) < 1e-8, "1.2 g/cm³ is 1200 kg per cubic metre");
  const before = f.positions.slice();
  const removed = f.cut({
    x:0,
    y:0.35,
    z:0.14,
  },{
    x:0,
    y:0.35,
    z:0.14,
  },0.13);
  assert.ok(removed > 0);
  const volume = f.volume;
  let center = 0, distance = Infinity;
  for (let i=0;i<f.count;i++) {
    const d = Math.hypot(f.base[i*3],f.base[i*3+1]-0.35);
    if(d<distance) {
      distance=d;center=i;
    }
  }
  const cutHeight = f.heights[center];
  for(let frame=0;frame<180;frame++) {
    f.update(1/60);
  }
  assert.ok(f.heights[center] > cutHeight + 0.001, "remaining gel closes the central eaten gap");
  assert.ok(Math.abs(f.volume-volume) < 1e-10);
  for(let i=0;i<f.count;i++) {
    assert.equal(f.positions[i*3],before[i*3]);
    assert.equal(f.positions[i*3+1],before[i*3+1]);
    assert.ok(f.positions[i*3+2]>=f.base[i*3+2]);
  }
});

test("a clipped impact tapers at its supported edge without losing volume", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.5, 0, 0.12, 0.5, 0, 0.12, 0.5, 0.8, 0.12, -0.5, 0.8, 0.12]),
    indices: [0, 1, 2, 0, 2, 3],
    field: {
      height: () => 0,
      contains: x => x < 0.1,
    },
    floor: -1,
    volume: 0.04,
  });
  let edge = -Infinity, edgePeak = 0, centerPeak = 0;
  for (let i = 0; i < f.count; i++) {
    if (f.heights[i] <= 0) {
      continue;
    }
    const x = f.base[i * 3];
    if (x > edge + 1e-5) {
      edge = x;
      edgePeak = 0;
    }
    if (Math.abs(x - edge) < 1e-5) {
      edgePeak = Math.max(edgePeak, f.heights[i]);
    }
    if (x > -0.35 && x < -0.2) {
      centerPeak = Math.max(centerPeak, f.heights[i]);
    }
  }
  assert.ok(edgePeak < centerPeak * 0.5, "the contact edge does not end in a thick vertical slab");
  assert.ok(Math.abs(f.volume - 0.04) < 1e-9);
});

test("an initial splat keeps only the impact-connected component", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([
      -0.2, -0.2, 0.1, 0.2, -0.2, 0.1, 0.2, 0.2, 0.1, -0.2, 0.2, 0.1,
      0.6, -0.2, 0.1, 0.8, -0.2, 0.1, 0.8, 0.2, 0.1, 0.6, 0.2, 0.1,
    ]),
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    field: { height: () => 0 },
    floor: -1,
    volume: 0.02,
  });
  for (let i = 0; i < f.count; i++) {
    if (f.base[i * 3] > 0.5) {
      assert.equal(f.heights[i], 0, "a detached fragment is not seeded beside the impact");
    }
  }
  assert.ok(Math.abs(f.volume - 0.02) < 1e-9);
});

test("a sharp change in support depth tapers both sides of the impact", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.5, 0, 0.3, 0.5, 0, 0.3, 0.5, 0.8, 0.3, -0.5, 0.8, 0.3]),
    indices: [0, 1, 2, 0, 2, 3],
    field: { height: x => x < 0 ? 0 : 0.25 },
    floor: -1,
    volume: 0.04,
  });
  let near = 0, middle = 0;
  for (let i = 0; i < f.count; i++) {
    const x = f.base[i * 3], y = f.base[i * 3 + 1];
    if (y < 0.3 || y > 0.5) {
      continue;
    }
    if (Math.abs(x) < f.dx) {
      near = Math.max(near, f.heights[i]);
    }
    if (x > -0.35 && x < -0.2) {
      middle = Math.max(middle, f.heights[i]);
    }
  }
  assert.ok(near < middle * 0.5, "the gel narrows rather than forming a fin at the corner");
  assert.ok(Math.abs(f.volume - 0.04) < 1e-9);
});

test("thicker pockets descend faster while the fixed grid cannot fold into a fin", () => {
  const thick=film(),thin=film();
  thick.heights.fill(0);thin.heights.fill(0);
  const v=Math.floor(thick.ny*0.7)*thick.nx+Math.floor(thick.nx/2);
  thick.heights[v]=0.15;thin.heights[v]=0.025;
  const centroid = f => {
    let sum=0;
    for(let i=0;i<f.count;i++) {
      sum+=f.heights[i]*f.areas[i]*f.base[i*3+1];
    }

    return sum/f.volume;
  };
  const top=centroid(thick);
  thick.update(0.1);thin.update(0.1);
  assert.ok(top-centroid(thick) > (top-centroid(thin))*1.5);
});

test("gel accumulating above a blocked surface does not become a deep fin", () => {
  const f = film();
  f.heights.fill(0);
  const middle = Math.floor(f.nx / 2), barrier = Math.floor(f.ny / 3);
  for (let x = 0; x < f.nx; x++) {
    f.supported[barrier * f.nx + x] = 0;
  }
  for (let y = barrier + 1; y < barrier + 16 && y < f.ny; y++) {
    for (let x = middle - 3; x <= middle + 3; x++) {
      f.heights[y * f.nx + x] = 0.1;
      f.wetColumns[x] = 1;
    }
  }
  f.flowSpeed = 0.5;
  const volume = f.volume;
  for (let frame = 0; frame < 600; frame++) {
    f.update(1 / 60);
  }
  assert.ok(Math.max(...f.heights) < 0.25, "back-pressure prevents an outward spike");
  assert.ok(Math.abs(f.volume - volume) < 1e-8, "blocked gel remains accounted for");
});

test("sub-millimetre residue does not render the rectangular solver domain", () => {
  const f = film();
  f.heights.fill(0.0005);
  f.refresh();
  assert.equal(f.renderIndices.length,0);
  assert.ok(f.volume > 0, "hidden residue still belongs to the mass balance");
  const center = Math.floor(f.count/2);
  f.heights[center] = 0.04;
  f.refresh();
  assert.ok(f.renderIndices.length > 0);
  assert.ok(f.renderIndices.length < f.frontIndices.length/4, "only the wet pocket is visible");
});

test("settling gel keeps a dry margin instead of exposing the rectangular boundary", () => {
  const f = film();
  for (let frame=0;frame<480;frame++) {
    f.update(1/60);
  }
  let wet = 0;
  for (let i=0;i<f.count;i++) {
    if (f.heights[i] <= 0.004) {
      continue;
    }
    wet++;
    const x = i%f.nx;
    assert.ok(x > 1 && x < f.nx-2, "wet edge stays inside the solver sides");
  }
  assert.ok(wet > 0 && wet < f.count*0.8);
});

test("post-impact transport never raises the top of the wet footprint", () => {
  const f = film();
  f.heights.fill(0);
  const seed = Math.floor(f.ny/2)*f.nx+Math.floor(f.nx/2);
  f.heights[seed] = 0.12;
  const top = f.base[seed*3+1];
  for (let frame=0;frame<180;frame++) {
    f.update(1/60);
  }
  for (let i=0;i<f.count;i++) {
    if (f.base[i*3+1] > top+0.00001) {
      assert.equal(f.heights[i],0, "no gel climbs into a higher dry row");
    }
    assert.ok(f.heights[i] < 0.15, "settling cannot force a thin pool into a long outward spike");
  }
});

test("transport cannot fill unsupported air beside the door or arch", () => {
  const f = film();
  const edge = Math.floor(f.nx/2);
  for (let i=0;i<f.count;i++) {
    if (i%f.nx > edge) {
      f.supported[i] = 0;
      f.heights[i] = 0;
    }
  }
  for (let frame=0;frame<180;frame++) {
    f.update(1/60);
  }
  for (let i=0;i<f.count;i++) {
    if (!f.supported[i]) {
      assert.equal(f.heights[i],0);
    }
  }
});

test("a lightly loaded film retains its impact footprint", () => {
  const f = film();
  const width = f.wetColumns.slice();
  for (let frame=0;frame<600;frame++) {
    f.update(1/60);
  }
  for (let i=0;i<f.count;i++) {
    if (!width[i%f.nx]) {
      assert.ok(f.heights[i] <= 0.002, "no new coating grows sideways beyond the impact");
    }
  }
});

test("combined gel pressure spreads into adjacent supported masonry without creating mass", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.35, 0, 0.08, -0.05, 0, 0.08, -0.05, 0.6, 0.08, -0.35, 0.6, 0.08]),
    indices: [0, 1, 2, 0, 2, 3],
    field: {
      height: () => 0,
      contains: x => x <= 0,
      support: x => x < 0.4 ? 0 : null,
    },
    floor: -1,
    volume: 0.012,
  });
  f.flowSpeed = 0;
  const initial = f.volume;
  for (let frame = 0; frame < 600; frame++) {
    f.update(1 / 60, 5);
  }
  let overflow = 0;
  for (let i = 0; i < f.count; i++) {
    if (f.base[i * 3] > 0.02) {
      overflow += f.heights[i] * f.areas[i];
    }
    if (!f.supported[i]) {
      assert.equal(f.heights[i], 0);
    }
  }
  assert.ok(overflow > 0.0001, "pressure wets connected stone beside the door");
  assert.ok(Math.abs(f.volume - initial) < 1e-8, "overflow redistributes existing gel");
});

test("gel grows a conserved neck across a clear one-cell seam", () => {
  for (const direction of [-1, 1]) {
    const f = film();
    f.heights.fill(0);
    f.supported.fill(1);
    f.flowSpeed = 0;
    const seam = Math.floor(f.nx / 2), row = Math.floor(f.ny * 0.65);
    for (let y = 0; y < f.ny; y++) {
      f.supported[y * f.nx + seam] = 0;
      f.seamPassable[y * f.nx + seam - 1] = 1;
    }
    f.heights[row * f.nx + seam - direction] = 0.16;
    const before = f.volume;
    for (let frame = 0; frame < 900; frame++) {
      f.update(1 / 60, 5);
    }
    let across = 0, neck = 0;
    for (let i = 0; i < f.count; i++) {
      const x = i % f.nx;
      if ((x - seam) * direction > 0) {
        across += f.heights[i] * f.areas[i];
      }
      if (x === seam) {
        neck += f.heights[i] * f.areas[i];
      }
    }
    assert.ok(across > 0.00001, "pressure transfers gel to the supported opposite side");
    assert.ok(neck > 0, "the connection contains gel rather than teleporting it across");
    const edges = new Map();
    for (let i = 0; i < f.renderIndices.length; i += 3) {
      const triangle = f.renderIndices.slice(i, i + 3).map(index => index % f.count);
      for (const vertex of triangle) {
        const neighbors = edges.get(vertex) ?? new Set();
        for (const other of triangle) {
          neighbors.add(other);
        }
        edges.set(vertex, neighbors);
      }
    }
    const visited = new Set(), pending = [row * f.nx + seam - direction];
    while (pending.length) {
      const vertex = pending.pop();
      if (visited.has(vertex)) {
        continue;
      }
      visited.add(vertex);
      for (const next of edges.get(vertex) ?? []) {
        pending.push(next);
      }
    }
    let visibleAcross = false;
    for (const vertex of visited) {
      visibleAcross ||= (vertex % f.nx - seam) * direction > 0 && f.heights[vertex] > 0.004;
    }
    assert.ok(visibleAcross, "the visible mesh forms one connected mass across the seam");
    assert.ok(Math.abs(f.volume - before) < 1e-9);
  }
});

test("a solid obstruction blocks transfer across an otherwise narrow supported seam", () => {
  const makeFilm = canCross => new LatchDoorFilm({
    positions: new Float32Array([-0.4, 0, 0.12, 0.4, 0, 0.12, 0.4, 0.7, 0.12, -0.4, 0.7, 0.12]),
    indices: [0, 1, 2, 0, 2, 3],
    field: {
      height: () => 0,
      contains: x => x < 0,
      support: x => x >= 0.05 ? 0 : null,
      canCross,
    },
    floor: -1,
    volume: 0.04,
  });
  const blocked = makeFilm(() => false), clear = makeFilm(() => true);
  assert.ok(clear.seamPassable.some(isNonzero), "a clear seam can carry gel");
  assert.ok(blocked.seamPassable.every(isZero), "a wall prevents all seam transfers");
  for (const f of [blocked, clear]) {
    for (let i = 0; i < f.renderIndices.length; i++) {
      assert.equal(f.supported[f.renderIndices[i] % f.count], 1,
        "rendered gel uses only supported vertices");
    }
  }
});

test("a projecting masonry corner blocks flow and render triangles across its depth step", () => {
  const f = film(), corner = Math.floor(f.nx / 2), row = Math.floor(f.ny / 2);
  f.heights.fill(0);
  f.supported.fill(1);
  f.flowSpeed = 0;
  for (let i = 0; i < f.count; i++) {
    const depth = i % f.nx < corner ? 0 : 0.25;
    f.base[i * 3 + 2] = depth;
    f.base[(i + f.count) * 3 + 2] = depth;
  }
  f.heights[row * f.nx + corner - 1] = 0.16;
  const volume = f.volume;
  for (let frame = 0; frame < 300; frame++) {
    f.update(1 / 60, 5);
  }
  for (let i = 0; i < f.count; i++) {
    if (i % f.nx >= corner) {
      assert.equal(f.heights[i], 0, "gel cannot pass through the corner");
    }
  }
  for (let i = 0; i < f.renderIndices.length; i += 3) {
    const depths = [];
    for (let j = 0; j < 3; j++) {
      depths.push(f.base[(f.renderIndices[i + j] % f.count) * 3 + 2]);
    }
    assert.ok(Math.max(...depths) - Math.min(...depths) <= 0.08, "triangles do not cut across the corner");
  }
  assert.ok(Math.abs(f.volume - volume) < 1e-9);
});

test("downward flow cannot pass through a vertical support-depth discontinuity", () => {
  const f = film(), barrier = Math.floor(f.ny / 2), column = Math.floor(f.nx / 2);
  f.heights.fill(0);
  f.supported.fill(1);
  f.flowSpeed = 1;
  for (let i = 0; i < f.count; i++) {
    const depth = Math.floor(i / f.nx) < barrier ? 0.25 : 0;
    f.base[i * 3 + 2] = depth;
    f.base[(i + f.count) * 3 + 2] = depth;
  }
  f.heights[barrier * f.nx + column] = 0.15;
  const volume = f.volume;
  for (let frame = 0; frame < 300; frame++) {
    f.update(1 / 60);
  }
  for (let i = 0; i < f.count; i++) {
    if (Math.floor(i / f.nx) < barrier) {
      assert.equal(f.heights[i], 0);
    }
  }
  assert.ok(Math.abs(f.volume - volume) < 1e-9);
});

test("gel settling against a blocked side retains a tapered edge and its mass", () => {
  const f = film(), corner = Math.floor(f.nx / 2), row = Math.floor(f.ny / 2);
  f.heights.fill(0);
  f.supported.fill(1);
  f.flowSpeed = 0;
  for (let y = 0; y < f.ny; y++) {
    f.supported[y * f.nx + corner] = 0;
  }
  f.heights[row * f.nx + corner - 1] = 0.15;
  f.heights[row * f.nx + corner - 2] = 0.1;
  const volume = f.volume;
  for (let frame = 0; frame < 120; frame++) {
    f.update(1 / 60);
  }
  assert.ok(f.heights[row * f.nx + corner - 1] < f.heights[row * f.nx + corner - 2] * 0.5);
  assert.ok(Math.abs(f.volume - volume) < 1e-9);
});

/**
 * @param {number} value
 * @returns {boolean}
 */
function isNonzero(value) {
  return value !== 0;
}

test("a supported projecting arch receives gel without adding mass or coating air", () => {
  const f = new LatchDoorFilm({
    positions:new Float32Array([-0.4,0,0.12,0.4,0,0.12,0.4,0.7,0.12,-0.4,0.7,0.12]),
    indices:[0,1,2,0,2,3],
    field:{
      height:()=>0,
      contains:x=>x<0,
      support:x=>x<0.3?0.04:null,
    },
    floor:-1,
    volume:0.04,
  });
  let wrapped = 0;
  for (let i=0;i<f.count;i++) {
    const x = f.base[i*3];
    if (x>0.05 && x<0.25 && f.heights[i]>0.004) {
      wrapped++;
      assert.ok(f.positions[i*3+2]>0.04);
    }
    if (x>0.3) {
      assert.equal(f.heights[i],0);
    }
  }
  assert.ok(wrapped>0, "the forward offset of stone does not erase the deposit");
  assert.ok(Math.abs(f.volume-0.04)<1e-10);
});

test("the initial impact cannot seed gel through a projecting wall corner", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.4, 0, 0.12, 0.4, 0, 0.12, 0.4, 0.7, 0.12, -0.4, 0.7, 0.12]),
    indices: [0, 1, 2, 0, 2, 3],
    field: {
      height: () => 0,
      contains: x => x < 0,
      support: x => x < 0.4 ? 0.25 : null,
    },
    floor: -1,
    volume: 0.04,
  });
  for (let i = 0; i < f.count; i++) {
    if (f.base[i * 3] >= 0) {
      assert.equal(f.heights[i], 0, "the separated wall face is not part of the initial impact");
    }
  }
  assert.ok(Math.abs(f.volume - 0.04) < 1e-9);
});

test("a high impact can descend to the real sill instead of pooling on the solver boundary", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.2, 0, 0.12, 0.2, 0, 0.12, 0.2, 0.4, 0.12, -0.2, 0.4, 0.12]),
    indices: [0, 1, 2, 0, 2, 3],
    field: { height: () => 0 },
    floor: -2,
    volume: 0.02,
  });
  f.flowSpeed = 1;
  for (let step = 0; step < 300; step++) {
    f.update(0.1);
  }
  let lowMass = 0;
  for (let i = 0; i < f.count; i++) {
    if (f.base[i * 3 + 1] < -0.8) {
      lowMass += f.heights[i] * f.areas[i];
    }
  }
  assert.ok(lowMass > 0.001 || f.volume < 0.019,
    "gel must travel below the old impact-minus-0.65m boundary or drain at the sill");
});

test("the lowest supported wall cell hands runoff across a narrow sill gap", () => {
  const f = film();
  f.age = 180;
  f.heights.fill(0);
  const column = Math.floor(f.nx / 2), source = f.nx * 2 + column;
  f.supported[column] = 0;
  f.supported[f.nx + column] = 0;
  f.supported[source] = 1;
  f.heights[source] = 0.1;
  const before = f.volume;
  f.update(0.1);
  assert.ok(f.runoff[column] > 0);
  assert.equal(f.runoffSource[column], source);
  let runoff = 0;
  for (const amount of f.runoff) {
    runoff += amount;
  }
  assert.ok(Math.abs(f.volume + runoff - before) < 1e-9);
});

test("door gel cannot reach the floor during the first three minutes", () => {
  const f = film();
  f.heights.fill(0);
  const column = Math.floor(f.nx / 2);
  f.heights[column] = 0.1;
  f.age = 179.8;
  const before = f.volume;
  f.update(0.1);
  f.update(0.1);
  assert.ok(Math.abs(f.volume - before) < 1e-9, "the wall retains its gel before the holdback ends");
  assert.ok(f.runoff.every(isZero), "no gel is transferred to the floor");
  f.update(0.1);
  assert.ok(f.runoff[column] > 0, "runoff begins after three minutes");
});

/**
 * @param {number} value
 * @returns {boolean}
 */
function isZero(value) {
  return value === 0;
}

test("one impact cannot seed a detached masonry strip across an unsupported jamb gap", () => {
  const f = new LatchDoorFilm({
    positions: new Float32Array([-0.4, 0, 0.12, 0.4, 0, 0.12, 0.4, 0.7, 0.12, -0.4, 0.7, 0.12]),
    indices: [0, 1, 2, 0, 2, 3],
    field: {
      height: () => 0,
      contains: x => x < 0.15,
      support: x => x > 0.25 ? 0.15 : null,
    },
    floor: -1,
    volume: 0.04,
  });
  for (let i = 0; i < f.count; i++) {
    if (f.base[i * 3] > 0.25) {
      assert.equal(f.heights[i], 0, "the separate wall is not connected to the impacted leaf");
    }
  }
  assert.ok(Math.abs(f.volume - 0.04) < 1e-10);
});

test("a rounded intact splat keeps a tapered contour after ten seconds of settling", () => {
  const positions = [], indices = [];
  for (let y = 0; y <= 20; y++) {
    for (let x = 0; x <= 20; x++) {
      const px = x / 20 - 0.5, py = y / 20;
      const radius = Math.hypot(px / 0.45, (py - 0.5) / 0.4);
      positions.push(px, py, radius < 1 ? 0.1 * Math.sqrt(1 - radius * radius) : 0);
      if (x < 20 && y < 20) {
        const a = y * 21 + x;
        indices.push(a, a + 1, a + 22, a, a + 22, a + 21);
      }
    }
  }
  const f = new LatchDoorFilm({
    positions: new Float32Array(positions),
    indices,
    field: { height: () => 0 },
    floor: -2,
    volume: 0.04,
  });
  for (let frame = 0; frame < 600; frame++) {
    f.update(1 / 60);
  }
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, wet = 0;
  for (let i = 0; i < f.count; i++) {
    if (f.heights[i] > 0.004) {
      wet++;
      left = Math.min(left, i % f.nx);
      right = Math.max(right, i % f.nx);
      bottom = Math.min(bottom, Math.floor(i / f.nx));
      top = Math.max(top, Math.floor(i / f.nx));
    }
  }
  assert.ok(wet / ((right - left + 1) * (top - bottom + 1)) < 0.85,
    "the visible contour must not fill its bounding rectangle");
  assert.ok(Math.abs(f.volume - 0.04) < 1e-8, "retaining the contour must not discard gel");
});
