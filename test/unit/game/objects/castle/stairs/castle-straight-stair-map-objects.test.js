import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleStraightStairMapObjects } from "../../../../../../src/game/objects/castle/stairs/CastleStraightStairMapObjects.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { castleStraightStairAssemblies, castleStraightStairSurfaces } from "../../../../../../src/game/objects/castle/stairs/CastleStraightStairs.js";

it("emits stable complete staircase objects in every castle orientation and replaces stale definitions", async () => {
  for (const side of ["NORTH","SOUTH","EAST","WEST"]) {
    const buildPlan=await CastleAuthoredBuildPlan.generate({
      basePlanId:"castle-demo-compact",
      position:{
        x:-14,
        z:-8,
        width:28,
        depth:16,
        elevation:3,
      },
      doors:[{
        side,
        offset:5,
        width:2,
      }],
      seed:1,
    });
    const castle={
      id:"castle",
      object:"Castle",
      buildPlan,
    };
    const standalone={
      id:"standalone",
      object:"StraightStaircase",
      position:{
        x:0,
        y:0,
        z:0,
      },
      radius:1.35,
      rise:3,
    };
    const map={
      cols:80,
      rows:80,
      objects:[castle,standalone],
    };
    const expected=castleStraightStairAssemblies(new CastleResidentialLayout(buildPlan));
    CastleStraightStairMapObjects.prepareMap(map);
    const stairs=map.objects.filter(item=>item.sourceCastleId==="castle");
    assert.equal(stairs.length,expected.length);
    assert.ok(stairs.length>1);
    for (const [index,stair] of stairs.entries()) {
      assert.equal(stair.object,"StraightStaircase");
      assert.deepEqual(stair.position,expected[index].center);
      assert.equal(stair.rotation,expected[index].yaw);
      assert.deepEqual(castleStraightStairSurfaces(stair),castleStraightStairSurfaces(expected[index]));
      assert.equal(stair.exitFloorOwned,true);
      assert.deepEqual(stair.tile,{
        col:26,
        row:32,
      },"entire castle shares footprint island ownership");
    }
    assert.equal(stairs.filter(stair=>!stair.continuesAbove).length,1,"only the highest flight guards the opening");
    const snapshot=JSON.stringify(map.objects);
    CastleStraightStairMapObjects.prepareMap(map);
    assert.equal(JSON.stringify(map.objects),snapshot,"preparation is idempotent");
    map.objects=map.objects.filter(item=>item!==castle);
    CastleStraightStairMapObjects.prepareMap(map);
    assert.deepEqual(map.objects,[standalone],"stale generated assemblies are removed without touching authored ones");
  }
});
