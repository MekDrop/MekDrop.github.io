uniform vec3 material_diffuse;
uniform vec2 uStoneFaceSize;

void getAlbedo() {
  vec3 position = vPositionW;
  vec2 surface = vUv1 * uStoneFaceSize;
  vec2 course = vUv1;
  vec2 footprint = fwidth(course);
  float detail = 1.0 - smoothstep(0.2, 0.75, max(footprint.x, footprint.y));
  vec2 cell = floor(vPositionW.xz * 3.0);
  vec2 edge = min(vUv1, 1.0 - vUv1) * uStoneFaceSize;
  vec2 aa = max(fwidth(surface), vec2(0.0005));
  vec2 joints = smoothstep(vec2(0.004) - aa, vec2(0.004) + aa, edge);
  float face = min(joints.x, joints.y);
  float shade = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  float grain = fract(sin(dot(floor(position * 180.0), vec3(17.1, 91.7, 43.3))) * 15731.743);
  float grainFootprint = max(max(fwidth(position).x, fwidth(position).y), fwidth(position).z) * 180.0;
  grain = mix(0.5, grain, 1.0 - smoothstep(0.2, 0.75, grainFootprint));
  float bevel = smoothstep(0.004 - max(aa.x, aa.y), 0.014 + max(aa.x, aa.y), min(edge.x, edge.y));
  vec3 block = material_diffuse * (0.9 + shade * 0.12) * (0.98 + grain * 0.04);
  block *= mix(0.78, 1.0, bevel);
  // Preserve the average stone/mortar colour once individual courses are subpixel.
  vec3 masonry = mix(material_diffuse * 0.46, block, face);
  dAlbedo = mix(material_diffuse * 0.93, masonry, detail);
}
