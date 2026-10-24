import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec2 } from "playcanvas";
import { HERO_ACTION } from "../../../../../../src/game/enum/HeroAction.js";
import { treasureToolBackstep } from "../../../../../../src/game/config/treasure.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const start = source.indexOf("  useTool(");
const method = source.slice(start, source.indexOf("\n  /**", start));
const positioningStart = source.indexOf("  #toolPositioning(");
const positioningMethod = source.slice(positioningStart, source.indexOf("\n  /**", positioningStart));
const repositioningStart = source.indexOf("  repositionTool(");
const repositioningMethod = source.slice(repositioningStart, source.indexOf("\n  /**", repositioningStart));
const HeroDriver = new Function("HERO_ACTION", "treasureToolBackstep", "Vec2", "MOVEMENT_COLLISION_RADIUS", `return class Hero {
  static #compareToolPositions(a, b) { return a.travel - b.travel; }
  #position = { x: 0, z: 0 };
  #facingYaw = 15;
  #grounded = true;
  #actionBehavior = { canStart: () => true };
  #acceptAction() { return true; }
  blocked = false;
  safePosition = () => true;
  safePath = () => true;
  #surfaceState = {};
  #movementSurface = { canEscapeAcross: (from, to) => !this.blocked && this.safePosition(to) && this.safePath(from, to) };
  #canOccupyCollectionPosition() { return !this.blocked; }
  get facingYaw() { return this.#facingYaw; }
  get action() { return this.#actionBehavior.toolAction; }
  ${method}
  ${positioningMethod}
  ${repositioningMethod}
}`)(HERO_ACTION, treasureToolBackstep, Vec2, 0.18);

it("fills from an occupied stance beside a hole without sweeping into its collision", () => {
  for (const action of ["fill", "level-hole"]) {
    const hero = new HeroDriver();
    hero.blocked = true;
    const animation = action === "fill" ? "FillHole" : "LevelHole";
    assert.equal(hero.useTool({ useAnimation: () => animation }, {
      targetPosition: {
        x: 0,
        z: 0.535,
      },
      minimumTargetDistance: 0.535,
      targetDistance: 0.535,
      context: { action },
    }), true);
    assert.equal(hero.action.positioning, null);
    assert.equal(hero.action.useAnimation, animation);
  }
});

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

it("moves to the nearest safe side when the direct digging correction is blocked", () => {
  const hero = new HeroDriver();
  hero.safePosition = (position) => position.x >= 0.15;
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: {
      x: 0,
      z: 0.2,
    },
    targetDistance: 0.535,
    maxFacingAdjustment: 30,
  }), true);
  const step = hero.action.positioning;
  assert.ok(step.targetX >= 0.15 && step.targetX < 0.16);
  assert.ok(Math.abs(Math.hypot(step.targetX, step.targetZ - 0.2) - 0.535) < 1e-6);
});

it("checks support even when already at digging reach", () => {
  const hero = new HeroDriver();
  hero.blocked = true;
  assert.equal(hero.useTool({ useAnimation: () => "dig" }, {
    targetPosition: {
      x: 0,
      z: 0.535,
    },
    targetDistance: 0.535,
  }), false);
  assert.equal(hero.action, undefined);
});

it("aligns filling with a calibrated pile stance for oblique approaches", () => {
  for (let index = 0; index < 16; index += 1) {
    const angle = index * Math.PI / 8;
    const hero = new HeroDriver();
    const target = {
      x: Math.sin(angle) * 0.535,
      z: Math.cos(angle) * 0.535,
    };
    assert.equal(hero.useTool({ useAnimation: (context) => context.oppositeFill ? "reverse" : "normal" }, {
      targetPosition: target,
      targetDistance: 0.535,
      context: { action: "fill" },
      stances: [
        {
          yaw: 0,
          context: { oppositeFill: false },
        },
        {
          yaw: Math.PI,
          context: { oppositeFill: true },
        },
      ],
    }), true);
    const step = hero.action.positioning;
    const x = step?.targetX ?? 0;
    const z = step?.targetZ ?? 0;
    assert.ok(Math.abs(x - target.x) < 1e-6);
    assert.ok(Math.abs(Math.abs(z - target.z) - 0.535) < 1e-6);
    assert.equal(hero.action.useAnimation, z > target.z ? "reverse" : "normal",
      "select the clip after the stance is chosen");
  }
});

it("walks around the hole when a direct approach crosses the cavity", () => {
  const hero = new HeroDriver();
  const target = {
    x: 0.535,
    z: 0,
  };
  hero.safePath = (from, to) => Math.hypot(to.x - from.x, to.z - from.z) < 0.06;
  const options = {
    targetPosition: target,
    targetDistance: 0.535,
    context: { action: "fill" },
    stances: [{
      yaw: 0,
      context: { oppositeFill: false },
    }],
  };
  assert.equal(hero.useTool({ useAnimation: () => "fill" }, options), true);
  const points = hero.action.positioning.waypoints;
  assert.ok(points.length > 10, "take short supported steps along the rim");
  for (const point of points) {
    assert.ok(Math.abs(Math.hypot(point.x - target.x, point.y - target.z) - 0.535) < 1e-6);
  }
  hero.blocked = true;
  assert.equal(hero.useTool({ useAnimation: () => "fill" }, options), false,
    "an obstructed approach cannot start a scoop from the wrong stance");
});

it("can walk across a wide plant between strokes while still rejecting blocked paths", () => {
  const hero = new HeroDriver();
  const tool = { useAnimation: () => "axe" };
  const stances = [{
    yaw: 0,
    context: {},
  }];
  assert.equal(hero.useTool(tool, {
    targetPosition: {
      x: 0,
      z: 1,
    },
    targetDistance: 1,
    stances,
  }), true);
  assert.equal(hero.repositionTool({
    x: 1.25,
    y: 0,
    z: 1,
  }, 1, stances), true);
  assert.equal(hero.action.positioning.travel, 1.25);
  hero.blocked = true;
  assert.equal(hero.repositionTool({
    x: 1.25,
    y: 0,
    z: 1,
  }, 1, stances), false);
  hero.blocked = false;
  assert.equal(hero.repositionTool({
    x: 2,
    y: 0,
    z: 1,
  }, 1, stances), false);
});