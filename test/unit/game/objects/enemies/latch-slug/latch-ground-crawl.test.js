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

it("reaches before lifting and preserves the authored rig throughout stair transfer", () => {
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
  crawl.update(.51);
  assert.equal(crawl.phase,"transfer");
  const nodes = [body, ...body.children];
  const positions = nodes.map(node => node.getLocalPosition().clone());
  for (const height of [.02, .125, .25]) {
    owner.position.y = height;
    crawl.update(.3);
    crawl.apply();
    assert.equal(crawl.applied, false, "the shader bends the authored pose without scaling or relocating bones");
    for (const [index, node] of nodes.entries()) {
      assert.deepEqual(node.getLocalScale(), pc.Vec3.ONE);
      assert.deepEqual(node.getLocalPosition(), positions[index]);
    }
    crawl.restore();
  }
  crawl.update(.56);
  assert.equal(crawl.phase, "settle");
  crawl.update(.23);
  assert.equal(crawl.phase, "flat");
  assert.equal(crawl.weight, 0);
  crawl.destroy();
});

it("leaves flat-ground motion to the authored snail clip without scaling the whole model", () => {
  const app = new pc.EventHandler();
  const model = new pc.Entity();
  const body = new pc.Entity("body");
  model.addChild(body);
  app.systems = { rigidbody: { raycastFirst: () => null } };
  const owner = {
    pc,
    app,
    position: new pc.Vec3(),
    entity: { rigidbody: { linearVelocity: new pc.Vec3(0, 0, -0.5) } },
    alive: true,
    gatewayArrival: { active: false },
  };
  const crawl = new LatchGroundCrawl(owner, model);
  for (let frame = 0; frame < 60; frame++) {
    crawl.update(1 / 60);
    crawl.apply();
    assert.equal(crawl.applied, false);
    assert.deepEqual(model.getLocalScale(), pc.Vec3.ONE);
    assert.deepEqual(model.getLocalPosition(), pc.Vec3.ZERO);
    crawl.restore();
  }
  crawl.destroy();
});
