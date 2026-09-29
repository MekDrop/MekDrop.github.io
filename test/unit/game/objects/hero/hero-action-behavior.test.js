import assert from "node:assert/strict";
import { it } from "node:test";
import { HERO_ACTION } from "../../../../../src/game/enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../src/game/enum/HeroAnimation.js";
import { RIVER_KIND } from "../../../../../src/game/enum/RiverKind.js";
import { HeroActionBehavior } from "../../../../../src/game/objects/hero/behaviors/action/HeroActionBehavior.js";

function createFeedback(overrides = {}) {
  const feedback = {
    tool: { begin: () => {}, restartAnimation: () => {}, complete: () => {} },
    collection: {
      positioningDuration: 0.2,
      fullEffectTime: 0.1,
      fullDuration: 0.2,
      canOccupy: () => true,
      moveTo: () => {},
      mountHeldItem: () => {},
      begin: () => {},
      beginInventoryFull: () => {},
      restartAnimation: () => {},
      endCollection: () => {},
      showInventoryFull: () => {},
      endInventoryFull: () => {},
    },
    dodge: { complete: () => {} },
    patReaction: { shouldContinue: () => true },
    repel: { begin: () => {}, end: () => {} },
    refusal: { beginEdge: () => {}, beginHole: () => {} },
    blockedDig: { begin: () => {} },
    drowning: { begin: (payload) => payload, endPresentation: () => {} },
    bridgeClimb: { begin: (payload) => payload },
    burning: {
      lives: () => 3,
      freezeAtHeight: () => {},
      setHeight: () => {},
      setModelScale: () => {},
      modelScale: 0.65,
      syncState: () => {},
    },
    falling: { begin: () => {}, finished: () => false },
    death: { resolve: () => HERO_ACTION.RESPAWNING },
    respawning: { begin: () => {}, resetPresentation: () => {} },
    gameOver: { begin: () => {} },
  };
  for (const [key, value] of Object.entries(overrides)) {
    feedback[key] = { ...feedback[key], ...value };
  }
  return feedback;
}

function createBehavior(options = {}) {
  return new HeroActionBehavior({
    bridgeClimbEnd: 0.6,
    dodgeAnimationDuration: 0.6,
    edgeRefusalDuration: 0.8,
    holeRefusalDuration: 1.45,
    blockedDigReactionDuration: 1.75,
    repelDuration: 0.5,
    repelSpeed: 2.2,
    feedback: createFeedback(options.feedback),
    handler: options.handler,
  });
}

it("keeps exactly one action and stores its payload on the active state", () => {
  const behavior = createBehavior();
  const toolAction = {
    tool: { summonAnimation: "summon", dismissAnimation: "dismiss" },
    phase: "summon",
    useAnimation: "use",
  };

  behavior.toolAction = toolAction;
  assert.equal(behavior.state.action, HERO_ACTION.USING_TOOL);
  assert.equal(behavior.payload, toolAction);
  assert.equal(behavior.animation, "summon");

  behavior.dodgeAction = { direction: "left", duration: 0.3 };
  assert.equal(behavior.state.action, HERO_ACTION.DODGING);
  assert.equal(behavior.toolAction, null);
  assert.equal(behavior.animation, HERO_ANIMATION.DODGE_LEFT);
  assert.equal(behavior.animationSpeed, 2);
});

it("restores the selected resting action after a committed action", () => {
  const behavior = createBehavior();
  behavior.boostingCountryFinances = true;
  assert.equal(behavior.state.action, HERO_ACTION.BOOSTING_COUNTRY_FINANCES);

  behavior.collectAction = { animation: "pick", positioning: null };
  assert.equal(behavior.state.action, HERO_ACTION.COLLECTING);
  behavior.collectAction = null;

  assert.equal(behavior.state.action, HERO_ACTION.BOOSTING_COUNTRY_FINANCES);
  assert.equal(behavior.animation, HERO_ANIMATION.IDLE);
});

it("models recovery, death, respawn, and game over as ordinary actions", () => {
  const behavior = createBehavior();
  behavior.bridgeClimbAction = { elapsed: 0.2 };
  assert.equal(behavior.state.action, HERO_ACTION.BRIDGE_CLIMB);
  assert.equal(behavior.animation, HERO_ANIMATION.BLOCKED_PUSH);
  assert.equal(behavior.incapacitated, true);
  assert.equal(behavior.dying, false);

  behavior.payload.elapsed = 0.7;
  assert.equal(behavior.animation, HERO_ANIMATION.JUMP);
  behavior.fallingToDeath = true;
  assert.equal(behavior.state.action, HERO_ACTION.FALLING_TO_DEATH);
  assert.equal(behavior.dying, true);

  behavior.respawnAction = { elapsed: 0 };
  assert.equal(behavior.animation, HERO_ANIMATION.RESPAWN);
  behavior.endGame();
  assert.equal(behavior.state.action, HERO_ACTION.GAME_OVER);
  assert.equal(behavior.animation, HERO_ANIMATION.FALL_DEATH);
});

