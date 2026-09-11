uniform vec3 material_diffuse;
uniform vec2 uRiverFlowDirection;
uniform float uRiverTime;
uniform float uRiverVertical;

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

float riverSurfaceWave(vec2 position) {
  float firstWave = sin(
    dot(position, vec2(0.82, 0.57)) * 10.2 + uRiverTime * 1.7
  );
  float secondWave = sin(
    dot(position, vec2(-0.38, 0.93)) * 16.4 - uRiverTime * 1.25
  ) * 0.42;
  vec2 rippleCenter = vec2(
    sin(uRiverTime * 0.31),
    cos(uRiverTime * 0.27)
  );
  float crossingRipple = sin(
    length(position * vec2(0.85, 1.1) + rippleCenter) * 7.2 -
    uRiverTime
  ) * 0.18;
  return firstWave + secondWave + crossingRipple;
}

void getAlbedo() {
  vec3 surfaceDerivativeX = dFdx(vPositionW);
  vec3 surfaceDerivativeY = dFdy(vPositionW);
  vec3 geometricNormal = normalize(
    cross(surfaceDerivativeX, surfaceDerivativeY)
  );
  float waterDepth = clamp(vVertexColor.r, 0.0, 1.0);
  float waterVolumeSide =
    (1.0 - uRiverVertical) *
    smoothstep(0.02, 0.18, waterDepth);
  float verticality = smoothstep(
    0.08,
    0.92,
    1.0 - abs(geometricNormal.y)
  );
  verticality *= uRiverVertical;

  vec2 flowDirection = normalize(uRiverFlowDirection);
  vec2 crossDirection = vec2(-flowDirection.y, flowDirection.x);
  float alongFall = -vPositionW.y;
  float acrossFall = dot(vPositionW.xz, crossDirection);
  float waterfallLipSurface =
    uRiverVertical *
    (1.0 - verticality) *
    (1.0 - smoothstep(0.08, 0.72, vVertexColor.b));
  float waterfallFace =
    uRiverVertical * vVertexColor.a * (1.0 - waterfallLipSurface);
  float riverSurface = max(
    (1.0 - uRiverVertical) * (1.0 - waterVolumeSide),
    waterfallLipSurface
  );
  float waterfallAcross = vVertexColor.r;
  float fallProgress = vVertexColor.g;
  float lipProgress = vVertexColor.b;

  float fallingTwist = sin(
    alongFall * 1.7 - uRiverTime * 4.2
  );
  float geometricFallingWave = sin(
    acrossFall * 15.0 + fallingTwist * 1.25
  );
  geometricFallingWave += sin(
    acrossFall * 7.0 - alongFall * 0.55 + uRiverTime * 2.1
  ) * 0.38;

  vec2 broadFlowPosition = vec2(
    waterfallAcross * 3.8 + sin(fallProgress * 7.0) * 0.12,
    fallProgress * 4.2 - uRiverTime * 1.7
  );
  float broadChannel = riverFbm(broadFlowPosition);
  float foldedChannel = sin(
    waterfallAcross * 30.0 +
    broadChannel * 8.5 +
    fallProgress * 5.0 -
    uRiverTime * 2.6
  );
  float fineChannel = sin(
    waterfallAcross * 63.0 -
    fallProgress * 10.0 +
    uRiverTime * 3.4 +
    riverNoise(broadFlowPosition * 1.7) * 6.0
  );
  float stylizedFallingWave =
    (broadChannel - 0.5) * 2.1 +
    foldedChannel * 0.55 +
    fineChannel * 0.18;
  float fallingWave = mix(
    geometricFallingWave,
    stylizedFallingWave,
    waterfallFace
  );

  float surfaceWave = riverSurfaceWave(vPositionW.xz);
  float alongSurfaceFlow = dot(vPositionW.xz, flowDirection);
  float acrossSurfaceFlow = dot(vPositionW.xz, crossDirection);
  float directionalFlowWave =
    sin(
      alongSurfaceFlow * 7.4 -
      uRiverTime * 4.0 +
      sin(acrossSurfaceFlow * 5.2) * 0.58
    ) * 0.68 +
    sin(
      alongSurfaceFlow * 13.6 -
      uRiverTime * 6.1 -
      acrossSurfaceFlow * 2.4
    ) * 0.32;
  float directionalFlowTone = clamp(
    directionalFlowWave * 0.5 + 0.5,
    0.0,
    1.0
  );
  directionalFlowTone =
    floor(directionalFlowTone * 3.999) / 3.0;
  float brokenWave = mix(surfaceWave, fallingWave, verticality);
  brokenWave +=
    (riverHash(floor(vPositionW.xz * 8.0)) - 0.5) *
    mix(0.05, 0.2, verticality);

  vec3 deepWater = vec3(0.025, 0.3, 0.58);
  vec3 clearWater = vec3(0.035, 0.53, 0.8);
  vec3 brightWater = vec3(0.2, 0.74, 0.94);
  float fallingWaterTone = clamp(brokenWave * 0.24 + 0.5, 0.0, 1.0);
  float surfaceWaterTone = clamp(
    0.52 + surfaceWave * 0.055,
    0.34,
    0.7
  );
  float waterTone = mix(
    fallingWaterTone,
    surfaceWaterTone,
    riverSurface
  );
  float celTone = mix(
    waterTone,
    floor(waterTone * 5.0) / 4.0,
    0.34
  );
  vec3 waterColor = mix(deepWater, clearWater, celTone);
  waterColor = mix(
    waterColor,
    brightWater,
    smoothstep(0.74, 0.94, waterTone)
  );

  float horizontalFlowMask =
    (1.0 - uRiverVertical) *
    (1.0 - waterVolumeSide);
  float movingFlowColor = riverFbm(vec2(
    acrossSurfaceFlow * 2.8 + 8.4,
    alongSurfaceFlow * 1.45 - uRiverTime * 1.15
  ));
  float horizontalFlowColor = clamp(
    directionalFlowTone * 0.52 + movingFlowColor * 0.58 - 0.05,
    0.0,
    1.0
  );
  horizontalFlowColor =
    floor(horizontalFlowColor * 3.999) / 3.0;
  float surfaceFoam = 0.0;
  float springSource =
    horizontalFlowMask *
    smoothstep(0.015, 0.22, vVertexColor.g);
  float springSwell =
    horizontalFlowMask *
    smoothstep(0.32, 0.9, vVertexColor.g);
  vec2 sourceFoamPosition =
    vPositionW.xz * 8.2 - flowDirection * uRiverTime * 1.7;
  float sourceFoamCells = riverFbm(sourceFoamPosition);
  float sourceFoamBreak = riverNoise(
    sourceFoamPosition * 2.65 + vec2(13.7, 4.9)
  );
  float sourceFoamFlecks = riverNoise(
    sourceFoamPosition * 4.8 - vec2(7.1, 19.3)
  );
  float springFoam =
    smoothstep(0.56, 0.74, sourceFoamCells) *
    (0.12 + smoothstep(0.35, 0.62, sourceFoamBreak) * 0.16);
  springFoam +=
    smoothstep(0.74, 0.91, sourceFoamFlecks) * 0.07;
  springFoam = min(0.25, springFoam);
  springFoam *= springSource * (0.58 + springSwell * 0.42);
  float cascadeImpact =
    (1.0 - uRiverVertical) *
    smoothstep(0.65, 0.95, vVertexColor.b);
  float cascadePulse = 0.86 + sin(
    dot(vPositionW.xz, vec2(9.0, -7.0)) - uRiverTime * 2.4
  ) * 0.08;

  float broadStreak = smoothstep(0.58, 0.78, broadChannel);
  float foldedStreak = smoothstep(0.63, 0.91, foldedChannel);
  float fineStreak = smoothstep(0.84, 0.97, fineChannel);
  float crestFoam =
    smoothstep(0.58, 0.96, lipProgress) *
    (1.0 - smoothstep(0.04, 0.19, fallProgress));
  float bottomChurn =
    smoothstep(0.7, 1.0, fallProgress) *
    smoothstep(
      0.36,
      0.72,
      riverFbm(vec2(
        waterfallAcross * 6.0,
        fallProgress * 5.0 - uRiverTime * 2.2
      ))
    );
  float waterfallFoam = clamp(
    broadStreak * 0.38 +
    foldedStreak * 0.28 +
    fineStreak * 0.18 +
    crestFoam * 0.5 +
    bottomChurn * 0.42,
    0.0,
    0.72
  );
  waterfallFoam *= waterfallFace;

  float geometricFoam = step(
    0.68,
    sin(acrossFall * 22.0 + fallingTwist)
  ) * 0.52;
  float fallingFoam = mix(
    geometricFoam,
    waterfallFoam,
    waterfallFace
  );
  float foam = max(
    mix(surfaceFoam, fallingFoam, verticality),
    cascadeImpact * cascadePulse
  );
  float curvedShade = mix(
    1.0,
    0.78 +
      max(dot(geometricNormal, normalize(vec3(-0.45, 0.72, 0.36))), 0.0) *
      0.22,
    verticality
  );
  waterColor *= curvedShade;
  waterColor = mix(
    waterColor * 0.76,
    mix(waterColor, brightWater, 0.16),
    riverSurface
  );
  waterColor = mix(
    waterColor,
    clearWater,
    uRiverVertical * 0.12
  );
  waterColor = mix(
    waterColor,
    mix(
      mix(deepWater, clearWater, 0.35),
      brightWater,
      horizontalFlowColor * 0.9
    ),
    horizontalFlowMask * 0.68
  );
  float sideVariation = riverFbm(vec2(
    dot(vPositionW.xz, flowDirection) * 2.4 - uRiverTime * 0.22,
    vPositionW.y * 3.2
  ));
  vec3 volumeColor = mix(clearWater, deepWater, waterDepth * 0.82);
  float bedPattern = riverFbm(vPositionW.xz * 5.2 + vec2(3.7, 11.4));
  vec3 darkRiverBed = vec3(0.12, 0.16, 0.14);
  vec3 lightRiverBed = vec3(0.27, 0.24, 0.16);
  vec3 riverBedColor = mix(darkRiverBed, lightRiverBed, bedPattern);
  volumeColor = mix(
    volumeColor,
    riverBedColor,
    smoothstep(0.68, 1.0, waterDepth) * 0.48
  );
  float sourceBedMarker =
    (1.0 - uRiverVertical) *
    waterDepth *
    smoothstep(0.04, 0.88, vVertexColor.g);
  float sourceBedNoise = riverFbm(
    vPositionW.xz * 7.1 +
    vec2(uRiverTime * 0.16, -uRiverTime * 0.12)
  );
  float sourceBedPulse =
    0.72 + sin(uRiverTime * 3.4 + sourceBedNoise * 5.0) * 0.12;
  vec3 sourceUpwellingColor = vec3(0.025, 0.62, 0.75);
  volumeColor = mix(
    volumeColor,
    sourceUpwellingColor,
    sourceBedMarker * sourceBedPulse * (0.64 + sourceBedNoise * 0.22)
  );
  volumeColor = mix(
    volumeColor,
    brightWater,
    smoothstep(0.82, 0.98, sideVariation) * 0.12
  );
  waterColor = mix(waterColor, volumeColor, waterVolumeSide * 0.9);
  float sourceSurfaceNoise = riverFbm(
    vPositionW.xz * 8.3 +
    vec2(-uRiverTime * 0.2, uRiverTime * 0.17)
  );
  float springPulse =
    0.62 +
    sourceSurfaceNoise * 0.18 +
    sin(uRiverTime * 2.7 + sourceSurfaceNoise * 4.5) * 0.1;
  vec3 sourceSurfaceColor = mix(
    vec3(0.025, 0.56, 0.7),
    vec3(0.055, 0.76, 0.85),
    sourceSurfaceNoise
  );
  waterColor = mix(
    waterColor,
    sourceSurfaceColor,
    springSwell * springPulse
  );
  vec3 viewDirection = normalize(view_position - vPositionW);
  float fresnel = pow(
    1.0 - abs(dot(geometricNormal, viewDirection)),
    2.0
  );
  waterColor = mix(
    waterColor,
    vec3(0.25, 0.7, 0.9),
    fresnel * mix(0.24, 0.12, verticality)
  );
  dAlbedo = mix(waterColor, vec3(0.62, 0.88, 0.98), foam);
  dAlbedo = mix(
    dAlbedo,
    sourceSurfaceColor,
    springSwell * (0.48 + sourceSurfaceNoise * 0.12)
  );
  dAlbedo = mix(
    dAlbedo,
    vec3(0.62, 0.9, 0.95),
    springFoam * 1.1
  );
}
