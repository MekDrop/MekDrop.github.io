attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;

varying vec2 vUv;
varying float vSurfaceWave;

void main(void) {
  vec2 centered = vertex_texCoord0 - vec2(0.5);
  float radius = length(centered);
  float radialWave = sin(radius * 42.0 - uTime * 4.2);
  float crossingWave =
      sin(centered.x * 19.0 + uTime * 2.1) *
      cos(centered.y * 17.0 - uTime * 1.7);
  float displacement = radialWave * 0.022 + crossingWave * 0.012;
  vec3 fluidPosition = vertex_position;
  fluidPosition.x += displacement;
  gl_Position =
      matrix_viewProjection * matrix_model * vec4(fluidPosition, 1.0);
  vUv = vertex_texCoord0;
  vSurfaceWave = displacement;
}