it("runs the full tool sequence inside the tool action state", () => {
  let restarts = 0;
  let completed = 0;
  const behavior = createBehavior({
    feedback: {
      drowning: {},
      tool: {
        begin: () => {},
        restartAnimation: () => {
          restarts += 1;
        },
        complete: (action) => {
          completed += 1;
          action.onComplete?.();
        },
      },
    },
  });
  const tool = {
    summonAnimation: "summon",
    dismissAnimation: "dismiss",
    summonDuration: 0.1,
    dismissDuration: 0.1,
    impactTime: 0.05,
    useDuration: 0.1,
  };
  let impactCount = 0;
  let completionCount = 0;
  behavior.toolAction = {
    tool,
    useAnimation: "use",
    phase: "summon",
    elapsed: 0,
    impacted: false,
    stopAfterCycle: false,
    onImpact: () => {
      impactCount += 1;
      return true;
    },
    onComplete: () => {
      completionCount += 1;
    },
  };

  behavior.update(0.1);
  assert.equal(behavior.payload.phase, "use");
  behavior.update(0.05);
  behavior.update(0.05);
  assert.equal(behavior.payload.phase, "dismiss");
  behavior.update(0.1);

  assert.equal(behavior.state.action, HERO_ACTION.EXPLORING);
  assert.equal(impactCount, 1);
  assert.equal(completed, 1);
  assert.equal(completionCount, 1);
  assert.equal(restarts, 2);
});

it("completes collection from its action state and returns to rest", () => {
  let completedAction = null;
  const behavior = createBehavior({
    feedback: {
      drowning: {},
      collection: {
        positioningDuration: 0.2,
        canOccupy: () => true,
        moveTo: () => {},
        mountHeldItem: () => {},
        restartAnimation: () => {},
        begin: () => {},
        endCollection: (action) => {
          completedAction = action;
        },
      },
    },
  });
  const action = {
    animation: "pick",
    positioning: null,
    elapsed: 0,
    impactTime: 0.05,
    impacted: false,
    heldItem: null,
    heldItemHideTime: null,
    duration: 0.1,
    onImpact: () => true,
  };
  behavior.collectAction = action;

  behavior.update(0.1);

  assert.equal(behavior.state.action, HERO_ACTION.EXPLORING);
  assert.equal(completedAction, action);
});

it("lets the drowning state decide whether water or lava feedback begins", () => {
  const routeEntry = {
    river: { kind: RIVER_KIND.WATER },
    cell: { elevation: 0, underBridge: false },
  };
  const feedback = {
    drowning: {
      lavaEntryClearance: 0.12,
      waterEntryClearance: 0.32,
      situation: () => ({
        grounded: false,
        fallingToDeath: false,
        respawning: false,
        verticalVelocity: -1,
        position: { x: 0, y: 0.1, z: 0 },
      }),
      hasRiverSourceCover: () => false,
      routeEntryAt: () => routeEntry,
      begin: () => ({ kind: "water" }),
    },
  };
  const behavior = createBehavior({ feedback });

  assert.equal(behavior.tryBeginDrowning(), true);
  assert.equal(behavior.state.action, HERO_ACTION.DROWNING);
  assert.deepEqual(behavior.payload, { kind: "water" });

  behavior.finish();
  routeEntry.river.kind = RIVER_KIND.LAVA;
  assert.equal(behavior.tryBeginDrowning(), true);
  assert.equal(behavior.state.action, HERO_ACTION.BURNING);
  assert.deepEqual(behavior.payload, {
    elapsed: 0, surfaceY: 0.02, farewell: true, ashes: false,
  });
});

it("dispatches updates only through the current action state", () => {
  const updates = [];
  const behavior = createBehavior({
    handler: {
      update: (state, action, deltaTime) => {
        updates.push([state.action, action.payload, deltaTime]);
      },
    },
  });
  behavior.angryEscape = true;
  const payload = behavior.payload;
  behavior.update(0.25);

  assert.deepEqual(updates, [[HERO_ACTION.ANGRY_ESCAPE, payload, 0.25]]);
});

