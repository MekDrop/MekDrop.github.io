import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { State } from "yuka";
import { LatchSlug } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSlug.js";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";
import { DoorJam } from "../../../../../../src/game/objects/architecture/door/DoorJam.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";

function fixture(openAmount = 0) {
  const jam = new DoorJam();
  const door = {
    entity: new pc.Entity(),
    openAmount,
    get jammed() {
      return jam.active;
    },
    jamShut(source) {
      return jam.attach(this.openAmount, source);
    },
    releaseJam: (source) => jam.release(source),
    clearGlue: () => jam.clear(),
    receiveDamage: () => assert.fail("doors must never receive damage"),
  };
  const royal = {
    entity: new pc.Entity(),
    isRoyal: true,
    alive: true,
    slows: [],
    receiveDamage: () => assert.fail("royals must never receive damage"),
    beginGameOver: () => assert.fail("nuisance must not end game"),
    applyStatus(name, status) {
      this.slows.push({
        name,
        ...status,
      });
    },
  };
  royal.entity.setPosition(0, 0, -0.5);
  const objects = [{ entranceDoors: [door] }, royal];
  const slug = new LatchSlug({
    pc,
    definition: { id: "slug" },
    runtime: { objects },
  });
  objects.push(slug);

  return {
    slug,
    door,
    royal,
  };
}

it("uses real Yuka states and sacrifices into a bounded, damage-free closed-door jam", () => {
  const { slug, door } = fixture();
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchPressState");
  assert.ok(slug.behavior.currentState instanceof State);
  slug.update(2.5);
  assert.equal(slug.alive, false);
  assert.equal(door.jammed, true);
  assert.equal(slug.stateName, "LatchDeadState");
  assert.equal(slug.receiveHealing(100), 0);
  slug.update(21);
  assert.equal(door.jammed, false);
});

it("survives an open door and only limits movement on arrival at the actual royal", () => {
  const { slug, door, royal } = fixture(1);
  for (let i = 0; i < 10; i++) {
    slug.update(1);
  }
  assert.equal(slug.resolveRoyalTarget(), royal);
  assert.equal(slug.stateName, "LatchDogState");
  assert.equal(slug.alive, true);
  assert.equal(door.jammed, false);
  assert.ok(royal.slows.length > 0);
  assert.equal(royal.slows[0].factor, 0.65);
});

it("rechecks open/closed transitions during press and inflation", () => {
  for (const delay of [0.2, 0.9, 1.8]) {
    const { slug, door } = fixture();
    slug.update(0.1);
    slug.update(delay);
    door.openAmount = 0.2;
    slug.update(0.1);
    slug.update(4);
    assert.equal(slug.alive, true);
    assert.equal(door.jammed, false);
    assert.equal(slug.stateName, "LatchDogState");
    door.openAmount = 0;
    slug.update(0.1);
    assert.equal(slug.stateName, "LatchPressState");
  }
});

it("a bell during closed-door windup splats early; open-door bells only startle", () => {
  const closed = fixture();
  closed.slug.update(0.1);
  assert.equal(closed.slug.onBellRung({ eventId: "one" }), true);
  assert.equal(closed.slug.alive, false);
  assert.equal(closed.door.jammed, true);
  const open = fixture(1);
  open.slug.update(0.1);
  open.slug.onBellRung({ eventId: "two" });
  assert.equal(open.slug.alive, true);
  assert.equal(open.door.jammed, false);
  assert.equal(open.slug.stateName, "LatchReactionState");
  assert.equal(open.slug.onBellRung({ eventId: "two" }), false);
  assert.equal(open.slug.onBellRung({
    eventId: "secondary",
    secondary: true,
  }), false);
});

it("opening immediately before bell contact cancels the fatal splat", () => {
  const { slug, door } = fixture();
  slug.update(0.1);
  door.openAmount = 0.01;
  slug.onBellRung({ eventId: 1 });
  assert.equal(slug.alive, true);
  assert.equal(door.jammed, false);
});

