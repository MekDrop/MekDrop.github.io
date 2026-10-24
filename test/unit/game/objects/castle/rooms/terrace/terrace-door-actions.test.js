import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CastleGenerator } from "../../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { TerraceDoorInspection } from "../../../../../../../src/game/objects/castle/rooms/terrace/TerraceDoorInspection.js";
import { TerraceInspectorWalk } from "../../../../../../../src/game/objects/castle/rooms/terrace/TerraceInspectorWalk.js";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../../../../../../src/game/enum/CastleTerracePhase.js";
import { TERRACE_DOOR_INSPECTION_PHASE as INSPECTION } from "../../../../../../../src/game/enum/TerraceDoorInspectionPhase.js";

const source = readFileSync(new URL("../../../../../../../src/game/objects/castle/rooms/terrace/TerraceDoorActions.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");
const Actions = new Function("CHARACTER_HEIGHT", "PHASE", "INSPECTION", "Door", "terraceDoorModel", "TerraceDoorInspection", "TerraceInspectorWalk",
  `${source.replace("export class", "class")}\nreturn TerraceDoorActions;`)(1.8, PHASE, INSPECTION,
  class {
    constructor() {
      assert.fail("an existing terrace door must not create a stairhead");
    }
  },
  {}, TerraceDoorInspection, TerraceInspectorWalk);

it("inspects and closes the authored terrace door without adding or destroying castle geometry", async () => {
  const plan = await CastleGenerator.generate({
    position: {
      x: -8,
      z: -8,
      width: 16,
      depth: 16,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 7,
      width: 2,
    }],
    seed: 0,
  });
  const root = new pc.Entity("Activity");
  const layout = plan.metadata.runtime.terrace;
  root.setLocalPosition(layout.x, layout.y, layout.z);
  root.setLocalEulerAngles(0, layout.yaw, 0);
  const stage = new pc.Entity("Participants");
  stage.setLocalScale(0.45, 0.45, 0.45);
  root.addChild(stage);
  const castle = new pc.Entity("Castle");
  castle._enabledInHierarchy = true;
  castle.addChild(root);
  const doorEntity = new pc.Entity("Authored landing door");
  castle.addChild(doorEntity);
  const handle = new pc.Entity("Handle");
  handle.setLocalPosition(layout.x, layout.y + 1, layout.z);
  doorEntity.addChild(handle);
  const inspector = {
    entity: new pc.Entity("Inspector"),
    height: 1.8,
    pose: () => {},
    evaluatePose: () => {},
  };
  inspector.rightHand = new pc.Entity("Hand");
  inspector.entity.addChild(inspector.rightHand);
  root.addChild(inspector.entity);
  const door = {
    entity: doorEntity,
    insideHandle: handle,
    hingeRotation: new pc.Quat(),
    openAmount: 0,
    sequenceOpenAmount: null,
    onOpen: null,
    update: () => {
      assert.fail("the castle retains ownership of its physics update");
    },
    destroy: () => {
      assert.fail("the activity must not destroy the castle's door");
    },
  };
  const actions = new Actions({
    pc,
    root,
    stage,
    inspector,
    canInspect: () => true,
    door,
  });
  const children = [...castle.children];
  assert.equal(door.onOpen(), true);
  const residential = new CastleResidentialLayout(plan);
  let sawInspector = false;
  let sawClose = false;
  let testedObstruction = false;
  for (let tick = 0; tick < 500; tick++) {
    actions.update(0.1, PHASE.DORMANT);
    if (!testedObstruction && actions.state.inspectionPhase === INSPECTION.CLOSE && door.sequenceOpenAmount < 0.01) {
      door.openAmount = 0.5;
      for (let blockedFrame = 0; blockedFrame < 30; blockedFrame++) {
        actions.update(0.1, PHASE.DORMANT);
        assert.equal(actions.state.inspectionPhase, INSPECTION.CLOSE, "the servant waits for a blocked door to close");
      }
      testedObstruction = true;
    }
    // Simulate the castle's independent collision-aware door update.
    door.openAmount = door.sequenceOpenAmount ?? 0;
    if (actions.state.inspectorVisible && [INSPECTION.WALK_OUT, INSPECTION.LOOK_LEFT, INSPECTION.LOOK_RIGHT].includes(actions.state.inspectionPhase)) {
      sawInspector = true;
      const point = inspector.entity.getPosition();
      assert.ok(Math.abs(point.y - layout.y) < 0.00001, "the servant walks on the terrace floor");
      const local = residential.toLocal(point.x, point.z);
      assert.ok(plan.layout.roomPlan.spaces.some((area) => area.kind === "terrace" && local.x >= area.minX &&
        local.x <= area.maxX && local.z >= area.minZ && local.z <= area.maxZ));
    }
    sawClose ||= actions.state.inspectionPhase === INSPECTION.CLOSE;
  }
  assert.ok(sawInspector && sawClose && testedObstruction);
  assert.equal(actions.state.inspectionPhase, INSPECTION.IDLE);
  assert.equal(door.openAmount, 0);
  actions.destroy();
  assert.equal(door.onOpen, null);
  assert.equal(door.sequenceOpenAmount, null);
  assert.deepEqual(castle.children, children);
});

