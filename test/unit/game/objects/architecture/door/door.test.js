import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { Door } from "../../../../../../src/game/objects/architecture/door/Door.js";
import { DoorLeafQueries } from "../../../../../../src/game/objects/architecture/door/DoorLeafQueries.js";
import * as pc from "playcanvas";
import { NpcDoorAvoidance } from "../../../../../../src/game/objects/shared/NpcDoorAvoidance.js";

function fixture(options = {}) {
  const entity = new Entity("Custom door");
  const hinge = new Entity("Custom hinge");
  const handle = new Entity("Custom handle");
  hinge.addChild(handle);
  entity.addChild(hinge);
  let sampled = false;
  const layer = {
    activeStateCurrentTime: -1,
    play: (name) => {
      assert.equal(name, "Custom opening");
    },
  };
  entity.addComponent = () => {
    entity.anim = {
      baseLayer: layer,
      addAnimationState: (name) => {
        assert.equal(name, "Custom opening");
      },
      update: () => {
        sampled = true;
      },
    };
  };
  const door = new Door({
    entity,
    modelLibrary: {
      getAnimationTracks: (url, names) => {
        assert.equal(url, "custom.glb");
        assert.deepEqual(names, ["Custom opening"]);

        return new Map([["Custom opening", { duration: 4 }]]);
      },
    },
    modelUrl: "custom.glb",
    animationName: "Custom opening",
    hingeName: "Custom hinge",
    handleName: "Custom handle",
    openSpeed: 0.5,
    automatic: false,
    collision: () => {
      assert.equal(sampled, true, "sample the closed clip before creating collision");

      return new DoorLeafQueries({
        pc,
        hinge,
        width: 2,
        height: 3,
        depth: 0.1,
      });
    },
    ...options,
  });

  return {
    door,
    layer,
    entity,
    handle,
  };
}

it("reserves the leaf clearance without trapping occupants across the room", () => {
  const { door, entity } = fixture();
  const root = new Entity();
  root._enabledInHierarchy = true;
  root.addChild(entity);
  const npc = new Entity("Walking resident");
  root.addChild(npc);
  npc.setPosition(0, 0, 1.5);
  const reaction = new NpcDoorAvoidance(npc, new pc.EventHandler());
  door.npcNavigation = () => true;
  try {
    door.update(0.1, true);
    assert.equal(reaction.behavior.reacting, false);
    npc.setPosition(0, 0, 0.3);
    door.update(0.1, true);
    assert.equal(reaction.behavior.reacting, true);
  } finally {
    reaction.destroy();
    door.destroy();
    root.destroy();
  }
});

it("opens interior doors only near their own doorway on the same floor", () => {
  const { door } = fixture({
    automatic: true,
    upperFloor: true,
    width: 1.25,
    openSpeed: 1.7,
  });
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 4,
  });
  door.update(0.1);
  assert.equal(door.openAmount, 0, "distant visitors leave the room closed");
  door.updateHeroPosition({
    x: 2,
    y: 0,
    z: 0.5,
  });
  door.update(0.1);
  assert.equal(door.openAmount, 0, "visitors beside another room leave the door closed");
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 2.5,
  });
  door.update(0.1);
  assert.ok(door.openAmount > 0);
  door.updateHeroPosition({
    x: 0,
    y: 4,
    z: 4,
  });
  door.update(1);
  assert.equal(door.openAmount, 0);
  door.destroy();
});

it("supports independent model, clip, speed, hinge and query dimensions", () => {
  const { door, layer, handle } = fixture();
  assert.equal(door.insideHandle, handle);
  door.update(0.5, true);
  assert.equal(door.openAmount, 0.25);
  assert.equal(layer.activeStateCurrentTime, 1);
  const hit = door.getPointerHit(new Vec3(1.5, 2, 1), new Vec3(1.5, 2, -1));
  assert.equal(hit.pointerTarget, door);
  assert.equal(hit.distance, 0.5);
  assert.equal(door.blocksCameraAt(1.5, 2, 0.05), true);
  assert.equal(door.blocksCameraAt(2.5, 2, 0.05), false);
  door.destroy();
});

