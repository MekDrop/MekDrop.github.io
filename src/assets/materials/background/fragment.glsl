precision mediump float;

const int MAX_STRUCTURES = 1;
const int MAX_ANCHORS = 1;
const int MAX_MINIONS = 1;
const int MAX_PROJECTILES = 1;
const int MAX_IMPACTS = 1;

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
uniform vec3 uPlayerPos;
uniform vec3 uPlayerVelocity;
uniform float uPlayerWeapon;
uniform float uPlayerHealthNorm;
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
uniform vec4 uStructures[MAX_STRUCTURES];
uniform vec4 uStructureMeta[MAX_STRUCTURES];
uniform float uStructureCount;
uniform vec4 uAnchors[MAX_ANCHORS];
uniform float uAnchorState[MAX_ANCHORS];
uniform float uAnchorCount;
uniform vec4 uMinions[MAX_MINIONS];
uniform vec4 uMinionMeta[MAX_MINIONS];
uniform float uMinionCount;
uniform vec4 uProjectiles[MAX_PROJECTILES];
uniform vec4 uProjectileMeta[MAX_PROJECTILES];
uniform float uProjectileCount;
uniform vec4 uImpacts[MAX_IMPACTS];
uniform float uImpactStrength[MAX_IMPACTS];
uniform float uImpactCount;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float invSmoothstep(float edge0, float edge1, float value) {
  return 1.0 - smoothstep(edge0, edge1, value);
}

float ellipseMask(vec2 point, vec2 radius) {
  vec2 r = max(radius, vec2(0.0001));
  vec2 p = point / r;
  return 1.0 - step(1.0, dot(p, p));
}

