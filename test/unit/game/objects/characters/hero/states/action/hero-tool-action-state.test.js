import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroToolActionState } from "../../../../../../../../src/game/objects/characters/hero/states/action/HeroToolActionState.js";
import { HERO_ANIMATION } from "../../../../../../../../src/game/enum/HeroAnimation.js";

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