it("pickup and external stun cancel windup without leaving glue", () => {
  const { slug, door, royal } = fixture();
  slug.update(0.1);
  assert.equal(slug.beginCarry(royal), true);
  slug.update(3);
  assert.equal(slug.requestedClip, "carried_ready");
  assert.equal(door.jammed, false);
  assert.equal(slug.alive, true);
  const stunned = fixture();
  stunned.slug.update(0.1);
  stunned.slug.applyStatus("stun", { duration: 4 });
  stunned.slug.update(3);
  assert.equal(stunned.slug.requestedClip, "stun");
  assert.equal(stunned.door.jammed, false);
});

it("clearing releases glue early; independent sources retain their own restraints", () => {
  const { door } = fixture();
  assert.equal(new LatchGlue(door, 0).active, false);
  assert.equal(door.jammed, false);
  const first = new LatchGlue(door, 2);
  const second = new LatchGlue(door, 5);
  first.update(3);
  assert.equal(door.jammed, true);
  second.clear();
  assert.equal(door.jammed, false);
  const cleared = new LatchGlue(door);
  door.clearGlue();
  cleared.update(0.1);
  assert.equal(cleared.active, false);
  door.openAmount = 0.1;
  assert.equal(new LatchGlue(door).active, false);
});

it("death interrupts inflation; dead enemies cannot carry, jam, or accept bell status", () => {
  const { slug, door, royal } = fixture();
  slug.update(0.1);
  slug.receiveDamage(1000);
  slug.update(1);
  assert.equal(slug.alive, false);
  assert.equal(slug.beginCarry(royal), false);
  assert.equal(slug.splat(), false);
  assert.equal(slug.onBellRung(), false);
  assert.equal(door.jammed, false);
});

it("restriction changes the shared movement contract's actual horizontal velocity without damage", () => {
  const { slug } = fixture(1);
  const walker = new Enemy({
    pc,
    definition: { id: "walker" },
  });
  walker.entity.setPosition(0.2, 0, 0);
  walker.entity.rigidbody = { linearVelocity: new pc.Vec3(0, -2, 0) };
  slug.runtime.objects.push(walker);
  slug.limitNearbyMovement(0.45);
  walker.moveToward({ position: new pc.Vec3(10, 0, 0) }, 2);
  assert.equal(walker.entity.rigidbody.linearVelocity.x, 0.9);
  assert.equal(walker.entity.rigidbody.linearVelocity.y, -2);
  assert.equal(walker.health, walker.maxHealth);
});

it("throwing delegates velocity and gravity to the body; airborne enemies cannot glue doors", () => {
  const { slug, door, royal } = fixture();
  let teleports = 0;
  slug.entity.rigidbody = {
    enabled: true,
    linearVelocity: new pc.Vec3(),
    teleport: () => {
      teleports++;
    },
  };
  assert.equal(slug.beginCarry(royal), true);
  assert.equal(slug.entity.rigidbody.enabled, false);
  assert.equal(slug.launch({
    velocity: {
      x: 1,
      y: 4,
      z: 0,
    },
  }), true);
  slug.update(3);
  assert.deepEqual(slug.entity.rigidbody.linearVelocity, new pc.Vec3(1, 4, 0));
  assert.equal(teleports, 1);
  assert.equal(slug.requestedClip, "airborne");
  assert.equal(door.jammed, false);
  assert.equal(slug.onLanding(), true);
  assert.equal(slug.airborne, false);
  assert.equal(slug.requestedClip, "land");
});

it("fatal splat disables root body and every nested collision shape", () => {
  const { slug } = fixture();
  const shapes = [{ enabled: true }, { enabled: true }];
  slug.entity.rigidbody = {
    enabled: true,
    linearVelocity: new pc.Vec3(),
  };
  slug.entity.findComponents = () => shapes;
  slug.update(0.1);
  slug.update(3);
  assert.equal(slug.entity.rigidbody.enabled, false);
  assert.ok(shapes.every((shape) => !shape.enabled));
  assert.equal(slug.canBeCarriedBy({ entity: new pc.Entity() }), false);
});
