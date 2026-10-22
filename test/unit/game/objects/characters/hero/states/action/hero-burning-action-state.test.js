import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroBurningActionState } from "../../../../../../../../src/game/objects/characters/hero/states/action/HeroBurningActionState.js";
import { HERO_ACTION } from "../../../../../../../../src/game/enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../../../../src/game/enum/HeroAnimation.js";

for (const lives of [1, 2, 3]) {
  it(`owns lava entry, sinking, and death resolution with ${lives} lives`, () => {
    const state = new HeroBurningActionState();
    let height;
    let scale;
    let deaths = 0;
    let transition;
    const owner = {
      deltaTime: 0,
      enterState: () => {
        state.payload = { cell: { elevation: 2 } };
      },
      exitState: () => {
        state.payload = null;
      },
      feedback: {
        burning: {
          lives: () => lives,
          freezeAtHeight: (value) => {
            height = value;
          },
          setHeight: (value) => {
            height = value;
          },
          setModelScale: (...value) => {
            scale = value;
          },
          modelScale: 0.65,
          syncState: () => {},
        },
        death: {
          resolve: () => {
            deaths += 1;

            return lives > 1 ? HERO_ACTION.RESPAWNING : HERO_ACTION.GAME_OVER;
          },
        },
      },
      transition: (...args) => {
        transition = args;
      },
    };
    state.enter(owner);
    assert.equal(height, 2.02);
    assert.equal(state.animationFor(owner), lives > 1
      ? HERO_ANIMATION.LAVA_FAREWELL : HERO_ANIMATION.FALL_DEATH);
    const duration = lives > 1 ? 4.2 : 1.35;
    owner.deltaTime = 0.15;
    state.execute(owner);
    if (lives > 1) {
      assert.equal(height, 2.02, "hold above lava while raising the thumb");
      assert.deepEqual(scale, [0.65, 0.65, 0.65]);
    }
    owner.deltaTime = duration * 0.7 - 0.15;
    state.execute(owner);
    if (lives > 1) {
      assert.ok(height < 1.3);
      assert.deepEqual(scale, [0.65, 0.65, 0.65]);
      const handOnlyHeight = height;
      owner.deltaTime = 0.2;
      state.execute(owner);
      assert.equal(height, handOnlyHeight, "pause with only the hand above lava");
    } else {
      assert.ok(scale[0] < 0.65);
    }
    assert.equal(deaths, 0);
    owner.deltaTime = duration;
    state.execute(owner);
    assert.equal(deaths, 1);
    assert.deepEqual(scale, [0, 0, 0]);
    assert.deepEqual(transition, [
      lives > 1 ? HERO_ACTION.RESPAWNING : HERO_ACTION.GAME_OVER,
      {
        elapsed: 0,
        ashes: lives === 1,
      },
    ]);
    state.exit(owner);
    assert.deepEqual(scale, [0, 0, 0]);
    assert.equal(state.payload, null);
  });
}
