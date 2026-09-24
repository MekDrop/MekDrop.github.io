uniform vec3 material_diffuse;
uniform float uGrassBroadleaf;
uniform vec2 uGrassGridOffset;
uniform vec2 uGrassVariantMapSize;
uniform sampler2D uGrassVariantMap;
uniform vec3 uGrassVariantColors[6];
varying float vGrassTip;
varying float vGrassVariation;
varying float vGrassCompression;

void getAlbedo() {
  float paintBand = smoothstep(0.28, 0.34, vGrassTip) * 0.55 +
    smoothstep(0.7, 0.76, vGrassTip) * 0.45;

  // The 3D blades inherit the square terrain-tile color, while their own
  // root-to-tip shading stays independent of the painted ground texture.
  vec2 tileIndex = clamp(
    floor(vPositionW.xz + uGrassGridOffset + 0.5),
    vec2(0.0),
    uGrassVariantMapSize - 1.0
  );
  vec2 tileUv = (tileIndex + 0.5) / uGrassVariantMapSize;
  float variant = clamp(
    floor(texture2D(uGrassVariantMap, tileUv).r * 255.0 + 0.5),
    0.0,
    5.0
  );
  vec3 tileColor = uGrassVariantColors[0];
  for (int index = 1; index < 6; index++) {
    tileColor = mix(
      tileColor,
      uGrassVariantColors[index],
      step(float(index) - 0.5, variant)
    );
  }
  // Keep the physical blades close to the tile color so the meadow reads
  // as broad patches instead of thousands of dark individual flecks.
  vec3 narrowGrass = tileColor * mix(0.66, 0.9, paintBand);

  vec3 broadleaf = tileColor * mix(0.55, 0.78, paintBand);
  dAlbedo = material_diffuse * mix(narrowGrass, broadleaf, uGrassBroadleaf) *
    mix(1.0, mix(0.96, 1.04, vGrassVariation), uGrassBroadleaf) *
    (1.0 - vGrassCompression * 0.1);
}
