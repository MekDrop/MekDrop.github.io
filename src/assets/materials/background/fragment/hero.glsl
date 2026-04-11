vec3 heroSprite(vec2 world) {
  return vec3(-1.0);
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
