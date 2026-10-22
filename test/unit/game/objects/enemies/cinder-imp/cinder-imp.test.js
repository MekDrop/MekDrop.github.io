import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, Vec3 } from 'playcanvas';
import { CinderImp } from '../../../../../../src/game/objects/enemies/cinder-imp/CinderImp.js';
import { Enemy } from '../../../../../../src/game/objects/enemies/shared/Enemy.js';
import { CinderHotPatch } from '../../../../../../src/game/objects/enemies/cinder-imp/CinderHotPatch.js';

function fixture() {
  const actors = [];
  const physics = {
    hits: [],
    raycastAll() {
      return this.hits;
    },
  };
  const options = {
    pc: {
      Entity,
      Vec3,
    },
    app: {systems: {rigidbody: physics}},
    definition: {id: 'imp'},
    runtime: {objects: actors},
  };
  const imp = new CinderImp(options);
  const royal = new Enemy({
    ...options,
    definition: {id: 'royal'},
  });
  royal.isEnemy = false;
  royal.isRoyal = true;
  royal.entity.setPosition(0,0,-1);
  imp.entity.rigidbody = {
    enabled: true,
    linearVelocity: new Vec3(),
    teleport: () => {},
  };
  actors.push(imp, royal);

  return {
    imp,
    royal,
    actors,
    physics,
  };
}

test('fire windup does no damage, contact hurts, recovery stops damage', () => {
  const {imp, royal} = fixture();
  imp.update(0.01);
  assert.equal(imp.stateName, 'CinderFireWindupState');
  assert.equal(royal.health,100);
  imp.update(0.4);
  assert.equal(imp.stateName, 'CinderFireLoopState');
  const before = royal.health;
  imp.update(0.2);
  assert.ok(royal.health < before - 4);
  imp.update(0.5);
  assert.equal(imp.stateName,'CinderFireRecoverState');
  royal.entity.setPosition(0,0,-3);
  const after = royal.health;
  imp.update(0.2);
  assert.equal(royal.health, after);
});

test('incoming damage cancels windup before contact and Yuka resumes pursuit', () => {
  const {imp,royal} = fixture();
  imp.update(0.01);
  imp.receiveDamage(1);
  assert.equal(imp.stateName,'CinderHitState');
  imp.update(0.3);
  assert.equal(imp.stateName,'CinderPursueState');
  assert.equal(royal.health,100);
});

test('stun interrupts fire, holds until expiry and has a distinct recovery', () => {
  const {imp,royal} = fixture();
  imp.update(0.01);
  imp.applyStatus('stun',{duration:1});
  imp.update(0.5);
  assert.equal(imp.stateName,'CinderStunState');
  assert.equal(imp.clip,'stun');
  assert.equal(royal.health,100);
  imp.update(0.5);
  assert.equal(imp.clip,'stun_recover');
  imp.update(0.35);
  assert.equal(imp.stateName,'CinderPursueState');
});

test('bell encouragement neither confuses nor increases movement speed', () => {
  const {imp} = fixture();
  const speed = imp.walkSpeed;
  imp.onBellRung({eventId:'test'});
  assert.equal(imp.stateName,'CinderWarnState');
  assert.equal(imp.statuses.has('confused'),false);
  assert.equal(imp.applyStatus('confused'),false);
  assert.equal(imp.walkSpeed,speed);
});

test('unwilling carrier takes heat; landing pursues thrower temporarily then royal', () => {
  const {imp,royal,actors} = fixture();
  const carrier = new Enemy({
    pc:{
      Entity,
      Vec3,
    },
    app:{},
    runtime:{},
    definition:{id:'thrower'},
  });
  actors.push(carrier);
  imp.beginCarry(carrier);
  imp.update(0.5);
  assert.equal(imp.stateName,'CinderCarriedState');
  assert.ok(carrier.health < 100);
  imp.launch({
    velocity:{
      x:0,
      y:4,
      z:0,
    },
  });
  assert.equal(imp.stateName,'CinderAirborneState');
  imp.onLanding();
  assert.equal(imp.stateName,'CinderLandState');
  assert.equal(imp.chooseTarget(),carrier);
  imp.update(0.6);
  assert.equal(imp.stateName,'CinderPursueState');
  imp.update(6);
  assert.equal(imp.chooseTarget(),royal);
});

test('solid walls occlude fire and route towers are never intentional attack targets', () => {
  const {imp,royal,physics,actors} = fixture();
  const tower = {
    entity:new Entity('tower'),
    isTower:true,
    isFlammable:true,
  };
  actors.push(tower);
  physics.hits = [{
    entity:tower.entity,
    hitFraction:0.3,
  }];
  assert.equal(imp.canReachWithFire(royal),false);
  assert.equal(imp.findObstruction(royal),null);
  imp.attackTarget=royal;
  imp.performFire(1);
  assert.equal(royal.health,100);
});

