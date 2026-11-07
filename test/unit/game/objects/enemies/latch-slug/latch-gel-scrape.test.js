import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { LatchGelScrape } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGelScrape.js";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";
import { LatchSurface } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSurface.js";
import { gelVolume } from "../../../../../../src/game/objects/enemies/latch-slug/LatchImpactShape.js";

class Entity extends pc.Entity {
  addComponent(type, value) {
    this[type] = value;
  }
}
class Mesh {
  setPositions(value) {
    this.positions = [...value];
  }
  setIndices(value) {
    this.indices = [...value];
  }
  setNormals() {}
  update() {}
  clear() {}
  destroy() {}
}
class MeshInstance {
  constructor(mesh, material, node) {
    Object.assign(this, {
      mesh,
      material,
      node,
      visible: true,
    });
  }
}

function grid() {
  const n = 10, positions = [], indices = [], count = (n + 1) ** 2;
  for (const z of [0.05, -0.05]) {
    for (let y = 0; y <= n; y++) {
      for (let x = 0; x <= n; x++) {
        positions.push(x / n - 0.5, y / n - 0.5, z);
      }
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x, b = a + 1, c = a + n + 1, d = c + 1;
      indices.push(a, b, d, a, d, c, a + count, d + count, b + count, a + count, c + count, d + count);
    }
  }
  const rim = [];
  for (let x = 0; x < n; x++) {
    rim.push([x, x + 1], [n * (n + 1) + x + 1, n * (n + 1) + x]);
  }
  for (let y = 0; y < n; y++) {
    rim.push([(y + 1) * (n + 1), y * (n + 1)], [y * (n + 1) + n, (y + 1) * (n + 1) + n]);
  }
  for (const [a, b] of rim) {
    indices.push(a, a + count, b + count, a, b + count, b);
  }

  return {
    positions: new Float32Array(positions),
    indices,
  };
}

function fixture() {
  const shape = grid();
  const material = {
    clone: () => material,
    destroy: () => {},
  };
  const original = {
    mesh: {
      getPositions: out => out.push(...shape.positions),
      getIndices: out => out.push(...shape.indices),
    },
    material,
  };
  const app = new pc.EventHandler();
  app.graphicsDevice = {};
  app.root = new Entity();
  const splash = {
    entity: new Entity(),
    model: { findComponents: () => [{ meshInstances: [original] }] },
  };
  const surface = new LatchSurface(splash, {
    pc: {
      ...pc,
      Entity,
      Mesh,
      MeshInstance,
    },
    app,
    finishSplatTransition: () => {},
  });
  const volume = Math.abs(gelVolume(shape.positions, shape.indices));
  Object.assign(surface, {
    filmEnabled: false,
    original: { morphInstance: {} },
    basis: Array.from(shape.positions),
    indices: shape.indices,
    targets: [],
    transform: new pc.Mat4(),
    initial: shape.positions,
    start: shape.positions,
    positions: shape.positions.slice(),
    base: new Float32Array(shape.positions.length),
    frame: new Entity(),
    field: {
      flow: (x, from, to) => to,
      height: () => 0,
    },
    normalSign: 1,
    floor: -2,
    sourceVolume: volume,
    initialVolume: volume,
    age: 1,
    scrape: new LatchGelScrape(shape.positions.length / 3),
    metrics: {
      frames: 0,
      maxRelativeVolumeError: 0,
    },
  });
  surface.update(0);

  return surface;
}

test("a physical stroke removes only local volume and that missing mass cannot regrow", () => {
  const surface = fixture();
  const volume = surface.sourceVolume;
  const start = new pc.Vec3(0, 0.2, 0.05), end = new pc.Vec3(0, -0.2, 0.05);
  const removed = surface.scrapeAt(start, end, 0.16);
  assert.ok(removed > 0 && removed < volume * 0.6);
  assert.ok(Math.abs(surface.sourceVolume + removed - volume) < 1e-7);
  assert.equal(surface.scrape.remaining[0], 1, "distant gel is retained");
  const center = 5 * 11 + 5;
  assert.equal(surface.scrape.remaining[center], 0);
  assert.ok(surface.positions[center * 3 + 2] < 0.04, "nearby wet gel rounds into the peeled edge without restoring its volume");
  const remaining = surface.sourceVolume;
  surface.update(0.1);
  surface.update(0.1);
  assert.ok(surface.sourceVolume <= remaining + 1e-7);
  const secondRemoval = surface.scrapeAt(start, end, 0.16);
  assert.ok(secondRemoval >= 0 && secondRemoval < removed, "only neighboring gel that reflowed into the swath can be collected again");
  assert.ok(surface.sourceVolume <= remaining + 1e-7);
  assert.equal(surface.drained, false);
  surface.scrapeAt(new pc.Vec3(0, 0.5, 0.05), new pc.Vec3(0, -0.5, 0.05), 2);
  assert.equal(surface.drained, true);
  assert.ok(surface.sourceVolume < volume * 0.002);
  surface.destroy();
});

