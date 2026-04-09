vec3 foeSprite(vec2 world, vec4 body, vec4 meta) {
  if (meta.x < 0.5) {
    return vec3(-1.0);
  }

  vec4 foeRect = vec4(body.x - body.z * 0.5, body.y, body.z, body.w);
  if (rectMask(world, foeRect) < 0.5) {
    return vec3(-1.0);
  }

  vec2 local = (world - foeRect.xy) / vec2(foeRect.z, foeRect.w);
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
  color += vec3(0.28, 0.56, 0.22) * bodyMask;
  color += vec3(0.12, 0.24, 0.08) * (brow + footL + footR);
  color += vec3(0.98, 0.96, 0.88) * (eyeL + eyeR);
  color += vec3(0.11, 0.05, 0.03) * (pupilL + pupilR);
  return color;
}

void drawFoes(inout vec3 color, vec2 world) {
  for (int i = 0; i < MAX_ENEMIES; i++) {
    if (float(i) >= uEnemyCount) {
      break;
    }
    if (uEnemyMeta[i].x < 0.5) {
      continue;
    }
    vec3 layer = foeSprite(world, uEnemies[i], uEnemyMeta[i]);
    if (layer.x >= 0.0) {
      applyLayer(color, layer, 1.0);
    }
  }
}
