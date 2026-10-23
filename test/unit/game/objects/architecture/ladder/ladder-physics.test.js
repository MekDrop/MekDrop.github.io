import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";

// Node does not load Vite's model URL imports.
const hooks = registerHooks({
  load: (url, context, nextLoad) => {
    if (url.endsWith(".glb?url")) {
      return {
        format: "module",
        source: `export default ${JSON.stringify(url)}`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
const { Ladder } = await import("../../../../../../src/game/objects/architecture/ladder/Ladder.js");
hooks.deregister();

it("places a standalone ladder from two 3D landings without mutating map data", () => {
  const bottom = {
    x: 2,
    y: 4,
    z: 6,
  };
  const definition = {
    id: "standalone",
    object: "Ladder",
    bottom,
    top: {
      x: 5,
      y: 8,
      z: 6,
    },
  };
  const resolved = Ladder.resolveDefinition(definition);
  assert.equal(resolved.rotation, 90);
  assert.deepEqual(resolved.position, {
    x: 2.375,
    y: 4,
    z: 6,
  });
  assert.equal(definition.position, undefined);
  assert.equal(definition.rotation, undefined);
  assert.equal(resolved.bottom, bottom);
  const explicit = {
    ...definition,
    position: {
      x: 1,
      y: 4,
      z: 5,
    },
    rotation: 270,
  };
  assert.deepEqual(Ladder.resolveDefinition(explicit), explicit);
});

it("uses a stable heading for vertically aligned endpoints", () => {
  const resolved = Ladder.resolveDefinition({
    bottom: {
      x: 2,
      y: 1,
      z: 3,
    },
    top: {
      x: 2,
      y: 5,
      z: 3,
    },
  });
  assert.equal(resolved.rotation, 0);
  assert.deepEqual(resolved.position, {
    x: 2,
    y: 1,
    z: 3.375,
  });
});

it("exports the ladder with a bottom-center root pivot", () => {
  const bytes = readFileSync(new URL("../../../../../../src/game/models/castle/residential/crown-ladder.glb", import.meta.url));
  const length = bytes.readUInt32LE(12);
  const asset = JSON.parse(bytes.toString("utf8", 20, 20 + length));
  for (const index of asset.scenes[asset.scene ?? 0].nodes) {
    const node = asset.nodes[index];
    assert.ok((node.translation ?? [0, 0, 0]).every((value) => Math.abs(value) < 0.00001), "scaling must not retain a side-rail center offset");
    assert.ok((node.scale ?? [1, 1, 1]).every((value) => Math.abs(value - 1) < 0.00001));
  }
});

it("enables the inherited authored mesh collision for the ladder", () => {
  assert.equal(Ladder.hasAuthoredCollision, true);
});

it("rests either side of the rail tips against the hatch opening without entering the wall", () => {
  for (const direction of [-1, 1]) {
    for (const rotation of [0, 90, 180, 270]) {
      const radians = rotation * Math.PI / 180;
      const definition = {
        position: {
          x: 5,
          y: 6,
          z: 8,
        },
        top: { y: 9 },
        rotation,
        opening: {
          position: {
            x: 5 + direction * 0.25 * Math.sin(radians),
            y: 9,
            z: 8 + direction * 0.25 * Math.cos(radians),
          },
          depth: 1,
        },
      };
      const model = new Entity();
      Ladder.prototype.prepareModel.call({ definition }, model);
      const tip = model.getWorldTransform().transformPoint(new Vec3(0, 3.7, 0));
      const side = model.getWorldTransform().transformPoint(new Vec3(0, 3.7, -direction * 0.0375));
      const wall = direction * (0.25 - 0.5);
      assert.ok(Math.abs(side.z - wall) < 0.001, "rail face meets the hatch wall within 1 mm");
      assert.ok(direction * (side.z - wall) >= -0.00001, "rail stays inside the clear opening");
      assert.ok(Math.abs(tip.y - 2.93) < 0.00001, "rail tips stay beneath the lid");
      model.destroy();
    }
  }
});
