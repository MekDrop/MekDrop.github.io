void getNormal() {
  vec3 surfaceDerivativeX = dFdx(vPositionW);
  vec3 surfaceDerivativeY = dFdy(vPositionW);
  vec3 surfaceNormal = normalize(
    cross(surfaceDerivativeX, surfaceDerivativeY)
  );
  if (dot(surfaceNormal, dVertexNormalW) < 0.0) {
    surfaceNormal *= -1.0;
  }
  dNormalW = surfaceNormal;
}
