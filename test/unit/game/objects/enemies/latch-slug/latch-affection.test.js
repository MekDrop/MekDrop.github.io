import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchAffection } from "../../../../../../src/game/objects/enemies/latch-slug/LatchAffection.js";
import { BuffSystem } from "../../../../../../src/game/buffs/BuffSystem.js";
import { HERO_BUFF } from "../../../../../../src/game/enum/HeroBuff.js";
import { HERO_STAT } from "../../../../../../src/game/enum/HeroStat.js";

function fixture() {
  const buffs = new BuffSystem();
  const hero = {
    entity: new pc.Entity(),
    alive: true,
    applyBuff: buffs.apply.bind(buffs),
  };
  hero.entity.setPosition(.9, 0, 0);
  const owner = {
    alive: true,
    entity: new pc.Entity(),
    position: new pc.Vec3(),
    stateName: "LatchDogState",
    statuses: new Map(),
    gatewayArrival: {active: false},
    runtime: {getHero: ()=>hero},
    pack: {
      leader: hero,
      canSee: ()=>true,
    },
    stop: ()=>{},
    targetPosition: actor=>actor.entity.getPosition(),
    distanceTo: actor=>actor.entity.getPosition().length(),
    applyStatus(name, value) {
      this.statuses.set(name, value);
    },
  };

  return {
    owner,
    hero,
    buffs,
    affection: new LatchAffection(owner),
  };
}

it("requires three uninterrupted calm seconds and resets on movement, lost sight and busy actions", ()=>{
  const {owner, hero, buffs, affection: a} = fixture();
  a.update(2.99);
  assert.equal(buffs.has(HERO_BUFF.SLIME_AFFECTION), false);
  hero.entity.setPosition(1.1, 0, 0);
  a.update(.1);
  assert.equal(a.charge, 0);
  a.update(2);
  owner.pack.canSee = ()=>false;
  a.update(.1);
  assert.equal(a.charge, 0);
  owner.pack.canSee = ()=>true;
  a.update(2.9);
  owner.airborne = true;
  a.update(.1);
  assert.equal(a.charge, 0);
  owner.airborne = false;
  a.update(3);
  assert.equal(buffs.has(HERO_BUFF.SLIME_AFFECTION), true);
  assert.ok(owner.statuses.has("affection"));
  for(let i = 0;i < 20;i++) {
    a.update(.5);
  }
  assert.equal(buffs.get(HERO_BUFF.SLIME_AFFECTION).stacks, 1);
  assert.equal(buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 1), 1.05);
  hero.entity.setPosition(3, 0, 0);
  a.update(.1);
  assert.equal(a.charge, 0);
  buffs.advance(2.01);
  assert.equal(buffs.has(HERO_BUFF.SLIME_AFFECTION), false);
});

it("pat contact is happy immediately but never bypasses the affection wait or reach checks", ()=>{
  const {owner, hero, buffs, affection: a} = fixture();
  assert.equal(a.beginPat(), true);
  assert.equal(a.beginPat(), false);
  a.contact();
  assert.equal(a.contacts, 1);
  assert.ok(a.happyRemaining > 0);
  assert.equal(buffs.has(HERO_BUFF.SLIME_AFFECTION), false);
  a.update(1.1);
  assert.equal(a.canPat, true);
  hero.entity.setPosition(2, 0, 0);
  assert.equal(a.beginPat(), false);
  hero.entity.setPosition(.9, 0, 0);
  owner.pack.canSee = ()=>false;
  assert.equal(a.beginPat(), false);
  owner.pack.canSee = ()=>true;
  owner.alive = false;
  assert.equal(a.beginPat(), false);
  a.contact();
  assert.equal(a.contacts, 1);
});
