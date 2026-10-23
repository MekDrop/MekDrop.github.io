import { FireplaceChimneyFootprint } from "../../objects/castle-props/fireplace/FireplaceChimneyFootprint.js";
import { CastleBasePlanInvalidError } from "../../errors/castle/index.js";

/**
 * Reserves wall ladders and independent locked lids below pitched blue roofs.
 */
export class CastleAtticAccess {
  /**
   * @param {import("../../GameContracts.js").CastleBuildPlan["metadata"]["runtime"]["residential"]} plan
   * @param {Array<{id:string,minX:number,maxX:number,minZ:number,maxZ:number,y:number,shape:string}>} roofs
   * @param {(x:number,z:number,y:number)=>{x:number,y:number,z:number}} world
   * @param {number} yaw
   */
  static prepare(plan, roofs, world, yaw) {
    plan.atticAccesses = [];
    const chimneys = plan.furniture
      .filter(/**
       *
       * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem} item
       */
        item => item.object === "Fireplace")
      .map(/**
       *
       * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem} item
       */
        item => FireplaceChimneyFootprint.bounds(item, plan.spaces));
    for (const roof of roofs) {
      if (roof.shape === "flat") {
        continue;
      }
      const rooms = plan.spaces.filter(/**
       *
       * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
       */
        room => room.kind === "room" &&
        Math.abs(room.floorY + room.height - roof.y) < 0.01 &&
        room.minX >= roof.minX && room.maxX <= roof.maxX &&
        room.minZ >= roof.minZ && room.maxZ <= roof.maxZ);
      if (!rooms.length) {
        continue;
      }
      let selected;
      for (const room of rooms.flatMap(/**
       *
       * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
       */
        room => [
          ...plan.furniture.filter(/**
         *
         * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}} item
         */
            item => item.object === "Shelf" && item.roomId === room.id && item.floorY === room.floorY)
            .sort(/**
           *
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}} a
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}} b
           */
              (a, b) => (b.width - b.depth) - (a.width - a.depth))
            .map(/**
           *
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}} replaceShelf
           */
              replaceShelf => ({
                ...room,
                replaceShelf,
                relocate: false,
              })),
          {
            ...room,
            relocate: false,
          },
        ])) {
        // Rails stay beside the inner wall face; reserve their actual footprint.
        const inset = 0.18;
        for (const axis of ["z", "x"]) {
          for (const side of [-1, 1]) {
            const shelf = room.replaceShelf;
            if (shelf) {
              const wallAxis = shelf.width >= shelf.depth ? "z" : "x";
              const coordinate = axis === "x" ? shelf.x : shelf.z;
              const nearMin = Math.abs(coordinate - room[axis === "x" ? "minX" : "minZ"]) < Math.abs(coordinate - room[axis === "x" ? "maxX" : "maxZ"]);
              if (axis !== wallAxis || side !== (nearMin ? -1 : 1)) {
                continue;
              }
            }
            const min = axis === "x" ? room.minZ : room.minX;
            const max = axis === "x" ? room.maxZ : room.maxX;
            for (let along = shelf ? (axis === "x" ? shelf.z : shelf.x) : min + 0.5; along <= (shelf ? (axis === "x" ? shelf.z : shelf.x) : max - 0.5); along += 0.25) {
              const x = axis === "x" ? (side > 0 ? room.maxX - inset : room.minX + inset) : along;
              const z = axis === "z" ? (side > 0 ? room.maxZ - inset : room.minZ + inset) : along;

              const approachX = x - (axis === "x" ? side * 0.6 : 0);
              const approachZ = z - (axis === "z" ? side * 0.6 : 0);
              const centerX = x - (axis === "x" ? side * 0.48 : 0);
              const centerZ = z - (axis === "z" ? side * 0.48 : 0);
              // Reserve the rails, standing approach and entire hatch frame
              // through every storey crossed by a lower fireplace's flue.
              const chimney = chimneys.some(/**
               *
               * @param {ReturnType<typeof FireplaceChimneyFootprint.bounds>} flue
               */
                flue =>
                  flue.bottom < roof.y + 0.3 && flue.top > room.floorY &&
                flue.maxX > Math.min(x - 0.5, approachX - 0.35, centerX - 0.63) &&
                flue.minX < Math.max(x + 0.5, approachX + 0.35, centerX + 0.63) &&
                flue.maxZ > Math.min(z - 0.5, approachZ - 0.35, centerZ - 0.63) &&
                flue.minZ < Math.max(z + 0.5, approachZ + 0.35, centerZ + 0.63));
              const occupied = plan.furniture.some(/**
           *
           * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {floorY:number}} item
           */
                item => !CastleAtticAccess.#replacedItem(item, shelf) && item.floorY === room.floorY &&
                (!room.relocate || item.object === "Shelf" || item.object === "Fireplace" || item.wallAttachment) &&
            Math.abs(item.x - approachX) < (item.width ?? 1) * (item.scale ?? 1) / 2 + 0.5 &&
            Math.abs(item.z - approachZ) < (item.depth ?? 1) * (item.scale ?? 1) / 2 + 0.5);
              const readingSpace = plan.furniture.some(/**
               *
               * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {floorY:number}} item
               */
                item => {
                  if (item === shelf || item.object !== "Shelf" || item.floorY !== room.floorY) {
                    return false;
                  }
                  const angle = (item.rotation ?? 0) * Math.PI / 180;
                  const frontX = -Math.sin(angle), frontZ = -Math.cos(angle);
                  const cx = item.x + frontX * 0.5, cz = item.z + frontZ * 0.5;

                  return Math.abs(x - cx) < item.width * item.scale / 2 + Math.abs(frontX) * 0.5 + (axis === "z" ? 0.4625 : 0.1) &&
                  Math.abs(z - cz) < item.depth * item.scale / 2 + Math.abs(frontZ) * 0.5 + (axis === "x" ? 0.4625 : 0.1);
                });
              const aperture = plan.openings.some(/**
           *
           * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
           */
                opening => opening.roomId === room.id &&
            (opening.axis === "x" ? Math.abs(opening.coordinate - x) < 0.5 && Math.abs(opening.center - z) < opening.width / 2 + 0.5 :
              Math.abs(opening.coordinate - z) < 0.7 && Math.abs(opening.center - approachX) < opening.width / 2 + 0.5));
              const stair = plan.authoredStairs.some(/**
           *
           * @param {{center:{y:number},rise:number,shaft:{minX:number,maxX:number,minZ:number,maxZ:number}}} item
           */
                item => room.floorY >= item.center.y && room.floorY <= item.center.y + item.rise &&
            approachX + 0.5 > item.shaft.minX && approachX - 0.5 < item.shaft.maxX && approachZ + 0.5 > item.shaft.minZ && approachZ - 0.5 < item.shaft.maxZ);
              if (!chimney && !occupied && !readingSpace && !aperture && !stair && room.maxZ - room.minZ >= 1.3 && room.maxX - room.minX >= 1.6) {
                selected = {
                  room,
                  x,
                  z,
                  side,
                  axis,
                  approachX,
                  approachZ,
                };
                break;
              }
            }
            if (selected) {
              break;
            }
          }
          if (selected) {
            break;
          }
        }
        if (selected) {
          break;
        }
      }
      if (!selected) {
        throw new CastleBasePlanInvalidError(plan.basePlanId, `attic-ladder-clearance:${roof.id}`);
      }
      const { room, x, z, side, axis, approachX, approachZ } = selected;
      if (room.replaceShelf) {
        plan.furniture = plan.furniture.filter(/**
         *
         * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}} item
         */
          item => !CastleAtticAccess.#replacedItem(item, room.replaceShelf));
      }
      for (const item of plan.furniture) {
        if (item.object === "Table" && item.role === "libraryProp" && item.roomId === room.id && item.floorY === room.floorY) {
          item.wallMountBack = -0.41;
        }
      }
      const centerX = x - (axis === "x" ? side * 0.48 : 0);
      const centerZ = z - (axis === "z" ? side * 0.48 : 0);
      const hole = {
        minX: centerX - 0.55,
        maxX: centerX + 0.55,
        minZ: centerZ - 0.55,
        maxZ: centerZ + 0.55,
      };
      plan.atticAccesses.push({
        id: `attic-${roof.id}`,
        locked: true,
        clearance: {
          minX: Math.min(x - 0.5, approachX - 0.35),
          maxX: Math.max(x + 0.5, approachX + 0.35),
          minZ: Math.min(z - 0.5, approachZ - 0.35),
          maxZ: Math.max(z + 0.5, approachZ + 0.35),
          bottom: room.floorY,
          top: roof.y,
          masonry: false,
          chimney: false,
        },
        hole,
        position: world(x, z, room.floorY),
        bottom: world(approachX, approachZ, room.floorY),
        top: world(centerX, centerZ, roof.y),
        rotation: yaw + (axis === "x" ? side * 90 : side > 0 ? 0 : 180),
      });
      // The attic floor is also the ceiling seen from the occupied room below.
      plan.walkableAreas.push({
        ...roof,
        id: `attic-floor:${roof.id}`,
        floorY: roof.y,
      });
      plan.walkableAreas = plan.walkableAreas.flatMap(/**
       *
       * @param {{id:string,floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
       */
        area => {
          if (area.floorY !== roof.y || area.maxX <= hole.minX || area.minX >= hole.maxX || area.maxZ <= hole.minZ || area.minZ >= hole.maxZ) {
            return [area];
          }
          const left = Math.max(area.minX, hole.minX), right = Math.min(area.maxX, hole.maxX);

          return [
            {
              ...area,
              maxX: left,
            },
            {
              ...area,
              minX: right,
            },
            {
              ...area,
              minX: left,
              maxX: right,
              maxZ: Math.max(area.minZ, hole.minZ),
            },
            {
              ...area,
              minX: left,
              maxX: right,
              minZ: Math.min(area.maxZ, hole.maxZ),
            },
          ].filter(/**
         *
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} part
         */
            part => part.maxX > part.minX && part.maxZ > part.minZ);
        });
    }
  }
  /**
   * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}} item
   * @param {import("./rooms/AbstractCastleRoomGenerator.js").RoomItem & {roomId?:string,floorY?:number}|undefined} shelf
   * @returns {boolean}
   */
  static #replacedItem(item, shelf) {
    if (!shelf) {
      return false;
    }
    return item === shelf || item.roomId === shelf.roomId && item.floorY === shelf.floorY &&
      (item.y ?? 0) >= 1 && Math.abs(item.x - shelf.x) <= shelf.width * shelf.scale / 2 + 0.05 &&
      Math.abs(item.z - shelf.z) <= shelf.depth * shelf.scale / 2 + 0.05;
  }

}
