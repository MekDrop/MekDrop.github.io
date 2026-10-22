import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { HERO_STAT } from "../../../../../../src/game/enum/HeroStat.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const start = source.indexOf("  #desiredVelocity()");
const method = source.slice(start, source.indexOf("\n  /**", start)).replaceAll("#", "");
const constants = source.match(/^const (?:MOVE_SPEED|RUN_SPEED|JUMP_MOVE_SPEED|JUMP_RUN_SPEED) = .*;$/gm).join("\n");
const Driver = new Function("HERO_STAT", `${constants}\nreturn class { ${method} };`)(HERO_STAT);

/**
 * @returns {InstanceType<Driver>}
 */
function walker() {
  return Object.assign(new Driver(), {
    statusRate: 1,
    grounded: false,
    jumpsUsed: 1,
    jumpMovement: false,
    jumpBufferRemaining: 0,
    actionsLocked: false,
    angryEscapeBehavior: { active: false },
    input: {
      x: 1,
      y: 0,
    },
    buffs: { modifyStat: (stat, value) => value },
    projectInput: () => ({
      x: 1,
      z: 0,
    }),
  });
}

it("does not accelerate a walking stair descent into jump speed when contact is briefly lost", () => {
  const hero = walker();
  assert.equal(hero.desiredVelocity().x, 1.8);
  hero.running = true;
  assert.equal(hero.desiredVelocity().x, 3.4);
});

it("retains the intentional jump reach, including the launch frame before takeoff", () => {
  const hero = walker();
  hero.jumpBufferRemaining = 0.1;
  assert.equal(hero.desiredVelocity().x, 4.2);
  hero.jumpBufferRemaining = 0;
  hero.jumpMovement = true;
  assert.equal(hero.desiredVelocity().x, 4.2);
  hero.running = true;
  assert.equal(hero.desiredVelocity().x, 6.3);
});


it("scales actual hero velocity with frost while preserving buff composition", () => {
  const hero = walker();
  hero.statusRate = 0.45;
  hero.buffs.modifyStat = (stat, value) => value * 1.2;
  assert.ok(Math.abs(hero.desiredVelocity().x - 1.8 * 0.45 * 1.2) < 1e-10);
  hero.statusRate = 0;
  assert.equal(hero.desiredVelocity().x, 0);
  hero.statusRate = 1;
  assert.equal(hero.desiredVelocity().x, 1.8 * 1.2);
});
