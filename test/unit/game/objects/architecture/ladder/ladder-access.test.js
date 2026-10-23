import {castleStraightStairSurfaces,castleStraightStairStepCount} from '../../../../../../src/game/objects/castle/stairs/CastleStraightStairs.js';
import assert from 'node:assert/strict';
import {it} from 'node:test';
import {LadderInteraction} from '../../../../../../src/game/objects/architecture/ladder/LadderInteraction.js';
import {CastleGenerator} from '../../../../../../src/game/generator/castle/CastleGenerator.js';
import {CastleResidentialLayout} from '../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js';
import {CastleLadderMapObjects} from '../../../../../../src/game/objects/castle/stairs/CastleLadderMapObjects.js';

it('allows climbing both ways only beside the corresponding ladder landing',()=>{
  const points={
    bottom:{
      x:0,
      y:12,
      z:0,
    },
    top:{
      x:0,
      y:15,
      z:-1.125,
    },
  };
  let openings=0;
  const ladder={
    definition:{id:'ladder'},
    landing:end=>points[end],
    openHatch: () => {
      openings++;
    },
  };
  const hero={
    position:{...points.bottom},
    teleport(position){
      this.position={...position};

      return true;
    },
  };
  const up=new LadderInteraction(ladder,hero,'bottom');
  assert.equal(up.description.labelKey,'game.interaction.climb_ladder');
  assert.equal(up.interact(),true);assert.deepEqual(hero.position,points.top);
  assert.equal(up.interact(),false,'cannot use the lower interaction from the roof');
  const down=new LadderInteraction(ladder,hero,'top');
  assert.equal(down.interact(),true);assert.deepEqual(hero.position,points.bottom);
  assert.equal(openings,2,'both climb directions open the hatch');
  hero.position.x=5;assert.equal(up.interact(),false);
});
it('connects stairs to the ladder and retains supported landings around an open roof hatch',async()=>{
  for(const seed of [4,5]) {
    const build=await CastleGenerator.generate({
      position:{
        x:-14,
        z:-8,
        width:28,
        depth:16,
        elevation:3,
      },
      doors:[{
        side:'NORTH',
        offset:13,
        width:2,
      }],
      seed,
      basePlanId: "castle-compact-service-wing",
    });
    const layout=new CastleResidentialLayout(build);
    const plan=build.metadata.runtime.residential;
    const access=plan.roofAccess;
    const castlePlan=await import('../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js');
    const authored=await castlePlan.CastleBasePlanGenerator.generate({
      seed,
      baseY:3,
      planId: "castle-compact-service-wing",
    });
    const side=authored.buildings.find(building=>building.id==='base').maxX;
    const tower=authored.buildings.find(building=>building.id==='watchtower');
    const canonicalZ=(tower.minZ+tower.maxZ)/2;
    const gate=authored.entrance;
    const shared=layout.toWorld(gate.center-side,gate.coordinate-canonicalZ,1);
    assert.ok(!build.metadata.collision.cameraBlocks.some(block=>Math.abs(shared.x-block.x)<block.halfX&&Math.abs(shared.y-block.y)<block.halfY&&Math.abs(shared.z-block.z)<block.halfZ),'castle side wall does not divide the attached tower');
    assert.ok(access);
    assert.ok(!plan.furniture.some(item=>item.roomId==='crown-access-room'),'ladder wall has no lamp or other furnishing behind its rungs');
    const flights=plan.authoredStairs;
    const stairRooms=plan.spaces.filter(room=>room.furnish===false);
    assert.equal(stairRooms.length,2,'upper tower storeys remain unfurnished stair landings');
    assert.ok(stairRooms.every(room=>room.floorFinish==='stone'));
    assert.ok(!plan.furniture.some(item=>stairRooms.some(room=>room.id===item.roomId)||item.underStair&&item.floorY>=layout.origin.y),'storage stays in the lower stair pocket and clear of upper landings');
    for(const room of stairRooms.filter(room=>room.level>=1)) {
      const x=(room.minX+room.maxX)/2,z=room.maxZ+0.125;
      const point=layout.toWorld(x,z,room.floorY-layout.origin.y+0.75);
      assert.ok(!build.metadata.collision.cameraBlocks.some(block=>Math.abs(point.x-block.x)<block.halfX-1e-6&&Math.abs(point.y-block.y)<block.halfY-1e-6&&Math.abs(point.z-block.z)<block.halfZ-1e-6),'tower side wall has no inset wall or ledge inside the shaft');
    }
    const towerBuilding={
      minX:gate.center-tower.maxX,
      maxX:gate.center-tower.minX,
      minZ:gate.coordinate-tower.maxZ,
      maxZ:gate.coordinate-tower.minZ,
    };
    for(const room of plan.spaces.filter(space=>space.floorY>layout.origin.y&&space.id.includes('room'))) {
      if(room.minX<towerBuilding.minX||room.maxX>towerBuilding.maxX||room.minZ<towerBuilding.minZ||room.maxZ>towerBuilding.maxZ){
        continue;
      }
      for(const doorway of plan.openings.filter(opening=>opening.kind==='door'&&opening.roomId===room.id)) {
        for(const offset of [-0.49,0,0.49]) {
          const x=doorway.axis==='x'?doorway.coordinate+offset:doorway.center;
          const z=doorway.axis==='z'?doorway.coordinate+offset:doorway.center;
          assert.ok(plan.walkableAreas.some(area=>area.floorY===room.floorY&&x>=area.minX&&x<=area.maxX&&z>=area.minZ&&z<=area.maxZ),'upper tower door has continuous support across wall thickness');
        }
      }
    }
    assert.equal(new Set(flights.map(stair=>stair.yaw)).size,1,'all floors share one stair orientation');
    assert.equal(new Set(flights.map(stair=>stair.radius)).size,1,'all flights share one footprint');
    assert.ok(flights.every(stair=>stair.flightGap===0.5 && stair.flightShift===0 && stair.landingLift===0));
    for(const stair of flights) {
      const angle=(stair.yaw-layout.yaw)*Math.PI/180;
      for(const flight of castleStraightStairSurfaces(stair).filter(surface=>surface.low!==surface.high)) {
        const across=(flight.minX+flight.maxX)/2;
        for(let step=1;step<10;step++) {
          const along=flight.minZ+(flight.maxZ-flight.minZ)*step/10;
          const progress=flight.reverse?1-step/10:step/10;
          const count=castleStraightStairStepCount(flight);
          const footY=stair.center.y+flight.low+Math.min(count,Math.floor(progress*count+1e-6)+1)/count*(flight.high-flight.low);
          const x=stair.localCenter.x+across*Math.cos(angle)+along*Math.sin(angle);
          const z=stair.localCenter.z-across*Math.sin(angle)+along*Math.cos(angle);
          assert.ok(!plan.walkableAreas.some(area=>area.floorY>footY+0.32&&area.floorY-0.25<footY+1.45&&x>=area.minX&&x<=area.maxX&&z>=area.minZ&&z<=area.maxZ),'every flight clears the floor above');
        }
      }
    }
    const last=flights[flights.length-1];
    assert.ok(last.flightBounds,'flights span the room between its side walls');
    const angle=(last.yaw-layout.yaw)*Math.PI/180;
    const topLanding=castleStraightStairSurfaces(last)[3];
    const across=(topLanding.minX+topLanding.maxX)/2;
    const approach=last.radius+0.35;
    const start={
      x:last.localCenter.x+across*Math.cos(angle)+approach*Math.sin(angle),
      z:last.localCenter.z-across*Math.sin(angle)+approach*Math.cos(angle),
    };
    const end=layout.toLocal(access.bottom.x,access.bottom.z);
    for(let step=0;step<=20;step++) {
      const x=start.x+(end.x-start.x)*step/20;
      const z=start.z+(end.z-start.z)*step/20;
      assert.ok(plan.walkableAreas.some(area=>area.floorY===access.bottom.y&&x>=area.minX&&x<=area.maxX&&z>=area.minZ&&z<=area.maxZ),'top landing connects continuously to the ladder');
      const point=layout.toWorld(x,z,access.bottom.y-layout.origin.y);
      assert.ok(!build.metadata.collision.cameraBlocks.some(block=>point.y+1.45>block.y-block.halfY&&point.y+0.05<block.y+block.halfY&&Math.hypot(Math.max(Math.abs(point.x-block.x)-block.halfX,0),Math.max(Math.abs(point.z-block.z)-block.halfZ,0))<0.4),'ladder approach clears the full body');
    }
    const passage=layout.toLocal(access.bottom.x,access.bottom.z);
    for(let floorY=layout.origin.y;floorY<=access.bottom.y;floorY+=3) {
      assert.ok(plan.walkableAreas.some(area=>area.floorY===floorY&&passage.x>=area.minX&&passage.x<=area.maxX&&passage.z>=area.minZ&&passage.z<=area.maxZ),'west passage stays supported on every floor');
      assert.ok(!build.metadata.collision.cameraBlocks.some(block=>floorY+1.45>block.y-block.halfY&&floorY+0.05<block.y+block.halfY&&Math.hypot(Math.max(Math.abs(access.bottom.x-block.x)-block.halfX,0),Math.max(Math.abs(access.bottom.z-block.z)-block.halfZ,0))<0.4),'west passage clears the body on every floor');
    }
    assert.ok(plan.authoredStairs.some(stair=>stair.center.y+stair.rise===access.bottom.y));
    for(const end of ['bottom','top']) {
      const local=layout.toLocal(access[end].x,access[end].z);
      assert.ok(plan.walkableAreas.some(area=>area.floorY===access[end].y&&local.x>=area.minX&&local.x<=area.maxX&&local.z>=area.minZ&&local.z<=area.maxZ),end+' has a supported landing');
    }
    const hole=access.hole;
    assert.ok(!plan.walkableAreas.some(area=>area.floorY===access.top.y&&area.minX<hole.maxX&&area.maxX>hole.minX&&area.minZ<hole.maxZ&&area.maxZ>hole.minZ),'roof slab leaves ladder shaft open');
    const map={
      cols:64,
      rows:64,
      objects:[{
        id:'castle',
        object:'Castle',
        buildPlan:build,
      }],
    };
    CastleLadderMapObjects.prepareMap(map);CastleLadderMapObjects.prepareMap(map);
    assert.equal(map.objects.filter(item=>item.object==='Ladder').length,1 + (plan.atticAccesses?.length ?? 0),'preparation is repeatable');
    const ladder=map.objects.find(item=>item.id==='castle-crown-ladder');
    assert.equal(ladder.opening.position.y,access.top.y);
    assert.ok(ladder.opening.width>0&&ladder.opening.depth>0,'hatch has the roof aperture dimensions');
  }
});

