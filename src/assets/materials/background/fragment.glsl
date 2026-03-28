precision highp float;

uniform vec2 uResolution;
uniform vec2 uViewSize;
uniform vec2 uCameraPos;
uniform float uTime;make numbers there fixed length
uniform vec2 uHeroPos;
uniform vec2 uHeroVelocity;
uniform float uHeroFacing;
uniform float uHeroGrounded;
uniform float uHeroCrouch;
uniform vec4 uPlatforms[28];
uniform float uPlatformCount;
uniform vec4 uCollectibles[12];
uniform float uCollectibleCount;

float rectMask(vec2 point, vec4 rect) {
  vec2 insideMin = step(rect.xy, point);
  vec2 insideMax = step(point, rect.xy + rect.zw);
  return insideMin.x * insideMin.y * insideMax.x * insideMax.y;
}

float ellipseMask(vec2 point, vec2 center, vec2 radius) {
  vec2 p = (point - center) / max(radius, vec2(0.0001));
  return 1.0 - step(1.0, dot(p, p));
}

vec3 applyRect(vec3 color, vec2 point, vec4 rect, vec3 fillColor) {
  float mask = rectMask(point, rect);
  return mix(color, fillColor, mask);
}

vec3 drawBushPlatform(vec3 color, vec2 worldPos, vec4 platformRect) {
  vec3 outline = vec3(0.02, 0.07, 0.09);
  vec3 bushDark = vec3(0.12, 0.41, 0.44);
  vec3 bushMain = vec3(0.26, 0.76, 0.72);
  vec3 bushLight = vec3(0.61, 1.00, 0.92);

  vec2 local = (worldPos - platformRect.xy) / max(platformRect.zw, vec2(0.0001));

  float body = rectMask(
    worldPos,
    vec4(
      platformRect.x,
      platformRect.y,
      platformRect.z,
      platformRect.w * 0.62
    )
  );
  float bodyInner = rectMask(
    worldPos,
    vec4(
      platformRect.x + 0.08,
      platformRect.y + 0.04,
      platformRect.z - 0.16,
      platformRect.w * 0.54
    )
  );

  float canopy = 0.0;
  float canopyInner = 0.0;
  for (int j = 0; j < 5; j++) {
    float t = (float(j) + 0.5) / 5.0;
    vec2 center = vec2(
      platformRect.x + platformRect.z * t,
      platformRect.y + platformRect.w * 0.63 + sin(float(j) * 1.37 + platformRect.x * 0.19) * 0.05
    );
    vec2 radius = vec2(
      max(0.24, platformRect.z * 0.17),
      max(0.26, platformRect.w * 0.45)
    );

    canopy = max(canopy, ellipseMask(worldPos, center, radius));
    canopyInner = max(canopyInner, ellipseMask(worldPos, center, radius * 0.78));
  }

  float outer = max(body, canopy);
  float inner = max(bodyInner, canopyInner);
  float border = max(outer - inner, 0.0);

  float pattern = step(0.55, fract((worldPos.x - platformRect.x) * 1.25 + platformRect.y * 0.25));
  vec3 fill = mix(bushDark, bushMain, pattern * 0.45 + clamp(local.y, 0.0, 1.0) * 0.35);

  color = mix(color, fill, inner);
  color = mix(color, outline, border);
  color = mix(color, bushLight, canopyInner * 0.2);

  return color;
}

vec3 drawPlatforms(vec3 color, vec2 worldPos) {
  for (int i = 0; i < 28; i++) {
    float enabled = step(float(i) + 0.5, uPlatformCount);
    vec4 platformRect = uPlatforms[i];
    vec3 nextColor = drawBushPlatform(color, worldPos, platformRect);
    color = mix(color, nextColor, enabled);
  }

  return color;
}

vec3 drawCollectibles(vec3 color, vec2 worldPos) {
  vec3 coinOuter = vec3(0.57, 1.00, 0.90);
  vec3 coinInner = vec3(0.85, 1.00, 0.96);
  vec3 coinOutline = vec3(0.08, 0.22, 0.24);

  for (int i = 0; i < 12; i++) {
    float enabled = step(float(i) + 0.5, uCollectibleCount);
    vec4 data = uCollectibles[i];
    vec2 coinCenter = data.xy + vec2(0.0, sin(uTime * 2.6 + data.z) * 0.12);

    float body = ellipseMask(worldPos, coinCenter, vec2(0.26, 0.26));
    float inner = ellipseMask(worldPos, coinCenter, vec2(0.15, 0.15));
    float border = body - inner;

    color = mix(color, coinOuter, body * enabled);
    color = mix(color, coinOutline, border * enabled);
    color = mix(color, coinInner, inner * enabled);
  }

  return color;
}

