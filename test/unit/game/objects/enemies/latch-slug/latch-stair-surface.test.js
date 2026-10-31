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
  const front = new pc.Entity(),rear = new pc.Entity();
  front.setPosition(.3,.43,0);rear.setPosition(-.4,.18,0);
  const crawl = {
    active:false,
    phase:'flat',
    phaseAge:0,
    edge:new pc.Vec3(0,.125,0),
    direction:new pc.Vec3(1,0,0),
    lowerHeight:0,
    upperHeight:.25,
    rearAnchor:new pc.Vec3(-.4,.18,0),
    frontAnchor:new pc.Vec3(.3,.43,0),
    belly:[front,rear],
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
    for (const [i,value] of instance.parameters.get('uStairSpan').entries()) {
      assert.ok(Math.abs(value-[-.4,.55,-.4,.3][i])<1e-6);
    }
    assert.ok(instance.bounds.halfExtents.x>instance.mesh.aabb.halfExtents.x);
    for(const language of [pc.SHADERLANGUAGE_GLSL,pc.SHADERLANGUAGE_WGSL]){
      assert.match(instance.material.getShaderChunks(language).get('transformVS'),/latchStairSurface/);
      assert.match(instance.material.getShaderChunks(language).get('normalVS'),/latchStairNormal/);
    }
  }
  const bindSpan = [...instances[0].parameters.get('uStairBindSpan')];
  owner.position=new pc.Vec3(0,.125,0);
  surface.update();
  assert.ok(instances[0].parameters.get('uStairFlow')>0,"gel flows forward while the front and rear contacts remain planted");
  assert.ok(instances[0].parameters.get('uStairFlow')<=.16);
  const contactSpan = instances[0].parameters.get('uStairSpan').slice(0,2);
  front.setPosition(.1,.8,0);rear.setPosition(-.7,.05,0);
  surface.update();
  assert.deepEqual(instances[0].parameters.get('uStairBindSpan'),bindSpan,"authored body proportions remain fixed as animated bones move");
  assert.deepEqual(instances[0].parameters.get('uStairSpan').slice(0,2),contactSpan,"animated bones cannot change the size of a transfer");
  crawl.phase='pull';crawl.phaseAge=.55;surface.update();
  for(const instance of instances){
    assert.ok(instance.parameters.get('uStairSpan')[0]>=.25,'gathered body has no lower-tread segment');
  }
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
