uniform vec3 material_diffuse;
uniform mat4 uWorldToCastle;

void getAlbedo() {
  vec3 position = (uWorldToCastle * vec4(vPositionW, 1.0)).xyz;
  vec3 normal = abs((uWorldToCastle * vec4(vNormalW, 0.0)).xyz);
  vec2 surface = normal.x > normal.z ? position.zy : position.xy;
  if (normal.y > max(normal.x, normal.z)) surface = position.xz;

  // Half-metre blocks, quarter-metre courses, with alternate half-block bonds.
  vec2 course = surface / vec2(0.5, 0.25);
  course.x += mod(floor(course.y), 2.0) * 0.5;
  vec2 cell = floor(course);
  vec2 edge = min(fract(course), 1.0 - fract(course)) * vec2(0.5, 0.25);
  vec2 aa = max(fwidth(surface), vec2(0.0005));
  vec2 joints = smoothstep(vec2(0.004) - aa, vec2(0.004) + aa, edge);
  float face = min(joints.x, joints.y);
  float shade = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  float grain = fract(sin(dot(floor(position * 180.0), vec3(17.1, 91.7, 43.3))) * 15731.743);
  float bevel = smoothstep(0.004, 0.014, min(edge.x, edge.y));
  vec3 block = material_diffuse * (0.9 + shade * 0.12) * (0.98 + grain * 0.04);
  block *= mix(0.78, 1.0, bevel);
  dAlbedo = mix(material_diffuse * 0.46, block, face);
}