vec3 drawHero(vec3 color, vec2 worldPos) {
  vec2 heroPoint = worldPos - uHeroPos;
  heroPoint.x *= uHeroFacing;

  float speed = clamp(abs(uHeroVelocity.x) / 8.5, 0.0, 1.0);
  float grounded = clamp(uHeroGrounded, 0.0, 1.0);
  float air = 1.0 - grounded;
  float crouch = clamp(uHeroCrouch, 0.0, 1.0);

  float runSpeed = mix(1.0, 0.35, crouch);
  float runPhase = uTime * (6.0 + speed * 8.0) * runSpeed;
  float leftLift = max(0.0, sin(runPhase)) * 0.24 * speed * grounded * (1.0 - crouch * 0.75);
  float rightLift = max(0.0, sin(runPhase + 3.14159)) * 0.24 * speed * grounded * (1.0 - crouch * 0.75);
  float crouchPulse = sin(uTime * 10.0) * 0.03 * crouch;
  float crouchDrop = crouch * 0.26 + crouchPulse;
  float torsoRise = air * 0.10 - crouch * 0.08;
  float vyNorm = clamp(uHeroVelocity.y / 14.0, -1.0, 1.0);
  float torsoStretch = air * max(vyNorm, 0.0) * 0.12;
  float torsoSquash = air * max(-vyNorm, 0.0) * 0.10;
  float armSwing = sin(runPhase + 1.5708) * 0.16 * speed * grounded * (1.0 - crouch * 0.8);

  vec3 outline = vec3(0.02, 0.07, 0.09);
  vec3 suitMain = vec3(0.34, 0.93, 0.84);
  vec3 suitDark = vec3(0.18, 0.57, 0.60);
  vec3 suitLight = vec3(0.61, 1.00, 0.92);

  float shadow = ellipseMask(
    worldPos,
    vec2(uHeroPos.x, 1.05),
    vec2(0.55 + air * 0.12 + crouch * 0.08, 0.11 + air * 0.02 + crouch * 0.02)
  ) * (0.30 + air * 0.25);
  color = mix(color, vec3(0.0), shadow);

  float headY = 1.27 + torsoRise - crouchDrop;
  float faceY = 1.11 + torsoRise - crouchDrop * 0.96;
  float torsoY = 0.72 + torsoRise - crouchDrop * 0.50;
  float torsoH = mix(0.56 + torsoStretch - torsoSquash, 0.37, crouch);
  float legYLeft = 0.16 + leftLift + crouch * 0.08;
  float legYRight = 0.16 + rightLift + crouch * 0.08;
  float legH = mix(0.58 - air * 0.09, 0.34, crouch);

  color = applyRect(color, heroPoint, vec4(-0.24, headY, 0.48, 0.20), outline);
  color = applyRect(color, heroPoint, vec4(-0.19, faceY, 0.38, 0.18), suitLight);
  color = applyRect(color, heroPoint, vec4(-0.10, faceY + 0.03, 0.20, 0.06), outline);

  color = applyRect(color, heroPoint, vec4(-0.26, torsoY, 0.52, torsoH), suitMain);
  color = applyRect(color, heroPoint, vec4(-0.26, torsoY + torsoH * 0.46, 0.52, 0.08), outline);
  color = applyRect(color, heroPoint, vec4(-0.26, torsoY, 0.08, torsoH), outline);
  color = applyRect(color, heroPoint, vec4(0.18, torsoY, 0.08, torsoH), outline);

  color = applyRect(
    color,
    heroPoint,
    vec4(-0.34, 0.79 + torsoRise - crouchDrop * 0.48 + max(0.0, armSwing), 0.10, 0.40 - air * 0.05 - crouch * 0.1),
    suitDark
  );
  color = applyRect(
    color,
    heroPoint,
    vec4(0.24, 0.79 + torsoRise - crouchDrop * 0.48 + max(0.0, -armSwing), 0.10, 0.40 - air * 0.05 - crouch * 0.1),
    suitDark
  );

  color = applyRect(
    color,
    heroPoint,
    vec4(-0.20, legYLeft, 0.16, legH),
    suitDark
  );
  color = applyRect(
    color,
    heroPoint,
    vec4(0.04, legYRight, 0.16, legH),
    suitDark
  );
  color = applyRect(color, heroPoint, vec4(-0.20, legYLeft, 0.05, legH), outline);
  color = applyRect(color, heroPoint, vec4(0.15, legYRight, 0.05, legH), outline);
  color = applyRect(color, heroPoint, vec4(-0.22, legYLeft - 0.10, 0.20, 0.14), outline);
  color = applyRect(color, heroPoint, vec4(0.02, legYRight - 0.10, 0.20, 0.14), outline);

  return color;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec2 worldPos = uCameraPos +
    vec2((uv.x - 0.5) * uViewSize.x, (uv.y - 0.5) * uViewSize.y);

  float pixelSize = max(uViewSize.y / 220.0, 0.02);
  worldPos = floor(worldPos / pixelSize) * pixelSize;

  vec3 color = vec3(0.0, 0.0, 0.0);
  color = drawPlatforms(color, worldPos);
  color = drawCollectibles(color, worldPos);
  color = drawHero(color, worldPos);

  float scanline = 0.95 + 0.05 * sin(gl_FragCoord.y * 0.7);
  color *= scanline;
  color = floor(color * 24.0) / 24.0;

  gl_FragColor = vec4(color, 1.0);
}
