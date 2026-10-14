import assert from 'node:assert/strict';
import {it} from 'node:test';
import {CastleGenerator} from '../../../../../src/game/generator/castle/CastleGenerator.js';
import {CastleResidentialLayout} from '../../../../../src/game/objects/castle/CastleResidentialLayout.js';
import {MOVEMENT_COLLISION_RADIUS,HERO_COLLISION_HEIGHT} from '../../../../../src/game/objects/hero/HeroSurfaceRules.js';

it('gives each entrance-floor room a clear doorway onto the shared hall',async()=>{
  for (const seed of [4,5]) {
    const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:'NORTH',offset:13,width:2}],seed});
    const layout=new CastleResidentialLayout(plan);
    const entry=plan.layout.roomPlan.doorways.find(door=>door.exteriorEntrance);
    for(const normal of [-0.45,0,0.45]) {
      for(const lateral of [-0.5,0,0.5]) {
        const x=entry.axis==='x'?entry.coordinate+normal:entry.center+lateral;
        const z=entry.axis==='z'?entry.coordinate+normal:entry.center+lateral;
        const point=layout.toWorld(x,z,entry.floorY-layout.origin.y);
        assert.ok(!plan.metadata.collision.cameraBlocks.some(block=>point.y+HERO_COLLISION_HEIGHT>block.y-block.halfY&&point.y+0.05<block.y+block.halfY&&Math.hypot(Math.max(Math.abs(point.x-block.x)-block.halfX,0),Math.max(Math.abs(point.z-block.z)-block.halfZ,0))<0.4),'tower clears both lanes of the main entrance');
      }
    }
    const doors=plan.layout.roomPlan.doorways.filter(d=>['service-quarters','throne-hall','stair-room'].includes(d.roomId) && d.floorY===layout.origin.y);
    assert.equal(doors.length,3);
    for (const hall of plan.layout.roomPlan.spaces.filter(room=>room.id.startsWith('vestibule'))) {
      const id=hall.id;
      const alongX=hall.maxX-hall.minX>hall.maxZ-hall.minZ;
      for(let progress=0.1;progress<0.95;progress+=0.1) {
        const x=alongX?hall.minX+(hall.maxX-hall.minX)*progress:(hall.minX+hall.maxX)/2;
        const z=alongX?(hall.minZ+hall.maxZ)/2:hall.minZ+(hall.maxZ-hall.minZ)*progress;
        const point=layout.toWorld(x,z,hall.floorY-layout.origin.y);
        assert.ok(!plan.metadata.collision.cameraBlocks.some(b=>point.y+HERO_COLLISION_HEIGHT>b.y-b.halfY&&point.y+.05<b.y+b.halfY&&Math.hypot(Math.max(Math.abs(point.x-b.x)-b.halfX,0),Math.max(Math.abs(point.z-b.z)-b.halfZ,0))<MOVEMENT_COLLISION_RADIUS),id+' keeps its shared route clear');
      }
    }
    for (const door of doors) {
    assert.ok(door.width >= 1);
    for(let normal=-0.6;normal<=0.6;normal+=0.1) {
      for(const lateral of [-0.2,0,0.2]) {
        const x=door.axis==='x'?door.coordinate+normal:door.center+lateral;
        const z=door.axis==='z'?door.coordinate+normal:door.center+lateral;
        assert.ok(layout.walkableAreas.some(a=>a.floorY===door.floorY&&x>=a.minX&&x<=a.maxX&&z>=a.minZ&&z<=a.maxZ),'floor supports the doorway approach');
        const point=layout.toWorld(x,z,door.floorY-layout.origin.y);
        assert.ok(!plan.metadata.collision.cameraBlocks.some(b=>point.y+HERO_COLLISION_HEIGHT>b.y-b.halfY&&point.y+.05<b.y+b.halfY&&Math.hypot(Math.max(Math.abs(point.x-b.x)-b.halfX,0),Math.max(Math.abs(point.z-b.z)-b.halfZ,0))<MOVEMENT_COLLISION_RADIUS),`${door.roomId} ${normal}/${lateral}: doorway clears the hero body`);
      }
    }
    }
  }
});
