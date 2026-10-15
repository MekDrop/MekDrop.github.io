import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import AmmoModule from "sync-ammo/dist/ammo.module.js";
const source=readFileSync(new URL("../../../../../src/game/objects/castle/CastleRoof.js",import.meta.url),"utf8");
const CastleRoof=Function(source.replace(/^import .*;$/m,'const roofUrl="roof";').replace("export class CastleRoof","class CastleRoof")+"; return CastleRoof;")();
class Entity extends pc.Entity {
  components=new Map();
  constructor(name){
    super(name);
  }
  addChild(child){super.addChild(child);}
  addComponent(type,options){this.components.set(type,options);}
  setLocalPosition(...position){super.setLocalPosition(...position);}
  setLocalEulerAngles(...rotation){super.setLocalEulerAngles(...rotation);}
  setLocalScale(...scale){super.setLocalScale(...scale);}
  findComponents(){return this.renders ?? [];}
}
it("gives every solid authored roof course matching engine collision, including the cap", () => {
  const bytes=readFileSync(new URL("../../../../../src/game/models/castle/residential/blue-roof.glb",import.meta.url));
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const root=new Entity("roof");
  const vector=(x,y,z)=>new pc.Vec3(x,y,z);
  root.renders=model.nodes.filter((node)=>node.mesh !== undefined).map((node)=>{
    const entity=new Entity(node.name);
    root.addChild(entity);
    if (node.translation) entity.setLocalPosition(...node.translation);
    const meshInstances=model.meshes[node.mesh].primitives.map((primitive)=>{
      const accessor=model.accessors[primitive.attributes.POSITION];
      const halfExtents=vector(...accessor.max.map((value,index)=>(value-accessor.min[index])/2));
      const center=vector(...accessor.max.map((value,index)=>(value+accessor.min[index])/2));

      return {
        material:{name:model.materials[primitive.material].name},
        mesh:{aabb:new pc.BoundingBox(center,halfExtents)},
      };
    });

    return {
      entity,
      meshInstances,
    };
  });
  const roofs=new CastleRoof({
    pc:{
      ...pc,
      Entity,
    },
    modelLibrary:{instantiate:()=>root},
    masonryMaterial:new pc.StandardMaterial(),
  });
  roofs.add({
    x:2,
    y:7,
    z:3,
    yaw:90,
    width:4,
    depth:3,
    height:1,
  });
  assert.equal(root.components.get("collision").type,"compound");
  assert.equal(root.components.get("rigidbody").type,"static");
  assert.ok(root.tags.has("capsule-support"));
  assert.deepEqual(root.getLocalScale(),new pc.Vec3(4,1,3));
  const colliders=root.renders.filter((render)=>render.entity.components.has("collision"));
  assert.equal(colliders.length,25);
  for (const render of colliders) {
    const collision=render.entity.components.get("collision");
    assert.equal(collision.type,"box");
    const scale=render.entity.getWorldTransform().getScale();
    for (const instance of render.meshInstances) {
      const center=instance.mesh.aabb.center.clone().mul(scale);
      const halfExtents=instance.mesh.aabb.halfExtents.clone().mul(scale);
      for (const axis of ["x","y","z"]) {
        assert.ok(Math.abs(center[axis]-collision.linearOffset[axis])+halfExtents[axis]<=collision.halfExtents[axis]+1e-6,
          `${render.entity.name}: ${instance.material.name} has collision across ${axis}`);
      }
    }
    assert.ok(collision.halfExtents.x>0 && collision.halfExtents.y>0 && collision.halfExtents.z>0);
  }
  const courses=colliders.filter(({entity})=>entity.name.startsWith("Hipped roof course"));
  const tops=courses.map(({entity})=>{
    const box=entity.components.get("collision");

    return (box.linearOffset.y+box.halfExtents.y)*2;
  }).sort((a,b)=>a-b);
  let previous=0;
  for(const top of tops){
    assert.ok(top-previous<=0.125+1e-6,"compact roof rises stay below the spiral stair rise");
    previous=top;
  }
  const Ammo=AmmoModule.default ?? AmmoModule;
  const allocated=[];
  const own=(value)=>{allocated.push(value);

return value;};
  const config=own(new Ammo.btDefaultCollisionConfiguration());
  const dispatcher=own(new Ammo.btCollisionDispatcher(config));
  const broadphase=own(new Ammo.btDbvtBroadphase());
  const solver=own(new Ammo.btSequentialImpulseConstraintSolver());
  const world=own(new Ammo.btDiscreteDynamicsWorld(dispatcher,broadphase,solver,config));
  const bodies=[];
  try {
    for (const render of colliders) {
      const collision=render.entity.components.get("collision");
      const he=collision.halfExtents;
      const shape=own(new Ammo.btBoxShape(own(new Ammo.btVector3(he.x,he.y,he.z))));
      const rotation=render.entity.getRotation();
      const position=rotation.transformVector(collision.linearOffset).add(render.entity.getPosition());
      const transform=own(new Ammo.btTransform());
      transform.setIdentity();
      transform.setOrigin(own(new Ammo.btVector3(position.x,position.y,position.z)));
      transform.setRotation(own(new Ammo.btQuaternion(rotation.x,rotation.y,rotation.z,rotation.w)));
      const motion=own(new Ammo.btDefaultMotionState(transform));
      const info=own(new Ammo.btRigidBodyConstructionInfo(0,motion,shape,own(new Ammo.btVector3(0,0,0))));
      const body=own(new Ammo.btRigidBody(info));
      bodies.push(body);
      world.addRigidBody(body);
    }
    // Probe both ends of the rotated roof, including tiles outside primitive 0.
    for (const localX of [-0.49,0,0.49]) {
      for (const localZ of [-0.49,0,0.49]) {
        const point=root.getWorldTransform().transformPoint(new pc.Vec3(localX,0,localZ));
        const from=own(new Ammo.btVector3(point.x,6,point.z));
        const to=own(new Ammo.btVector3(point.x,9,point.z));
        const hit=own(new Ammo.ClosestRayResultCallback(from,to));
        world.rayTest(from,to,hit);
        assert.ok(hit.hasHit(),`upward contact at roof ${localX}, ${localZ}`);
        assert.ok(hit.get_m_hitNormalWorld().y() < -0.9,"roof underside blocks upward movement");
      }
    }
  } finally {
    for (const body of bodies) world.removeRigidBody(body);
    for (const value of allocated.reverse()) Ammo.destroy(value);
  }
});
it("reports nearby Ammo roof support to walking checks and filters unrelated bodies", () => {
  let hits=[];
  let query;
  const roof=new CastleRoof({
    pc:{
      ...pc,
      Entity,
    },
    app:{
      systems:{
        rigidbody:{
          raycastAll:(from,to,options)=>{
            query={
              from,
              to,
              options,
            };

            return hits;
          },
        },
      },
    },
    modelLibrary:{},
    masonryMaterial:new pc.StandardMaterial(),
  });
  const child=new Entity("roof collider");
  roof.entity.addChild(child);
  hits=[{
    normal:{y:1},
    point:{y:8},
  }];
  assert.equal(roof.surfaceHeightAt(2,3,8.32),8);
  assert.equal(query.options.filterCallback(child),true);
  assert.equal(query.options.filterCallback(new Entity("hero")),false);
  assert.deepEqual(query.from,new pc.Vec3(2,8.32,3));
  assert.ok(Math.abs(query.to.y-7.68)<1e-6);
  hits=[{
    normal:{y:-1},
    point:{y:8},
  }];
  assert.equal(roof.surfaceHeightAt(2,3,8.32),null);
  hits=[];
  assert.equal(roof.surfaceHeightAt(2,3,5.32),null);
});
it("shares wall masonry on continuous gables so courses align", () => {
  const wall=new pc.StandardMaterial();
  const root=new Entity("roof");
  const instance={material:{name:"Roof gable sandstone continuous"}};
  root.renders=[{
    entity:new Entity("Gable stone"),
    meshInstances:[instance],
  }];
  const roofs=new CastleRoof({
    pc:{
      ...pc,
      Entity,
    },
    modelLibrary:{instantiate:()=>root},
    masonryMaterial:wall,
  });
  roofs.add({
    x:0,
    y:0,
    z:0,
  });
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

