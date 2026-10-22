import test from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";
import { State } from "yuka";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { PitcherOgre } from "../../../../../../src/game/objects/enemies/pitcher-ogre/PitcherOgre.js";

function fixture() {
  const actors = [];
  const floor = new pc.Entity("floor");
  floor.rigidbody = { type: "static" };
  const app = {
    systems: {
      rigidbody: {
        gravity: new pc.Vec3(0, -9.81, 0),
        raycastAll: (from, to) => {
          if (from.y > 0 && to.y < 0) {
            const t = from.y / (from.y - to.y);

            return [{
              entity: floor,
              normal: new pc.Vec3(0, 1, 0),
              point: new pc.Vec3(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t),
            }];
          }
          return [];
        },
      },
    },
    on: () => ({ off: () => {} }),
  };
  const options = {
    pc,
    app,
    definition: { id: "ogre" },
    runtime: { objects: actors },
  };
  const ogre = new PitcherOgre(options);
  ogre.entity.rigidbody = body();
  actors.push(ogre);
  function ally(type, x = 1) {
    const actor = new Enemy({
      ...options,
      definition: { id: type },
    });
    actor.enemyType = type;
    actor.entity.setPosition(x, 0, 0);
    actor.entity.rigidbody = body();
    actors.push(actor);

    return actor;
  }
  const royal = {
    isRoyal: true,
    alive: true,
    entity: new pc.Entity("king"),
  };
  royal.entity.setPosition(0, 0, -7);
  actors.push(royal);

  return {
    ogre,
    ally,
    actors,
    royal,
    app,
  };
}
function body() {
  return {
    enabled: true,
    linearVelocity: new pc.Vec3(),
    teleport: () => {},
  };
}

test("uses real Yuka states and resolves the actual royal before scenery", () => {
  const { ogre, actors, royal } = fixture();
  actors.push({
    isTower: true,
    entity: new pc.Entity("tower"),
  });
  assert.equal(ogre.resolveRoyalTarget(), royal);
  assert.ok(ogre.behavior.currentState instanceof State);
  assert.equal(ogre.stateName, "PitcherPursueState");
});

test("prefers willing Divecaps and Doorcrackers; never calls a Crown Crab willing", () => {
  const { ogre, ally } = fixture();
  const crab = ally("CrownCrab", 0.3);
  crab.isWillingToBeThrownBy = () => true;
  assert.equal(ogre.canPickUp(crab), false);
  const divecap = ally("Divecap", 1.2);
  ogre.receiveDamage(1);
  assert.equal(ogre.canPickUp(crab), true);
  assert.equal(ogre.isWillingPassenger(crab), false);
  assert.equal(ogre.findPassenger(), divecap);
});

test("honors a volunteer refusal and too-heavy capability", () => {
  const { ogre, ally } = fixture();
  const divecap = ally("Divecap");
  divecap.isWillingToBeThrownBy = () => false;
  assert.equal(ogre.findPassenger(), null);
  assert.equal(ogre.canBeCarriedBy(divecap), false);
  assert.equal(ogre.beginCarry(divecap), false);
  assert.equal(ogre.launch({ velocity: new pc.Vec3(1, 2, 3) }), false);
  assert.equal(ogre.carrier, null);
});

test("pickup owns physical carry, socket and unwilling reaction", () => {
  const { ogre, ally } = fixture();
  const crab = ally("CrownCrab");
  ogre.receiveDamage(1);
  let reaction;
  crab.onPickedUp = (details) => {
    reaction = details;
  };
  assert.equal(ogre.pickUp(crab), true);
  assert.equal(crab.carrier, ogre);
  assert.equal(crab.entity.rigidbody.enabled, false);
  assert.ok(crab.position.equals(ogre.carrySocket.getPosition()));
  assert.equal(reaction.willing, false);
});

test("bell confusion physically releases a held passenger and deduplicates rings", () => {
  const { ogre, ally } = fixture();
  const passenger = ally("Divecap");
  ogre.pickUp(passenger);
  assert.equal(ogre.onBellRung({ eventId: "bell-1" }), true);
  assert.equal(ogre.stateName, "PitcherConfusedState");
  assert.equal(ogre.passenger, null);
  assert.equal(passenger.carrier, null);
  assert.equal(passenger.airborne, true);
  assert.equal(passenger.entity.rigidbody.enabled, true);
  assert.equal(passenger.grounded, false);
  assert.equal(ogre.onBellRung({ eventId: "bell-1" }), false);
  assert.equal(ogre.onBellRung({
    eventId: "secondary",
    secondary: true,
  }), false);
  passenger.onLanding({});
  assert.equal(passenger.airborne, false);
});

