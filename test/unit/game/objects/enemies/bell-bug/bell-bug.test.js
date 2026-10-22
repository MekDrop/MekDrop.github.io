import { Door } from "../../../../../../src/game/objects/architecture/door/Door.js";
import { HornedWrecker } from "../../../../../../src/game/objects/enemies/horned-wrecker/HornedWrecker.js";
import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, Vec3 } from 'playcanvas';
import { State, StateMachine } from 'yuka';
import { Enemy } from '../../../../../../src/game/objects/enemies/shared/Enemy.js';
import { BellBug } from '../../../../../../src/game/objects/enemies/bell-bug/BellBug.js';
import { SignalBellEvent } from '../../../../../../src/game/objects/signal-bell/SignalBellEvent.js';

function fixture() {
  const actors=[];
  const physics={
    hits:[],
    raycastAll(){
      return this.hits;
    },
  };
  const options={
    pc:{
      Entity,
      Vec3,
    },
    app:{systems:{rigidbody:physics}},
    definition:{id:'bug'},
    runtime:{objects:actors},
  };
  const bug=new BellBug(options);
  bug.entity.rigidbody={
    enabled:true,
    linearVelocity:new Vec3(),
    teleport:()=>{},
  };
  const ally=new Enemy({
    ...options,
    definition:{id:'ally'},
  });
  const royal=new Enemy({
    ...options,
    definition:{id:'royal'},
  });
  royal.isRoyal=true;royal.isEnemy=false;royal.entity.setPosition(0,0,-3);
  actors.push(bug,ally,royal);

  return {
    bug,
    ally,
    royal,
    actors,
    physics,
    options,
  };
}

test('tower strike -> Yuka fear -> real allied stun extension; no unstunned buff',()=>{
  const {bug,ally,royal,actors}=fixture();
  ally.applyStatus('stun',{duration:2});
  assert.ok(bug.stateMachine instanceof StateMachine);
  assert.ok(bug.stateMachine.currentState instanceof State);
  const bell={
    position:new Vec3(),
    definition:{id:'tower'},
  };
  const id=SignalBellEvent.dispatch(bell,actors);
  assert.equal(bug.stateName,'BellBugPanicState');
  assert.equal(bug.clip,'fear_recoil');
  bug.update(.44);assert.equal(ally.statuses.get('stun').remaining,2);
  bug.update(.02);assert.equal(ally.statuses.get('stun').remaining,3.5);
  assert.equal(ally.statuses.get('stun').bellEventId,id);
  assert.equal(royal.statuses.size,0);
  assert.equal(bug.ringCount,1);
  bug.update(.6);assert.equal(bug.ringCount,1);
  assert.equal(ally.statuses.has('speed'),false);
});

test('secondary rings and repeated primary identities cannot cause ring chains',()=>{
  const {bug,ally,actors,options}=fixture();
  const second=new BellBug({
    ...options,
    definition:{id:'bug2'},
  });actors.push(second);
  ally.applyStatus('stun',{duration:1});
  for(const actor of [bug,second]) {
    actor.onBellRung({eventId:'same'});
  }
  bug.update(.5);second.update(.5);
  assert.equal(ally.statuses.get('stun').remaining,2.5);
  assert.equal(bug.onBellRung({eventId:'same'}),false);
  assert.equal(bug.onBellRung({
    eventId:'secondary',
    secondary:true,
  }),false);
  assert.equal(bug.ringCount,1);assert.equal(second.ringCount,1);
});

test('immune nearby allies remain immune and receive irritation capability only',()=>{
  const {bug,ally}=fixture();let irritated=0;
  ally.bellImmune=true;ally.statusImmunities=new Set(['confused']);
  ally.onBellEncouraged=()=>irritated++;
  ally.applyStatus('stun',{duration:1});
  bug.onBellRung({eventId:'noise'});bug.update(.5);
  assert.equal(ally.statuses.get('stun').remaining,1);
  assert.equal(ally.statuses.has('confused'),false);
  assert.equal(irritated,1);
});

test('grabbing panics once; launching keeps engine velocity; landing recovers',()=>{
  const {bug,ally}=fixture();ally.applyStatus('stun',{duration:1});
  assert.equal(bug.beginCarry(ally),true);
  assert.equal(bug.clip,'carried_panic');assert.equal(bug.ringCount,1);
  bug.update(.1);assert.equal(bug.ringCount,1);
  assert.equal(bug.launch({
    velocity:{
      x:2,
      y:4,
      z:0,
    },
  }),true);
  assert.equal(bug.clip,'airborne_tumble');
  bug.update(.1);assert.equal(bug.entity.rigidbody.linearVelocity.y,4);
  assert.equal(bug.onLanding(),true);assert.equal(bug.clip,'land');
  bug.update(.7);assert.equal(bug.stateName,'BellBugPursueState');
});

test('closed main door has contact damage after windup, opening cancels it',()=>{
  const {bug,royal,actors,physics}=fixture();let health=16;
  const root=new Entity('door');const leaf=new Entity('leaf');root.addChild(leaf);
  const door={
    entity:root,
    openAmount:0,
    intersectsFootprint:()=>true,
    receiveDamage:(amount)=>{
      health-=amount;

      return amount;
    },
  };
  actors.push({entranceDoors:[door]});physics.hits=[{
    entity:leaf,
    hitFraction:.2,
  }];
  bug.update(.01);assert.equal(bug.stateName,'BellBugScratchState');
  bug.update(.3);assert.equal(health,16);
  bug.update(.6);assert.equal(health,8);
  door.openAmount=1;bug.update(.8);assert.equal(health,8);
  assert.equal(bug.stateName,'BellBugScratchRecoverState');
  bug.update(.3);assert.equal(bug.stateName,'BellBugPursueState');
  assert.equal(bug.resolveRoyalTarget(),royal);
});

