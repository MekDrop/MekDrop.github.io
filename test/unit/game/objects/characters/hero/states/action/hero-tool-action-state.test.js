import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroToolActionState } from "../../../../../../../../src/game/objects/characters/hero/states/action/HeroToolActionState.js";
import { HERO_ANIMATION } from "../../../../../../../../src/game/enum/HeroAnimation.js";
import { Vec2 } from "playcanvas";

it("preserves authored head clearance during axe use", () => {
  const state = new HeroToolActionState();
  state.payload = { tool: { name: "axe" } };
  assert.equal(state.locksHeadForward, true);
  assert.equal(state.allowsFootPlacement, false);
  state.payload.positioning = { travel: 0.25 };
  assert.equal(state.allowsFootPlacement, true);
  delete state.payload.positioning;
  state.payload.tool.name = "shovel";
  assert.equal(state.locksHeadForward, false);
  assert.equal(state.allowsFootPlacement, true);
});

it("follows the supported approach path before starting a planted scoop", () => {
  const state = new HeroToolActionState();
  const moves = [];
  let restarts = 0;
  state.payload = {
    phase: "summon",
    positioningElapsed: 0,
    positioning: {
      startX: 0,
      startZ: 0,
      targetX: 1,
      targetZ: 1,
      context: { oppositeFill: true },
      waypoints: [new Vec2(0, 0), new Vec2(0, 1), new Vec2(1, 1)],
      lengths: [0, 1, 2],
    },
  };
  const owner = {
    deltaTime: 0.1,
    finish: () => assert.fail("the supported path should not abort"),
    feedback: {
      tool: {
        canOccupyStance: () => true,
        restartAnimation: () => {
          restarts += 1;
        },
      },
      collection: {
        positioningDuration: 0.3,
        canOccupy: () => assert.fail("use capsule clearance for the tool stance"),
        moveTo: (x, z) => moves.push([x, z]),
      },
    },
  };
  for (let frame = 0; frame < 10 && state.payload.positioning; frame += 1) {
    state.execute(owner);
  }
  assert.ok(moves.length > 3);
  assert.ok(moves.every(([x, z]) => x === 0 || z === 1), "do not cut across the corner");
  assert.deepEqual(moves[moves.length - 1], [1, 1]);
  assert.equal(state.payload.positioning, null);
  assert.equal(restarts, 1);
});

it("finishes two loaded strokes before switching to the rim leveling stroke", () => {
  const state = new HeroToolActionState();
  let impacts = 0;
  let restarts = 0;
  state.payload = {
    phase: "use",
    elapsed: 0,
    impactTimes: [1.03],
    impactIndex: 0,
    strokeDuration: 1.6,
    toolContext: { action: "fill" },
    useAnimation: HERO_ANIMATION.FILL_HOLE,
    tool: {
      useDuration: 1.6,
      impactTimes: (context) => [context.action === "level-hole" ? 2.56 : 1.03],
      strokeDurationFor: (context) => context.action === "level-hole" ? 3.2 : 1.6,
      useDurationFor: (context) => context.action === "level-hole" ? 3.2 : 1.6,
      useAnimation: (context) => context.action === "level-hole"
        ? HERO_ANIMATION.LEVEL_HOLE : HERO_ANIMATION.FILL_HOLE,
    },
    onImpact: (action) => {
      impacts += 1;
      if (impacts === 2) {
        action.toolContext.action = "level-hole";
      }
      return impacts === 3;
    },
  };
  const owner = {
    deltaTime: 0,
    feedback: {
      tool: {
        restartAnimation: () => {
          restarts += 1;
        },
      },
    },
  };
  for (let stroke = 0; stroke < 3; stroke += 1) {
    const animation = stroke < 2 ? HERO_ANIMATION.FILL_HOLE : HERO_ANIMATION.LEVEL_HOLE;
    assert.equal(state.payload.useAnimation, animation);
    if (stroke === 2) {
      owner.deltaTime = 1.7;
      state.execute(owner);
      assert.equal(impacts, 2, "raking continues beyond a short scoop's duration");
      assert.equal(state.payload.phase, "use");
    }
    owner.deltaTime = stroke === 2 ? 0.87 : 1.04;
    state.execute(owner);
    assert.equal(state.payload.useAnimation, animation, "finish the current stroke before switching clips");
    owner.deltaTime = stroke === 2 ? 0.64 : 0.57;
    state.execute(owner);
  }
  assert.equal(impacts, 3);
  assert.equal(restarts, 3);
  assert.equal(state.payload.phase, "dismiss");
});

it("stops the current short scoop even when the next stroke is a longer rake", () => {
  const state = new HeroToolActionState();
  state.payload = {
    phase: "use",
    elapsed: 1.04,
    impactTimes: [1.03],
    impactIndex: 1,
    stopAfterCycle: true,
    strokeDuration: 1.6,
    toolContext: { action: "level-hole" },
    tool: {
      useDuration: 1.6,
      strokeDurationFor: () => 3.2,
    },
  };
  state.execute({
    deltaTime: 0.57,
    feedback: { tool: { restartAnimation: () => {} } },
  });
  assert.equal(state.payload.phase, "dismiss");
});

it("repositions between vegetation strokes only after recovery completes", () => {
  const state = new HeroToolActionState();
  let cycles = 0;
  state.payload = {
    phase: "use",
    elapsed: 0.61,
    impactIndex: 1,
    toolContext: {},
    tool: {
      visible: true,
      useDuration: 1.5,
      useAnimation: () => "ChopMiddle",
    },
    onCycle: () => {
      cycles += 1;
      state.payload.positioning = { travel: 0.25 };
      state.payload.phase = "summon";

      return true;
    },
  };
  const owner = {
    deltaTime: 0.8,
    feedback: { tool: { restartAnimation: () => {} } },
  };
  state.execute(owner);
  assert.equal(cycles, 0);
  owner.deltaTime = 0.1;
  state.execute(owner);
  assert.equal(cycles, 1);
  assert.equal(state.payload.positioning.travel, 0.25);
  assert.equal(state.payload.phase, "summon");
});
