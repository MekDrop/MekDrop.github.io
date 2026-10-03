/**
 * Continuous support beneath the authored treads for an Ammo character.
 * @param {typeof import("playcanvas")} pc
 * @param {{device:object,material:object,innerRadius:number,outerRadius:number,rise:number,turns:number,steps:number,landingProfile?:boolean}} options
 * @returns {import("playcanvas").MeshInstance}
 */
export function createSpiralStairCollision(pc, { device, material, innerRadius, outerRadius, rise, turns, steps, landingProfile = false }) {
  const positions = [];
  const indices = [];
  const segments = steps * 4;
  // A helical quad is twisted. Subdivide across its width as well as around
  // the turn so triangulation cannot create steep diagonal ridges in the lane.
  const radialSegments = 16;
  const row = radialSegments + 1;
  const stride = row * 2;
  for (let angleIndex = 0; angleIndex <= segments; angleIndex++) {
    const angle = angleIndex / segments * turns * Math.PI * 2;
    const progress = angleIndex / segments;
    // Begin at floor level, blending the tread offset over six steps to avoid a steep entry lip.
    const height = rise * spiralStairRise(Math.min(1, progress + Math.min(1, progress * steps / 6) / steps), landingProfile);
    for (const y of [height, height - 0.08]) {
      for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex++) {
        const radius = innerRadius + (outerRadius - innerRadius) * radialIndex / radialSegments;
        positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      }
    }
    if (angleIndex === segments) continue;
    const v = angleIndex * stride;
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex++) {
      const a = v + radialIndex, b = a + 1, c = b + stride, d = a + stride;
      indices.push(a, b, c, a, c, d, a + row, d + row, c + row, a + row, c + row, b + row);
    }
    for (const radialIndex of [0, radialSegments]) {
      const a = v + radialIndex, b = a + stride;
      indices.push(a, b, b + row, a, b + row, a + row);
    }
  }
  for (const v of [0, segments * stride]) {
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex++) {
      const a = v + radialIndex;
      indices.push(a, a + row, a + row + 1, a, a + row + 1, a + 1);
    }
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(positions);
  mesh.setIndices(indices);
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return new pc.MeshInstance(mesh, material, new pc.GraphNode("Spiral tread support"));
}

/**
 * A slower lower flight leaves headroom beneath the exit-side landing.
 * The upper flight stays below the hero's climbable slope and step height.
 * @param {number} progress
 * @param {boolean} landingProfile
 * @returns {number}
 */
export function spiralStairRise(progress, landingProfile = false) {
  if (!landingProfile) return progress;
  return progress <= 0.5 ? progress * 0.5 : 0.25 + (progress - 0.5) * 1.5;
}
