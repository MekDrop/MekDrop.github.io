import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { Door } from "../../../../../../src/game/objects/architecture/door/Door.js";

it("jam holds animation and collision pose across every opening API; clearing resumes motion", () => {
  let animationTime = 0;
  const layer = {
    play: () => {},
    set activeStateCurrentTime(value) {
      animationTime = value;
    },
  };
  class Entity extends pc.Entity {
    addComponent() {
      this.anim = {
        addAnimationState: () => {},
        baseLayer: layer,
        update: () => {},
      };
    }
  }
  const entity = new Entity();
  const door = new Door({
    pc,
    entity,
    animationEntity: entity,
    modelUrl: "test.glb",
    animationName: "open",
    modelLibrary: { getAnimationTracks: () => new Map([["open", { duration: 1 }]]) },
    collision: {
      blocksAt: () => true,
      destroy: () => {},
    },
  });
  const glue = { clear: () => {} };
  assert.equal(door.jamShut(glue), true);
  door.openAmount = 1;
  door.openTemporarily(10);
  door.sequenceOpenAmount = 1;
  door.testOpenAmount = 1;
  door.handlePointerDown();
  door.update(1, true);
  assert.equal(door.openAmount, 0);
  assert.equal(animationTime, 0);
  assert.equal(door.intersectsFootprint(0, 0, 0.3), true);
  door.clearGlue();
  door.update(1, true);
  assert.equal(door.openAmount, 1);
  assert.equal(animationTime, 1);
  assert.equal(door.jamShut(glue), false, "open leaves cannot be glued");
  door.destroy();
});
