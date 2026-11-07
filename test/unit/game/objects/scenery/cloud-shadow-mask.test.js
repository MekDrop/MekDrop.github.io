import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec2 } from "playcanvas";

const root = new URL("../../../../../src/game/objects/scenery/", import.meta.url);
const cloudVoxels = JSON.parse(readFileSync(new URL("CloudVoxelVariants.json", root), "utf8"));
const skySettings = JSON.parse(readFileSync(new URL("CloudSkySettings.json", root), "utf8"));
const source = readFileSync(new URL("CloudShadowMask.js", root), "utf8").replace(/^import .*;\r?\n/gm, "").replace("export class", "class");
const Mask = new Function("cloudVoxels", "Vec2", "skySettings", `${source}; return CloudShadowMask;`)(cloudVoxels, Vec2, skySettings);

it("uses the same exact arithmetic as the sky shader, including negative cells", () => {
  const f = Math.fround;
  const mod = (a, b) => f(a - f(Math.floor(f(a / b)) * b));
  for (let x = -50; x < 50; x++) {
    for (let z = -40; z < 40; z++) {
      const qx = mod(x, 251);
      const qz = mod(z, 251);
      let value = mod(f(f(qx * 73) + f(qz * 151) + 19), 251);
      value = mod(f(value * value * 13 + value * 7 + 17), 65521);
      const shader = f(mod(f(value * 53 + 113), 65521) / 65521);
      assert.equal(f(Mask.hash(x, z)), shader);
    }
  }
});

/**
 * @param {number} opacity
 * @param {Vec2} slope
 * @returns {{darkness: number, centerX: number}}
 */
function sample(opacity, slope) {
  const original = Mask.cloud;
  try {
    Mask.cloud = (x, z) => x === 0 && z === 0 ? {
      x: 0,
      z: 0,
      height: 30,
      scale: 1,
      opacity,
      variant: 0,
    } : null;
    const pixels = Mask.bake({
      minX: -32,
      minZ: -32,
      span: 64,
      resolution: 128,
      slope,
    });
    let darkness = 0;
    let weightedX = 0;
    for (let i = 0; i < 128 * 128; i++) {
      const weight = 255 - pixels[i * 4];
      darkness += weight;
      weightedX += weight * ((i % 128 + 0.5) * 0.5 - 32);
      assert.equal(pixels[i * 4 + 3], 255);
    }

    return {
      darkness,
      centerX: weightedX / darkness,
    };
  } finally {
    Mask.cloud = original;
  }
}

it("leaves fully transparent clouds clear and makes denser cubes cast stronger shadows", () => {
  assert.equal(sample(0, new Vec2()).darkness, 0);
  const thin = sample(0.28, new Vec2()).darkness;
  const dense = sample(0.7, new Vec2()).darkness;
  assert.ok(thin > 0);
  assert.ok(dense > thin);
});

it("projects shadows away from the sun according to cloud altitude", () => {
  const overhead = sample(0.46, new Vec2());
  const slanted = sample(0.46, new Vec2(0.5, 0));
  assert.ok(Math.abs(slanted.centerX - overhead.centerX + 15) < 1);
});
