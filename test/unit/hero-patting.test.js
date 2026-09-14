import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroPatMood } from "../../src/game/objects/hero/HeroPatMood.js";
import { HeroPatEscape } from "../../src/game/objects/hero/HeroPatEscape.js";
import { BuffSystem } from "../../src/game/buffs/BuffSystem.js";
import { HERO_STAT } from "../../src/game/enum/HeroStat.js";
import { HERO_BUFF } from "../../src/game/enum/HeroBuff.js";

// Run mood and buff updates in the same order as the hero's fixed step.
function createMood() {
  const buffs = new BuffSystem();
  const mood = new HeroPatMood(buffs);
  return {
    buffs,
    get state() {
      return {
        ...mood.state,
        speedMultiplier: buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 1),
      };
    },
    pat: () => mood.pat(),
    reset: () => mood.reset(),
    advance(deltaTime, options) {
      buffs.advance(deltaTime, options);
      mood.advance(deltaTime);
    },
  };
}

it("gentle pats grant a bounded, temporary speed boost; holding still cannot stack it", () => {
  const mood = createMood();
  assert.equal(mood.pat(), true);
  assert.equal(mood.state.kind, "happy");
  assert.equal(mood.state.speedMultiplier, 1.05);
  assert.equal(mood.buffs.get(HERO_BUFF.AFFECTION).stacks, 1);
  for (let i = 0; i < 100; i += 1) {
    assert.equal(mood.pat(), false);
  }
  assert.equal(mood.state.agitation, 1 / 9);
  assert.equal(mood.state.speedMultiplier, 1.05);
  mood.advance(3);
  mood.pat();
  assert.equal(mood.state.speedMultiplier, 1.1);
  mood.advance(6.1);
  assert.equal(mood.state.kind, "calm");
  assert.equal(mood.state.speedMultiplier, 1);
  mood.pat();
  assert.equal(mood.state.speedMultiplier, 1.05);
});

it("each spaced pat builds speed up to the cap and reset clears all accumulated speed", () => {
  const mood = createMood();
  for (let i = 1; i <= 8; i += 1) {
    assert.equal(mood.pat(), true);
    assert.equal(mood.state.kind, "happy");
    assert.equal(mood.state.speedMultiplier, 1 + Math.min(i, 5) * 0.05);
    mood.advance(3);
  }
  mood.reset();
  mood.pat();
  assert.equal(mood.state.speedMultiplier, 1.05);
});

it("warns before snapping and rejects pats throughout the angry cooldown", () => {
  const mood = createMood();
  for (let i = 0; i < 9; i += 1) {
    mood.advance(0.25);
    assert.equal(mood.pat(), true);
    if (i === 4) {
      assert.equal(mood.state.kind, "agitated");
      assert.equal(mood.state.speedMultiplier, 1);
    }
  }
  assert.equal(mood.state.kind, "angry");
  assert.equal(mood.buffs.has(HERO_BUFF.AFFECTION), false);
  assert.equal(mood.buffs.get(HERO_BUFF.OVERSTIMULATED).duration, 8);
  assert.equal(mood.pat(), false);
  mood.advance(7.9);
  assert.equal(mood.pat(), false);
  mood.advance(0.2);
  assert.equal(mood.state.kind, "calm");
  assert.equal(mood.state.agitation, 0);
  assert.equal(mood.pat(), true);
});

it("leaving an irritated hero alone cools pressure consistently across frame rates", () => {
  const a = createMood();
  const b = createMood();
  for (const mood of [a, b]) {
    for (let i = 0; i < 5; i += 1) {
      mood.advance(0.25);
      mood.pat();
    }
  }
  a.advance(4);
  for (let i = 0; i < 480; i += 1) {
    b.advance(1 / 120);
  }
  assert.ok(Math.abs(a.state.agitation - b.state.agitation) < 1e-9);
  assert.equal(a.state.kind, "calm");
  a.reset();
  assert.equal(a.state.kind, "calm");
  assert.equal(a.state.speedMultiplier, 1);
});

it("anger fades directly to calm without entering another reaction stage", () => {
  const moods = [createMood(), createMood()];
  for (const mood of moods) {
    for (let i = 0; i < 9; i += 1) {
      mood.advance(0.25);
      mood.pat();
    }
  }
  let previousPressure = 1;
  for (let i = 0; i < 1440; i += 1) {
    moods[0].advance(1 / 120);
    const state = moods[0].state;
    assert.notEqual(state.kind, "happy");
    assert.notEqual(state.kind, "agitated");
    assert.equal(state.speedMultiplier, 1);
    assert.ok(state.agitation <= previousPressure);
    assert.ok(previousPressure - state.agitation < 0.002);
    previousPressure = state.agitation;
  }
  moods[1].advance(12);
  assert.ok(Math.abs(moods[0].state.agitation - moods[1].state.agitation) < 1e-10);
  moods[0].advance(0.01);
  for (const mood of moods) {
    assert.equal(mood.state.kind, "calm");
    assert.equal(mood.pat(), true);
    assert.equal(mood.state.kind, "happy");
  }
});