test("a stun during pickup aborts contact and resumes after recovery", () => {
  const { ogre, ally } = fixture();
  const passenger = ally("Divecap");
  ogre.candidate = passenger;
  ogre.changeState("PitcherPickupState");
  ogre.applyStatus("stun", { duration: 0.2 });
  ogre.update(0.3);
  assert.equal(passenger.carrier, null);
  assert.equal(ogre.stateName, "PitcherStunnedState");
  ogre.update(0.7);
  assert.equal(ogre.stateName, "PitcherPursueState");
});

test("Gobbler eating a queued ally provokes a bounded warning and ground punch", () => {
  const { ogre, ally } = fixture();
  const victim = ally("Doorcracker");
  const consumer = ally("SnackGobbler", 2);
  ogre.findPassenger();
  ogre.onAllyConsumed({
    victim,
    consumer,
  });
  assert.equal(ogre.stateName, "PitcherAngryState");
  ogre.update(1);
  assert.equal(ogre.requestedAnimation, "ground_punch");
  ogre.update(1.1);
  assert.equal(ogre.stateName, "PitcherPursueState");
});

test("death releases passengers and prevents later reaction resurrection", () => {
  const { ogre, ally } = fixture();
  const passenger = ally("Divecap");
  ogre.pickUp(passenger);
  ogre.receiveDamage(ogre.health);
  assert.equal(ogre.stateName, "PitcherDeathState");
  assert.equal(passenger.carrier, null);
  assert.equal(passenger.entity.rigidbody.enabled, true);
  assert.equal(ogre.applyStatus("confused"), false);
  assert.equal(ogre.receiveHealing(20), 0);
});

test("plans a supported parabola whose analytic endpoint reaches the landing", () => {
  const { ogre, ally, royal, app } = fixture();
  const passenger = ally("Divecap");
  const solution = ogre.throwPlanner.plan(passenger, royal.entity.getPosition());
  assert.ok(solution);
  const origin = ogre.carrySocket.getPosition();
  const time = solution.duration;
  assert.ok(Math.abs(origin.x + solution.velocity.x * time - solution.landing.x) < 1e-6);
  assert.ok(Math.abs(origin.y + solution.velocity.y * time + 0.5 * app.systems.rigidbody.gravity.y * time * time - solution.landing.y) < 1e-6);
});

test("rejects missing support, blocked landings and blocked flight envelopes", () => {
  const { ogre, ally, royal, app } = fixture();
  const passenger = ally("Divecap");
  app.systems.rigidbody.raycastAll = () => [];
  assert.equal(ogre.throwPlanner.plan(passenger, royal.entity.getPosition()), null);
  const wall = new pc.Entity("wall");
  wall.rigidbody = { type: "static" };
  app.systems.rigidbody.raycastAll = (from) => [{
    entity: wall,
    point: from.clone(),
    normal: new pc.Vec3(1, 0, 0),
  }];
  assert.equal(ogre.throwPlanner.plan(passenger, royal.entity.getPosition()), null);
});

test("windup revalidates a moving obstruction before release", () => {
  const { ogre, ally } = fixture();
  const passenger = ally("Divecap");
  ogre.pickUp(passenger);
  ogre.changeState("PitcherThrowState");
  ogre.throwPlanner.plan = () => null;
  ogre.update(0.8);
  assert.equal(ogre.stateName, "PitcherReleaseState");
  ogre.update(0.11);
  assert.equal(ogre.stateName, "PitcherAimState");
  assert.equal(passenger.carrier, ogre);
  assert.equal(passenger.airborne, false);
});

test("successful throw restores physics, retains landing hooks and prevents immediate regrab", () => {
  const { ogre, ally } = fixture();
  const passenger = ally("Divecap");
  ogre.pickUp(passenger);
  ogre.changeState("PitcherThrowState");
  ogre.update(0.8);
  assert.equal(passenger.carrier, ogre);
  ogre.update(0.11);
  assert.equal(ogre.stateName, "PitcherRecoverState");
  assert.equal(passenger.carrier, null);
  assert.equal(passenger.airborne, true);
  assert.ok(passenger.entity.rigidbody.linearVelocity.y > 0);
  passenger.onLanding();
  passenger.entity.setPosition(1, 0, 0);
  assert.equal(ogre.canPickUp(passenger), false);
});
import Ammo from "sync-ammo/dist/ammo.module.js";
import { CrownCrab } from "../../../../../../src/game/objects/enemies/crown-crab/CrownCrab.js";

