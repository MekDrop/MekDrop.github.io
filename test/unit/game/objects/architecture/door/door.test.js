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
