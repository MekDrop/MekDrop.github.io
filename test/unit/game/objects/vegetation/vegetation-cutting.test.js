import assert from "node:assert/strict";
import { it } from "node:test";
import { VegetationInteraction } from "../../../../../src/game/objects/vegetation/VegetationInteraction.js";
import { DestructibleVegetation } from "../../../../../src/game/objects/vegetation/DestructibleVegetation.js";
import * as pc from "playcanvas";

it("removes only the contacted cell and leaves neighbouring cells on the same level", () => {
  const parts = [-1, 0, 1].map(x => ({
    name: `Voxel cell ${x} 1 0`,
    children: [],
    enabled: true,
  }));
  const plant = new DestructibleVegetation({
    modelLibrary: {
      instantiate: () => ({
        children: parts,
        setLocalPosition: () => {},
        setLocalEulerAngles: () => {},
      }),
    },
    kind: "bush",
    collisionRows: [{
      y: 1,
      cells: [[-1, 0], [0, 0], [1, 0]],
    }],
    x: 0,
    y: 0,
    z: 0,
  });
  assert.equal(plant.cut(), null, "a timed impact without contact cannot remove a level");
  assert.equal(plant.cut({
    x: -.25,
    y: .375,
    z: 0,
  }).health, 2);
  assert.deepEqual(parts.map(p => p.enabled), [false, true, true]);
  assert.equal(plant.cut({
    x: -.25,
    y: .375,
    z: 0,
  }), null, "repeated contact does not remove another cell");
  assert.equal(plant.describe().cutHeight, .375);
  assert.equal(plant.collisionDepthAt(.25, 0, .01), .135);
});

it("cuts one highest level in one sweep, progressing across columns including their depth", () => {
  const world = {
    createShape: () => ({}),
    addCompoundChild: () => {},
    destroyShape: () => {},
  };
  class PhysicsEntity extends pc.Entity {
    addComponent(type) {
      if (type === "collision") {
        this.collision = {
          shape: {},
          system: { physicsWorld: world },
        };
      }
      if (type === "rigidbody") {
        this.rigidbody = { system: {} };
      }
    }
  }
  const plant = new DestructibleVegetation({
    pc: {
      ...pc,
      Entity: PhysicsEntity,
    },
    modelLibrary: { instantiate: () => new pc.Entity("cells") },
    kind: "bush",
    collisionRows: [{
      y: 0,
      cells: [[0, 0]],
    },
    {
      y: 1,
      cells: [[-1, 0], [-1, 1], [0, 0], [0, 1], [1, 0], [1, 1]],
    }],
    x: 2,
    y: 3,
    z: 1,
    rotation: 90,
  });
  plant.cuttingTargetFrom({
    x: 0,
    z: 1,
  });
  const edge = x => [new pc.Vec3(1.875, 3.375, 1 - x)];
  assert.equal(plant.cutSweep(edge(-.4), edge(-.2), .125), null, "the next level is protected");
  assert.equal(plant.cutSweep(edge(-.4), edge(-.2), .375).health, 5, "front and rear cells in the first column are cut together");
  assert.equal(plant.describe().cutHeight, .375, "other columns remain until the blade reaches them");
  assert.equal(plant.cutSweep(edge(-.2), edge(.1), .375).health, 3);
  assert.equal(plant.cutSweep(edge(.1), edge(.4), .375).health, 1);
  assert.equal(plant.describe().cutHeight, .125, "one pass clears exactly the highest level");
  plant.entity.destroy();
});

it("retains the original ground footprint when the trunk is cut before the last canopy cell", () => {
  const plant = new DestructibleVegetation({
    modelLibrary: {
      instantiate: () => ({
        children: [],
        setLocalPosition: () => {},
        setLocalEulerAngles: () => {},
        destroy: () => {},
      }),
    },
    kind: "tree",
    collisionRows: [{
      y: 0,
      cells: [[0, 0]],
    }, {
      y: 1,
      cells: [[0, 0]],
    }],
    x: 0,
    y: 0,
    z: 0,
  });
  plant.cut({
    x: 0,
    y: .125,
    z: 0,
  });
  const last = plant.cut({
    x: 0,
    y: .375,
    z: 0,
  });
  assert.equal(last.destroyed, true);
  assert.equal(last.groundFootprint.length, 1);
});

