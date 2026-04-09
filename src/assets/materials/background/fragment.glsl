precision highp float;

#define MAX_SOLIDS 64
#define MAX_ENEMIES 40
#define MAX_COINS 40

uniform vec2 uResolution;
uniform vec4 uViewport;
uniform vec2 uWorldSize;
uniform float uTime;
uniform float uPixelScale;
uniform vec4 uPlayerBox;
uniform vec4 uPlayerMotion;
uniform vec4 uPlayerState;
uniform vec4 uGoal;
uniform vec4 uSolids[MAX_SOLIDS];
uniform vec4 uSolidMeta[MAX_SOLIDS];
uniform float uSolidCount;
uniform vec4 uEnemies[MAX_ENEMIES];
uniform vec4 uEnemyMeta[MAX_ENEMIES];
uniform float uEnemyCount;
uniform vec4 uCoins[MAX_COINS];
uniform vec4 uCoinMeta[MAX_COINS];
uniform float uCoinCount;
uniform sampler2D uPalette;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

vec3 mono(float value) {
  return vec3(0.94, 0.88, 0.76) * value;
}

vec2 paletteUv(float index) {
  float x = mod(index, 16.0);
  float y = floor(index / 16.0);
  return vec2((x + 0.5) / 16.0, (y + 0.5) / 16.0);
}

float bayer4(vec2 point) {
  vec2 cell = mod(floor(point), 4.0);
  if (cell.y < 0.5) {
    if (cell.x < 0.5) return 0.0;
    if (cell.x < 1.5) return 8.0;
    if (cell.x < 2.5) return 2.0;
    return 10.0;
  }
  if (cell.y < 1.5) {
    if (cell.x < 0.5) return 12.0;
    if (cell.x < 1.5) return 4.0;
    if (cell.x < 2.5) return 14.0;
    return 6.0;
  }
  if (cell.y < 2.5) {
    if (cell.x < 0.5) return 3.0;
    if (cell.x < 1.5) return 11.0;
    if (cell.x < 2.5) return 1.0;
    return 9.0;
  }
  if (cell.x < 0.5) return 15.0;
  if (cell.x < 1.5) return 7.0;
  if (cell.x < 2.5) return 13.0;
  return 5.0;
}

vec3 quantizePalette(vec3 color, vec2 point) {
  vec3 candidate = clamp(color, 0.0, 1.0);
  float dither = (bayer4(point) / 16.0) - 0.46875;
  candidate = clamp(candidate + dither / 255.0, 0.0, 1.0);

  float bestDistance = 999.0;
  vec3 bestColor = candidate;
  for (int i = 0; i < 256; i++) {
    vec3 paletteColor = texture2D(uPalette, paletteUv(float(i))).rgb;
    vec3 delta = candidate - paletteColor;
    float distanceSq = dot(delta, delta);
    if (distanceSq < bestDistance) {
      bestDistance = distanceSq;
      bestColor = paletteColor;
    }
  }
  return bestColor;
}

void applyLayer(inout vec3 color, vec3 layer, float alpha) {
  color = mix(color, layer, saturate(alpha));
}

float rectMask(vec2 point, vec4 rect) {
  return step(rect.x, point.x) * step(rect.y, point.y) *
    step(point.x, rect.x + rect.z) * step(point.y, rect.y + rect.w);
}

float rectBorderMask(vec2 point, vec4 rect, float width) {
  vec4 inner = vec4(rect.x + width, rect.y + width, max(0.0, rect.z - width * 2.0), max(0.0, rect.w - width * 2.0));
  return max(0.0, rectMask(point, rect) - rectMask(point, inner));
}

float circleMask(vec2 point, vec2 center, float radius) {
  return 1.0 - step(radius, distance(point, center));
}

float ringMask(vec2 point, vec2 center, float radius, float width) {
  return max(0.0, circleMask(point, center, radius) - circleMask(point, center, max(0.0, radius - width)));
}

float lineMask(vec2 point, vec2 a, vec2 b, float width) {
  vec2 pa = point - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return 1.0 - step(width, length(pa - ba * h));
}

float ellipseMask(vec2 point, vec2 center, vec2 radius) {
  vec2 local = (point - center) / max(radius, vec2(0.001));
  return 1.0 - step(1.0, dot(local, local));
}

float checker(vec2 point, float scale) {
  vec2 cell = floor(point / scale);
  return mod(cell.x + cell.y, 2.0);
}

