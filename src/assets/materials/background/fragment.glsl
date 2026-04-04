precision highp float;

#define MAX_MINIONS 10
#define MAX_PROJECTILES 12
#define MAX_IMPACTS 8

const float PI = 3.14159265;
const float NEAR_CLIP = 0.05;
const float FAR_FADE = 150.0;

uniform vec2 uResolution;
uniform vec4 uGameViewport;
uniform float uTime;
uniform float uPixelScale;
uniform vec3 uCameraPos;
uniform float uCameraYaw;
uniform float uCameraPitch;
uniform float uFov;
uniform float uArenaHalfWidth;
uniform float uArenaFloorY;
uniform float uArenaCeilingY;
uniform float uArenaDepthNear;
uniform float uArenaDepthFar;
uniform vec3 uPlayerPos;
uniform vec3 uPlayerVelocity;
uniform float uPlayerHealthNorm;
uniform float uPlayerWeapon;
uniform float uPlayerGrappleActive;
uniform vec3 uPlayerGrapplePoint;
uniform float uPlayerSwordSwing;
uniform vec3 uBossPos;
uniform float uBossHealthNorm;
uniform float uBossLookUp;
uniform float uBossSummonPulse;
uniform float uBossAlive;
uniform float uScanOriginZ;
uniform float uScanDistance;
uniform float uScanWidth;
uniform float uScanIntensity;
uniform vec4 uMinions[MAX_MINIONS];
uniform vec4 uMinionMeta[MAX_MINIONS];
uniform float uMinionCount;
uniform vec4 uProjectiles[MAX_PROJECTILES];
uniform vec4 uProjectileMeta[MAX_PROJECTILES];
uniform float uProjectileCount;
uniform vec4 uImpacts[MAX_IMPACTS];
uniform float uImpactStrength[MAX_IMPACTS];
uniform float uImpactCount;

struct SurfaceHit {
  float t;
  vec3 pos;
  float kind;
};

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float invSmoothstep(float edge0, float edge1, float value) {
  return 1.0 - smoothstep(edge0, edge1, value);
}

