import { Door } from "../../../../../../src/game/objects/architecture/door/Door.js";
import { HornedWrecker } from "../../../../../../src/game/objects/enemies/horned-wrecker/HornedWrecker.js";
import assert from 'node:assert/strict';
import test from 'node:test';
import { Entity, Vec3 } from 'playcanvas';
import { State, StateMachine } from 'yuka';
import { Enemy } from '../../../../../../src/game/objects/enemies/shared/Enemy.js';
import { BellBug } from '../../../../../../src/game/objects/enemies/bell-bug/BellBug.js';
import { SignalBellEvent } from '../../../../../../src/game/objects/signal-bell/SignalBellEvent.js';
import { LatchGlue } from '../../../../../../src/game/objects/enemies/latch-slug/LatchGlue.js';

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
    teleport:(position,heading)=>{
      bug.entity.setPosition(position);
      if (heading) {
        bug.entity.setEulerAngles(heading);
      }
    },
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

test('lane traffic does not bypass the Bell Bug crowd recovery planner', () => {
  const {bug,ally,royal}=fixture();
  bug.entity.setPosition(.5,0,0);
  royal.entity.setPosition(.5,0,-3);
  ally.entity.setPosition(.5,0,-.8);
  ally.entity.rigidbody={enabled:true};
  bug.pathLane.side=1;
  bug.runtime.mapData={
    cols:1,
    rows:1,
    paths:[{
      route:[{
        col:0,
        row:0,
        elevation:0,
      },{
        col:0,
        row:-4,
        elevation:0,
      }],
    }],
  };
  bug.runtime.objects.push({
    isEnemy:true,
    alive:true,
    radius:.3,
    height:1,
    position:new Vec3(-.5,0,0),
  });
  let recoveries=0;
  bug.crowdMotion.constrain=()=>{
    recoveries++;

    return false;
  };
  bug.moveToward(royal);
  assert.equal(recoveries,1,'the species planner must get a chance to wait or pass');
});

test('walking syncs a physical turn once without repeatedly teleporting straight travel', () => {
  const {bug, royal}=fixture();
  const teleport=bug.entity.rigidbody.teleport;
  let turns=0;
  bug.entity.rigidbody.teleport=(...args)=>{
    turns++;
    teleport(...args);
  };
  bug.moveToward(royal);
  bug.moveToward(royal);
  assert.equal(turns,0);
  royal.entity.setPosition(3,0,0);
  bug.moveToward(royal);
  bug.moveToward(royal);
  assert.equal(turns,1);
  assert.ok(bug.entity.rigidbody.linearVelocity.x>0);
});


test('nearby bugs add diminishing ten-percent bonuses and stop vibrating on time', () => {
  const {bug,actors,options}=fixture();
  actors.push(new BellBug({
    ...options,
    definition:{id:'second'},
  }));
  actors.push(new BellBug({
    ...options,
    definition:{id:'third'},
  }));
  bug.onBellRung({eventId:'cluster'});
  assert.ok(Math.abs(bug.panicDuration-2.22)<1e-9);
  bug.update(2.21);
  assert.equal(bug.stateName,'BellBugPanicState');
  bug.update(.02);
  assert.equal(bug.stateName,'BellBugPursueState');
});

test('bell panic retracts, stays hidden, and emerges before pursuit resumes', () => {
  const {bug}=fixture();
  bug.onBellRung({eventId:'hide'});
  assert.equal(bug.clip,'hide_start');
  bug.update(.61);
  assert.equal(bug.clip,'hide_loop');
  bug.update(.80);
  assert.equal(bug.clip,'hide_end');
  bug.update(.60);
  assert.equal(bug.stateName,'BellBugPursueState');
});

test('one tile is inclusive and vibration slows nearby tower reaction', () => {
  const {bug,ally,actors}=fixture();let slowed;
  ally.entity.setPosition(1,0,0);
  actors.push({
    position:new Vec3(.5,0,0),
    slowReaction:(duration,delay)=>{
      slowed={
        duration,
        delay,
      };
    },
  });
  bug.onBellRung({eventId:'range'});
  assert.equal(ally.statuses.get('stun').remaining,2);
  assert.deepEqual(slowed,{
    duration:2,
    delay:.5,
  });
});

test('scratch contact uses the reached surface without globally clearing a jam', () => {
  const {bug,royal}=fixture();let strokes=0;
  const door={
    entity:new Entity('glued door'),
    openAmount:0,
    jammed:true,
    intersectsFootprint:()=>true,
    clearGlue:()=>assert.fail('scratching must not clear all door mass'),
  };
  bug.scratchTarget=door;
  bug.doorScratch.apply=()=>{
    strokes++;

    return true;
  };
  assert.equal(bug.scratchDoor(),true);
  assert.equal(strokes,1);
  door.openAmount=1;
  assert.equal(bug.scratchDoor(),false);
  assert.equal(strokes,1);
  assert.equal(bug.resolveRoyalTarget(),royal);
});

