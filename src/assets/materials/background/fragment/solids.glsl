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
