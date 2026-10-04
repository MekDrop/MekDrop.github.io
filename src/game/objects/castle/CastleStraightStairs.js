/**
 * Two ordinary flights share a full-width turning landing. Coordinates are
 * in the stair frame, with both floor approaches on +Z.
 * @param {{radius:number,rise:number,flightGap?:number,flightShift?:number,landingBack?:number,landingLift?:number,flightBounds?:{minX:number,maxX:number,inner:number}}} stair
 */
export function castleStraightStairSurfaces(stair) {
  const r = stair.radius;
  const offset = (stair.flightGap ?? 0) / 2;
  const min = stair.flightBounds?.minX ?? -r - offset;
  const max = stair.flightBounds?.maxX ?? r + offset;
  const inner = stair.flightBounds?.inner ?? offset;
  const landing = Math.min(0.7, r * 0.5);
  const shift = stair.flightShift ?? 0;
  const landingHeight = stair.rise / 2 + (stair.landingLift ?? 0);
  const apron = Math.min(0.15, r * 0.1);
  // Sink the turning slab half a masonry course into the adjoining walls.
  // Its visible edge and Ammo support share these bounds.
  return [
    { minX: min, maxX: -inner, minZ: -r + landing + shift, maxZ: r + shift, low: 0, high: landingHeight, reverse: true },
    { minX: min - 0.125, maxX: max + 0.125, minZ: (stair.landingBack ?? -r) - 0.125, maxZ: -r + landing + shift, low: landingHeight, high: landingHeight, reverse: false },
    { minX: inner, maxX: max, minZ: -r + landing + shift, maxZ: r - apron + shift, low: stair.rise / 2, high: stair.rise, reverse: false },
    { minX: inner, maxX: max, minZ: r - apron + shift, maxZ: r + shift, low: stair.rise, high: stair.rise, reverse: false },
  ];
}

/**
 * @param {{center:{x:number,y:number,z:number},yaw:number,radius:number,rise:number,flightGap?:number,flightShift?:number,landingBack?:number,landingLift?:number,flightBounds?:{minX:number,maxX:number,inner:number}}} stair
 * @param {number} x
 * @param {number} z
 * @param {number} elevation
 * @returns {number|null}
 */
export function castleStraightStairHeight(stair, x, z, elevation) {
  const angle = stair.yaw * Math.PI / 180;
  const dx = x - stair.center.x, dz = z - stair.center.z;
  const localX = dx * Math.cos(angle) - dz * Math.sin(angle);
  const localZ = dx * Math.sin(angle) + dz * Math.cos(angle);
  let best = null;
  for (const surface of castleStraightStairSurfaces(stair)) {
    if (localX < surface.minX - 1e-6 || localX > surface.maxX + 1e-6 || localZ < surface.minZ - 1e-6 || localZ > surface.maxZ + 1e-6) { continue; }
    let progress = Math.max(0, Math.min(1, (localZ - surface.minZ) / (surface.maxZ - surface.minZ)));
    if (surface.reverse) { progress = 1 - progress; }
    const steps = castleStraightStairStepCount(surface);
    const tread = Math.min(steps, Math.floor(progress * steps + 1e-6) + 1);
    const height = stair.center.y + surface.low + tread / steps * (surface.high - surface.low);
    if (Math.abs(height - elevation) <= 0.32 && (best === null || Math.abs(height - elevation) < Math.abs(best - elevation))) { best = height; }
  }
  return best;
}

/**
 * Risers remain within the hero's 0.32 m automatic step clearance.
 * @param {{low:number,high:number,minZ:number,maxZ:number}} surface
 * @returns {number}
 */
export function castleStraightStairStepCount(surface) {
  const rise = surface.high - surface.low;
  return Math.max(1, Math.ceil(rise ? rise / 0.3 - 1e-6 : (surface.maxZ - surface.minZ) / 0.25));
}
