import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchGroundCrawl } from "../../../../../../src/game/objects/enemies/latch-slug/LatchGroundCrawl.js";

it("drapes the belly across tread heights and restores the authored rig without accumulating offsets", () => {
  const app = new pc.EventHandler(), model = new pc.Entity(), body = new pc.Entity("body");
  model.addChild(body);
  body.setLocalPosition(0, 0.23, 0);
  for (const [name, z] of [["belly_front", -0.24], ["belly_rear", 0.17], ["belly_L", 0], ["belly_R", 0]]) {
    const bone = new pc.Entity(name);
    body.addChild(bone);
    bone.setLocalPosition(0, -0.01, z);
  }
  app.systems = {
    rigidbody: {
      raycastFirst: from => ({
        point: new pc.Vec3(from.x, from.z < -0.1 ? 0.25 : 0, from.z),
        normal: pc.Vec3.UP,
      }),
    },
  };
  const owner = {
    pc,
    app,
    position: new pc.Vec3(),
    alive: true,
    gatewayArrival: { active: false },
  };
  const crawl = new LatchGroundCrawl(owner, model);
  for (let i = 0; i < 30; i++) {
    crawl.update(1 / 60);
  }
  const front = model.findByName("belly_front"), before = front.getLocalPosition().clone();
  for (let i = 0; i < 100; i++) {
    crawl.apply();
    assert.ok(front.getPosition().y > 0.3);
    assert.ok(body.getLocalScale().y < 0.9);
    crawl.restore();
    assert.deepEqual(front.getLocalPosition(), before);
    assert.deepEqual(body.getLocalScale(), pc.Vec3.ONE);
  }
  owner.airborne = true;
  crawl.update(1 / 60);
  crawl.apply();
  assert.equal(crawl.applied, false, "door jumps keep their authored airborne pose");
  crawl.destroy();
  crawl.update(1 / 60);
});

it("reaches before lifting, holds three separate contacts, then pulls the rear onto the upper tread", () => {
  const app = new pc.EventHandler(), model = new pc.Entity(), body = new pc.Entity("body");
  model.addChild(body);
  body.setLocalPosition(0, 0.23, 0);
  for (const [name, z] of [["belly_front", -0.24], ["belly_rear", 0.17], ["belly_L", 0], ["belly_R", 0], ["head", -0.3]]) {
    const bone = new pc.Entity(name);
    body.addChild(bone);
    bone.setLocalPosition(0, -0.01, z);
  }
  app.systems = {
    rigidbody:{
      raycastFirst:(from,to)=>Math.abs(from.y-to.y)<.01?{
        point:new pc.Vec3(0,.125,-.32),
        normal:new pc.Vec3(0,0,1),
      }:{
        point:new pc.Vec3(from.x,from.z<-.3?.25:0,from.z),
        normal:pc.Vec3.UP,
      },
    },
  };
  const owner = {
    pc,
    app,
    position:new pc.Vec3(0,.02,0),
    alive:true,
    gatewayArrival:{active:false},
  };
  const crawl = new LatchGroundCrawl(owner,model);
  assert.equal(crawl.begin(new pc.Vec3(0,.25,-.5),pc.Vec3.FORWARD),true);
  assert.equal(crawl.speedLimit,.2,"the front reaches while the body continues gliding forward");
  assert.equal(crawl.targetHeight,0);
  assert.equal(crawl.lowerHeight,0,"the tread height is sampled rather than taken from the drifting capsule");
  assert.ok(Math.abs(crawl.frontAnchor.clone().sub(crawl.edge).dot(crawl.direction)-.35)<1e-6);
  assert.ok(Math.abs(crawl.edge.clone().sub(crawl.rearAnchor).dot(crawl.direction)-.35)<1e-6);
  crawl.update(.51);
  assert.equal(crawl.phase,"transfer");
  crawl.apply();
  const front = model.findByName("belly_front"), rear = model.findByName("belly_rear"), middle = model.findByName("belly_L");
  assert.ok(Math.abs(front.getPosition().y-.43)<1e-5);
  assert.ok(Math.abs(rear.getPosition().y-.18)<1e-5);
  assert.ok(Math.abs(middle.getPosition().y-.305)<1e-5);
  assert.ok(Math.abs(middle.getPosition().z+.32)<1e-5);
  const pinnedFront = front.getPosition().clone();
  crawl.restore();
  owner.position.y=.125;
  crawl.update(.3);
  assert.equal(crawl.phase,"transfer","time alone cannot pull the rear off its lower contact");
  crawl.apply();
  assert.ok(front.getPosition().distance(pinnedFront)<1e-5,"front contact stays anchored as the capsule advances");
  assert.ok(Math.abs(rear.getPosition().y-.18)<1e-5,"rear stays on the lower tread during transfer");
  crawl.restore();
  owner.position.set(0,.25,-.45);
  crawl.update(.01);
  assert.equal(crawl.phase,"pull");
  crawl.update(.3);
  crawl.apply();
  assert.ok(rear.getPosition().y>.3);
  crawl.restore();
  crawl.update(.3);
  assert.equal(crawl.phase,"settle");
  crawl.apply();
  assert.ok(Math.abs(rear.getPosition().y-.43)<1e-5);
  assert.ok(rear.getPosition().z<-.32,"the gathered rear must clear the riser onto the upper tread");
  crawl.restore();
  owner.position.z=-.65;
  crawl.update(.23);
  assert.equal(crawl.phase,"flat");
  assert.equal(crawl.weight,0,"the old whole-body squash must not reappear between transfers");
  assert.equal(front.getLocalPosition().y,-.01);
  crawl.destroy();
});
