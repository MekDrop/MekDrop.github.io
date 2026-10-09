import assert from "node:assert/strict";
import { it } from "node:test";
import { HERO_ACTION } from "../../../../../src/game/enum/HeroAction.js";
import { HeroDrowningActionState } from "../../../../../src/game/objects/hero/states/action/HeroDrowningActionState.js";

it("lets the current take a submerged hero even when the riverbed reports support", () => {
  const state = new HeroDrowningActionState();
  const transitions = [];
  const situation = {
    grounded: true, fallingToDeath: false, respawning: false,
    verticalVelocity: 0, position: { x: 0, y: 0.1, z: 0 },
  };
  const routeEntry = { river: { kind: "WATER" }, cell: { elevation: 0.5, underBridge: false } };
  const owner = {
    feedback: {
      drowning: {
        situation: () => situation,
        hasRiverSourceCover: () => false,
        routeEntryAt: () => routeEntry,
        waterEntryClearance: 0.32,
      },
    },
    transition: (action) => transitions.push(action),
  };
  assert.equal(state.tryEnter(owner), true);
  assert.deepEqual(transitions, [HERO_ACTION.DROWNING]);
  situation.position.y = 0.6;
  assert.equal(state.tryEnter(owner), false, "supported feet above water remain safe");
  situation.position.y = 0.1;
  owner.feedback.drowning.hasRiverSourceCover = () => true;
  assert.equal(state.tryEnter(owner), false, "source covers still provide safe footing");
});

/**
 * @param {Array<{col: number, row: number, direction: string, elevation: number, terrainHeight?: number, underBridge?: boolean}>} cells
 * @param {{x: number, y: number, z: number}} position
 * @param {number} deltaTime
 */
function createRiver(cells, position, deltaTime = 0.1) {
  const state = new HeroDrowningActionState();
  state.payload = { elapsed: 0, river: { cells }, targetIndex: 1, exiting: false };
  const transitions = [];
  let velocity;
  const owner = {
    deltaTime,
    transition: (action, cell) => transitions.push({ action, cell }),
    feedback: {
      drowning: {
        position: () => position,
        directionVector: (direction) => direction === "EAST"
          ? { x: 1, z: 0 } : { x: 0, z: 1 },
        mapColumns: 1,
        mapRows: 1,
        bridgeApproachOffset: 0.94,
        waypointEpsilon: 0.035,
        canClimbBridge: (cell) => cell.terrainHeight - cell.elevation <= 1,
        routeEntryAt: () => ({ cell: cells[0] }),
        submergeDepth: 0.68,
        sinkSpeed: 2.8,
        currentSpeed: 1.45,
        setVelocity: (next) => { velocity = next; },
      },
    },
  };
  return { state, owner, transitions, velocity: () => velocity };
}

it("reaches river waypoints without oscillating on slow frames", () => {
  const cells = [
    { col: 0, row: 0, direction: "EAST", elevation: 0 },
    { col: 1, row: 0, direction: "SOUTH", elevation: 0 },
    { col: 1, row: 1, direction: "SOUTH", elevation: 0 },
  ];
  const position = { x: 0.94, y: -0.68, z: 0 };
  const river = createRiver(cells, position);
  river.state.execute(river.owner);
  position.x += river.velocity().x * river.owner.deltaTime;
  assert.equal(position.x, 1);
  river.state.execute(river.owner);
  assert.equal(river.state.payload.targetIndex, 2);
});

it("approaches a turning bridge from upstream instead of the bank", () => {
  const cells = [
    { col: 0, row: 0, direction: "EAST", elevation: 0 },
    { col: 1, row: 0, direction: "SOUTH", elevation: 0, terrainHeight: 1, underBridge: true },
  ];
  const river = createRiver(cells, { x: 0.06, y: -0.68, z: 0 });
  river.state.execute(river.owner);
  assert.equal(river.transitions.length, 1);
  assert.equal(river.transitions[0].action, HERO_ACTION.BRIDGE_CLIMB);
  assert.equal(river.transitions[0].cell.direction, "EAST");
});

it("passes below a tall bridge without attempting to climb", () => {
  const cells = [
    { col: 0, row: 0, direction: "EAST", elevation: 0 },
    { col: 1, row: 0, direction: "SOUTH", elevation: 0, terrainHeight: 2, underBridge: true },
    { col: 1, row: 1, direction: "SOUTH", elevation: 0 },
  ];
  const river = createRiver(cells, { x: 1, y: -0.68, z: 0 });
  river.state.execute(river.owner);
  assert.deepEqual(river.transitions, []);
  assert.equal(river.state.payload.targetIndex, 2);
});
