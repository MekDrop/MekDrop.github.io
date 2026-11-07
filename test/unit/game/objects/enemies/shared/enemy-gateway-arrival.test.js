import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { EnemyGatewayArrival } from "../../../../../../src/game/objects/enemies/shared/EnemyGatewayArrival.js";
import { BellBug } from "../../../../../../src/game/objects/enemies/bell-bug/BellBug.js";

function fixture() {
  const app = new pc.AppBase({id:"gate-clip-test"});
  app.init({
    graphicsDevice:new pc.NullGraphicsDevice({
      width:1,
      height:1,
    }),
    componentSystems:[],
    resourceHandlers:[],
  });
  const root = new pc.Entity("root"), entity = new pc.Entity("enemy"), gate = new pc.Entity("gate");
  root.addChild(entity);
  root.addChild(gate);
  const original = new pc.StandardMaterial();
  original.opacity = 0.62;
  const instance = {
    material: original,
    cull: true,
    castShadow: true,
  };
  entity.findComponents = () => [{ meshInstances: [instance] }];
  const hooks = [], tracked = new Set();
  const body = {
    linearFactor: new pc.Vec3(1, 1, 1),
    linearVelocity: new pc.Vec3(),
    teleport: (position) => {
      entity.setPosition(position);
    },
  };
  entity.rigidbody = body;
  const owner = {
    pc,
    app,
    entity,
    alive: true,
    radius: 0.4,
    get position() {
      return entity.getPosition();
    },
    faceTarget: () => {},
    onGatewayArrival: (active) => hooks.push(active),
  };
  const gateway = {
    entity: gate,
    crossings: 0,
    entrancePath: () => ({
      from: new pc.Vec3(1.15, 2.03, 0),
      to: new pc.Vec3(-1.15, 2.03, 0),
      direction: new pc.Vec3(-1, 0, 0),
      distance: 1.15,
    }),
    arrivalPosition: (position) => position.clone(),
    trackArrival: (actor) => tracked.add(actor),
    releaseArrival: (actor) => tracked.delete(actor),
    crossArrival() {
      this.crossings++;
    },
  };
  const arrival = new EnemyGatewayArrival(owner);

  return {
    root,
    owner,
    body,
    original,
    instance,
    hooks,
    tracked,
    gateway,
    arrival,
  };
}

test("a production bell bug faces the gateway exit and completes arrival without a species override", () => {
  const f = fixture();
  const bug = new BellBug({
    pc,
    app: f.owner.app,
    definition: {id: "gateway-bell-bug"},
  });
  f.root.addChild(bug.entity);
  bug.entity.rigidbody = f.body;
  f.body.teleport = (position, heading) => {
    bug.entity.setPosition(position);
    if (heading) {
      bug.entity.setEulerAngles(heading);
    }
  };
  const arrival = bug.gatewayArrival;
  assert.equal(arrival.start(f.gateway), true);
  assert.ok(bug.entity.forward.dot(new pc.Vec3(-1, 0, 0)) > 0.999);
  arrival.update(0.7);
  assert.equal(f.body.linearVelocity.x, -1.2);
  f.body.teleport(new pc.Vec3(-1.2, 2.03, 0));
  arrival.update(0.02);
  assert.equal(arrival.active, false);
  assert.equal(f.body.linearFactor.y, 1);
  assert.equal(f.tracked.size, 0);
  f.original.destroy();
  f.root.destroy();
  f.owner.app.destroy();
});

