import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { Bush } from "../../../../../src/game/objects/vegetation/Bush.js";
import { VegetationInteraction } from "../../../../../src/game/objects/vegetation/VegetationInteraction.js";

function createBush() {
  return new Bush({
    modelLibrary: { instantiate: () => new Entity("bush") },
    modelUrl: "bush.glb",
    id: "bush",
    variant: "round-bush",
    collisionRows: [
      {
        y: 0,
        cells: [[0, 0], [-1, 0], [1, 0]],
      },
      {
        y: 1,
        cells: [[0, 0], [1, 0]],
      },
      {
        y: 2,
        cells: [[0, 0]],
      },
    ],
    x: 0,
    y: 0,
    z: 0,
  });
}

it("burns exactly one exposed level per burst and rejects stale impact heights", () => {
  const bush = createBush();
  assert.equal(bush.burnLevel(0.125), null);
  assert.equal(bush.burnLevel(0.625).health, 5);
  assert.equal(bush.burnLevel(0.625), null);
  assert.deepEqual(bush.remainingVoxels.map(voxel => voxel.y), [0, 0, 0, 1, 1]);
  assert.equal(bush.burnLevel(0.375).health, 3);
  assert.equal(bush.burnLevel(0.125).destroyed, true);
  assert.equal(bush.canInteract, false);
});

it("uses successive burner impacts without axe contacts, hit stop, or walking between levels", () => {
  const bush = createBush();
  let callbacks;
  let destroyed = 0;
  const hero = {
    position: new Vec3(0, 0, -1),
    isUsingTool: false,
    useTool: (tool, options) => {
      callbacks = options;

      return true;
    },
    repositionTool: () => assert.fail("the burner stays planted during its quick level sweep"),
    playToolContact: () => assert.fail("burning must not play axe sounds"),
  };
  const interaction = new VegetationInteraction({
    item: bush,
    hero,
    tool: { name: "burner" },
    onDestroyed: () => destroyed++,
  });
  assert.equal(interaction.interact(), true);
  const action = { toolContext: callbacks.context };
  callbacks.onContact(action, [], []);
  assert.equal(bush.describe().health, 6);
  for (const [index, height] of [0.625, 0.375, 0.125].entries()) {
    assert.equal(action.toolContext.cutHeight, height);
    assert.equal(callbacks.onImpact(action), index === 2);
    assert.equal(action.hitStopRemaining, undefined);
    if (index < 2) {
      assert.equal(callbacks.onCycle(action), true);
    }
  }
  assert.equal(destroyed, 1);
});