float segmentDistance(vec2 point, vec2 a, vec2 b) {
  vec2 ap = point - a;
  vec2 ab = b - a;
  float t = clamp(dot(ap, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(ap - ab * t);
}

void getCameraBasis(out vec3 right, out vec3 up, out vec3 forward) {
  float cy = cos(uCameraYaw);
  float sy = sin(uCameraYaw);
  float cp = cos(uCameraPitch);
  float sp = sin(uCameraPitch);
  forward = normalize(vec3(sy * cp, sp, cy * cp));
  right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  up = normalize(cross(forward, right));
}

vec3 worldToCamera(vec3 point, vec3 right, vec3 up, vec3 forward) {
  vec3 offset = point - uCameraPos;
  return vec3(dot(offset, right), dot(offset, up), dot(offset, forward));
}

vec2 projectToNdc(vec3 cameraPoint, float aspect) {
  float z = max(cameraPoint.z, 0.0001);
  return vec2(
    cameraPoint.x / max(z * aspect * uFov, 0.0001),
    cameraPoint.y / max(z * uFov, 0.0001)
  );
}

float scanBandAtZ(float z) {
  float dz = abs((z - uScanOriginZ) - uScanDistance);
  return invSmoothstep(uScanWidth * 0.08, uScanWidth, dz);
}

float wireLine(float coord, float density, float width) {
  return invSmoothstep(0.0, width, abs(fract(coord * density) - 0.5));
}

vec3 drawOutsideWall(vec2 fragPos) {
  vec3 dark = vec3(0.01, 0.05, 0.09);
  vec3 main = vec3(0.05, 0.20, 0.34);
  vec3 glow = vec3(0.11, 0.58, 0.88);
  vec2 coord = fragPos * vec2(0.06, 0.12);
  float cell = sin(floor(coord.x) * 0.71 + floor(coord.y) * 0.59);
  float mortar = max(
    1.0 - step(0.10, fract(coord.x)),
    1.0 - step(0.08, fract(coord.y))
  );
  vec3 wall = mix(dark, main, cell * 0.25 + 0.55);
  wall = mix(wall, glow, mortar * 0.48);
  float scanline = 0.90 + 0.10 * sin((fragPos.y + uTime * 10.0) * 0.85);
  return wall * scanline;
}

void main() {
  vec2 fragPos = gl_FragCoord.xy;
  vec2 gameMin = uGameViewport.xy;
  vec2 gameMax = uGameViewport.xy + uGameViewport.zw;
  float inGame = step(gameMin.x, fragPos.x) * step(fragPos.x, gameMax.x) *
    step(gameMin.y, fragPos.y) * step(fragPos.y, gameMax.y);

  if (inGame < 0.5) {
    vec3 wall = drawOutsideWall(fragPos);
    wall = floor(wall * 24.0) / 24.0;
    gl_FragColor = vec4(wall, 1.0);
    return;
  }

  vec2 uv = (fragPos - gameMin) / max(uGameViewport.zw, vec2(1.0));
  vec2 pixelStep = vec2(
    uPixelScale / max(uGameViewport.z, 1.0),
    uPixelScale / max(uGameViewport.w, 1.0)
  );
  uv = floor(uv / pixelStep) * pixelStep + pixelStep * 0.5;
  vec2 ndc = uv * 2.0 - 1.0;
  float aspect = uGameViewport.z / max(uGameViewport.w, 1.0);

  vec3 right;
  vec3 up;
  vec3 forward;
  getCameraBasis(right, up, forward);
  vec3 ray = normalize(forward + right * ndc.x * aspect * uFov + up * ndc.y * uFov);

  vec3 color = vec3(0.02, 0.06, 0.11);
  float hitDepth = 1000.0;
  vec3 hitPoint = vec3(0.0);

  if (ray.y < -0.0001) {
    float tFloor = (uArenaFloorY - uCameraPos.y) / ray.y;
    if (tFloor > 0.0) {
      vec3 p = uCameraPos + ray * tFloor;
      float depth = dot(p - uCameraPos, forward);
      if (depth > 0.0 && depth < hitDepth) {
        float longitudinal = wireLine(p.x, 0.30, 0.012);
        float cross = wireLine(p.z, 0.11, 0.016);
        float centerRail = invSmoothstep(0.0, 0.10, abs(p.x));
        float sideRail = wireLine(abs(p.x), 0.085, 0.020);
        color = mix(vec3(0.01, 0.04, 0.07), vec3(0.03, 0.11, 0.21), 0.66);
        color = mix(color, vec3(0.10, 0.62, 0.90), longitudinal * 0.62 + cross * 0.34 + centerRail * 0.46 + sideRail * 0.20);
        hitDepth = depth;
        hitPoint = p;
      }
    }
  }

  if (ray.y > 0.0001) {
    float tCeil = (uArenaCeilingY - uCameraPos.y) / ray.y;
    if (tCeil > 0.0) {
      vec3 p = uCameraPos + ray * tCeil;
      float depth = dot(p - uCameraPos, forward);
      if (depth > 0.0 && depth < hitDepth) {
        float longitudinal = wireLine(p.x, 0.24, 0.016);
        float cross = wireLine(p.z, 0.10, 0.020);
        float centerStrip = invSmoothstep(0.0, 0.12, abs(p.x));
        color = mix(vec3(0.01, 0.03, 0.06), vec3(0.03, 0.09, 0.16), 0.74);
        color = mix(color, vec3(0.11, 0.46, 0.74), longitudinal * 0.34 + cross * 0.26 + centerStrip * 0.32);
        hitDepth = depth;
        hitPoint = p;
      }
    }
  }

  if (ray.x > 0.0001) {
    float tWall = (uArenaHalfWidth - uCameraPos.x) / ray.x;
    if (tWall > 0.0) {
      vec3 p = uCameraPos + ray * tWall;
      float depth = dot(p - uCameraPos, forward);
      if (depth > 0.0 && depth < hitDepth) {
        float depthLines = wireLine(p.z, 0.12, 0.016);
        float verticalLines = wireLine(p.y, 0.34, 0.018);
        float floorEdge = invSmoothstep(0.0, 0.10, abs(p.y - uArenaFloorY));
        float ceilingEdge = invSmoothstep(0.0, 0.10, abs(p.y - uArenaCeilingY));
        color = mix(vec3(0.01, 0.05, 0.08), vec3(0.04, 0.16, 0.27), 0.34);
        color = mix(color, vec3(0.10, 0.54, 0.86), depthLines * 0.42 + verticalLines * 0.26 + floorEdge * 0.32 + ceilingEdge * 0.24);
        hitDepth = depth;
        hitPoint = p;
      }
    }
  } else if (ray.x < -0.0001) {
    float tWall = (-uArenaHalfWidth - uCameraPos.x) / ray.x;
    if (tWall > 0.0) {
      vec3 p = uCameraPos + ray * tWall;
      float depth = dot(p - uCameraPos, forward);
      if (depth > 0.0 && depth < hitDepth) {
        float depthLines = wireLine(p.z, 0.12, 0.016);
        float verticalLines = wireLine(p.y, 0.34, 0.018);
        float floorEdge = invSmoothstep(0.0, 0.10, abs(p.y - uArenaFloorY));
        float ceilingEdge = invSmoothstep(0.0, 0.10, abs(p.y - uArenaCeilingY));
        color = mix(vec3(0.01, 0.05, 0.08), vec3(0.04, 0.16, 0.27), 0.34);
        color = mix(color, vec3(0.10, 0.54, 0.86), depthLines * 0.42 + verticalLines * 0.26 + floorEdge * 0.32 + ceilingEdge * 0.24);
        hitDepth = depth;
        hitPoint = p;
      }
    }
  }

  color *= 0.42 + 0.58 * exp(-hitDepth * 0.018);
  float sweep = scanBandAtZ(hitPoint.z);
  color *= 1.0 + sweep * uScanIntensity * 0.55;
  color += vec3(0.06, 0.54, 0.94) * sweep * uScanIntensity * 0.34;

  if (uStructureCount > 0.5) {
    vec4 s = uStructures[0];
    vec4 sm = uStructureMeta[0];
    vec3 c = worldToCamera(s.xyz, right, up, forward);
    if (c.z > 0.1) {
      vec2 center = projectToNdc(c, aspect);
      float halfW = s.w / max(c.z * aspect * uFov, 0.0001);
      float halfH = sm.x / max(c.z * uFov, 0.0001);
      vec2 local = vec2((ndc.x - center.x) / max(halfW, 0.0001), (ndc.y - center.y) / max(halfH, 0.0001));
      float rect = step(abs(local.x), 1.0) * step(abs(local.y), 1.0);
      vec3 structureColor = mix(vec3(0.04, 0.12, 0.22), vec3(0.12, 0.56, 0.90), sm.z);
      structureColor += vec3(0.15, 0.76, 1.0) * scanBandAtZ(s.z) * 0.3;
      color = mix(color, structureColor, rect);
    }
  }

  if (uAnchorCount > 0.5) {
    vec4 a = uAnchors[0];
    vec3 c = worldToCamera(a.xyz, right, up, forward);
    if (c.z > 0.1) {
      vec2 center = projectToNdc(c, aspect);
      float radius = a.w / max(c.z * aspect * uFov, 0.0001);
      vec2 local = vec2((ndc.x - center.x) / max(radius, 0.0001), (ndc.y - center.y) / max(radius, 0.0001));
      float orb = ellipseMask(local, vec2(1.0));
      color = mix(color, vec3(0.46, 1.0, 1.0), orb * 0.75);
    }
  }

  if (uBossAlive > 0.5) {
    vec3 c = worldToCamera(uBossPos, right, up, forward);
    if (c.z > 0.1) {
      vec2 center = projectToNdc(c, aspect);
      float hw = 3.4 / max(c.z * aspect * uFov, 0.0001);
      float hh = 4.6 / max(c.z * uFov, 0.0001);
      vec2 local = vec2((ndc.x - center.x) / max(hw, 0.0001), (ndc.y - center.y) / max(hh, 0.0001));
      float torso = ellipseMask(local - vec2(0.0, -0.08), vec2(0.92, 0.92));
      float head = ellipseMask(local - vec2(-uBossLookUp * 0.09, 0.74 + uBossLookUp * 0.33), vec2(0.52, 0.34));
      float body = max(torso, head);
      vec3 bossColor = mix(vec3(0.02, 0.08, 0.14), vec3(0.16, 0.66, 1.0), 0.45 + uBossSummonPulse * 0.4);
      color = mix(color, bossColor, body);
    }
  }

  if (uMinionCount > 0.5) {
    vec4 m = uMinions[0];
    vec3 c = worldToCamera(m.xyz, right, up, forward);
    if (c.z > 0.1) {
      vec2 center = projectToNdc(c, aspect);
      float radius = m.w / max(c.z * aspect * uFov, 0.0001);
      vec2 local = vec2((ndc.x - center.x) / max(radius, 0.0001), (ndc.y - center.y) / max(radius, 0.0001));
      float body = ellipseMask(local, vec2(1.0));
      color = mix(color, vec3(0.10, 0.44, 0.76), body * 0.8);
    }
  }

  if (uProjectileCount > 0.5) {
    vec4 p = uProjectiles[0];
    vec4 pm = uProjectileMeta[0];
    vec3 c = worldToCamera(p.xyz, right, up, forward);
    if (c.z > 0.1) {
      vec2 center = projectToNdc(c, aspect);
      float radius = p.w / max(c.z * aspect * uFov, 0.0001);
      vec2 local = vec2((ndc.x - center.x) / max(radius, 0.0001), (ndc.y - center.y) / max(radius, 0.0001));
      float body = ellipseMask(local, vec2(1.0));
      vec3 proj = pm.x < 0.5 ? vec3(0.35, 0.96, 1.00) : vec3(0.10, 0.60, 0.96);
      color = mix(color, proj, body);
    }
  }

  if (uImpactCount > 0.5) {
    vec4 i = uImpacts[0];
    vec3 c = worldToCamera(i.xyz, right, up, forward);
    if (c.z > 0.1) {
      vec2 center = projectToNdc(c, aspect);
      float radius = i.w / max(c.z * aspect * uFov, 0.0001);
      vec2 local = vec2((ndc.x - center.x) / max(radius, 0.0001), (ndc.y - center.y) / max(radius, 0.0001));
      float ring = invSmoothstep(0.5, 1.2, length(local)) - invSmoothstep(0.1, 0.56, length(local));
      color += vec3(0.3, 0.9, 1.0) * ring * uImpactStrength[0];
    }
  }

  if (uPlayerGrappleActive > 0.5) {
    vec3 aCam = worldToCamera(uPlayerPos + vec3(0.0, 1.0, 0.0), right, up, forward);
    vec3 bCam = worldToCamera(uPlayerGrapplePoint, right, up, forward);
    if (aCam.z > 0.1 && bCam.z > 0.1) {
      vec2 aNdc = projectToNdc(aCam, aspect);
      vec2 bNdc = projectToNdc(bCam, aspect);
      float ropeDistance = segmentDistance(ndc, aNdc, bNdc);
      float rope = invSmoothstep(0.0, 0.022, ropeDistance);
      color = mix(color, vec3(0.54, 1.00, 1.00), rope * 0.8);
    }
  }

  if (uPlayerSwordSwing > 0.001) {
    vec2 slashCenter = vec2(0.10, -0.24);
    float angle = atan(ndc.y - slashCenter.y, ndc.x - slashCenter.x);
    float arc = smoothstep(-0.6, -0.1, angle) * (1.0 - smoothstep(0.35, 0.9, length(ndc - slashCenter)));
    float slash = arc * uPlayerSwordSwing;
    color = mix(color, vec3(0.58, 1.00, 1.00), slash);
  }

  vec2 crosshair = abs(ndc);
  float crossX = invSmoothstep(0.001, 0.015, crosshair.x) * invSmoothstep(0.01, 0.08, crosshair.y);
  float crossY = invSmoothstep(0.001, 0.015, crosshair.y) * invSmoothstep(0.01, 0.08, crosshair.x);
  float healthPulse = 1.0 - uPlayerHealthNorm;
  vec3 crossColor = mix(vec3(0.40, 0.95, 1.00), vec3(0.72, 0.34, 0.42), healthPulse);
  color = mix(color, crossColor, (crossX + crossY) * 0.55);

  float weaponTintRocket = 1.0 - step(0.5, abs(uPlayerWeapon - 1.0));
  float weaponTintSword = 1.0 - step(0.5, abs(uPlayerWeapon - 2.0));
  float weaponTintGrapple = 1.0 - step(0.5, abs(uPlayerWeapon - 0.0));
  vec3 weaponTint = vec3(0.0);
  weaponTint += vec3(0.08, 0.32, 0.46) * weaponTintRocket;
  weaponTint += vec3(0.05, 0.24, 0.58) * weaponTintSword;
  weaponTint += vec3(0.12, 0.40, 0.40) * weaponTintGrapple;
  color = mix(color, color + weaponTint, 0.18);

  float scanline = 0.92 + 0.08 * sin((fragPos.y + uTime * 7.0) * 0.82);
  float vignette = invSmoothstep(0.2, 1.35, length((uv - 0.5) * vec2(1.05, 1.2)));
  color *= scanline;
  color *= mix(0.54, 1.0, vignette);
  color = floor(color * 24.0) / 24.0;

  gl_FragColor = vec4(color, 1.0);
}
