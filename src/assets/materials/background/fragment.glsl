precision highp float;

const float VERTICAL_SCALE = 0.5625;

uniform vec2 uResolution;
uniform vec4 uGameViewport;
uniform vec2 uViewSize;
uniform vec2 uCameraPos;
uniform float uTime;
uniform vec2 uHeroPos;
uniform vec2 uHeroVelocity;
uniform float uHeroFacing;
uniform float uHeroGrounded;
uniform float uHeroCrouch;
uniform float uHeroVisible;
uniform vec2 uSnakePos;
uniform vec2 uSnakeVelocity;
uniform float uSnakeFacing;
uniform float uSnakeAlive;
uniform float uSnakeOnLadder;
uniform vec4 uPlatforms[48];
uniform float uPlatformMotion[48];
uniform float uPlatformType[48];
uniform float uPlatformShake[48];
uniform float uPlatformDurability[48];
uniform float uPlatformCount;
uniform vec4 uCollectibles[12];
uniform float uCollectibleCount;
uniform vec4 uLadders[40];
uniform float uLadderCount;
uniform vec4 uSpikes[20];
uniform float uSpikeDir[20];
uniform float uSpikeCount;
uniform vec4 uPortals[16];
uniform float uPortalSide[16];
uniform float uPortalCount;

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

vec3 drawRectPlatform(
  vec3 color,
  vec2 worldPos,
  vec4 platformRect,
  float motion,
  float platformType,
  float platformShake,
  float platformDurability
) {
  vec3 outline = vec3(0.02, 0.07, 0.09);
  vec3 blockDark = vec3(0.13, 0.43, 0.45);
  vec3 blockMain = vec3(0.26, 0.76, 0.72);
  vec3 blockLight = vec3(0.61, 1.00, 0.92);
  float brittle = step(0.5, platformType);
  float aged = brittle * (1.0 - clamp(platformDurability, 0.0, 1.0));
  float shake = brittle * clamp(platformShake, 0.0, 1.0);

  vec2 shakenPos = worldPos;
  shakenPos.x += sin(uTime * 55.0 + platformRect.y * 4.1) * shake * 0.08;
  shakenPos.y += sin(uTime * 41.0 + platformRect.x * 2.7) * shake * 0.04;

  vec2 local = (shakenPos - platformRect.xy) / max(platformRect.zw, vec2(0.0001));
  float body = rectMask(shakenPos, platformRect);
  float inner = rectMask(
    shakenPos,
    vec4(
      platformRect.x + 0.08,
      platformRect.y + 0.06,
      max(platformRect.z - 0.16, 0.0),
      max(platformRect.w - 0.12, 0.0)
    )
  );
  float border = max(body - inner, 0.0);

  float scroll = -motion * uTime * 0.8;
  float scan = step(0.5, fract((shakenPos.x - platformRect.x + scroll) * 0.85 + platformRect.y * 0.23));
  float crackNoise = fract(
    (shakenPos.x - platformRect.x) * 2.7 +
    (shakenPos.y - platformRect.y) * 4.9 +
    platformRect.y * 0.47
  );
  float crackMask = brittle * inner * step(crackNoise, 0.09 + aged * 0.06);

  vec3 agedDark = vec3(0.07, 0.24, 0.26);
  vec3 agedMain = vec3(0.20, 0.56, 0.53);
  vec3 agedLight = vec3(0.42, 0.80, 0.73);
  blockDark = mix(blockDark, agedDark, brittle);
  blockMain = mix(blockMain, agedMain, brittle);
  blockLight = mix(blockLight, agedLight, brittle);
  vec3 fill = mix(blockDark, blockMain, clamp(local.y, 0.0, 1.0) * 0.6 + scan * 0.22);
  fill = mix(fill, blockDark * 0.82, crackMask);

  color = mix(color, fill, inner);
  color = mix(color, outline, border);
  color = mix(color, blockLight, inner * (0.08 + min(abs(motion) * 0.03, 0.14)));

  return color;
}

vec3 drawPlatforms(vec3 color, vec2 worldPos) {
  for (int i = 0; i < 48; i++) {
    float enabled = step(float(i) + 0.5, uPlatformCount);
    vec4 platformRect = uPlatforms[i];
    float platformMotion = uPlatformMotion[i];
    float platformType = uPlatformType[i];
    float platformShake = uPlatformShake[i];
    float platformDurability = uPlatformDurability[i];
    vec3 nextColor = drawRectPlatform(
      color,
      worldPos,
      platformRect,
      platformMotion,
      platformType,
      platformShake,
      platformDurability
    );
    color = mix(color, nextColor, enabled);
  }

  return color;
}