float segmentDistance(vec2 point, vec2 a, vec2 b) {
  vec2 ap = point - a;
  vec2 ab = b - a;
  float t = clamp(dot(ap, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(ap - ab * t);
}

float lineSegment(vec2 point, vec2 a, vec2 b, float width) {
  return invSmoothstep(0.0, width, segmentDistance(point, a, b));
}

float rectBorder(vec2 point, vec2 center, vec2 halfSize, float width) {
  vec2 local = abs(point - center);
  vec2 outer = step(local, halfSize);
  vec2 inner = step(local, max(halfSize - vec2(width), vec2(0.0)));
  return max(0.0, outer.x * outer.y - inner.x * inner.y);
}

float circleWire(vec2 point, vec2 center, float radius, float width) {
  return invSmoothstep(0.0, width, abs(length(point - center) - radius));
}

float periodicLineWorld(float coord, float spacing, float width) {
  float local = abs(mod(coord + spacing * 0.5, spacing) - spacing * 0.5);
  float aa = width + fwidth(coord) * 1.35;
  return 1.0 - smoothstep(aa, aa * 2.0, local);
}

vec3 phosphor(float value) {
  return vec3(0.18, 0.80, 1.00) * value;
}

vec3 phosphorDim(float value) {
  return vec3(0.03, 0.14, 0.32) * value;
}

vec3 ember(float value) {
  return vec3(0.36, 0.92, 1.00) * value;
}

mat3 cameraBasis() {
  float sy = sin(uCameraYaw);
  float cy = cos(uCameraYaw);
  float sp = sin(uCameraPitch);
  float cp = cos(uCameraPitch);
  vec3 forward = normalize(vec3(sy * cp, sp, cy * cp));
  vec3 right = normalize(vec3(cy, 0.0, -sy));
  vec3 up = normalize(cross(right, forward));
  return mat3(right, up, forward);
}

vec3 worldToCamera(vec3 world, mat3 basis) {
  return transpose(basis) * (world - uCameraPos);
}

vec3 viewRay(vec2 point, mat3 basis, float aspect) {
  float scale = tan(uFov * 0.5);
  vec3 view = normalize(vec3(point.x * aspect * scale, point.y * scale, 1.0));
  return normalize(basis * view);
}

bool clipNearSegment(inout vec3 a, inout vec3 b) {
  if (a.z <= NEAR_CLIP && b.z <= NEAR_CLIP) {
    return false;
  }

  if (a.z < NEAR_CLIP || b.z < NEAR_CLIP) {
    vec3 originalA = a;
    vec3 originalB = b;
    float denominator = originalB.z - originalA.z;
    float safeDenominator = abs(denominator) < 0.0001 ? sign(denominator + 0.0001) * 0.0001 : denominator;
    float t = (NEAR_CLIP - originalA.z) / safeDenominator;
    vec3 clipped = mix(originalA, originalB, clamp(t, 0.0, 1.0));
    if (originalA.z < NEAR_CLIP) {
      a = clipped;
    } else {
      b = clipped;
    }
  }

  return true;
}

vec2 projectCameraPoint(vec3 point, float aspect) {
  float scale = 1.0 / tan(uFov * 0.5);
  float depth = max(point.z, NEAR_CLIP);
  return vec2(point.x * scale / (depth * aspect), point.y * scale / depth);
}

float depthFade(float depth) {
  return saturate(1.0 - depth / FAR_FADE);
}

float projectedSegment(
  vec2 point,
  vec3 aWorld,
  vec3 bWorld,
  float width,
  float gain,
  mat3 basis,
  float aspect
) {
  vec3 a = worldToCamera(aWorld, basis);
  vec3 b = worldToCamera(bWorld, basis);
  if (!clipNearSegment(a, b)) {
    return 0.0;
  }

  vec2 pa = projectCameraPoint(a, aspect);
  vec2 pb = projectCameraPoint(b, aspect);
  float perspective = 1.0 / (0.75 + min(a.z, b.z) * 0.06);
  float beam = lineSegment(point, pa, pb, width * perspective);
  return beam * gain * depthFade(0.5 * (a.z + b.z));
}

float billboardDiamond(
  vec2 point,
  vec3 center,
  float radiusX,
  float radiusY,
  float width,
  float gain,
  mat3 basis,
  float aspect
) {
  vec3 right = basis[0];
  vec3 up = basis[1];
  vec3 top = center + up * radiusY;
  vec3 bottom = center - up * radiusY;
  vec3 left = center - right * radiusX;
  vec3 rightPoint = center + right * radiusX;
  float shape = 0.0;
  shape += projectedSegment(point, top, rightPoint, width, gain, basis, aspect);
  shape += projectedSegment(point, rightPoint, bottom, width, gain, basis, aspect);
  shape += projectedSegment(point, bottom, left, width, gain, basis, aspect);
  shape += projectedSegment(point, left, top, width, gain, basis, aspect);
  return shape;
}

float billboardFrame(
  vec2 point,
  vec3 center,
  vec2 halfSize,
  float width,
  float gain,
  mat3 basis,
  float aspect
) {
  vec3 right = basis[0];
  vec3 up = basis[1];
  vec3 lt = center + right * -halfSize.x + up * halfSize.y;
  vec3 rt = center + right * halfSize.x + up * halfSize.y;
  vec3 lb = center + right * -halfSize.x - up * halfSize.y;
  vec3 rb = center + right * halfSize.x - up * halfSize.y;
  float shape = 0.0;
  shape += projectedSegment(point, lt, rt, width, gain, basis, aspect);
  shape += projectedSegment(point, rt, rb, width, gain, basis, aspect);
  shape += projectedSegment(point, rb, lb, width, gain, basis, aspect);
  shape += projectedSegment(point, lb, lt, width, gain, basis, aspect);
  return shape;
}

float billboardRing(
  vec2 point,
  vec3 center,
  float radiusX,
  float radiusY,
  float width,
  float gain,
  mat3 basis,
  float aspect
) {
  vec3 right = basis[0];
  vec3 up = basis[1];
  float ring = 0.0;
  vec3 previous = center + right * radiusX;

  for (int i = 1; i <= 8; i++) {
    float angle = float(i) / 8.0 * PI * 2.0;
    vec3 current = center + right * cos(angle) * radiusX + up * sin(angle) * radiusY;
    ring += projectedSegment(point, previous, current, width, gain, basis, aspect);
    previous = current;
  }

  return ring;
}

float boxWire(
  vec2 point,
  vec3 center,
  vec3 halfSize,
  float width,
  float gain,
  mat3 basis,
  float aspect
) {
  vec3 p000 = center + vec3(-halfSize.x, -halfSize.y, -halfSize.z);
  vec3 p001 = center + vec3(-halfSize.x, -halfSize.y, halfSize.z);
  vec3 p010 = center + vec3(-halfSize.x, halfSize.y, -halfSize.z);
  vec3 p011 = center + vec3(-halfSize.x, halfSize.y, halfSize.z);
  vec3 p100 = center + vec3(halfSize.x, -halfSize.y, -halfSize.z);
  vec3 p101 = center + vec3(halfSize.x, -halfSize.y, halfSize.z);
  vec3 p110 = center + vec3(halfSize.x, halfSize.y, -halfSize.z);
  vec3 p111 = center + vec3(halfSize.x, halfSize.y, halfSize.z);
  float shape = 0.0;
  shape += projectedSegment(point, p000, p001, width, gain, basis, aspect);
  shape += projectedSegment(point, p001, p011, width, gain, basis, aspect);
  shape += projectedSegment(point, p011, p010, width, gain, basis, aspect);
  shape += projectedSegment(point, p010, p000, width, gain, basis, aspect);
  shape += projectedSegment(point, p100, p101, width, gain, basis, aspect);
  shape += projectedSegment(point, p101, p111, width, gain, basis, aspect);
  shape += projectedSegment(point, p111, p110, width, gain, basis, aspect);
  shape += projectedSegment(point, p110, p100, width, gain, basis, aspect);
  shape += projectedSegment(point, p000, p100, width, gain, basis, aspect);
  shape += projectedSegment(point, p001, p101, width, gain, basis, aspect);
  shape += projectedSegment(point, p010, p110, width, gain, basis, aspect);
  shape += projectedSegment(point, p011, p111, width, gain, basis, aspect);
  return shape;
}

SurfaceHit raycastCorridor(vec3 origin, vec3 ray) {
  SurfaceHit hit;
  hit.t = 9999.0;
  hit.pos = origin;
  hit.kind = -1.0;

  float startZ = uArenaDepthNear;
  float endZ = uArenaDepthFar;

  if (abs(ray.x) > 0.0001) {
    float leftT = (-uArenaHalfWidth - origin.x) / ray.x;
    vec3 leftPos = origin + ray * leftT;
    if (
      leftT > 0.0 &&
      leftPos.y >= uArenaFloorY &&
      leftPos.y <= uArenaCeilingY &&
      leftPos.z >= startZ &&
      leftPos.z <= endZ &&
      leftT < hit.t
    ) {
      hit.t = leftT;
      hit.pos = leftPos;
      hit.kind = 0.0;
    }

    float rightT = (uArenaHalfWidth - origin.x) / ray.x;
    vec3 rightPos = origin + ray * rightT;
    if (
      rightT > 0.0 &&
      rightPos.y >= uArenaFloorY &&
      rightPos.y <= uArenaCeilingY &&
      rightPos.z >= startZ &&
      rightPos.z <= endZ &&
      rightT < hit.t
    ) {
      hit.t = rightT;
      hit.pos = rightPos;
      hit.kind = 1.0;
    }
  }

  if (abs(ray.y) > 0.0001) {
    float floorT = (uArenaFloorY - origin.y) / ray.y;
    vec3 floorPos = origin + ray * floorT;
    if (
      floorT > 0.0 &&
      abs(floorPos.x) <= uArenaHalfWidth &&
      floorPos.z >= startZ &&
      floorPos.z <= endZ &&
      floorT < hit.t
    ) {
      hit.t = floorT;
      hit.pos = floorPos;
      hit.kind = 2.0;
    }

    float ceilingT = (uArenaCeilingY - origin.y) / ray.y;
    vec3 ceilingPos = origin + ray * ceilingT;
    if (
      ceilingT > 0.0 &&
      abs(ceilingPos.x) <= uArenaHalfWidth &&
      ceilingPos.z >= startZ &&
      ceilingPos.z <= endZ &&
      ceilingT < hit.t
    ) {
      hit.t = ceilingT;
      hit.pos = ceilingPos;
      hit.kind = 3.0;
    }
  }

  if (abs(ray.z) > 0.0001) {
    float nearWallT = (startZ - origin.z) / ray.z;
    vec3 nearWallPos = origin + ray * nearWallT;
    if (
      nearWallT > 0.0 &&
      abs(nearWallPos.x) <= uArenaHalfWidth &&
      nearWallPos.y >= uArenaFloorY &&
      nearWallPos.y <= uArenaCeilingY &&
      nearWallT < hit.t
    ) {
      hit.t = nearWallT;
      hit.pos = nearWallPos;
      hit.kind = 4.0;
    }

    float farWallT = (endZ - origin.z) / ray.z;
    vec3 farWallPos = origin + ray * farWallT;
    if (
      farWallT > 0.0 &&
      abs(farWallPos.x) <= uArenaHalfWidth &&
      farWallPos.y >= uArenaFloorY &&
      farWallPos.y <= uArenaCeilingY &&
      farWallT < hit.t
    ) {
      hit.t = farWallT;
      hit.pos = farWallPos;
      hit.kind = 5.0;
    }
  }

  return hit;
}

vec3 corridorSurfaceColor(SurfaceHit hit) {
  if (hit.kind < -0.5) {
    return vec3(0.0);
  }

  float baseFade = depthFade(hit.t);
  float scanCenter = uScanOriginZ + uScanDistance;
  float scanPulse = exp(-abs(hit.pos.z - scanCenter) / max(uScanWidth, 0.001));
  float sideVoid = smoothstep(uArenaHalfWidth * 0.34, uArenaHalfWidth * 0.88, abs(hit.pos.x));
  float deepVoid = smoothstep(uArenaDepthNear + 44.0, uArenaDepthFar - 8.0, hit.pos.z);
  float lines = 0.0;

  if (hit.kind < 2.0) {
    lines = max(lines, periodicLineWorld(hit.pos.z, 8.0, 0.050));
    lines = max(lines, periodicLineWorld(hit.pos.y - 0.75, 1.20, 0.032) * 0.72);
    lines = max(lines, periodicLineWorld(hit.pos.y - 4.8, 2.40, 0.030) * 0.30);
    lines = max(lines, periodicLineWorld(hit.pos.z + hit.pos.y * 2.2, 18.0, 0.090) * 0.18);
    lines *= mix(1.0, 0.22, max(sideVoid * 0.88, deepVoid * 0.55));
  } else if (hit.kind < 4.0) {
    lines = max(lines, periodicLineWorld(hit.pos.x, 2.15, 0.035));
    lines = max(lines, periodicLineWorld(hit.pos.z, 8.0, 0.055) * 0.90);
    lines = max(lines, periodicLineWorld(hit.pos.x + hit.pos.z * 0.18, 11.5, 0.090) * 0.22);
    lines = max(lines, periodicLineWorld(hit.pos.x, uArenaHalfWidth * 1.35, 0.045) * 0.25);
    lines *= mix(1.0, 0.34, sideVoid * 0.82 + deepVoid * 0.28);
  } else {
    lines = max(lines, periodicLineWorld(hit.pos.x, 2.15, 0.038));
    lines = max(lines, periodicLineWorld(hit.pos.y - 0.6, 1.25, 0.032) * 0.85);
    lines = max(lines, periodicLineWorld(hit.pos.x + hit.pos.y * 1.8, 12.0, 0.090) * 0.18);
    lines *= mix(1.0, 0.30, sideVoid * 0.75 + deepVoid * 0.24);
  }

  float flicker = 0.92 + 0.08 * sin(uTime * 17.0 + hit.pos.z * 0.07 + hit.pos.x * 0.11);
  float voidFade = 1.0 - max(sideVoid * 0.60, deepVoid * 0.35);
  vec3 color = phosphorDim(lines * (0.34 + baseFade * 0.26) * flicker * voidFade);
  color += phosphor(0.09 * lines * baseFade * flicker * voidFade);
  color += phosphor(0.14 * scanPulse * uScanIntensity * baseFade * mix(1.0, 0.55, sideVoid));
  return color;
}

vec3 drawViewportFrame(vec2 point) {
  vec3 color = vec3(0.0);
  color += phosphor(0.58) * rectBorder(point, vec2(0.0), vec2(0.965, 0.925), 0.0026);
  color += phosphorDim(0.70) * rectBorder(point, vec2(0.0), vec2(0.915, 0.875), 0.0016);
  color += phosphor(0.42) * rectBorder(point, vec2(-0.67, 0.86), vec2(0.30, 0.05), 0.0016);
  color += phosphor(0.42) * rectBorder(point, vec2(0.52, 0.86), vec2(0.24, 0.05), 0.0016);
  color += phosphor(0.38) * rectBorder(point, vec2(0.86, 0.86), vec2(0.11, 0.05), 0.0016);
  color += phosphorDim(0.36) * lineSegment(point, vec2(-0.30, 0.86), vec2(0.23, 0.86), 0.0012);
  color += phosphorDim(0.28) * lineSegment(point, vec2(-0.96, 0.76), vec2(0.96, 0.76), 0.0013);
  color += phosphorDim(0.18) * lineSegment(point, vec2(-0.96, -0.76), vec2(0.96, -0.76), 0.0012);
  color += phosphor(0.62) * lineSegment(point, vec2(-0.03, 0.88), vec2(0.13, 0.88), 0.0090);
  return color;
}

vec3 drawCorridorArchitecture(vec2 point, mat3 basis, float aspect) {
  vec3 color = vec3(0.0);
  float nearZ = max(uArenaDepthNear, uPlayerPos.z - 8.0);
  float farZ = uArenaDepthFar;
  float floorY = uArenaFloorY + 0.04;
  float ceilingY = uArenaCeilingY - 0.22;

  for (int lane = 0; lane < 7; lane++) {
    float x = -2.4 + float(lane) * 0.8;
    float centerBias = 1.0 - smoothstep(0.0, 3.1, abs(float(lane) - 3.0));
    float gain = mix(0.14, 0.54, centerBias);
    color += phosphorDim(0.42 * gain) * projectedSegment(
      point,
      vec3(x, floorY, nearZ),
      vec3(x, floorY, farZ),
      0.0017,
      1.0,
      basis,
      aspect
    );
  }

  color += phosphorDim(0.12) * projectedSegment(
    point,
    vec3(0.0, floorY, nearZ),
    vec3(0.0, ceilingY, farZ),
    0.0014,
    1.0,
    basis,
    aspect
  );

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    color += phosphorDim(0.18) * projectedSegment(point, vec3(side * 3.7, floorY, nearZ), vec3(side * 3.7, floorY, farZ), 0.0015, 1.0, basis, aspect);
    color += phosphorDim(0.16) * projectedSegment(point, vec3(side * 4.9, 0.82, nearZ), vec3(side * 4.9, 0.82, farZ), 0.0015, 1.0, basis, aspect);
    color += phosphorDim(0.10) * projectedSegment(point, vec3(side * 6.2, 2.15, nearZ), vec3(side * 6.2, 2.15, farZ), 0.0015, 1.0, basis, aspect);
    color += phosphorDim(0.07) * projectedSegment(point, vec3(side * 7.45, 5.25, nearZ), vec3(side * 7.45, 5.25, farZ), 0.0014, 1.0, basis, aspect);
    color += phosphorDim(0.10) * projectedSegment(point, vec3(side * 5.55, ceilingY, nearZ), vec3(side * 5.55, ceilingY, farZ), 0.0015, 1.0, basis, aspect);
  }

  for (int rib = 0; rib < 14; rib++) {
    float z = nearZ + float(rib) * 9.5;
    if (z > farZ) {
      break;
    }
    if (rib > 2 && mod(float(rib), 2.0) > 0.5) {
      continue;
    }

    vec3 l0 = vec3(-2.9, floorY, z);
    vec3 l1 = vec3(-4.6, 0.92, z);
    vec3 l2 = vec3(-6.15, 2.25, z);
    vec3 l3 = vec3(-7.4, 5.2, z);
    vec3 l4 = vec3(-5.45, ceilingY, z);
    vec3 r0 = vec3(2.9, floorY, z);
    vec3 r1 = vec3(4.6, 0.92, z);
    vec3 r2 = vec3(6.15, 2.25, z);
    vec3 r3 = vec3(7.4, 5.2, z);
    vec3 r4 = vec3(5.45, ceilingY, z);

    float ribShape = 0.0;
    ribShape += projectedSegment(point, l0, l1, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, l1, l2, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, l2, l3, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, l3, l4, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, l4, r4, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, r4, r3, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, r3, r2, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, r2, r1, 0.0019, 1.0, basis, aspect);
    ribShape += projectedSegment(point, r1, r0, 0.0019, 1.0, basis, aspect);
    color += phosphorDim(z < nearZ + 24.0 ? 0.34 : 0.18) * ribShape;
  }

  for (int module = 0; module < 6; module++) {
    float z = nearZ + 12.0 + float(module) * 20.0;
    if (z > farZ) {
      break;
    }

    color += phosphor(0.16) * boxWire(point, vec3(0.0, ceilingY - 0.35, z), vec3(1.2, 0.14, 1.4), 0.0016, 1.0, basis, aspect);
    if (mod(float(module), 2.0) < 0.5) {
      color += phosphorDim(0.10) * boxWire(point, vec3(-6.4, 1.25, z), vec3(1.15, 0.78, 2.3), 0.0013, 1.0, basis, aspect);
    } else {
      color += phosphorDim(0.10) * boxWire(point, vec3(6.4, 1.25, z), vec3(1.15, 0.78, 2.3), 0.0013, 1.0, basis, aspect);
    }
  }

  for (int bay = 0; bay < 4; bay++) {
    float z = nearZ + 16.0 + float(bay) * 24.0;
    if (z > farZ) {
      break;
    }

    float side = mod(float(bay), 2.0) < 0.5 ? -1.0 : 1.0;
    color += phosphor(0.10) * boxWire(point, vec3(side * 8.25, 2.95, z), vec3(0.68, 1.58, 2.55), 0.0015, 1.0, basis, aspect);
    color += phosphorDim(0.08) * boxWire(point, vec3(side * 7.05, 1.1, z), vec3(1.45, 0.58, 2.85), 0.0012, 1.0, basis, aspect);
  }

  for (int pocket = 0; pocket < 5; pocket++) {
    float z = nearZ + 10.0 + float(pocket) * 26.0;
    if (z > farZ) {
      break;
    }

    float side = mod(float(pocket), 2.0) < 0.5 ? -1.0 : 1.0;
    color += phosphorDim(0.06) * boxWire(point, vec3(side * 8.7, 3.8, z), vec3(0.95, 1.75, 1.85), 0.0011, 1.0, basis, aspect);
    color += phosphorDim(0.04) * boxWire(point, vec3(side * 8.0, 6.1, z + 0.9), vec3(0.48, 0.72, 0.92), 0.0010, 1.0, basis, aspect);
  }

  float voidL = boxWire(point, vec3(-8.95, 3.4, nearZ + 58.0), vec3(1.30, 2.10, 18.0), 0.0010, 1.0, basis, aspect);
  float voidR = boxWire(point, vec3(9.05, 2.6, nearZ + 88.0), vec3(1.45, 1.70, 22.0), 0.0010, 1.0, basis, aspect);
  color += phosphorDim(0.025) * (voidL + voidR);

  return color;
}

vec3 drawAnchors(vec2 point, mat3 basis, float aspect) {
  vec3 color = vec3(0.0);

  for (int i = 0; i < 10; i++) {
    float z = 18.0 + float(i) * 13.0;
    float y = 6.3 + sin(float(i) * 0.63) * 0.46;
    float pulse = 0.72 + 0.28 * sin(uTime * 3.0 + float(i) * 0.7);
    vec3 left = vec3(-uArenaHalfWidth + 1.6, y, z);
    vec3 right = vec3(uArenaHalfWidth - 1.6, y, z);
    float leftShape = billboardDiamond(point, left, 0.24, 0.24, 0.0023, pulse, basis, aspect);
    float rightShape = billboardDiamond(point, right, 0.24, 0.24, 0.0023, pulse, basis, aspect);
    color += phosphor(0.52) * (leftShape + rightShape);
  }

  return color;
}

vec3 drawBoss(vec2 point, mat3 basis, float aspect) {
  if (uBossAlive < 0.5) {
    return vec3(0.0);
  }

  vec3 color = vec3(0.0);
  float gait = sin(uTime * 2.1 + uBossPos.z * 0.05) * 0.22;
  float pulse = 0.35 + uBossSummonPulse * 0.9;
  float hurt = 1.0 - uBossHealthNorm;
  vec3 bossTone = phosphor(0.52 + hurt * 0.12);
  float feetY = max(uArenaFloorY + 0.08, uBossPos.y - 2.95);
  vec3 basePos = vec3(uBossPos.x, feetY, uBossPos.z);

  vec3 pelvisCenter = basePos + vec3(0.0, 1.85, 0.02);
  vec3 chestCenter = basePos + vec3(0.0, 4.35, 0.22);
  vec3 neckBase = basePos + vec3(0.0, 5.72, 0.16);
  vec3 headCenter = basePos + vec3(0.0, 6.78 + uBossLookUp * 0.20, 0.34);

  float pelvis = boxWire(point, pelvisCenter, vec3(1.25, 1.00, 0.72), 0.0023, 1.0, basis, aspect);
  float chest = boxWire(point, chestCenter, vec3(1.75, 1.58, 0.95), 0.0024, 1.0, basis, aspect);
  float head = boxWire(point, headCenter, vec3(0.92, 0.92, 0.74), 0.0022, 1.0, basis, aspect);

  float spine = 0.0;
  spine += projectedSegment(point, pelvisCenter + vec3(0.0, 0.90, -0.20), chestCenter + vec3(0.0, -1.35, -0.26), 0.0021, 1.0, basis, aspect);
  spine += projectedSegment(point, chestCenter + vec3(0.0, 1.35, 0.18), neckBase, 0.0021, 1.0, basis, aspect);
  spine += projectedSegment(point, neckBase, headCenter + vec3(0.0, -0.95, -0.18), 0.0020, 1.0, basis, aspect);

  vec3 shoulderL = chestCenter + vec3(-1.90, 0.95, 0.18);
  vec3 shoulderR = chestCenter + vec3(1.90, 0.95, 0.18);
  vec3 elbowL = chestCenter + vec3(-2.65, -0.58, -0.22 - gait * 0.18);
  vec3 elbowR = chestCenter + vec3(2.65, -0.58, -0.22 + gait * 0.18);
  vec3 handL = chestCenter + vec3(-2.25, -2.75, 0.34 + gait * 0.42);
  vec3 handR = chestCenter + vec3(2.25, -2.75, 0.34 - gait * 0.42);

  float arms = 0.0;
  arms += projectedSegment(point, shoulderL, elbowL, 0.0022, 1.0, basis, aspect);
  arms += projectedSegment(point, elbowL, handL, 0.0022, 1.0, basis, aspect);
  arms += projectedSegment(point, shoulderR, elbowR, 0.0022, 1.0, basis, aspect);
  arms += projectedSegment(point, elbowR, handR, 0.0022, 1.0, basis, aspect);
  arms += projectedSegment(point, handL, handL + vec3(-0.56, -0.32, 0.54), 0.0019, 1.0, basis, aspect);
  arms += projectedSegment(point, handL, handL + vec3(-0.18, -0.52, 0.76), 0.0019, 1.0, basis, aspect);
  arms += projectedSegment(point, handR, handR + vec3(0.56, -0.32, 0.54), 0.0019, 1.0, basis, aspect);
  arms += projectedSegment(point, handR, handR + vec3(0.18, -0.52, 0.76), 0.0019, 1.0, basis, aspect);

  vec3 hipL = pelvisCenter + vec3(-0.78, -0.95, 0.08);
  vec3 hipR = pelvisCenter + vec3(0.78, -0.95, 0.08);
  vec3 kneeL = basePos + vec3(-0.92, 2.55, -0.18 + gait * 0.55);
  vec3 kneeR = basePos + vec3(0.92, 2.55, -0.18 - gait * 0.55);
  vec3 footL = basePos + vec3(-0.76, 0.08, 0.42 - gait * 0.32);
  vec3 footR = basePos + vec3(0.76, 0.08, 0.42 + gait * 0.32);

  float legs = 0.0;
  legs += projectedSegment(point, hipL, kneeL, 0.0023, 1.0, basis, aspect);
  legs += projectedSegment(point, kneeL, footL, 0.0023, 1.0, basis, aspect);
  legs += projectedSegment(point, hipR, kneeR, 0.0023, 1.0, basis, aspect);
  legs += projectedSegment(point, kneeR, footR, 0.0023, 1.0, basis, aspect);
  legs += projectedSegment(point, footL, footL + vec3(-0.58, 0.0, 1.02), 0.0020, 1.0, basis, aspect);
  legs += projectedSegment(point, footR, footR + vec3(0.58, 0.0, 1.02), 0.0020, 1.0, basis, aspect);

  float shoulders = projectedSegment(point, shoulderL, shoulderR, 0.0022, 1.0, basis, aspect);
  float hips = projectedSegment(point, hipL, hipR, 0.0022, 1.0, basis, aspect);

  float face = 0.0;
  face += projectedSegment(point, headCenter + vec3(-0.72, 0.04, 0.74), headCenter + vec3(0.72, 0.04, 0.74), 0.0018, 1.0, basis, aspect);
  face += projectedSegment(point, headCenter + vec3(-0.40, -0.42, 0.74), headCenter + vec3(0.40, -0.42, 0.74), 0.0018, 1.0, basis, aspect);
  face += projectedSegment(point, headCenter + vec3(-0.28, -0.10, 0.74), headCenter + vec3(0.0, -0.70, 1.02), 0.0018, 1.0, basis, aspect);
  face += projectedSegment(point, headCenter + vec3(0.28, -0.10, 0.74), headCenter + vec3(0.0, -0.70, 1.02), 0.0018, 1.0, basis, aspect);

  float crown = 0.0;
  crown += projectedSegment(point, headCenter + vec3(-0.46, 0.86, 0.18), headCenter + vec3(-0.90, 1.52, -0.22), 0.0018, 1.0, basis, aspect);
  crown += projectedSegment(point, headCenter + vec3(0.46, 0.86, 0.18), headCenter + vec3(0.90, 1.52, -0.22), 0.0018, 1.0, basis, aspect);
  crown += projectedSegment(point, headCenter + vec3(0.0, 0.94, 0.28), headCenter + vec3(0.0, 1.78, 0.92), 0.0018, 1.0, basis, aspect);

  float ribAura = billboardRing(point, chestCenter + vec3(0.0, 0.12, 0.12), 2.55, 3.20, 0.0018, 1.0, basis, aspect);
  float core = billboardDiamond(point, chestCenter + vec3(0.0, -0.18, 0.74), 0.56, 0.92, 0.0019, 1.0, basis, aspect);

  color += bossTone * (pelvis + chest + head + spine + shoulders + hips + arms + legs + face + crown);
  color += phosphor(0.16 + pulse * 0.12) * ribAura;
  color += phosphor(0.12 + pulse * 0.18) * core;
  return color;
}

vec3 drawMinions(vec2 point, mat3 basis, float aspect) {
  vec3 color = vec3(0.0);

  for (int i = 0; i < MAX_MINIONS; i++) {
    if (float(i) >= uMinionCount) {
      break;
    }

    vec3 center = uMinions[i].xyz + vec3(0.0, 0.25, 0.0);
    float radius = max(uMinions[i].w, 0.4);
    float hp = uMinionMeta[i].x;
    float flash = uMinionMeta[i].z;
    float shell = billboardDiamond(point, center, radius * 0.72, radius * 0.88, 0.0020, 1.0, basis, aspect);
    float ribs = billboardFrame(point, center, vec2(radius * 0.34, radius * 0.46), 0.0017, 1.0, basis, aspect);
    float halo = billboardRing(point, center, radius * 0.92, radius * 1.04, 0.0012, 1.0, basis, aspect);
    vec3 tone = phosphor(0.44 + flash * 0.10 + (1.0 - hp) * 0.08);
    color += tone * (shell + ribs + halo * 0.45);
  }

  return color;
}

vec3 drawProjectiles(vec2 point, mat3 basis, float aspect) {
  vec3 color = vec3(0.0);

  for (int i = 0; i < MAX_PROJECTILES; i++) {
    if (float(i) >= uProjectileCount) {
      break;
    }

    vec3 center = uProjectiles[i].xyz;
    float radius = max(uProjectiles[i].w, 0.18);
    float owner = uProjectileMeta[i].z;
    float glow = uProjectileMeta[i].w;
    float ring = billboardRing(point, center, radius, radius, 0.0019, 1.0, basis, aspect);
    float crossA = projectedSegment(point, center + vec3(-radius, 0.0, 0.0), center + vec3(radius, 0.0, 0.0), 0.0018, 1.0, basis, aspect);
    float crossB = projectedSegment(point, center + vec3(0.0, -radius, 0.0), center + vec3(0.0, radius, 0.0), 0.0018, 1.0, basis, aspect);
    vec3 tone = owner < 0.5 ? phosphor(0.62 + glow * 0.18) : phosphorDim(0.55 + glow * 0.20);
    color += tone * (ring + crossA + crossB);
  }

  return color;
}

vec3 drawImpacts(vec2 point, mat3 basis, float aspect) {
  vec3 color = vec3(0.0);

  for (int i = 0; i < MAX_IMPACTS; i++) {
    if (float(i) >= uImpactCount) {
      break;
    }

    vec3 center = uImpacts[i].xyz;
    float radius = max(uImpacts[i].w, 0.5);
    float strength = uImpactStrength[i];
    float ring = billboardRing(point, center, radius, radius, 0.0016, 1.0, basis, aspect);
    color += phosphor(0.22 + strength * 0.45) * ring * strength;
  }

  return color;
}

vec3 drawGrapple(vec2 point, mat3 basis, float aspect) {
  if (uPlayerGrappleActive < 0.5) {
    return vec3(0.0);
  }

  vec3 right = basis[0];
  vec3 up = basis[1];
  vec3 forward = basis[2];
  vec3 origin = uPlayerPos + right * 0.25 - up * 0.12 + forward * 0.38;
  float cable = projectedSegment(point, origin, uPlayerGrapplePoint, 0.0019, 1.0, basis, aspect);
  float head = billboardDiamond(point, uPlayerGrapplePoint, 0.18, 0.18, 0.0021, 1.0, basis, aspect);
  return phosphor(0.82) * (cable + head);
}

vec3 drawWeaponOverlay(vec2 point) {
  vec3 color = vec3(0.0);
  float stride = saturate(length(uPlayerVelocity.xz) / 12.0);
  float bob = sin(uTime * 10.5) * 0.016 * stride;
  vec2 offset = vec2(0.0, bob);

  if (uPlayerWeapon < 0.5) {
    float grip = lineSegment(point, vec2(0.22, -0.62) + offset, vec2(0.34, -0.88) + offset, 0.0040);
    float frame = lineSegment(point, vec2(0.12, -0.58) + offset, vec2(0.40, -0.62) + offset, 0.0040);
    float cable = lineSegment(point, vec2(0.36, -0.60) + offset, vec2(0.54, -0.26) + offset, 0.0035);
    float clawA = lineSegment(point, vec2(0.54, -0.26) + offset, vec2(0.48, -0.12) + offset, 0.0035);
    float clawB = lineSegment(point, vec2(0.54, -0.26) + offset, vec2(0.63, -0.14) + offset, 0.0035);
    float clawC = lineSegment(point, vec2(0.54, -0.26) + offset, vec2(0.56, -0.02) + offset, 0.0032);
    color += phosphor(0.60) * (grip + frame + cable + clawA + clawB + clawC);
  } else if (uPlayerWeapon < 1.5) {
    float shell = rectBorder(point, vec2(0.58, -0.57) + offset, vec2(0.27, 0.12), 0.0030);
    float barrelTop = lineSegment(point, vec2(0.28, -0.48) + offset, vec2(0.82, -0.44) + offset, 0.0042);
    float barrelBottom = lineSegment(point, vec2(0.30, -0.66) + offset, vec2(0.82, -0.58) + offset, 0.0042);
    float muzzle = lineSegment(point, vec2(0.82, -0.44) + offset, vec2(0.82, -0.58) + offset, 0.0040);
    float stockTop = lineSegment(point, vec2(0.10, -0.50) + offset, vec2(0.32, -0.48) + offset, 0.0040);
    float stockBack = lineSegment(point, vec2(0.10, -0.50) + offset, vec2(0.10, -0.75) + offset, 0.0040);
    float stockBottom = lineSegment(point, vec2(0.10, -0.75) + offset, vec2(0.30, -0.66) + offset, 0.0040);
    float grip = lineSegment(point, vec2(0.36, -0.58) + offset, vec2(0.45, -0.86) + offset, 0.0040);
    float scope = rectBorder(point, vec2(0.55, -0.34) + offset, vec2(0.10, 0.055), 0.0026);
    float display = rectBorder(point, vec2(0.67, -0.34) + offset, vec2(0.08, 0.08), 0.0026);
    color += phosphor(0.68) * (shell + barrelTop + barrelBottom + muzzle + stockTop + stockBack + stockBottom + grip + scope + display);
    color += phosphor(0.26) * lineSegment(point, vec2(0.62, -0.34) + offset, vec2(0.72, -0.34) + offset, 0.0065);
  } else {
    float swing = saturate(uPlayerSwordSwing);
    vec2 bladeTip = mix(vec2(0.54, -0.02), vec2(0.20, 0.34), swing);
    vec2 bladeBase = mix(vec2(0.18, -0.92), vec2(0.10, -0.74), swing) + offset;
    float blade = lineSegment(point, bladeBase, bladeTip + offset, 0.0040);
    float edge = lineSegment(point, bladeBase + vec2(0.03, 0.02), bladeTip + vec2(0.02, -0.03) + offset, 0.0030);
    float guard = lineSegment(point, bladeBase + vec2(-0.10, 0.05), bladeBase + vec2(0.10, -0.02), 0.0040);
    float slash = lineSegment(point, vec2(-0.18, -0.10), vec2(0.38, 0.40), 0.0100) * swing;
    color += phosphor(0.64) * (blade + edge + guard);
    color += phosphor(0.22) * slash;
  }

  return color;
}

vec3 drawStatus(vec2 point) {
  vec3 color = vec3(0.0);
  vec3 crossColor = mix(phosphorDim(0.85), phosphor(1.0), uPlayerHealthNorm);
  float crossX = lineSegment(point, vec2(-0.020, 0.0), vec2(0.020, 0.0), 0.0016);
  float crossY = lineSegment(point, vec2(0.0, -0.020), vec2(0.0, 0.020), 0.0016);
  float crossRing = circleWire(point, vec2(0.0), 0.040, 0.0014);
  color += crossColor * (crossX + crossY + crossRing * 0.72);

  float leftPanel = rectBorder(point, vec2(-0.73, -0.79), vec2(0.20, 0.065), 0.0020);
  float leftFill = rectBorder(point, vec2(-0.78 + 0.115 * uPlayerHealthNorm, -0.79), vec2(0.11 * uPlayerHealthNorm, 0.026), 0.0060);
  float leftSub = rectBorder(point, vec2(-0.73, -0.89), vec2(0.16, 0.045), 0.0018);
  float rightPanel = rectBorder(point, vec2(0.63, -0.82), vec2(0.20, 0.06), 0.0020);
  color += phosphorDim(0.92) * (leftPanel + leftSub + rightPanel);
  color += phosphor(0.50) * leftFill;

  for (int i = 0; i < 3; i++) {
    float centerX = 0.46 + float(i) * 0.13;
    float selected = 1.0 - step(0.09, abs(float(i) - uPlayerWeapon));
    color += phosphorDim(0.45) * rectBorder(point, vec2(centerX, -0.89), vec2(0.048, 0.035), 0.0018);
    color += phosphor(0.82) * rectBorder(point, vec2(centerX, -0.89), vec2(0.048, 0.035), 0.0018) * selected;
  }

  color += phosphor(0.82) * rectBorder(point, vec2(0.03, 0.86), vec2(0.18, 0.025), 0.0018);
  color += phosphor(0.76) * rectBorder(point, vec2(-0.67, 0.86), vec2(0.24, 0.025), 0.0016);
  color += phosphor(0.76) * rectBorder(point, vec2(0.52, 0.86), vec2(0.18, 0.025), 0.0016);
  color += phosphor(0.76) * rectBorder(point, vec2(0.86, 0.86), vec2(0.08, 0.025), 0.0016);
  color += phosphor(0.78) * rectBorder(point, vec2(-0.74, 0.76), vec2(0.09, 0.038), 0.0018) * uPlayerGrappleActive;
  color += phosphor(0.78) * rectBorder(point, vec2(0.74, 0.76), vec2(0.09, 0.038), 0.0018) * saturate(uPlayerSwordSwing * 1.5);
  return color;
}

vec3 drawOutsideWall(vec2 fragPos) {
  vec2 uv = fragPos / max(uResolution, vec2(1.0));
  vec2 point = uv * 2.0 - 1.0;
  vec3 color = vec3(0.004, 0.010, 0.020);
  color += phosphorDim(0.34) * rectBorder(point, vec2(0.0), vec2(0.98, 0.98), 0.0026);
  color += phosphorDim(0.16) * lineSegment(point, vec2(-0.96, 0.0), vec2(0.96, 0.0), 0.0014);
  color += phosphorDim(0.16) * lineSegment(point, vec2(0.0, -0.96), vec2(0.0, 0.96), 0.0014);
  return color;
}

void main() {
  vec2 fragPos = gl_FragCoord.xy;
  vec2 gameMin = uGameViewport.xy;
  vec2 gameMax = uGameViewport.xy + uGameViewport.zw;
  float inGame = step(gameMin.x, fragPos.x) * step(fragPos.x, gameMax.x) *
    step(gameMin.y, fragPos.y) * step(fragPos.y, gameMax.y);

  if (inGame < 0.5) {
    gl_FragColor = vec4(drawOutsideWall(fragPos), 1.0);
    return;
  }

  vec2 uv = (fragPos - gameMin) / max(uGameViewport.zw, vec2(1.0));
  vec2 pixelStep = vec2(
    uPixelScale / max(uGameViewport.z, 1.0),
    uPixelScale / max(uGameViewport.w, 1.0)
  );
  uv = floor(uv / pixelStep) * pixelStep + pixelStep * 0.5;

  float aspect = uGameViewport.z / max(uGameViewport.w, 1.0);
  vec2 point = uv * 2.0 - 1.0;
  mat3 basis = cameraBasis();
  vec3 ray = viewRay(point, basis, aspect);
  SurfaceHit hit = raycastCorridor(uCameraPos, ray);

  vec3 color = vec3(0.004, 0.010, 0.022);
  color += drawViewportFrame(point);
  color += corridorSurfaceColor(hit);
  color += drawCorridorArchitecture(point, basis, aspect);
  color += drawAnchors(point, basis, aspect);
  color += drawBoss(point, basis, aspect);
  color += drawMinions(point, basis, aspect);
  color += drawProjectiles(point, basis, aspect);
  color += drawImpacts(point, basis, aspect);
  color += drawGrapple(point, basis, aspect);
  color += drawWeaponOverlay(point);
  color += drawStatus(point);

  float vignette = saturate(1.04 - dot(point * vec2(0.76, 0.70), point));
  float scanline = 0.78 + 0.22 * sin((fragPos.y + uTime * 26.0) * 1.35);
  float lineDrift = 0.94 + 0.06 * sin(fragPos.y * 0.17 + uTime * 9.0);
  float mask = 0.92 + 0.08 * sin(fragPos.x * 1.65);
  float noise = fract(sin(dot(floor(fragPos * 0.35), vec2(12.9898, 78.233)) + uTime * 5.7) * 43758.5453);
  color *= vignette * scanline * lineDrift * mask;
  color += phosphorDim(0.018) * noise;
  color = floor(color * 20.0) / 20.0;

  gl_FragColor = vec4(color, 1.0);
}
