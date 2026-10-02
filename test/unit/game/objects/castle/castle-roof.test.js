import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
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
    return {entity,meshInstances:[{mesh:{aabb:{halfExtents,center}}}]};
  });
  const roofs=new CastleRoof({pc:{Entity},modelLibrary:{instantiate:()=>root}});
  roofs.add({x:2,y:7,z:3,yaw:90,width:4,depth:3,height:1});
  assert.equal(root.components.get("collision").type,"compound");
  assert.equal(root.components.get("rigidbody").type,"static");
  assert.deepEqual(root.scale,[4,1,3]);
  const colliders=root.renders.filter((render)=>render.entity.components.has("collision"));
  assert.equal(colliders.length,9);
  for (const render of colliders) {
    const collision=render.entity.components.get("collision");
    assert.equal(collision.type,"box");
    assert.deepEqual(collision.halfExtents,render.meshInstances[0].mesh.aabb.halfExtents);
    assert.ok(collision.halfExtents.x>0 && collision.halfExtents.y>0 && collision.halfExtents.z>0);
  }
});
