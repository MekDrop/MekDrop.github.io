import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { BridgeGelReaction } from "../../../../../src/game/objects/path/BridgeGelReaction.js";

const bridge = {
  span: {
    start: 3,
    end: 7,
    horizontal: true,
  },
  stationPosition: (station) => new Vec3(station - 3, 2, 0),
};

it("compresses under actual supported feet and shares the load across station seams", () => {
  const reaction = new BridgeGelReaction();
  const loads = reaction.update(0.016, {
    position: new Vec3(1.5, 2, 0.4),
    grounded: true,
  }, bridge);
  assert.ok(loads.get(4).compression > 0);
  assert.ok(loads.get(5).compression > 0);
  assert.equal(loads.get(4).along, 1);
  assert.equal(loads.get(5).along, -1);
  assert.equal(loads.get(4).across, 0.4);
  assert.equal(loads.has(7), false);
});

it("ignores airborne, below-deck, off-span and bank walkers", () => {
  for (const [position, grounded] of [
    [new Vec3(2, 2, 0), false],
    [new Vec3(2, 0, 0), true],
    [new Vec3(2, 2, 1.1), true],
    [new Vec3(-0.6, 2, 0), true],
  ]) {
    assert.equal(new BridgeGelReaction().update(0.016, {
      position,
      grounded,
    }, bridge).size, 0);
  }
});

it("holds a static load without inventing idle footsteps and settles after departure", () => {
  const reaction = new BridgeGelReaction();
  const walker = {
    position: new Vec3(2, 2, 0),
    grounded: true,
  };
  assert.ok(reaction.update(0, walker, bridge).get(5).bounce < 0);
  const still = reaction.update(1, walker, bridge).get(5);
  assert.equal(still.bounce, 0);
  assert.equal(still.compression, 0.7);
  walker.position.x += 0.4;
  const step = reaction.update(0.1, walker, bridge);
  assert.ok(step.get(5).bounce < 0);
  reaction.update(0.9, walker, bridge);
  assert.ok(reaction.update(0.016, null, bridge).get(5).bounce > 0);
  assert.equal(reaction.update(1, null, bridge).size, 0);
});

it("uses the current elevated surface and handles vertical spans", () => {
  const reaction = new BridgeGelReaction();
  const vertical = {
    span: {
      ...bridge.span,
      horizontal: false,
    },
    stationPosition: (station) => new Vec3(2, 5 + (station - 3) * 0.2, station - 3),
  };
  const loads = reaction.update(0, {
    position: new Vec3(2.3, 5.4, 2),
    grounded: true,
  }, vertical);
  assert.ok(loads.get(5).compression > 0);
  assert.ok(Math.abs(loads.get(5).across - 0.3) < 0.000001);
});
