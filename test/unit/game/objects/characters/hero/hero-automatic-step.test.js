import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as rules from "../../../../../../src/game/objects/characters/hero/HeroSurfaceRules.js";
import { OCCUPANCY } from "../../../../../../src/game/enum/Occupancy.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const method = source.slice(source.indexOf("  #tryAutomaticStepUp("), source.indexOf("  #moveVertically()"))
  .replaceAll("#", "");
const constants = source.match(/^const (?:MIN_AUTOMATIC_STEP_HEIGHT|MAX_AUTOMATIC_STEP_HEIGHT|AUTOMATIC_STEP_SURFACE_CLEARANCE|AUTOMATIC_STEP_GROUNDING_GRACE) = .*;$/gm).join("\n");
const reachableStart = source.indexOf("  #isReachableAutomaticStepHeight(");
const reachable = source.slice(reachableStart, source.indexOf("\n  /**", reachableStart)).replaceAll("#", "");
const highestStart = source.indexOf("  static #selectHighestSurface(");
const highest = source.slice(highestStart, source.indexOf("\n  /**", highestStart)).replaceAll("#", "");
const createStepper = Function("OCCUPANCY", ...Object.keys(rules), `${constants}\nreturn class Hero { ${method} ${reachable} ${highest} };`);
const Stepper = createStepper(OCCUPANCY, ...Object.values(rules));

it("climbs narrow roof courses without probing past reachable treads", () => {
  const hero = new Stepper();
  Object.assign(hero, {
    grounded: true,
    actionBehavior: {},
    capsuleSupportOnly: true,
    position: {
      x: 0,
      y: 8,
      z: 0,
    },
    velocity: { y: 0 },
    automaticStepGroundingRemaining: 0,
    automaticStepVisualOffset: 0,
    collisionWorld: { ceilingHeightAt: () => null },
    movementSurface: { occupancyAt: () => OCCUPANCY.open },
    physics: {
      scripted: false,
      surfaceAt: (x, z, maximumHeight, minimumHeight) => {
        const height = 8 + Math.floor(x / 0.09) * 0.12;

        return height <= maximumHeight && height >= minimumHeight ? { height } : null;
      },
    },
  });
  for (let step = 0; step < 40; step += 1) {
    const previousY = hero.position.y;
    hero.tryAutomaticStepUp(hero.position.x + 0.01, 0);
    hero.position.x += 0.01;
    assert.ok(hero.position.y - previousY <= 0.335 + 1e-6);
  }
  assert.ok(hero.position.y > 8.6, "walking gains height across successive roof courses");
});

it("still refuses a riser above the normal step limit", () => {
  const hero = new Stepper();
  Object.assign(hero, {
    grounded: true,
    actionBehavior: {},
    capsuleSupportOnly: true,
    position: {
      x: 0,
      y: 8,
      z: 0,
    },
    velocity: { y: 0 },
    automaticStepGroundingRemaining: 0,
    physics: {
      scripted: false,
      surfaceAt: () => ({ height: 8.6 }),
    },
  });
  assert.equal(hero.tryAutomaticStepUp(0.01, 0), false);
  assert.equal(hero.position.y, 8);
});

it("does not repeatedly lift against a blocked stair-side destination", () => {
  const hero = new Stepper();
  Object.assign(hero, {
    grounded: true,
    actionBehavior: {},
    capsuleSupportOnly: true,
    position: {
      x: 0,
      y: 3.5,
      z: 0,
    },
    velocity: { y: 0 },
    automaticStepGroundingRemaining: 0,
    automaticStepVisualOffset: 0,
    collisionWorld: { ceilingHeightAt: () => null },
    movementSurface: {
      occupancyAt: (x, z, state) => {
        assert.ok(state.position.y > hero.position.y);

        return OCCUPANCY.blocked;
      },
    },
    physics: {
      scripted: false,
      surfaceAt: () => ({ height: 3.75 }),
    },
  });
  for (let frame = 0; frame < 120; frame++) {
    assert.equal(hero.tryAutomaticStepUp(0.02, 0), false);
    assert.equal(hero.position.y, 3.5);
    assert.equal(hero.automaticStepVisualOffset, 0);
    assert.equal(hero.automaticStepGroundingRemaining, 0);
  }
});
