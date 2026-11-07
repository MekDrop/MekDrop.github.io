import assert from 'node:assert/strict';
import test from 'node:test';
import { Vec3 } from 'playcanvas';
import { BellBugRoute } from '../../../../../../src/game/objects/enemies/bell-bug/BellBugRoute.js';
import { BellBugPursueState } from '../../../../../../src/game/objects/enemies/bell-bug/states/BellBugPursueState.js';

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
