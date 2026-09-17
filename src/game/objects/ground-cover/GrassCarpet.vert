uniform float uGrassTime;
uniform float uGrassAmbientMotion;
uniform vec2 uGrassGridOffset;
uniform vec4 uGrassBoundaryExtension;
uniform vec4 uGrassFeet[8];
uniform vec4 uGrassFootShapes[8];
uniform vec4 uGrassSurfaces[4];
uniform vec4 uGrassSurfaceLoads[4];
uniform sampler2D uGrassObstacleMap;
uniform vec2 uGrassObstacleMapSize;

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
  float obstruction = 0.0;
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
  for (int index = 0; index < 4; index++) {
    vec4 surface = uGrassSurfaces[index];
    vec4 load = uGrassSurfaceLoads[index];
    vec2 delta = bladePosition - surface.xz;
    float radius = max(surface.w, 0.001);
    float within = 1.0 - smoothstep(
      max(radius - 0.03, 0.0),
      radius,
      length(delta)
    );
    float sameLevel = 1.0 - smoothstep(0.075, 0.22, abs(root.y - surface.y));
    float compression = max(0.0, load.x + dot(delta, load.yz));
    float pressure = clamp(compression / 0.075, 0.0, 1.0) *
      within * sameLevel * load.w;
    vec2 away = delta / max(length(delta), 0.001);
    brushDirection = mix(brushDirection, away, step(contact, pressure));
    contact = max(contact, pressure);
    obstruction = max(obstruction, pressure);
  }
  vec2 obstacleUv = (
    bladePosition + uGrassGridOffset + vec2(0.5)
  ) / uGrassObstacleMapSize;
  vec4 obstacle = texture2D(uGrassObstacleMap, obstacleUv);
  float obstaclePressure = obstacle.b;
  float obstacleWeight = obstacle.a;
  vec2 obstacleDirection = obstacle.rg * 2.0 - 1.0;
  if (dot(obstacleDirection, obstacleDirection) > 0.0025) {
    obstacleDirection = normalize(obstacleDirection);
    brushDirection = mix(
      brushDirection,
      obstacleDirection,
      step(contact, obstaclePressure)
    );
  }
  contact = max(contact, obstaclePressure);
  obstruction = max(obstruction, obstacleWeight);
  // Press the canopy below contacts while spreading edge tips sideways. Static
  // surfaces bend farther than a boot, so their boundary stays grass-free.
  float flexible = smoothstep(0.002, 0.025, height);
  offset.xz += brushDirection * contact * flexible *
    mix(0.06, 0.11, obstruction);
  offset.y *= 1.0 - contact * flexible * 0.96;
  float wind = sin(uGrassTime * 1.4 + root.x * 1.8 + root.z * 1.1);
  offset.xz += vec2(0.8, 0.4) * wind * height * tip * 0.1 *
    uGrassAmbientMotion * (1.0 - contact);
  vGrassTip = clamp(height / 0.06, 0.0, 1.0);
  vGrassVariation = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vGrassCompression = contact;
  dPositionW = root + offset;
  vec2 cellCenter = floor(root.xz + uGrassGridOffset + 0.5) - uGrassGridOffset;
  // Smoothly curl outward vertices back toward the edge. Unlike clamp(),
  // this retains each tapered tip instead of piling them onto a flat plane.
  // Slightly different reach per clump prevents a ruler-straight silhouette.
  float reachVariation = mix(0.45, 1.0, vGrassVariation);
  vec4 edgeReach = uGrassBoundaryExtension * mix(vec4(reachVariation), vec4(1.0),
    step(vec4(0.2), uGrassBoundaryExtension));
  vec2 lower = cellCenter - 0.5 - edgeReach.xy;
  vec2 upper = cellCenter + 0.5 + edgeReach.zw;
  vec2 lowBend = max(vec2(0.0), lower + 0.025 - dPositionW.xz);
  vec2 highBend = max(vec2(0.0), dPositionW.xz - upper + 0.025);
  dPositionW.xz += lowBend - 0.025 * (1.0 - exp(-lowBend / 0.025));
  dPositionW.xz -= highBend - 0.025 * (1.0 - exp(-highBend / 0.025));
  // A little droop only beyond exposed terrain, never at internal lawn seams.
  vec2 relative = dPositionW.xz - cellCenter;
  vec2 overhang = abs(relative) - 0.5;
  vec2 reach = mix(edgeReach.xy, edgeReach.zw, step(vec2(0.0), relative));
  vec2 edgeDroop = smoothstep(vec2(0.0), vec2(0.06), overhang) * (1.0 - step(vec2(0.2), reach));
  dPositionW.y -= max(edgeDroop.x, edgeDroop.y) * tip * 0.018;
  return matrix_viewProjection * vec4(dPositionW, 1.0);
}

vec3 getWorldPosition() {
  return dPositionW;
}
