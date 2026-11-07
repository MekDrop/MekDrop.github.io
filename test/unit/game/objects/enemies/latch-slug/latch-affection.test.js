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

it("keeps earned affection while following a nearby human, then resets when separated", () => {
  const { owner, hero, buffs, affection } = fixture();
  affection.update(3);
  owner.entity = {
    rigidbody: {
      linearVelocity: new pc.Vec3(0.5, 0, 0),
    },
  };
  hero.entity.setPosition(1.3, 0, 0);
  owner.stateName = "LatchIdleState";
  owner.pack.canSee = () => false;
  owner.statuses.clear();
  buffs.advance(2.1);
  affection.update(0.7);
  assert.equal(affection.charge, 3);
  assert.ok(owner.statuses.has("affection"));
  assert.equal(buffs.has(HERO_BUFF.SLIME_AFFECTION), true);
  hero.entity.setPosition(2, 0, 0);
  affection.update(0.1);
  assert.equal(affection.charge, 0);
  assert.ok(owner.statuses.has("affection"), "separation starts the grace period rather than clearing affection");
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

it("spreads affection at half rate per link, stops movement, and cannot sustain a human-free cycle", () => {
  const first = fixture();
  const second = fixture();
  const third = fixture();
  const group = [first, second, third];
  let stops = 0;
  for (const [index, member] of group.entries()) {
    const owner = member.owner;
    owner.position.set(-index * 1.2, 0, 0);
    owner.entity.setPosition(owner.position);
    owner.affection = member.affection;
    owner.actors = group.map(item => item.owner);
    owner.pack.leader = first.hero;
    owner.distanceTo = actor => owner.position.distance(actor.entity.getPosition());
    owner.stop = () => {
      stops++;
    };
  }
  first.affection.update(3);
  assert.equal(second.affection.settling, true);
  assert.equal(third.affection.settling, false, "an unfinished link cannot spread affection");
  second.affection.update(3);
  assert.equal(second.affection.charge, 1.5);
  assert.equal(second.owner.statuses.has("affection"), false);
  second.affection.update(3);
  assert.equal(second.owner.statuses.has("affection"), true);
  third.affection.update(6);
  assert.equal(third.affection.charge, 1.5);
  third.affection.update(6);
  assert.equal(third.owner.statuses.has("affection"), true);
  assert.equal(stops, 4);
  assert.equal(third.buffs.has(HERO_BUFF.SLIME_AFFECTION), false, "relay does not grant a remote human buff");
  first.hero.entity.setPosition(20, 0, 0);
  assert.equal(second.affection.settling, false);
  assert.equal(third.affection.settling, false);
  second.affection.update(0.1);
  third.affection.update(0.1);
  assert.equal(second.affection.charge, 0);
  assert.equal(third.affection.charge, 0);
});

it("does not settle early when there is still an open gap in the same lane", () => {
  const { owner, affection } = fixture();
  owner.canCloseCompanionGap = () => true;
  assert.equal(affection.nearCompanion, false);
  assert.equal(affection.settling, false);
  owner.canCloseCompanionGap = () => false;
  assert.equal(affection.nearCompanion, true);
  assert.equal(affection.settling, true);
});
