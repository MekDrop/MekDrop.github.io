void drawCollectibles(inout vec3 color, vec2 world) {
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
