uniform float uGrassTime;
uniform float uGrassAmbientMotion;
uniform vec2 uGrassGridOffset;
uniform vec2 uGrassEdgeDirection;
uniform vec4 uGrassFeet[8];
uniform vec4 uGrassFootShapes[8];

varying float vGrassTip;
varying float vGrassVariation;
varying float vGrassCompression;

vec4 getPosition() {
  dModelMatrix = getModelMatrix();
  vec3 root = dModelMatrix[3].xyz;
  vec3 offset = mat3(dModelMatrix) * vertex_position.xyz;
  float height = max(vertex_position.y, 0.0) * length(dModelMatrix[1].xyz);
  float tip = smoothstep(0.0, 0.06, height);
  float contact = 0.0;
  vec2 brushDirection = vec2(0.0);
  vec2 bladePosition = root.xz + offset.xz;
  for (int index = 0; index < 8; index++) {
    vec4 foot = uGrassFeet[index];
    vec4 shape = uGrassFootShapes[index];
    vec2 delta = bladePosition - foot.xz;
    vec2 across = vec2(shape.y, -shape.x);
    vec2 footprint = vec2(dot(delta, across), dot(delta, shape.xy)) /
      max(shape.zw, vec2(0.001));
    float sameLevel = 1.0 - smoothstep(0.075, 0.22, abs(root.y - foot.y));
    float pressure = (1.0 - smoothstep(0.65, 1.5, length(footprint))) *
      sameLevel * foot.w;
    vec2 away = delta / max(length(delta), 0.001);
    brushDirection = mix(brushDirection, away, step(contact, pressure));
    contact = max(contact, pressure);
  }
  // Press the canopy to the sole, spreading the tips while keeping roots fixed.
  // The retained footprints release over time instead of snapping upright.
  float flexible = smoothstep(0.002, 0.025, height);
  offset.xz += brushDirection * contact * flexible * 0.055;
  offset.y *= 1.0 - contact * flexible * 0.96;
  float wind = sin(uGrassTime * 1.4 + root.x * 1.8 + root.z * 1.1);
  offset.xz += vec2(0.8, 0.4) * wind * height * tip * 0.1 *
    uGrassAmbientMotion * (1.0 - contact);
  vGrassTip = clamp(height / 0.06, 0.0, 1.0);
  vGrassVariation = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vGrassCompression = contact;
  dPositionW = root + offset;
  vec2 cellCenter = floor(root.xz + uGrassGridOffset + 0.5) - uGrassGridOffset;
  dPositionW.xz = clamp(dPositionW.xz,
    cellCenter - 0.495 + min(uGrassEdgeDirection, vec2(0.0)) * 0.055,
    cellCenter + 0.495 + max(uGrassEdgeDirection, vec2(0.0)) * 0.055);
  float edge = step(0.5, length(uGrassEdgeDirection));
  dPositionW.y = mix(dPositionW.y, clamp(dPositionW.y, root.y - 0.1, root.y + 0.04), edge);
  return matrix_viewProjection * vec4(dPositionW, 1.0);
}

vec3 getWorldPosition() {
  return dPositionW;
}
