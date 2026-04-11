vec3 solidColor(vec2 world, vec4 solid, float type) {
  return vec3(-1.0);
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
