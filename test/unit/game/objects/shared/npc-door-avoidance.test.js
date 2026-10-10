import assert from "node:assert/strict";
import { it } from "node:test";
import { NpcDoorReactionState } from "../../../../../src/game/objects/shared/NpcDoorReactionState.js";
import { KingTrainingBehavior } from "../../../../../src/game/objects/castle/KingTrainingBehavior.js";
import { ServantStateMachine } from "../../../../../src/game/objects/castle/ServantStateMachine.js";
import { ServantWaitState } from "../../../../../src/game/objects/castle/states/servant/ServantWaitState.js";
import { ServantLookLeftState } from "../../../../../src/game/objects/castle/states/servant/ServantLookLeftState.js";
import { KingGameOverBehavior } from "../../../../../src/game/objects/castle/KingGameOverBehavior.js";
import * as pc from "playcanvas";
import { NpcDoorAvoidance } from "../../../../../src/game/objects/shared/NpcDoorAvoidance.js";
import { NPC_DOOR_AVOIDANCE_PHASE as PHASE } from "../../../../../src/game/enum/NpcDoorAvoidancePhase.js";

/**
 * @returns {{app: pc.EventHandler, root: pc.Entity, door: pc.Entity, npc: pc.Entity, behavior: NpcDoorAvoidance}}
 */
function scene() {
  const app = new pc.EventHandler();
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  const door = new pc.Entity("door");
  const npc = new pc.Entity("npc reaction root");
  root.addChild(door);
  root.addChild(npc);
  return { app, root, door, npc, behavior: new NpcDoorAvoidance(npc, app) };
}

