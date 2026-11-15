import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { BridgeCounterweightPool } from "../../../../../src/game/objects/path/BridgeCounterweightPool.js";
import { SLIME_BRIDGE_GROWTH_SECONDS } from "../../../../../src/game/objects/path/BridgeSlimeTiming.js";

it("retains every temporary donor identity and hands off only actual admitted native mass", () => {
  const pool = new BridgeCounterweightPool();
  const bridge = {};
  const handoffs = [];
  const donor = {
    position: new Vec3(-1.95, 2, 0),
    beginBridgeMaterialValidation: (owner, station) => {
      handoffs.push([owner, station]);

      return true;
    },
  };
  const assignment = pool.reserve(donor, -1, -1, new Vec3(-1, 2, 0), true);
  assert.equal(assignment.counterweight, true);
  assert.equal(assignment.approach.x, donor.position.x);
  assert.equal(pool.count(-1), 1);
  assert.equal(pool.masses.size, 0, "reservations are never speculative physics mass");
  assert.equal(pool.begin(donor), true);
  pool.update(SLIME_BRIDGE_GROWTH_SECONDS / 2, bridge, () => 1);
  assert.equal(pool.masses.size, 0, "the original native actor still owns mass during outward morph");
  assert.equal(pool.transfers[0].id, donor);
  assert.ok(Math.abs(pool.morph(donor).progress - 0.5) < 1e-10);
  assert.equal(handoffs.length, 0);
  pool.update(SLIME_BRIDGE_GROWTH_SECONDS / 2, bridge, () => 1);
  assert.deepEqual(handoffs, [[bridge, -1]]);
  assert.equal(pool.status(donor), "complete");
  assert.equal(pool.masses.get(-1), 1);
  assert.equal(pool.assignment(donor).station, -1, "identity remains exclusively owned by this pool");
  assert.equal(pool.transfers.length, 0, "the native continuous skin now owns the full rendered unit");
});

it("returns excess gel to the same donors while preserving necessary pool units", () => {
  const pool = new BridgeCounterweightPool();
  const donors = Array.from({ length: 3 }, () => ({
    position: new Vec3(-1.95, 2, 0),
    beginBridgeMaterialValidation: () => true,
  }));
  for (const donor of donors) {
    pool.reserve(donor, -1, -1, new Vec3(-1, 2, 0), true);
    pool.begin(donor);
  }
  pool.update(SLIME_BRIDGE_GROWTH_SECONDS, {}, () => 3);
  assert.equal(pool.masses.get(-1), 3);
  assert.equal(pool.update(0, {}, () => 1), true);
  assert.equal(pool.masses.get(-1), 2, "only one native capsule reforms at each release handoff");
  assert.equal(pool.status(donors[0]), "complete");
  assert.equal(pool.status(donors[1]), "complete");
  assert.equal(pool.status(donors[2]), "failed");
  assert.deepEqual(pool.transfers.map((transfer) => transfer.id), donors.slice(2));
  assert.equal(pool.transfers[0].progress, 1);
  pool.update(0.35, {}, () => 1);
  assert.ok(Math.abs(pool.transfers[0].progress - 0.5) < 1e-10);
  pool.update(0.35, {}, () => 1);
  assert.equal(pool.masses.get(-1), 2, "the other mass remains physical until the first capsule has reformed");
  pool.update(0.21, {}, () => 1);
  assert.equal(pool.masses.get(-1), 1);
  assert.equal(pool.status(donors[1]), "failed", "the same surplus identity performs the next inverse morph");
  pool.update(0.9, {}, () => 0);
  assert.equal(pool.masses.size, 0, "attaching the far bank eventually releases every unnecessary native unit");
  assert.equal(pool.status(donors[0]), "failed");
  pool.release(donors[1]);
  assert.equal(pool.status(donors[1]), null);
});

it("never adds rejected native donor mass and drops a canceled reservation", () => {
  const pool = new BridgeCounterweightPool();
  const donor = {
    position: new Vec3(),
    beginBridgeMaterialValidation: () => false,
  };
  pool.reserve(donor, 1, 5, new Vec3(5, 2, 0), true);
  pool.begin(donor);
  pool.update(SLIME_BRIDGE_GROWTH_SECONDS, {}, () => 1);
  assert.equal(pool.status(donor), "failed");
  assert.equal(pool.masses.size, 0);
  assert.equal(pool.count(1), 0);
  assert.equal(pool.release(donor), false);
  assert.equal(pool.assignment(donor), null);
});

it("native surplus stays in the pool while the real reconstitution inlet is occupied", () => {
  const pool = new BridgeCounterweightPool();
  const donor = {
    position: new Vec3(),
    beginBridgeMaterialValidation: () => true,
  };
  pool.reserve(donor, -1, -1, new Vec3(-1, 2, 0), true);
  pool.begin(donor);
  pool.update(SLIME_BRIDGE_GROWTH_SECONDS, {}, () => 1);
  let clear = false;
  const canRelease = (owner, station) => {
    assert.equal(owner, donor);
    assert.equal(station, -1);

    return clear;
  };
  pool.update(10, {}, () => 0, canRelease);
  assert.equal(pool.masses.get(-1), 1, "a timer alone cannot create an overlapping native capsule");
  assert.equal(pool.status(donor), "complete");
  clear = true;
  pool.update(0, {}, () => 0, canRelease);
  assert.equal(pool.masses.size, 0);
  assert.equal(pool.status(donor), "failed", "the one original identity reforms only after actual clearance");
});
