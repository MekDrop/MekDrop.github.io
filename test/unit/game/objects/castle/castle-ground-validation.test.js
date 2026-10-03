import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { validateCastleGround } from "../../../../../src/game/objects/castle/CastleGroundValidation.js";
const options={position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:"NORTH",offset:13,width:2}],seed:"castle-specific"};
function mapWith(buildPlan,terrain){return {cols:1,rows:1,grid:[[0]],heightmap:[[0]],tileMeta:[[{}]],objects:[{id:"castle-one",object:"Castle",buildPlan},terrain]};}
function terrainAt(layout,area,object="Earth",y=3.25){const point=layout.toWorld((area.minX+area.maxX)/2,(area.minZ+area.maxZ)/2,0);return {id:"test-terrain",object,position:{x:point.x,y,z:point.z},geometry:{method:"addBoxMatrix",args:["earth","earth",point.x,y,point.z,0,0.1,0.5,0.1]}};}
it("detects terrain in every authored ground room and permits Earth beneath its floor",async()=>{
  for(const side of ["NORTH","SOUTH","WEST","EAST"]){const cross=["WEST","EAST"].includes(side);const plan=await CastleGenerator.generate({...options,position:{...options.position,width:cross?16:28,depth:cross?28:16},doors:[{side,offset:13,width:2}]});const layout=new CastleResidentialLayout(plan);
    for(const room of plan.layout.roomPlan.placedRooms.filter(r=>r.floorY===3)){
      const earth=terrainAt(layout,room);const map=mapWith(plan,earth);
      assert.ok(validateCastleGround(map).some(issue=>issue.terrainId===earth.id&&issue.certainty==="confirmed"),room.id);
      earth.position.y=2.75;
      if (!room.id.includes("stair")) { assert.equal(validateCastleGround(map).length,0,room.id); }
    }
  }
});
it("rejects turf touching occupied room floors while allowing an open courtyard",async()=>{
  const plan=await CastleAuthoredBuildPlan.generate({...options,basePlanId:"castle-01"});const layout=new CastleResidentialLayout(plan);
  for(const room of plan.layout.roomPlan.placedRooms.filter(r=>r.floorY===3)){
    const grass=terrainAt(layout,room,"Grass",2.75);
    assert.ok(validateCastleGround(mapWith(plan,grass)).some(issue=>issue.kind==="grass-floor"),room.id);
  }
  const courtyard=plan.layout.roomPlan.spaces.find(s=>s.kind==="courtyard");
  assert.ok(courtyard);
  assert.equal(validateCastleGround(mapWith(plan,terrainAt(layout,courtyard,"Grass",2.75))).length,0);
});
it("detects penetrations in authored stair shafts",async()=>{
  const plan=await CastleGenerator.generate(options);const layout=new CastleResidentialLayout(plan);
  for(const stair of layout.authoredStairs){const terrain={id:stair.id,object:"Earth",position:{...stair.center,y:stair.center.y+0.5}};
    assert.ok(validateCastleGround(mapWith(plan,terrain)).some(issue=>issue.terrainId===stair.id));
  }
});
