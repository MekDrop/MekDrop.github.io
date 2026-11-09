import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { LatchHeroBump } from "../../../../../../src/game/objects/enemies/latch-slug/LatchHeroBump.js";

test("one side bump reacts once, stops continued pushing and rearms only after separation", () => {
  const hero = {
    entity: new Entity(),
    radius: 0.3,
  };
  hero.entity.setPosition(0, 0, -0.7);
  const reactions = [];
  hero.receiveSlimeBump = (source, speed) => reactions.push({
    source,
    speed,
  });
  const body = { linearVelocity: new Vec3(0.1, -0.5, -1.4) };
  const slug = {
    alive: true,
    position: new Vec3(),
    radius: 0.42,
    height: 0.8,
    entity: { rigidbody: body },
    runtime: { getHero: () => hero },
  };
  const bump = new LatchHeroBump(slug);
  const contact = {
    other: hero.entity,
    contacts: [{ normal: new Vec3(0.756, 0.623, -0.199) }],
  };
  bump.constrain();
  bump.contact(contact);
  bump.contact(contact);
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].speed, 1.4);
  bump.constrain();
  assert.equal(body.linearVelocity.z, 0);
  assert.equal(body.linearVelocity.y, -0.5);
  assert.equal(body.linearVelocity.x, 0.1);
  body.linearVelocity.set(0, -0.5, 1);
  bump.constrain();
  assert.equal(body.linearVelocity.z, 1, "moving away remains possible");
  hero.entity.setPosition(0, 0, -1.5);
  bump.update();
  assert.equal(bump.touching, false);
  assert.equal(bump.closingSpeed, 0, "idle updates discard old motor intent");
  hero.entity.setPosition(0, 0, -0.7);
  bump.contact(contact);
  assert.equal(reactions.length, 1, "walking into an idle slug is not a new powered bump");
});

test("floor contacts, unrelated bodies, carried and airborne slimes do not bump the hero", () => {
  const hero = {
    entity: new Entity(),
    receiveSlimeBump: () => assert.fail("unexpected bump"),
  };
  const slug = {
    alive: true,
    runtime: { getHero: () => hero },
  };
  const bump = new LatchHeroBump(slug);
  bump.contact({
    other: hero.entity,
    contacts: [{ normal: Vec3.UP }],
  });
  bump.contact({
    other: new Entity(),
    contacts: [{ normal: Vec3.RIGHT }],
  });
  slug.airborne = true;
  bump.contact({
    other: hero.entity,
    contacts: [{ normal: Vec3.RIGHT }],
  });
  assert.equal(bump.touching, false);
});
