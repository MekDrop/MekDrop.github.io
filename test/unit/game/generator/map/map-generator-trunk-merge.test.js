import assert from 'node:assert/strict';
import {it} from 'node:test';
import {MapGenerator} from '../../../../../src/game/generator/map/MapGenerator.js';
import {PathTopology} from '../../../../../src/game/generator/map/PathTopology.js';
it('loads muk76amh_1dmmup1 with separated two-lane merges and the compact castle',async()=>{
 const options={mapName:'muk76amh_1dmmup1'};
 const first=await MapGenerator.generate(options), second=await MapGenerator.generate(options);
 assert.equal(first.mapName,options.mapName);
 assert.equal(PathTopology.findUnexpectedFlatPathCrossing(first.grid,null),null);
 assert.deepEqual(first.grid,second.grid);
 const castle=first.objects.find(object=>object.object==='Castle');
 assert.equal(castle.buildPlan.metadata.runtime.residential.basePlanId,'castle-demo-compact');
 assert.ok(first.paths.every(path=>path.route.length>0));
});

it('places the castle doorway on the final two-lane route endpoint',async()=>{
 const map=await MapGenerator.generate({mapName:'muk76amh_1dmmup1'});
 const castle=map.objects.find(object=>object.object==='Castle'),plan=castle.buildPlan;
 const origin=plan.metadata.runtime.residential.origin;
 const door=plan.input.doors[0],position=plan.input.position;
 assert.equal(origin.x,position.x);
 assert.equal(origin.z,position.z+door.offset+door.width/2);
 for(const path of map.paths){const end=path.route.at(-1);
  const x=end.col-(map.cols-1)/2,z=end.row-(map.rows-1)/2;
  assert.ok(Math.abs(x-origin.x)<=.5&&Math.abs(z-origin.z)<1e-6,'route meets the actual doorway, not an unused footprint corner');
 }
});

it('reserves terrain in proportion to the compact castle footprint',async()=>{
 const map=await MapGenerator.generate({mapName:'muk76amh_1dmmup1'});
 const position=map.objects.find(object=>object.object==='Castle').buildPlan.input.position;
 assert.equal(position.width,10,'eight-metre castle depth plus one tile on each side');
 assert.equal(position.depth,9,'seven-metre castle width plus one tile on each side');
 assert.ok(position.width*position.depth<16*28/3,'avoid the legacy oversized plateau reservation');
});
