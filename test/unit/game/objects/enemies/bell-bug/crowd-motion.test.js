import assert from 'node:assert/strict';
import test from 'node:test';
import { Vec3 } from 'playcanvas';
import { BellBugCrowdMotion } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugCrowdMotion.js';

function fixture(x=0,z=-0.8,y=0) {
  const peer={
    isEnemy:true,
    isBellBug:true,
    alive:true,
    height:0.515,
    position:new Vec3(x,y,z),
    entity:{rigidbody:{enabled:true}},
  };
  const body={linearVelocity:new Vec3(0,-0.5,-1.15)};
  const owner={
    pc:{Vec3},
    position:new Vec3(),
    height:0.515,
    entity:{rigidbody:body},
    actors:[peer],
    targetPosition:a=>a.position,
  };

  return {
    peer,
    body,
    motion:new BellBugCrowdMotion(owner),
  };
}

test('a close enemy makes the bug wait without changing gravity velocity',()=>{
  const {body,motion}=fixture();
  assert.equal(motion.constrain(),false);
  assert.equal(Math.hypot(body.linearVelocity.x,body.linearVelocity.z),0);
  assert.equal(body.linearVelocity.y,-0.5);
});

test('scoop approach uses capsule clearance only for its target',()=>{
  const {peer,body,motion}=fixture(0,-0.8);
  peer.isBellBug=false;peer.radius=0.42;
  motion.owner.radius=0.254;
  motion.owner.scoop={approachTarget:peer};
  body.linearVelocity.set(0,-0.5,-0.25);
  assert.equal(motion.constrain(),true);
  assert.equal(body.linearVelocity.z,-0.25);
  assert.equal(body.linearVelocity.y,-0.5);
  motion.owner.scoop.approachTarget=null;
  assert.equal(motion.constrain(),false);
  peer.position.z=-0.69;
  motion.owner.scoop.approachTarget=peer;
  body.linearVelocity.set(0,-0.5,-0.25);
  assert.equal(motion.constrain(),false);
});

test('approaching traffic slows smoothly before its feet overlap',()=>{
  const {body,motion}=fixture(0,-1);
  assert.equal(motion.constrain(),true);
  assert.ok(Math.abs(body.linearVelocity.z)<1.15);
  assert.equal(body.linearVelocity.y,-0.5);
});

test('actors behind, in another lane, on another floor or being carried do not stop travel',()=>{
  for(const [x,z,y,carried] of [[0,1,0,false],[1,-0.8,0,false],[0,-0.8,2,false],[0,-0.8,0,true]]){
    const {peer,body,motion}=fixture(x,z,y);peer.carrier=carried;
    assert.equal(motion.constrain(),true);
    assert.equal(body.linearVelocity.z,-1.15);
  }
});

test('royal contact remains possible and clearing traffic releases the queue',()=>{
  const {peer,body,motion}=fixture();peer.isEnemy=false;
  assert.equal(motion.constrain(),true);
  peer.isEnemy=true;motion.constrain();assert.ok(body.linearVelocity.z===0);
  peer.position.z=-2;body.linearVelocity.set(0,0,-1.15);
  assert.equal(motion.constrain(),true);
  assert.equal(body.linearVelocity.z,-1.15);
});

test('a stationary blocker causes a short wait followed by a committed passing step',()=>{
  const {body,motion}=fixture(0,-.94);
  motion.owner.deltaTime=.2;
  assert.equal(motion.constrain(),true);
  for(let frame=0;frame<4;frame++){
    body.linearVelocity.set(0,-.5,-1.15);
    motion.constrain();
  }
  assert.ok(Math.abs(body.linearVelocity.x)>.2,'the bug moves around the blocker instead of waiting forever');
  assert.equal(body.linearVelocity.y,-.5);
  const side=Math.sign(body.linearVelocity.x);
  body.linearVelocity.set(0,-.5,-1.15);motion.constrain();
  assert.equal(Math.sign(body.linearVelocity.x),side,'the passing side does not alternate each frame');
});

