import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleLeisureSequence } from "../../src/game/objects/castle/CastleLeisureSequence.js";
import { CASTLE_LEISURE_PHASE as PHASE } from "../../src/game/enum/CastleLeisurePhase.js";

function finishPhase(sequence, expectedNext) {
  sequence.update(sequence.duration - sequence.elapsed);
  assert.equal(sequence.phase, expectedNext);
}

function furnishCargo(sequence, cargo) {
  assert.equal(sequence.phase, PHASE.SERVANT_ENTER);
  assert.equal(sequence.cargo, cargo);
  const installedBefore = sequence.installedCount;
  finishPhase(sequence, PHASE.FURNISH);
  if (cargo === "tea") {
    finishPhase(sequence, PHASE.POUR);
  }
  finishPhase(sequence, PHASE.SERVANT_EXIT);
  assert.equal(sequence.installedCount, installedBefore + 1);
}

function prepareVisit(sequence, kind) {
  sequence.present = true;
  const deliveries =
    kind === "princess" ? ["table", "chair", "tea"] : ["sunbed"];
  if (kind !== "king") {
    for (const [index, cargo] of deliveries.entries()) {
      furnishCargo(sequence, cargo);
      finishPhase(
        sequence,
        index === deliveries.length - 1 ? PHASE.ROYAL_ENTER : PHASE.SERVANT_ENTER,
      );
    }
  }
  assert.equal(sequence.phase, PHASE.ROYAL_ENTER);
}

function finishCleanup(sequence, cargos, expectedNext = PHASE.DORMANT) {
  assert.equal(sequence.phase, PHASE.CLEANUP_DELAY);
  finishPhase(sequence, PHASE.SERVANT_RETURN);
  for (const [index, cargo] of cargos.entries()) {
    assert.equal(sequence.cargo, cargo);
    finishPhase(sequence, PHASE.PACK);
    finishPhase(sequence, PHASE.SERVANT_LEAVE);
    assert.equal(sequence.installedCount, cargos.length - index - 1);
    finishPhase(
      sequence,
      index === cargos.length - 1 ? expectedNext : PHASE.SERVANT_RETURN,
    );
  }
}

for (const kind of ["princess", "queen", "king"]) {
  it(`${kind} prepares the appropriate activity and exits before cleanup`, () => {
    const sequence = new CastleLeisureSequence(kind);
    prepareVisit(sequence, kind);
    finishPhase(sequence, PHASE.SETTLE);
    finishPhase(sequence, PHASE.LEISURE);
    sequence.update(120);
    sequence.present = true;
    assert.equal(sequence.phase, PHASE.LEISURE);
    sequence.present = false;
    assert.equal(sequence.phase, PHASE.RISE);
    finishPhase(sequence, PHASE.ROYAL_EXIT);
    if (kind === "king") {
      finishPhase(sequence, PHASE.DORMANT);
    } else {
      finishPhase(sequence, PHASE.CLEANUP_DELAY);
      sequence.update(2);
      assert.equal(sequence.phase, PHASE.CLEANUP_DELAY);
      finishCleanup(
        sequence,
        kind === "princess" ? ["tea", "chair", "table"] : ["sunbed"],
      );
    }
    assert.equal(sequence.active, false);
  });

  it(`${kind} turns back after entry when the hero leaves before arrival`, () => {
    const sequence = new CastleLeisureSequence(kind);
    prepareVisit(sequence, kind);
    assert.equal(sequence.phase, PHASE.ROYAL_ENTER);
    sequence.update(0.5);
    sequence.present = false;
    finishPhase(sequence, PHASE.ROYAL_EXIT);
    sequence.update(100);
    assert.equal(sequence.phase, PHASE.DORMANT);
    assert.equal(sequence.active, false);
  });

  it(`${kind} stays dormant without a visitor and resets an active visit`, () => {
    const sequence = new CastleLeisureSequence(kind);
    sequence.present = false;
    sequence.update(10000);
    assert.equal(sequence.phase, PHASE.DORMANT);
    assert.equal(sequence.elapsed, 0);
    assert.equal(sequence.active, false);
    sequence.present = true;
    sequence.update(100);
    assert.equal(sequence.phase, PHASE.LEISURE);
    sequence.reset();
    assert.equal(sequence.phase, PHASE.DORMANT);
    assert.equal(sequence.elapsed, 0);
    assert.equal(sequence.progress, 0);
    assert.equal(sequence.installedCount, 0);
    sequence.update(10000);
    assert.equal(sequence.active, false);
    sequence.present = true;
    assert.equal(sequence.active, true);
  });
}