it("keeps scripted doors closed for nearby visitors while allowing click opening", () => {
  const { door } = fixture();
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 0,
  });
  door.update(0.5);
  assert.equal(door.openAmount, 0);
  assert.equal(door.handlePointerDown(), true);
  door.update(0.5);
  assert.equal(door.openAmount, 0.25);
  door.update(1);
  assert.equal(door.openAmount, 0);
  door.destroy();
});

it("lets choreography own click interaction and releases the door hierarchy on destruction", () => {
  let clicks = 0;
  const { door, entity } = fixture({
    onOpen: () => {
      clicks++;

      return true;
    },
  });
  const parent = new Entity("Structure");
  parent.addChild(entity);
  assert.equal(door.handlePointerDown(), true);
  door.update(0.5);
  assert.equal(clicks, 1);
  assert.equal(door.openAmount, 0, "callback controls the opening sequence");
  door.destroy();
  assert.equal(parent.children.length, 0);
  assert.equal(door.insideHandle, null);
  assert.equal(door.getPointerHit(new Vec3(), new Vec3()), null);
  assert.equal(door.blocksCameraAt(0, 0, 0), false);
});

it("releases owned model materials exactly once when destroyed", () => {
  let destroyed = 0;
  const { door } = fixture({
    ownedMaterials: [{
      destroy: () => {
        destroyed++;
      },
    }],
  });
  door.destroy();
  door.destroy();
  assert.equal(destroyed, 1);
});

it("damage removes moving leaves but keeps the frame and clears door queries", () => {
  let removed = 0;
  let frames = 0;
  const { door, entity } = fixture({
    collision:{
      raycast: () => 0.2,
      blocksAt: () => true,
      syncFrameBodies: () => {
        frames++;
      },
      breakLeaves: () => {
        removed++;
      },
      destroy: () => {},
    },
  });
  const activeRoot = new Entity("Active test scene");
  activeRoot._enabledInHierarchy = true;
  activeRoot.addChild(entity);
  assert.equal(door.receiveDamage(8), 8);
  assert.equal(door.health, 40);
  assert.equal(removed, 0);
  assert.equal(door.intersectsFootprint(0,0,.5), true);
  assert.equal(door.receiveDamage(100), 40);
  assert.equal(door.health, 0);
  assert.equal(door.broken, true);
  assert.equal(door.openAmount, 1);
  assert.equal(door.revealsInterior, true);
  assert.equal(removed, 1);
  assert.equal(entity.enabled, true, "masonry-owning root survives");
  assert.equal(door.intersectsFootprint(0,0,.5), false);
  assert.equal(door.blocksCameraAt(0,0,0), false);
  assert.equal(door.getHit(new Vec3(),new Vec3(1,0,0)), null);
  assert.equal(door.handlePointerDown(), false);
  door.testOpenAmount = 0;
  door.update(1, false);
  assert.equal(door.openAmount, 1);
  assert.ok(frames >= 2, "frame bodies keep following the castle");
  assert.equal(door.receiveDamage(8),0);
  assert.equal(removed,1);
  door.destroy();
});

it("nonlethal damage retains the existing opening timeline and rejects invalid amounts", () => {
  const {door,layer}=fixture();
  const activeRoot = new Entity("Active test scene");
  activeRoot._enabledInHierarchy = true;
  activeRoot.addChild(door.entity);
  for (const amount of [NaN,Infinity,0,-1]) {
    assert.equal(door.receiveDamage(amount),0);
  }
  door.receiveDamage(8);
  door.update(1,true);
  assert.equal(door.openAmount,.5);
  assert.equal(layer.activeStateCurrentTime,2);
  assert.equal(door.entity.findByName('Custom hinge').enabled,true);
  door.receiveDamage(40);
  assert.equal(door.entity.findByName('Custom hinge').enabled,false);
  assert.equal(door.entity.enabled,true);
  door.destroy();
  assert.equal(door.receiveDamage(8),0);
});
