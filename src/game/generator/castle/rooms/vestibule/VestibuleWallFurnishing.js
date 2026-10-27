import { RoomPlacementRules } from "../RoomPlacementRules.js";
import { RoomFurnishingChoices } from "../RoomFurnishingChoices.js";

/**
 * A console and coat hooks give the long arrival wall a useful furnished bay.
 */
export class VestibuleWallFurnishing {
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
    if (length < 4 || breadth < 3.3) {
      return [];
    }
    for (const fraction of RoomFurnishingChoices.order([0.35, 0.5, 0.65, 0.25, 0.75, 0.45, 0.55], room, "arrival-wall-bay")) {
      const x = alongX ? room.minX + length * fraction : room.maxX - 0.375;
      const z = alongX ? room.maxZ - 0.375 : room.minZ + length * fraction;
      const rotation = alongX ? 180 : 270;
      const console = {
        id: `${room.id}-${room.level}-arrival-console`,
        role: "vestibuleProp",
        object: "Table",
        variant: "writingDesk",
        x,
        z,
        width: alongX ? 1.6 : 0.45,
        depth: alongX ? 0.45 : 1.6,
        height: 0.75,
        scale: 1,
        stretch: {
          x: 1.6 / 0.9,
          y: 0.75 / 0.65,
          z: 0.45 / 0.55,
        },
        wallMountBack: -0.275,
        rotation,
        y: 0.002,
      };
      if (!safe(console) || !RoomPlacementRules.accepts(console, room, occupied, wallThickness)) {
        continue;
      }
      const items = [console];
      const rail = {
        id: `${console.id}-hooks`,
        role: "vestibuleProp",
        object: "VestibuleCloakRail",
        x: alongX ? x : room.maxX - 0.09,
        z: alongX ? room.maxZ - 0.09 : z,
        width: alongX ? 1.1 : 0.1771,
        depth: alongX ? 0.1771 : 1.1,
        height: 1.365,
        scale: 0.78,
        rotation,
        y: 1.4,
        wallAttachment: true,
      };
      if (safe(rail) && RoomPlacementRules.accepts(rail, room, [...occupied, ...items], wallThickness)) {
        items.push(rail);
      }
      const lampOffset = RoomFurnishingChoices.order([-0.55, 0, 0.55], room, "console-lamp")[0];
      const plantOffset = lampOffset === 0 ? RoomFurnishingChoices.order([-0.55, 0.55], room, "console-planter")[0] : -lampOffset;
      for (const [object, offset, width, depth, height, scale, properties] of [
        ["Lantern", lampOffset, 0.22, 0.2136, 0.427, 0.8, { type: "table" }],
        ["Planter", plantOffset, 0.745, 0.745, 0.99, 0.27],
      ]) {
        const item = {
          role: "vestibuleProp",
          object,
          properties,
          x: x + (alongX ? offset : -0.05),
          z: z + (alongX ? -0.05 : offset),
          width,
          depth,
          height,
          scale,
          rotation,
          y: 0.752,
          supportId: console.id,
        };
        if (safe(item) && RoomPlacementRules.accepts(item, room, [...occupied, ...items], wallThickness)) {
          items.push(item);
        }
      }

      return items;
    }

    return [];
  }

  /**
   * Use a spare wall bay beside the console only after the arrival island exists.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} occupied
   * @param {(item:import("../AbstractCastleRoomGenerator.js").RoomItem)=>boolean} safe
   * @param {number} wallThickness
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static companions(room, occupied, safe, wallThickness) {
    const console = occupied.find(VestibuleWallFurnishing.#isConsole);
    const object = RoomFurnishingChoices.order([null, "VestibuleStickStand", "Planter", "Chest"], room, "console-companion")[0];
    if (!console || !object) {
      return [];
    }
    const alongX = console.width > console.depth;
    const width = object === "Chest" ? 0.7 : object === "Planter" ? 0.745 : 0.36;
    const depth = object === "Chest" ? 0.55 : width;
    const scale = object === "Planter" ? 0.65 : 1;
    const height = object === "Chest" ? 0.3291 : object === "Planter" ? 0.99 : 1.05;
    const inset = wallThickness / 2 + 0.04;
    for (const side of RoomFurnishingChoices.order([-1, 1], room, "console-companion-side")) {
      const offset = side * (1.6 / 2 + width * scale / 2 + 0.2);
      const item = {
        id: `${console.id}-companion`,
        role: "vestibuleProp",
        object,
        properties: { seed: room.furnishingSeed ?? 0 },
        x: alongX ? console.x + offset : room.maxX - inset - depth * scale / 2,
        z: alongX ? room.maxZ - inset - depth * scale / 2 : console.z + offset,
        width: alongX ? width : depth,
        depth: alongX ? depth : width,
        height,
        scale,
        rotation: console.rotation,
        y: 0.002,
      };
      if (!safe(item) || !RoomPlacementRules.accepts(item, room, occupied, wallThickness)) {
        continue;
      }
      // This standing bay needs a usable approach, not merely an empty footprint.
      const approach = {
        ...item,
        id: undefined,
        x: item.x - (alongX ? 0 : (depth * scale + 0.7) / 2),
        z: item.z - (alongX ? (depth * scale + 0.7) / 2 : 0),
        width: alongX ? width * scale : 0.7,
        depth: alongX ? 0.7 : width * scale,
        height: 1.2,
        scale: 1,
      };
      const obstacles = occupied.filter(VestibuleWallFurnishing.#blocksApproach);
      if (safe(approach) && RoomPlacementRules.accepts(approach, room, obstacles, wallThickness)) {
        return [item];
      }
    }

    return [];
  }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
   * @returns {boolean}
   */
  static #isConsole(item) {
    return item.id?.endsWith("arrival-console") ?? false;
  }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
   * @returns {boolean}
   */
  static #blocksApproach(item) {
    return !item.floorCovering;
  }
}
