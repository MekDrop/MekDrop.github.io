uniform vec3 material_diffuse;

void getAlbedo() {
  dAlbedo = material_diffuse;
  #ifdef STD_DIFFUSE_TEXTURE
    // A still underlayer. Foot contact and wind belong to the 3D canopy.
    vec2 grassPosition = vPositionW.xz;
    float worldUnitsPerPixel = max(length(dFdx(grassPosition)), length(dFdy(grassPosition)));
    float distantTextureBias = smoothstep(0.018, 0.055, worldUnitsPerPixel) * 1.25;
    vec3 grassTexture = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias(
      {STD_DIFFUSE_TEXTURE_NAME}, grassPosition * 0.32,
      textureBias + distantTextureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    dAlbedo *= grassTexture * vec3(0.45, 0.82, 0.65);
  #endif
  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
}
