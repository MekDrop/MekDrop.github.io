uniform vec3 uCloudTopColor;
uniform vec3 uCloudSideColor;
uniform vec3 uLightDirection;
uniform float uOpacity;

varying vec3 vCubePosition;
varying vec3 vWorldNormal;

float faceEdgeDistance(vec3 position, vec3 normal) {
  vec3 axis = abs(normal);
  if (axis.x > axis.y && axis.x > axis.z) {
    return min(0.5 - abs(position.y), 0.5 - abs(position.z));
  }
  if (axis.y > axis.z) {
    return min(0.5 - abs(position.x), 0.5 - abs(position.z));
  }
  return min(0.5 - abs(position.x), 0.5 - abs(position.y));
}

void main(void) {
  vec3 normal = normalize(vWorldNormal);
  float topFace = smoothstep(0.35, 0.9, normal.y);
  float diffuseLight = max(dot(normal, normalize(uLightDirection)), 0.0);
  float lightAmount = 0.78 + diffuseLight * 0.22;
  vec3 cloudColor = mix(uCloudSideColor, uCloudTopColor, topFace);

  float edgeDistance = faceEdgeDistance(vCubePosition, normal);
  float softEdge = smoothstep(0.0, 0.055, edgeDistance);
  float alpha = uOpacity * mix(0.86, 1.0, softEdge);

  gl_FragColor = vec4(cloudColor * lightAmount, alpha);
}
