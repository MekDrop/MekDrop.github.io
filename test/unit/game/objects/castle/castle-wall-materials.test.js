import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CASTLE_BLOCK_SIZE, CASTLE_MATERIAL_DEFINITIONS } from "../../../../../src/game/generator/castle/CastleGenerationConfig.js";

// Substitute asset-backed decorations, but exercise the real builder, engine
// materials, and closed box mesh on PlayCanvas's CPU graphics device.
const source = readFileSync(new URL(
  "../../../../../src/game/objects/castle/CastleEntityBuilder.js", import.meta.url,
), "utf8").replace(/^import[\s\S]*?from "[^"]+";\r?\n/gm, "");
const prelude = `
const CASTLE_BLOCK_SIZE = ${CASTLE_BLOCK_SIZE};
const CASTLE_MATERIAL_DEFINITIONS = ${JSON.stringify(CASTLE_MATERIAL_DEFINITIONS)};
const colorFromHex = (pc, hex) => new pc.Color().fromString('#' + hex.toString(16).padStart(6, '0'));
class Decoration {
  constructor({ pc }) { this.entity = new pc.Entity('decoration'); }
  destroy() { this.entity.destroy(); }
}
const CastleFire = Decoration, CastleBanner = Decoration,
  CastleRoof = Decoration, CastleStairs = Decoration;
`;
const { CastleEntityBuilder } = await import(
  `data:text/javascript;base64,${Buffer.from(prelude + source).toString("base64")}`
);

it("stone blocks remain opaque from both sides with depth testing and writing enabled", () => {
  const materials = [];
  class StandardMaterial extends pc.StandardMaterial {
    constructor() {
      super();
      materials.push(this);
    }
  }
  const graphicsDevice = new pc.NullGraphicsDevice({ width: 1, height: 1 });
  const castle = new CastleEntityBuilder({
    pc: { ...pc, StandardMaterial },
    app: { graphicsDevice, on: () => ({ off() {} }) },
    buildPlan: {
      input: { position: { x: 0, y: 0, z: 0 }, doors: [] },
      layout: { empty: true },
    },
  });
  try {
    const stone = materials.filter(({ name }) =>
      CASTLE_MATERIAL_DEFINITIONS[name].texture === "castleStone",
    );
    assert.equal(stone.length, 5);
    for (const material of stone) {
      assert.equal(material.cull, pc.CULLFACE_NONE, material.name);
      assert.equal(material.twoSidedLighting, true, material.name);
      assert.equal(material.blendType, pc.BLEND_NONE, material.name);
      assert.equal(material.opacity, 1, material.name);
      assert.equal(material.depthWrite, true, material.name);
      assert.equal(material.depthTest, true, material.name);
    }
  } finally {
    castle.destroy();
    graphicsDevice.destroy();
  }
});
