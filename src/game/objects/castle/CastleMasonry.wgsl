uniform material_diffuse: vec3f;
uniform uWorldToCastle: mat4x4f;

fn getAlbedo() {
  let position = (uniform.uWorldToCastle * vec4f(vPositionW, 1.0)).xyz;
  let normal = abs((uniform.uWorldToCastle * vec4f(vNormalW, 0.0)).xyz);
  var surface = position.xy;
  if (normal.x > normal.z) { surface = position.zy; }
  if (normal.y > max(normal.x, normal.z)) { surface = position.xz; }

  var course = surface / vec2f(0.5, 0.25);
  // Measure the continuous coordinates before staggering introduces discontinuities.
  let footprint = fwidth(course);
  let detail = 1.0 - smoothstep(0.2, 0.75, max(footprint.x, footprint.y));
  course.x += (floor(course.y) - floor(floor(course.y) / 2.0) * 2.0) * 0.5;
  let cell = floor(course);
  let edge = min(fract(course), 1.0 - fract(course)) * vec2f(0.5, 0.25);
  let aa = max(fwidth(surface), vec2f(0.0005));
  let joints = smoothstep(vec2f(0.004) - aa, vec2f(0.004) + aa, edge);
  let face = min(joints.x, joints.y);
  let shade = fract(sin(dot(cell, vec2f(127.1, 311.7))) * 43758.5453);
  var grain = fract(sin(dot(floor(position * 180.0), vec3f(17.1, 91.7, 43.3))) * 15731.743);
  let grainWidth = fwidth(position) * 180.0;
  let grainFootprint = max(max(grainWidth.x, grainWidth.y), grainWidth.z);
  grain = mix(0.5, grain, 1.0 - smoothstep(0.2, 0.75, grainFootprint));
  let bevel = smoothstep(0.004 - max(aa.x, aa.y), 0.014 + max(aa.x, aa.y), min(edge.x, edge.y));
  var block = uniform.material_diffuse * (0.9 + shade * 0.12) * (0.98 + grain * 0.04);
  block *= mix(0.78, 1.0, bevel);
  // Preserve the average stone/mortar colour once individual courses are subpixel.
  let masonry = mix(uniform.material_diffuse * 0.46, block, face);
  dAlbedo = mix(uniform.material_diffuse * 0.93, masonry, detail);
}
