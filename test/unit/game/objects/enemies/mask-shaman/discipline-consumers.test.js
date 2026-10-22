import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { MaskShaman } from "../../../../../../src/game/objects/enemies/mask-shaman/MaskShaman.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { CinderImp } from "../../../../../../src/game/objects/enemies/cinder-imp/CinderImp.js";
import { FrostPuff } from "../../../../../../src/game/objects/enemies/frost-puff/FrostPuff.js";
import { CrownCrab } from "../../../../../../src/game/objects/enemies/crown-crab/CrownCrab.js";

const fixture = () => {
  const actors = [];
  const make = (Type, id) => {
    const actor = new Type({
      pc,
      app: {},
      definition: { id },
      runtime: { objects: actors },
    });
    actors.push(actor);

    return actor;
  };
  const shaman = make(MaskShaman, "source");
  const royal = make(Enemy, "royal");
  royal.isRoyal = true;
  royal.entity.setPosition(0, 0, -2);

  return {
    actors,
    make,
    shaman,
    royal,
  };
};

test("Cinder preserves revenge through independent sources, range exit and interruption", () => {
  const { make, shaman, royal } = fixture();
  const imp = make(CinderImp, "imp");
  const rival = make(FrostPuff, "frost");
  const second = make(MaskShaman, "second");
  imp.thrower = rival;
  imp.revengeUntil = 20;
  assert.equal(imp.chooseTarget(), rival);
  shaman.update(0.86);
  second.update(0.86);
  assert.equal(imp.chooseTarget(), royal);
  shaman.onBellRung({ duration: 1 });
  assert.equal(imp.chooseTarget(), royal);
  second.entity.setPosition(10, 0, 0);
  assert.equal(imp.chooseTarget(), rival);
  assert.equal(imp.revengeUntil, 20);
  assert.equal(imp.thrower, rival);
  second.entity.setPosition(0, 0, 0);
  second.receiveDamage(999);
  assert.equal(imp.grudgesSuppressed, false);
});

test("Cinder cancels a pending steam contact and also guards continuous rival fire", () => {
  const { make, shaman } = fixture();
  const imp = make(CinderImp, "imp");
  const rival = make(FrostPuff, "frost");
  imp.canReachWithFire = () => true;
  imp.attackTarget = rival;
  imp.transition("CinderRivalAttackState");
  shaman.update(0.86);
  imp.update(0.25);
  imp.performFire(1);
  assert.equal(rival.health, 100);
  assert.equal(rival.statuses.size, 0);
  assert.equal(imp.stateName, "CinderFireRecoverState");
});

test("Frost cancels deliberate pending shots while defender shots and splash survive", () => {
  const { make, shaman } = fixture();
  const frost = make(FrostPuff, "frost");
  const imp = make(CinderImp, "imp");
  const defender = make(Enemy, "defender");
  defender.isEnemy = false;
  defender.isDefender = true;
  frost.hasLineOfSight = () => true;
  assert.equal(frost.combat.shotTarget, imp);
  frost.shotTarget = imp;
  frost.behavior.changeTo("FrostPuffCastState");
  shaman.update(0.86);
  frost.update(0.5);
  assert.equal(frost.stateName, "FrostPuffPursueState");
  assert.equal(frost.shots.size, 0);
  assert.equal(frost.combat.shotTarget, defender);
  assert.equal(frost.combat.chill(imp), true);
  assert.ok(imp.statuses.has("slow"));
  assert.ok(frost.combat.burst() > 0);
});

test("Crown cancels a winding claw, keeps anger and revenge, and resumes after range exit", () => {
  const { make, shaman, royal } = fixture();
  const crab = make(CrownCrab, "crab");
  const rival = make(CrownCrab, "rival");
  crab.revengeTarget = rival;
  crab.angerTarget = rival;
  crab.warningUntil = 7;
  crab.startClaw(rival);
  shaman.update(0.86);
  crab.update(0.65);
  assert.equal(rival.health, 100);
  assert.equal(crab.stateName, "CrownCrabPursueState");
  assert.equal(crab.pursuitTarget, royal);
  assert.equal(crab.applyClawContact(rival), false);
  assert.equal(crab.findRival(), null);
  assert.equal(crab.applyClawContact(royal), false); // Royal is outside claw reach.
  royal.entity.setPosition(0, 0, -0.8);
  assert.equal(crab.applyClawContact(royal), true);
  shaman.entity.setPosition(10, 0, 0);
  assert.equal(crab.pursuitTarget, rival);
  assert.equal(crab.angerTarget, rival);
  assert.equal(crab.warningUntil, 7);
});
