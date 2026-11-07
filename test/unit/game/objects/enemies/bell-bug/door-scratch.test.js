import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { BellBugDoorScratch } from "../../../../../../src/game/objects/enemies/bell-bug/BellBugDoorScratch.js";
import { BellBugScratchState } from "../../../../../../src/game/objects/enemies/bell-bug/states/BellBugScratchState.js";

const fixture = () => {
  const entity = new Entity();
  entity.setPosition(0, 0, 0.45);
  const wood = [], scrapes = [], hits = [], sounds = [];
  const door = {
    entity: new Entity(),
    openAmount: 0,
    audio: { play: name => sounds.push(name) },
    getHit: (start, end) => {
      const distance = -start.z / (end.z - start.z);

      return distance >= 0 && distance <= 1 ? { distance } : null;
    },
    scratchSurface: (start, end, source, width, playContactSound) => {
      wood.push([start, end, playContactSound]);

      return 8;
    },
    clearGlue: () => assert.fail("a local scrape must not clear the entire jam"),
  };
  const mass = {
    scrapeAt: (start, end, radius) => {
      scrapes.push([start, end, radius]);

      return 0.001;
    },
  };
  const owner = {
    pc: { Vec3 },
    entity,
    position: entity.getPosition(),
    scratchTarget: door,
    canScratchDoor: true,
    phaseTime: 0.45,
    playGooSound: name => sounds.push(name),
    app: { systems: { rigidbody: { raycastAll: () => hits } } },
  };
  let goo = true;
  const query = (target, origin) => goo ? {
    point: new Vec3(origin.x, origin.x > 0 ? 0.55 : 0.65, 0.025),
    mass,
  } : null;
  const controller = new BellBugDoorScratch(owner, {
    random: () => 0.5,
    findGoo: query,
  });

  return {
    owner,
    controller,
    wood,
    scrapes,
    hits,
    sounds,
    clearReachableGoo: () => {
      goo = false;
    },
  };
};

test("wood sounds once at claw contact before damage, and contact feedback survives an ineffective drag", () => {
  const { owner, controller, sounds, wood, clearReachableGoo } = fixture();
  clearReachableGoo();
  controller.prepare();
  assert.deepEqual(sounds, [], "windup is silent");
  assert.equal(controller.beginContact(), true);
  assert.equal(controller.beginContact(), false);
  assert.deepEqual(sounds, ["scratch"]);
  assert.equal(controller.apply(), true);
  assert.equal(wood[0][2], false, "damage must not replay an already sounded contact");
  owner.phaseTime = 1.1;
  controller.prepare();
  assert.equal(controller.beginContact(), true);
  owner.scratchTarget.scratchSurface = () => 0;
  assert.equal(controller.apply(), false);
  assert.deepEqual(sounds, ["scratch", "scratch"], "real contact is audible even if it fails to deepen the cut");
});

test("goo contact squishes once while blocked or cancelled swipes stay silent", () => {
  const { controller, sounds, hits } = fixture();
  controller.prepare();
  assert.equal(controller.beginContact(), true);
  assert.equal(controller.beginContact(), false);
  assert.deepEqual(sounds, ["gooPress"]);
  controller.reset();
  controller.prepare();
  hits.push({
    entity: new Entity("wall"),
    hitFraction: 0.1,
  });
  assert.equal(controller.beginContact(), false);
  assert.equal(controller.stroke, null);
  assert.deepEqual(sounds, ["gooPress"]);
});

test("a sideways bug cannot sound or collect until it faces its contact point", () => {
  const { owner, controller, sounds, scrapes } = fixture();
  controller.prepare();
  owner.entity.setEulerAngles(0,90,0);
  assert.equal(controller.facingStroke,false);
  assert.equal(controller.beginContact(),false);
  assert.equal(controller.apply(),false);
  assert.deepEqual(sounds,[]);
  assert.equal(scrapes.length,0);
  owner.entity.setEulerAngles(0,0,0);
  assert.equal(controller.facingStroke,true);
  assert.equal(controller.beginContact(),true);
  assert.equal(controller.apply(),true);
  assert.deepEqual(sounds,["gooPress"]);
  assert.equal(scrapes.length,1);
});

