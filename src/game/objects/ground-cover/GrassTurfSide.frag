uniform vec3 material_diffuse;

void getAlbedo() {
  dAlbedo = material_diffuse;
  #ifdef STD_DIFFUSE_TEXTURE
    vec3 soil = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias(
      {STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_UV}, textureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    // The grass canopy is above the cube; its vertical faces remain soil.
    soil.g = min(soil.g, soil.r * 0.75);
    dAlbedo *= soil;
  #endif
}