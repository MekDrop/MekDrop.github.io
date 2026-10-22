import assert from "node:assert/strict";
import { it } from "node:test";
import { ActorStatusEffects } from "../../../../../src/game/objects/shared/ActorStatusEffects.js";
import { FrostPuffCombat } from "../../../../../src/game/objects/enemies/frost-puff/FrostPuffCombat.js";

it("thaws after overlapping frost hits without shortening the strongest effect", () => {
  const status = new ActorStatusEffects();
  status.apply("slow", {
    duration: 3,
    factor: 0.45,
  });
  status.apply("stun", { duration: 1.4 });
  status.advance(1);
  status.apply("stun", { duration: 0.1 });
  assert.equal(status.rate, 0);
  status.advance(0.41);
  assert.equal(status.rate, 0.45);
  status.advance(1.6);
  assert.equal(status.rate, 1);
});

it("rejects invalid status durations and factors without poisoning an actor clock", () => {
  const status = new ActorStatusEffects();
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.equal(status.apply("stun", { duration }), false);
  }
  assert.equal(status.apply("slow", {
    duration: 1,
    factor: NaN,
  }), false);
  assert.equal(status.apply("burn", { duration: 1 }), false);
  status.apply("stun", { duration: 1 });
  status.advance(NaN);
  assert.equal(status.rate, 0);
  status.advance(1);
  assert.equal(status.rate, 1);
});

it("freezes friendly civilians and defenders as well as enemies, without targeting towers", () => {
  const actors = ["hero", "servant", "king", "queen", "princess", "enemy"].map((kind) => {
    const status = new ActorStatusEffects();

    return {
      kind,
      status,
      applyStatus: status.apply.bind(status),
    };
  });
  const tower = {
    isTower: true,
    applyStatus: () => assert.fail("tower was chilled"),
  };
  const owner = {
    actors: [...actors, tower],
    distanceTo: () => 1,
    hasLineOfSight: () => true,
  };
  const combat = new FrostPuffCombat(owner);
  assert.equal(combat.burst(), actors.length);
  for (const actor of actors) {
    assert.equal(actor.status.rate, 0, actor.kind);
    actor.status.advance(1.4);
    assert.equal(actor.status.rate, 1, actor.kind);
  }
});