test("finish swallowing while facing the collected contact before taking another step", () => {
  const { owner, controller } = fixture();
  const contact = new Vec3(0,0.5,0.025);
  controller.meal = {
    active:true,
    contact,
  };
  controller.prepare = () => assert.fail("a mouthful must finish before planning another stroke");
  owner.doorScratch = controller;
  owner.deltaTime = 0.016;
  owner.stop = () => {};
  owner.moveToward = () => assert.fail("swallowing must not start a sideways walk");
  let faced;
  owner.faceTarget = target => {
    faced = target.position;
  };
  owner.playClip = () => {};
  const phase = owner.phaseTime;
  new BellBugScratchState().execute(owner);
  assert.ok(faced.clone().sub(owner.position).normalize().dot(owner.entity.forward)>0.99);
  assert.equal(owner.phaseTime,phase);
});

test("the inactive authored foreclaw stays parked while only the selected claw drags", () => {
  const { owner, controller, clearReachableGoo } = fixture();
  const goals = [[], []];
  const feet = [0, 1].map(side => ({
    source: {},
    bone: { getPosition: () => new Vec3(side ? -0.15 : 0.15, 0.45, 0.3) },
    length: 0.3,
    point: new Vec3(side ? -0.15 : 0.15, 0.5, 0.1),
    canReach: () => true,
    pose: point => goals[side].push(point.clone()),
  }));
  owner.animationPlayback = { scoopPose: { foot: side => feet[side] } };
  owner.alive = true;
  owner.stateName = "BellBugScratchState";
  let render;
  owner.app.on = (event, callback, scope) => {
    render = () => callback.call(scope);

    return { off: () => {} };
  };
  clearReachableGoo();
  controller.attach();
  controller.prepare();
  owner.phaseTime = 0.65;
  render();
  assert.ok(Math.abs(goals[controller.stroke.side][0].z) < 1e-6, "active claw is on wood");
  assert.ok(goals[1 - controller.stroke.side][0].z > 0.2, "unused claw is held away from the door");
  controller.destroy();
});

test("lowest reachable goo is scraped before random exposed wood", () => {
  const { owner, controller, wood, scrapes, clearReachableGoo } = fixture();
  controller.prepare();
  assert.equal(controller.stroke.side, 0);
  assert.equal(controller.stroke.start.y, 0.55);
  assert.equal(controller.apply(), true);
  assert.equal(scrapes.length, 1);
  assert.equal(wood.length, 0);
  assert.equal(controller.removedVolume, 0.001);
  clearReachableGoo();
  owner.phaseTime = 1.1;
  controller.prepare();
  assert.equal(controller.apply(), true);
  assert.equal(wood.length, 1);
  assert.equal(controller.woodStrokes, 1);
});

test("an empty stance chooses a reachable lateral collecting position before scratching wood", () => {
  const { owner, controller, wood } = fixture();
  const mass = { active:true };
  controller.findGoo = (door,origin,reach) => {
    const point = new Vec3(0.48,0.5,0.025);

    return origin.distance(point)<=reach ? {
      point,
      mass,
    } : null;
  };
  controller.prepare();
  assert.equal(controller.stroke,null);
  assert.ok(controller.repositionTarget);
  const position = controller.repositionTarget.position;
  assert.ok(position.x>owner.position.x);
  assert.equal(position.z,owner.position.z, "sidestep along the door instead of walking into it");
  assert.equal(controller.apply(),false);
  assert.equal(wood.length,0);
  owner.entity.setPosition(position);
  owner.position = owner.entity.getPosition();
  controller.finishReposition();
  owner.phaseTime += 0.75;
  controller.prepare();
  assert.equal(controller.repositionTarget,null);
  assert.equal(controller.stroke.mass,mass, "resume collecting from the new stance");
});