test("entrance anticipates behind the membrane, lets Ammo move, and crosses exactly once", () => {
  const f = fixture();
  assert(f.arrival.start(f.gateway));
  assert.notEqual(f.instance.material, f.original);
  assert.equal(f.original.opacity, 0.62);
  assert.equal(f.instance.material.opacity, f.original.opacity);
  assert.equal(f.body.linearFactor.y, 0);
  assert.equal(f.instance.cull, false);
  assert.equal(f.instance.castShadow, false);
  f.arrival.update(0.25);
  assert.equal(f.body.linearVelocity.length(), 0);
  assert.equal(f.instance.material.opacity, 0.62, "arrival never fades the creature");
  assert.equal(f.instance.material.depthWrite, f.original.depthWrite);
  f.arrival.update(0.5);
  assert.equal(f.body.linearVelocity.x, -1.2);
  assert.ok(Math.abs(f.owner.position.x - 1.15) < 1e-6, "presentation must not integrate a trajectory");
  f.body.teleport(new pc.Vec3(0.35, 2.03, 0));
  f.arrival.update(0.02);
  f.arrival.update(0.02);
  assert.equal(f.gateway.crossings, 1);
  f.body.teleport(new pc.Vec3(-1.2, 2.03, 0));
  f.arrival.update(0.02);
  assert.equal(f.arrival.active, false);
  assert.equal(f.instance.material, f.original);
  assert.equal(f.body.linearFactor.y, 1);
  assert.equal(f.instance.cull, true);
  assert.equal(f.instance.castShadow, true);
  assert.equal(f.tracked.size, 0);
  assert.deepEqual(f.hooks, [true, false]);
  f.original.destroy();
  f.root.destroy();
  f.owner.app.destroy();
});

test("replays and interrupted entries restore borrowed materials and release tracking", () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    f.arrival.start(f.gateway);
    f.arrival.update(1);
    assert.equal(f.tracked.size, 1);
    f.arrival.finish();
    assert.equal(f.instance.material, f.original);
    assert.equal(f.tracked.size, 0);
    assert.equal(f.arrival.materials.length, 0);
  }
  f.arrival.start(f.gateway);
  f.gateway.entity.destroy();
  f.arrival.update(0.01);
  assert.equal(f.arrival.active, false);
  assert.equal(f.body.linearFactor.y, 1);
  f.original.destroy();
  f.root.destroy();
  f.owner.app.destroy();
});
test("entry progress follows its world direction rather than assuming a particular gate facing", () => {
  const f = fixture();
  f.gateway.entrancePath = () => ({
    from: new pc.Vec3(-1.15, 2.03, 0),
    to: new pc.Vec3(1.15, 2.03, 0),
    direction: new pc.Vec3(1, 0, 0),
    distance: 1.15,
  });
  f.arrival.start(f.gateway);
  f.arrival.update(.7);
  assert.equal(f.body.linearVelocity.x,1.2);
  assert.equal(f.gateway.crossings,0);
  f.body.teleport(new pc.Vec3(-.35,2.03,0));
  f.arrival.update(.02);
  assert.equal(f.gateway.crossings,1);
  f.body.teleport(new pc.Vec3(1.2,2.03,0));
  f.arrival.update(.02);
  assert.equal(f.arrival.active,false);
  assert.equal(f.body.linearFactor.y,1);
  f.original.destroy();f.root.destroy();
  f.owner.app.destroy();
});

test("clips all gate material variants in world space and updates the rear camera rejection per render", () => {
  const f = fixture();
  const hadCameraListener = f.owner.app.scene.hasEvent(pc.EVENT_PRERENDER);
  const before = f.original.getShaderChunks(pc.SHADERLANGUAGE_GLSL).get("opacityPS");
  f.arrival.start(f.gateway);
  const ghost = f.instance.material;
  for (const language of [pc.SHADERLANGUAGE_GLSL,pc.SHADERLANGUAGE_WGSL]) {
    const shader = ghost.getShaderChunks(language).get("opacityPS");
    assert.match(shader,/vPositionW/);
    assert.match(shader,/uGateViewPosition/);
    assert.match(shader,/discard/);
    assert.match(shader,/getGateSkinOpacity/);
  }
  assert.deepEqual(Array.from(ghost.getParameter("uGateClipPlane").data),[-1,0,0,-0]);
  const camera = {entity:new pc.Entity()};
  camera.entity.setPosition(3,4,0);
  f.owner.app.scene.fire(pc.EVENT_PRERENDER,camera);
  assert.deepEqual(ghost.getParameter("uGateViewPosition").data,[3,4,0]);
  assert.equal(f.original.getShaderChunks(pc.SHADERLANGUAGE_GLSL).get("opacityPS"),before);
  f.arrival.finish();
  assert.equal(f.instance.material,f.original);
  assert.equal(f.owner.app.scene.hasEvent(pc.EVENT_PRERENDER),hadCameraListener);
  assert.equal(f.arrival.cameraHandle,null);
  f.root.destroy();
  f.owner.app.destroy();
});
