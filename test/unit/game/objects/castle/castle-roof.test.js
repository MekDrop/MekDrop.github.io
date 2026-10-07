import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
const source=readFileSync(new URL("../../../../../src/game/objects/castle/CastleRoof.js",import.meta.url),"utf8");
const CastleRoof=Function(source.replace(/^import .*;$/m,'const roofUrl="roof";').replace("export class CastleRoof","class CastleRoof")+"; return CastleRoof;")();
class Entity {
  components=new Map(); children=[];
  constructor(name){this.name=name;}
  addChild(child){this.children.push(child);}
  addComponent(type,options){this.components.set(type,options);}
  setLocalPosition(...position){this.position=position;}
  setLocalEulerAngles(...rotation){this.rotation=rotation;}
  setLocalScale(...scale){this.scale=scale;}
  findComponents(){return this.renders ?? [];}
}
it("gives every solid authored roof course matching engine collision, including the cap", () => {
  const bytes=readFileSync(new URL("../../../../../src/game/models/castle/residential/blue-roof.glb",import.meta.url));
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const root=new Entity("roof");
  const vector=(x,y,z)=>({x,y,z,clone(){return {...this};}});
  root.renders=model.nodes.filter((node)=>node.mesh !== undefined).map((node)=>{
    const accessor=model.accessors[model.meshes[node.mesh].primitives[0].attributes.POSITION];
    const entity=new Entity(node.name);
    const halfExtents=vector(...accessor.max.map((value,index)=>(value-accessor.min[index])/2));
    const center=vector(...accessor.max.map((value,index)=>(value+accessor.min[index])/2));
    return {entity,meshInstances:[{material:{name:"Roof cobalt block"},mesh:{aabb:{halfExtents,center}}}]};
  });
  const roofs=new CastleRoof({pc:{...pc,Entity},modelLibrary:{instantiate:()=>root},masonryMaterial:new pc.StandardMaterial()});
  roofs.add({x:2,y:7,z:3,yaw:90,width:4,depth:3,height:1});
  assert.equal(root.components.get("collision").type,"compound");
  assert.equal(root.components.get("rigidbody").type,"static");
  assert.deepEqual(root.scale,[4,1,3]);
  const colliders=root.renders.filter((render)=>render.entity.components.has("collision"));
  assert.equal(colliders.length,11);
  for (const render of colliders) {
    const collision=render.entity.components.get("collision");
    assert.equal(collision.type,"box");
    assert.deepEqual(collision.halfExtents,render.meshInstances[0].mesh.aabb.halfExtents);
    assert.ok(collision.halfExtents.x>0 && collision.halfExtents.y>0 && collision.halfExtents.z>0);
  }
});
it("shares wall masonry on continuous gables so courses align", () => {
  const wall=new pc.StandardMaterial();
  const root=new Entity("roof");
  const instance={material:{name:"Roof gable sandstone continuous"}};
  root.renders=[{entity:new Entity("Gable stone"),meshInstances:[instance]}];
  const roofs=new CastleRoof({pc:{...pc,Entity},modelLibrary:{instantiate:()=>root},masonryMaterial:wall});
  roofs.add({x:0,y:0,z:0});
  assert.notEqual(instance.material,wall);
  assert.ok(Math.abs(instance.material.diffuse.r-wall.diffuse.r*0.8)<1e-6);
  assert.ok(Math.abs(instance.material.diffuse.g-wall.diffuse.g*0.8)<1e-6);
  assert.ok(Math.abs(instance.material.diffuse.b-wall.diffuse.b*0.8)<1e-6);
  const bytes=readFileSync(new URL("../../../../../src/game/models/castle/residential/blue-roof.glb",import.meta.url));
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const gables=model.materials.filter(m=>m.name.startsWith("Roof gable sandstone"));
  assert.equal(gables.length,1);
  assert.equal(gables[0].name,"Roof gable sandstone continuous");
});

