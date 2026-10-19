import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { HERO_ACTION } from "../../../../../../src/game/enum/HeroAction.js";
import { treasureToolBackstep } from "../../../../../../src/game/config/treasure.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const start = source.indexOf("  useTool(");
const method = source.slice(start, source.indexOf("\n  /**", start));
const positioningStart = source.indexOf("  #toolPositioning(");
const positioningMethod = source.slice(positioningStart, source.indexOf("\n  /**", positioningStart));
const HeroDriver = new Function("HERO_ACTION", "treasureToolBackstep", `return class {
  #position = { x: 0, z: 0 };
  #facingYaw = 15;
  #grounded = true;
  #actionBehavior = { canStart: () => true };
  #acceptAction() { return true; }
  blocked = false;
  #canOccupyCollectionPosition() { return !this.blocked; }
  get facingYaw() { return this.#facingYaw; }
  get action() { return this.#actionBehavior.toolAction; }
  ${method}
  ${positioningMethod}
}`)(HERO_ACTION, treasureToolBackstep);

it("preserves facing for tool actions that opt out of turning", () => {
  const hero = new HeroDriver();
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: {
      x: 1,
      z: 0,
    },
    faceTarget: false,
  }), true);
  assert.equal(hero.facingYaw, 15);
  assert.equal(hero.action.phase, "summon");
});

it("keeps turning toward the target for other tool actions", () => {
  const hero = new HeroDriver();
  assert.equal(hero.useTool({ useAnimation: () => "chop" }, {
    targetPosition: {
      x: 1,
      z: 0,
    },
  }), true);
  assert.equal(hero.facingYaw, 90);
});

it("allows a small aiming correction but rejects a sideways tool target", () => {
  const hero = new HeroDriver();
  const tool = { useAnimation: () => "dig" };
  assert.equal(hero.useTool(tool, {
    targetPosition: {
      x: 1,
      z: 0,
    },
    maxFacingAdjustment: 30,
  }), false);
  assert.equal(hero.facingYaw, 15);
  assert.equal(hero.action, undefined);
  assert.equal(hero.useTool(tool, {
    targetPosition: {
      x: Math.sin(Math.PI / 6),
      z: Math.cos(Math.PI / 6),
    },
    maxFacingAdjustment: 30,
  }), true);
  assert.ok(Math.abs(hero.facingYaw - 30) < 1e-6);
});

it("plans a short backward step before using a tool on a close target", () => {
  const hero = new HeroDriver();
  const target = {
    x: Math.sin(Math.PI / 12) * 0.2,
    z: Math.cos(Math.PI / 12) * 0.2,
  };
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: target,
    minimumTargetDistance: 0.65,
    maxFacingAdjustment: 30,
  }), true);
  const step = hero.action.positioning;
  assert.ok(Math.abs(Math.hypot(step.targetX - target.x, step.targetZ - target.z) - 0.65) < 1e-6);
  assert.ok(Math.abs(Math.hypot(step.targetX, step.targetZ) - 0.45) < 1e-6);
  assert.ok(Math.abs(hero.facingYaw - 15) < 1e-6);
});

it("refuses a close tool action when the backward step is obstructed", () => {
  const hero = new HeroDriver();
  hero.blocked = true;
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: {
      x: 0,
      z: 0.2,
    },
    minimumTargetDistance: 0.65,
  }), false);
  assert.equal(hero.action, undefined);
  assert.equal(hero.facingYaw, 15);
});

it("backs straight up to aim at the nearer tile instead of turning sideways", () => {
  const hero = new HeroDriver();
  const target = {
    x: 0.3,
    z: 0.05,
  };
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: target,
    minimumTargetDistance: 0.65,
    maxFacingAdjustment: 30,
  }), true);
  const step = hero.action.positioning;
  assert.ok(step);
  assert.ok(Math.abs(step.targetX / step.targetZ - Math.tan(Math.PI / 12)) < 1e-6);
  assert.ok(Math.abs(hero.facingYaw - 15) <= 30.000001);
  assert.ok(Math.hypot(target.x - step.targetX, target.z - step.targetZ) >= 0.65 - 1e-6);
  const blockedHero = new HeroDriver();
  blockedHero.blocked = true;
  assert.equal(blockedHero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: target,
    minimumTargetDistance: 0.65,
    maxFacingAdjustment: 30,
  }), false);
  assert.equal(blockedHero.action, undefined);
});

it("can back away from the center of the tile beneath the hero", () => {
  const hero = new HeroDriver();
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: {
      x: 0,
      z: 0,
    },
    minimumTargetDistance: 0.65,
    maxFacingAdjustment: 30,
  }), true);
  assert.ok(Math.abs(Math.hypot(hero.action.positioning.targetX,
    hero.action.positioning.targetZ) - 0.65) < 1e-6);
  assert.ok(Math.abs(hero.facingYaw - 15) < 1e-6);
});
it("aligns a tool's fixed reach before starting its planted stroke", () => {
  for (const distance of [0, 0.2, 0.535, 0.8]) {
    const hero = new HeroDriver();
    const target = {
      x: Math.sin(Math.PI / 12) * distance,
      z: Math.cos(Math.PI / 12) * distance,
    };
    assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
      targetPosition: target,
      targetDistance: 0.535,
      maxFacingAdjustment: 30,
    }), true);
    const step = hero.action.positioning;
    if (distance === 0.535) {
      assert.equal(step, null);
    } else {
      assert.ok(Math.abs(Math.hypot(step.targetX - target.x, step.targetZ - target.z) - 0.535) < 1e-6);
    }
  }
  const blocked = new HeroDriver();
  blocked.blocked = true;
  assert.equal(blocked.useTool({ useAnimation: () => "dig" }, {
    targetPosition: {
      x: 0,
      z: 0.8,
    },
    targetDistance: 0.535,
  }), false);
});