for (const kind of ["princess", "queen"]) {
  it(`${kind} skips the royal after an early departure and still clears furniture`, () => {
    const sequence = new CastleLeisureSequence(kind);
    sequence.present = true;
    sequence.update(4);
    assert.equal(sequence.phase, PHASE.FURNISH);
    sequence.present = false;
    finishPhase(sequence, PHASE.SERVANT_EXIT);
    finishPhase(sequence, PHASE.CLEANUP_DELAY);
    finishCleanup(sequence, [kind === "princess" ? "table" : "sunbed"]);
  });

  it(`${kind} completes packing before restarting for a returning visitor`, () => {
    const sequence = new CastleLeisureSequence(kind);
    sequence.present = true;
    sequence.update(100);
    sequence.present = false;
    finishPhase(sequence, PHASE.ROYAL_EXIT);
    finishPhase(sequence, PHASE.CLEANUP_DELAY);
    finishPhase(sequence, PHASE.SERVANT_RETURN);
    finishPhase(sequence, PHASE.PACK);
    sequence.update(0.5);
    assert.equal(sequence.phase, PHASE.PACK);
    sequence.present = true;
    assert.equal(sequence.phase, PHASE.PACK);
    finishPhase(sequence, PHASE.SERVANT_LEAVE);
    if (kind === "princess") {
      for (const cargo of ["chair", "table"]) {
        finishPhase(sequence, PHASE.SERVANT_RETURN);
        assert.equal(sequence.cargo, cargo);
        finishPhase(sequence, PHASE.PACK);
        finishPhase(sequence, PHASE.SERVANT_LEAVE);
      }
    }
    finishPhase(sequence, PHASE.SERVANT_ENTER);
    assert.equal(sequence.installedCount, 0);
    sequence.update(100);
    assert.equal(sequence.phase, PHASE.LEISURE);
  });
}

it("carries time across several phases and matches small frame updates", () => {
  const coarse = new CastleLeisureSequence("princess");
  const fine = new CastleLeisureSequence("princess");
  coarse.present = true;
  fine.present = true;
  coarse.update(6);
  for (let frame = 0; frame < 60; frame += 1) {
    fine.update(0.1);
  }
  assert.equal(coarse.phase, PHASE.SERVANT_EXIT);
  assert.equal(fine.phase, coarse.phase);
  assert.ok(Math.abs(coarse.elapsed - 0.8) < 1e-10);
  assert.ok(Math.abs(fine.elapsed - coarse.elapsed) < 1e-10);
  assert.ok(Math.abs(coarse.progress - 0.25) < 1e-10);
});

for (const delivered of [1, 2]) {
  it(`cleans exactly ${delivered + 1} princess deliveries after departure mid-preparation`, () => {
    const sequence = new CastleLeisureSequence("princess");
    sequence.present = true;
    for (const cargo of ["table", "chair"].slice(0, delivered)) {
      furnishCargo(sequence, cargo);
      finishPhase(sequence, PHASE.SERVANT_ENTER);
    }
    const finalCargo = delivered === 1 ? "chair" : "tea";
    assert.equal(sequence.cargo, finalCargo);
    sequence.update(0.5);
    sequence.present = false;
    furnishCargo(sequence, finalCargo);
    finishPhase(sequence, PHASE.CLEANUP_DELAY);
    finishCleanup(
      sequence,
      delivered === 1 ? ["chair", "table"] : ["tea", "chair", "table"],
    );
    assert.equal(sequence.installedCount, 0);
  });
}

