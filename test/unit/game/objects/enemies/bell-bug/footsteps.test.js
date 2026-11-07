import assert from "node:assert/strict";
import test from "node:test";
import { Entity, EventHandler, Vec3 } from "playcanvas";
import { BellBugGroundPose } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugGroundPose.js";
import { BellBug } from "../../../../../../src/game/objects/enemies/bell-bug/BellBug.js";

test("each of the six feet sounds once on native-supported touchdown, never while planted or stopped", () => {
  const app = new EventHandler(), entity = new Entity(), model = new Entity();
  entity.addChild(model);
  entity.rigidbody = { linearVelocity:new Vec3(0.4,0,0) };
  const bones = [], taps = [];
  for (const side of ["L","R"]) {
    for (let i=0;i<3;i++) {
      const bone = new Entity(`leg_${side}_${i}`), mesh = new Entity(`BellBug leg ${side}${i}`);
      bone.setLocalPosition(side==="L" ? -0.3 : 0.3,0.1,i*0.2);
      model.addChild(bone);
      bone.addChild(mesh);
      mesh.findComponents = () => [{ meshInstances:[{ aabb:{ center:bone.getPosition() } }] }];
      bones.push(bone);
    }
  }
  let supported = true;
  const owner = {
    app,
    entity,
    alive:true,
    position:entity.getPosition(),
    stateName:"BellBugPursueState",
    clip:"scuttle_walk",
    grounded:true,
    stepSupport:{ surface:(x,z)=>supported ? { point:new Vec3(x,0,z) } : null },
    playFootstep:foot=>taps.push(foot),
  };
  const pose = new BellBugGroundPose(owner,model);
  const frame = (feet,height) => {
    for (const i of feet) {
      const p = bones[i].getLocalPosition();
      bones[i].setLocalPosition(p.x,height,p.z);
    }
    app.fire("prerender",1/60);
    app.fire("postrender");
  };
  frame([],0.1);
  assert.deepEqual(taps,[], "entering a walking clip does not invent six landings");
  for (const tripod of [[0,2,4],[1,3,5]]) {
    frame(tripod,0.15);
    frame(tripod,0.1);
    frame(tripod,0.1);
  }
  assert.deepEqual(taps,[0,2,4,1,3,5]);
  entity.rigidbody.linearVelocity.set(0,0,0);
  frame([0,2,4],0.15);
  frame([0,2,4],0.1);
  assert.equal(taps.length,6, "a stationary animation cannot make walking sounds");
  entity.rigidbody.linearVelocity.set(0.4,0,0);
  supported = false;
  frame([1,3,5],0.15);
  frame([1,3,5],0.1);
  assert.equal(taps.length,6, "empty space is not a foot contact");
  supported = true;
  owner.airborne = true;
  frame([0,2,4],0.15);
  frame([0,2,4],0.1);
  assert.equal(taps.length,6);
  pose.destroy();
});

test("six quiet foot slots attenuate with distance without changing other creature sounds", () => {
  const slots = Array.from({ length:6 },()=>({})), played = [];
  const hero = new Vec3();
  const owner = {
    entity:{
      sound:{
        volume:0.8,
        slot:name=>slots[Number(name.slice(4))],
        play:name=>played.push(name),
      },
    },
    runtime:{ getHero:()=>({ position:hero }) },
  };
  const point = new Vec3();
  for (let i=0;i<6;i++) {
    BellBug.prototype.playFootstep.call(owner,i,point);
    assert.equal(slots[i].volume,0.025);
    assert.ok(slots[i].pitch>=1.5 && slots[i].pitch<1.7);
  }
  assert.equal(played.length,6);
  assert.equal(owner.entity.sound.volume,0.8);
  hero.x = 5;
  BellBug.prototype.playFootstep.call(owner,0,point);
  assert.equal(slots[0].volume,0.00625);
  hero.x = 15;
  BellBug.prototype.playFootstep.call(owner,0,point);
  assert.equal(played.length,7, "out-of-range creatures stay silent");
  owner.runtime.camera = {
    panX:0,
    targetY:0,
    panZ:0,
  };
  BellBug.prototype.playFootstep.call(owner,0,point);
  assert.equal(played.length,8, "a nearby camera can hear the creature when the hero is elsewhere");
});