test("real Crown Crab reacts unwillingly, remembers its thrower and enters its landing state", () => {
  const { ogre, actors } = fixture();
  const crab = new CrownCrab({
    pc,
    app:ogre.app,
    definition:{id:"unwilling-crab"},
    runtime:ogre.runtime,
  });
  crab.entity.rigidbody = body();
  crab.entity.setPosition(1,0,0);
  actors.push(crab);
  ogre.receiveDamage(1);
  assert.equal(ogre.pickUp(crab), true);
  assert.equal(crab.stateName, "CrownCrabCarriedState");
  ogre.onBellRung({eventId:"real-crab-drop"});
  assert.equal(crab.stateName, "CrownCrabAirborneState");
  assert.equal(crab.revengeTarget, ogre);
  crab.onLanding();
  assert.equal(crab.stateName, "CrownCrabLandingState");
});

test("Ammo carries the launched capsule over a wall and settles it at the planned landing", () => {
  const { ogre, ally, royal } = fixture();
  const passenger = ally("Divecap");
  const resources=[];
  const keep=(object)=>{
    resources.push(object);

    return object;
  };
  const config=keep(new Ammo.btDefaultCollisionConfiguration());
  const dispatcher=keep(new Ammo.btCollisionDispatcher(config));
  const broadphase=keep(new Ammo.btDbvtBroadphase());
  const solver=keep(new Ammo.btSequentialImpulseConstraintSolver());
  const world=keep(new Ammo.btDiscreteDynamicsWorld(dispatcher,broadphase,solver,config));
  world.setGravity(keep(new Ammo.btVector3(0,-9.81,0)));
  const physicalBodies=[];
  const create=(shape,mass,position)=>{
    const transform=keep(new Ammo.btTransform());transform.setIdentity();transform.setOrigin(keep(new Ammo.btVector3(...position)));
    const motion=keep(new Ammo.btDefaultMotionState(transform));const inertia=keep(new Ammo.btVector3(0,0,0));
    if(mass){
      shape.calculateLocalInertia(mass,inertia);
    }
    const info=keep(new Ammo.btRigidBodyConstructionInfo(mass,motion,shape,inertia));
    const rigid=keep(new Ammo.btRigidBody(info));rigid.setFriction(1);world.addRigidBody(rigid);physicalBodies.push(rigid);

    return rigid;
  };
  try {
    create(keep(new Ammo.btBoxShape(keep(new Ammo.btVector3(20,.5,20)))),0,[0,-.5,0]);
    create(keep(new Ammo.btBoxShape(keep(new Ammo.btVector3(5,1.5,.15)))),0,[0,1.5,-3.5]);
    // Real Bullet ray tests now supply the preflight obstacle and floor queries.
    ogre.app.systems.rigidbody.raycastAll=(from,to)=>{
      const a=new Ammo.btVector3(from.x,from.y,from.z),b=new Ammo.btVector3(to.x,to.y,to.z);
      const callback=new Ammo.AllHitsRayResultCallback(a,b);world.rayTest(a,b,callback);
      const hits=[];
      if(callback.hasHit()) {
        const points=callback.get_m_hitPointWorld(),normals=callback.get_m_hitNormalWorld();
        for(let i=0;i<points.size();i++) {
          const p=points.at(i),n=normals.at(i);
          hits.push({
            entity:{rigidbody:{type:"static"}},
            point:new pc.Vec3(p.x(),p.y(),p.z()),
            normal:new pc.Vec3(n.x(),n.y(),n.z()),
          });
        }
      }
      Ammo.destroy(callback);Ammo.destroy(a);Ammo.destroy(b);

      return hits.sort((x,y)=>from.distance(x.point)-from.distance(y.point));
    };
    const solution=ogre.throwPlanner.plan(passenger,royal.entity.getPosition());
    assert.ok(solution,"real floor and wall queries produce a clear flight");
    const start=ogre.carrySocket.getPosition();
    const capsule=create(keep(new Ammo.btCapsuleShape(.3,.4)),1,[start.x,start.y+.5,start.z]);
    capsule.setAngularFactor(keep(new Ammo.btVector3(0,0,0)));
    capsule.setLinearVelocity(keep(new Ammo.btVector3(solution.velocity.x,solution.velocity.y,solution.velocity.z)));
    const result=keep(new Ammo.btTransform());let crossed=false,maximum=0;
    for(let step=0;step<600;step++) {
      world.stepSimulation(1/120,1,1/120);capsule.getMotionState().getWorldTransform(result);const point=result.getOrigin();
      maximum=Math.max(maximum,point.y());
      if(point.z()<-3.65){
        crossed=true;assert.ok(maximum>3.8,"capsule clears wall height with its full volume");
      }
    }
    const end=result.getOrigin();
    assert.equal(crossed,true);
    assert.ok(Math.abs(end.y()-.5)<.08,"capsule has physically landed on ground");
    assert.ok(Math.hypot(end.x()-solution.landing.x,end.z()-solution.landing.z)<.65,"landing stays beside the royal");
  } finally {
    for(const rigid of physicalBodies){
      world.removeRigidBody(rigid);
    }
    // World must be released before the objects used by its broadphase/solver.
    Ammo.destroy(world);resources.splice(resources.indexOf(world),1);
    for(const resource of resources.reverse()){
      Ammo.destroy(resource);
    }
  }
});
import { readFileSync } from "node:fs";
import { pitcherClips } from "../../../../../../src/game/objects/enemies/pitcher-ogre/PitcherClips.js";