test("only remaining front skin in foot reach is targetable, never the reverse side of the door", () => {
  const surface = fixture();
  const origin = new pc.Vec3(0, 0, 1);
  const candidates = surface.scrapeCandidates(origin, 1.1);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(p => p.distance(origin) <= 1.1 && p.z > 0));
  assert.equal(candidates[0].y, -0.5, "collect the lowest reachable skin before reaching higher");
  assert.equal(surface.scrapeCandidates(new pc.Vec3(0, 0, -1), 2).length, 0);
  assert.equal(surface.scrapeCandidates(origin, 0.8).length, 0);
  surface.destroy();
});


test("merged coverage does not recreate scraped holes or bridge severed gel", () => {
  const first = fixture(), second = fixture();
  const start = new pc.Vec3(0, 0.3, 0.05), end = new pc.Vec3(0, -0.3, 0.05);
  first.scrapeAt(start, end, 0.18);
  second.scrapeAt(start, end, 0.18);
  first.merge(second);
  first.owner.app.fire("prerender");
  const mesh = first.visibleEntity.render.meshInstances[0].mesh;
  const hitAt = x => {
    const ray = new pc.Ray(new pc.Vec3(x, 0, 1), new pc.Vec3(0, 0, -1));
    const triangle = new pc.Tri(), point = new pc.Vec3();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const at = mesh.indices.slice(i, i + 3).map(index => new pc.Vec3(...mesh.positions.slice(index * 3, index * 3 + 3)));
      triangle.set(...at);
      if (triangle.intersectsRay(ray, point) && point.z > 0.001) {
        return true;
      }
    }

    return false;
  };
  assert.equal(hitAt(0), false);
  assert.equal(hitAt(0.35), true);
  first.clear(); second.clear();
  first.destroy(); second.destroy();
});


test("scraped skin is collected synchronously from the actual world-space patch", () => {
  const surface = fixture();
  surface.splash.entity.setPosition(3, 2, 1);
  let patch;
  const removed = surface.scrapeAt(new pc.Vec3(3, 2.2, 1.05), new pc.Vec3(3, 1.8, 1.05), 0.16, data => {
    patch = data;
  });
  assert.ok(removed > 0);
  assert.equal(patch.volume, removed);
  assert.equal(patch.material, surface.material);
  assert.ok(patch.positions.length > 0 && patch.positions.length % 9 === 0);
  assert.ok(patch.positions.every(Number.isFinite));
  assert.ok(patch.positions[0] > 2 && patch.positions[0] < 4);
  assert.equal(surface.scrapedChunks, undefined, "the donor does not spawn falling debris");
  surface.destroy();
});

test("rounded peel fringe relaxes without restoring removed volume", () => {
  const surface = fixture();
  surface.scrapeAt(new pc.Vec3(0, 0.2, 0.05), new pc.Vec3(0, -0.2, 0.05), 0.22);
  const volume = surface.sourceVolume;
  const before = [...surface.positions];
  assert.ok(surface.scrape.remaining.some(w => w > 0.05 && w < 0.95));
  surface.update(0.08);
  assert.ok(surface.positions.some((p, i) => i % 3 === 2 && Math.abs(p - before[i]) > 1e-6));
  assert.ok(surface.sourceVolume <= volume + 1e-7);
  assert.ok(surface.scrape.remaining[5 * 11 + 5] > 0, "neighboring gel persistently refills the eaten gap");
  surface.update(0.12);
  assert.ok(surface.sourceVolume <= volume + 1e-7);
  surface.destroy();
});

