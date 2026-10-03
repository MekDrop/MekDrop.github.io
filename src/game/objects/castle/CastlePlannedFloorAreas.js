/**
 * Splits planned floors around the stair shaft, retaining its final-tread exit.
 * Shared by navigation and physical/visible floor construction.
 * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
 * @returns {Array<{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}>}
 */
export function createCastlePlannedFloorAreas(buildPlan) {
  const plan = buildPlan.metadata.runtime.residential;
  if (plan.basePlanId) { return plan.walkableAreas.map(/**
   * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
   */
  (area) => ({ ...area })); }
  const result = [];
  const shaft = plan.shaft;
  for (const area of plan.walkableAreas) {
    const cut = area.floorY > plan.origin.y ? plan.stair : area.floorY === plan.origin.y ? plan.serviceStair : null;
    if (!cut || area.id.endsWith("Threshold")) { result.push({ ...area }); continue; }
    for (const [minX, maxX, minZ, maxZ] of [
      [area.minX, Math.min(area.maxX, shaft.minX), area.minZ, area.maxZ],
      [Math.max(area.minX, shaft.maxX), area.maxX, area.minZ, area.maxZ],
      [Math.max(area.minX, shaft.minX), Math.min(area.maxX, shaft.maxX), area.minZ, Math.min(area.maxZ, shaft.minZ)],
      [Math.max(area.minX, shaft.minX), Math.min(area.maxX, shaft.maxX), Math.max(area.minZ, shaft.maxZ), area.maxZ],
    ]) {
      if (maxX > minX && maxZ > minZ) {
        const host = plan.rooms[plan.stairHostRoomId];
        const floorMaxZ = area.floorY > plan.origin.y && host && minX >= host.minX && maxX <= host.maxX && maxZ <= shaft.minZ ?
          Math.min(maxZ, host.minZ) : maxZ;
        if (floorMaxZ > minZ) result.push({ ...area, minX, maxX, minZ, maxZ: floorMaxZ });
      }
    }
    const x = (shaft.minX + shaft.maxX) / 2;
    const z = (shaft.minZ + shaft.maxZ) / 2;
    const direction = plan.stairExitDirection ?? (x < 0 ? 1 : -1);
    // Keep the slab above the outer exit, preserving lower-turn headroom.
    // Continue to the rear wall so both boots have support across the landing.
    result.push({ id: area.floorY > plan.origin.y ? "mainStairLanding" : "serviceStairLanding",
      minX: direction > 0 ? x - (plan.stairExitClearance === undefined ? 0.05 : 0.35) : shaft.minX,
      maxX: direction > 0 ? shaft.maxX : x + (plan.stairExitClearance === undefined ? 0.05 : 0.35),
      minZ: direction > 0 ? z + cut.radius * (plan.stairExitClearance === undefined ? 0.35 : 0.45) / 0.65 : shaft.minZ,
      maxZ: direction > 0 ? shaft.maxZ : z - cut.radius * (plan.stairExitClearance === undefined ? 0.35 : 0.45) / 0.65,
      floorY: area.floorY });
    // Close the entire upstairs exit quadrant, including the strip between
    // the circular stair and doorway. Its slower lower turn retains headroom.
    // Service stairs keep their original profile and outer-edge infill.
    const clearance = plan.stairExitClearance ?? (area.floorY > plan.origin.y ? 0 : cut.radius * 0.335 / 0.65 + 0.35);
    result.push({ id: "StairExitInfill",
      minX: direction > 0 ? x + clearance : shaft.minX,
      maxX: direction > 0 ? shaft.maxX : x - clearance,
      minZ: plan.stairExitClearance === undefined && area.floorY > plan.origin.y && direction > 0 ? z - 0.2 : shaft.minZ,
      maxZ: plan.stairExitClearance === undefined && area.floorY > plan.origin.y && direction < 0 ? z + 0.2 : shaft.maxZ, floorY: area.floorY });
  }
  if (plan.stair) {
    // The complete upstairs doorway needs floor, not only the final tread's quadrant.
    // Keep this apron at the shaft's outside edge, clear of the lower walking turn.
    for (const doorway of plan.doorways.filter(/**
     * @param {{roomId:string,floorY:number,axis:string}} doorway
     */ (doorway) => doorway.roomId === plan.stairHostRoomId && doorway.floorY > plan.origin.y && doorway.axis === "x")) {
      const right = doorway.coordinate > (shaft.minX + shaft.maxX) / 2;
      result.push({ id: "mainStairDoorApron",
        minX: right ? shaft.maxX - 0.3 : shaft.minX - 0.25,
        maxX: right ? shaft.maxX + 0.25 : shaft.minX + 0.3,
        minZ: doorway.center - doorway.width / 2,
        maxZ: doorway.center + doorway.width / 2, floorY: doorway.floorY });
    }
  }
  // A room's finish stops at its inner wall face. Bridge the wall thickness
  // with a continuous structural threshold, including doors onto the terrace.
  for (const doorway of plan.doorways) {
    if (doorway.floorY <= plan.origin.y) { continue; }
    const acrossX = doorway.axis === "x";
    result.push({ id: "upperRoomThreshold",
      minX: (acrossX ? doorway.coordinate - 0.25 : doorway.center - doorway.width / 2),
      maxX: (acrossX ? doorway.coordinate + 0.25 : doorway.center + doorway.width / 2),
      minZ: (acrossX ? doorway.center - doorway.width / 2 : doorway.coordinate - 0.25),
      maxZ: (acrossX ? doorway.center + doorway.width / 2 : doorway.coordinate + 0.25),
      floorY: doorway.floorY });
  }
  // A doorway apron can overlap an existing landing. Keep one surface owner.
  const unique = [];
  for (const area of result) {
    let pieces = [area];
    for (const existing of unique) {
      if (existing.floorY !== area.floorY) { continue; }
      pieces = pieces.flatMap(/**
       * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} piece
       */ (piece) => {
        const left = Math.max(piece.minX, existing.minX), right = Math.min(piece.maxX, existing.maxX);
        const front = Math.max(piece.minZ, existing.minZ), rear = Math.min(piece.maxZ, existing.maxZ);
        if (right <= left || rear <= front) { return [piece]; }
        return [[piece.minX, left, piece.minZ, piece.maxZ], [right, piece.maxX, piece.minZ, piece.maxZ],
          [left, right, piece.minZ, front], [left, right, rear, piece.maxZ]]
          .filter(/**
           * @param {number[]} bounds
           */ (bounds) => bounds[1] > bounds[0] && bounds[3] > bounds[2])
          .map(/**
           * @param {number[]} bounds
           */ (bounds) => ({ ...piece, minX: bounds[0], maxX: bounds[1], minZ: bounds[2], maxZ: bounds[3] }));
      });
    }
    unique.push(...pieces);
  }
  const leisure = plan.rooms.leisure;
  return unique.flatMap(/**
   * @param {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} area
   */ (area) => {
    if (!leisure || area.floorY <= leisure.floorY) { return [area]; }
    const left = Math.max(area.minX, leisure.minX), right = Math.min(area.maxX, leisure.maxX);
    const front = Math.max(area.minZ, leisure.minZ), rear = Math.min(area.maxZ, leisure.maxZ);
    if (right <= left || rear <= front) { return [area]; }
    return [[area.minX, left, area.minZ, area.maxZ], [right, area.maxX, area.minZ, area.maxZ],
      [left, right, area.minZ, front], [left, right, rear, area.maxZ]]
      .filter(/**
       * @param {number[]} bounds
       */ (bounds) => bounds[1] > bounds[0] && bounds[3] > bounds[2])
      .map(/**
       * @param {number[]} bounds
       */ (bounds) => ({ ...area, minX: bounds[0], maxX: bounds[1], minZ: bounds[2], maxZ: bounds[3] }));
  });
}