float cloudMask(vec2 point, vec2 center, vec2 scale) {
  float puffA = ellipseMask(point, center + vec2(-scale.x * 0.24, 0.0), vec2(scale.x * 0.42, scale.y * 0.30));
  float puffB = ellipseMask(point, center + vec2(scale.x * 0.04, scale.y * 0.12), vec2(scale.x * 0.46, scale.y * 0.34));
  float puffC = ellipseMask(point, center + vec2(scale.x * 0.34, 0.0), vec2(scale.x * 0.38, scale.y * 0.28));
  float base = rectMask(point, vec4(center.x - scale.x * 0.50, center.y - scale.y * 0.18, scale.x, scale.y * 0.32));
  return saturate(puffA + puffB + puffC + base);
}

vec3 drawBackdrop(vec2 world) {
  float horizon = world.y / max(uWorldSize.y, 1.0);
  return mix(vec3(0.43, 0.64, 0.84), vec3(0.59, 0.78, 0.93), horizon);
}

vec3 solidColor(vec2 world, vec4 solid, float type) {
  float fill = rectMask(world, solid);
  if (fill < 0.5) {
    return vec3(-1.0);
  }

  float border = rectBorderMask(world, solid, 1.0);
  float topStripe = rectMask(world, vec4(solid.x, solid.y + solid.w - 2.0, solid.z, 2.0));
  vec2 local = world - solid.xy;
  vec3 color = vec3(0.18, 0.20, 0.16);

  if (type < 0.5) {
    float turf = rectMask(world, vec4(solid.x, solid.y + solid.w - 3.0, solid.z, 3.0));
    float soil = checker(local + vec2(0.0, floor(local.y * 0.5)), 4.0);
    color = mix(vec3(0.37, 0.25, 0.17), vec3(0.49, 0.35, 0.21), soil);
    color = mix(color, vec3(0.43, 0.67, 0.26), turf * 0.95);
  } else if (type < 1.5) {
    float mortar = step(0.0, abs(mod(local.x, 4.0) - 0.5) - 1.2) * 0.0;
    float seams = rectBorderMask(vec2(mod(local.x, 8.0), mod(local.y, 4.0)), vec4(0.0, 0.0, 8.0, 4.0), 0.7);
    color = mix(vec3(0.54, 0.43, 0.27), vec3(0.69, 0.57, 0.36), checker(local, 4.0));
    color += mono(0.06) * seams;
    color += vec3(0.0) * mortar;
  } else if (type < 2.5) {
    float lip = rectMask(world, vec4(solid.x - 1.0, solid.y + solid.w - 2.0, solid.z + 2.0, 3.0));
    float ribs = step(0.0, sin((local.x + 1.0) * 0.85)) * 0.08;
    color = vec3(0.25, 0.43, 0.34) + mono(0.02) * ribs;
    color = mix(color, vec3(0.54, 0.74, 0.49), lip);
  } else if (type < 3.5) {
    float steps = checker(local + vec2(local.y * 0.2, 0.0), 3.0);
    color = mix(vec3(0.59, 0.41, 0.31), vec3(0.77, 0.58, 0.44), steps);
  } else {
    float slats = rectBorderMask(vec2(mod(local.x, 6.0), local.y), vec4(0.0, 0.0, 6.0, solid.w), 0.7);
    color = vec3(0.46, 0.29, 0.18) + mono(0.05) * slats;
    color = mix(color, vec3(0.70, 0.50, 0.30), topStripe * 0.88);
  }

  color = mix(color, vec3(0.83, 0.68, 0.43), border * 0.9);
  color = mix(color, vec3(0.67, 0.85, 0.38), topStripe * 0.75);
  return color;
}

void drawSolids(inout vec3 color, vec2 world) {
  for (int i = 0; i < MAX_SOLIDS; i++) {
    if (float(i) >= uSolidCount) {
      break;
    }
    vec3 layer = solidColor(world, uSolids[i], uSolidMeta[i].x);
    if (layer.x >= 0.0) {
      applyLayer(color, layer, 1.0);
    }
  }
}

void drawCoins(inout vec3 color, vec2 world) {
  for (int i = 0; i < MAX_COINS; i++) {
    if (float(i) >= uCoinCount) {
      break;
    }
    if (uCoinMeta[i].x > 0.5) {
      continue;
    }

    vec2 center = uCoins[i].xy;
    float radius = uCoins[i].z;
    float pulse = 0.5 + 0.5 * sin(uTime * 6.0 + uCoinMeta[i].y);
    float ring = ringMask(world, center, radius + pulse * 0.4, 1.0);
    float core = rectMask(world, vec4(center.x - 0.5, center.y - 1.8, 1.0, 3.6));
    applyLayer(color, vec3(0.98, 0.78, 0.24), ring * 0.95);
    applyLayer(color, vec3(0.86, 0.54, 0.12), core * 0.82);
  }
}