test("settled film has no elapsed-time pulsation, including gathered thick regions", () => {
  const surface = fixture();
  surface.scrapeAt(new pc.Vec3(0, 0.2, 0.05), new pc.Vec3(0, -0.2, 0.05), 0.22);
  surface.scrape.remaining[5 * 11 + 6] = 2.5;
  // Isolate unwanted breathing from actual liquid transport and authored travel.
  surface.scrape.flow = () => {};
  surface.update(0);
  const before = surface.positions.slice(), volume = surface.sourceVolume;
  for (let frame = 0; frame < 180; frame++) {
    surface.update(1 / 60);
    const motion = surface.positions.reduce((max, value, index) => Math.max(max, Math.abs(value - before[index])), 0);
    assert.ok(motion < 1e-5, `stationary liquid must not breathe (${motion})`);
    assert.ok(Math.abs(surface.sourceVolume - volume) < 1e-7);
  }
  surface.destroy();
});


test("persistent film transport fills an eaten gap while the removed-volume ledger stays fixed", () => {
  const surface = fixture();
  surface.scrapeAt(new pc.Vec3(0, 0.15, 0.05), new pc.Vec3(0, -0.15, 0.05), 0.18);
  const volume = surface.sourceVolume, center = 5 * 11 + 5;
  assert.equal(surface.scrape.remaining[center], 0);
  for (let i = 0; i < 90; i++) {
    surface.update(1 / 60);
    assert.ok(surface.sourceVolume <= volume + 1e-7);
  }
  assert.ok(surface.scrape.remaining[center] > 0.15);
  assert.ok(Math.abs(surface.sourceVolume - volume) < 1e-7);
  surface.destroy();
});

test("thicker film transfers downward faster than a thin region with equal material weight", () => {
  const scrape = new LatchGelScrape(4);
  scrape.changed = true;
  scrape.neighbors = [[1], [0], [3], [2]];
  scrape.remaining.set([1, 0, 1, 0]);
  const positions = new Float32Array([0, 1, 0.1, 0, 0, 0.1, 1, 1, 0.02, 1, 0, 0.02]);
  const base = new Float32Array([0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0]);
  scrape.flow(positions, base, 0.05);
  assert.ok(scrape.remaining[1] > scrape.remaining[3] * 1.4);
  assert.ok(Math.abs(scrape.remaining.reduce((a, b) => a + b, 0) - 2) < 1e-6);
});


test("a contacted peel never trims a redistributed heap outside its radius", () => {
  const scrape = new LatchGelScrape(3);
  scrape.remaining.set([1, 2.5, 3]);
  const positions = new Float32Array([0, 0, 0.05, 0.5, 0, 0.05, 0.1, 0, 0.05]);
  assert.equal(scrape.cut(positions, new pc.Vec3(0, 0, 0.05), new pc.Vec3(0, 0, 0.05), 0.1), true);
  assert.equal(scrape.remaining[0], 0);
  assert.equal(scrape.remaining[1], 2.5, "remote gathered gel remains intact");
  assert.equal(scrape.remaining[2], 3, "the radius boundary is outside the contacted skin");
});


test("low remaining film stays outside nonflat raised door support throughout reflow", () => {
  const surface = fixture();
  surface.field.height = (x, y) => 0.4 + x * 0.25 + Math.sin(y * 9) * 0.15;
  surface.scrape.changed = true;
  surface.scrape.remaining.fill(0.035);
  surface.update(0);
  const volume = surface.sourceVolume;
  assert.ok(volume > 0);
  for (let frame = 0; frame < 180; frame++) {
    surface.update(1 / 60);
    assert.ok(Math.abs(surface.sourceVolume - volume) < 1e-7);
    assert.ok(surface.renderIndices.length > 0, "positive remaining mass is rendered");
    for (let i = 2; i < surface.positions.length; i += 3) {
      assert.ok(surface.positions[i] >= surface.base[i] - 1e-7, "gel thickness cannot invert inside the door");
    }
  }
  surface.destroy();
});


test("fixed film uploads outward triangles on either door side without mutating its unsigned solver", () => {
  for (const sign of [1, -1]) {
    const surface = fixture();
    surface.filmEnabled = true;
    surface.update(0);
    surface.normalSign = sign;
    const solverPositions = surface.film.positions.slice(), solverIndices = [...surface.film.indices];
    surface.update(0);
    assert.deepEqual(surface.film.positions, solverPositions);
    assert.deepEqual(surface.film.indices, solverIndices);
    for (let i=0;i<surface.renderIndices.length;i+=3) {
      const [a,b,c] = surface.renderIndices.slice(i,i+3);
      assert.ok(a < surface.film.count || b < surface.film.count || c < surface.film.count, "contact backplane is excluded from rendering");
      if (a >= surface.film.count || b >= surface.film.count || c >= surface.film.count) {
        continue;
      }
      const p=surface.positions;
      const nx=(p[b*3]-p[a*3])*(p[c*3+1]-p[a*3+1])-(p[b*3+1]-p[a*3+1])*(p[c*3]-p[a*3]);
      assert.ok(nx*sign>0,"top triangle winding faces outward");
    }
    const candidates = surface.scrapeCandidates(new pc.Vec3(0,0,sign),2);
    assert.ok(candidates.length>0 && candidates.every(point=>point.z*sign>0));
    surface.destroy();
  }
});


