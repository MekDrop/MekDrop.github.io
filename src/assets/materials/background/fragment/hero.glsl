vec3 heroSprite(vec2 world) {
  vec4 heroRect = vec4(uPlayerBox.x - uPlayerBox.z * 0.5, uPlayerBox.y, uPlayerBox.z, uPlayerBox.w);
  if (rectMask(world, heroRect) < 0.5) {
    return vec3(-1.0);
  }

  vec2 local = (world - heroRect.xy) / vec2(heroRect.z, heroRect.w);
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
  color += vec3(0.82, 0.16, 0.12) * (hat + brim);
  color += vec3(0.08, 0.16, 0.42) * torso;
  color += vec3(0.93, 0.84, 0.34) * bib;
  color += vec3(0.40, 0.26, 0.16) * (legBack + legFront + bootBack + bootFront + moustache);
  color += vec3(0.98, 0.98, 0.94) * eye;
  return color;
}

void drawHero(inout vec3 color, vec2 world) {
  vec3 layer = heroSprite(world);
  if (layer.x < 0.0) {
    return;
  }

  float blink = step(0.5, mod(floor(uTime * 14.0), 2.0));
  float invulnMask = step(0.05, uPlayerState.y);
  float visible = mix(1.0, blink, invulnMask);
  applyLayer(color, layer, visible);
}
