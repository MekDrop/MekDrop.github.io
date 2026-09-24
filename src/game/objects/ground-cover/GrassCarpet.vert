uniform float uGrassTime;
uniform float uGrassAmbientMotion;
uniform float uGrassLodReveal;
uniform vec2 uGrassWindDirection;
uniform float uGrassWindStrength;
uniform vec2 uGrassGridOffset;
uniform vec4 uGrassBoundaryExtension;
uniform vec4 uGrassImpressions[8];
uniform vec4 uGrassImpressionShapes[8];
uniform vec4 uGrassSurfaces[4];
uniform vec4 uGrassSurfaceLoads[4];
uniform sampler2D uGrassObstacleMap;
uniform sampler2D uGrassWindMap;
uniform vec2 uGrassObstacleMapSize;
uniform vec2 uGrassWindMapSize;

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
  float movingContact = 0.0;
  float obstruction = 0.0;
  vec2 brushDirection = vec2(0.0);
  vec2 bladePosition = root.xz + offset.xz;
  for (int index = 0; index < 8; index++) {
    vec4 impression = uGrassImpressions[index];
    vec4 shape = uGrassImpressionShapes[index];
    vec2 delta = bladePosition - impression.xz;
    vec2 across = vec2(shape.y, -shape.x);
    vec2 footprint = vec2(dot(delta, across), dot(delta, shape.xy)) /
      max(shape.zw, vec2(0.001));
    float sameLevel = 1.0 - smoothstep(
      0.075,
      0.22,
      abs(root.y - impression.y)
    );
    float pressure = (1.0 - smoothstep(0.65, 1.5, length(footprint))) *
      sameLevel * impression.w;
    vec2 away = delta / max(length(delta), 0.001);
    brushDirection = mix(brushDirection, away, step(contact, pressure));
    contact = max(contact, pressure);
    movingContact = max(movingContact, pressure);
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
  vec2 windUv = (
    bladePosition + uGrassGridOffset + vec2(0.5)
  ) / uGrassWindMapSize;
  float windExposure = texture2D(uGrassWindMap, windUv).r;
  float obstaclePressure = obstacle.b;
  float obstacleWeight = obstacle.a;
  // Keep the complete scatter and sink only vertices that enter a solid
  // ground-contact voxel. This lets grass reach irregular vegetation edges
  // without showing through trunks or leaving a rectangular empty halo.
  float solidFootprint = step(0.5, obstacleWeight);
  float obstacleContact = obstaclePressure * solidFootprint;
  vec2 obstacleDirection = obstacle.rg * 2.0 - 1.0;
  if (dot(obstacleDirection, obstacleDirection) > 0.0025) {
    obstacleDirection = normalize(obstacleDirection);
    brushDirection = mix(
      brushDirection,
      obstacleDirection,
      step(contact, obstacleContact)
    );
  }
  contact = max(contact, obstacleContact);
  obstruction = max(obstruction, obstacleWeight * solidFootprint);
  // Press the canopy below direct contacts. Static vegetation clips only its
  // occupied ground voxels, leaving the surrounding grass upright and dense.
  float flexible = smoothstep(0.002, 0.025, height);
  // Moving contacts part the standing blades. Keep some height under
  // the contact so the response reads as bent grass rather than a flat decal.
  float sidewaysBend = mix(0.06, 0.11, obstruction) +
    movingContact * (1.0 - obstruction) * 0.075;
  offset.xz += brushDirection * contact * flexible * sidewaysBend;
  offset.y *= 1.0 - contact * flexible *
    mix(0.8, 0.96, obstruction);
  offset.y -= solidFootprint * 0.25;
  vec2 windDirection = normalize(uGrassWindDirection + vec2(0.0001, 0.0));
  vec2 crossWind = vec2(-windDirection.y, windDirection.x);
  float broadWind = sin(
    dot(root.xz, windDirection) * 1.35 -
    uGrassTime * (0.65 + uGrassWindStrength * 1.4)
  );
  float fineWind = sin(
    dot(root.xz, crossWind) * 3.7 + uGrassTime * 2.2
  );
  float windPulse = max(0.0, 0.58 + broadWind * 0.28 + fineWind * 0.14);
  float windBend = height * tip * 0.14 * uGrassWindStrength *
    uGrassAmbientMotion * windPulse * windExposure * (1.0 - contact);
  offset.xz += windDirection * windBend;
  offset.xz += crossWind * fineWind * windBend * 0.18;
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
  // Grow grass clumps from beneath the terrain instead of switching them
  // on together at one zoom value.
  float reveal = smoothstep(vGrassVariation * 0.2, 1.0, uGrassLodReveal);
  dPositionW = mix(vec3(root.x, root.y - 0.03, root.z), dPositionW, reveal);
  return matrix_viewProjection * vec4(dPositionW, 1.0);
}

vec3 getWorldPosition() {
  return dPositionW;
}
