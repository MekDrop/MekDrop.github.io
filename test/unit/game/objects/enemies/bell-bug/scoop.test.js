import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { BellBugScoop } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugScoop.js";
import { BellBugPursueState } from "../../../../../../src/game/objects/enemies/bell-bug/states/BellBugPursueState.js";

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
  owner.faceTarget = target => owner.entity.lookAt(target.position);

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

test("walls and interrupted contact cannot feed", () => {
  const { owner, slug, scoop, contacts } = fixture();
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

test("turns toward side and rear slimes within one tile before pursuing a royal", () => {
  for (const position of [new Vec3(0, 0, 0.9), new Vec3(0.9, 0, 0), new Vec3(0, 0, -1)]) {
    const { owner, slug, scoop } = fixture();
    slug.position.copy(position);
    owner.scoop = scoop;
    owner.resolveRoyalTarget = () => assert.fail("nearby slime must win attention");
    scoop.update(0.016, true);
    assert.equal(scoop.target, slug);
    assert.ok(owner.entity.forward.dot(position.clone().normalize()) > 0.99);
    new BellBugPursueState().execute(owner);
  }
});

test("nearest slime wins even without available skin; attention releases beyond one tile", () => {
  const { owner, slug, scoop } = fixture();
  const farther = {
    ...slug,
    position: new Vec3(0, 0, -0.95),
  };
  owner.actors = [{ alive: true }, farther, slug];
  slug.beginScoop = () => null;
  owner.scoop = scoop;
  owner.resolveRoyalTarget = () => assert.fail("skin contention must not restore royal priority");
  scoop.update(0.016, true);
  assert.equal(scoop.attentionTarget, slug);
  new BellBugPursueState().execute(owner);
  slug.position.z = -1.01;
  farther.position.z = -1.1;
  scoop.update(0.016, true);
  assert.equal(scoop.attentionTarget, null);
  assert.equal(scoop.target, null);
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

test("tries the other front foot when the preferred foot cannot reach the skin", () => {
  const { owner, slug, scoop } = fixture();
  let discarded = 0;
  slug.beginScoop = () => ({
    active: true,
    point: new Vec3(0, 0.25, -0.4),
    destroy: () => {
      discarded++;
    },
  });
  owner.animationPlayback = {
    scoopPose: { foot: side => ({ canReach: () => side === 1 }) },
  };
  scoop.update(0.4, true);
  assert.equal(scoop.target, slug);
  assert.equal(scoop.side, 1);
  assert.equal(discarded, 1);
});

test("faces the slime before choosing a skin contact from the front claw", () => {
  const { owner, slug, scoop } = fixture();
  let facing = false;
  owner.faceTarget = target => {
    facing = target === slug;
  };
  const begin = slug.beginScoop;
  slug.beginScoop = () => {
    assert.equal(facing, true, "road steering must not determine the scooping stance");

    return begin();
  };
  scoop.update(0.4, true);
  assert.equal(scoop.target, slug);
});

test("walks only the missing reach before pressing and tasting", () => {
  const { owner, slug, scoop, contacts } = fixture();
  slug.position.z = -0.95;
  const foot = {
    canReach: () => owner.position.z < -0.09,
    approachDistance: () => Math.max(0, 0.1 + owner.position.z),
  };
  owner.animationPlayback = { scoopPose: { foot: () => foot } };
  owner.stepSupport = { surface: () => ({}) };
  owner.moveToward = (goal, speed, arrival) => {
    assert.equal(speed, 0.25);
    assert.equal(arrival, 0.002);
    assert.ok(Math.abs(goal.position.z + 0.1) < 1e-6);
    owner.position.copy(goal.position).add(new Vec3(0, 0, arrival));

    return true;
  };
  scoop.update(0.4, true);
  assert.equal(scoop.target, null);
  assert.equal(scoop.approachTarget, slug);
  assert.equal(contacts(), 0);
  scoop.approach();
  scoop.update(0.1, true);
  assert.equal(scoop.approachTarget, null);
  assert.equal(scoop.target, slug);
  scoop.update(0.93, true);
  assert.equal(contacts(), 1);
});

test("rejects approach steps across unsupported ground or into the slime capsule", () => {
  for (const supported of [true, false]) {
    const { owner, scoop } = fixture();
    owner.actors[0].position.z = supported ? -0.76 : -0.95;
    owner.animationPlayback = {
      scoopPose: {
        foot: () => ({
          canReach: () => false,
          approachDistance: () => 0.1,
        }),
      },
    };
    owner.stepSupport = { surface: () => supported ? {} : null };
    scoop.update(0.4, true);
    assert.equal(scoop.approachTarget, null);
    assert.equal(scoop.target, null);
  }
});
