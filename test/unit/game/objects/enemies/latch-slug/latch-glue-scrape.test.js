import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";

function fixture() {
  const jams = new Set(), frame = new pc.Entity();
  const door = {
    entity: frame,
    jamShut: mass => {
      jams.add(mass);

      return true;
    },
    releaseJam: mass => jams.delete(mass),
    get jammed() {
      return jams.size > 0;
    },
  };
  const physics = {
    hits: [],
    raycastAll() {
      return this.hits;
    },
  };
  const origin = new pc.Vec3(0, 0, 0.5);
  const make = heights => {
    const node = new pc.Entity();
    const visual = {
      enabled: true,
      setPosition: point => node.setPosition(point),
      setRotation: rotation => node.setRotation(rotation),
    };
    const surface = {
      drained: false,
      volume: 0.04,
      scrapeCandidates: (from, reach) => heights.map(y => new pc.Vec3(0, y, 0.05)).filter(p => p.distance(from) <= reach).sort((a,b) => a.y-b.y),
      scrapeAt: () => {
        surface.volume -= 0.02; surface.drained = surface.volume < 1e-7;

        return 0.02;
      },
    };
    const owner = {
      pc,
      position: origin,
      app: { systems: { rigidbody: physics } },
      splash: {
        entity: visual,
        surface,
        play: () => {},
        clear: () => {
          visual.enabled = false;
        },
      },
    };

    return {
      mass: new LatchGlue(door, null, owner, new pc.Vec3(0, 0, 0.05)),
      surface,
    };
  };

  return {
    door,
    physics,
    origin,
    make,
    jams,
  };
}

test("chooses the lowest reachable remaining mass and native walls occlude it", () => {
  const { door, physics, origin, make } = fixture();
  const low = make([0.2, 0.4]), high = make([0.7, 2]);
  const target = LatchGlue.scrapeTarget(door, origin, 1);
  assert.equal(target.mass, low.mass);
  assert.equal(target.point.y, 0.2, "goo above the physical reach remains untouched");
  physics.hits = [{
    entity: { rigidbody: { type: "static" } },
    hitFraction: 0.3,
  }];
  assert.equal(LatchGlue.scrapeTarget(door, origin, 1), null);
  physics.hits = [{
    entity: { rigidbody: { type: "dynamic" } },
    hitFraction: 0,
  }];
  assert.equal(LatchGlue.scrapeTarget(door, origin, 1).mass, low.mass, "a ray originating inside the bug ignores its own dynamic capsule");
  low.mass.clear(); high.mass.clear();
});

test("a partial scrape preserves the jam and exhausting one mass leaves other masses attached", () => {
  const { door, origin, make, jams } = fixture();
  const first = make([0.2]), second = make([0.4]);
  assert.equal(first.mass.scrapeAt(origin, origin, 0.1), 0.02);
  assert.equal(first.mass.active, true);
  assert.equal(door.jammed, true);
  assert.equal(jams.size, 2);
  first.mass.scrapeAt(origin, origin, 0.1);
  assert.equal(first.mass.active, false);
  assert.equal(jams.size, 1);
  assert.equal(LatchGlue.scrapeTarget(door, origin, 1).mass, second.mass);
  second.mass.clear();
  assert.equal(door.jammed, false);
});

test("prefers thicker reachable goo over a higher thin patch", () => {
  const { door, origin, make } = fixture();
  const thin = make([0.7]), thick = make([0.2]);
  thin.surface.scrapeCandidates = () => [Object.assign(new pc.Vec3(0,0.7,0.05), { gooThickness:0.008 })];
  thick.surface.scrapeCandidates = () => [Object.assign(new pc.Vec3(0,0.2,0.05), { gooThickness:0.08 })];
  assert.equal(LatchGlue.scrapeTarget(door, origin, 1).mass, thick.mass);
  thin.mass.clear(); thick.mass.clear();
});


test("collector receives the final morsel before the drained donor is cleared", () => {
  const { origin, make } = fixture();
  const { mass, surface } = make([0.2]);
  const patch = {
    positions: [0, 0, 0],
    material: {},
    volume: 0.04,
  };
  surface.scrapeAt = (start, end, radius, collect) => {
    surface.drained = true;
    collect(patch);

    return patch.volume;
  };
  let received;
  assert.equal(mass.scrapeAt(origin, origin, 0.1, data => {
    assert.equal(mass.active, true);
    received = data;
  }), 0.04);
  assert.equal(received, patch);
  assert.equal(mass.active, false);
});
