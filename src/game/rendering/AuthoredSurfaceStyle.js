/**
 * A weathered finish for imported world assets, retaining authored colour,
 * normals, metalness and roughness variation beneath broad, soft highlights.
 */
export class AuthoredSurfaceStyle {
  /**
   * Configure asset-owned materials once, before any instances share them.
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {import("playcanvas").StandardMaterial} material
   */
  static configure(pc, device, material) {
    // Transparent glass and liquid retain their deliberately polished finish.
    if (material.opacity < 1 || material.refraction > 0) {
      return;
    }
    material.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
    for (const language of [pc.SHADERLANGUAGE_GLSL, pc.SHADERLANGUAGE_WGSL]) {
      const source = pc.ShaderChunks.get(device, language).get("glossPS");
      const declaration = language === pc.SHADERLANGUAGE_GLSL ? "void" : "fn";
      material.getShaderChunks(language).set("glossPS", `${source.replace(
        "getGlossiness()", "getAuthoredGlossiness()",
      )}
${declaration} getGlossiness() {
    getAuthoredGlossiness();
    dGlossiness = min(dGlossiness, 0.36);
}
`);
    }
    material.clearCoat = 0;
    material.update();
  }
}