void drawGoal(inout vec3 color, vec2 world) {
  if (uGoal.w < 0.5) {
    return;
  }

  float doorHeight = uGoal.z;
  vec4 frame = vec4(uGoal.x - 3.1, uGoal.y, 6.2, doorHeight);
  vec4 panel = vec4(uGoal.x - 2.25, uGoal.y + 0.8, 4.5, max(1.0, doorHeight - 1.4));
  float frameMask = rectBorderMask(world, frame, 0.85);
  float panelMask = rectMask(world, panel);
  float panelInset = rectBorderMask(world, panel, 0.6);
  float slit = rectMask(world, vec4(uGoal.x - 0.18, uGoal.y + doorHeight * 0.55, 0.36, max(1.6, doorHeight * 0.28)));
  float knob = circleMask(world, vec2(uGoal.x + 1.3, uGoal.y + doorHeight * 0.40), 0.46);
  float beaconPulse = 0.45 + 0.55 * sin(uTime * 5.5);
  float beacon = ringMask(world, vec2(uGoal.x, uGoal.y + doorHeight + 2.1), 1.2 + beaconPulse * 0.55, 0.55);

  applyLayer(color, vec3(0.73, 0.57, 0.31), frameMask);
  applyLayer(color, vec3(0.28, 0.19, 0.14), panelMask * 0.95);
  applyLayer(color, vec3(0.47, 0.29, 0.18), panelInset * 0.82);
  applyLayer(color, vec3(0.90, 0.69, 0.23), slit * 0.72);
  applyLayer(color, vec3(0.98, 0.85, 0.51), knob);
  applyLayer(color, vec3(0.84, 0.55, 0.25), beacon * 0.6);
}

vec3 playerSprite(vec2 world) {
  vec4 playerRect = vec4(uPlayerBox.x - uPlayerBox.z * 0.5, uPlayerBox.y, uPlayerBox.z, uPlayerBox.w);
  if (rectMask(world, playerRect) < 0.5) {
    return vec3(-1.0);
  }

  vec2 local = (world - playerRect.xy) / vec2(playerRect.z, playerRect.w);
  if (uPlayerMotion.z < 0.0) {
    local.x = 1.0 - local.x;
  }

  float hat = rectMask(local, vec4(0.08, 0.79, 0.76, 0.13));
  float brim = rectMask(local, vec4(0.02, 0.71, 0.68, 0.07));
  float face = rectMask(local, vec4(0.20, 0.46, 0.55, 0.24));
  float nose = rectMask(local, vec4(0.56, 0.53, 0.09, 0.09));
  float moustache = rectMask(local, vec4(0.28, 0.42, 0.38, 0.08));
  float torso = rectMask(local, vec4(0.18, 0.23, 0.44, 0.28));
  float bib = rectMask(local, vec4(0.29, 0.27, 0.16, 0.18));
  float arm = rectMask(local, vec4(0.60, 0.30, 0.12, 0.18));
  float legLift = 0.04 * sin(uPlayerMotion.w * 0.9);
  float legBack = rectMask(local, vec4(0.20, 0.0, 0.14, 0.26 + legLift));
  float legFront = rectMask(local, vec4(0.42, 0.0, 0.14, 0.30 - legLift));
  float bootBack = rectMask(local, vec4(0.14, 0.0, 0.22, 0.07));
  float bootFront = rectMask(local, vec4(0.40, 0.0, 0.22, 0.07));
  float eye = rectMask(local, vec4(0.50, 0.58, 0.05, 0.06));
  float spriteMask = saturate(
    hat + brim + face + nose + moustache + torso + bib + arm +
    legBack + legFront + bootBack + bootFront + eye
  );
  if (spriteMask < 0.5) {
    return vec3(-1.0);
  }

  vec3 color = vec3(0.0);
  color += vec3(0.92, 0.74, 0.54) * (face + arm + nose);
  color += vec3(0.74, 0.18, 0.17) * (hat + brim);
  color += vec3(0.26, 0.43, 0.86) * (torso + bib);
  color += vec3(0.40, 0.26, 0.16) * (legBack + legFront + bootBack + bootFront + moustache);
  color += vec3(0.98, 0.98, 0.94) * eye;
  return color;
}

