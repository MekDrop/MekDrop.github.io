import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { LatchSlugNavigation } from "../../../../../../src/game/objects/enemies/latch-slug/LatchSlugNavigation.js";

function fixture(rise = .25) {
  const entity = new pc.Entity();
  const forces = [];
  entity.rigidbody = {
    linearVelocity:new pc.Vec3(),
    mass:1,
    applyForce:(x,y,z)=>forces.push([x,y,z]),
  };
  const door = {
    entity:new pc.Entity(),
    blocksCameraAt:()=>true,
  };
  door.entity.setPosition(0,1,0);
  const castle = {
    destructibleDoors:[door],
    capsuleSupportHeightAt:()=>.75,
  };
  const moves = [];
  const owner = {
    pc,
    elapsed:0,
    entity,
    position:new pc.Vec3(0,0,2.4),
    radius:.42,
    height:.84,
    actors:[castle],
    app:{
      systems:{
        rigidbody:{
          gravity:new pc.Vec3(0,-9.81,0),
          raycastFirst:(from,to)=>Math.abs(from.y-to.y)>.01?{
            point:new pc.Vec3(from.x,rise,from.z),
            normal:new pc.Vec3(0,1,0),
          }:null,
        },
      },
    },
    moveToward:(target,speed)=>moves.push({
      target,
      speed,
    }),
  };

  return {
    owner,
    door,
    castle,
    moves,
    forces,
    navigation:new LatchSlugNavigation(owner),
  };
}

test("uses the authored entrance stairs and a measured quarter-tile Ammo step without teleporting",()=>{
  const {owner,door,moves,navigation,forces}=fixture();
  const before=owner.position.clone();
  assert.equal(navigation.approachDoor(door),true);
  assert.equal(moves.length,1);
  assert.ok(moves[0].target.position.z<owner.position.z);
  assert.ok(owner.entity.rigidbody.linearVelocity.y>0);
  assert.ok(owner.entity.rigidbody.linearVelocity.y<=0.6,"stairs use a slow climb, never a jump impulse");
  assert.deepEqual(forces, [[0,9.81,0]],"contact grip counters gravity through Ammo force");
  assert.equal(navigation.crawling,true);
  assert.deepEqual(owner.position,before);
  owner.position.y=.75;
  owner.position.z=.7;
  assert.equal(navigation.approachDoor(door),false,"top tread is ready for the door leap");
  owner.elapsed=1;
  assert.equal(navigation.crawling,false,"normal speed returns after leaving the treads");
});

test("does not turn a high obstacle into a step or invent a staircase where none exists",()=>{
  const {owner,door,castle,navigation}=fixture(.5);
  navigation.approachDoor(door);
  assert.equal(owner.entity.rigidbody.linearVelocity.y,0);
  castle.capsuleSupportHeightAt=()=>null;
  assert.equal(navigation.approachDoor(door),false);
});

test("uses the same slow contact motor when descending a low tread", () => {
  const { owner, door, navigation } = fixture(-0.25);
  navigation.approachDoor(door);
  assert.ok(owner.entity.rigidbody.linearVelocity.y < 0);
  assert.ok(owner.entity.rigidbody.linearVelocity.y >= -0.6);
});

test("steers around an idle Bell Bug's complete footprint instead of driving into its collider", () => {
  const {owner,navigation}=fixture(0);
  const bug={
    isBellBug:true,
    alive:true,
    footprintRadius:.45,
    height:.515,
    position:new pc.Vec3(0,0,1.3),
    entity:new pc.Entity(),
  };
  bug.entity.rigidbody={enabled:true};
  owner.actors=[bug];owner.targetPosition=actor=>actor.position;
  const next=navigation.next({position:new pc.Vec3(0,0,-3)});
  assert.ok(Math.abs(next.position.x)>.1, 'an available passing side is used');
  assert.ok(Math.hypot(next.position.x-bug.position.x,next.position.z-bug.position.z)>.9);
  bug.position.y=2;
  assert.ok(Math.abs(navigation.next({position:new pc.Vec3(0,0,-3)}).position.x)<.01, 'another floor is not an obstruction');
});
