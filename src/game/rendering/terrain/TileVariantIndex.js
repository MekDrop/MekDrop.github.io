export function tileVariantIndex(col, row, level, salt, count) {
  const hash =
    Math.imul(col + 17, 73856093) ^
    Math.imul(row + 31, 19349663) ^
    Math.imul(level + 7, 83492791) ^
    salt;
  return (hash >>> 0) % count;
}

export function tilePatchValue(col, row, level) {
  // Smooth values across neighboring terrain cubes while keeping the final
  // material choice aligned to each cube, with a little irregularity at edges.
  const x = col / 3.5;
  const z = row / 3.5;
  const cellX = Math.floor(x);
  const cellZ = Math.floor(z);
  const fractionX = x - cellX;
  const fractionZ = z - cellZ;
  const blendX = fractionX * fractionX * (3 - 2 * fractionX);
  const blendZ = fractionZ * fractionZ * (3 - 2 * fractionZ);
  const sample = (sampleX, sampleZ) =>
    tileVariantIndex(sampleX, sampleZ, level, 97, 10000) / 10000;
  const north = sample(cellX, cellZ) * (1 - blendX) +
    sample(cellX + 1, cellZ) * blendX;
  const south = sample(cellX, cellZ + 1) * (1 - blendX) +
    sample(cellX + 1, cellZ + 1) * blendX;
  const broadPatch = north * (1 - blendZ) + south * blendZ;
  const localVariation = tileVariantIndex(col, row, level, 53, 10000) / 10000;
  return broadPatch * 0.9 + localVariation * 0.1;
}
