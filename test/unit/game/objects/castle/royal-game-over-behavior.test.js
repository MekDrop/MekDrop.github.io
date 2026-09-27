import assert from "node:assert/strict";
import { it } from "node:test";
import { State } from "yuka";
import { ROYAL_ANIMATION } from "../../../../../src/game/enum/RoyalAnimation.js";
import { ROYAL_GAME_OVER_PHASE } from "../../../../../src/game/enum/RoyalGameOverPhase.js";
import { KingCryState } from "../../../../../src/game/objects/castle/KingCryState.js";
import { KingGameOverBehavior } from "../../../../../src/game/objects/castle/KingGameOverBehavior.js";
import { PrincessCryState } from "../../../../../src/game/objects/castle/PrincessCryState.js";
import { PrincessGameOverBehavior } from "../../../../../src/game/objects/castle/PrincessGameOverBehavior.js";
import { QueenCryState } from "../../../../../src/game/objects/castle/QueenCryState.js";
import { QueenGameOverBehavior } from "../../../../../src/game/objects/castle/QueenGameOverBehavior.js";
import { RoyalWalkOutState } from "../../../../../src/game/objects/castle/RoyalWalkOutState.js";

function createBehavior(events, BehaviorType = KingGameOverBehavior) {
  return new BehaviorType({
    walkDuration: 3.2,
    walkStartDelay: 0.2,
    beginWalk: () => events.push("walk"),
    move: (progress) => {
      events.push(["move", progress]);
      return true;
    },
    playAnimation: (animation, blendDuration = 0) =>
      events.push(["animation", animation, blendDuration]),
  });
}

it("models a royal's final-death reaction as Yuka states", () => {
  const walk = new RoyalWalkOutState();
  const cryStates = [
    new KingCryState(),
    new QueenCryState(),
    new PrincessCryState(),
  ];

  assert.ok(walk instanceof State);
  assert.equal(walk.phase, ROYAL_GAME_OVER_PHASE.WALK_OUT);
  for (const cryState of cryStates) {
    assert.ok(cryState instanceof State);
    assert.equal(cryState.phase, ROYAL_GAME_OVER_PHASE.CRY);
  }
  assert.equal(new Set(cryStates.map(({ constructor }) => constructor)).size, 3);
});

it("walks out and cries only after its own behavior starts", () => {
  const events = [];
  const behavior = createBehavior(events);

  behavior.update(10);
  assert.deepEqual(events, []);
  assert.equal(behavior.start(), true);
  assert.deepEqual(events, [
    "walk",
    ["animation", ROYAL_ANIMATION.WALK_OUT, 0],
  ]);
  assert.equal(behavior.phase, ROYAL_GAME_OVER_PHASE.WALK_OUT);

  behavior.update(0.2);
  assert.deepEqual(events.at(-1), ["move", 0]);
  behavior.update(3);
  assert.deepEqual(events.at(-2), ["move", 1]);
  assert.deepEqual(events.at(-1), [
    "animation",
    ROYAL_ANIMATION.CRY,
    0.18,
  ]);
  assert.equal(behavior.phase, ROYAL_GAME_OVER_PHASE.CRY);
  assert.equal(behavior.start(), false);
});

it("keeps every royal's Yuka state machine independent", () => {
  const firstEvents = [];
  const secondEvents = [];
  const first = createBehavior(firstEvents);
  const second = createBehavior(secondEvents);

  first.start();
  first.update(3.2);

  assert.equal(first.phase, ROYAL_GAME_OVER_PHASE.CRY);
  assert.equal(second.phase, null);
  assert.deepEqual(secondEvents, []);

  second.start();
  assert.equal(second.phase, ROYAL_GAME_OVER_PHASE.WALK_OUT);
  assert.deepEqual(secondEvents, [
    "walk",
    ["animation", ROYAL_ANIMATION.WALK_OUT, 0],
  ]);
});

it("stops walking when the castle reports a blocked route", () => {
  const events = [];
  const behavior = new KingGameOverBehavior({
    walkDuration: 3.2,
    walkStartDelay: 0.2,
    beginWalk: () => events.push("walk"),
    move: () => false,
    playAnimation: (animation) => events.push(animation),
  });

  behavior.start();
  behavior.update(0.3);

  assert.equal(behavior.phase, ROYAL_GAME_OVER_PHASE.CRY);
  assert.deepEqual(events, [
    "walk",
    ROYAL_ANIMATION.WALK_OUT,
    ROYAL_ANIMATION.CRY,
  ]);
});

it("lets each royal choose a different place to stop outside", () => {
  const king = createBehavior([], KingGameOverBehavior);
  const queen = createBehavior([], QueenGameOverBehavior);
  const princess = createBehavior([], PrincessGameOverBehavior);

  assert.deepEqual(king.destination, {
    lateral: 0,
    forward: -1.35,
    elevation: 0.05,
  });
  assert.deepEqual(queen.destination, {
    lateral: -1.15,
    forward: -1,
    elevation: 0.05,
  });
  assert.deepEqual(princess.destination, {
    lateral: 1.15,
    forward: -1,
    elevation: 0.05,
  });
  assert.notEqual(king.destination, king.destination);
});
