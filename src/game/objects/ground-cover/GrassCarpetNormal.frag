void getNormal() {
  // A short dense canopy catches light as a soft surface. Keep some blade
  // orientation without the black side faces of individually lit spikes.
  dNormalW = normalize(mix(vec3(0.0, 1.0, 0.0), dVertexNormalW, 0.18));
  if (uGrassEdge > 0.5) {
    // Keep the lip's small planar facets instead of interpolating a rounded rim.
    vec3 faceNormal = normalize(cross(dFdx(vPositionW), dFdy(vPositionW)));
    dNormalW = faceNormal * (dot(faceNormal, dVertexNormalW) < 0.0 ? -1.0 : 1.0);
  }
}
