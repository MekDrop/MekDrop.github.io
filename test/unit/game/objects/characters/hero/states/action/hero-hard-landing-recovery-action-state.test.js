import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroActionBehavior } from "../../../../../../../../src/game/objects/characters/hero/behaviors/action/HeroActionBehavior.js";
import { HERO_ACTION } from "../../../../../../../../src/game/enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../../../../src/game/enum/HeroAnimation.js";
import { HeroHardLandingRecoveryActionState } from "../../../../../../../../src/game/objects/characters/hero/states/action/HeroHardLandingRecoveryActionState.js";

it("ignores normal jump and dodge landings but reacts to real drops and jumps onto much lower ground", () => {
  for (const landingHeight of [2.05, 2, 1.9, 1.2]) {
    assert.equal(HeroHardLandingRecoveryActionState.shouldReactToLanding({
      jumping: true,
      landingHeight,
      launchHeight: 2,
    }), false);
  }
  assert.equal(HeroHardLandingRecoveryActionState.shouldReactToLanding({
    jumping: true,
    landingHeight: 0.5,
    launchHeight: 2,
  }), true);
  assert.equal(HeroHardLandingRecoveryActionState.shouldReactToLanding({
    jumping: false,
    landingHeight: 0.5,
    launchHeight: 0.6,
  }), true);
});

function fixture() {
  const events = [];
  const support = {
    grounded: true,
    stable: true,
  };
  const behavior = new HeroActionBehavior({
    bridgeClimbEnd: 0.6,
    dodgeAnimationDuration: 0.6,
    edgeRefusalDuration: 0.8,
    holeRefusalDuration: 1.45,
    blockedDigReactionDuration: 1.75,
    repelDuration: 0.5,
    repelSpeed: 2.2,
    feedback: {
      landingRecovery: {
        duration: 2.8,
        grounded: () => support.grounded,
        stableGrounded: () => support.grounded && support.stable,
        begin: () => events.push("begin"),
        end: () => events.push("end"),
      },
      actionComplete: (action) => events.push(action),
      falling: {
        begin: () => events.push("falling"),
        finished: () => false,
      },
      drowning: {
        begin: (payload) => payload,
        endPresentation: () => {},
      },
      respawning: {
        begin: () => {},
        resetPresentation: () => {},
      },
      tool: {
        begin: () => events.push("tool-begin"),
        complete: () => events.push("tool-end"),
      },
      gameOver: { begin: () => {} },
    },
  });

  return {
    behavior,
    events,
    support,
  };
}

it("plays a finite hard-landing recovery while blocking movement, jumping, and new tools", () => {
  const { behavior, events } = fixture();
  assert.equal(behavior.beginHardLandingRecovery({
    speed: 5,
    drop: 1.5,
  }), true);
  assert.equal(behavior.recoveringFromLanding, true);
  assert.equal(behavior.animation, HERO_ANIMATION.HARD_LANDING_RECOVERY);
  assert.equal(behavior.exclusive, false);
  assert.equal(behavior.canJump, false);
  assert.equal(behavior.canStart(HERO_ACTION.USING_TOOL, { grounded: true }), false);
  assert.equal(behavior.canStart(HERO_ACTION.DODGING, { grounded: true }), false);
  assert.deepEqual(behavior.movementFor({
    x: 3,
    z: 4,
  }, {
    x: 1,
    y: 0,
    z: 1,
  }), {
    x: 0,
    z: 0,
  });
  assert.equal(behavior.locksFacing, true);
  assert.equal(behavior.allowsFootPlacement, false);
  assert.equal(behavior.allowsIdleHeadLook, false);
  behavior.update(2.79);
  assert.equal(behavior.recoveringFromLanding, true);
  behavior.update(0.02);
  assert.equal(behavior.state.action, HERO_ACTION.EXPLORING);
  assert.equal(behavior.canJump, true);
  assert.deepEqual(events, ["begin", "end", HERO_ACTION.HARD_LANDING_RECOVERY]);
});

it("interrupts an active hammer action with normal tool cleanup and cannot restart itself", () => {
  const { behavior, events } = fixture();
  behavior.toolAction = {
    tool: {
      name: "hammer",
      summonAnimation: "summon",
    },
    phase: "summon",
  };
  assert.equal(behavior.beginHardLandingRecovery({
    speed: 6,
    drop: 2,
  }), true);
  assert.equal(behavior.toolAction, null);
  behavior.update(0.5);
  assert.equal(behavior.beginHardLandingRecovery({
    speed: 7,
    drop: 2,
  }), false);
  assert.equal(behavior.payload.elapsed, 0.5);
  assert.deepEqual(events, ["tool-begin", "tool-end", "begin"]);
});

