import diffuseShader from "./CastleMasonry.frag?raw";
import diffuseWgslShader from "./CastleMasonry.wgsl?raw";

/**
 * Keeps masonry courses at a fixed size regardless of the mesh's UVs or scale.
 */
export class CastleMasonryMaterial {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").StandardMaterial} material
   * @param {Float32Array} worldToCastle
   */
  static configure(pc, material, worldToCastle) {
    material.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
    material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("diffusePS", diffuseShader);
    material.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set("diffusePS", diffuseWgslShader);
    material.setParameter("uWorldToCastle", worldToCastle);
  }
}
