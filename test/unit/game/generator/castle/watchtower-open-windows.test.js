import assert from 'node:assert/strict';
import {it} from 'node:test';
import {CastleBasePlanGenerator} from '../../../../../src/game/generator/castle/CastleBasePlanGenerator.js';
import {CastleGenerator} from '../../../../../src/game/generator/castle/CastleGenerator.js';
import {CastleWindowLayout} from '../../../../../src/game/objects/castle/CastleWindowLayout.js';

it('places glazed lookout windows on the two exterior corner faces',async()=>{
  const source=(await CastleBasePlanGenerator.plans).find(p=>p.id==='castle-compact-service-wing');
  const lookout=source.levels.find(l=>l.index===2).spaces[0];
  const tower=source.buildings.find(b=>b.id==='watchtower');
  assert.ok(tower.height/tower.bounds[2]>2,'tower has a tall, narrow silhouette');
  assert.ok(tower.bounds[0]+tower.bounds[2]>source.buildings[0].bounds[0]+source.buildings[0].bounds[2]+3,'attached tower projects from the side wall');
  assert.ok(tower.bounds[1]>1 && tower.bounds[1]+tower.bounds[3]<7,'tower sits along the middle of the side wall');
  assert.deepEqual(lookout.openings.map(o=>o.side),['SOUTH','EAST']);
  for(const opening of lookout.openings) {
    assert.notEqual(opening.open,true);
    assert.equal(opening.bottom,0.75);
    assert.ok(opening.width>=1.25 && opening.height>=1.75);
  }
  for(const seed of [4,5]) {
    const plan=await CastleGenerator.generate({position:{x:-14,z:-8,width:28,depth:16,elevation:3},doors:[{side:'NORTH',offset:13,width:2}],seed});
    assert.equal(plan.geometry.decorations.roofs.length,0,'defensive tower crown has no domestic pitched roof');
    assert.ok(plan.layout.roomPlan.walkableAreas.some(area=>area.id==='roof:watchtower-roof'),'flat crown retains its platform');
    const windows=new CastleWindowLayout(plan);
    const open=windows.windows.filter(w=>w.floorY===9);
    assert.ok(open.every(w=>!w.open),'lookout retains its glass and wooden window inserts');
    assert.equal(open.length,2);
    const masonry=windows.cutBoxes(plan.geometry.boxes);
    for(const window of open) {
      assert.equal(window.floorY,9);
      assert.ok(!masonry.some(box=>CastleWindowLayout.intersects(CastleWindowLayout.bounds(box),window.cut)));
    }
    assert.ok(windows.windows.some(w=>!w.open),'ordinary windows stay glazed');
  }
});
