import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import glslGloss from "../../../../node_modules/playcanvas/build/playcanvas/src/scene/shader-lib/glsl/chunks/standard/frag/gloss.js";
import wgslGloss from "../../../../node_modules/playcanvas/build/playcanvas/src/scene/shader-lib/wgsl/chunks/standard/frag/gloss.js";
import { AuthoredSurfaceStyle } from "../../../../src/game/rendering/AuthoredSurfaceStyle.js";

it("softens textured imported surfaces after roughness decoding on both backends", () => {
  const device = new pc.NullGraphicsDevice({
    width: 32,
    height: 32,
  });
  pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL).set("glossPS", glslGloss);
  pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_WGSL).set("glossPS", wgslGloss);
  const material = new pc.StandardMaterial();
  const texture = new pc.Texture(device);
  material.glossMap = texture;
  material.metalnessMap = texture;
  material.glossInvert = true;
  material.gloss = 0.9;
  material.metalness = 0.85;
  try {
    AuthoredSurfaceStyle.configure(pc, device, material);
    assert.equal(material.glossMap, texture);
    assert.equal(material.metalnessMap, texture);
    assert.equal(material.gloss, 0.9);
    assert.equal(material.metalness, 0.85);
    assert.equal(material.glossInvert, true);
    for (const language of [pc.SHADERLANGUAGE_GLSL, pc.SHADERLANGUAGE_WGSL]) {
      const shader = material.getShaderChunks(language).get("glossPS");
      assert.match(shader, /STD_GLOSS_TEXTURE/);
      assert.match(shader, /STD_GLOSS_INVERT/);
      assert.ok(shader.indexOf("getAuthoredGlossiness();") < shader.indexOf("min(dGlossiness"));
      assert.equal((shader.match(/(?:void|fn) getGlossiness\(\)/g) ?? []).length, 1);
    }
  } finally {
    material.destroy();
    texture.destroy();
    device.destroy();
  }
});

it("leaves transparent and refractive surfaces polished", () => {
  for (const property of ["opacity", "refraction"]) {
    const material = new pc.StandardMaterial();
    material[property] = 0.5;
    material.clearCoat = 0.8;
    AuthoredSurfaceStyle.configure(pc, null, material);
    assert.equal(material.clearCoat, 0.8);
    assert.equal(material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).size, 0);
    assert.equal(material.getShaderChunks(pc.SHADERLANGUAGE_WGSL).size, 0);
    material.destroy();
  }
});
