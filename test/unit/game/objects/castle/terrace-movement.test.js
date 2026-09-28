import assert from "node:assert/strict";
import { it } from "node:test";
import {
  syncTerraceWalk,
  terracePathYaw,
} from "../../../../../src/game/objects/castle/TerraceMovement.js";

const TARGET = [-0.75, 0, 3.2];

function createActor() {
  const calls = {
    position: null,
    rotation: null,
    pose: null,
  };
  return {
    calls,
    actor: {
      entity: {
        enabled: true,
        setLocalPosition(...position) {
          calls.position = position;
        },
        setLocalEulerAngles(...rotation) {
          calls.rotation = rotation;
        },
      },
      pose(...pose) {
        calls.pose = pose;
      },
    },
  };
}

function syncAt({ elapsed, leaving = false, action = "walk" }) {
  const { actor, calls } = createActor();
  syncTerraceWalk({
    actor,
    target: TARGET,
    leaving,
    action,
    behavior: { duration: 3.2, elapsed, walkSpeed: 1.25 },
  });
  return { actor, calls };
}

it("preserves the authored doorway delay, stair timing, and visibility", () => {
  const start = syncAt({ elapsed: 0 });

  assert.ok(Math.abs(start.calls.position[0]) < 0.0000001);
  assert.deepEqual(start.calls.position.slice(1), [-1.05, -1.4]);
  assert.deepEqual(start.calls.rotation, [0, 0, 0]);
  assert.equal(start.actor.entity.enabled, false);
  assert.deepEqual(start.calls.pose, ["idle", 0]);

  const stairs = syncAt({ elapsed: 0.9 });
  assert.ok(stairs.calls.position[1] > -1.05);
  assert.ok(stairs.calls.position[1] < 0);
  assert.equal(stairs.actor.entity.enabled, false);

  const visible = syncAt({ elapsed: 1.3 });
  assert.ok(Math.abs(visible.calls.position[1]) < 0.0000001);
  assert.equal(visible.actor.entity.enabled, true);
  assert.deepEqual(visible.calls.pose, ["walk", 1.125]);
});

it("uses Yuka path steering without changing lateral easing or turn timing", () => {
  const beforeTurn = syncAt({ elapsed: 1.7 });
  const afterTurn = syncAt({ elapsed: 2.2 });
  const expectedYaw = Math.atan2(TARGET[0], TARGET[2] - 1.1) * 180 / Math.PI;

  assert.ok(Math.abs(beforeTurn.calls.position[0]) < 0.0000001);
  assert.equal(beforeTurn.calls.rotation[1], 0);
  assert.ok(afterTurn.calls.position[0] < 0);
  assert.ok(afterTurn.calls.position[0] > TARGET[0]);
  assert.ok(Math.abs(afterTurn.calls.rotation[1] - expectedYaw) < 0.0000001);
});

it("reverses Yuka steering along the queen's authored route segments", () => {
  const segment = [
    { x: 0, z: 1.2 },
    { x: 0.9, z: 1.65 },
  ];

  assert.ok(Math.abs(terracePathYaw(segment) - 63.43494882292201) < 0.0000001);
  assert.ok(Math.abs(terracePathYaw(segment, true) + 116.56505117707799) < 0.0000001);
});

it("keeps leaving direction, carry animation, and walk phase semantics", () => {
  const leaving = syncAt({ elapsed: 1.1, leaving: true, action: "carry" });
  const expectedYaw = Math.atan2(TARGET[0], TARGET[2] - 1.1) * 180 / Math.PI;

  assert.ok(Math.abs(leaving.calls.rotation[1] - (expectedYaw + 180)) < 0.0000001);
  assert.equal(leaving.calls.pose[0], "carry");
  assert.ok(Math.abs(leaving.calls.pose[1] - 0.875) < 0.0000001);

  const finished = syncAt({ elapsed: 3.2 });
  for (let index = 0; index < TARGET.length; index += 1) {
    assert.ok(Math.abs(finished.calls.position[index] - TARGET[index]) < 0.0000001);
  }
  assert.deepEqual(finished.calls.pose, ["idle", 3.125]);
});