test('towers never become scratch or ultimate targets; physics blocks through-wall attacks',()=>{
  const {bug,royal,actors,physics}=fixture();
  const tower=new Enemy({
    ...fixture().options,
    definition:{id:'tower'},
  });tower.isTower=true;
  actors.push(tower);physics.hits=[{
    entity:tower.entity,
    hitFraction:.1,
  }];
  assert.equal(bug.findClosedDoor(royal),null);
  assert.equal(bug.resolveRoyalTarget(),royal);
});

test('death cancels pending rings, cannot heal, and uses death state before cleanup',()=>{
  const {bug,ally}=fixture();ally.applyStatus('stun',{duration:1});
  bug.onBellRung({eventId:'die'});bug.receiveDamage(1000);
  assert.equal(bug.clip,'death');assert.equal(bug.alive,false);
  bug.update(.5);assert.equal(bug.ringCount,0);
  assert.equal(bug.receiveHealing(10),0);assert.equal(bug.onBellRung(),false);
});

test('outside radius or no preexisting stun receives no amplification',()=>{
  const {bug,ally}=fixture();ally.entity.setPosition(20,0,0);ally.applyStatus('stun',{duration:1});
  bug.onBellRung({eventId:1});bug.update(.5);
  assert.equal(ally.statuses.get('stun').remaining,1);
  ally.entity.setPosition(0,0,0);ally.statuses.clear();
  bug.onBellRung({eventId:2});bug.update(.5);
  assert.equal(ally.statuses.has('stun'),false);
});

test('actual Horned Wrecker reacts with anger and never bell confusion or amplified stun', () => {
  const {bug,actors,options}=fixture();
  const wrecker=new HornedWrecker({
    ...options,
    definition:{id:'immune-wrecker'},
  });
  actors.push(wrecker);
  wrecker.applyStatus('stun',{duration:1});
  const before=wrecker.statuses.get('stun').remaining;
  SignalBellEvent.dispatch({position:new Vec3()},actors);
  bug.update(.5);
  assert.equal(wrecker.statuses.has('confused'),false);
  assert.equal(wrecker.statuses.get('stun').remaining,before);
  assert.equal(wrecker.applyStatus('stun',{
    duration:5,
    source:bug,
    kind:'bell',
  }),false);
});

test('fear callback forwards secondary identity and real Wrecker responds with anger', () => {
  const {bug,actors,options}=fixture();let forwarded;
  bug.runtime.onBellBugRing=(_source,event)=>{
    forwarded=event;
  };
  const wrecker=new HornedWrecker({
    ...options,
    definition:{id:'angry-wrecker'},
  });actors.push(wrecker);
  bug.onBellRung({eventId:'original-tower'});bug.update(.5);
  assert.equal(forwarded.secondary,true);assert.equal(forwarded.eventId,'original-tower');
  assert.equal(wrecker.stateName,'WreckerSnortState');
  assert.equal(wrecker.statuses.size,0);
});

test('external stun interrupts scratching before damage contact', () => {
  const {bug,royal,actors,physics}=fixture();let contacts=0;
  const door={
    entity:new Entity('door'),
    openAmount:0,
    intersectsFootprint:()=>true,
    receiveDamage:()=>{
      contacts++;

      return 8;
    },
  };
  actors.push({entranceDoors:[door]});physics.hits=[{
    entity:door.entity,
    hitFraction:.1,
  }];
  bug.update(.01);bug.update(.3);bug.applyStatus('stun',{duration:2});bug.update(1);
  assert.equal(contacts,0);assert.equal(bug.stateName,'BellBugReactionState');
  assert.equal(bug.resolveRoyalTarget(),royal);
});

test('physics wall hit before door blocks finding or scratching the leaf', () => {
  const {bug,royal,actors,physics}=fixture();const door={
    entity:new Entity('door'),
    openAmount:0,
  };
  actors.push({entranceDoors:[door]});
  physics.hits=[{
    entity:door.entity,
    hitFraction:.5,
  },{
    entity:new Entity('wall'),
    hitFraction:.1,
  }];
  assert.equal(bug.findClosedDoor(royal),null);
});

test('six contact scratches break the actual Door API and resume royal pursuit', () => {
  const {bug,royal,actors,physics}=fixture();
  const root=new Entity('main door');
  const hinge=new Entity('moving leaf hinge');root.addChild(hinge);
  const activeRoot=new Entity('active scene');activeRoot._enabledInHierarchy=true;activeRoot.addChild(root);
  root.addComponent=()=>{
    root.anim={
      baseLayer:{play:()=>{}},
      addAnimationState:()=>{},
      update:()=>{},
    };
  };
  const door=new Door({
    entity:root,
    hingeName:'moving leaf hinge',
    modelLibrary:{getAnimationTracks:()=>new Map([['Open',{duration:1}]])},
    modelUrl:'fixture-door.glb',
    animationName:'Open',
    automatic:false,
    collision:{
      raycast:()=>.1,
      blocksAt:()=>true,
      destroy:()=>{},
    },
  });
  actors.push({entranceDoors:[door]});
  physics.raycastAll=()=>door.broken?[]:[{
    entity:root,
    hitFraction:.1,
  }];
  bug.update(.01);bug.update(.86);
  assert.equal(door.health,40);
  for(let i=0;i<5;i++){
    bug.update(.75);
  }
  assert.equal(door.health,0);
  assert.equal(door.broken,true);
  assert.equal(root.enabled,true);
  assert.equal(hinge.enabled,false);
  bug.update(.01);bug.update(.3);
  assert.equal(bug.stateName,'BellBugPursueState');
  assert.equal(bug.resolveRoyalTarget(),royal);
  door.destroy();activeRoot.destroy();
});