it("centralizes action admission on the active and target states", () => {
  const behavior = createBehavior();
  assert.equal(
    behavior.canStart(HERO_ACTION.DODGING, { grounded: true }),
    true,
  );
  assert.equal(
    behavior.canStart(HERO_ACTION.DODGING, { grounded: false }),
    false,
  );

  behavior.dodgeAction = {
    direction: "left",
    x: 1,
    z: 0,
    speed: 4,
    facing: { x: 0, z: 1 },
    duration: 0.5,
  };
  assert.equal(
    behavior.canStart(HERO_ACTION.USING_TOOL, { grounded: true }),
    true,
  );
  assert.equal(
    behavior.canStart(HERO_ACTION.COLLECTING, { grounded: true }),
    false,
  );

  behavior.toolAction = {
    tool: { summonAnimation: "summon", dismissAnimation: "dismiss" },
    phase: "summon",
    useAnimation: "use",
  };
  assert.equal(
    behavior.canStart(HERO_ACTION.DODGING, { grounded: true }),
    false,
  );
  assert(!behavior.canJump);
});

it("derives movement and facing policy from the active action state", () => {
  const behavior = createBehavior();
  behavior.dodgeAction = {
    direction: "left",
    x: 1,
    z: -0.5,
    speed: 4,
    facing: { x: 0, z: 1 },
    duration: 0.5,
  };

  assert.deepEqual(
    behavior.movementFor({ x: 9, z: 9 }, { x: 2, z: 3 }),
    { x: 4, z: -2 },
  );
  assert.deepEqual(
    behavior.facingFor({ x: 1, z: 0 }),
    { x: 0, z: 1 },
  );
  assert.equal(behavior.snapsFacing, true);
  assert.equal(behavior.allowsFootPlacement, false);

  behavior.repelAction = { x: -1, z: 0.5, elapsed: 0 };
  assert.deepEqual(
    behavior.movementFor({ x: 9, z: 9 }, { x: 2, z: 3 }),
    { x: -2.2, z: 1.1 },
  );
  assert(behavior.locksFacing);
});

it("lets action states drive and clean up their presentation", () => {
  const presentations = [];
  const resets = [];
  const behavior = createBehavior({
    feedback: {
      drowning: {
        updatePresentation: (pose) => presentations.push(["drowning", pose]),
        endPresentation: () => resets.push("drowning"),
      },
      bridgeClimb: {
        duration: 1.15,
        catchEnd: 0.25,
        climbEnd: 0.75,
        updatePresentation: (pose) => presentations.push(["bridge", pose]),
        resetPresentation: () => resets.push("bridge"),
      },
      respawning: {
        duration: 1.55,
        updatePresentation: (progress, elapsed) =>
          presentations.push(["respawn", { progress, elapsed }]),
        resetPresentation: () => resets.push("respawn"),
      },
    },
  });

  behavior.drowningAction = { elapsed: 0.4 };
  behavior.present(0.016);
  behavior.finish();
  behavior.bridgeClimbAction = { elapsed: 0.4 };
  behavior.present(0.016);
  behavior.fallingToDeath = true;
  behavior.respawnAction = { elapsed: 0.31 };
  behavior.present(0.016);
  behavior.finish();

  assert.deepEqual(presentations.map(([kind]) => kind), [
    "drowning",
    "bridge",
    "respawn",
  ]);
  assert.deepEqual(resets, ["drowning", "bridge", "respawn"]);
  assert(Math.abs(presentations[2][1].progress - 0.2) < Number.EPSILON);
});

it("owns refusal, repulsion, death, and recovery lifecycle effects", () => {
  const events = [];
  let fallFinished = false;
  const behavior = createBehavior({
    feedback: {
      refusal: {
        beginEdge: () => events.push("edge-enter"),
        beginHole: () => events.push("hole-enter"),
      },
      repel: {
        begin: () => events.push("repel-enter"),
        end: () => events.push("repel-exit"),
      },
      falling: {
        begin: () => events.push("fall-enter"),
        finished: () => fallFinished,
      },
      death: {
        resolve: () => {
          events.push("death-resolved");
          return HERO_ACTION.RESPAWNING;
        },
      },
      respawning: {
        begin: () => events.push("respawn-enter"),
      },
      gameOver: {
        begin: () => events.push("game-over-enter"),
      },
    },
  });

  behavior.edgeRefusalAction = {
    foot: "right",
    direction: { x: 1, z: 0 },
    elapsed: 0,
  };
  behavior.holeRefusalAction = {
    direction: { x: 1, z: 0 },
    elapsed: 0,
  };
  behavior.repelAction = { x: -1, z: 0, elapsed: 0 };
  behavior.finish();
  behavior.fallingToDeath = true;
  behavior.update(0.1);
  assert.equal(behavior.fallingToDeath, true);
  fallFinished = true;
  behavior.update(0.1);
  assert.equal(behavior.respawning, true);
  behavior.endGame();

  assert.deepEqual(events, [
    "edge-enter",
    "hole-enter",
    "repel-enter",
    "repel-exit",
    "fall-enter",
    "death-resolved",
    "respawn-enter",
    "game-over-enter",
  ]);
});
