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

vec3 riverWaterPosition(vec3 p) {
  #ifdef VERTEX_COLOR
    vec2 flow = normalize(uRiverFlowDirection);
    vec2 crossFlow = vec2(-flow.y, flow.x);
    // Shared motion at every cell edge and the lip prevents cracks.
    float sharedWave = sin(dot(p.xz, vec2(4.3, 3.1)) - uRiverTime * 1.7) * 0.009;
    float interior = (1.0 - uRiverVertical) * (1.0 - vertex_color.r);
    float lipJoin = uRiverVertical * (1.0 - smoothstep(0.0, 0.32, vertex_color.b));
    // One wave field across the whole river: per-cell wave envelopes create
    // little ridges in reflected light where the flow turns through 90 degrees.
    sharedWave += sin(dot(p.xz, vec2(-2.7, 4.8)) - uRiverTime * 2.1) * 0.006;
    p.y += sharedWave * (interior + lipJoin);
    float fall = uRiverVertical * smoothstep(0.05, 0.9, vertex_color.b);
    float age = vertex_color.g;
    float acrossInterior = sin(vertex_color.r * 3.14159265);
    float wave = sin(-p.y * 3.2 - uRiverTime * 5.4 + vertex_color.r * 9.0);
    p.xz += flow * wave * 0.018 * fall +
      crossFlow * sin(age * 8.0 - uRiverTime * 1.8) * 0.012 * fall * age * acrossInterior;
  #endif
  return p;
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
