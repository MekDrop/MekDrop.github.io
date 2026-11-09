import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { BellBugFleshScratch } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugFleshScratch.js";

function fixture() {
  const app = new pc.EventHandler();
  app.systems = { rigidbody: { raycastAll: () => [] } };
  const entity = new pc.Entity();
  entity.setPosition(-0.4, 0, 0);
  const actor = {
    entity: new pc.Entity(),
    position: new pc.Vec3(),
    radius: 0.3,
    health: 3,
  };
  actor.receiveDamage = amount => {
    actor.health -= amount;

    return amount;
  };
  const node = new pc.Entity();
  let plane = 0;
  const mesh = {
    getPositions: values => values.push(plane, 0.05, -0.4, plane, 0.5, -0.4, plane, 0.5, 0.4, plane, 0.05, 0.4),
    getIndices: values => values.push(0, 1, 2, 0, 2, 3),
    getVertexStream: () => 0,
  };
  actor.entity.findComponents = () => [{
    entity: { enabled: true },
    meshInstances: [{
      mesh,
      node,
    }],
  }];
  let reachable = true;
  const foot = {
    source: false,
    canReach: () => reachable,
  };
  const owner = {
    pc,
    app,
    entity,
    position: entity.getPosition(),
    radius: 0.25,
    alive: true,
    gatewayArrival: { active: false },
    statuses: new Map(),
    scoop: {},
    actors: [actor],
    runtime: { getHero: () => actor },
    targetPosition: target => target.position,
    distanceTo: target => entity.getPosition().distance(target.position),
    faceTarget: target => entity.lookAt(target.position),
    stop: () => {},
    animationPlayback: { scoopPose: { foot: () => foot } },
    playClip: clip => {
      owner.clip = clip;
    },
  };
  const events = [];
  const sounds = [];
  owner.playFleshScratch = point => sounds.push(point.clone());
  const facings = [];
  const faceTarget = owner.faceTarget;
  owner.faceTarget = target => {
    facings.push(target.position.clone());
    faceTarget(target);
  };
  app.on("bell-bug:scratch-contact", event => events.push(event));
  const scratch = new BellBugFleshScratch(owner);

  return {
    actor,
    scratch,
    events,
    sounds,
    facings,
    weaponOnly: () => {
      node.name = "King sword blade";
    },
    moveSkin: x => {
      plane = x;
    },
    reach: value => {
      reachable = value;
    },
  };
}

test("front-foot scratches damage once at contact, emit in stroke direction and alternate", () => {
  const { actor, scratch, events, sounds } = fixture();
  scratch.update(0.22, true);
  assert.equal(actor.health, 3);
  scratch.update(0.13, true);
  assert.equal(actor.health, 2.92);
  assert.equal(events.length, 1);
  assert.equal(sounds.length, 1, "sound is synchronized with damage and the blood cue");
  assert.ok(events[0].direction.dot(scratch.stroke.end.clone().sub(scratch.stroke.start).normalize()) > 0.99);
  scratch.update(0.1, true);
  assert.equal(events.length, 1);
  assert.equal(sounds.length, 1, "the recovery does not repeat the sound");
  scratch.update(0.4, true);
  assert.equal(scratch.side, 1);
});

test("an unreachable strike cannot damage later when reach returns during recovery", () => {
  const { actor, scratch, events, sounds, reach } = fixture();
  scratch.update(0.22, true);
  reach(false);
  scratch.update(0.13, true);
  reach(true);
  scratch.update(0.3, true);
  assert.equal(actor.health, 3);
  assert.equal(events.length, 0);
  assert.equal(sounds.length, 0, "an unreachable claw is silent");
});

test("a limb moving in place invalidates the old skin point without blood or damage", () => {
  const { actor, scratch, events, moveSkin } = fixture();
  scratch.update(0.22, true);
  moveSkin(0.12);
  scratch.update(0.13, true);
  assert.equal(actor.health, 3);
  assert.equal(events.length, 0);
  assert.equal(scratch.stroke, null);
});

test("nearby equipment cannot be mistaken for flesh", () => {
  const { actor, scratch, events, weaponOnly } = fixture();
  weaponOnly();
  scratch.update(0.22, true);
  scratch.update(1, true);
  assert.equal(actor.health, 3);
  assert.equal(events.length, 0);
  assert.equal(scratch.stroke, null);
});

test("a frame hitch still displays the contact pose rather than damaging during retraction", () => {
  const { actor, scratch, events } = fixture();
  scratch.update(0.22, true);
  scratch.update(0.5, true);
  assert.equal(scratch.time, 0.34);
  assert.equal(actor.health, 2.92);
  assert.equal(events.length, 1);
});

test("alternating scratches retain facing until the target moves", () => {
  const { actor, scratch, facings } = fixture();
  scratch.update(0.22, true);
  const selected = facings.length;
  for (let i = 0; i < 4; i++) {
    scratch.update(0.34, true);
    scratch.update(0.5, true);
    scratch.approach();
    scratch.update(0.22, true);
  }
  assert.equal(facings.length, selected, "neither foot selection nor the between-stroke state turns the body");
  actor.position.z += 0.1;
  scratch.update(0.22, true);
  assert.ok(facings.length > selected, "a moving target allows a fresh heading");
});