it("chooses a reachable random destination and follows a route around a wall", () => {
  const escape = new HeroPatEscape();
  const position = { x: 0, z: 0 };
  const canTraverse = (from, to) => {
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.05);
    for (let i = 1; i <= steps; i += 1) {
      const x = from.x + (to.x - from.x) * i / steps;
      const z = from.z + (to.z - from.z) * i / steps;
      if (Math.abs(x) > 5 || Math.abs(z) > 5
        || (x >= 0.7 && x <= 1.6 && z < 2.2)) {
        return false;
      }
    }
    return true;
  };
  escape.begin(position, canTraverse, () => 0.99);
  assert.ok(escape.active);
  const target = escape.target;
  assert.ok(Math.hypot(target.x, target.z) >= 3);
  assert.ok(target.x > 1.6, "the target is across the wall, requiring a detour");
  for (let frame = 0; frame < 600 && escape.active; frame += 1) {
    const velocity = escape.velocity(position, 6.3);
    const next = { x: position.x + velocity.x / 120, z: position.z + velocity.z / 120 };
    assert.ok(canTraverse(position, next));
    Object.assign(position, next);
    escape.advance(1 / 120, position);
  }
  assert.equal(escape.active, false);
  assert.ok(Math.hypot(position.x - target.x, position.z - target.z) < 0.2);
});

it("never escapes into disconnected ground and releases control if the route becomes blocked", () => {
  const escape = new HeroPatEscape();
  const position = { x: 0, z: 0 };
  escape.begin(position, () => false);
  assert.equal(escape.active, false);
  assert.equal(escape.target, null);
  escape.begin(position, () => true, () => 0.5);
  assert.ok(escape.active);
  for (let i = 0; i < 90; i += 1) {
    escape.advance(1 / 120, position);
  }
  assert.equal(escape.active, false);
});

it("randomizes the initial escape heading through the full circle instead of grid axes", () => {
  const escape = new HeroPatEscape();
  const position = { x: 1, z: -2 };
  const headings = new Set();
  for (let i = 0; i < 32; i += 1) {
    const random = (i + 0.37) / 32;
    escape.begin(position, () => true, () => random, 6);
    const velocity = escape.velocity(position, 6.3);
    const angle = Math.atan2(velocity.z, velocity.x);
    headings.add(Math.round(angle * 1000));
    assert.ok(Math.abs(Math.cos(angle) - Math.cos(random * 2 * Math.PI)) < 1e-10);
    assert.ok(Math.abs(Math.sin(angle) - Math.sin(random * 2 * Math.PI)) < 1e-10);
    assert.ok(Math.abs(Math.hypot(escape.target.x - position.x, escape.target.z - position.z) - 6) < 1e-10);
  }
  assert.equal(headings.size, 32);
});

it("anger only loses agitation during rest and returns directly to calm", () => {
  const mood = createMood();
  for (let i = 0; i < 9; i += 1) {
    mood.advance(0.25);
    mood.pat();
  }
  const angry = mood.state;
  mood.advance(20, { resting: false });
  assert.equal(mood.state.kind, "angry");
  assert.equal(mood.state.remaining, angry.remaining);
  assert.equal(mood.state.agitation, angry.agitation);
  mood.advance(4, { resting: true });
  const resting = mood.state;
  assert.equal(resting.kind, "angry");
  mood.advance(20, { resting: false });
  assert.equal(mood.state.remaining, resting.remaining);
  assert.equal(mood.state.agitation, resting.agitation);
  mood.advance(4, { resting: true });
  assert.equal(mood.state.kind, "calm");
});

it("irritation expiry clears its pressure so a new pat starts fresh", () => {
  const mood = createMood();
  for (let i = 0; i < 7; i += 1) {
    mood.advance(0.25);
    mood.pat();
  }
  assert.equal(mood.state.kind, "agitated");
  mood.advance(mood.state.remaining + 0.01);
  assert.equal(mood.state.kind, "calm");
  assert.equal(mood.state.agitation, 0);
  assert.equal(mood.state.speedMultiplier, 1);
  mood.pat();
  assert.equal(mood.state.kind, "happy");
  assert.equal(mood.state.agitation, 1 / 9);
  assert.equal(mood.state.speedMultiplier, 1.05);
});

it("successive escape distances grow regardless of random direction and stop at a safe cap", () => {
  const escape = new HeroPatEscape();
  const position = { x: 0, z: 0 };
  let previous = 0;
  for (let distance = 3; distance <= 12; distance += 1.5) {
    escape.begin(position, () => true, () => distance % 2 ? 0.99 : 0, distance);
    const actual = Math.hypot(escape.target.x, escape.target.z);
    assert.ok(Math.abs(actual - distance) <= 0.15);
    assert.ok(actual > previous + 1);
    previous = actual;
  }
  escape.begin(position, () => true, () => 0.5, 1000);
  assert.ok(Math.hypot(escape.target.x, escape.target.z) <= 12.15);
  escape.begin(position, () => true, () => 0.5);
  assert.ok(Math.hypot(escape.target.x, escape.target.z) <= 3.15);
});

it("long escapes stay in the connected enclosure and reach the available farthest band", () => {
  const escape = new HeroPatEscape();
  const position = { x: 0, z: 0 };
  const canTraverse = (from, to) => Math.abs(to.x) <= 1.5 && Math.abs(to.z) <= 1.5;
  escape.begin(position, canTraverse, () => 0.5, 12);
  const target = escape.target;
  assert.ok(Math.hypot(target.x, target.z) >= 2);
  for (let i = 0; i < 600 && escape.active; i += 1) {
    const velocity = escape.velocity(position, 6.3);
    const next = { x: position.x + velocity.x / 120, z: position.z + velocity.z / 120 };
    assert.ok(canTraverse(position, next));
    Object.assign(position, next);
    escape.advance(1 / 120, position);
  }
  assert.ok(Math.hypot(position.x - target.x, position.z - target.z) < 0.2);
});
