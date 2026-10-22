import assert from 'node:assert/strict';
import test from 'node:test';
import {Entity,Vec3} from 'playcanvas';
import {CinderImp} from '../../../../../../src/game/objects/enemies/cinder-imp/CinderImp.js';

function setup(position) {
  const actors=[];
  const owner=new CinderImp({
    pc:{
      Entity,
      Vec3,
    },
    app:{systems:{rigidbody:{}}},
    runtime:{objects:actors},
    definition:{
      id:'navigation-imp',
      position,
    },
  });
  const royal={
    isRoyal:true,
    alive:true,
    entity:new Entity('actual royal'),
  };royal.entity.setPosition(1.5,0,1.5);
  const layout={
    origin:{
      x:0,
      y:0,
      z:0,
    },
    walkableAreas:[{
      minX:0,
      maxX:2,
      minZ:0,
      maxZ:2,
      floorY:0,
    }],
    authoredStairs:[],
    stairs:null,
    toLocal:(x,z)=>({
      x,
      z,
    }),
    toWorld:(x,z,y)=>({
      x,
      y,
      z,
    }),
  };
  const castle={
    residence:{
      layout,
      blocksMovementAt:()=>false,
    },
    entranceDoors:[],
  };actors.push(owner,royal,castle);owner.deltaTime=1/60;

  return {
    owner,
    royal,
    castle,
  };
}

test('castle planner returns a real floor waypoint without integrating the actual physics root',()=>{
  const {owner,royal}=setup({
    x:.5,
    y:0,
    z:.5,
  });const before=owner.position.clone();const waypoint=owner.navigation.next(royal);
  assert.ok(waypoint);assert.ok(waypoint.position.distance(before)>0);assert.ok(owner.position.distance(before)<1e-8);
  owner.entity.rigidbody={linearVelocity:new Vec3()};owner.moveToward(waypoint,1.056,0.001);
  assert.ok(owner.entity.rigidbody.linearVelocity.length()>0);assert.ok(owner.position.distance(before)<1e-8);owner.destroy();
});

test('outside pursuit approaches the real doorway and never silently opens a closed leaf',()=>{
  const {owner,royal,castle}=setup({
    x:.5,
    y:0,
    z:-2,
  });let opened=0;
  castle.entranceDoors=[.25,.75].map(x=>{
    const entity=new Entity('door');entity.setPosition(x,0,0);

    return {
      entity,
      blocksCameraAt:()=>true,
      openTemporarily:()=>opened++,
    };
  });
  const waypoint=owner.navigation.next(royal);assert.ok(waypoint.position.distance(new Vec3(.5,0,0))<1e-8);assert.equal(owner.resolveRoyalTarget(),royal);
  owner.entity.setPosition(.5,0,-.5);assert.equal(owner.navigation.next(royal),null);assert.equal(opened,0);owner.destroy();
});
