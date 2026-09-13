#ifdef PIXELSNAP
uniform vec4 uScreenSize;
#endif
#ifdef SCREENSPACE
uniform float projectionFlipY;
#endif

uniform vec2 uRiverFlowDirection;
uniform float uRiverTime;
uniform float uRiverVertical;
uniform float uRiverLava;

vec3 riverWaterPosition(vec3 localPosition) {
  #ifdef VERTEX_COLOR
    vec3 baseLocalPosition = localPosition;
    float vertexMarker = vertex_color.a;
    float horizontalDepth = clamp(vertex_color.r, 0.0, 1.0);
    float surfaceMask =
      (1.0 - uRiverVertical) * (1.0 - horizontalDepth);
    vec2 flowDirection = normalize(uRiverFlowDirection);
    vec2 crossDirection = vec2(-flowDirection.y, flowDirection.x);
    float alongFlow = dot(localPosition.xz, flowDirection);
    float acrossFlow = dot(localPosition.xz, crossDirection);
    float surfaceWave =
      sin(
        dot(localPosition.xz, vec2(0.78, 0.63)) * 10.5 +
        uRiverTime * 1.65
      ) * 0.025 +
      sin(
        dot(localPosition.xz, vec2(-0.44, 0.9)) * 16.0 -
        uRiverTime * 1.2
      ) * 0.014;
    float directionalFlowWave =
      sin(
        alongFlow * 12.0 -
        uRiverTime * 4.1 +
        sin(acrossFlow * 8.5) * 0.72
      ) * 0.018 +
      sin(alongFlow * 6.2 - uRiverTime * 2.45 + acrossFlow * 2.1) *
      0.009;
    float flowInterior = smoothstep(0.015, 0.3, vertex_color.b);
    float waterSurfaceWave =
      surfaceWave + directionalFlowWave * flowInterior;
    float lavaBaseWave =
      sin(
        dot(localPosition.xz, vec2(0.58, 0.81)) * 4.4 -
        uRiverTime * 0.31
      ) * 0.006;
    float lavaDirectionalWave =
      sin(
        alongFlow * 4.2 -
        uRiverTime * 0.72 +
        sin(acrossFlow * 3.0) * 0.5
      ) * 0.012 +
      sin(
        dot(localPosition.xz, vec2(-0.52, 0.85)) * 5.3 +
        uRiverTime * 0.46
      ) * 0.008;
    float lavaSurfaceWave =
      lavaBaseWave + lavaDirectionalWave * flowInterior;
    float liquidSurfaceWave = mix(
      waterSurfaceWave,
      lavaSurfaceWave,
      uRiverLava
    );
    float waterfallLipSurfaceMask =
      uRiverVertical *
      step(0.9, vertexMarker) *
      (1.0 - smoothstep(0.0, 0.32, vertex_color.b));
    localPosition.y +=
      liquidSurfaceWave *
      (surfaceMask + waterfallLipSurfaceMask);

    float springSource =
      surfaceMask *
      smoothstep(0.015, 0.68, vertex_color.g);
    float springCore =
      surfaceMask *
      smoothstep(0.42, 0.94, vertex_color.g);
    float springRingPhase = (1.0 - vertex_color.g) * 13.0;
    float springUpwelling =
      sin(springRingPhase - uRiverTime * 3.6) * 0.032 +
      sin(
        dot(localPosition.xz, vec2(11.0, -8.0)) +
        uRiverTime * 2.2
      ) * 0.016 +
      sin(uRiverTime * 4.8 + vertex_color.g * 6.0) * 0.01;
    float springCenterHeave =
      0.022 + sin(uRiverTime * 3.15) * 0.018;
    localPosition.y +=
      (springSource * springUpwelling + springCore * springCenterHeave) *
      (1.0 - uRiverLava);

    float waterfallMask =
      uRiverVertical *
      vertexMarker *
      smoothstep(0.28, 0.92, vertex_color.b);
    float flowAge = vertex_color.g + vertex_color.b * 0.075;
    float fallTime = mix(uRiverTime, uRiverTime * 0.34, uRiverLava);
    float forwardSwell =
      sin(
        flowAge * 15.0 -
        fallTime * 3.1 +
        vertex_color.r * 7.0
      ) * 0.032 +
      sin(flowAge * 6.0 - fallTime * 1.35) * 0.017;
    float sidewaysSway = sin(
      flowAge * 9.0 -
      fallTime * 1.6 +
      vertex_color.r * 13.0
    ) * 0.02;
    float fallDisplacement = mix(1.0, 0.42, uRiverLava);
    localPosition.xz +=
      flowDirection * forwardSwell * waterfallMask +
      crossDirection * sidewaysSway * waterfallMask;
    localPosition.xz = mix(
      baseLocalPosition.xz,
      localPosition.xz,
      mix(1.0, fallDisplacement, waterfallMask)
    );
  #endif
  return localPosition;
}

vec4 evalWorldPosition(vec3 vertexPosition, mat4 modelMatrix) {
  vec3 localPos = riverWaterPosition(getLocalPosition(vertexPosition));
  #ifdef NINESLICED
    localPos.xz *= outerScale;
    vec2 positiveUnitOffset = clamp(vertexPosition.xz, vec2(0.0), vec2(1.0));
    vec2 negativeUnitOffset = clamp(-vertexPosition.xz, vec2(0.0), vec2(1.0));
    localPos.xz +=
      (-positiveUnitOffset * innerOffset.xy +
        negativeUnitOffset * innerOffset.zw) *
      vertex_texCoord0.xy;
    vTiledUv =
      (localPos.xz - outerScale + innerOffset.xy) * -0.5 + 1.0;
    localPos.xz *= -0.5;
    localPos = localPos.xzy;
  #endif
  vec4 posW = modelMatrix * vec4(localPos, 1.0);
  #ifdef SCREENSPACE
    posW.zw = vec2(0.0, 1.0);
  #endif
  return posW;
}

vec4 getPosition() {
  dModelMatrix = getModelMatrix();
  vec4 posW = evalWorldPosition(vertex_position.xyz, dModelMatrix);
  dPositionW = posW.xyz;
  vec4 screenPos;
  #ifdef UV1LAYOUT
    screenPos = vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
    #ifdef WEBGPU
      screenPos.y *= -1.0;
    #endif
  #else
    #ifdef SCREENSPACE
      screenPos = posW;
      screenPos.y *= projectionFlipY;
    #else
      screenPos = matrix_viewProjection * posW;
    #endif
    #ifdef PIXELSNAP
      screenPos.xy = (screenPos.xy * 0.5) + 0.5;
      screenPos.xy *= uScreenSize.xy;
      screenPos.xy = floor(screenPos.xy);
      screenPos.xy *= uScreenSize.zw;
      screenPos.xy = (screenPos.xy * 2.0) - 1.0;
    #endif
  #endif
  return screenPos;
}

vec3 getWorldPosition() {
  return dPositionW;
}
