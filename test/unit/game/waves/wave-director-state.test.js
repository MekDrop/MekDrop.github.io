import assert from "node:assert/strict";
import { test } from "node:test";
import { WaveDirectorState } from "../../../../src/game/waves/WaveDirectorState.js";
import { WaveAiController } from "../../../../src/game/waves/WaveAiController.js";
import { PlayerWaveController } from "../../../../src/game/waves/PlayerWaveController.js";

const buy = (sequence, gateId = "west") => ({
  sequence,
  type: "buy",
  creature: "LatchSlug",
  gateId,
});
function fixture(config = {}) {
  const state = new WaveDirectorState(config);
  state.gates = ["west", "east"];

  return state;
}

test("5000-coin authority charges 15 once, rejects invalid commands and isolates snapshots", () => {
  const state = fixture();
  assert.equal(state.snapshot.coins, 5000);
  assert.equal(state.submit(buy(1), "stranger").accepted, false);
  assert.equal(state.submit({
    ...buy(1),
    cost: 0,
    reward: 100000,
  }, "ai").accepted, true);
  assert.equal(state.snapshot.coins, 4985);
  assert.equal(state.submit(buy(1), "ai").reason, "stale-command");
  assert.equal(state.submit({
    ...buy(2),
    creature: "OtherEnemy",
  }, "ai").accepted, false);
  assert.equal(state.submit(buy(2, "missing"), "ai").accepted, false);
  assert.equal(state.submit({
    ...buy(2),
    type: "reward",
  }, "ai").accepted, false);
  const copy = state.snapshot;
  copy.offers[0].cost = 0;
  copy.queue.length = 0;
  assert.equal(state.snapshot.offers[0].cost, 15);
  assert.equal(state.snapshot.queue.length, 1);
});

test("preparation is serial per gate, occupied gates wait and dispatch is bounded per frame", () => {
  const state = fixture();
  state.submit(buy(1), "ai");
  state.submit(buy(2), "ai");
  state.submit(buy(3, "east"), "ai");
  let spawned = 0;
  state.advance(2.99, () => {
    spawned++;

    return "early";
  });
  assert.equal(spawned, 0);
  state.advance(.01, () => null);
  assert.equal(state.snapshot.queue.length, 3);
  state.advance(.01, order => {
    spawned++;

    return order.orderId;
  });
  assert.equal(spawned, 1);
  state.advance(.01, order => {
    spawned++;

    return order.orderId;
  });
  assert.equal(spawned, 2);
  state.advance(2.98, order => {
    spawned++;

    return order.orderId;
  });
  assert.equal(spawned, 3);
  assert.equal(state.snapshot.coins, 4955);
});

test("removed gates and spawn failures refund once; balance, queues and active caps hold", () => {
  const state = fixture({
    initialCoins:30,
    maxQueued:2,
    maxActive:1,
  });
  state.submit(buy(1), "ai");
  state.submit(buy(2, "east"), "ai");
  assert.equal(state.submit(buy(3), "ai").accepted, false);
  state.gates = ["east"];
  state.advance(3, () => false);
  assert.equal(state.snapshot.coins, 30);
  assert.equal(state.snapshot.spent, 0);
  state.advance(30, () => false);
  assert.equal(state.snapshot.coins, 30);
  state.submit(buy(3, "east"), "ai");
  state.advance(3, () => "unit-1");
  state.submit(buy(4, "east"), "ai");
  state.advance(3, () => assert.fail("active cap"));
  state.retire("unit-1");
  state.advance(.01, () => "unit-2");
  assert.equal(state.snapshot.active, 1);
  assert.equal(state.snapshot.coins, 0);
  assert.equal(state.submit(buy(5, "east"), "ai").reason, "insufficient-coins");
});

test("only dispatched ownership earns kills/breaks; a victim pays once across duplicate reports", () => {
  const state = fixture();
  assert.equal(state.reward("intruder", "victim", "kill"), 0);
  state.submit(buy(1), "ai");
  state.advance(3, () => "slug-1");
  assert.equal(state.reward("slug-1", "victim", "kill"), 50);
  assert.equal(state.reward("slug-1", "victim", "kill"), 0);
  assert.equal(state.reward("slug-1", "victim", "break"), 0);
  assert.equal(state.reward("slug-1", "door", "break"), 10);
  assert.equal(state.snapshot.coins, 5045);
  assert.equal(state.snapshot.earned, 60);
});

test("AI and queued player controllers use the same purchase authority during handoff", () => {
  const state = fixture();
  const ai = new WaveAiController({firstWaveDelay:0});
  const commands = ai.commands(state.snapshot);
  assert.equal(commands.length, 3);
  assert.equal(new Set(commands.map(c=>c.gateId)).size, 2);
  for (const command of commands) {
    assert.equal(state.submit(command, "ai").accepted, true);
  }
  state.controllerId = "player-1";
  assert.equal(state.submit(buy(4), "ai").accepted, false);
  const player = new PlayerWaveController();
  player.enqueue(buy(1));
  assert.equal(state.submit(player.commands()[0], "player-1").accepted, true);
  assert.deepEqual(player.commands(), []);
  assert.equal(state.snapshot.coins, 4940);
  assert.equal(state.snapshot.queue.length, 4);
  state.controllerId = "ai";
  assert.equal(state.snapshot.nextSequence, 4);
});
