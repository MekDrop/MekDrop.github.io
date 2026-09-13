uniform vec3 material_diffuse;
uniform vec2 uRiverFlowDirection;
uniform float uRiverTime;
uniform float uRiverVertical;
uniform float uRiverLava;

float riverHash(vec2 position) {
  return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453);
}

float riverNoise(vec2 position) {
  vec2 cell = floor(position);
  vec2 blend = fract(position);
  blend = blend * blend * (3.0 - 2.0 * blend);
  float bottom = mix(
    riverHash(cell),
    riverHash(cell + vec2(1.0, 0.0)),
    blend.x
  );
  float top = mix(
    riverHash(cell + vec2(0.0, 1.0)),
    riverHash(cell + vec2(1.0, 1.0)),
    blend.x
  );
  return mix(bottom, top, blend.y);
}

float riverFbm(vec2 position) {
  float noiseValue = riverNoise(position) * 0.58;
  noiseValue += riverNoise(position * 2.03 + 7.9) * 0.28;
  noiseValue += riverNoise(position * 4.07 + 19.3) * 0.14;
  return noiseValue;
}

void getAlbedo() {
  vec2 flowDirection = normalize(uRiverFlowDirection);
  vec2 crossDirection = vec2(-flowDirection.y, flowDirection.x);
  float alongSurfaceFlow = dot(vPositionW.xz, flowDirection);
  float acrossSurfaceFlow = dot(vPositionW.xz, crossDirection);
  float waterfallAcross = vVertexColor.r;
  float fallProgress = vVertexColor.g;
  float waterDepth = clamp(vVertexColor.r, 0.0, 1.0);
  float waterVolumeSide = (1.0 - uRiverVertical) * smoothstep(0.02, 0.18, waterDepth);
  vec2 lavaFlowPosition = vec2(
    acrossSurfaceFlow * 1.45,
    alongSurfaceFlow * 0.62 - uRiverTime * 0.14
  );
  float lavaBroad = riverFbm(lavaFlowPosition + vec2(17.3, 4.1));
  float lavaVein = smoothstep(
    0.56,
    0.88,
    sin(
      alongSurfaceFlow * 2.8 -
      uRiverTime * 0.54 +
      lavaBroad * 4.2
    ) * 0.5 + 0.5
  );
  float lavaSurfaceTone = clamp(
    0.28 + lavaBroad * 0.48 + lavaVein * 0.28,
    0.0,
    1.0
  );
  vec2 lavaFallPosition = vec2(
    waterfallAcross * 1.8,
    fallProgress * 1.35 - uRiverTime * 0.12
  );
  float lavaFallBroad = riverFbm(lavaFallPosition + vec2(8.7, 21.4));
  float lavaFallRibbon = smoothstep(
    0.58,
    0.86,
    sin(
      waterfallAcross * 6.0 -
      fallProgress * 1.4 +
      lavaFallBroad * 3.2
    ) * 0.5 + 0.5
  );
  float lavaFallTone = clamp(
    0.28 + lavaFallBroad * 0.5 + lavaFallRibbon * 0.26,
    0.0,
    1.0
  );
  float lavaFlow = mix(lavaSurfaceTone, lavaFallTone, uRiverVertical);
  lavaFlow = floor(lavaFlow * 3.999) / 3.0;
  vec3 lavaDark = vec3(0.48, 0.032, 0.002);
  vec3 lavaOrange = vec3(1.16, 0.3, 0.01);
  vec3 lavaYellow = vec3(1.35, 0.96, 0.22);
  vec3 lavaColor = mix(lavaDark, lavaOrange, lavaFlow);
  lavaColor = mix(
    lavaColor,
    lavaYellow,
    smoothstep(0.58, 0.9, lavaFlow)
  );
  lavaColor = mix(lavaColor, lavaDark, waterVolumeSide * waterDepth * 0.78);
  dAlbedo = lavaColor;
}
