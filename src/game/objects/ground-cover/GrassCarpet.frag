uniform vec3 material_diffuse;
uniform float uGrassBroadleaf;
varying float vGrassTip;
varying float vGrassVariation;
varying float vGrassCompression;

void getAlbedo() {
  // Three close paint tones give the tiny overlapping leaves a cel-shaded
  // finish without turning every edge into a bright or black triangle.
  vec3 rootColor = mix(vec3(0.028, 0.20, 0.02), vec3(0.018, 0.16, 0.033), uGrassBroadleaf);
  vec3 tipColor = mix(vec3(0.06, 0.30, 0.034), vec3(0.035, 0.25, 0.058), uGrassBroadleaf);
  float paintBand = smoothstep(0.28, 0.34, vGrassTip) * 0.55 +
    smoothstep(0.7, 0.76, vGrassTip) * 0.45;
  dAlbedo = material_diffuse * mix(rootColor, tipColor, paintBand) *
    mix(0.96, 1.04, vGrassVariation) * (1.0 - vGrassCompression * 0.1);
}
