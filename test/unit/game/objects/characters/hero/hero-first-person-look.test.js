import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const extract = (name) => {
  const start = source.indexOf(`  set ${name}(`);

  return source.slice(start, source.indexOf("\n  }", start) + 4);
};
const HeroDriver = new Function(`return class Hero {
  #firstPersonCameraEnabled = true;
  #climbMotion = null;
  set climbing(value) { this.#climbMotion = value ? {} : null; }
  #facingYaw = 45;
  #headLookYaw = 80;
  #respawnEffect = null;
  #onFacingChange = null;
  #modelRoot = { setLocalEulerAngles: (x, y, z) => { this.body = [x, y, z]; } };
  #headEntity = { setLocalEulerAngles: (x, y, z) => { this.head = [x, y, z]; } };
  #syncFirstPersonPresentation() { this.synced = true; }
  get facingDirection() { return {x: Math.sin(this.#facingYaw * Math.PI / 180),z: Math.cos(this.#facingYaw * Math.PI / 180)}; }
  ${extract("firstPersonFacingYaw")}
  ${extract("firstPersonLook")}
}`)();

it("reapplies rendered body yaw after animation even when the logical facing has not changed", () => {
  const hero = new HeroDriver();
  hero.body = [0, -30, 0];
  hero.firstPersonLook = {
    yaw: 45,
    pitch: 20,
  };
  assert.deepEqual(hero.body, [0, 45, 0]);
  assert.deepEqual(hero.head, [-20, 0, 0]);
  assert.equal(hero.synced, true);
});

it("turns the body across reversals and yaw seams without sideways neck rotation", () => {
  const hero = new HeroDriver();
  for (const yaw of [5, -5, 179, -179, 90, -90]) {
    hero.firstPersonLook = {
      yaw,
      pitch: -40,
    };
    assert.deepEqual(hero.body, [0, yaw, 0]);
    assert.deepEqual(hero.head, [40, 0, 0]);
  }
});

it("keeps the body facing the ladder during first-person mouse look", () => {
  const hero = new HeroDriver();
  hero.body = [0, 45, 0];
  hero.climbing = true;
  hero.firstPersonLook = {
    yaw: 135,
    pitch: 30,
  };
  assert.deepEqual(hero.body, [0, 45, 0]);
  assert.equal(hero.synced, true);
  hero.climbing = false;
  hero.firstPersonFacingYaw = 135;
  assert.deepEqual(hero.body, [0, 135, 0]);
});
