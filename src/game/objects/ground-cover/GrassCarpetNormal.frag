void getNormal() {
  // A short dense canopy catches light as a soft surface. Keep some blade
  // orientation without the black side faces of individually lit spikes.
  dNormalW = normalize(mix(vec3(0.0, 1.0, 0.0), dVertexNormalW, 0.18));
}
