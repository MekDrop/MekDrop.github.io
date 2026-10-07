attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;
uniform float uBurstAge;
uniform float uBurstSide;
uniform vec2 uBurstCenter;

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
  // A connected water dome surges outward, then collapses into the membrane.
  float burstProgress = clamp(uBurstAge / 0.275, 0.0, 1.0);
  float burstEnvelope = sin(burstProgress * 3.14159265);
  vec2 burstOffset = (vertex_texCoord0 - uBurstCenter) / vec2(0.32, 0.38);
  float burstShape = pow(max(0.0, 1.0 - dot(burstOffset, burstOffset)), 2.0);
  fluidPosition.x += uBurstSide * burstShape * burstEnvelope * 1.25;
  gl_Position =
      matrix_viewProjection * matrix_model * vec4(fluidPosition, 1.0);
  vUv = vertex_texCoord0;
  vSurfaceWave = displacement;
}
