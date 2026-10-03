import assert from 'node:assert/strict';
import {it} from 'node:test';
import {CastleGenerator} from '../../../../../src/game/generator/castle/CastleGenerator.js';
import {CastleResidentialLayout} from '../../../../../src/game/objects/castle/CastleResidentialLayout.js';
import {MOVEMENT_COLLISION_RADIUS,HERO_COLLISION_HEIGHT} from '../../../../../src/game/objects/hero/HeroSurfaceRules.js';

it('supports both sides of every interior door and clears the hero body',async()=>{
  const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:'NORTH',offset:13,width:2}],seed:1});
  const layout=new CastleResidentialLayout(plan);
  assert.ok(!plan.layout.roomPlan.spaces.some(s=>s.id==='study'&&s.level===0));
  const throne=plan.layout.roomPlan.spaces.find(s=>s.id==='throne-hall');
  const circulation=plan.layout.roomPlan.spaces.find(s=>s.id==='vestibule-south');
  assert.ok(throne.minX<circulation.minX, 'throne occupies the formerly open room beside the entrance');
  const throneDoor=plan.layout.roomPlan.doorways.find(d=>d.roomId==='throne-hall'&&!d.exteriorEntrance);
  assert.ok(throneDoor.center<throne.minZ+1.5, 'connecting door stays at the front, away from the throne rear');
  for(const door of plan.layout.roomPlan.doorways.filter(d=>!d.exteriorEntrance)) {
    for(const normal of [-.6,0,.6]) {
      for(const lateral of [-.15,0,.15]) {
        const x=door.axis==='x'?door.coordinate+normal:door.center+lateral;
        const z=door.axis==='z'?door.coordinate+normal:door.center+lateral;
        assert.ok(layout.walkableAreas.some(a=>a.floorY===door.floorY&&x>=a.minX&&x<=a.maxX&&z>=a.minZ&&z<=a.maxZ),`${door.roomId}: supported landing ${normal}/${lateral}`);
        const point=layout.toWorld(x,z,door.floorY-layout.origin.y);
        assert.ok(!plan.metadata.collision.cameraBlocks.some(b=>point.y+HERO_COLLISION_HEIGHT>b.y-b.halfY&&point.y+.05<b.y+b.halfY&&Math.hypot(Math.max(Math.abs(point.x-b.x)-b.halfX,0),Math.max(Math.abs(point.z-b.z)-b.halfZ,0))<MOVEMENT_COLLISION_RADIUS),`${door.roomId}: clear body ${normal}/${lateral}`);
      }
    }
  }
});

it('keeps landing slabs above the walking lane out of hero headroom',async()=>{
  const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:'NORTH',offset:13,width:2}],seed:1});
  const layout=new CastleResidentialLayout(plan);
  for(const stair of layout.authoredStairs) for(let step=1;step<stair.steps;step++) {
    const angle=Math.PI/2-stair.yaw*Math.PI/180-step/stair.steps*stair.turns*Math.PI*2;
    const point=layout.toLocal(stair.center.x+Math.cos(angle)*stair.radius*.375/.65,stair.center.z+Math.sin(angle)*stair.radius*.375/.65);
    const footY=stair.center.y+stair.rise*(step+1)/stair.steps;
    for(const area of layout.walkableAreas) {
      if(area.floorY<=footY+.32||area.floorY-.25>=footY+HERO_COLLISION_HEIGHT)continue;
      const distance=Math.hypot(Math.max(area.minX-point.x,point.x-area.maxX,0),Math.max(area.minZ-point.z,point.z-area.maxZ,0));
      assert.ok(distance>=MOVEMENT_COLLISION_RADIUS,stair.id+' step '+step+' ceiling '+area.id);
    }
  }
});


it('does not fill authored stair openings with the legacy room floor',async()=>{
  const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:'NORTH',offset:13,width:2}],seed:1});
  const layout=new CastleResidentialLayout(plan);
  const stair=layout.authoredStairs.find(s=>s.center.y<layout.origin.y);
  const progress=14.5/stair.steps,angle=Math.PI/2-stair.yaw*Math.PI/180-progress*stair.turns*Math.PI*2;
  const x=stair.center.x+Math.cos(angle)*stair.radius*.375/.65;
  const z=stair.center.z+Math.sin(angle)*stair.radius*.375/.65;
  assert.equal(layout.surfaceHeightAt(x,z,layout.origin.y),null);
});


it('keeps the kitchen entry aisle clear of generated furniture',async()=>{
  const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:'NORTH',offset:13,width:2}],seed:1});
  const roomPlan=plan.metadata.runtime.residential;
  const door=roomPlan.doorways.find(d=>d.roomId==='kitchen');
  const kitchen=roomPlan.placedRooms.find(r=>r.id==='kitchen');
  const inward=Math.sign((kitchen.minX+kitchen.maxX)/2-door.coordinate);
  for(const distance of [0,.3,.6,.9])for(const lateral of [-.2,0,.2]) {
    const x=door.coordinate+inward*distance,z=door.center+lateral;
    for(const item of roomPlan.furniture.filter(i=>i.roomId==='kitchen')) {
      const separation=Math.hypot(Math.max(Math.abs(x-item.x)-item.width*item.scale/2,0),Math.max(Math.abs(z-item.z)-item.depth*item.scale/2,0));
      assert.ok(separation>=MOVEMENT_COLLISION_RADIUS,item.role+' obstructs the kitchen door');
    }
  }
  assert.ok(!roomPlan.furniture.some(i=>i.roomId==='kitchen'&&i.role==='servantBed'));
});

it('faces both ends of each compact flight toward its nearest same-floor door',async()=>{
for(const side of ['NORTH','SOUTH','EAST','WEST']) {
const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side,offset:13,width:2}],seed:1});
const layout=new CastleResidentialLayout(plan);
for(const stair of layout.authoredStairs) {
const doors=plan.metadata.runtime.roomDoors.filter(d=>d.y===stair.center.y);
const door=doors.reduce((best,d)=>Math.hypot(d.x-stair.center.x,d.z-stair.center.z)<Math.hypot(best.x-stair.center.x,best.z-stair.center.z)?d:best);
assert.equal(stair.entryDoorId,door.roomId);
for(const progress of [0,1]) {
const angle=stair.yaw*Math.PI/180+progress*stair.turns*2*Math.PI;
const dx=door.x-stair.center.x,dz=door.z-stair.center.z;
assert.ok((Math.sin(angle)*dx+Math.cos(angle)*dz)/Math.hypot(dx,dz)>.95,'entry and exit face the door side');
}
}
}
});

it('covers ground-floor circulation seams and excavates terrain beneath the slab',async()=>{
 const {createCastleGroundCuts}=await import('../../../../../src/game/objects/castle/CastleGroundCuts.js');
 for(const side of ['NORTH','SOUTH','WEST','EAST']){
  const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side,offset:13,width:2}],seed:1});
  const layout=new CastleResidentialLayout(plan),cuts=createCastleGroundCuts(plan,layout);
  const seams=layout.walkableAreas.filter(area=>area.id==='ground-slab:base');
  assert.ok(seams.length,'building slab fills the gaps omitted by room interiors');
  for(const area of seams){
   const point=layout.toWorld((area.minX+area.maxX)/2,(area.minZ+area.maxZ)/2);
   assert.ok(cuts.some(cut=>point.x>=cut.minX-1e-6&&point.x<=cut.maxX+1e-6&&point.z>=cut.minZ-1e-6&&point.z<=cut.maxZ+1e-6&&cut.minY<=area.floorY-.25),'terrain stays beneath the entire structural floor');
  }
 }
});
