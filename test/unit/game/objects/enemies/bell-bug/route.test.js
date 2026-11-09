import assert from 'node:assert/strict';
import test from 'node:test';
import { Vec3 } from 'playcanvas';
import { BellBugRoute } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugRoute.js';
import { BellBugPursueState } from '../../../../../../src/game/objects/enemies/bell-bug/states/BellBugPursueState.js';
import { EnemyPathLane } from '../../../../../../src/game/navigation/EnemyPathLane.js';

function fixture() {
  const entry={
    col:0,
    rows:[0,1],
  };
  const route=[{
    col:0,
    row:0,
    elevation:2,
  },{
    col:0,
    row:2,
    elevation:2,
  },{
    col:2,
    row:2,
    elevation:2,
  }];
  const owner={
    definition:{gatewayId:'gate'},
    position:new Vec3(0,2,0),
    runtime:{
      mapData:{
        objects:[{
          id:'gate',
          entry,
        }],
        paths:[{
          entry,
          route,
        }],
      },
    },
    pathLane:{routePoint:(points,index)=>new Vec3(points[index].col,points[index].elevation,points[index].row)},
  };

  return {
    owner,
    cursor:new BellBugRoute(owner),
  };
}

test('gateway path nodes are followed through a bend and finish at the route end',()=>{
  const {owner,cursor}=fixture();
  assert.deepEqual(cursor.next().position,new Vec3(0,2,2));
  owner.position.set(0,2,2);
  assert.deepEqual(cursor.next().position,new Vec3(2,2,2));
  owner.position.set(2,2,2);
  assert.equal(cursor.next(),null);
});

test('climbing castle treads advances past terrain-height route nodes',()=>{
  const {owner,cursor}=fixture();
  owner.pc={Vec3};
  owner.radius=.6;
  owner.runtime.mapData.cols=1;
  owner.runtime.mapData.rows=1;
  owner.doorOwners=[{
    capsuleSupportHeightAt:(x,z)=>z===2 ? 2.5+x*.25 : null,
  }];
  owner.pathLane=new EnemyPathLane(owner);
  assert.deepEqual(cursor.next().position,new Vec3(0,2.5,2));
  owner.position.set(0,2.5,2);
  assert.deepEqual(cursor.next().position,new Vec3(2,3,2));
  owner.position.set(2,3,2);
  assert.equal(cursor.next(),null);
});

test('a passing detour can advance beyond a path node without walking back into traffic',()=>{
  const {owner,cursor}=fixture();cursor.next();
  owner.position.set(.8,2,2.1);
  assert.deepEqual(cursor.next().position,new Vec3(2,2,2));
  owner.definition.gatewayId='unknown';
  assert.equal(cursor.next(),null,'an unrelated gateway path is never selected');
});

test('pursuit follows its route even when there is no royal target yet',()=>{
  const target={position:new Vec3(0,2,2)},moves=[],clips=[];
  const owner={
    route:{next:()=>target},
    scoop:{target:null},
    resolveRoyalTarget:()=>null,
    findGluedDoor:()=>null,
    canScratchDoor:false,
    walkSpeed:1.15,
    moveToward:point=>{
      moves.push(point);

      return true;
    },
    playClip:clip=>clips.push(clip),
  };
  new BellBugPursueState().execute(owner);
  assert.deepEqual(moves,[target]);
  assert.deepEqual(clips,['scuttle_walk']);
});

test('a distant jammed door cannot divert a bug off its authored road',()=>{
  const waypoint={position:new Vec3(1,2,0)};
  const door={jammed:true};
  const moves=[];
  const owner={
    route:{next:()=>waypoint},
    scoop:{target:null},
    resolveRoyalTarget:()=>({position:new Vec3(10,3,0)}),
    findGluedDoor:()=>null,
    findClosedDoor:()=>door,
    canScratchDoor:false,
    walkSpeed:1.15,
    distanceTo:()=>10,
    moveToward:target=>{
      moves.push(target);

      return true;
    },
    playClip:()=>{},
  };
  new BellBugPursueState().execute(owner);
  assert.deepEqual(moves,[waypoint]);
});

test('after its gate route, a closed room leaf takes approach priority over an off-center royal',()=>{
  const door={position:new Vec3(2,3,0)},royal={position:new Vec3(4,3,2)},moves=[];
  const owner={
    route:{next:()=>null},
    scoop:{target:null},
    resolveRoyalTarget:()=>royal,
    findGluedDoor:()=>null,
    findClosedDoor:()=>door,
    canScratchDoor:false,
    walkSpeed:1.15,
    distanceTo:()=>3,
    moveToward:target=>{
      moves.push(target);

      return true;
    },
    playClip:()=>{},
  };
  new BellBugPursueState().execute(owner);
  assert.deepEqual(moves,[door]);
});

test('nearby goo cleanup keeps the route cursor current before pursuit resumes',()=>{
  const waypoints=[{position:new Vec3(1,2.25,0)},{position:new Vec3(2,2.75,0)}];
  const door={jammed:true};
  const moves=[];
  let index=0;
  let localDoor=door;
  const owner={
    route:{next:()=>waypoints[index++]},
    scoop:{target:null},
    resolveRoyalTarget:()=>({position:new Vec3(10,3,0)}),
    findGluedDoor:()=>localDoor,
    findClosedDoor:()=>null,
    canScratchDoor:false,
    walkSpeed:1.15,
    distanceTo:()=>10,
    moveToward:target=>{
      moves.push(target);

      return true;
    },
    playClip:()=>{},
  };
  const state=new BellBugPursueState();
  state.execute(owner);
  localDoor=null;
  state.execute(owner);
  assert.deepEqual(moves,[door,waypoints[1]],'cleanup must not leave a stale ground waypoint behind');
});

test('intermittent sight of a jammed door never creates a forward-backward road loop',()=>{
  const entry={
    col:0,
    rows:[0,1],
  };
  const route=Array.from({length:21},(_,index)=>({
    col:index*.5,
    row:0,
    elevation:0,
  }));
  const royal={position:new Vec3(20,0,.5)};
  const door={
    jammed:true,
    position:new Vec3(18,0,.5),
  };
  const owner={
    pc:{Vec3},
    definition:{
      id:'bug',
      gatewayId:'gate',
    },
    position:new Vec3(0,0,.5),
    radius:.254,
    usesPathCrowdAvoidance:false,
    runtime:{
      mapData:{
        cols:1,
        rows:1,
        objects:[{
          id:'gate',
          entry,
        }],
        paths:[{
          entry,
          route,
        }],
      },
    },
    scoop:{target:null},
    resolveRoyalTarget:()=>royal,
    findGluedDoor:()=>null,
    findClosedDoor:()=>owner.position.x>=3&&owner.position.x<6 ? door : null,
    canScratchDoor:false,
    walkSpeed:1.15,
    distanceTo:()=>20,
    playClip:()=>{},
    moveToward:target=>{
      const point=owner.pathLane.next(target.position);
      const direction=point.clone().sub(owner.position);
      if (direction.length()>.05) {
        owner.position.add(direction.normalize().mulScalar(.02));
      }

      return true;
    },
  };
  owner.pathLane=new EnemyPathLane(owner);
  owner.pathLane.side=1;
  owner.route=new BellBugRoute(owner);
  const state=new BellBugPursueState();
  for(let frame=0;frame<600;frame++) {
    const previous=owner.position.x;
    state.execute(owner);
    assert.ok(owner.position.x>=previous,'a changing royal sightline must not reverse road progress');
  }
  assert.ok(owner.position.x>10,'the bug completes its road instead of oscillating at the sightline boundary');
});
