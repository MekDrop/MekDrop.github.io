import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { BellBugScoop } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugScoop.js";

const fixture = () => {
  let contacts = 0;
  const slug = {
    alive: true,
    radius: 0.42,
    position: new Vec3(0, 0, -0.6),
    entity: { enabled: true },
    beginScoop: () => ({
      active: true,
      point: new Vec3(0, 0.25, -0.4),
      destroy: () => {},
    }),
    annoyance: {
      scoop: () => {
        contacts++;
      },
    },
  };
  const owner = {
    pc: { Vec3 },
    alive: true,
    entity: new Entity(),
    position: new Vec3(),
    radius: 0.3,
    statuses: new Map(),
    gatewayArrival: { active: false },
    actors: [slug],
    app: { systems: { rigidbody: { raycastAll: () => [] } } },
    stop: () => {},
    playClip: () => {},
  };

  return {
    owner,
    slug,
    scoop: new BellBugScoop(owner),
    contacts: () => contacts,
  };
};

test("blocked scoops contact once per foot, alternate, and stop outside pursuit", () => {
  const { scoop, contacts } = fixture();
  scoop.update(0.4, true);
  assert.ok(scoop.target);
  scoop.update(0.44, true);
  assert.equal(contacts(), 0);
  scoop.update(0.02, true);
  assert.equal(contacts(), 0, "contact alone does not remove mass before the peel");
  scoop.update(0.3, true);
  assert.equal(contacts(), 0);
  scoop.update(0.44, true);
  assert.equal(scoop.side, 1);
  scoop.update(0.4, true);
  scoop.update(0.93, true);
  assert.equal(contacts(), 2);
  scoop.update(0.1, false);
  assert.equal(scoop.target, null);
});

test("moving bugs, rear slugs, walls and interrupted contact cannot feed", () => {
  const { owner, slug, scoop, contacts } = fixture();
  for (let i = 0; i < 10; i++) {
    owner.position.x += 0.05;
    scoop.update(0.1, true);
  }
  assert.equal(scoop.target, null);
  owner.position.set(0, 0, 0);
  slug.position.z = 0.6;
  scoop.update(1, true);
  assert.equal(scoop.target, null);
  slug.position.z = -0.6;
  owner.app.systems.rigidbody.raycastAll = () => [{ entity: new Entity() }];
  scoop.update(1, true);
  assert.equal(scoop.target, null);
  owner.app.systems.rigidbody.raycastAll = () => [];
  scoop.update(0.4, true);
  assert.ok(scoop.target);
  slug.position.z = -3;
  scoop.update(1, true);
  assert.equal(contacts(), 0);
});

test("press, pull and taste sounds play once at contact phases, cancellation stays silent", () => {
  const { scoop, slug } = fixture();
  const sounds = [];
  slug.audio = { play: name => sounds.push(name) };
  scoop.update(0.4, true);
  scoop.update(0.3, true);
  assert.deepEqual(sounds, ["scoopPress"]);
  scoop.update(0.16, true);
  assert.deepEqual(sounds, ["scoopPress", "scoopPull"]);
  scoop.update(0.47, true);
  scoop.update(0.1, true);
  assert.deepEqual(sounds, ["scoopPress", "scoopPull", "scoopTaste"]);
  scoop.update(1, false);
  assert.equal(sounds.length, 3);
});

test("a nearby slug without a reachable skin surface cannot be scooped", () => {
  const { scoop, slug, contacts } = fixture();
  slug.beginScoop = () => null;
  scoop.update(0.4, true);
  scoop.update(1, true);
  assert.equal(scoop.target, null);
  assert.equal(contacts(), 0);
});
