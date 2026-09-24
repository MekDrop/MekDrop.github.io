uniform vec3 material_diffuse;
uniform float uPathWear;
uniform vec2 uPathWearCenter;

void getAlbedo() {
  dAlbedo = material_diffuse;
  #ifdef STD_DIFFUSE_TEXTURE
    vec2 uv = {STD_DIFFUSE_TEXTURE_UV};
    vec3 sandstone = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias(
      {STD_DIFFUSE_TEXTURE_NAME}, uv, textureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    float value = dot(sandstone, vec3(0.299, 0.587, 0.114));
    // Keep the broad wear in the atlas while calming its golden cast.
    sandstone = mix(sandstone, vec3(value), 0.3);
    dAlbedo *= sandstone;

    // Only the occasional marked variant has a soft stain near a seam.
    vec2 wearOffset = (uv - uPathWearCenter) * vec2(1.0, 1.25);
    float wearArea = 1.0 - smoothstep(0.09, 0.29, length(wearOffset));
    float wornTexture = 1.0 - smoothstep(0.7, 0.88, value);
    dAlbedo *= 1.0 - uPathWear * wearArea * (0.4 + 0.6 * wornTexture);
  #endif
  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
}
