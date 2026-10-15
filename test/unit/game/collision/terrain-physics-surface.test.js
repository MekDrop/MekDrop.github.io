import assert from 'node:assert/strict';
import {it} from 'node:test';
import {subtractTerrainCutouts} from '../../../../src/game/collision/TerrainSurfaceCutouts.js';
import {MapGenerator} from '../../../../src/game/generator/map/MapGenerator.js';
import {CastleMapPreparation} from '../../../../src/game/objects/castle/CastleMapPreparation.js';
import {TerrainPhysicsSurface} from '../../../../src/game/collision/TerrainPhysicsSurface.js';

const area = polygons => polygons.reduce((sum,p)=>sum+Math.abs(p.reduce((value,a,i)=>{const b=p[(i+1)%p.length];return value+a[0]*b[2]-b[0]*a[2];},0))/2,0);
it('subtracts a partial excavation while retaining the sloped surface plane',()=>{
  const polygon=[[0,2,0],[2,4,0],[2,4,2],[0,2,2]];
  const result=subtractTerrainCutouts(polygon,[{
    minX:.5,
    maxX:1.5,
    minY:2.75,
    maxY:3.25,
    minZ:0,
    maxZ:2,
  }]);
  assert.equal(area(result),3);
  for(const piece of result)for(const [x,y]of piece)assert.equal(y,x+2);
  assert.equal(area(subtractTerrainCutouts(polygon,[{
    minX:0,
    maxX:2,
    minY:-3,
    maxY:1,
    minZ:0,
    maxZ:2,
  }])),4);
});
it('leaves a physical basement opening and retains the surrounding terrain',()=>{
  let mesh;
  const pc={
    Entity:class{tags={add(){}};addComponent(type,value){this[type]=value;}removeComponent(type){delete this[type];}destroy(){}},
    Mesh:class{constructor(){mesh=this;}setPositions(value){this.positions=value;}setIndices(value){this.indices=value;}update(){}destroy(){}},
    StandardMaterial:class{update(){}destroy(){}},
    GraphNode:class{},
    MeshInstance:class{},
    Model:class{},
  };
  const surface=new TerrainPhysicsSurface({
    pc,
    app:{graphicsDevice:{}},
    collisionWorld:null,
    mapData:{
      rows:1,
      cols:1,
      grid:[[3]],
      heightmap:[[2]],
      tileMeta:[[{
        terrainCutouts:[{
          minX:-.25,
          maxX:.25,
          minZ:-.25,
          maxZ:.25,
          minY:-1,
          maxY:Number.MAX_VALUE,
        }],
      }]],
    },
  });
  const topTriangles=[];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = mesh.indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3));
    const isTopVertex = p => p[1] === 2;
    if (points.every(isTopVertex)) topTriangles.push(points);
  }
  assert.equal(area(topTriangles),.75);
  for(const triangle of topTriangles){const x=triangle.reduce((v,p)=>v+p[0],0)/3,z=triangle.reduce((v,p)=>v+p[2],0)/3;assert.ok(Math.abs(x)>=.25||Math.abs(z)>=.25);}
  surface.destroy();
});

it('keeps repeated touching excavation cuts from multiplying coplanar faces',()=>{
  const polygon=[[0,2,0],[2,2,0],[2,2,2],[0,2,2]];
  const cuts=Array.from({length:40},()=>({
    minX:0,
    maxX:2,
    minY:2,
    maxY:4,
    minZ:0,
    maxZ:2,
  }));
  const result=subtractTerrainCutouts(polygon,cuts);
  assert.deepEqual(result,[polygon]);
  assert.equal(area(result),4);
});
it('discards zero-area fragments from repeated intersecting excavations',()=>{
  const polygon=[[0,2,0],[2,2,0],[2,2,2],[0,2,2]];
  const cut={
    minX:0,
    maxX:1,
    minY:1,
    maxY:3,
    minZ:0,
    maxZ:2,
  };
  const result=subtractTerrainCutouts(polygon,Array.from({length:40},()=>cut));
  assert.equal(area(result),2);
  assert.equal(result.length,1);
  assert.ok(result.every(piece=>area([piece])>0));
});

it('keeps generated map 4 terrain collision bounded after castle excavation',async()=>{
  const map=await MapGenerator.generate({mapName:'4'});
  CastleMapPreparation.prepareMap(map);
  let mesh;
  const pc={
    Entity:class{tags={add(){}};addComponent(type,value){this[type]=value;}removeComponent(type){delete this[type];}destroy(){}},
    Mesh:class{constructor(){mesh=this;}setPositions(value){this.positions=value;}setIndices(value){this.indices=value;}update(){}destroy(){}},
    StandardMaterial:class{update(){}destroy(){}},
    GraphNode:class{},
    MeshInstance:class{},
    Model:class{},
  };
  const surface=new TerrainPhysicsSurface({
    pc,
    app:{graphicsDevice:{}},
    mapData:map,
    collisionWorld:null,
  });
  assert.ok(map.tileMeta.flat().some(tile=>tile.terrainCutouts?.length),'covers real castle excavation');
  assert.ok(mesh.indices.length/3<10000,'terrain stays below the physics memory regression threshold');
  assert.ok(mesh.indices.length>0);
  surface.destroy();
});