it("steps clear, waits while the door is active, and returns after it closes", () => {
  const { app, door, npc, behavior } = scene();
  try {
    const inSwing = (point) => Math.abs(point.x) < 1;
    for (let frame = 0; frame < 240; frame++) {
      NpcDoorAvoidance.requestClearance(door, inSwing, () => true);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.ok(npc.getPosition().x >= 1);
    assert.equal(behavior.phase, PHASE.WAIT);
    const waiting = npc.getPosition().clone();
    for (let frame = 0; frame < 60; frame++) {
      NpcDoorAvoidance.requestClearance(door, inSwing, () => true);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.deepEqual(npc.getPosition(), waiting);
    for (let frame = 0; frame < 240; frame++) { app.fire("update", 1 / 60); app.fire("prerender"); }
    assert.equal(behavior.phase, PHASE.IDLE);
    assert.ok(npc.getPosition().length() < 0.04);
  } finally { behavior.destroy(); }
});

it("waits without teleporting when furniture blocks every escape route", () => {
  const { app, door, npc, behavior } = scene();
  try {
    for (let frame = 0; frame < 120; frame++) {
      NpcDoorAvoidance.requestClearance(door, () => true, () => false);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(behavior.phase, PHASE.WAIT);
    assert.equal(npc.getPosition().length(), 0);
  } finally { behavior.destroy(); }
});

it("hero clearance interrupts only the requested servant", () => {
  const { app, root, door: hero, npc, behavior } = scene();
  const other = new pc.Entity("other servant");
  root.addChild(other);
  const otherBehavior = new NpcDoorAvoidance(other, app);
  try {
    for (let frame = 0; frame < 180; frame++) {
      NpcDoorAvoidance.requestClearance(hero,
        (point) => Math.hypot(point.x, point.z) < 1.1,
        () => true, npc);
      app.fire("update", 1 / 60);
      app.fire("prerender");
    }
    assert.ok(npc.getPosition().length() >= 1.1);
    assert.equal(behavior.phase, PHASE.WAIT);
    assert.equal(otherBehavior.phase, PHASE.IDLE);
    assert.equal(other.getPosition().length(), 0);
  } finally {
    behavior.destroy();
    otherBehavior.destroy();
  }
});

it("resumes the servant's interrupted work while hero checks continue after moving away", () => {
  const { app, door: hero, npc, behavior } = scene();
  const role = new ServantStateMachine({ idlePhase: "idle", initialPhase: "work",
    states: [new ServantWaitState({ phase: "work", duration: 2, nextPhase: "idle" })] });
  role.start();
  role.update(.75);
  const suspended = role.currentState;
  behavior.behavior = role;
  try {
    const hazard = (point) => Math.hypot(point.x - hero.getPosition().x,
      point.z - hero.getPosition().z) < 1.1;
    for (let frame = 0; frame < 30; frame++) {
      NpcDoorAvoidance.requestClearance(hero, hazard, () => true, npc);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(role.reacting, true);
    assert.ok(npc.getPosition().length() > 0);
    hero.setPosition(10, 0, 0);
    for (let frame = 0; frame < 360; frame++) {
      NpcDoorAvoidance.requestClearance(hero, hazard, () => true, npc);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(behavior.phase, PHASE.IDLE);
    assert.equal(role.currentState, suspended);
    assert.equal(role.elapsed, .75);
    assert.ok(npc.getPosition().length() < .04);
    role.update(.25);
    assert.equal(role.elapsed, 1);
  } finally { behavior.destroy(); }
});

it("avoids thin obstacles along the route and rechecks each movement step", () => {
  const { app, door, npc, behavior } = scene();
  try {
    let blocked = false;
    const canMove = (point) => !blocked && !(point.x > 0.2 && point.x < 0.3);
    NpcDoorAvoidance.requestClearance(door, (point) => Math.abs(point.x) < 1, canMove);
    for (let frame = 0; frame < 30; frame++) {
      NpcDoorAvoidance.requestClearance(door, (point) => Math.abs(point.x) < 1, canMove);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.ok(npc.getPosition().x < 0, "takes the unobstructed side");
    blocked = true;
    const before = npc.getPosition().clone();
    app.fire("update", 1 / 60); app.fire("prerender");
    assert.deepEqual(npc.getPosition(), before);
    assert.equal(behavior.phase, PHASE.WAIT);
  } finally { behavior.destroy(); }
});

it("excludes hidden NPCs, other scenes, and destroyed participants", () => {
  const first = scene();
  const second = scene();
  try {
    first.npc.enabled = false;
    NpcDoorAvoidance.requestClearance(first.door, () => true, () => true);
    assert.equal(first.behavior.phase, PHASE.IDLE);
    assert.equal(second.behavior.phase, PHASE.IDLE);
    assert.equal(NpcDoorAvoidance.occupied(first.door, () => true), false);
    first.npc.enabled = true;
    assert.equal(NpcDoorAvoidance.occupied(first.door, () => true), true);
    first.behavior.destroy();
    assert.equal(NpcDoorAvoidance.occupied(first.door, () => true), false);
  } finally { first.behavior.destroy(); second.behavior.destroy(); }
});

it("interrupts the royal's actual state and resumes its progress without replaying entry actions", () => {
  const { app, door, behavior } = scene();
  const role = new KingTrainingBehavior(() => {});
  let entries = 0;
  let exits = 0;
  role.actionHandler = { enter: () => entries++, exit: () => exits++ };
  role.requested = true;
  role.update(1.25);
  const suspended = role.currentState;
  const elapsed = role.elapsed;
  const progress = role.progress;
  const before = { entries, exits };
  behavior.behavior = role;
  try {
    for (let frame = 0; frame < 120; frame++) {
      NpcDoorAvoidance.requestClearance(door, (point) => Math.abs(point.x) < 1, () => true);
      role.update(1 / 60);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.ok(role.currentState instanceof NpcDoorReactionState);
    assert.equal(role.previousState, suspended, "Yuka remembers the suspended task");
    assert.equal(role.elapsed, elapsed, "reaction does not consume task time");
    assert.equal(role.progress, progress);
    for (let frame = 0; frame < 240; frame++) {
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(role.currentState, suspended, "Yuka reverts to the exact previous state");
    assert.equal(role.elapsed, elapsed);
    assert.deepEqual({ entries, exits }, before, "task lifecycle actions are not replayed");
    role.update(.2);
    assert.ok(Math.abs(role.elapsed - elapsed - .2) < .00001);
  } finally { behavior.destroy(); }
});

it("preserves an already interrupted servant task and its timer", () => {
  const { app, door, behavior } = scene();
  const role = new ServantStateMachine({ idlePhase: "idle", initialPhase: "work",
    states: [new ServantWaitState({ phase: "work", duration: 2, nextPhase: "idle" }),
      new ServantLookLeftState({ phase: "distracted", duration: 1, nextPhase: null })] });
  role.start();
  role.update(.75, { doorwayBusy: true });
  role.interrupt("distracted");
  role.update(.25);
  const suspended = role.currentState;
  behavior.behavior = role;
  try {
    NpcDoorAvoidance.requestClearance(door, (point) => Math.abs(point.x) < 1, () => true);
    role.update(5);
    assert.equal(role.elapsed, .25);
    for (let frame = 0; frame < 360; frame++) {
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(role.currentState, suspended);
    assert.equal(role.elapsed, .25);
    assert.equal(role.interrupted, true);
    role.update(.75);
    assert.equal(role.phase, "work");
    assert.equal(role.elapsed, .75, "earlier interruption still resumes correctly");
  } finally { behavior.destroy(); }
});

it("reverts a walking royal without restarting the walk", () => {
  let starts = 0;
  const progress = [];
  const role = new KingGameOverBehavior({ walkDuration: 2, walkStartDelay: 0,
    beginWalk: () => starts++, move: (value) => { progress.push(value); return true; },
    playAnimation: () => {} });
  role.start();
  role.update(.5);
  const suspended = role.stateMachine.currentState;
  const reaction = new NpcDoorReactionState(() => {});
  role.stateMachine.interruptReaction(reaction);
  role.update(1);
  assert.equal(progress.length, 1, "walk remains suspended");
  role.stateMachine.resumeReaction(reaction);
  assert.equal(role.stateMachine.currentState, suspended);
  assert.equal(starts, 1, "revert does not begin the route again");
  role.update(.1);
  assert.ok(progress[1] > progress[0], "walk continues from its prior progress");
});

it("an explicit new task cancels the reaction instead of reviving the old task", () => {
  const { app, door, behavior } = scene();
  const role = new KingTrainingBehavior(() => {});
  role.requested = true;
  role.update(1.25);
  behavior.behavior = role;
  try {
    NpcDoorAvoidance.requestClearance(door, (point) => Math.abs(point.x) < 1, () => true);
    assert.equal(role.reacting, true);
    role.reset();
    const replacement = role.currentState;
    for (let frame = 0; frame < 240; frame++) {
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(role.currentState, replacement);
    assert.equal(role.elapsed, 0);
    assert.equal(role.reacting, false);
    assert.equal(behavior.phase, PHASE.IDLE);
  } finally { behavior.destroy(); }
});

it("returns to its previous state at the safe sidestep if the old spot stays blocked", () => {
  const { app, door, npc, behavior } = scene();
  const original = behavior.behavior.currentState;
  let oldSpotBlocked = false;
  const canMove = (point) => !oldSpotBlocked || point.x > .9;
  try {
    for (let frame = 0; frame < 120; frame++) {
      NpcDoorAvoidance.requestClearance(door, (point) => Math.abs(point.x) < 1, canMove);
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    oldSpotBlocked = true;
    for (let frame = 0; frame < 240; frame++) {
      app.fire("update", 1 / 60); app.fire("prerender");
    }
    assert.equal(behavior.behavior.currentState, original);
    assert.equal(behavior.phase, PHASE.IDLE);
    assert.ok(npc.getPosition().x > .9, "never returns into the blocked spot");
  } finally { behavior.destroy(); }
});

it("keeps the door operator at the handle while bystanders still yield", () => {
  const { app, root, door, npc, behavior } = scene();
  const operator = new pc.Entity("Door operator");
  root.addChild(operator);
  operator.addChild(npc);
  const bystander = new pc.Entity("Bystander");
  root.addChild(bystander);
  const avoidance = new NpcDoorAvoidance(bystander, app);
  try {
    NpcDoorAvoidance.requestClearance(door, () => true, () => false, null, operator);
    assert.equal(behavior.phase, PHASE.IDLE);
    assert.equal(avoidance.phase, PHASE.WAIT);
    bystander.enabled = false;
    assert.equal(NpcDoorAvoidance.occupied(door, () => true, operator), false);
    assert.equal(NpcDoorAvoidance.occupied(door, () => true), true);
  } finally {
    behavior.destroy();
    avoidance.destroy();
  }
});