test("repositioning walks without sounding or applying a scratch", () => {
  const { owner, controller } = fixture();
  const goal = { position:new Vec3(0.3,0,0.45) };
  controller.repositionTarget = goal;
  controller.prepare = () => {};
  controller.beginContact = () => assert.fail("walking must not sound a claw contact");
  owner.doorScratch = controller;
  owner.deltaTime = 0.016;
  owner.walkSpeed = 1;
  owner.stop = () => {};
  owner.scratchDoor = () => assert.fail("walking must not scrape material");
  let moved, clip;
  owner.moveToward = target => {
    moved = target;

    return true;
  };
  owner.playClip = name => {
    clip = name;
  };
  new BellBugScratchState().execute(owner);
  assert.equal(moved,goal);
  assert.equal(clip,"scuttle_walk");
});

test("a collecting stance stays committed across scoop timer boundaries", () => {
  const { owner, controller } = fixture();
  const goal = { position:new Vec3(0.3,0,0.45) };
  controller.repositionTarget = goal;
  controller.findGoo = () => assert.fail("walking must finish before selecting another stance");
  owner.phaseTime = 4.8;
  controller.prepare();
  assert.equal(controller.repositionTarget,goal);
});

test("arrival faces straight into the door and starts a fresh windup", () => {
  const { owner, controller } = fixture();
  const contact = new Vec3(0.25,0.5,0.025);
  controller.repositionTarget = {
    position:owner.position.clone(),
    contact,
  };
  controller.prepare = () => {};
  owner.doorScratch = controller;
  owner.deltaTime = 0.016;
  owner.walkSpeed = 1;
  owner.phaseTime = 4.8;
  owner.stop = () => {};
  owner.moveToward = () => false;
  owner.playClip = () => {};
  let faced;
  owner.faceTarget = target => {
    faced = target.position;
  };
  const state = new BellBugScratchState();
  state.execute(owner);
  assert.ok(faced.clone().sub(owner.position).normalize().dot(owner.entity.forward)>0.99);
  assert.equal(controller.repositionTarget,null);
  assert.equal(owner.phaseTime,0);
  assert.equal(state.lastContactSound,-1);
});

test("alternating lateral claw contacts keep the same working heading", () => {
  const { owner, controller } = fixture();
  controller.prepare();
  controller.stroke.start.x = -0.3;
  const before = controller.facingTarget.position.clone();
  controller.stroke.start.x = 0.3;
  assert.ok(controller.facingTarget.position.distance(before)<1e-8);
  assert.equal(controller.facingStroke,true, "a lateral claw reach must not turn the body back and forth");
  owner.entity.setEulerAngles(0,90,0);
  assert.equal(controller.facingStroke,false, "walking sideways still cannot collect");
});

test("contact planning waits for the raised start pose to settle", () => {
  const { owner, controller } = fixture();
  owner.phaseTime = 0.3;
  controller.prepare();
  assert.equal(controller.stroke,null);
  owner.phaseTime = 0.45;
  controller.prepare();
  assert.ok(controller.stroke?.mass);
});

test("a blocked walking goal is abandoned instead of looping at that goal", () => {
  const { owner, controller } = fixture();
  controller.repositionTarget = { position:new Vec3(0.3,0,0.45) };
  controller.prepare = () => {};
  owner.doorScratch = controller;
  owner.deltaTime = 0.25;
  owner.walkSpeed = 1;
  owner.stop = () => {};
  owner.moveToward = () => false;
  owner.playClip = () => {};
  const state = new BellBugScratchState();
  for (let frame=0;frame<5;frame++) {
    state.execute(owner);
  }
  assert.equal(controller.repositionTarget,null);
  assert.equal(controller.blockedStances.length,1);
  assert.equal(owner.phaseTime,0);
});

test("turning toward a selected stroke pauses its timer until the next frame", () => {
  const { owner, controller, sounds } = fixture();
  controller.prepare();
  controller.prepare = () => {};
  owner.entity.setEulerAngles(0,90,0);
  owner.doorScratch = controller;
  owner.phaseTime = 0.51;
  owner.deltaTime = 0.016;
  owner.stop = () => {};
  owner.faceTarget = () => owner.entity.setEulerAngles(0,0,0);
  owner.playClip = () => {};
  const state = new BellBugScratchState();
  state.lastContact = -1;
  state.lastContactSound = -1;
  state.execute(owner);
  assert.equal(owner.phaseTime,0.51);
  assert.deepEqual(sounds,[]);
  state.execute(owner);
  assert.deepEqual(sounds,["gooPress"]);
});

