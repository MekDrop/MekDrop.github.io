#include "transformCoreVS"

varying float vWorldHeight;
varying vec3 vWorldPosition;

void main(void) {
  vec3 localPosition = getLocalPosition(vertex_position.xyz);
  vec4 worldPosition = getModelMatrix() * vec4(localPosition, 1.0);

  vWorldHeight = worldPosition.y;
  vWorldPosition = worldPosition.xyz;
  gl_Position = matrix_viewProjection * worldPosition;
}