it("walks the existing servant from home, inspects, and returns without visibility swaps", async () => {
  const { CastleResidentMotion } = await import("../../../../../../../src/game/objects/castle/residents/CastleResidentMotion.js");
  const scene = new pc.Entity(); scene._enabledInHierarchy = true;
  const root = new pc.Entity(); root.setPosition(5, 0, 5); scene.addChild(root);
  const stage = new pc.Entity(); stage.setLocalScale(0.45, 0.45, 0.45); root.addChild(stage);
  const inspector = {
    entity: new pc.Entity("Existing servant"),
    height: 1.8,
    pose: () => {},
    evaluatePose: () => {},
  };
  scene.addChild(inspector.entity);
  const original = inspector.entity;
  inspector.rightHand = new pc.Entity("Palm");
  inspector.rightHand.setLocalPosition(0, 0.8, 0.35);
  original.addChild(inspector.rightHand);
  const layout = {
    origin: { y: 0 },
    walkableAreas: [{
      minX: 0,
      maxX: 10,
      minZ: 0,
      maxZ: 10,
      floorY: 0,
    }],
    authoredStairs: [],
    stairs: null,
    toLocal: (x, z) => ({
      x,
      z,
    }),
    toWorld: (x, z, y) => ({
      x,
      y,
      z,
    }),
  };
  const motion = new CastleResidentMotion({
    actor: inspector,
    layout,
    blocked: () => false,
    clear: (point) => {
      if (!point) {
        door.operator = null;
      }

      return true;
    },
  });
  const door = {
    entity: new pc.Entity(),
    openAmount: 1,
    sequenceOpenAmount: null,
    onOpen: null,
  };
  scene.addChild(door.entity);
  door.insideHandle = new pc.Entity("Ring handle");
  door.insideHandle.setPosition(5, 0.8, 5);
  scene.addChild(door.insideHandle);
  const actions = new Actions({
    pc,
    root,
    stage,
    inspector,
    motion,
    canInspect: () => true,
    door,
  });
  assert.equal(inspector.entity, original);
  assert.equal(original.enabled, true);
  door.onOpen();
  actions.update(30, PHASE.DORMANT);
  assert.ok(original.getPosition().length() < 0.00001);
  for (let frame = 0; frame < 500; frame++) {
    const before = original.getPosition().clone();
    motion.update(0.1);
    actions.update(0.1, PHASE.DORMANT);
    if ([INSPECTION.GRASP, INSPECTION.CLOSE].includes(actions.state.inspectionPhase)) {
      assert.equal(door.operator, original, "the handle operator survives navigation cancellation");
    }
    if (door.sequenceOpenAmount !== null) {
      door.openAmount = door.sequenceOpenAmount;
    }
    assert.equal(original.enabled, true);
    assert.ok(original.getPosition().distance(before) <= 0.120001);
  }
  assert.equal(actions.inspecting, false);
  assert.ok(original.getPosition().length() < 0.00001);
  actions.destroy();
  assert.equal(original.enabled, true);
  assert.equal(original.parent, scene);
});

it("notices an already-open door after the servant becomes available and waits for traffic", () => {
  const root = new pc.Entity();
  const stage = new pc.Entity();root.addChild(stage);
  const inspector = {
    entity: new pc.Entity(),
    height: 1.8,
    pose: () => {},
    evaluatePose: () => {},
  };
  root.addChild(inspector.entity);
  const door = {
    entity: new pc.Entity(),
    openAmount: 1,
    sequenceOpenAmount: null,
    onOpen: null,
  };
  let available = false;
  const actions = new Actions({
    pc,
    root,
    stage,
    inspector,
    door,
    canInspect: () => available,
  });
  actions.update(40, PHASE.DORMANT);
  assert.equal(actions.state.inspectionPhase, INSPECTION.IDLE);
  available = true;
  actions.update(40, PHASE.SERVANT_ENTER);
  assert.equal(actions.state.inspectionPhase, INSPECTION.WAIT);
  actions.update(0.1, PHASE.DORMANT);
  assert.equal(actions.state.inspectionPhase, INSPECTION.NOTICE);
  let closing = false;
  for (let i=0;i<200;i++) {
    actions.update(0.1, PHASE.DORMANT);
    closing ||= actions.state.inspectionPhase === INSPECTION.CLOSE;
    if (door.sequenceOpenAmount !== null) {
      door.openAmount = door.sequenceOpenAmount;
    }
  }
  assert.ok(closing);
  assert.equal(door.openAmount, 0);
  assert.equal(actions.state.inspectionPhase, INSPECTION.IDLE);
  actions.destroy();root.destroy();
});
