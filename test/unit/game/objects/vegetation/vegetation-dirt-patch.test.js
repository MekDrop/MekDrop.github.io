import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVegetationDirtPatchGeometry } from "../../../../../src/game/objects/vegetation/VegetationDirtPatchGeometry.js";
import { VegetationDirtPatchLayout } from "../../../../../src/game/objects/vegetation/VegetationDirtPatchLayout.js";

describe("vegetation dirt patch", () => {
  it("merges the former vegetation footprint into one irregular grass mask", () => {
    const geometry = buildVegetationDirtPatchGeometry(
      [
        { x: -0.25, z: 0, width: 0.25, depth: 0.25 },
        { x: 0, z: 0, width: 0.25, depth: 0.25 },
        { x: 0.25, z: 0, width: 0.25, depth: 0.25 },
        { x: 0, z: 0.25, width: 0.25, depth: 0.25 },
      ],
      "wide-bush",
    );
    const patch = new VegetationDirtPatchLayout({
      outline: geometry.outline,
      x: 2,
      y: 3,
      z: 4,
      rotation: 90,
    });

    assert.ok(geometry.outline.length >= 8);
    assert.equal(geometry.indices.length, (geometry.outline.length - 2) * 3);
    assert.ok(
      geometry.outline.every(
        ({ x, z }) => Math.abs(x) <= 0.44 && Math.abs(z) <= 0.44,
      ),
    );
    assert.equal(patch.grassWeightAt(2, 4, 3.002), 1);
    assert.equal(patch.grassWeightAt(2, 4.35, 3.002), 1);
    assert.equal(patch.grassWeightAt(2.35, 4, 3.002), 1);
    assert.equal(patch.grassWeightAt(2.3, 3.7, 3.002), 0);
    assert.equal(patch.grassWeightAt(2.55, 4.55, 3.002), 0);
    assert.equal(patch.grassWeightAt(2, 4, 3.2), 0);
  });

  it("clips an overhanging bush footprint to its owning terrain tile", () => {
    const geometry = buildVegetationDirtPatchGeometry(
      [
        { x: -0.5, z: 0, width: 0.25, depth: 0.25 },
        { x: -0.25, z: 0, width: 0.25, depth: 0.25 },
        { x: 0, z: 0, width: 0.25, depth: 0.25 },
        { x: 0.25, z: 0, width: 0.25, depth: 0.25 },
        { x: 0.5, z: 0, width: 0.25, depth: 0.25 },
      ],
      "edge-bush",
    );

    assert.ok(geometry.outline.length > 4);
    assert.ok(
      geometry.outline.every(
        ({ x, z }) => Math.abs(x) <= 0.44 && Math.abs(z) <= 0.44,
      ),
    );
    assert.equal(geometry.colors.length, geometry.outline.length * 4);
  });
});
