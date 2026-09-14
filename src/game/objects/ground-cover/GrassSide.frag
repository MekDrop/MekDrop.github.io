uniform vec3 material_diffuse;

void getAlbedo() {
  dAlbedo = material_diffuse;
  #ifdef STD_DIFFUSE_TEXTURE
    vec3 sideColor = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias(
      {STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_UV}, textureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    // Recolor the green fringe only; the soil in this atlas keeps its color.
    float grass = smoothstep(0.015, 0.07, sideColor.g - max(sideColor.r, sideColor.b));
    dAlbedo *= sideColor * mix(vec3(1.0), vec3(0.45, 0.82, 0.65), grass);
  #endif
}
