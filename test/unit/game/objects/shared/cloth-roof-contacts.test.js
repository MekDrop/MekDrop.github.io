import assert from "node:assert/strict";
import { it } from "node:test";
import { AmmoClothPhysics } from "../../../../../src/game/objects/shared/AmmoClothPhysics.js";
import { ClothRoofContacts } from "../../../../../src/game/objects/shared/ClothRoofContacts.js";

it("preserves pinned nodes, outward velocity and slope-tangent motion", () => {
  const physics = new AmmoClothPhysics();
  try {
    const cloth = physics.createCloth({
      positions: new Float32Array([0.5, 0, 0, -0.5, 0, 0, 0, 0, 0.5]),
      indices: [0, 1, 2],
      pinnedIndices: [1],
    });
    const nodes = cloth.body.get_m_nodes();
    nodes.at(0).get_m_v().setValue(-1, -2, 3);
    nodes.at(1).get_m_v().setValue(0, -2, 0);
    nodes.at(2).get_m_v().setValue(3, 1, 1);
    const solver = new ClothRoofContacts({
      baseY: 0,
      height: 1,
      halfWidth: 1,
      halfDepth: 1,
    }, [], cloth.pinnedIndices);
    solver.solve(nodes);
    assert.ok(Math.abs(nodes.at(0).get_m_x().y() - 0.565) < 1e-6);
    assert.equal(nodes.at(1).get_m_x().y(), 0);
    assert.equal(nodes.at(1).get_m_v().y(), -2);
    assert.ok(Math.abs(nodes.at(0).get_m_v().x() - 0.5) < 1e-6);
    assert.ok(Math.abs(nodes.at(0).get_m_v().y() + 0.5) < 1e-6);
    assert.equal(nodes.at(0).get_m_v().z(), 3);
    assert.equal(nodes.at(2).get_m_v().x(), 3);
    assert.equal(nodes.at(2).get_m_v().y(), 1);
    assert.equal(nodes.at(2).get_m_v().z(), 1);
  } finally {
    physics.destroy();
  }
});

it("ignores missing and degenerate colliders", () => {
  // A no-op solve must not even access the borrowed Ammo nodes.
  new ClothRoofContacts(null, [], new Set()).solve(null);
  new ClothRoofContacts({
    baseY: 0,
    height: 1,
    halfWidth: 0,
    halfDepth: 1,
  }, [], new Set()).solve(null);
});
