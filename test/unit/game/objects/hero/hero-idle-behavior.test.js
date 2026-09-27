import assert from "node:assert/strict";
import { it } from "node:test";
import { HERO_ANIMATION } from "../../../../../src/game/enum/HeroAnimation.js";
import { HeroIdleBehavior } from "../../../../../src/game/objects/hero/behaviors/action/HeroIdleBehavior.js";

it("uses Yuka states to alternate idle breaks and bored animations", () => {
  const behavior = new HeroIdleBehavior(() => 0.5);

  assert.equal(behavior.advance(4.9), HERO_ANIMATION.IDLE);
  assert.equal(
    behavior.advance(0.1, { hasLookTarget: true }),
    HERO_ANIMATION.BORED_CURSOR_LOOK,
  );
  assert.equal(behavior.advance(3), HERO_ANIMATION.IDLE);
  assert.equal(behavior.advance(3.49), HERO_ANIMATION.IDLE);
  assert.equal(
    behavior.advance(0.01, { hasLookTarget: true }),
    HERO_ANIMATION.BORED_LOOK,
  );
});

it("skips cursor-looking states without a cursor target and resets to idle", () => {
  const behavior = new HeroIdleBehavior(() => 0);

  assert.equal(behavior.advance(5), HERO_ANIMATION.BORED_LOOK);
  behavior.reset();
  assert.equal(behavior.animation, HERO_ANIMATION.IDLE);
  assert.equal(behavior.advance(4.99), HERO_ANIMATION.IDLE);
  assert.equal(behavior.advance(0.01), HERO_ANIMATION.BORED_STRETCH);
});
