import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroBurningActionState } from "../../../../../../../src/game/objects/hero/states/action/HeroBurningActionState.js";
import { HERO_ACTION } from "../../../../../../../src/game/enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../../../src/game/enum/HeroAnimation.js";

for (const lives of [1, 2, 3]) {
  it(`owns lava entry, sinking, and death resolution with ${lives} lives`, () => {
    const state = new HeroBurningActionState();
    let height;
    let scale;
    let deaths = 0;
    let transition;
    const owner = {
      deltaTime: 0,
      enterState: () => { state.payload = { cell: { elevation: 2 } }; },
      exitState: () => { state.payload = null; },
      feedback: {
        burning: {
          lives: () => lives,
          freezeAtHeight: (value) => { height = value; },
          setHeight: (value) => { height = value; },
          setModelScale: (...value) => { scale = value; },
          modelScale: 0.65,
          syncState: () => {},
        },
        death: { resolve: () => {
          deaths += 1;
          return lives > 1 ? HERO_ACTION.RESPAWNING : HERO_ACTION.GAME_OVER;
        } },
      },
      transition: (...args) => { transition = args; },
    };
    state.enter(owner);
    assert.equal(height, 2.02);
    assert.equal(state.animationFor(owner), lives > 1
      ? HERO_ANIMATION.LAVA_FAREWELL : HERO_ANIMATION.FALL_DEATH);
    owner.deltaTime = 0.85;
    state.execute(owner);
    if (lives > 1) {
      assert.ok(height < 1.1);
      assert.deepEqual(scale, [0.65, 0.65, 0.65]);
    } else {
      assert.ok(scale[0] < 0.65);
    }
    owner.deltaTime = 0.5;
    state.execute(owner);
    assert.equal(deaths, 1);
    assert.deepEqual(scale, [0, 0, 0]);
    assert.deepEqual(transition, [
      lives > 1 ? HERO_ACTION.RESPAWNING : HERO_ACTION.GAME_OVER,
      { elapsed: 0, ashes: lives === 1 },
    ]);
    state.exit(owner);
    assert.deepEqual(scale, [0, 0, 0]);
    assert.equal(state.payload, null);
  });
}
