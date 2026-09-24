uniform vec3 material_diffuse;
uniform vec3 uGrassTileColor;
uniform float uGrassTextureMix;

void getAlbedo() {
  // Each world cube has one dominant grass color, matching the path-tile
  // footprint. The existing texture supplies only faint close-up variation.
  dAlbedo = material_diffuse * uGrassTileColor;
  #ifdef STD_DIFFUSE_TEXTURE
    vec2 grassUv = vPositionW.xz * 0.55;
    vec3 grassTexture = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias(
      {STD_DIFFUSE_TEXTURE_NAME}, grassUv,
      textureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    dAlbedo = material_diffuse * mix(
      uGrassTileColor,
      grassTexture,
      uGrassTextureMix
    );
  #endif
  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
}
