uniform vec3 material_diffuse;
uniform float uGrassSurfaceLift;

float turfNoise(vec2 position) {
  vec2 cell = floor(position);
  vec2 fraction = fract(position);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  vec4 corners = fract(sin(vec4(
    dot(cell, vec2(127.1, 311.7)),
    dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7)),
    dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7)),
    dot(cell + vec2(1.0), vec2(127.1, 311.7))
  )) * 43758.5453);
  return mix(mix(corners.x, corners.y, fraction.x),
    mix(corners.z, corners.w, fraction.x), fraction.y);
}

void getAlbedo() {
  dAlbedo = material_diffuse;
  #ifdef STD_DIFFUSE_TEXTURE
    vec2 uv = {STD_DIFFUSE_TEXTURE_UV};
    vec2 soilUv = vec2(uv.x, 0.4 + uv.y * 0.6);
    vec3 soil = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias(
      {STD_DIFFUSE_TEXTURE_NAME}, soilUv, textureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    // Only a shallow, mottled root bed remains solid. The visible pile and
    // uneven silhouette are the actual grass models above it, not painted ribs.
    float depth = uv.y * (1.0 + uGrassSurfaceLift);
    vec2 position = vec2(vPositionW.x + vPositionW.z, depth);
    float mottling = turfNoise(position * vec2(83.0, 190.0));
    float rootsDepth = uGrassSurfaceLift * (0.65 + mottling * 0.55);
    float edgeWidth = max(fwidth(depth), 0.002);
    float rootsMask = 1.0 - smoothstep(rootsDepth - edgeWidth, rootsDepth + edgeWidth, depth);
    vec3 roots = mix(vec3(0.034, 0.095, 0.013), vec3(0.055, 0.19, 0.022), mottling);
    dAlbedo *= mix(soil, roots, rootsMask);
  #endif
}
