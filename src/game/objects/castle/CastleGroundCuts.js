/**
 * @typedef {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}} GroundCut
 */
/**
 * @typedef {{minX:number,maxX:number,minZ:number,maxZ:number}} RoomBounds
 */
/**
 * Ground envelopes cover occupied rooms and ground masonry, preserving the
 * outdoor courtyard and the front lawn between the wall and its foundation edge.
 * @param {import("../../generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan} plan
 * @param {import("./CastleResidentialLayout.js").CastleResidentialLayout|null} layout
 */
export function createCastleGroundCuts(plan, layout = null) {
  const residential = plan.metadata.runtime.residential;
  if (!residential) return [];
  const { origin } = residential;
  const angle = origin.yaw * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cuts = [];
  const thresholds = (layout?.walkableAreas ?? []).filter(/**
   * @param {{id:string}} area
   */ (area) => area.id.startsWith("interiorFloor:") || area.id === "serviceGroundBay" || area.id === "serviceStairLanding" || area.id.endsWith("Threshold") || area.id.startsWith("doorThreshold"));
  const rooms = [residential.outerBounds, residential.rooms.work, ...thresholds,
    ...(residential.buildings ?? []).map(/**
     *
     * @param {{bounds:RoomBounds}} building
     */
    (building) => building.bounds),
    ...(residential.walkableAreas ?? []).filter(/**
     *
     * @param {{id:string,bounds:RoomBounds}} area
     */
    (area) => area.id !== "courtyard").map(/**
     *
     * @param {{id:string,bounds:RoomBounds}} area
     */
    (area) => area.bounds)];
  const stairRooms = Object.entries(residential.reservations ?? {})
    .filter(/**
     *
     * @param {[string, RoomBounds]} options
     * @param {string} options."0"
     */
    ([role]) => role === "mainStair" || role === "serviceStair")
    .map(/**
     *
     * @param {[string, RoomBounds]} options
     * @param {string} options."0"
     * @param {RoomBounds} options."1"
     */
    ([, bounds]) => bounds);
  for (const room of [...rooms, ...stairRooms].filter(Boolean)) {
    const corners = [
      [room.minX, room.minZ], [room.minX, room.maxZ],
      [room.maxX, room.minZ], [room.maxX, room.maxZ],
    ].map(/**
     *
     * @param {Array<number>} options
     * @param {number} options."0"
     * @param {number} options."1"
     */
    ([x, z]) => ({ x: origin.x + x * c + z * s, z: origin.z - x * s + z * c }));
    cuts.push({ minX: Math.min(...corners.map(/**
     *
     * @param {{x:number,z:number}} point
     */
    (point) => point.x)), maxX: Math.max(...corners.map(/**
     *
     * @param {{x:number,z:number}} point
     */
    (point) => point.x)),
      minZ: Math.min(...corners.map(/**
       *
       * @param {{x:number,z:number}} point
       */
      (point) => point.z)), maxZ: Math.max(...corners.map(/**
       *
       * @param {{x:number,z:number}} point
       */
      (point) => point.z)),
      minY: stairRooms.includes(room) ? residential.basement?.floorY ?? origin.y - 0.05 : origin.y - 0.05,
      maxY: Number.MAX_VALUE });
  }
  for (const block of plan.metadata.collision?.cameraBlocks ?? []) {
    if (block.y + block.halfY <= origin.y + 0.05 || block.y - block.halfY > origin.y + 1) continue;
    cuts.push({ minX: block.x - block.halfX, maxX: block.x + block.halfX,
      minZ: block.z - block.halfZ, maxZ: block.z + block.halfZ,
      minY: origin.y - 0.05, maxY: Number.MAX_VALUE });
  }
  const basement = residential.basement;
  if (basement) {
    const rotated = Math.abs(Math.sin(basement.yaw * Math.PI / 180)) > 0.5;
    const halfX = (rotated ? basement.depth : basement.width) / 2;
    const halfZ = (rotated ? basement.width : basement.depth) / 2;
    cuts.push({ minX: basement.x - halfX, maxX: basement.x + halfX,
      minZ: basement.z - halfZ, maxZ: basement.z + halfZ,
      minY: basement.floorY, maxY: basement.ceilingY });
  }
  return [...new Map(cuts.map(/**
   *
   * @param {GroundCut} cut
   */
  (cut) => [[cut.minX, cut.maxX, cut.minZ, cut.maxZ, cut.minY].join(","), cut])).values()];
}

/**
 * Subtracts occupied building space while retaining the outside part of a turf
 * cell. Partial cells use existing terrain-box records, including earth below
 * the floor, rather than leaving a full bare strip beside the building.
 * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
 * @param {Array<GroundCut>} cuts
 */
export function clipCastleTerrainRecord(definition, cuts) {
  if (!["Grass", "Earth"].includes(definition.object) || !definition.position) return [definition];
  const args = definition.geometry?.args;
  const box = definition.geometry?.method === "addBoxMatrix";
  const sx = box ? args[6] : 1;
  const sy = box ? args[7] : 1;
  const sz = box ? args[8] : 1;
  const { x, y, z } = definition.position;
  const originalTop = y + sy / 2;
  let pieces = [{ minX: x - sx / 2, maxX: x + sx / 2, minY: y - sy / 2, maxY: originalTop, minZ: z - sz / 2, maxZ: z + sz / 2 }];
  let changed = false;
  for (const cut of cuts) {
    const next = [];
    for (const piece of pieces) {
      const ix = Math.max(piece.minX, cut.minX), ax = Math.min(piece.maxX, cut.maxX);
      const iy = Math.max(piece.minY, cut.minY), ay = Math.min(piece.maxY, cut.maxY);
      const iz = Math.max(piece.minZ, cut.minZ), az = Math.min(piece.maxZ, cut.maxZ);
      if (ax - ix < 0.000001 || ay - iy < 0.000001 || az - iz < 0.000001) { next.push(piece); continue; }
      changed = true;
      if (piece.minX < ix) next.push({ ...piece, maxX: ix });
      if (ax < piece.maxX) next.push({ ...piece, minX: ax });
      const middle = { ...piece, minX: ix, maxX: ax };
      if (piece.minZ < iz) next.push({ ...middle, maxZ: iz });
      if (az < piece.maxZ) next.push({ ...middle, minZ: az });
      const center = { ...middle, minZ: iz, maxZ: az };
      if (piece.minY < iy) next.push({ ...center, maxY: iy });
      if (ay < piece.maxY) next.push({ ...center, minY: ay });
    }
    pieces = next;
  }
  if (!changed) return [definition];
  return pieces.filter(/**
   *
   * @param {GroundCut} piece
   */
  (piece) => piece.maxX - piece.minX > 0.000001 &&
    piece.maxY - piece.minY > 0.000001 && piece.maxZ - piece.minZ > 0.000001).map(/**
   *
   * @param {GroundCut} piece
   * @param {number} index
   */
  (piece, index) => {
    const top = definition.object === "Grass" && Math.abs(piece.maxY - originalTop) < 0.000001;
    const position = { x: (piece.minX + piece.maxX) / 2, y: (piece.minY + piece.maxY) / 2, z: (piece.minZ + piece.maxZ) / 2 };
    return { ...definition, id: `${definition.id}-castle-cut-${index}`, object: top ? "Grass" : "Earth", position,
      geometry: { method: "addBoxMatrix", args: [top ? args?.[0] ?? "grass" : "earth", args?.[1] ?? "earth", position.x, position.y, position.z,
        0, piece.maxX - piece.minX, piece.maxY - piece.minY, piece.maxZ - piece.minZ, "full", "earth"] } };
  });
}