test("production film collects actual world-space skin on the negative door side and conserves repeated bite accounting", () => {
  const surface = fixture();
  surface.filmEnabled = true;
  surface.update(0);
  surface.normalSign = -1;
  surface.splash.entity.setPosition(4,3,2);
  surface.update(0);
  const volume = surface.sourceVolume;
  const original = surface.positions.slice();
  const start = new pc.Vec3(4,3.15,1.9), end = new pc.Vec3(4,2.85,1.9);
  let sum = 0, callbackCount = 0;
  for (let bite=0;bite<3;bite++) {
    const before = surface.sourceVolume;
    let morsel;
    const removed = surface.scrapeAt(start,end,0.15,data=>{
      morsel=data;
      callbackCount++;
      assert.equal(surface.drained,false,"a partial bite leaves the donor available");
    });
    assert.ok(removed>0);
    assert.equal(morsel.volume,removed);
    assert.equal(morsel.material,surface.material);
    assert.ok(morsel.positions.length>0 && morsel.positions.length%9===0);
    for(let i=0;i<morsel.positions.length;i+=3) {
      assert.ok(morsel.positions[i]>3.5 && morsel.positions[i]<4.5);
      assert.ok(morsel.positions[i+1]>2.5 && morsel.positions[i+1]<3.5);
      assert.ok(morsel.positions[i+2]<=2,"negative-side donor skin stays in front of its door plane");
    }
    assert.ok(Math.abs(before-surface.sourceVolume-removed)<1e-12);
    sum+=removed;
    assert.ok(Math.abs(volume-sum-surface.sourceVolume)<1e-12);
    assert.equal(surface.drained,false);
    const distant = surface.film.nx * Math.floor(surface.film.ny*0.6) + 2;
    assert.deepEqual([...surface.positions.slice(distant*3,distant*3+3)],[...original.slice(distant*3,distant*3+3)],"a bite never rescales or moves distant untouched gel");
  }
  assert.equal(callbackCount,3);
  let last;
  const remaining = surface.sourceVolume;
  const removed = surface.scrapeAt(new pc.Vec3(4,3,1.9),new pc.Vec3(4,3,1.9),4,data=>{
    last=data;
  });
  assert.ok(Math.abs(removed-remaining)<1e-12);
  assert.equal(last.volume,removed);
  assert.ok(last.positions.length>0,"the final meal still carries donor geometry");
  assert.equal(surface.drained,true);
  assert.ok(surface.sourceVolume<1e-12);
  surface.destroy();
});



test("production film bites retain the door jam until the final collected portion is exhausted", () => {
  const surface=fixture();
  surface.filmEnabled=true;
  surface.update(0);
  const jams=new Set(), frame=new pc.Entity();
  const door={
    entity:frame,
    jamShut:mass=>{
      jams.add(mass);

      return true;
    },
    releaseJam:mass=>jams.delete(mass),
  };
  const splash={
    entity:surface.splash.entity,
    surface,
    play:()=>{},
    clear:()=>{},
  };
  const owner={
    pc,
    app:surface.owner.app,
    splash,
    position:new pc.Vec3(0,0,1),
  };
  const mass=new LatchGlue(door,null,owner,new pc.Vec3());
  const transform=splash.entity.getWorldTransform();
  const start=transform.transformPoint(new pc.Vec3(0,0.1,0.1));
  const end=transform.transformPoint(new pc.Vec3(0,-0.1,0.1));
  assert.ok(mass.scrapeAt(start,end,0.14)>0);
  assert.equal(mass.active,true);
  assert.equal(jams.has(mass),true);
  let collected=false;
  assert.ok(mass.scrapeAt(start,end,4,data=>{
    collected=true;
    assert.ok(data.volume>0 && data.positions.length>0);
    assert.equal(mass.active,true,"last portion is delivered before releasing its restraint");
  })>0);
  assert.equal(collected,true);
  assert.equal(mass.active,false);
  assert.equal(jams.size,0);
  surface.destroy();
});
