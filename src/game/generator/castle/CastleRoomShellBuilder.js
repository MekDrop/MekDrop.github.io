/**
 * Builds wall-separated rooms with doors to the shared hall.
 */
export class CastleRoomShellBuilder {
  /**
   * @param {import("./CastleGenerationContext.js").CastleGenerationContext} context
   */
  async build(context) {
    const plan = context.layout.roomPlan;
    const rooms = [...plan.placedRooms];
    const leisure = plan.rooms.leisure;
    const sharedUpper = plan.stair && !rooms.some(/**
     * @param {{id:string}} room
     */ (room) => room.id.startsWith("tower"));
    if (sharedUpper) {
      // These are chambers in one keep, not detached turret buildings.
      // Enclose the shared circulation on the load-bearing exterior walls.
      plan.rooms.upperGallery = { ...plan.outerBounds, id: "upperGallery", purpose: "upper terrace", level: 1,
        height: 0.25, floorY: plan.origin.y + plan.rise };
      rooms.push(plan.rooms.upperGallery);
    }
    if (plan.basement) {
      // The basement shell must retain a soil ceiling outside the stair shaft.
      rooms.push({ ...plan.outerBounds, id: "basementEnvelope", level: -1,
        floorY: plan.basement.floorY });
    }
    const opening = context.layout.openings.find(/**
     *
     * @param {{boundary:string}} entry
     */
    (entry) => entry.boundary === "FRONT");
    const middle = (opening.start + opening.end - 1) / 2;
    const sign = ["WEST", "SOUTH"].includes(context.layout.primarySide) ? -1 : 1;
    for (const room of rooms) {
      // Upstairs leisure flows into the unused terrace without internal fences.
      if (room.id === "leisure" && room.level === 1) { continue; }
      const bottom = Math.round((room.floorY - plan.origin.y) * 4);
      const height = room.id === "leisure" ? 3 : Math.round((room.height ?? 2.25) * 4);
      const top = bottom + height;
      const doorways = plan.doorways.filter(/**
       * @param {{roomId:string}} doorway
       */ (doorway) => doorway.roomId === room.id);
      for (let u = 0; u < context.layout.castleDepth; u++) {
        const z = (u + 0.5) / 4;
        for (let v = 0; v < context.layout.facadeSpan; v++) {
          const x = sign * (v - middle) / 4;
          const inside = x >= room.minX - 0.126 && x <= room.maxX + 0.126 &&
            z >= room.minZ - 0.126 && z <= room.maxZ + 0.126;
          if (!inside) { continue; }
          const wall = x < room.minX || x > room.maxX || z < room.minZ || z > room.maxZ;
          // The covered hall's doorway keeps a full-height backing wall;
          // the other terrace edges are low parapets.
          const terraceEdge = room.id === "upperGallery" && leisure?.level === 1 &&
            x >= leisure.minX - 0.126 && x <= leisure.maxX + 0.126 &&
            z < leisure.minZ && z >= leisure.minZ - 0.126;
          const columnTop = terraceEdge ? bottom + 1 : room.id === "leisure" && room.level === 0 && z > room.maxZ ?
            bottom + Math.round(room.height * 4) : top;
          for (let y = bottom; y <= columnTop; y++) {
            const boundary = u < 2 ? "FRONT" : u >= context.layout.castleDepth - 2 ? "BACK" :
              v < 2 ? "LEFT" : v >= context.layout.facadeSpan - 2 ? "RIGHT" : null;
            const horizontal = boundary === "FRONT" || boundary === "BACK" ? v : u;
            if (boundary && y >= 0 && context.planning.writer.openingAt(boundary, horizontal, y) && y < 8) { continue; }
            const elevation = plan.origin.y + y / 4;
            if ((room.id === "leisure" || room.id === "upperGallery") && !wall) { continue; }
            if (y === top && leisure && elevation > leisure.floorY + 1 &&
              x >= leisure.minX && x <= leisure.maxX && z >= leisure.minZ && z <= leisure.maxZ) { continue; }
            const openDoor = doorways.some(/**
             * @param {{axis:string,coordinate:number,center:number,width:number,floorY:number}} doorway
             */ (doorway) => Math.abs((doorway.axis === "x" ? x : z) - doorway.coordinate) < 0.01 &&
              Math.abs((doorway.axis === "x" ? z : x) - doorway.center) < doorway.width / 2 &&
              elevation >= doorway.floorY && elevation < doorway.floorY + 2);
            if ((y < columnTop && !wall) || (openDoor && room.id !== "basementEnvelope")) { continue; }
            if (y === top && room.level < 0 && (plan.stair || plan.serviceStair) && x > plan.shaft.minX && x < plan.shaft.maxX &&
              z > plan.shaft.minZ && z < plan.shaft.maxZ) { continue; }
            const corner = wall && (x < room.minX + 0.25 || x > room.maxX - 0.25) &&
              (z < room.minZ + 0.25 || z > room.maxZ - 0.25);
            const dressedStone = room.id !== "leisure" && room.id !== "upperGallery" && wall &&
              (corner || y >= top - 1 || y === bottom + 1);
            context.planning.writer.addBlock(u, y, v, dressedStone ? "roomShellTrim" : "roomShell");
            if (y === columnTop && wall && (room.id === "upperGallery" || room.id === "leisure")) {
              for (let guard = 1; guard <= (room.id === "leisure" || room.id === "upperGallery" || terraceEdge ? 1 : 4); guard++) {
                if ((room.id !== "upperGallery" && guard <= 2) || (u + v) % 4 < 2) {
                  context.planning.writer.addBlock(u, columnTop + guard, v, "trim");
                }
              }
            }

          }
        }
      }
      if (room.id !== "leisure" && room.id !== "upperGallery" && !room.id.startsWith("tower") && room.level >= 0 && (room.level === 1 || room.stairHost)) {
        // Covered wings surround the open leisure terrace. Pitched surfaces
        // fill their ceilings; battlements crown the defensive outer walls.
        let roofs = [[room.minX, room.maxX, room.minZ, room.maxZ]];
        if (leisure && room.floorY + height / 4 > leisure.floorY) {
          const left = Math.max(room.minX, leisure.minX - 0.125), right = Math.min(room.maxX, leisure.maxX + 0.125);
          const front = Math.max(room.minZ, leisure.minZ - 0.125), rear = Math.min(room.maxZ, leisure.maxZ + 0.125);
          if (right > left && rear > front) {
            roofs = [[room.minX, left, room.minZ, room.maxZ], [right, room.maxX, room.minZ, room.maxZ],
              [left, right, room.minZ, front], [left, right, rear, room.maxZ]];
          }
        }
        for (const [minX, maxX, minZ, maxZ] of roofs) {
          if (maxX <= minX || maxZ <= minZ) { continue; }
          const u = (minZ + maxZ) * 2 - 0.5;
          const v = middle + sign * (minX + maxX) * 2;
          context.planning.writer.addRoof(u, top + 1, v,
            (maxX - minX) * 4, (maxZ - minZ) * 4,
            Math.min(8, Math.max(4, Math.min(maxX - minX, maxZ - minZ) * 2.5)));
        }
      }
      await context.scheduler.yieldIfNeeded(context.yieldState);
    }
  }
}
