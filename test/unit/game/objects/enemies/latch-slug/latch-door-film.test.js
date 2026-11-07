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

test("settling and gap refill never widen the impact footprint", () => {
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

test("a supported projecting arch receives gel without adding mass or coating air", () => {
  const f = new LatchDoorFilm({
    positions:new Float32Array([-0.4,0,0.12,0.4,0,0.12,0.4,0.7,0.12,-0.4,0.7,0.12]),
    indices:[0,1,2,0,2,3],
    field:{
      height:()=>0,
      contains:x=>x<0,
      support:x=>x<0.3?0.45:null,
    },
    floor:-1,
    volume:0.04,
  });
  let wrapped = 0;
  for (let i=0;i<f.count;i++) {
    const x = f.base[i*3];
    if (x>0.05 && x<0.25 && f.heights[i]>0.004) {
      wrapped++;
      assert.ok(f.positions[i*3+2]>0.45);
    }
    if (x>0.3) {
      assert.equal(f.heights[i],0);
    }
  }
  assert.ok(wrapped>0, "the forward offset of stone does not erase the deposit");
  assert.ok(Math.abs(f.volume-0.04)<1e-10);
});