test('goo cleanup finds a batched door off the royal sightline without blindly clearing its mass', () => {
  const {bug,actors,physics}=fixture();
  const root=new Entity('door'), hinge=new Entity('moving leaf hinge'), leaf=new Entity('detached Ammo leaf');
  root.addChild(hinge);root.setPosition(.4,0,0);root.setEulerAngles(0,90,0);
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
    modelUrl:'door.glb',
    animationName:'Open',
    automatic:false,
    collision:{
      raycast:(start,end)=>{
        const distance=(.4-start.x)/(end.x-start.x);

        return distance>=0&&distance<=1?distance:null;
      },
      blocksAt:()=>true,
      ownsLeaf:entity=>entity===leaf,
      destroy:()=>{},
    },
  });
  actors.push({destructibleDoors:[door]});
  const wall=new Entity('wall between bug and royal');
  physics.raycastAll=(_start,end)=>[{
    entity:end.z<-.5?wall:leaf,
    hitFraction:.6,
  }];
  const goo=new LatchGlue(door,20);
  assert.equal(door.jammed,true);
  assert.equal(bug.findClosedDoor(bug.resolveRoyalTarget()),null);
  bug.update(.01);
  assert.equal(bug.stateName,'BellBugScratchState');
  assert.ok(bug.entity.forward.x>.99,'the body faces the goo-covered door');
  bug.update(.3);assert.equal(goo.active,true);
  bug.update(.56);
  assert.equal(goo.active,true);assert.equal(door.jammed,true);assert.equal(door.health,48);
  door.destroy();root.destroy();leaf.destroy();
});

test('goo cleanup cannot reach through a wall', () => {
  const {bug,actors,physics}=fixture();
  const door={
    entity:new Entity('glued door'),
    jammed:true,
    openAmount:0,
    getHit:()=>({distance:.5}),
    intersectsFootprint:()=>true,
  };
  actors.push({destructibleDoors:[door]});
  physics.hits=[{
    entity:new Entity('intervening wall'),
    hitFraction:.1,
  }];
  assert.equal(bug.findGluedDoor(),null);
  bug.scratchTarget=door;
  assert.equal(bug.canScratchDoor,false);
});

test('living contact loses one heart per ten seconds and walls block scratches', () => {
  const {bug,royal,physics}=fixture();
  royal.entity.setPosition(0,0,-.6);
  bug.update(1);
  assert.equal(royal.health,99.9);
  physics.hits=[{
    entity:new Entity('wall'),
    hitFraction:.5,
  }];
  bug.update(1);
  assert.equal(royal.health,99.9);
  physics.hits=[];
  bug.onBellRung({eventId:'pause-contact'});bug.update(1);
  assert.equal(royal.health,99.9);
});

test('tower strike immediately vibrates and stuns for two seconds',()=>{
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
  assert.equal(bug.clip,'hide_start');
  bug.update(.44);assert.equal(ally.statuses.get('stun').remaining,2);
  bug.update(.02);assert.equal(ally.statuses.get('stun').remaining,2);
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
  assert.equal(ally.statuses.get('stun').remaining,2.2);
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
  const sounds=[];
  bug.doorScratch.random=()=>.5;
  const root=new Entity('door');root.setPosition(0,0,-.45);const leaf=new Entity('leaf');root.addChild(leaf);
  const door={
    entity:root,
    audio:{play:name=>sounds.push(name)},
    openAmount:0,
    intersectsFootprint:()=>true,
    getHit:(start,end)=>{
      const distance=(-.45-start.z)/(end.z-start.z);

      return distance>=0&&distance<=1?{distance}:null;
    },
    scratchSurface:()=>{
      health-=8;

      return 8;
    },
  };
  actors.push({entranceDoors:[door]});physics.hits=[{
    entity:leaf,
    hitFraction:.2,
  }];
  bug.update(.01);assert.equal(bug.stateName,'BellBugScratchState');
  bug.update(.3);assert.equal(health,16);
  assert.equal(sounds.length,0);
  bug.update(.2);assert.deepEqual(sounds,['scratch']);assert.equal(health,16);
  bug.update(.4);assert.equal(health,8);
  assert.deepEqual(sounds,['scratch']);
  door.openAmount=1;bug.update(.8);assert.equal(health,8);
  assert.deepEqual(sounds,['scratch']);
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
  bug.update(.5);assert.equal(bug.ringCount,1);
  assert.equal(bug.receiveHealing(10),0);assert.equal(bug.onBellRung(),false);
});

test('outside radius is unaffected; nearby unstunned enemies receive stun',()=>{
  const {bug,ally}=fixture();ally.entity.setPosition(20,0,0);ally.applyStatus('stun',{duration:1});
  bug.onBellRung({eventId:1});bug.update(.5);
  assert.equal(ally.statuses.get('stun').remaining,1);
  ally.entity.setPosition(0,0,0);ally.statuses.clear();
  bug.onBellRung({eventId:2});bug.update(.5);
  assert.equal(ally.statuses.get('stun').remaining,2);
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
  const root=new Entity('main door');root.setPosition(0,0,-.45);
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
      raycast:(start,end)=>{
        const distance=(-.45-start.z)/(end.z-start.z);

        return distance>=0&&distance<=1?distance:null;
      },
      blocksAt:()=>true,
      destroy:()=>{},
    },
  });
  // The geometric scratch capability has its own native mesh tests.
  door.scratchSurface=(_start,_end,source)=>door.receiveDamage(8,source);
  door.getScratchPoint=point=>point;
  bug.doorScratch.random=()=>.5;
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
