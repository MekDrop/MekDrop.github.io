import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ACTOR_MASS } from "../../../../../../src/game/enum/ActorMass.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const start = source.indexOf("  receiveSlimeBump(");
const method = source.slice(start, source.indexOf("\n  /**", start));
const Driver = new Function("ACTOR_MASS", `return class {
  #grounded = true;
  #position = {x:0,z:0};
  #gatewayRepelCooldown = 0;
  #actionBehavior = {};
  get action() { return this.#actionBehavior; }
  set grounded(value) { this.#grounded = value; }
  ${method}
}`)(ACTOR_MASS);

test("slime bump produces a bounded quarter-second recovery step without damage", () => {
  const hero = new Driver();
  const slug = {
    position: {
      x: -0.7,
      z: 0,
    },
    alive: true,
    mass: ACTOR_MASS.LATCH_SLUG,
  };
  assert.equal(hero.receiveSlimeBump(slug, 1.4), true);
  assert.ok(hero.action.repelAction.x > 0);
  assert.ok(hero.action.repelAction.x * 4.4 * 0.25 <= 0.2);
  assert.equal(hero.action.repelAction.z, 0);
  assert.equal(hero.receiveSlimeBump(slug, 1.4), false);
});

test("gentle contact, airborne hero and busy actions do not interrupt into bump recovery", () => {
  const slug = {
    position: {
      x: -0.7,
      z: 0,
    },
    alive: true,
    mass: ACTOR_MASS.LATCH_SLUG,
  };
  const hero = new Driver();
  assert.equal(hero.receiveSlimeBump(slug, 0.1), false);
  hero.grounded = false;
  assert.equal(hero.receiveSlimeBump(slug, 1), false);
  hero.grounded = true;
  hero.action.toolAction = {};
  assert.equal(hero.receiveSlimeBump(slug, 1), false);
});
