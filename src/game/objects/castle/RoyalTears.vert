#include "transformCoreVS"

attribute vec2 vertex_texCoord0;
varying vec2 vUv;

void main(void) {
  vUv = vertex_texCoord0;
  gl_Position = matrix_viewProjection * getModelMatrix()
      * vec4(getLocalPosition(vertex_position.xyz), 1.0);
}