test("goo dragging holds the raised socket pose instead of switching to the lower wood loop", () => {
  const { owner, controller } = fixture();
  controller.prepare();
  controller.prepare = () => {};
  owner.doorScratch = controller;
  owner.phaseTime = 0.65;
  owner.deltaTime = 0.016;
  owner.stop = () => {};
  let clip;
  owner.playClip = name => {
    clip = name;
  };
  const state = new BellBugScratchState();
  state.lastContactSound = 0;
  state.execute(owner);
  assert.equal(clip,"door_scratch_start");
  controller.stroke.mass = null;
  state.execute(owner);
  assert.equal(clip,"door_scratch_loop", "bare wood retains its authored scratch loop");
});

test("a wall, opening door or out-of-reach contact cancels material removal", () => {
  const { owner, controller, scrapes, hits } = fixture();
  controller.prepare();
  hits.push({
    entity: new Entity("wall"),
    hitFraction: 0.1,
  });
  assert.equal(controller.apply(), false);
  hits.length = 0;
  owner.canScratchDoor = false;
  assert.equal(controller.apply(), false);
  owner.canScratchDoor = true;
  controller.reset();
  controller.prepare();
  controller.stroke.start.y = 2;
  assert.equal(controller.apply(), false);
  assert.equal(scrapes.length, 0);
});

test("a silent failed contact abandons its stance instead of repeating the same swipe", () => {
  const { controller, owner, hits, sounds } = fixture();
  controller.prepare();
  hits.push({
    entity:new Entity("projecting brace"),
    hitFraction:0.1,
  });
  assert.equal(controller.beginContact(),false);
  assert.equal(controller.stroke,null);
  assert.deepEqual(sounds,[]);
  hits.length = 0;
  controller.prepare();
  assert.equal(controller.stroke,null, "the rejected stance is not retried in the next prepare");
  assert.ok(controller.repositionTarget);
  assert.ok(controller.repositionTarget.position.distance(owner.position)>=0.2);
});

test("a scrape which removes no goo also triggers repositioning", () => {
  const { controller, sounds } = fixture();
  controller.prepare();
  controller.stroke.mass.scrapeAt = () => 0;
  assert.equal(controller.apply(),false);
  assert.equal(controller.gooStrokes,0);
  assert.equal(controller.stroke,null);
  assert.ok(controller.repositionTarget);
  assert.deepEqual(sounds,[], "failed collection adds no sound");
});

test("wood contact waits if fresh goo comes into reach during the windup", () => {
  const { owner, controller, wood, clearReachableGoo } = fixture();
  clearReachableGoo();
  controller.prepare();
  controller.findGoo = () => ({
    point: new Vec3(0, 0.5, 0),
    mass: {},
  });
  assert.equal(controller.apply(), false);
  assert.equal(wood.length, 0);
  owner.phaseTime = 1.1;
  controller.prepare();
  assert.ok(controller.stroke.mass);
});

test("wood waits for gel inside actual reach even outside the pose reserve", () => {
  const { owner, controller, wood, clearReachableGoo } = fixture();
  controller.findGoo = (door, origin, reach) => reach > 0.45 ? {
    point: new Vec3(0, 0.5, 0),
    mass: {},
  } : null;
  controller.prepare();
  assert.ok(controller.stroke.mass);
  clearReachableGoo();
  controller.findGoo = () => null;
  owner.phaseTime = 1.1;
  controller.prepare();
  assert.ok(controller.stroke);
  controller.findGoo = (door, origin, reach) => reach > 0.45 ? {
    point: new Vec3(0, 0.5, 0),
    mass: {},
  } : null;
  assert.equal(controller.apply(), false);
  assert.equal(wood.length, 0);
});
