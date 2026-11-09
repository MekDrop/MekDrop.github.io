import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import * as pc from "playcanvas";
import { State } from "yuka";
import { LatchGlue } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js";
import { DoorJam } from "../../../../../../src/game/objects/architecture/door/DoorJam.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { SceneObjectRegistry } from "../../../../../../src/game/rendering/scene/SceneObjectRegistry.js";

const shaderHooks = registerHooks({
  load: (url, context, nextLoad) => {
    if (url.endsWith("?url")) {
      return {
        format: "module",
        source: `export default ${JSON.stringify(url)}`,
        shortCircuit: true,
      };
    }
    if (url.endsWith("?raw")) {
      return {
        format: "module",
        source: `export default ${JSON.stringify(readFileSync(new URL(url.slice(0, -4)), "utf8"))}`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
const { LatchSlug } = await import("../../../../../../src/game/objects/enemies/latch-slug/LatchSlug.js");
shaderHooks.deregister();

it("yields to Bell Bugs without giving other enemies the same priority", () => {
  assert.equal(LatchSlug.prototype.yieldsTo({ isBellBug: true }), true);
  assert.equal(LatchSlug.prototype.yieldsTo({ isEnemy: true }), false);
  assert.equal(LatchSlug.prototype.yieldsTo({ isBellBug: false }), false);
});

it("restricts live status recipients without reading terrain positions, including after registry changes", () => {
  const { slug, royal } = fixture(1);
  const objects = new SceneObjectRegistry();
  const terrain = {
    get position() {
      assert.fail("terrain must not enter the movement restriction's distance query");
    },
  };
  for (let index = 0; index < 1000; index++) {
    objects.add("terrain", terrain);
  }
  slug.runtime.objects = objects;
  slug.limitNearbyMovement(0.65);
  objects.add("actor", royal);
  slug.limitNearbyMovement(0.65);
  assert.equal(royal.slows.length, 1);
  assert.equal(royal.slows[0].factor, 0.65);
  objects.remove(royal);
  slug.limitNearbyMovement(0.45);
  assert.equal(royal.slows.length, 1);

  // Array-backed fixtures use the same capability guard without an index.
  slug.runtime.objects = [terrain, royal];
  slug.limitNearbyMovement(0.45);
  assert.equal(royal.slows.at(-1).factor, 0.45);
});

function fixture(openAmount = 0) {
  const jam = new DoorJam();
  const door = {
    entity: new pc.Entity(),
    openAmount,
    clearWidth: 2,
    clearHeight: 2.4,
    isLeafCollider: (entity) => entity === door.entity,
    getHit: () => ({ distance: 0.5 }),
    blocksCameraAt: (x, y, z, radius) => Math.abs(z - door.entity.getPosition().z) <= radius && y >= 0 && y <= 2.4,
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
  slug.entity.rigidbody = {
    enabled: true,
    linearVelocity: new pc.Vec3(),
  };

  return {
    slug,
    door,
    royal,
  };
}

function impactDoor(slug) {
  if (slug.stateName === "LatchPressState") {
    slug.update(0.4);
  }
  assert.equal(slug.stateName, "LatchLeapState");
  assert.equal(slug.alive, true);
  const point = slug.leapTarget;
  assert.ok(point);

  return slug.onDoorContact({
    other: slug.doorTarget.entity,
    contacts: [{
      pointOther: point,
      normal: new pc.Vec3(0, 0, -1),
    }],
  });
}

it("plays its jump only at committed takeoff and its wet splash once at leaf contact", () => {
  const { slug } = fixture();
  const sounds = [];
  slug.audio = {
    play: (name, pitch) => sounds.push({
      name,
      pitch,
    }),
  };
  slug.update(0.1);
  assert.deepEqual(sounds, []);
  slug.update(0.4);
  assert.deepEqual(sounds.map((sound) => sound.name), ["jump"]);
  const door = slug.doorTarget, point = slug.leapTarget.clone();
  impactDoor(slug);
  slug.onDoorContact({
    other: door.entity,
    contacts: [{
      pointOther: point,
      normal: new pc.Vec3(0, 0, -1),
    }],
  });
  assert.deepEqual(sounds.map((sound) => sound.name), ["jump", "splash"]);
  assert.ok(sounds.every((sound) => sound.pitch >= 0.96 && sound.pitch <= 1.04));
});

it("a rejected jump and an opened door never play a false wet impact", () => {
  const open = fixture(1);
  const rejected = [];
  open.slug.audio = { play: (name) => rejected.push(name) };
  open.slug.doorTarget = open.door;
  assert.equal(open.slug.beginDoorLeap(), false);
  assert.deepEqual(rejected, []);
  const { slug, door } = fixture();
  const sounds = [];
  slug.audio = { play: (name) => sounds.push(name) };
  slug.update(0.1);
  slug.update(0.4);
  door.openAmount = 1;
  slug.onDoorContact({
    other: door.entity,
    contacts: [{
      pointOther: new pc.Vec3(),
      normal: new pc.Vec3(0, 0, -1),
    }],
  });
  assert.deepEqual(sounds, ["jump"]);
  assert.equal(slug.alive, true);
});

it("uses real Yuka states and sacrifices into a persistent, damage-free closed-door jam", () => {
  const { slug, door } = fixture();
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchPressState");
  assert.ok(slug.behavior.currentState instanceof State);
  slug.update(2.5);
  assert.equal(slug.alive, true);
  assert.equal(door.jammed, false);
  impactDoor(slug);
  assert.equal(slug.alive, false);
  assert.equal(door.jammed, true);
  assert.equal(slug.stateName, "LatchDeadState");
  assert.equal(slug.receiveHealing(100), 0);
  slug.update(21);
  assert.equal(door.jammed, true);
  assert.equal(slug.residue.active, true);
  slug.clearGlue();
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

it("opening during windup or flight cancels the splat", () => {
  for (const delay of [0.2, 0.9, 1.8]) {
    const { slug, door } = fixture();
    slug.update(0.1);
    slug.update(delay);
    door.openAmount = 0.2;
    slug.update(0.1);
    if (slug.airborne) {
      slug.entity.rigidbody.linearVelocity.y = -1;
      slug.onLanding();
    }
    slug.update(0.7);
    slug.update(0.8);
    slug.update(0.1);
    assert.equal(slug.alive, true);
    assert.equal(door.jammed, false);
    assert.equal(slug.stateName, "LatchDogState");
    door.openAmount = 0;
    slug.update(0.1);
    assert.equal(slug.stateName, "LatchPressState");
  }
});

it("a bell during closed-door windup launches early; open-door bells only startle", () => {
  const closed = fixture();
  closed.slug.update(0.1);
  assert.equal(closed.slug.onBellRung({ eventId: "one" }), true);
  assert.equal(closed.slug.alive, true);
  assert.equal(closed.door.jammed, false);
  impactDoor(closed.slug);
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
  assert.equal(slug.requestedClip, "leap_rise");
  assert.equal(door.jammed, false);
  assert.equal(slug.onLanding(), false);
  assert.equal(slug.airborne, true);
  slug.entity.rigidbody.linearVelocity.y = -1;
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
  impactDoor(slug);
  assert.equal(slug.entity.rigidbody.enabled, false);
  assert.ok(shapes.every((shape) => !shape.enabled));
  assert.equal(slug.canBeCarriedBy({ entity: new pc.Entity() }), false);
});

it("stands before following a departing royal, sits on arrival, and idles without damage", () => {
  const { slug, royal } = fixture(1);
  slug.entity.rigidbody = { linearVelocity: new pc.Vec3() };
  slug.update(0.1);
  slug.update(0.7);
  if (slug.requestedClip === "antenna_wag") {
    slug.update(1.3);
    slug.update(2.1);
  }
  assert.equal(slug.requestedClip, "sit_loop");
  royal.entity.setPosition(0, 0, -2.5);
  slug.update(0.1);
  assert.equal(slug.requestedClip, "stand_up");
  assert.equal(slug.entity.rigidbody.linearVelocity.length(), 0);
  slug.update(0.7);
  slug.update(0.1);
  assert.equal(slug.requestedClip, "follow");
  assert.ok(slug.entity.rigidbody.linearVelocity.z < 0);
  royal.entity.setPosition(0, 0, -0.5);
  slug.update(0.1);
  assert.equal(slug.requestedClip, "sit_down");
  slug.update(0.7);
  if (slug.requestedClip === "antenna_wag") {
    slug.update(1.3);
    slug.update(2.1);
  }
  assert.equal(slug.requestedClip, "sit_loop");
  slug.update(2.5);
  assert.equal(slug.requestedClip, "antenna_wag");
  slug.update(1.3);
  assert.equal(slug.requestedClip, "pant");
  assert.equal(slug.alive, true);
});

it("plays landing and recovery before resuming pursuit", () => {
  const { slug } = fixture(1);
  slug.airborne = true;
  slug.onLanding();
  slug.update(0.1);
  assert.equal(slug.requestedClip, "land");
  slug.update(0.25);
  assert.equal(slug.requestedClip, "land");
  slug.update(0.35);
  assert.equal(slug.requestedClip, "land_recover");
  slug.update(0.7);
  assert.equal(slug.stateName, "LatchSeekState");
});

it("follows native vertical speed through rise, apex and fall poses", () => {
  const { slug } = fixture(1);
  slug.airborne = true;
  slug.onLaunched();
  slug.entity.rigidbody.linearVelocity.y = 4;
  slug.update(0.1);
  assert.equal(slug.requestedClip, "leap_rise");
  slug.entity.rigidbody.linearVelocity.y = 0.2;
  slug.update(0.1);
  assert.equal(slug.requestedClip, "leap_apex");
  slug.entity.rigidbody.linearVelocity.y = -3;
  slug.update(0.1);
  assert.equal(slug.requestedClip, "leap_fall");
});

it("finishes stun with a full recovery instead of skipping straight into pursuit", () => {
  const { slug } = fixture(1);
  slug.applyStatus("stun", { duration: 2 });
  slug.update(1.9);
  assert.equal(slug.requestedClip, "stun");
  slug.update(0.2);
  assert.equal(slug.requestedClip, "recover");
  slug.update(0.3);
  assert.equal(slug.stateName, "LatchReactionState");
  slug.update(0.4);
  assert.equal(slug.stateName, "LatchSeekState");
});

it("ignores broken doors and leaves dog behavior when the royal disappears", () => {
  const { slug, door, royal } = fixture(1);
  slug.update(0.1);
  door.broken = true;
  door.openAmount = 0;
  royal.alive = false;
  slug.update(0.1);
  assert.equal(slug.nearbyDoor, null);
  assert.equal(slug.stateName, "LatchSeekState");
  slug.update(0.1);
  assert.equal(slug.requestedClip, "sniff");
});

it("click clearing releases glue without opening or damaging the door", () => {
  const { slug, door } = fixture();
  slug.update(0.1);
  slug.update(2.5);
  impactDoor(slug);
  assert.equal(slug.handlePointerDown(), true);
  assert.equal(door.jammed, false);
  assert.equal(door.openAmount, 0);
  assert.equal(slug.handlePointerDown(), false);
});

it("splats at an interior closed door even with an open entrance closer by", () => {
  const { slug, door } = fixture(0);
  const entrance = {
    entity: new pc.Entity(),
    openAmount: 1,
  };
  entrance.entity.setPosition(0, 0, 0.1);
  door.entity.setPosition(0, 0, -0.8);
  slug.runtime.objects[0] = {
    entranceDoors: [entrance],
    destructibleDoors: [entrance, door],
  };
  slug.update(0.1);
  assert.equal(slug.doorTarget, door);
  slug.update(2.5);
  impactDoor(slug);
  assert.equal(slug.alive, false);
  assert.equal(door.jammed, true);
  assert.equal(entrance.openAmount, 1);
});

it("a nearby closed door triggers a splat without a living royal", () => {
  const { slug, royal, door } = fixture();
  royal.alive = false;
  slug.update(0.1);
  slug.update(2.5);
  impactDoor(slug);
  assert.equal(door.jammed, true);
  assert.equal(slug.alive, false);
});

it("the sitting distance still puts the royal under the movement restriction", () => {
  const { slug, royal } = fixture(1);
  royal.entity.setPosition(0, 0, -0.94);
  slug.update(0.1);
  slug.update(0.7);
  if (slug.requestedClip === "antenna_wag") {
    slug.update(1.3);
    slug.update(2.1);
  }
  assert.equal(slug.requestedClip, "sit_loop");
  assert.equal(royal.slows.at(-1).factor, 0.65);
});

it("gets underfoot during pursuit and suspends its ground restriction while carried", () => {
  const { slug, royal, door } = fixture(1);
  door.entity.setPosition(20, 0, 0);
  royal.entity.setPosition(0, 0, -5);
  const walker = new Enemy({
    pc,
    definition: { id: "nearby-walker" },
  });
  walker.entity.setPosition(0.8, 0, 0);
  slug.runtime.objects.push(walker);
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchSeekState");
  assert.equal(walker.statuses.get("slow").factor, 0.65);
  walker.statuses.clear();
  slug.beginCarry(royal);
  slug.update(0.1);
  assert.equal(walker.statuses.has("slow"), false);
});

it("initial pursuit reaches the same sitting distance as later follow behavior", () => {
  const { slug, royal, door } = fixture(1);
  door.entity.setPosition(20, 0, 0);
  royal.entity.setPosition(0, 0, -1.8);
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchSeekState");
  royal.entity.setPosition(0, 0, -0.94);
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchDogState");
  assert.equal(royal.slows.at(-1).factor, 0.65);
});

it("stays in its lane and builds affection without repositioning or hopping beside a human", () => {
  const { slug, royal, door } = fixture(1);
  door.entity.setPosition(20, 0, 0);
  royal.entity.setPosition(1.5, 0, 0);
  slug.followTarget = () => assert.fail("a nearby slime must not reposition to gain affection");
  slug.advanceToPack = () => assert.fail("a nearby slime must not continue toward the castle");
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchDogState");
  assert.equal(slug.idleHop.eligible, false);
  for (let frame = 0; frame < 190; frame++) {
    slug.update(1 / 60);
  }
  assert.equal(slug.affection.charge, 3);
  assert.ok(slug.statuses.has("affection"));
  assert.equal(slug.entity.rigidbody.linearVelocity.length(), 0);
});

it("stops following before pushing a slug ahead toward the human", () => {
  const { slug, royal, door } = fixture(1);
  door.entity.setPosition(20, 0, 0);
  royal.entity.setPosition(0, 0, -2);
  const front = new LatchSlug({
    pc,
    definition: { id: "front-slug" },
    runtime: slug.runtime,
  });
  front.entity.setPosition(0, 0, -1);
  slug.runtime.objects.push(front);
  slug.entity.rigidbody.linearVelocity.set(0, 0, -0.9);
  slug.followTarget(royal, 0.9);
  assert.equal(slug.entity.rigidbody.linearVelocity.length(), 0);
  front.entity.setPosition(0, 0, 1);
  slug.followTarget(royal, 0.9);
  assert.ok(slug.entity.rigidbody.linearVelocity.z < 0);
});

it("sits while relay affection grows instead of following a human or advancing to the castle", () => {
  const { slug: first, royal, door } = fixture(1);
  door.entity.setPosition(20, 0, 0);
  royal.entity.setPosition(0.9, 0, 0);
  first.affection.companion = royal;
  first.affection.charge = 3;
  first.applyStatus("affection", { duration: 0.6 });
  const follower = new LatchSlug({
    pc,
    definition: { id: "relay-slug" },
    runtime: first.runtime,
  });
  follower.entity.setPosition(-1.2, 0, 0);
  follower.entity.rigidbody = { linearVelocity: new pc.Vec3(0.9, 0, 0) };
  first.runtime.objects.push(follower);
  follower.advanceToPack = () => assert.fail("affection buildup must stop castle travel");
  follower.followTarget = () => assert.fail("affection buildup must stop human pursuit");
  follower.update(0.1);
  assert.equal(follower.requestedClip, "sit_loop");
  assert.equal(follower.entity.rigidbody.linearVelocity.length(), 0);
  assert.equal(follower.affection.charge, 0.05);
});

it("sees a closed door from leap distance and selects different leaf heights and offsets", () => {
  const original = Math.random;
  try {
    const first = fixture();
    first.door.entity.setPosition(0, 0, -3.5);
    Math.random = () => 0.1;
    first.slug.update(0.1);
    assert.equal(first.slug.stateName, "LatchPressState");
    first.slug.update(0.4);
    const low = first.slug.leapTarget;
    assert.equal(first.slug.airborne, true);
    assert.ok(first.slug.entity.rigidbody.linearVelocity.y > 0);
    assert.ok(first.slug.entity.rigidbody.linearVelocity.z < 0);
    const second = fixture();
    second.door.entity.setPosition(0, 0, -3.5);
    Math.random = () => 0.9;
    second.slug.update(0.1);
    second.slug.update(0.4);
    const high = second.slug.leapTarget;
    assert.ok(high.y > low.y);
    assert.ok(high.x > low.x);
    assert.ok(low.y >= 0.7 && high.y <= 1.85);
    assert.ok(Math.abs(low.x) < 0.7 && Math.abs(high.x) < 0.7);
    assert.equal(first.door.jammed, false);
  } finally {
    Math.random = original;
  }
});

it("time passing, floor contacts and unrelated wall contacts cannot trigger a splat", () => {
  const { slug, door } = fixture();
  slug.update(0.1);
  slug.update(0.4);
  assert.equal(slug.splat(), false);
  assert.equal(slug.onDoorContact({
    other: door.entity,
    contacts: [{
      pointOther: slug.leapTarget,
      normal: new pc.Vec3(0, 1, 0),
    }],
  }), false);
  assert.equal(slug.onDoorContact({
    other: door.entity,
    contacts: [{
      pointOther: new pc.Vec3(0, 1, 5),
      normal: new pc.Vec3(0, 0, -1),
    }],
  }), false);
  assert.equal(slug.onDoorContact({
    other: new pc.Entity("Unrelated body touching the door"),
    contacts: [{
      pointOther: slug.leapTarget,
      normal: new pc.Vec3(0, 0, -1),
    }],
  }), false);
  slug.update(3);
  assert.equal(slug.alive, true);
  assert.equal(door.jammed, false);
  assert.equal(slug.leapTarget, null);
});

it("a takeoff floor contact does not cancel a rising leap; stun disarms its impact", () => {
  const { slug, door } = fixture();
  slug.update(0.1);
  slug.update(0.4);
  const point = slug.leapTarget;
  assert.equal(slug.onLanding(), false);
  assert.equal(slug.airborne, true);
  slug.applyStatus("stun", { duration: 2 });
  assert.equal(slug.leapTarget, null);
  assert.equal(slug.onDoorContact({
    contacts: [{
      pointOther: point,
      normal: new pc.Vec3(0, 0, -1),
    }],
  }), false);
  assert.equal(slug.alive, true);
  assert.equal(door.jammed, false);
});

it("a wall occluding the leaf prevents seeing it, and a broken leaf is never targeted", () => {
  const { slug, door } = fixture();
  slug.app = {
    systems: {
      rigidbody: {
        raycastFirst: () => ({ point: new pc.Vec3(0, 0.7, 4) }),
      },
    },
  };
  assert.equal(slug.nearbyDoor, null);
  door.entity.setPosition(0, 0, -3);
  assert.equal(slug.nearbyDoor, null);
  door.broken = true;
  assert.equal(slug.nearbyDoor, null);
});

it("lands on compound-floor contact with either manifold normal direction", () => {
  for (const normalY of [-1, 1]) {
    const { slug, door } = fixture();
    slug.update(0.1);
    slug.update(0.4);
    slug.entity.rigidbody.linearVelocity.set(0, -0.2, 0);
    slug.onDoorContact({
      other: new pc.Entity("Compound floor"),
      contacts: [{
        pointOther: slug.position.clone(),
        normal: new pc.Vec3(0, normalY, 0),
      }],
    });
    assert.equal(slug.airborne, false);
    assert.equal(slug.grounded, true);
    assert.equal(slug.requestedClip, "land");
    assert.equal(slug.alive, true);
    assert.equal(door.jammed, false);
    slug.update(0.7);
    slug.update(0.7);
    assert.notEqual(slug.stateName, "LatchReactionState");
  }
});

it("an overhead contact cannot masquerade as landing support", () => {
  const { slug } = fixture();
  slug.update(0.1);
  slug.update(0.4);
  slug.entity.rigidbody.linearVelocity.set(0, -0.2, 0);
  slug.onDoorContact({
    other: new pc.Entity("Ceiling"),
    contacts: [{
      pointOther: slug.position.clone().add(new pc.Vec3(0, slug.height, 0)),
      normal: new pc.Vec3(0, 1, 0),
    }],
  });
  assert.equal(slug.airborne, true);
  assert.equal(slug.stateName, "LatchLeapState");
});

it("clearing glue retains the prepared effect until the slug owner is destroyed", () => {
  const { slug, door } = fixture();
  let destroyed = 0;
  slug.splash = { destroy: () => destroyed++ };
  slug.residue = new LatchGlue(door);
  assert.equal(slug.handlePointerDown(), true);
  assert.equal(door.jammed, false);
  assert.equal(destroyed, 0);
  slug.destroy();
  slug.destroy();
  assert.equal(destroyed, 1);
});

it("changes the door-jump pose from rising to compact apex to falling", () => {
  const { slug } = fixture();
  slug.update(0.1);
  slug.update(0.4);
  assert.equal(slug.requestedClip, "leap_rise");
  slug.entity.rigidbody.linearVelocity.y = 0;
  slug.update(0.05);
  assert.equal(slug.requestedClip, "leap_apex");
  slug.entity.rigidbody.linearVelocity.y = -2;
  slug.update(0.05);
  assert.equal(slug.requestedClip, "leap_fall");
});

it("befriends the hero and servants, keeps a companion, and releases unsafe or dead leaders", () => {
  const { slug, royal, door } = fixture(1);
  royal.alive = false;
  door.openAmount = 1;

  const hero = {
    entity: new pc.Entity(),
    alive: true,
  };
  hero.entity.setPosition(2, 0, 0);
  slug.runtime.getHero = () => hero;

  assert.equal(slug.resolvePackTarget(), hero);
  slug.update(.1);
  assert.equal(slug.requestedClip, "sit_down");
  slug.update(.7);
  assert.equal(slug.requestedClip, "stand_up");
  slug.update(.7);
  slug.update(.1);
  assert.ok(slug.entity.rigidbody.linearVelocity.x > 0);

  class Servant {
    constructor() {
      this.entity = new pc.Entity();

    }
  }
  const servant = new Servant();
  servant.entity.tags.add("Servant");
  servant.entity.setPosition(.5, 0, 0);
  slug.runtime.objects.push(servant);
  assert.equal(slug.resolvePackTarget(), hero);

  hero.alive = false;
  assert.equal(slug.resolvePackTarget(), servant);
  servant.entity.setPosition(20, 0, 0);
  assert.equal(slug.resolvePackTarget(), null);

});


it("only adopts people on a path or castle floor and rejects an occluded first meeting", () => {
  const { slug, royal } = fixture(1);
  royal.alive = false;
  const hero = {entity: new pc.Entity()};
  hero.entity.setPosition(1, 0, 0);
  slug.runtime.getHero = () => hero;
  slug.runtime.mapData = {
    cols: 5,
    rows: 5,
    grid: Array.from({length: 5}, () => Array(5).fill(1)),
  };
  assert.equal(slug.resolvePackTarget(), null);
  slug.runtime.mapData.grid[2][3] = 2;
  slug.app = {systems: {rigidbody: {raycastFirst: () => ({})}}};
  assert.equal(slug.resolvePackTarget(), null);
  slug.app.systems.rigidbody.raycastFirst = () => null;
  assert.equal(slug.resolvePackTarget(), hero);
  slug.runtime.mapData.grid[2][3] = 1;
  assert.equal(slug.resolvePackTarget(), null);

  slug.runtime.objects.push({
    residence: {
      layout: {
        toLocal: (x, z)=>({
          x,
          z,
        }),
        walkableAreas: [{
          minX: 0,
          maxX: 2,
          minZ: -1,
          maxZ: 1,
          floorY: 0,
        }],
      },
    },
  });
  assert.equal(slug.resolvePackTarget(), hero);

});


it("advances affection through the real slug update and routes live clicks to patting", () => {
  const { slug, royal } = fixture(1);
  const buffs = [];
  royal.applyBuff = (id) => {
    buffs.push(id);

    return true;
  };
  slug.update(0.1);
  slug.update(2.8);
  assert.equal(buffs.length, 0);
  slug.update(0.21);
  assert.ok(buffs.includes("slime-affection"));
  assert.ok(slug.statuses.has("affection"));
  assert.equal(slug.findInteraction(), null, "slimes must not offer a Pat slime action");
  let pats = 0;
  slug.patPresentation = {
    pat: () => {
      pats += 1;

      return true;
    },
  };
  assert.equal(slug.handlePointerDown(), true);
  assert.equal(pats, 1);
});
it("a dispatched slug follows its gate route and rejoins nearby after a companion detour", () => {
  const entry = {
    col:7,
    rows:[6,7],
  };
  const route = Array.from({length:9}, (_,i) => ({
    col:7+i,
    row:6.5,
    elevation:0,
  }));
  const app = {systems:{rigidbody:{raycastFirst:()=>null}}};
  const slug = new LatchSlug({
    pc,
    app,
    definition:{
      id:"routed",
      gatewayId:"gate",
    },
    runtime:{
      objects:[],
      mapData:{
        cols:21,
        rows:15,
        objects:[{
          id:"gate",
          entry,
        }],
        paths:[{
          entry,
          route,
        }],
      },
    },
  });
  slug.entity.rigidbody = {linearVelocity:new pc.Vec3()};
  slug.entity.setPosition(-3,0,-.5);
  assert.equal(slug.advanceToPack(),true);
  assert.ok(slug.entity.rigidbody.linearVelocity.x>0);
  slug.entity.setPosition(3,0,-.5);
  assert.equal(slug.advanceToPack(),true);
  assert.ok(slug.entity.rigidbody.linearVelocity.x>0,"rejoin ahead instead of walking back to the old gate waypoint");
});
it("notices a raised entrance but climbs its available treads before winding up the leap", () => {
  const {slug,door,royal}=fixture();
  royal.alive=false;
  door.entity.setPosition(0,1,-2);
  slug.entity.setPosition(0,0,0);
  const approaches=[];
  slug.approachDoor=target=>{
    approaches.push(target);

    return slug.position.y<.7;
  };
  slug.update(.1);
  assert.equal(slug.stateName,"LatchSeekState");
  assert.equal(slug.requestedClip,"waddle_walk");
  assert.deepEqual(approaches,[door]);
  slug.entity.setPosition(0,.75,-1.2);
  slug.update(.1);
  assert.equal(slug.stateName,"LatchPressState");
  slug.update(.4);
  assert.equal(slug.stateName,"LatchLeapState");
  assert.ok(slug.entity.rigidbody.linearVelocity.y>0);
});

it("does not treat a door on a different storey as a reachable raised entrance", () => {
  const {slug,door,royal}=fixture();royal.alive=false;
  door.entity.setPosition(0,3,-2);
  assert.equal(slug.nearbyDoor,null);
  slug.update(.1);
  assert.equal(slug.stateName,"LatchSeekState");
});

it("a second slug commits and splats even when the first impact has jammed the leaf", () => {
  const first = fixture();
  first.slug.update(0.1);
  first.slug.update(0.4);
  const second = fixture();
  second.slug.runtime.objects.splice(0, second.slug.runtime.objects.length, ...first.slug.runtime.objects, second.slug);
  second.slug.update(0.1);
  assert.equal(second.slug.stateName, "LatchPressState");
  impactDoor(first.slug);
  assert.equal(first.door.jammed, true);
  second.slug.update(0.4);
  assert.equal(second.slug.stateName, "LatchLeapState");
  impactDoor(second.slug);
  assert.equal(second.slug.alive, false);
  assert.equal(first.door.jammed, true);
  first.slug.clearGlue();
  assert.equal(first.door.jammed, true);
  second.slug.clearGlue();
  assert.equal(first.door.jammed, false);
});

it("boosts actual slime movement only after seven scoops and drops back to normal when stamina runs out", () => {
  const { slug } = fixture(1);
  const bug = {
    entity: {
      enabled: true,
      getPosition: () => new pc.Vec3(1, 0, 0),
    },
    alive: true,
    isBellBug: true,
  };

  slug.runtime.objects.push(bug);
  slug.crawlTime = 1.15 / 4;
  const target = { position: new pc.Vec3(10, 0, 0) };
  slug.moveToward(target, 0.8);
  const ordinarySpeed = slug.entity.rigidbody.linearVelocity.length();
  slug.hurry.update(0.1);
  assert.equal(slug.hurry.active, false);
  for (let i = 0; i < 7; i++) {
    slug.annoyance.scoop(bug);
  }
  slug.hurry.update(0.1);
  slug.moveToward(target, 0.8);
  assert.ok(Math.abs(slug.entity.rigidbody.linearVelocity.length() / ordinarySpeed - 1.8) < 1e-6);
  slug.hurry.update(2);
  slug.moveToward(target, 0.8);
  assert.ok(Math.abs(slug.entity.rigidbody.linearVelocity.length() - ordinarySpeed) < 1e-6);
});

it("performs an idle twirl hop with native takeoff and waits for supporting contact before landing", () => {
  const { slug, royal } = fixture(1);
  royal.alive = false;
  const sounds = [];
  slug.audio = { play: (name) => sounds.push(name) };
  slug.app = { systems: { rigidbody: { raycastFirst: (from, to) => from.y > to.y ? { normal: pc.Vec3.UP } : null } } };
  slug.grounded = true;
  assert.equal(slug.beginIdleHop(), true);
  assert.equal(slug.stateName, "LatchIdleHopState");
  assert.equal(slug.requestedClip, "idle_hop_prepare");
  assert.deepEqual(sounds, []);
  slug.update(0.24);
  assert.deepEqual(sounds, ["idleHop"]);
  assert.equal(slug.airborne, true);
  assert.equal(slug.requestedClip, "idle_hop_spin");
  assert.ok(slug.entity.rigidbody.linearVelocity.y > 3);
  assert.equal(slug.onLanding(), false, "takeoff contacts do not terminate a rising hop");
  slug.entity.rigidbody.linearVelocity.y = -1;
  slug.update(1);
  assert.equal(slug.airborne, true, "elapsed animation time must never force a landing");
  slug.onLanding();
  assert.equal(slug.requestedClip, "land");
  assert.equal(slug.stateName, "LatchIdleHopState");
  slug.update(0.65);
  assert.equal(slug.requestedClip, "land_recover");
  slug.update(0.61);
  assert.equal(slug.stateName, "LatchSeekState");
  assert.equal(slug.residue, null);
  assert.deepEqual(sounds, ["idleHop"], "the hop cue plays once, at takeoff");
});

it("cancels an idle hop if headroom closes during anticipation or stun interrupts it", () => {
  const { slug, royal } = fixture(1);
  royal.alive = false;
  const sounds = [];
  slug.audio = { play: (name) => sounds.push(name) };
  let ceiling = false;
  slug.app = { systems: { rigidbody: { raycastFirst: (from, to) => from.y > to.y || ceiling ? { normal: pc.Vec3.UP } : null } } };
  slug.grounded = true;
  assert.equal(slug.beginIdleHop(), true);
  ceiling = true;
  slug.update(0.24);
  assert.equal(slug.airborne, false);
  assert.equal(slug.stateName, "LatchSeekState");
  ceiling = false;
  assert.equal(slug.beginIdleHop(), true);
  slug.applyStatus("stun", { duration: 2 });
  slug.update(0.5);
  assert.equal(slug.stateName, "LatchReactionState");
  assert.equal(slug.airborne, false);
  assert.equal(slug.requestedClip, "stun");
  assert.deepEqual(sounds, [], "cancelled hops stay silent");
});


it("tolerates two scoops, triggers survival at seven and loses mass exactly as before", () => {
  const { slug } = fixture(1);
  slug.affection.charge = 3;
  slug.statuses.set("affection", { remaining: 1 });
  const source = { isBellBug: true };
  for (let i = 1; i <= 10; i++) {
    assert.equal(slug.annoyance.scoop(source), true);
    assert.equal(slug.annoyance.level, Math.min(5, Math.max(0, i - 2)));
    assert.equal(slug.annoyance.active, i >= 7);
    assert.equal(slug.alive, i < 10);
    assert.ok(Math.abs(slug.health - slug.maxHealth * (10 - i) / 10) < 1e-7);
    assert.equal(slug.statuses.has("affection"), i <= 2);
    assert.ok(Math.abs(slug.affection.charge - Math.max(0, 3 - Math.max(0, i - 2) * 0.6)) < 1e-8);
  }
  assert.equal(slug.annoyance.scoop(source), false);
});

it("annoyance follows the default route without settling beside a companion", () => {
  const { slug } = fixture(1);
  for (let i = 0; i < 7; i++) {
    slug.annoyance.scoop(null);
  }
  let routed = 0;
  slug.advanceToPack = () => {
    routed++;

    return true;
  };
  slug.resolvePackTarget = () => assert.fail("annoyance must not follow companions");
  slug.affection.charge = 2;
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchAnnoyedState");
  assert.equal(routed, 1);
  assert.ok(slug.affection.charge < 2);
});

it("annoyed slimes approach and press closed room doors instead of running into them", () => {
  const { slug } = fixture(1);
  const door = {
    openAmount: 0,
    broken: false,
    entity: new pc.Entity(),
  };
  Object.defineProperty(slug, "nearbyDoor", { get: () => door });
  slug.annoyance.active = true;
  let approaching = true;
  slug.approachDoor = target => {
    assert.equal(target, door);

    return approaching;
  };
  slug.advanceToPack = () => assert.fail("closed door must be handled before the escape route");
  slug.update(0.1);
  assert.equal(slug.stateName, "LatchAnnoyedState");
  approaching = false;
  slug.update(0.1);
  assert.equal(slug.doorTarget, door);
  assert.equal(slug.stateName, "LatchPressState");
});