function exportedAsset() {
  const file = readFileSync(new URL("../../../../../../src/game/models/enemies/pitcher-ogre/pitcher-ogre.glb", import.meta.url));
  const length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length));
  const binary = file.subarray(28 + length);
  const read = (index) => {
    const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
    const count = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT4: 16,
    }[accessor.type];
    const sizes = {
      5121:1,
      5123:2,
      5125:4,
      5126:4,
    };
    const methods = {
      5121:"readUInt8",
      5123:"readUInt16LE",
      5125:"readUInt32LE",
      5126:"readFloatLE",
    };
    const size=sizes[accessor.componentType], stride=view.byteStride ?? count*size;
    const values=[];
    for(let i=0;i<accessor.count;i++){
      const value=[];
      for(let component=0;component<count;component++) {
        value.push(binary[methods[accessor.componentType]]((view.byteOffset??0)+(accessor.byteOffset??0)+i*stride+component*size));
      }
      values.push(value);
    }

    return values;
  };

  return {
    json,
    read,
  };
}

test("every declared clip binds exported skeleton nodes with its measured duration", () => {
  const {json,read}=exportedAsset();
  assert.equal(json.animations.length,22);
  const names=new Set(json.nodes.map(node=>node.name));
  for(const name of ["CarrySocket","forearm.L","forearm.R","hips","chest"]){
    assert.ok(names.has(name),name);
  }
  for(const clip of pitcherClips){
    const animation=json.animations.find(entry=>entry.name===clip.name);
    assert.ok(animation,clip.name);
    assert.equal(animation.channels.length,48);
    for(const channel of animation.channels){
      assert.ok(json.nodes[channel.target.node],clip.name);
      const times=read(animation.samplers[channel.sampler].input).flat();
      assert.ok(Math.abs(times.at(-1)-clip.duration)<1e-5,clip.name);
    }
  }
});

test("exported weights are finite, normalized and limited to two anatomical bones", () => {
  const {json,read}=exportedAsset();
  assert.equal(json.skins[0].joints.length,16);
  const primitive=json.meshes[0].primitives[0];
  const weights=read(primitive.attributes.WEIGHTS_0), joints=read(primitive.attributes.JOINTS_0);
  for(let vertex=0;vertex<weights.length;vertex++){
    assert.ok(weights[vertex].every(Number.isFinite));
    assert.ok(Math.abs(weights[vertex].reduce((sum,value)=>sum+value,0)-1)<1e-5);
    assert.ok(weights[vertex].filter(value=>value>1e-5).length<=2);
    for(let influence=0;influence<4;influence++){
      assert.ok(joints[vertex][influence]<16);
    }
  }
});

test("every cyclic exported transform returns to its first pose", () => {
  const {json,read}=exportedAsset();
  for(const clip of pitcherClips.filter(entry=>entry.loop)){
    const animation=json.animations.find(entry=>entry.name===clip.name);
    for(const sampler of animation.samplers){
      const values=read(sampler.output);
      for(let component=0;component<values[0].length;component++){
        assert.ok(Math.abs(values[0][component]-values.at(-1)[component])<1e-5,clip.name);
      }
    }
  }
});

test("reaching an actual royal starts one encounter and resumes if the royal moves away", () => {
  const {ogre,royal}=fixture();let encounters=0;
  royal.beginGameOver=()=>{
    encounters++;
  };
  ogre.entity.setPosition(0,0,-6.5);
  ogre.update(.016);ogre.update(.016);ogre.update(.016);
  assert.equal(ogre.stateName,"PitcherRoyalReachedState");assert.equal(encounters,1);
  royal.entity.setPosition(0,0,-10);ogre.update(.016);
  assert.equal(ogre.stateName,"PitcherPursueState");assert.equal(encounters,1);
});

test("the animated carry socket cannot tilt the passenger's physical root sideways", () => {
  const {ogre,ally}=fixture();const passenger=ally("Divecap");
  ogre.entity.setEulerAngles(0,45,0);ogre.carrySocket.setLocalEulerAngles(75,20,30);
  assert.equal(ogre.pickUp(passenger),true);
  assert.ok(passenger.entity.getRotation().equals(ogre.entity.getRotation()));
  ogre.dropPassenger();passenger.onLanding();
  assert.ok(passenger.entity.getRotation().equals(ogre.entity.getRotation()));
});
