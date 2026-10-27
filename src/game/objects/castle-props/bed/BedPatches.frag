uniform vec3 material_diffuse;
uniform vec3 uBedRepair0;
uniform vec3 uBedRepair1;
uniform vec3 uBedRepair2;
uniform vec3 uBedRepair3;
#ifdef STD_DIFFUSEDETAIL_TEXTURE
  #include "detailModesPS"
#endif

float bedRepairBox(vec2 uv, vec4 bounds) {
  vec2 inside = step(bounds.xy, uv) * step(uv, bounds.zw);
  return inside.x * inside.y;
}

vec3 bedRepairColor(vec2 uv, vec3 authored) {
  // Bounds are the four repair islands in servant-bed's authored color atlas.
  // Warm/neutral repair cloth is replaced; neighboring blue blanket pixels are not.
  float cloth = max(smoothstep(0.015, 0.1, authored.r - authored.b),
    1.0 - smoothstep(0.02, 0.08, abs(authored.r - authored.b)));
  float shade = clamp(dot(authored, vec3(0.2126, 0.7152, 0.0722)) / 0.45, 0.07, 1.4);
  vec3 result = mix(authored, uBedRepair0 * shade, cloth * bedRepairBox(uv, vec4(0.26, 0.365, 0.35, 0.445)));
  result = mix(result, uBedRepair1 * shade, cloth * bedRepairBox(uv, vec4(0.407, 0.172, 0.49, 0.25)));
  result = mix(result, uBedRepair2 * shade, cloth * bedRepairBox(uv, vec4(0.69, 0.207, 0.82, 0.32)));
  return mix(result, uBedRepair3 * shade, cloth * bedRepairBox(uv, vec4(0.59, 0.56, 0.71, 0.65)));
}

void getAlbedo() {
  dAlbedo = material_diffuse.rgb;
  #ifdef STD_DIFFUSE_TEXTURE
    vec3 albedoTexture = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_UV}, textureBias)).{STD_DIFFUSE_TEXTURE_CHANNEL};
    albedoTexture = bedRepairColor({STD_DIFFUSE_TEXTURE_UV}, albedoTexture);
    #ifdef STD_DIFFUSEDETAIL_TEXTURE
      vec3 albedoDetail = {STD_DIFFUSEDETAIL_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSEDETAIL_TEXTURE_NAME}, {STD_DIFFUSEDETAIL_TEXTURE_UV}, textureBias)).{STD_DIFFUSEDETAIL_TEXTURE_CHANNEL};
      albedoTexture = detailMode_{STD_DIFFUSEDETAIL_DETAILMODE}(albedoTexture, albedoDetail);
    #endif
    dAlbedo *= albedoTexture;
  #endif
  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
}
