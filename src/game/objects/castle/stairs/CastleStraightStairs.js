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
    {
      minX: min,
      maxX: -inner,
      minZ: -r + landing + shift,
      maxZ: r + shift,
      low: 0,
      high: landingHeight,
      reverse: true,
    },
    {
      minX: min - 0.125,
      maxX: max + 0.125,
      minZ: (stair.landingBack ?? -r) - 0.125,
      maxZ: -r + landing + shift,
      low: landingHeight,
      high: landingHeight,
      reverse: false,
    },
    {
      minX: inner,
      maxX: max,
      minZ: -r + landing + shift,
      maxZ: r - apron + shift,
      low: stair.rise / 2,
      high: stair.rise,
      reverse: false,
    },
    {
      minX: inner,
      maxX: max,
      minZ: r - apron + shift,
      maxZ: r + shift,
      low: stair.rise,
      high: stair.rise,
      reverse: false,
    },
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
    const height = stair.center.y + castleStraightStairSurfaceHeight(surface, localZ);
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

/**
 * One tread record drives the visual modules, mesh support and height samples.
 * @param {ReturnType<typeof castleStraightStairSurfaces>[number]} surface
 * @returns {Array<{front:number,rear:number,height:number,bottom:number}>}
 */
export function castleStraightStairTreads(surface) {
  const count = castleStraightStairStepCount(surface);
  const treads = [];
  for (let index = 0; index < count; index++) {
    treads.push(castleStraightStairTread(surface, index, count));
  }

  return treads;
}

/**
 * @param {ReturnType<typeof castleStraightStairSurfaces>[number]} surface
 * @param {number} z
 * @returns {number}
 */
export function castleStraightStairSurfaceHeight(surface,z) {
  let progress = Math.max(0,Math.min(1,(z-surface.minZ)/(surface.maxZ-surface.minZ)));
  if (surface.reverse) { progress = 1-progress; }
  const count = castleStraightStairStepCount(surface);
  const index = Math.min(count - 1, Math.floor(progress * count + 1e-6));

  return castleStraightStairTread(surface, index, count).height;
}

/**
 * @typedef {{center:{x:number,y:number,z:number},yaw:number,radius:number,rise:number,straight?:boolean,id?:string,flightGap?:number,flightShift?:number,landingBack?:number,landingLift?:number,flightBounds?:{minX:number,maxX:number,inner:number},continuesAbove?:boolean}} StraightStairGeometry
 */

/**
 * Resolve stacked flights once for both map emission and legacy castle queries.
 * @param {import("../residents/CastleResidentialLayout.js").CastleResidentialLayout} layout
 * @returns {StraightStairGeometry[]}
 */
export function castleStraightStairAssemblies(layout) {
  const stairs = [...layout.authoredStairs,layout.stairs,layout.serviceStair].filter(
    /**
     * @param {StraightStairGeometry|null} stair
     */
    stair => stair?.straight);

  return stairs.map(/**
                     * @param {StraightStairGeometry} stair
                     */ stair => ({
      ...stair,
      continuesAbove:stairs.some(/**
                                * @param {StraightStairGeometry} next
                                */ next =>
          Math.abs(next.center.y-stair.center.y-stair.rise)<0.001 &&
      Math.hypot(next.center.x-stair.center.x,next.center.z-stair.center.z)<0.001),
    }));
}

/**
 * Local solid bounds shared by brick rendering, Ammo boxes and camera queries.
 * @param {StraightStairGeometry} stair
 * @returns {Array<{x:number,y:number,z:number,width:number,height:number,depth:number}>}
 */
export function castleStraightStairWalls(stair) {
  const flight = castleStraightStairSurfaces(stair)[0];
  const height = stair.rise+(stair.continuesAbove ? 0 : 0.75);
  const walls = [{
    x:0,
    y:height/2,
    z:(flight.minZ+flight.maxZ)/2,
    width:0.25,
    height,
    depth:flight.maxZ-flight.minZ,
  }];
  if (!stair.continuesAbove) {
    walls.push({
      x:(flight.minX-0.125)/2,
      y:stair.rise+0.375,
      z:stair.radius+(stair.flightShift ?? 0)-0.0625,
      width:-0.125-flight.minX,
      height:0.75,
      depth:0.125,
    });
  }
  return walls;
}

/**
 * Preserve the divider-only camera boundary used by the castle facade.
 * @param {StraightStairGeometry} stair
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} radius
 * @returns {boolean}
 */
export function castleStraightStairBlocksCamera(stair,x,y,z,radius) {
  const angle = stair.yaw*Math.PI/180;
  const dx=x-stair.center.x,dz=z-stair.center.z;
  const localX=dx*Math.cos(angle)-dz*Math.sin(angle);
  const localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
  const wall=castleStraightStairWalls(stair)[0];

  return Math.hypot(Math.max(Math.abs(localX-wall.x)-wall.width/2,0),
    Math.max(Math.abs(y-stair.center.y-wall.y)-wall.height/2,0),
    Math.max(Math.abs(localZ-wall.z)-wall.depth/2,0))<=radius;
}

/**
 * @param {ReturnType<typeof castleStraightStairSurfaces>[number]} surface
 * @param {number} index
 * @param {number} count
 * @returns {{front:number,rear:number,height:number,bottom:number}}
 */
function castleStraightStairTread(surface, index, count) {
  const run = surface.maxZ - surface.minZ;
  const rise = surface.high - surface.low;
  const front = surface.reverse
    ? surface.maxZ - run * (index + 1) / count
    : surface.minZ + run * index / count;

  return {
    front,
    rear: front + run / count,
    height: surface.low + rise * (index + 1) / count,
    bottom: surface.low + rise * index / count,
  };
}
