precision highp float;

uniform vec2 uResolution;
uniform sampler2D uTexture;
uniform float uTime;

float calculateQuantizationLevel(float speed, float minColors, float maxColors) {
  return mod(uTime * speed, maxColors - minColors + 1.0) + minColors;
}

vec3 quantizeColor(vec3 color, float quantizationLevel) {
  return round(color * (quantizationLevel - 1.0)) / (quantizationLevel - 1.0);
}

vec2 pixelate(vec2 uv, vec2 resolution) {
  return floor(uv * resolution) / resolution;
}

vec3 addBlueTint(vec3 color, float tintAmount) {
  return vec3(color.r, color.g, min(color.b + tintAmount, 1.0));
}

vec3 addVHSScanlines(vec3 color, vec2 uv, float scanlineIntensity, float scanlineWidth, float scanlineOpacity) {
  float scanline = mod(uv.y * 100.0, 1.0) < scanlineWidth ? scanlineIntensity : 1.0;
  return mix(color, color * scanline, scanlineOpacity); // Corrected the blending here
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  uv = pixelate(uv, vec2(640.0, 480.0));

  float quantizationLevel = calculateQuantizationLevel(0.5, 16.0, 256.0);

  vec4 texColor = texture2D(uTexture, uv);
  vec3 quantizedColor = quantizeColor(texColor.rgb, quantizationLevel);
  quantizedColor = addBlueTint(quantizedColor, 0.3);
  quantizedColor = addVHSScanlines(quantizedColor, uv, 0.9, 0.5, 0.3);

  gl_FragColor = vec4(quantizedColor, texColor.a);
}