vec3 drawBaseFloor(vec3 color, vec2 worldPos) {
  vec3 outline = vec3(0.02, 0.07, 0.09);
  vec3 blockDark = vec3(0.13, 0.43, 0.45);
  vec3 blockMain = vec3(0.26, 0.76, 0.72);
  vec3 blockLight = vec3(0.61, 1.00, 0.92);

  float body = step(0.0, worldPos.y) * step(worldPos.y, 1.12);
  float inner = step(0.06, worldPos.y) * step(worldPos.y, 1.02);
  float border = max(body - inner, 0.0);
  float localY = clamp(worldPos.y / 1.12, 0.0, 1.0);
  float scan = step(0.5, fract((worldPos.x + 0.28) * 0.82 + 0.11));
  vec3 fill = mix(blockDark, blockMain, localY * 0.62 + scan * 0.21);

  color = mix(color, fill, inner);
  color = mix(color, outline, border);
  color = mix(color, blockLight, inner * 0.10);

  return color;
}

vec3 drawLadders(vec3 color, vec2 worldPos, float pixelSize) {
  vec3 rungDark = vec3(0.10, 0.32, 0.36);
  vec3 rungMain = vec3(0.33, 0.92, 0.84);
  vec3 rungLight = vec3(0.62, 1.00, 0.93);

  for (int i = 0; i < 40; i++) {
    float enabled = step(float(i) + 0.5, uLadderCount);
    vec4 ladder = uLadders[i];
    float snappedWidth = max(pixelSize, floor(ladder.z / pixelSize + 0.5) * pixelSize);
    float snappedHeight = max(pixelSize, floor(ladder.w / pixelSize + 0.5) * pixelSize);
    float snappedX = floor(ladder.x / pixelSize + 0.5) * pixelSize;
    float snappedY = floor(ladder.y / pixelSize + 0.5) * pixelSize;

    vec4 shaft = vec4(
      snappedX - snappedWidth * 0.5,
      snappedY,
      snappedWidth,
      snappedHeight
    );
    vec4 leftRail = vec4(
      snappedX - snappedWidth * 0.5,
      snappedY,
      snappedWidth * 0.22,
      snappedHeight
    );
    vec4 rightRail = vec4(
      snappedX + snappedWidth * 0.28,
      snappedY,
      snappedWidth * 0.22,
      snappedHeight
    );

    float shaftMask = rectMask(worldPos, shaft);
    float leftMask = rectMask(worldPos, leftRail);
    float rightMask = rectMask(worldPos, rightRail);

    // Keep rung alignment global so all ladders share the same visual pattern.
    float rungPhase = fract(worldPos.y / 0.52);
    float rungBand = step(0.60, rungPhase) * step(rungPhase, 0.86);
    float rungMask = rectMask(
      worldPos,
      vec4(
        snappedX - snappedWidth * 0.44,
        snappedY,
        snappedWidth * 0.88,
        snappedHeight
      )
    ) * rungBand;

    color = mix(color, rungDark, shaftMask * enabled);
    color = mix(color, rungMain, (leftMask + rightMask) * enabled);
    color = mix(color, rungLight, rungMask * enabled);
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

vec3 drawPortals(vec3 color, vec2 worldPos) {
  vec3 frameDark = vec3(0.05, 0.15, 0.18);
  vec3 portalMain = vec3(0.20, 0.62, 0.90);
  vec3 portalGlow = vec3(0.68, 0.96, 1.00);

  for (int i = 0; i < 16; i++) {
    float enabled = step(float(i) + 0.5, uPortalCount);
    vec4 portal = uPortals[i];
    float side = uPortalSide[i];
    float body = rectMask(worldPos, portal);
    vec4 innerRect = vec4(
      portal.x + 0.06,
      portal.y + 0.06,
      max(portal.z - 0.12, 0.0),
      max(portal.w - 0.12, 0.0)
    );
    float core = rectMask(worldPos, innerRect);
    float frame = max(body - core, 0.0);

    vec2 center = portal.xy + portal.zw * 0.5;
    vec2 scaled = (worldPos - center) / max(portal.zw * vec2(0.72, 0.48), vec2(0.0001));
    float radius = length(scaled);
    float direction = side < 0.0 ? -1.0 : 1.0;
    float swirlAngle = atan(scaled.y, scaled.x * direction);
    float swirl = 0.5 + 0.5 * sin(swirlAngle * 5.0 + uTime * 7.3 + portal.y * 0.31);
    float stream = smoothstep(1.05, 0.30, radius) * swirl;
    float pulse = smoothstep(0.92, 0.08, radius) * (0.72 + 0.28 * sin(uTime * 6.1 + portal.x * 1.7));

    color = mix(color, frameDark, frame * enabled);
    color = mix(color, portalMain, core * stream * enabled);
    color = mix(color, portalGlow, core * pulse * enabled * 0.85);
  }

  return color;
}

vec3 drawSpikes(vec3 color, vec2 worldPos) {
  vec3 spikeDark = vec3(0.06, 0.20, 0.22);
  vec3 spikeMain = vec3(0.28, 0.85, 0.78);
  vec3 spikeLight = vec3(0.72, 1.00, 0.94);

  for (int i = 0; i < 20; i++) {
    float enabled = step(float(i) + 0.5, uSpikeCount);
    vec4 spike = uSpikes[i];
    float dir = uSpikeDir[i];
    vec4 spikeRect = vec4(spike.x, spike.y, spike.z, spike.w);
    float baseMask = rectMask(worldPos, spikeRect);
    vec2 local = (worldPos - spike.xy) / max(spike.zw, vec2(0.0001));

    float toothHeight = max(0.16, min(0.34, 0.22 + spike.w * 0.12));
    float ty = fract((worldPos.y - spike.y) / toothHeight);
    float ridge = 1.0 - abs(ty - 0.5) * 2.0;
    float inward = dir > 0.0 ? local.x : (1.0 - local.x);
    float spikeMask = baseMask * step(inward, ridge);
    float baseShade = spikeMask * step(inward, 0.24);
    float highlight = spikeMask * step(0.78, ridge) * step(0.58, inward);

    color = mix(color, spikeDark, baseShade * enabled * 1.1);
    color = mix(color, spikeMain, spikeMask * enabled);
    color = mix(color, spikeLight, highlight * enabled);
  }

  return color;
}

vec3 drawSideWalls(vec2 fragPos) {
  vec3 brickDark = vec3(0.03, 0.10, 0.12);
  vec3 brickMain = vec3(0.10, 0.36, 0.40);
  vec3 mortar = vec3(0.45, 0.95, 0.88);

  vec2 brickCoord = fragPos * vec2(0.07, 0.11);
  float rowParity = mod(floor(brickCoord.y), 2.0);
  float brickX = fract(brickCoord.x + rowParity * 0.5);
  float brickY = fract(brickCoord.y);

  float mortarMask = max(1.0 - step(0.08, brickX), 1.0 - step(0.10, brickY));
  float blockShade = 0.66 + 0.34 * sin(floor(brickCoord.x) * 0.71 + floor(brickCoord.y) * 0.53);
  vec3 wall = mix(brickDark, brickMain, blockShade);
  wall = mix(wall, mortar, mortarMask * 0.78);

  float edgeDistance = min(
    abs(fragPos.x - uGameViewport.x),
    abs(fragPos.x - (uGameViewport.x + uGameViewport.z))
  );
  float edgeGlow = 1.0 - step(3.0, edgeDistance);
  wall = mix(wall, vec3(0.70, 1.0, 0.94), edgeGlow * 0.58);

  return wall;
}

vec3 drawHero(vec3 color, vec2 worldPos) {
  if (uHeroVisible < 0.5) {
    return color;
  }

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

vec3 drawSnake(vec3 color, vec2 worldPos) {
  if (uSnakeAlive < 0.5) {
    return color;
  }

  vec2 snakePoint = worldPos - uSnakePos;
  snakePoint.x *= uSnakeFacing;
  float speed = clamp(abs(uSnakeVelocity.x) / 3.2, 0.0, 1.0);
  float ladder = clamp(uSnakeOnLadder, 0.0, 1.0);
  float crawlPhase = uTime * (5.2 + speed * 5.7) + uSnakePos.x * 1.31;
  float wobble = sin((snakePoint.x + 0.35) * 6.9 + crawlPhase) * 0.045 * (1.0 - ladder * 0.85);
  float climbWaveA = sin((snakePoint.y + uSnakePos.y * 0.55) * 10.2 + uTime * 8.6) * 0.075 * ladder;
  float climbWaveB = sin((snakePoint.y + 0.18) * 6.3 - uTime * 5.4) * 0.034 * ladder;
  float climbLift = sin((snakePoint.y + 0.2) * 8.8 + uTime * 6.1) * 0.015 * ladder;
  snakePoint.x += climbWaveA + climbWaveB;
  snakePoint.y -= wobble;
  snakePoint.y += climbLift;

  vec3 outline = vec3(0.02, 0.07, 0.09);
  vec3 bodyDark = vec3(0.10, 0.38, 0.40);
  vec3 bodyMain = vec3(0.25, 0.74, 0.69);
  vec3 bodyLight = vec3(0.56, 1.00, 0.90);

  color = applyRect(color, snakePoint, vec4(-0.56, 0.03, 0.20, 0.22), bodyDark);
  color = applyRect(color, snakePoint, vec4(-0.36, 0.06, 0.22, 0.24), bodyMain);
  color = applyRect(color, snakePoint, vec4(-0.14, 0.08, 0.24, 0.25), bodyMain);
  color = applyRect(color, snakePoint, vec4(0.10, 0.09, 0.26, 0.26), bodyMain);
  color = applyRect(color, snakePoint, vec4(0.34, 0.10, 0.20, 0.24), bodyMain);
  color = applyRect(color, snakePoint, vec4(0.38, 0.14, 0.17, 0.16), bodyLight);

  color = applyRect(color, snakePoint, vec4(-0.54, 0.01, 0.06, 0.25), outline);
  color = applyRect(color, snakePoint, vec4(-0.31, 0.03, 0.05, 0.28), outline);
  color = applyRect(color, snakePoint, vec4(-0.08, 0.05, 0.05, 0.29), outline);
  color = applyRect(color, snakePoint, vec4(0.15, 0.06, 0.05, 0.29), outline);
  color = applyRect(color, snakePoint, vec4(0.40, 0.08, 0.05, 0.25), outline);
  color = applyRect(color, snakePoint, vec4(0.44, 0.22, 0.03, 0.03), outline);

  return color;
}

void main() {
  vec2 fragPos = gl_FragCoord.xy;
  vec2 gameMin = uGameViewport.xy;
  vec2 gameMax = uGameViewport.xy + uGameViewport.zw;
  float inGame = step(gameMin.x, fragPos.x) * step(fragPos.x, gameMax.x) *
    step(gameMin.y, fragPos.y) * step(fragPos.y, gameMax.y);

  if (inGame < 0.5) {
    vec3 wallColor = drawSideWalls(fragPos);
    float wallScanline = 0.94 + 0.06 * sin(gl_FragCoord.y * 0.7);
    wallColor *= wallScanline;
    wallColor = floor(wallColor * 24.0) / 24.0;
    gl_FragColor = vec4(wallColor, 1.0);
    return;
  }

  vec2 uv = (fragPos - uGameViewport.xy) / max(uGameViewport.zw, vec2(1.0));
  vec2 worldPos = uCameraPos +
    vec2((uv.x - 0.5) * uViewSize.x, (uv.y - 0.5) * uViewSize.y);
  worldPos.y = uCameraPos.y + (worldPos.y - uCameraPos.y) / VERTICAL_SCALE;

  float pixelSize = max((uViewSize.y / max(uResolution.y, 1.0)) * 4.0, 0.004);
  worldPos = floor(worldPos / pixelSize) * pixelSize;

  vec3 color = vec3(0.0, 0.0, 0.0);
  color = drawBaseFloor(color, worldPos);
  color = drawPlatforms(color, worldPos);
  color = drawLadders(color, worldPos, pixelSize);
  color = drawPortals(color, worldPos);
  color = drawSpikes(color, worldPos);
  color = drawCollectibles(color, worldPos);
  color = drawSnake(color, worldPos);
  color = drawHero(color, worldPos);

  float topZoneStart = 0.85;
  float topZoneBlend = smoothstep(topZoneStart - 0.03, topZoneStart + 0.01, uv.y);
  float topZoneGradient = smoothstep(topZoneStart, 1.0, uv.y);
  float topZoneVisibility = mix(0.35, 1.0, topZoneGradient);
  color *= mix(1.0, topZoneVisibility, topZoneBlend);

  float scanline = 0.95 + 0.05 * sin(gl_FragCoord.y * 0.7);
  color *= scanline;
  color = floor(color * 24.0) / 24.0;

  gl_FragColor = vec4(color, 1.0);
}