vec3 enemySprite(vec2 world, vec4 body, vec4 meta) {
  if (meta.x < 0.5) {
    return vec3(-1.0);
  }

  vec4 enemyRect = vec4(body.x - body.z * 0.5, body.y, body.z, body.w);
  if (rectMask(world, enemyRect) < 0.5) {
    return vec3(-1.0);
  }

  vec2 local = (world - enemyRect.xy) / vec2(enemyRect.z, enemyRect.w);
  if (meta.y < 0.0) {
    local.x = 1.0 - local.x;
  }

  float sway = 0.05 * sin(meta.z * 1.3);
  float bodyMask = rectMask(local, vec4(0.08, 0.18, 0.84, 0.60));
  float brow = rectMask(local, vec4(0.14, 0.58, 0.72, 0.10));
  float eyeL = rectMask(local, vec4(0.24, 0.38, 0.16, 0.20));
  float eyeR = rectMask(local, vec4(0.52, 0.38, 0.16, 0.20));
  float pupilL = rectMask(local, vec4(0.29, 0.42, 0.06, 0.10));
  float pupilR = rectMask(local, vec4(0.57, 0.42, 0.06, 0.10));
  float footL = rectMask(local, vec4(0.18 + sway, 0.0, 0.20, 0.14));
  float footR = rectMask(local, vec4(0.50 - sway, 0.0, 0.20, 0.14));
  float spriteMask = saturate(bodyMask + brow + eyeL + eyeR + pupilL + pupilR + footL + footR);
  if (spriteMask < 0.5) {
    return vec3(-1.0);
  }

  vec3 color = vec3(0.0);
  color += vec3(0.74, 0.46, 0.28) * bodyMask;
  color += vec3(0.33, 0.18, 0.11) * (brow + footL + footR);
  color += vec3(0.98, 0.96, 0.88) * (eyeL + eyeR);
  color += vec3(0.11, 0.05, 0.03) * (pupilL + pupilR);
  return color;
}

void drawEnemies(inout vec3 color, vec2 world) {
  for (int i = 0; i < MAX_ENEMIES; i++) {
    if (float(i) >= uEnemyCount) {
      break;
    }
    if (uEnemyMeta[i].x < 0.5) {
      continue;
    }
    vec3 layer = enemySprite(world, uEnemies[i], uEnemyMeta[i]);
    if (layer.x >= 0.0) {
      applyLayer(color, layer, 1.0);
    }
  }
}

void drawPlayer(inout vec3 color, vec2 world) {
  vec3 layer = playerSprite(world);
  if (layer.x < 0.0) {
    return;
  }

  float blink = step(0.5, mod(floor(uTime * 14.0), 2.0));
  float invulnMask = step(0.05, uPlayerState.y);
  float visible = mix(1.0, blink, invulnMask);
  applyLayer(color, layer, visible);
}

vec3 drawOutside(vec2 fragPos) {
  vec2 uv = fragPos / max(uResolution, vec2(1.0));
  float vignette = saturate(1.0 - dot(uv - 0.5, uv - 0.5) * 1.8);
  return vec3(0.12, 0.18, 0.24) * vignette;
}

void main() {
  vec2 fragPos = gl_FragCoord.xy;
  vec2 minCorner = uViewport.xy;
  vec2 maxCorner = uViewport.xy + uViewport.zw;
  float inside = step(minCorner.x, fragPos.x) * step(minCorner.y, fragPos.y) *
    step(fragPos.x, maxCorner.x) * step(fragPos.y, maxCorner.y);

  if (inside < 0.5) {
    gl_FragColor = vec4(quantizePalette(drawOutside(fragPos), fragPos), 1.0);
    return;
  }

  vec2 viewportUv = (fragPos - minCorner) / max(uViewport.zw, vec2(1.0));
  vec2 renderResolution = floor(uViewport.zw / max(uPixelScale, 1.0));
  renderResolution = max(renderResolution, uWorldSize);
  vec2 uv = floor(viewportUv * renderResolution) / renderResolution;
  uv += 0.5 / renderResolution;

  vec2 world = vec2(uv.x * uWorldSize.x, uv.y * uWorldSize.y);
  vec3 color = drawBackdrop(world);

  drawSolids(color, world);
  drawGoal(color, world);
  drawCoins(color, world);
  drawEnemies(color, world);
  drawPlayer(color, world);

  float deathFade = 1.0 - step(0.25, abs(uPlayerState.z - 1.0));
  color = mix(color, vec3(0.10, 0.05, 0.08), deathFade * 0.12);
  color = quantizePalette(color, fragPos);

  gl_FragColor = vec4(color, 1.0);
}