it("cancels recovery when the landing surface moves away", () => {
  const { behavior, events, support } = fixture();
  behavior.beginHardLandingRecovery({
    speed: 5,
    drop: 1.2,
  });
  support.grounded = false;
  behavior.update(0.01);
  assert.equal(behavior.state.action, HERO_ACTION.EXPLORING);
  assert.deepEqual(events, ["begin", "end"]);
  assert.equal(behavior.beginHardLandingRecovery({
    speed: 5,
    drop: 1.2,
  }), false);
});

it("allows hazards to interrupt recovery and never replaces drowning, death, respawn, or game over", () => {
  const { behavior, events } = fixture();
  const impact = {
    speed: 5,
    drop: 1.2,
  };
  behavior.beginHardLandingRecovery(impact);
  behavior.fallingToDeath = true;
  assert.deepEqual(events, ["begin", "end", "falling"]);
  assert.equal(behavior.beginHardLandingRecovery(impact), false);
  behavior.drowningAction = {};
  assert.equal(behavior.beginHardLandingRecovery(impact), false);
  behavior.respawnAction = { elapsed: 0 };
  assert.equal(behavior.beginHardLandingRecovery(impact), false);
  behavior.endGame();
  assert.equal(behavior.beginHardLandingRecovery(impact), false);
});

it("identifies only a grounded rider for the collapse-event queue, excluding banks and jumps", () => {
  const situation = {
    position: {
      x: -0.5,
      y: 2.1,
      z: 0,
    },
    grounded: true,
    jumping: false,
    cells: [{
      col: 3,
      row: 3,
    }, {
      col: 3,
      row: 4,
    }],
    elevation: 2,
    cols: 8,
    rows: 8,
  };
  assert.equal(HeroHardLandingRecoveryActionState.isStandingOnCollapsingBridge(situation), true);
  assert.equal(HeroHardLandingRecoveryActionState.isStandingOnCollapsingBridge({
    ...situation,
    jumping: true,
  }), false);
  assert.equal(HeroHardLandingRecoveryActionState.isStandingOnCollapsingBridge({
    ...situation,
    grounded: false,
  }), false);
  assert.equal(HeroHardLandingRecoveryActionState.isStandingOnCollapsingBridge({
    ...situation,
    position: {
      x: -1.5,
      y: 2.1,
      z: 0,
    },
  }), false);
  assert.equal(HeroHardLandingRecoveryActionState.isStandingOnCollapsingBridge({
    ...situation,
    position: {
      ...situation.position,
      y: 0.1,
    },
  }), false);
});

it("starts queued collapse recovery after contact disappears, holds seated until stable ground, then stands", () => {
  const { behavior, events, support } = fixture();
  // Event handler admits the rider before the deck is released. By the next
  // action update, the ray may briefly lose contact with the moving section.
  support.grounded = false;
  support.stable = false;
  assert.equal(behavior.beginHardLandingRecovery({
    speed: 0,
    drop: 0,
    bridgeCollapse: true,
  }), true);
  assert.equal(behavior.payload.bridgeCollapse, true);
  assert.equal(behavior.landingRecoveryElapsed, 0);
  behavior.update(0.2);
  assert.equal(behavior.landingRecoveryElapsed, 0.2);
  behavior.update(0.2);
  assert.equal(behavior.landingRecoveryElapsed, 0.35);
  behavior.update(1);
  assert.equal(behavior.landingRecoveryElapsed, 0.35);
  support.grounded = true;
  behavior.update(1);
  assert.equal(behavior.landingRecoveryElapsed, 0.35);
  assert.equal(behavior.recoveringFromLanding, true);
  support.stable = true;
  behavior.update(0.1);
  assert.ok(Math.abs(behavior.landingRecoveryElapsed - 0.7) < 0.000001);
  behavior.update(2.09);
  assert.ok(Math.abs(behavior.landingRecoveryElapsed - 2.79) < 0.000001);
  behavior.update(0.02);
  assert.equal(behavior.state.action, HERO_ACTION.EXPLORING);
  assert.equal(behavior.landingRecoveryElapsed, null);
  assert.deepEqual(events, ["begin", "end", HERO_ACTION.HARD_LANDING_RECOVERY]);
});

it("returns to the seated hold if footing disappears during bridge get-up and still allows death", () => {
  const { behavior, events, support } = fixture();
  behavior.beginHardLandingRecovery({
    speed: 0,
    drop: 0,
    bridgeCollapse: true,
  });
  behavior.update(0.4);
  behavior.update(0.1);
  assert.ok(behavior.landingRecoveryElapsed > 0.6);
  support.grounded = false;
  behavior.update(0.1);
  assert.equal(behavior.landingRecoveryElapsed, 0.35);
  assert.equal(behavior.recoveringFromLanding, true);
  behavior.fallingToDeath = true;
  assert.equal(behavior.recoveringFromLanding, false);
  assert.deepEqual(events, ["begin", "end", "falling"]);
});
