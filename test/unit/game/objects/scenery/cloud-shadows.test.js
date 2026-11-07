import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec2 } from "playcanvas";

const root = new URL("../../../../../src/game/objects/scenery/", import.meta.url);
const source = readFileSync(new URL("CloudShadows.js", root), "utf8").replace(/^import .*;\r?\n/gm, "").replace("export class", "class");

it("shares sunlight transmission across renderers, advects without rebaking, and restores chunks", () => {
  let bakes = 0;
  const Mask = {
    bake: () => {
      bakes++;

      return new Uint8Array(512 * 512 * 4).fill(255);
    },
  };
  const Shadows = new Function("CloudShadowMask", "glsl", "wgsl", `${source}; return CloudShadows;`)(Mask, "GLSL helper", "WGSL helper");
  const maps = [new Map([["lightFunctionLightPS", "dAtten = 1.0;"]]), new Map([["lightFunctionLightPS", "dAtten = 1.0;"]])];
  const values = new Map();
  const pc = {
    Vec2,
    SHADERLANGUAGE_GLSL: 0,
    SHADERLANGUAGE_WGSL: 1,
    ShaderChunks: { get: (device, language) => maps[language] },
    StandardMaterial: class {},
    Texture: class {
      pixels = new Uint8Array(512 * 512 * 4);
      lock = () => this.pixels;
      unlock = () => {};
      destroy = () => {};
    },
  };
  const position = {
    x: 0,
    z: 0,
  };
  const app = {
    root: {
      findComponents: (type) => type === "light" ? [{
        type: "directional",
        entity: {
          up: {
            x: 0.4,
            y: 0.8,
            z: -0.4,
          },
        },
      }] : [],
    },
    graphicsDevice: { scope: { resolve: (name) => ({ setValue: (value) => values.set(name, value) }) } },
  };
  const shadow = new Shadows({
    pc,
    app,
    camera: { entity: { getPosition: () => position } },
  });
  for (const map of maps) {
    assert.match(map.get("lightFunctionLightPS"), /cloudSunTransmission\(vPositionW, dLightDirNormW\)/);
  }
  shadow.update(new Vec2(9.7, 3.1));
  assert.equal(bakes, 1);
  shadow.update(new Vec2(9.71, 3.1));
  assert.equal(bakes, 1);
  assert.deepEqual(values.get("uCloudShadowProjection"), [0.5, -0.5, 9.71 * 12, 3.1 * 12]);
  position.x = 200;
  shadow.update(new Vec2(9.71, 3.1));
  assert.equal(bakes, 2);
  shadow.destroy();
  assert.equal(values.get("uCloudShadowBounds")[3], 0);
  for (const map of maps) {
    assert.equal(map.get("lightFunctionLightPS"), "dAtten = 1.0;");
  }
});
