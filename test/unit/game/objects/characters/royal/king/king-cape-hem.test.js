import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { findKingHemAttachment, findKingHemEdges, sampleKingHemAttachment } from "../../../../../../../src/game/objects/characters/royal/king/KingCapeHem.js";

it("selects only the lower boundary instead of interior cloth edges", () => {
  const triangles = [0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4];
  assert.deepEqual(findKingHemEdges(triangles, [0, 0, 0, 1, 1, 1]), [[0, 1], [1, 2]]);
});

it("keeps the trim attached to the material hem instead of jumping onto an interior fold", () => {
  const points = [
    new pc.Vec3(0, 0.4, -0.2), new pc.Vec3(1, 0.4, -0.2),
    new pc.Vec3(0, 0.05, -0.6), new pc.Vec3(1, 0.05, -0.6),
    new pc.Vec3(0, 1, -0.3), new pc.Vec3(1, 1, -0.3),
  ];
  const frames = points.map(() => ({
    tangent: new pc.Vec3(1, 0, 0),
    bitangent: new pc.Vec3(0, 1, 0),
    normal: new pc.Vec3(0, 0, 1),
  }));
  const sample = sampleKingHemAttachment({
    pc,
    points,
    frames,
    root: new pc.Vec3(),
    edge: {
      a: 0,
      b: 1,
      amount: 0.4,
      sign: 1,
      lift: 0,
    },
    upright: true,
  });
  assert.ok(sample.point.distance(new pc.Vec3(0.4, 0.4, -0.2)) < 0.00001);
  assert.ok(sample.frame.normal.z < -0.99);
});

it("follows the hem segment and keeps an inward-wound surface frame facing outward after a fold", () => {
  const points = [new pc.Vec3(0, 0, -1), new pc.Vec3(1, 0, -1)];
  const frames = points.map(() => ({
    tangent: new pc.Vec3(1, 0, 0),
    bitangent: new pc.Vec3(0, 1, 0),
    normal: new pc.Vec3(0, 0, 1),
  }));
  const root = new pc.Vec3();
  const edge = findKingHemAttachment({
    pc,
    points,
    frames,
    root,
    edges: [[0, 1]],
    center: new pc.Vec3(0.4, 0.01, -1.02),
    scale: 1,
  });
  assert.ok(edge);
  assert.ok(Math.abs(edge.amount - 0.4) < 0.00001);
  points[0].set(0, 0.2, -0.8);
  points[1].set(1, 0.5, -0.4);
  const sample = sampleKingHemAttachment({
    pc,
    points,
    frames,
    root,
    edge,
  });
  assert.ok(sample.point.distance(new pc.Vec3(0.4, 0.32, -0.64)) < 0.00001,
    "fur must retain its position along the changing hem line");
  const outward = sample.point.clone();
  outward.y = 0;
  assert.ok(sample.frame.normal.dot(outward) > 0, "fur must remain on the outer side of the cloak");
  assert.ok(Math.abs(sample.frame.normal.dot(sample.frame.tangent)) < 0.00001,
    "the exterior offset must stay perpendicular to the hem");
});