it("refreshes the next stroke height only after a successful cut", () => {
  let stage = 0;
  let request;
  const item = {
    get canInteract() {
      return stage < 2;
    },
    cuttingTargetFrom: () => ({
      x: 0,
      y: 2,
      z: -0.375,
      yaw: 0,
    }),
    describe: () => ({
      x: 0,
      y: 2,
      z: 0,
      kind: "tree",
      heightClass: stage ? "middle" : "high",
      cutHeight: 1.375 - stage * 0.25,
    }),
    cutSweep: () => ({ destroyed: ++stage === 2 }),
  };
  const interaction = new VegetationInteraction({
    item,
    hero: {
      position: {
        x: 0,
        y: 2,
        z: -1,
      },
      repositionTool: () => true,
      useTool: (tool, options) => {
        request = options;

        return true;
      },
    },
    tool: { contactLateralOffset: 0.12 },
    onChange: () => {},
    onComplete: () => {},
    onDestroyed: () => {},
  });
  assert.equal(interaction.interact(), true);
  assert.equal(request.context.cutHeight, 1.375);
  assert.equal(request.targetPosition.z, -0.375);
  assert.equal(request.targetPosition.x, -0.12);
  assert.equal(request.targetDistance, 0.62);
  const action = { toolContext: { ...request.context } };
  request.onContact(action, [], []);
  assert.equal(request.onImpact(action), false);
  assert.equal(action.toolContext.cutHeight, 1.375);
  assert.equal(request.onCycle(action), true);
  assert.equal(action.toolContext.cutHeight, 1.125);
  assert.equal(action.toolContext.heightClass, "middle");
  request.onContact(action, [], []);
  assert.equal(request.onImpact(action), true);
});

it("reports the middle of each remaining voxel layer above the vegetation base", () => {
  const entity = {
    name: "test",
    children: [],
    setLocalPosition: () => {},
    setLocalEulerAngles: () => {},
    destroy: () => {},
  };
  const plant = new DestructibleVegetation({
    modelLibrary: { instantiate: () => entity },
    id: "cut-height",
    kind: "bush",
    cutsRequired: 3,
    collisionRows: [0, 1, 2].map(y => ({
      y,
      cells: [[0, 0]],
    })),
    x: 0,
    y: 2,
    z: 0,
  });
  for (const height of [0.625, 0.375, 0.125]) {
    assert.equal(plant.describe().cutHeight, height);
    assert.equal(plant.cuttingTargetFrom({
      x: 0,
      z: -1,
    }).z, -0.125);
    plant.cut({
      x: 0,
      y: height,
      z: 0,
    });
  }
});

it("moves the cutting face inward when a wide canopy layer is removed", () => {
  const plant = new DestructibleVegetation({
    modelLibrary: {
      instantiate: () => ({
        children: [],
        setLocalPosition: () => {},
        setLocalEulerAngles: () => {},
      }),
    },
    id: "cut-face",
    kind: "tree",
    cutsRequired: 2,
    collisionRows: [{
      y: 0,
      cells: [[0, 0]],
    }, {
      y: 1,
      cells: [[0, -1], [0, 0], [0, 1]],
    }],
    x: 0,
    y: 0,
    z: 0,
  });
  assert.equal(plant.cuttingTargetFrom({
    x: 0,
    z: -2,
  }).z, -0.375);
  for (const z of [-1, 0, 1]) {
    plant.cut({
      x: 0,
      y: .375,
      z: z * .25,
    });
  }
  assert.equal(plant.cuttingTargetFrom({
    x: 0,
    z: -2,
  }).z, -0.125);
});
