uniform vec3 material_diffuse;
uniform float uRiverTime;
uniform float uRiverFlowScale;
uniform float uRiverLava;
uniform sampler2D uRiverFlowMap;
uniform vec2 uRiverMapSize;

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
  float metadataLength = length(vUv1);
  float vertical = clamp(metadataLength - 1.0, 0.0, 1.0);
  // Resolve bends per fragment so adjacent cells share their painted edges.
  vec2 gridPosition = vPositionW.xz + uRiverMapSize * 0.5;
  vec2 cell = clamp(floor(gridPosition), vec2(0.0), uRiverMapSize - 1.0);
  vec2 local = gridPosition - cell - 0.5;
  vec4 route = texture2D(uRiverFlowMap, (cell + 0.5) / uRiverMapSize);
  vec2 outgoing = route.yz;
  vec2 surfaceUv = vec2(
    0.5 + dot(local, vec2(-outgoing.y, outgoing.x)),
    route.x + 0.5 + dot(local, outgoing)
  );
  if (abs(route.w) > 0.5) {
    vec2 incoming = vec2(outgoing.y, -outgoing.x) * route.w;
    vec2 offset = local - (outgoing - incoming) * 0.5;
    float along = max(0.0, dot(offset, incoming));
    float before = max(0.0, -dot(offset, outgoing));
    float progress = atan(along, max(0.000001, before)) / 1.57079632679;
    surfaceUv = vec2(
      0.5 + route.w * (0.5 - length(offset)),
      route.x + progress
    );
  }
  // Continue one pattern over the lip using the sheet's authored route distance.
  vec2 flowUv = mix(surfaceUv, vUv0, vertical);
  float waterDepth = clamp(vVertexColor.r, 0.0, 1.0);
  float waterVolumeSide = (1.0 - vertical) * smoothstep(0.02, 0.18, waterDepth);
  vec2 lavaFlowPosition = vec2(
    flowUv.x * 4.2,
    flowUv.y * 1.8 - (uRiverTime * uRiverFlowScale) * 0.41
  );
  float lavaBroad = riverFbm(lavaFlowPosition + vec2(17.3, 4.1));
  float lavaVein = smoothstep(
    0.56,
    0.88,
    sin(
      flowUv.y * 6.8 -
      (uRiverTime * uRiverFlowScale) * 1.55 +
      lavaBroad * 4.2
    ) * 0.5 + 0.5
  );
  float lavaSurfaceTone = clamp(
    0.26 + lavaBroad * 0.5 + lavaVein * 0.26,
    0.0,
    1.0
  );
  float lavaFlow = lavaSurfaceTone;
  // Soft paint bands retain the chunky style without popping between colours.
  float bands = lavaFlow * 4.0;
  float paintedBands = (floor(bands) + smoothstep(0.38, 0.62, fract(bands))) / 4.0;
  lavaFlow = mix(lavaFlow, paintedBands, 0.5);
  vec3 lavaDark = vec3(0.32, 0.018, 0.002);
  vec3 lavaOrange = vec3(1.15, 0.16, 0.006);
  vec3 lavaYellow = vec3(1.4, 0.68, 0.055);
  vec3 lavaColor = mix(lavaDark, lavaOrange, lavaFlow);
  lavaColor = mix(
    lavaColor,
    lavaYellow,
    smoothstep(0.66, 0.93, lavaFlow)
  );
  lavaColor = mix(lavaColor, lavaDark, waterVolumeSide * waterDepth * 0.78);
  // A subtle fixed cross-section shade makes the thin side read as volume.
  vec3 faceNormal = normalize(cross(dFdx(vPositionW), dFdy(vPositionW)));
  vec2 fallDirection = vUv1 / max(metadataLength, 0.0001);
  float sideFace = 1.0 - abs(dot(faceNormal.xz, fallDirection));
  lavaColor *= 1.0 - vertical * sideFace * 0.18;
  dAlbedo = lavaColor;
}
