import assert from "node:assert/strict";
import { it } from "node:test";
import { BuffSystem } from "../../src/game/buffs/BuffSystem.js";
import { HERO_BUFF } from "../../src/game/enum/HeroBuff.js";
import { HERO_STAT } from "../../src/game/enum/HeroStat.js";
import { BUFF_KIND } from "../../src/game/enum/BuffKind.js";

it("stacks an effect to its cap, refreshes its timer, then expires all stacks together", () => {
  const buffs = new BuffSystem();
  buffs.apply(HERO_BUFF.AFFECTION, { stacks: 3 });
  assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 10), 11.5);
  buffs.advance(5);
  buffs.apply(HERO_BUFF.AFFECTION, { stacks: 8 });
  assert.equal(buffs.get(HERO_BUFF.AFFECTION).stacks, 5);
  assert.equal(buffs.remaining(HERO_BUFF.AFFECTION), 6);
  assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 10), 12.5);
  const revision = buffs.revision;
  buffs.advance(6);
  assert.equal(buffs.revision, revision + 1);
  assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 10), 10);
  assert.deepEqual(buffs.state, []);
});

it("combines independent flat and percentage buffs and debuffs regardless of application order", () => {
  const definitions = [
    { id: "boots", kind: BUFF_KIND.BUFF, duration: 5, maxStacks: 1,
      modifiers: { [HERO_STAT.MOVEMENT_SPEED]: { flat: 2 } } },
    { id: "haste", kind: BUFF_KIND.BUFF, duration: 3, maxStacks: 2,
      modifiers: { [HERO_STAT.MOVEMENT_SPEED]: { percent: 0.1 } } },
    { id: "mud", kind: BUFF_KIND.DEBUFF, duration: 2, maxStacks: 1,
      modifiers: { [HERO_STAT.MOVEMENT_SPEED]: { percent: -0.3 } } },
  ];
  for (const order of [["boots", "haste", "mud"], ["mud", "haste", "boots"]]) {
    const buffs = new BuffSystem(definitions);
    for (const id of order) {
      buffs.apply(id);
    }
    assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 8), 8);
    assert.equal(buffs.modifyStat("unmodifiedStat", 50), 50);
    buffs.advance(2);
    assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 8), 11);
    buffs.advance(1);
    assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 8), 10);
    buffs.remove("boots");
    assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 8), 8);
  }
});

it("overstimulation replaces affection and blocks it until anger expires", () => {
  const buffs = new BuffSystem();
  buffs.apply(HERO_BUFF.AFFECTION);
  buffs.apply(HERO_BUFF.OVERSTIMULATED);
  assert.equal(buffs.has(HERO_BUFF.AFFECTION), false);
  assert.equal(buffs.get(HERO_BUFF.OVERSTIMULATED).kind, BUFF_KIND.DEBUFF);
  assert.equal(buffs.apply(HERO_BUFF.AFFECTION), false);
  buffs.advance(4);
  assert.equal(buffs.apply(HERO_BUFF.AFFECTION), false);
  assert.equal(buffs.remaining(HERO_BUFF.OVERSTIMULATED), 4);
  buffs.advance(4);
  assert.equal(buffs.apply(HERO_BUFF.AFFECTION), true);
  assert.equal(buffs.get(HERO_BUFF.AFFECTION).stacks, 1);
});

it("rest-dependent effects pause during activity while ordinary effects keep expiring", () => {
  const buffs = new BuffSystem([
    { id: "anger", duration: 12, maxStacks: 1, requiresRest: true, modifiers: {} },
    { id: "haste", duration: 6, maxStacks: 1, modifiers: {} },
  ]);
  buffs.apply("anger");
  buffs.apply("haste");
  buffs.advance(20, { resting: false });
  assert.equal(buffs.remaining("anger"), 12);
  assert.equal(buffs.has("haste"), false);
  buffs.advance(3, { resting: true });
  assert.equal(buffs.remaining("anger"), 9);
  buffs.advance(10, { resting: false });
  assert.equal(buffs.remaining("anger"), 9);
  buffs.advance(9, { resting: true });
  assert.equal(buffs.has("anger"), false);
});

it("removing or clearing effects restores stats without permanently changing base values", () => {
  const buffs = new BuffSystem();
  buffs.apply(HERO_BUFF.AFFECTION, { stacks: 5 });
  assert.equal(buffs.remove(HERO_BUFF.AFFECTION), true);
  assert.equal(buffs.remove(HERO_BUFF.AFFECTION), false);
  assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 4.2), 4.2);
  buffs.apply(HERO_BUFF.OVERSTIMULATED);
  buffs.clear();
  assert.deepEqual(buffs.state, []);
  assert.equal(buffs.apply(HERO_BUFF.AFFECTION), true);
  assert.equal(buffs.get(HERO_BUFF.AFFECTION).stacks, 1);
});

it("does not leak mutable effects or registry definitions to callers", () => {
  const definitions = [{ id: "test", duration: 6, maxStacks: 2,
    modifiers: { [HERO_STAT.MOVEMENT_SPEED]: { percent: 0.1 } } }];
  const buffs = new BuffSystem(definitions);
  definitions[0].duration = 999;
  definitions[0].modifiers[HERO_STAT.MOVEMENT_SPEED].percent = 50;
  buffs.apply("test");
  const snapshot = buffs.state;
  snapshot[0].remaining = 999;
  snapshot[0].stacks = 500;
  snapshot[0].modifiers[HERO_STAT.MOVEMENT_SPEED].percent = 90;
  assert.equal(buffs.remaining("test"), 6);
  assert.equal(buffs.get("test").stacks, 1);
  assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 10), 11);
});

it("rejects unknown effects and invalid stacks and ignores invalid time steps", () => {
  const buffs = new BuffSystem();
  assert.equal(buffs.apply("unknown"), false);
  for (const stacks of [-1, 0, 0.5, NaN, Infinity]) {
    assert.equal(buffs.apply(HERO_BUFF.AFFECTION, { stacks }), false);
  }
  assert.deepEqual(buffs.state, []);
  buffs.apply(HERO_BUFF.AFFECTION);
  for (const deltaTime of [-1, 0, NaN, Infinity]) {
    buffs.advance(deltaTime);
  }
  assert.equal(buffs.remaining(HERO_BUFF.AFFECTION), 6);
});

it("expires effects consistently across fixed steps and a single large time step", () => {
  const buffs = new BuffSystem();
  buffs.apply(HERO_BUFF.AFFECTION);
  for (let frame = 0; frame < 720; frame += 1) {
    buffs.advance(1 / 120);
  }
  assert.deepEqual(buffs.state, []);
  buffs.apply(HERO_BUFF.AFFECTION);
  buffs.advance(20);
  assert.deepEqual(buffs.state, []);
});
