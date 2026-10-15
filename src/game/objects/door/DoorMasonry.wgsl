uniform material_diffuse: vec3f;
uniform uStoneFaceSize: vec2f;

fn getAlbedo() {
  let position = vPositionW;
  let surface = vUv1 * uniform.uStoneFaceSize;
  let course = vUv1;
  let footprint = fwidth(course);
  let detail = 1.0 - smoothstep(0.2, 0.75, max(footprint.x, footprint.y));
  let cell = floor(vPositionW.xz * 3.0);
  let edge = min(vUv1, vec2f(1.0) - vUv1) * uniform.uStoneFaceSize;
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
