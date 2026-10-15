import surfaceGLSL from "./FireSurface.glsl?raw";
import surfaceWGSL from "./FireSurface.wgsl?raw";

/**
 * Masks baked flames inside a supplied box so Fire particles own the flame.
 * Box dimensions and edge fades are supplied in the source mesh's local space.
 */
export class FireSurfaceMaterial {
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").GraphicsDevice} device
   * @param {import("playcanvas").StandardMaterial} source
   * @param {{position: import("../ObjectTypes.js").Point3, volume: import("../ObjectTypes.js").Point3, fadeIn: import("../ObjectTypes.js").Point3, fadeOut: import("../ObjectTypes.js").Point3}} region
   * @returns {import("playcanvas").StandardMaterial}
   */
  static create(pc, device, source, region) {
    const material = source.clone();
    material.name = "Fire surface without baked flame";
    material.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
    for (const [language, surface] of [
      [pc.SHADERLANGUAGE_GLSL, surfaceGLSL],
      [pc.SHADERLANGUAGE_WGSL, surfaceWGSL],
    ]) {
      const wgsl = language === pc.SHADERLANGUAGE_WGSL;
      const stock = pc.ShaderChunks.get(device, language);
      const chunks = material.getShaderChunks(language);
      chunks.set("litUserDeclarationVS", wgsl
        ? "varying vFireSurfacePosition: vec3f;"
        : "varying vec3 vFireSurfacePosition;");
      chunks.set("litUserMainEndVS", wgsl
        ? "output.vFireSurfacePosition = vertex_position.xyz;"
        : "vFireSurfacePosition = vertex_position.xyz;");
      const diffuse = stock.get("diffusePS");
      const close = diffuse.lastIndexOf("}");
      const vector = wgsl ? "vec3f" : "vec3";
      chunks.set("diffusePS", `${surface}
${diffuse.slice(0, close)}
  dAlbedo = mix(dAlbedo, ${vector}(0.012, 0.006, 0.003), fireSurfaceMask());
${diffuse.slice(close)}`);
      chunks.set("emissivePS", `${wgsl ? "fn" : "void"} getEmission() {
  dEmission = ${vector}(0.0);
}`);
    }
    const { position, volume, fadeIn, fadeOut } = region;
    const min = [position.x - volume.x / 2, position.y, position.z - volume.z / 2];
    const max = [min[0] + volume.x, min[1] + volume.y, min[2] + volume.z];
    material.setParameter("uFireMin", min);
    material.setParameter("uFireMax", max);
    material.setParameter("uFireInnerMin", [min[0] + fadeIn.x, min[1] + fadeIn.y, min[2] + fadeIn.z]);
    material.setParameter("uFireInnerMax", [max[0] - fadeOut.x, max[1] - fadeOut.y, max[2] - fadeOut.z]);
    material.update();
    return material;
  }
}