test('passing respects static walls and unsupported edges',()=>{
  const {body,motion}=fixture(0,-.94);motion.owner.deltaTime=.2;
  const wall={rigidbody:{type:'static'}};
  motion.owner.app={
    systems:{
      rigidbody:{
        raycastAll:(from,to)=>to.x>0?[{
          entity:wall,
          normal:new Vec3(-1,0,0),
        }]:[],
      },
    },
  };
  for(let frame=0;frame<4;frame++){
    body.linearVelocity.set(0,-.5,-1.15);motion.constrain();
  }
  assert.ok(body.linearVelocity.x<0,'a blocked right side uses the clear left side');
  motion.owner.stepSupport={surface:()=>null};
  body.linearVelocity.set(0,-.5,-1.15);motion.constrain();
  assert.ok(Math.abs(body.linearVelocity.x)<1e-6,'the bug never sidesteps off an unsupported edge');
});

test('a moving leader is followed instead of repeatedly overtaken',()=>{
  const {body,peer,motion}=fixture(0,-1);motion.owner.deltaTime=.2;
  peer.entity.rigidbody.linearVelocity=new Vec3(0,0,-.6);
  for(let frame=0;frame<8;frame++){
    body.linearVelocity.set(0,-.5,-1.15);motion.constrain();
  }
  assert.equal(body.linearVelocity.x,0);
  assert.ok(Math.abs(body.linearVelocity.z)<1.15);
});

test('blocked path lanes remain queued beyond the local passing delay and resume when clear', () => {
  for (const vertical of [false, true]) {
    const {body,peer,motion}=fixture(vertical ? 0 : .7,vertical ? -.7 : 0);
    const owner=motion.owner;
    owner.deltaTime=.2;
    owner.position.set(vertical ? -.5 : 0,0,vertical ? 0 : -.5);
    peer.position.set(vertical ? -.5 : .7,0,vertical ? -.7 : -.5);
    owner.actors.push({
      ...peer,
      position:peer.position.clone().add(new Vec3(vertical ? 1 : 0,0,vertical ? 0 : 1)),
    });
    owner.runtime={
      mapData:{
        cols:1,
        rows:1,
        paths:[{
          route:vertical ? [
            {
              col:0,
              row:-4,
              elevation:0,
            },
            {
              col:0,
              row:4,
              elevation:0,
            },
          ] : [
            {
              col:-4,
              row:0,
              elevation:0,
            },
            {
              col:4,
              row:0,
              elevation:0,
            },
          ],
        }],
      },
    };
    for (let frame=0;frame<30;frame++) {
      body.linearVelocity.set(vertical ? 0 : 1.15,-.5,vertical ? -1.15 : 0);
      assert.equal(motion.constrain(),false);
      assert.equal(Math.hypot(body.linearVelocity.x,body.linearVelocity.z),0);
      assert.equal(body.linearVelocity.y,-.5);
    }
    owner.actors=[peer];
    body.linearVelocity.set(vertical ? 0 : 1.15,-.5,vertical ? -1.15 : 0);
    assert.equal(motion.constrain(),true,'an open adjacent lane releases the queue');
    const lateral=vertical ? body.linearVelocity.x : body.linearVelocity.z;
    assert.ok(lateral>0,'passing moves into the free lane rather than onto grass');
    const lateralPosition=(vertical ? owner.position.x : owner.position.z)+lateral*.7;
    assert.ok(Math.abs(lateralPosition)<=.55,'the complete foot room remains on the path');
    owner.actors=[];
    body.linearVelocity.set(vertical ? 0 : 1.15,-.5,vertical ? -1.15 : 0);
    assert.equal(motion.constrain(),true);
    assert.equal(body.linearVelocity.y,-.5);
  }
});

test('a yielding slug still blocks the Bell Bug until it clears the way', () => {
  const { body, peer, motion } = fixture(0, -0.7);
  motion.owner.isBellBug = true;
  motion.owner.deltaTime = 0.2;
  peer.isBellBug = false;
  peer.radius = 0.42;
  peer.yieldsTo = actor => actor.isBellBug;
  motion.owner.stepSupport = { surface: () => null };
  for (let frame = 0; frame < 30; frame++) {
    body.linearVelocity.set(0, -0.5, -1.15);
    assert.equal(motion.constrain(), false);
    assert.equal(Math.hypot(body.linearVelocity.x, body.linearVelocity.z), 0);
    assert.equal(body.linearVelocity.y, -0.5);
  }
  peer.position.z = -2;
  body.linearVelocity.set(0, -0.5, -1.15);
  assert.equal(motion.constrain(), true);
  assert.deepEqual(body.linearVelocity, new Vec3(0, -0.5, -1.15));
});