test('burning an actual route obstruction destroys it and releases its collision lifecycle', () => {
  const {imp,royal,physics,actors}=fixture();
  let destroyed=0;
  const crate={
    entity:new Entity('crate'),
    definition:{
      id:'crate',
      flammable:true,
      burnHealth:5,
    },
    destroy: () => {
      destroyed++;
    },
  };
  crate.entity.setPosition(0,0,-0.5);
  actors.push(crate);
  physics.hits=[{
    entity:crate.entity,
    hitFraction:0.2,
  }];
  assert.equal(imp.findObstruction(royal),crate);
  imp.attackTarget=crate;
  imp.performFire(0.2);
  imp.performFire(0.2);
  assert.equal(destroyed,1);
});

test('frost rivalry produces steam status and damage; frost extinguishes ground heat', () => {
  const {imp,royal,actors}=fixture();
  royal.isRoyal=false;
  royal.isEnemy=true;
  royal.element='frost';
  assert.equal(imp.chooseTarget(),royal);
  imp.attackTarget=royal;
  imp.performFire(0.5);
  assert.equal(royal.health,91);
  assert.equal(royal.statuses.has('steam'),true);
  const patch=new CinderHotPatch(imp,new Vec3(0,0,-1));
  patch.onContactEnter(royal.entity);
  patch.update(0.1);
  assert.equal(patch.expired,true);
  assert.ok(actors.includes(royal));
});

test('ground hazard applies only its remaining simulation lifetime and cleans up once', () => {
  const {imp,royal}=fixture();
  let removed=0;
  imp.runtime.createObject=()=>({
    entity:new Entity('effect'),
    destroy: () => {
      removed++;
    },
  });
  imp.runtime.root=new Entity('root');
  const patch=new CinderHotPatch(imp,new Vec3(0,0,-1));
  patch.onContactEnter(royal.entity);
  patch.update(20);
  assert.equal(royal.health,76);
  assert.equal(patch.expired,true);
  patch.destroy();
  assert.equal(removed,1);
});

test('death clears hazards, disables body and performs delayed cleanup without revival', () => {
  const {imp}=fixture();
  let removed=0;
  imp.runtime.createObject=()=>({
    entity:new Entity('effect'),
    destroy: () => {
      removed++;
    },
  });
  imp.runtime.root=new Entity('root');
  imp.addHotPatch(new Vec3());
  imp.receiveDamage(1000);
  assert.equal(imp.stateName,'CinderDeathState');
  assert.equal(imp.entity.rigidbody.enabled,false);
  assert.equal(removed,1);
  imp.update(1.3);
  assert.equal(imp.alive,false);
  assert.equal(imp.receiveHealing(100),0);
  imp.destroy();
  assert.equal(removed,1);
});


test('real frost chill capability selects rivalry and delays contact until the punch phase', () => {
  const {imp,royal}=fixture();
  royal.isRoyal=false;
  royal.isEnemy=true;
  royal.combat={chill:()=>true};
  assert.equal(imp.isFrostActor(royal),true);
  imp.update(0.01);
  assert.equal(imp.stateName,'CinderRivalAttackState');
  imp.update(0.15);
  assert.equal(royal.health,100);
  imp.update(0.1);
  assert.ok(royal.health<100);
  assert.equal(royal.statuses.has('steam'),true);
});

test('heat trigger leave removes damage eligibility', () => {
  const {imp,royal}=fixture();
  const patch=new CinderHotPatch(imp,new Vec3());
  patch.update(.1);
  assert.equal(royal.health,100);
  patch.onContactEnter(royal.entity);
  patch.update(.1);
  assert.ok(royal.health<100);
  patch.onContactLeave(royal.entity);
  const health=royal.health;
  patch.update(.2);
  assert.equal(royal.health,health);
});

test('royal contact starts the actual game-over capability once and keeps victory after phase exit', () => {
  const {imp,royal}=fixture();let reached=0;royal.receiveDamage=null;royal.beginGameOver=()=>reached++;
  imp.attackTarget=royal;imp.transition('CinderFireLoopState');imp.phaseTime=.64;imp.update(.02);
  assert.equal(imp.stateName,'CinderVictoryState');assert.equal(reached,1);imp.update(2);assert.equal(reached,1);
});

test('carried heat grows and then cools after release, while knockback applies a real body impulse',()=>{
  const {imp,royal}=fixture();imp.beginCarry(royal);imp.update(1);assert.ok(imp.heat>0);
  imp.launch({
    velocity:{
      x:0,
      y:3,
      z:0,
    },
  });const heat=imp.heat;imp.update(.2);assert.ok(imp.heat<heat);
  imp.onLanding();let impulse=null;imp.entity.rigidbody.applyImpulse=(...args)=>{
    impulse=args;
  };
  imp.applyStatus('knockback',{
    duration:.4,
    impulse:{
      x:1,
      y:0,
      z:-2,
    },
  });assert.equal(imp.stateName,'CinderKnockbackState');assert.deepEqual(impulse,[1,0,-2]);
});