it("king finishes returning inside before another visit and never uses a servant", () => {
  const sequence = new CastleLeisureSequence("king");
  prepareVisit(sequence, "king");
  finishPhase(sequence, PHASE.SETTLE);
  sequence.present = false;
  finishPhase(sequence, PHASE.RISE);
  finishPhase(sequence, PHASE.ROYAL_EXIT);
  sequence.update(0.5);
  sequence.present = true;
  assert.equal(sequence.phase, PHASE.ROYAL_EXIT);
  finishPhase(sequence, PHASE.ROYAL_ENTER);
  assert.equal(sequence.installedCount, 0);
});

it("ignores invalid frame durations and terminates very large updates", () => {
  const sequence = new CastleLeisureSequence("princess");
  sequence.present = true;
  sequence.update(0.5);
  for (const deltaTime of [0, -1, NaN, Infinity, -Infinity]) {
    sequence.update(deltaTime);
    assert.equal(sequence.phase, PHASE.SERVANT_ENTER);
    assert.equal(sequence.elapsed, 0.5);
  }
  sequence.update(Number.MAX_VALUE);
  assert.equal(sequence.phase, PHASE.LEISURE);
  assert.equal(sequence.active, true);
  sequence.present = false;
  sequence.update(Number.MAX_VALUE);
  assert.equal(sequence.phase, PHASE.DORMANT);
  assert.equal(sequence.active, false);
});

it("princess walks fastest and king slowest on both arrival and departure", () => {
  const durations = {};
  for (const kind of ["king", "queen", "princess"]) {
    const sequence = new CastleLeisureSequence(kind);
    prepareVisit(sequence, kind);
    const arrival = sequence.duration;
    durations[kind] = arrival;
    finishPhase(sequence, PHASE.SETTLE);
    finishPhase(sequence, PHASE.LEISURE);
    sequence.present = false;
    finishPhase(sequence, PHASE.ROYAL_EXIT);
    assert.equal(sequence.duration, arrival, "return uses the same pace");
    // Movement and gait use this rate, with identical 0.7s door/arrival pauses.
    assert.ok(Math.abs((arrival - 0.7) * sequence.walkSpeed - 2.5) < 1e-9);
  }
  assert.ok(durations.princess < durations.queen);
  assert.ok(durations.queen < durations.king);
});

it("servant delivery pace is independent of the royal's walking speed", () => {
  for (const kind of ["queen", "princess"]) {
    const sequence = new CastleLeisureSequence(kind);
    sequence.present = true;
    assert.equal(sequence.duration, 3.2);
    assert.equal(sequence.walkSpeed, 1);
  }
});

for (const kind of ["princess", "queen"]) {
  it(`${kind} keeps one servant choice through delivery and cleanup, then starts a new visit`, () => {
    const sequence = new CastleLeisureSequence(kind);
    assert.equal(sequence.visitId, 0);
    sequence.present = true;
    assert.equal(sequence.visitId, 1);
    while (sequence.phase !== PHASE.LEISURE) {
      sequence.update(sequence.duration);
      assert.equal(sequence.visitId, 1);
    }
    sequence.present = false;
    sequence.update(sequence.duration);
    // A returning hero waits for the previous servant's cleanup to finish.
    sequence.present = true;
    while (sequence.phase !== PHASE.SERVANT_LEAVE || sequence.installedCount > 0) {
      sequence.update(sequence.duration);
      assert.equal(sequence.visitId, 1);
    }
    sequence.update(sequence.duration);
    assert.equal(sequence.phase, PHASE.SERVANT_ENTER);
    assert.equal(sequence.visitId, 2);
  });
}
