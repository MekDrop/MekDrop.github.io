uniform material_diffuse: vec3f;
uniform uBedRepair0: vec3f;
uniform uBedRepair1: vec3f;
uniform uBedRepair2: vec3f;
uniform uBedRepair3: vec3f;
#ifdef STD_DIFFUSEDETAIL_TEXTURE
  #include "detailModesPS"
#endif

fn bedRepairBox(uv: vec2f, bounds: vec4f) -> f32 {
  let inside = step(bounds.xy, uv) * step(uv, bounds.zw);
  return inside.x * inside.y;
}

fn bedRepairColor(uv: vec2f, authored: vec3f) -> vec3f {
  let cloth = max(smoothstep(0.015, 0.1, authored.r - authored.b),
    1.0 - smoothstep(0.02, 0.08, abs(authored.r - authored.b)));
  let shade = clamp(dot(authored, vec3f(0.2126, 0.7152, 0.0722)) / 0.45, 0.07, 1.4);
  var result = mix(authored, uniform.uBedRepair0 * shade, cloth * bedRepairBox(uv, vec4f(0.26, 0.365, 0.35, 0.445)));
  result = mix(result, uniform.uBedRepair1 * shade, cloth * bedRepairBox(uv, vec4f(0.407, 0.172, 0.49, 0.25)));
  result = mix(result, uniform.uBedRepair2 * shade, cloth * bedRepairBox(uv, vec4f(0.69, 0.207, 0.82, 0.32)));
  return mix(result, uniform.uBedRepair3 * shade, cloth * bedRepairBox(uv, vec4f(0.59, 0.56, 0.71, 0.65)));
}

fn getAlbedo() {
  dAlbedo = uniform.material_diffuse.rgb;
  #ifdef STD_DIFFUSE_TEXTURE
    var albedoTexture: vec3f = {STD_DIFFUSE_TEXTURE_DECODE}(textureSampleBias({STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_NAME}Sampler, {STD_DIFFUSE_TEXTURE_UV}, uniform.textureBias)).{STD_DIFFUSE_TEXTURE_CHANNEL};
    albedoTexture = bedRepairColor({STD_DIFFUSE_TEXTURE_UV}, albedoTexture);
    #ifdef STD_DIFFUSEDETAIL_TEXTURE
      let albedoDetail: vec3f = {STD_DIFFUSEDETAIL_TEXTURE_DECODE}(textureSampleBias({STD_DIFFUSEDETAIL_TEXTURE_NAME}, {STD_DIFFUSEDETAIL_TEXTURE_NAME}Sampler, {STD_DIFFUSEDETAIL_TEXTURE_UV}, uniform.textureBias)).{STD_DIFFUSEDETAIL_TEXTURE_CHANNEL};
      albedoTexture = detailMode_{STD_DIFFUSEDETAIL_DETAILMODE}(albedoTexture, albedoDetail);
    #endif
    dAlbedo = dAlbedo * albedoTexture;
  #endif
  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo = dAlbedo * saturate3(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
}
