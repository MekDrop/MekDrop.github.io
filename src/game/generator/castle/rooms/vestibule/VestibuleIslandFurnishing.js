/**
 * Freestanding arrival furniture, with a walking lane around each island.
 */
export class VestibuleIslandFurnishing {
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} occupied
   * @param {(item:import("../AbstractCastleRoomGenerator.js").RoomItem)=>boolean} safe
   * @param {number} wallThickness
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static furnish(room, occupied, safe, wallThickness) {
    const alongX = room.maxX - room.minX >= room.maxZ - room.minZ;
    const length = alongX ? room.maxX - room.minX : room.maxZ - room.minZ;
    const breadth = alongX ? room.maxZ - room.minZ : room.maxX - room.minX;
    // Narrow corridors retain their existing unobstructed arrival runner.
    if (breadth < 3.3 || length < 4) { return []; }
    const centerX = (room.minX + room.maxX) / 2;
    const centerZ = (room.minZ + room.maxZ) / 2;
    const clearance = 0.7;
    const inset = wallThickness / 2 + clearance;
    const value = Number(room.furnishingSeed ?? 0);
    let seed = Number.isFinite(value) ? Math.abs(Math.trunc(value)) : 0;
    if (!Number.isFinite(value)) {
      for (const character of String(room.furnishingSeed)) {
        seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
      }
    }
    // A six-seed cycle covers all base plans and their mirrors. Keep the same
    // furnishing variant for a mirrored pair, then alternate on the next cycle.
    const bench = Math.floor(seed / 6) % 2 === 0;
    const largeBench = bench && length >= 5.5 && breadth >= 3.5;
    const benchLength = largeBench ? 2.7 : 1.8;
    const benchDepth = largeBench ? 1.2 : 1.05;
    const benchHeight = largeBench ? 1.2 : 1.05;
    const lateral = 0;
    // Group seating with the chest at the far end, leaving the arrival end open.
    const chest = occupied.find(VestibuleIslandFurnishing.#findItem);
    const anchor = largeBench && chest
      ? Math.sign(alongX ? chest.x - centerX : chest.z - centerZ) * 0.65 : 0;
    // Keep the first valid composition near the middle, rather than at a wall.
    for (const shift of [anchor, anchor - 0.15, anchor + 0.15, 0, -0.3, 0.3]) {
      const depth = bench ? benchDepth : 1;
      const span = bench ? benchLength : 1.8;
      const island = {
        id: `${room.id}-${room.level}-island-${bench ? "bench" : "map"}`,
        role: "vestibuleProp",
        object: bench ? "Bench" : "Table",
        variant: bench ? "island" : undefined,
        properties: bench ? undefined : {
          width: 1.8,
          height: 1,
          depth: 1,
        },
        x: centerX + (alongX ? shift : lateral),
        z: centerZ + (alongX ? lateral : shift),
        width: alongX ? span : depth,
        depth: alongX ? depth : span,
        height: bench ? benchHeight : 1,
        scale: 1,
        stretch: largeBench ? {
          x: benchLength / 1.8,
          y: benchHeight / 1.05,
          z: benchDepth / 1.05,
        } : undefined,
        rotation: alongX ? 0 : 90,
        y: 0.033,
      };
      /**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
       */
      const overlapsIslandPlacement = item => (item.y ?? 0) < 1.5 && !item.floorCovering && !item.object?.endsWith("Rug") &&
          Math.abs(item.x - island.x) < (item.width * item.scale + island.width) / 2 + clearance &&
          Math.abs(item.z - island.z) < (item.depth * item.scale + island.depth) / 2 + clearance;
      if (safe(island) &&
        island.x - island.width / 2 >= room.minX + inset && island.x + island.width / 2 <= room.maxX - inset &&
        island.z - island.depth / 2 >= room.minZ + inset && island.z + island.depth / 2 <= room.maxZ - inset &&
        !occupied.some(overlapsIslandPlacement)) {
        const items = [island];
        if (!bench) {
          items.push({
            ...island,
            id: `${island.id}-drawing`,
            object: "WarMapDrawing",
            properties: {
              width: 1.8 * 0.75,
              depth: 0.69,
            },
            width: alongX ? 1.8 * 0.75 : 0.69,
            depth: alongX ? 0.69 : 1.8 * 0.75,
            height: 0,
            y: island.y + 1.003,
          });
        }
        if (bench) {
          const bagScale = largeBench ? 1 : 0.8;
          const luggage = largeBench
            ? [[-0.85, -0.285, 270, 0.9], [-0.85, 0.285, 270, 0.9], [0.45, 0.4, 0, 1], [0.45, -0.4, 180, 1]]
            : [[-0.75, 0.4, 0, 1], [0.45, 0.4, 0, 1]];
          for (const [index, [along, lateral, yaw, size]] of luggage.entries()) {
            const offset = along * bagScale;
            const side = lateral * bagScale;
            const turned = yaw % 180 !== 0;
            const width = turned ? 0.365 : 0.6;
            const depth = turned ? 0.6 : 0.365;
            items.push({
              id: `${island.id}-bag-${index}`,
              role: "vestibuleProp",
              object: "Satchel",
              variant: index % 2 === 0 ? "brown" : "olive",
              x: island.x + (alongX ? offset : side),
              z: island.z + (alongX ? side : offset),
              width: alongX ? width : depth,
              depth: alongX ? depth : width,
              height: 0.303,
              scale: bagScale * size,
              rotation: (alongX ? 0 : 90) + yaw,
              y: island.y,
              supportId: island.id,
              underSupport: true,
            });
          }
        }
        return items;
      }
    }

    return [];
  }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
   */
  static #findItem(item) {
    return item.object === "Chest";
  }
}
