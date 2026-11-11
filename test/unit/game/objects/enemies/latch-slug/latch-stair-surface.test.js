import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { it } from "node:test";
import * as pc from "playcanvas";
const hooks = registerHooks({
  load:(url,context,nextLoad)=>url.endsWith('?raw')?{
    format:'module',
    source:`export default ${JSON.stringify(readFileSync(new URL(url.slice(0,-4)),'utf8'))}`,
    shortCircuit:true,
  }:nextLoad(url,context),
});
const {LatchStairSurface} = await import('../../../../../../src/game/objects/enemies/latch-slug/LatchStairSurface.js');
hooks.deregister();
it('binds the complete skin to the lower-riser-upper contact path and restores materials and bounds afterward',()=>{
  const app = new pc.AppBase({id:'stair-surface-test'});
  app.init({
    graphicsDevice:new pc.NullGraphicsDevice({
      width:1,
      height:1,
    }),
    componentSystems:[],
    resourceHandlers:[],
  });
  const instances = [0.82,1,1].map(opacity=>{
    const material = new pc.StandardMaterial();
    material.opacity=opacity;

    return {
      material,
      mesh:{aabb:new pc.BoundingBox()},
      parameters:new Map(),
      bounds:null,
      setParameter(name,value){
        this.parameters.set(name,value);
      },
      deleteParameter(name){
        this.parameters.delete(name);
      },
      setCustomAabb(value){
        this.bounds=value;
      },
    };
  });
  const originals = instances.map(i=>i.material);
  const crawl = {
    active:false,
    phase:'flat',
    phaseAge:0,
    edge:new pc.Vec3(0,.125,0),
    direction:new pc.Vec3(1,0,0),
    lowerHeight:0,
    upperHeight:.25,
  };
  const owner = {
    pc,
    app,
    alive:true,
    stairCrawl:crawl,
  };
  const surface = new LatchStairSurface(owner,{findComponents:()=>[{meshInstances:instances}]});
  crawl.active=true;crawl.phase='transfer';surface.update();
  for(const [index,instance] of instances.entries()){
    assert.notEqual(instance.material,originals[index]);
    assert.equal(instance.material.opacity,originals[index].opacity);
    assert.equal(instance.parameters.get('uStairWeight'),1);
    assert.deepEqual(instance.parameters.get('uStairLevels'),[0,.25]);
    assert.equal(instance.parameters.get('uStairRootHeight'), 0);
    assert.ok(instance.bounds.halfExtents.x>instance.mesh.aabb.halfExtents.x);
    for(const language of [pc.SHADERLANGUAGE_GLSL,pc.SHADERLANGUAGE_WGSL]){
      assert.match(instance.material.getShaderChunks(language).get('transformVS'),/latchStairSurface/);
      assert.match(instance.material.getShaderChunks(language).get('normalVS'),/latchStairNormal/);
    }
  }
  owner.position = new pc.Vec3(0, .125, 0);
  surface.update();
  assert.equal(instances[0].parameters.get('uStairRootHeight'), .125);
  crawl.phase = 'settle';crawl.phaseAge = .11;surface.update();
  assert.ok(Math.abs(instances[0].parameters.get('uStairWeight') - .5) < 1e-6);
  crawl.active=false;surface.update();
  for(const instance of instances){
    assert.equal(instance.parameters.get('uStairWeight'),0);assert.equal(instance.bounds,null);
  }
  surface.destroy();surface.update();surface.destroy();
  for(const [i,instance]of instances.entries()){
    assert.equal(instance.material,originals[i]);assert.equal(instance.parameters.size,0);originals[i].destroy();
  }
  app.destroy();
});
