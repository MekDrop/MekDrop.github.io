/**
 * Reserves a broader exterior flight on complete terrain cells. Its doorway
 * retains its original width; rendering, navigation and excavation share this
 * single footprint so no strip of excavated soil remains beside the treads.
 * @param {{x:number,z:number,width:number,depth:number,elevation?:number}} position
 * @param {{side:string,offset:number,width:number,approachElevation?:number}} door
 * @param {number} cubeSize
 * @param {{grid:number[][],cols:number,rows:number}|null} mapData
 */
export function createCastleStairFlight(position, door, cubeSize = 0.25, mapData = null) {
  const topY = Math.max(0, position.elevation ?? 0);
  const approachElevation = Number.isFinite(door.approachElevation) ? door.approachElevation : topY;
  const rise = Math.max(0, topY - approachElevation);
  const riseBlocks = Math.max(0, Math.ceil(rise / cubeSize - 0.000001));
  if (!riseBlocks) return null;
  // Keep the outer strip before the doorway as grass; widen toward its other side.
  let offset = !mapData && Number.isFinite(door.stairOffset) ? door.stairOffset : Math.floor(door.offset);
  let width = !mapData && Number.isFinite(door.stairWidth) ? door.stairWidth : Math.ceil(door.offset + door.width) - offset;
  const run = riseBlocks * 2 * cubeSize;
  const vertical = door.side === "WEST" || door.side === "EAST";
  const acrossOrigin = vertical ? position.z : position.x;
  let acrossStart = acrossOrigin + offset;
  let acrossEnd = acrossStart + width;
  const boundaryEdge = {
    WEST: position.x, EAST: position.x + position.width,
    NORTH: position.z, SOUTH: position.z + position.depth,
  }[door.side];
  if (!Number.isFinite(boundaryEdge)) return null;
  const outwardSign = door.side === "WEST" || door.side === "NORTH" ? -1 : 1;
  const outerEdge = boundaryEdge + outwardSign * run;
  const edgeMin = Math.min(boundaryEdge, outerEdge);
  const edgeMax = Math.max(boundaryEdge, outerEdge);
  if (mapData?.grid && Number.isFinite(mapData.cols) && Number.isFinite(mapData.rows)) {
    const originalStart = acrossOrigin + door.offset;
    const originalEnd = originalStart + door.width;
    for (let row = 0; row < mapData.rows; row += 1) {
      for (let col = 0; col < mapData.cols; col += 1) {
        if (![2, 5].includes(mapData.grid[row]?.[col])) continue;
        const x = col - (mapData.cols - 1) / 2;
        const z = row - (mapData.rows - 1) / 2;
        const along = vertical ? x : z;
        if (along + 0.5 <= edgeMin || along - 0.5 >= edgeMax) continue;
        const across = vertical ? z : x;
        const cellStart = across - 0.5;
        const cellEnd = across + 0.5;
        // The original doorway corridor is its intended road approach. Extra
        // tread strips may occupy grass only, never a neighboring road or gate.
        if (cellStart >= originalEnd - 0.000001) {
          acrossEnd = Math.max(originalEnd, Math.min(acrossEnd, cellStart));
        } else if (cellEnd <= originalStart + 0.000001) {
          acrossStart = Math.min(originalStart, Math.max(acrossStart, cellEnd));
        }
      }
    }
    offset = acrossStart - acrossOrigin;
    width = acrossEnd - acrossStart;
  }
  return {
    side: door.side, offset, width, vertical, outerEdge, acrossStart, acrossEnd,
    approachElevation, rise, run, riseBlocks, stepRun: 2 * cubeSize, stepHeight: rise / riseBlocks,
    minX: vertical ? edgeMin : acrossStart, maxX: vertical ? edgeMax : acrossEnd,
    minZ: vertical ? acrossStart : edgeMin, maxZ: vertical ? acrossEnd : edgeMax,
    floorY: approachElevation,
  };
}
