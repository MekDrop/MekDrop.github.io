import { CastleAtticAccess } from "./CastleAtticAccess.js";
import { createCastlePlannedFloorAreas } from "../../objects/castle/structure/CastlePlannedFloorAreas.js";

/**
 * Compiles authored residential floor surfaces and shared plan predicates.
 */
export class CastleAuthoredResidentialPlan {
  /**
   * @param {Parameters<typeof import('./CastleAuthoredBuildPlan.js').CastleAuthoredBuildPlan.generate>[0]} context
   */
  static create(context) {
    const { spaces, openings, envelope, gate, authored, origin, rooms, placedRooms, furniture, stairs, buildings, transform, baseY, yaw, world } = context;
    const walkableAreas = [];
    for (const space of spaces) {
      if (space.kind !== "void") {
        walkableAreas.push({
          ...space,
          bounds: { ...space },
          id: space.id,
        });
      }
    }
    for (const opening of openings) {
      if (opening.kind !== "door") {
        continue;
      }
      // A normal exterior door meets the terrain at its sill. Extending its
      // floor apron outside excavates the last half metre of the path.
      const outsideReach = opening.exteriorEntrance && envelope.entrance.doorOwnedByRoom ? 0 : 0.5;
      walkableAreas.push({
        id: `doorThreshold:${opening.roomId}:${opening.side}`,
        floorY: opening.floorY,
        minX: opening.axis === "x" ? opening.coordinate - (opening.side === "WEST" ? outsideReach : 0.5) : opening.center - opening.width / 2,
        maxX: opening.axis === "x" ? opening.coordinate + (opening.side === "EAST" ? outsideReach : 0.5) : opening.center + opening.width / 2,
        minZ: opening.axis === "z" ? opening.coordinate - (opening.side === "NORTH" ? outsideReach : 0.5) : opening.center - opening.width / 2,
        maxZ: opening.axis === "z" ? opening.coordinate + (opening.side === "SOUTH" ? outsideReach : 0.5) : opening.center + opening.width / 2,
      });
    }
    const outerBounds = {
      minX: gate.center - authored.width,
      maxX: gate.center,
      minZ: 0,
      maxZ: gate.coordinate,
    };
    const residential = {
      version: 2,
      basePlanId: authored.basePlanId,
      origin,
      rooms,
      spaces,
      placedRooms,
      openings,
      doorways: openings.filter(CastleAuthoredResidentialPlan.filterOpening),
      furniture,
      rise: authored.floorHeight,
      floorHeight: authored.floorHeight,
      walkableAreas,
      authoredStairs: stairs,
      stair: null,
      serviceStair: null,
      basement: null,
      reservations: {
        throne: {
          ...rooms.work,
          minY: 0,
          maxY: rooms.work.height,
        },
      },
      outerBounds,
      buildings,
      gatehouseDepth: 0,
      skippedRooms: [],
      subrooms: [],
      roomRequirements: [],
      shaft: stairs[0]?.shaft,
      stairHostRoomId: null,
    };
    for (const roof of authored.roofs) {
      if (roof.shape === "flat") {
        residential.walkableAreas.push({
          ...transform(roof),
          id: `roof:${roof.id}`,
          floorY: roof.y,
        });
      }
    }
    if (authored.roofAccess) {
      const hole = transform(authored.roofAccess);
      residential.roofAccess = {
        hole,
        rotation: yaw + 180 + authored.roofAccess.rotation,
        position: world(gate.center - authored.roofAccess.position.x, gate.coordinate - authored.roofAccess.position.z, authored.roofAccess.position.y),
        bottom: world(gate.center - authored.roofAccess.bottom.x, gate.coordinate - authored.roofAccess.bottom.z, authored.roofAccess.bottom.y),
        top: world(gate.center - authored.roofAccess.top.x, gate.coordinate - authored.roofAccess.top.z, authored.roofAccess.top.y),
      };
      residential.walkableAreas = residential.walkableAreas.flatMap(
        /**
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,id:string}} area
         */
        (area) => {
          if (area.floorY !== authored.roofAccess.top.y) {
            return [area];
          }
          const left = Math.max(area.minX, hole.minX), right = Math.min(area.maxX, hole.maxX);
          const front = Math.max(area.minZ, hole.minZ), rear = Math.min(area.maxZ, hole.maxZ);
          if (right <= left || rear <= front) {
            return [area];
          }
          return [{
            ...area,
            maxX: left,
          }, {
            ...area,
            minX: right,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            maxZ: front,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            minZ: rear,
          }]
            .filter(CastleAuthoredResidentialPlan.filterPart);
        },
      );
    }
    for (const building of authored.buildings) {
      // Upper rooms need the same continuous structural floor as the ground
      // level, including the wall thickness around their doorways.
      const levels = new Set(
        spaces.filter(/**
                                            * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
                                            */
          space => space.kind !== "void" &&
        space.floorY > baseY && space.floorY < building.floorY + building.height &&
        space.minX >= gate.center - building.maxX && space.maxX <= gate.center - building.minX &&
        space.minZ >= gate.coordinate - building.maxZ && space.maxZ <= gate.coordinate - building.minZ)
          .map(CastleAuthoredResidentialPlan.mapSpace),
      );
      for (const floorY of levels) {
        residential.walkableAreas.push({
          ...transform(building),
          id: `upper-slab:${building.id}:${floorY}`,
          floorY,
        });
      }
      if (building.floorY < baseY) {
        // Basement room finishes stop short of the exterior wall. A continuous
        // foundation slab covers those perimeter seams and partition gaps.
        residential.walkableAreas.push({
          ...transform(building),
          id: `basement-slab:${building.id}`,
          floorY: building.floorY,
        });
      }
      if (building.floorY <= baseY && building.floorY + building.height > baseY) {
        // Room interiors omit partition thickness and circulation seams. The
        // building owns a continuous ground slab before cutting stair openings.
        residential.walkableAreas.push({
          ...transform(building),
          id: `ground-slab:${building.id}`,
          floorY: baseY,
        });
      }
      if (building.id === "base") {
        const floorY = building.floorY + building.height;
        const baseBounds = transform(building);
        residential.walkableAreas = residential.walkableAreas.filter(/**
         * @param {{floorY:number}} area
         */
          (area) => area.floorY !== floorY || area.minX < baseBounds.minX || area.maxX > baseBounds.maxX ||
          area.minZ < baseBounds.minZ || area.maxZ > baseBounds.maxZ);
        residential.walkableAreas.push({
          ...transform(building),
          id: "base-ceiling",
          floorY,
        });
      }
    }
    CastleAtticAccess.prepare(residential, authored.roofs.map(/**
     *
     * @param {{id:string,y:number,shape:string,minX:number,maxX:number,minZ:number,maxZ:number}} roof
     */
      roof => ({
        ...transform(roof),
        y: roof.y,
        shape: roof.shape,
        id: roof.id,
      })), world, yaw);
    // Keep both straight flights open; only the top approach owns a slab.
    for (const stair of stairs) {
      const shaft = stair.shaft;
      const topY = stair.center.y + stair.rise;
      residential.walkableAreas = residential.walkableAreas.flatMap(
        /**
         * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,id:string}} area
         */ (area) => {
          if (area.floorY !== topY) {
            return [area];
          }
          const left = Math.max(area.minX, shaft.minX), right = Math.min(area.maxX, shaft.maxX);
          const front = Math.max(area.minZ, shaft.minZ), rear = Math.min(area.maxZ, shaft.maxZ);
          if (right <= left || rear <= front) {
            return [area];
          }
          return [{
            ...area,
            maxX: left,
          }, {
            ...area,
            minX: right,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            maxZ: front,
          },
          {
            ...area,
            minX: left,
            maxX: right,
            minZ: rear,
          }]
            .filter(CastleAuthoredResidentialPlan.filterPiece);
        },
      );
      const angle = (stair.yaw - yaw) * Math.PI / 180;
      const cosine = Math.round(Math.cos(angle)), sine = Math.round(Math.sin(angle));
      const cx = stair.localCenter.x, cz = stair.localCenter.z;
      const r = stair.radius + (stair.flightShift ?? 0), landing = Math.min(0.15, r * 0.1);
      const width = stair.radius + (stair.flightGap ?? 0) / 2;
      const min = stair.flightBounds?.minX ?? -width, max = stair.flightBounds?.maxX ?? width;
      const corners = [[min, r - landing], [max, r - landing], [min, r + 0.05], [max, r + 0.05]].map(/**
       * @param {number[]} point
       */ point => ({
          x: cx + point[0] * cosine + point[1] * sine,
          z: cz - point[0] * sine + point[1] * cosine,
        }));
      residential.walkableAreas.push({
        id: stair.id + ':straightLanding',
        floorY: topY,
        minX: Math.min(...corners.map(CastleAuthoredResidentialPlan.mapPoint)),
        maxX: Math.max(...corners.map(CastleAuthoredResidentialPlan.mapPoint2)),
        minZ: Math.min(...corners.map(CastleAuthoredResidentialPlan.mapPoint3)),
        maxZ: Math.max(...corners.map(CastleAuthoredResidentialPlan.mapPoint4)),
      });
    }
    // Thresholds on the lowest floor also need a single surface owner.
    residential.walkableAreas = createCastlePlannedFloorAreas({
      metadata: {
        runtime: {
          residential: {
            ...residential,
            basePlanId: undefined,
            stair: null,
            serviceStair: null,
            rooms: {},
            doorways: [],
          },
        },
      },
    });
    // Thresholds on the lowest floor also need a single surface owner.
    residential.walkableAreas = createCastlePlannedFloorAreas({
      metadata: {
        runtime: {
          residential: {
            ...residential,
            basePlanId: undefined,
            stair: null,
            serviceStair: null,
            rooms: {},
            doorways: [],
          },
        },
      },
    });
    // Remove every upper void after thresholds and stair landings are compiled.
    for (const space of spaces.filter(CastleAuthoredResidentialPlan.filterSpace2)) {
      residential.walkableAreas = residential.walkableAreas.flatMap(
        /**
         * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
         */ (area) => {
          if (area.floorY !== space.floorY) {
            return [area];
          }
          const a = Math.max(area.minX, space.minX);
          const b = Math.min(area.maxX, space.maxX);
          const c = Math.max(area.minZ, space.minZ);
          const d = Math.min(area.maxZ, space.maxZ);
          if (b <= a || d <= c) {
            return [area];
          }
          return [{
            ...area,
            maxX: a,
          }, {
            ...area,
            minX: b,
          },
          {
            ...area,
            minX: a,
            maxX: b,
            maxZ: c,
          }, {
            ...area,
            minX: a,
            maxX: b,
            minZ: d,
          }]
            .filter(CastleAuthoredResidentialPlan.filterPiece2);
        },
      );
    }

    return residential;
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
   */
  static filterSpace(space) {
    return space.kind === "room";
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
   */
  static mapRoom(room) {
    return [room.id, room];
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
   */
  static filterOpening(opening) {
    return opening.kind === "door";
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} part
   */
  static filterPart(part) {
    return part.maxX > part.minX && part.maxZ > part.minZ;
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
   */
  static mapSpace(space) {
    return space.floorY;
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} piece
   */
  static filterPiece(piece) {
    return piece.maxX > piece.minX && piece.maxZ > piece.minZ;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static mapPoint(point) {
    return point.x;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static mapPoint2(point) {
    return point.x;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static mapPoint3(point) {
    return point.z;
  }

  /**
   * @param {{x:number,z:number}} point
   */
  static mapPoint4(point) {
    return point.z;
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} space
   */
  static filterSpace2(space) {
    return space.kind === "void";
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} piece
   */
  static filterPiece2(piece) {
    return piece.maxX > piece.minX && piece.maxZ > piece.minZ;
  }

  /**
   * @param {number} value
   */
  static mapValue(value) {
    return value.toFixed(5);
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}} remainder
   */
  static filterRemainder(remainder) {
    return (
      remainder.maxX - remainder.minX > 1e-6 &&
              remainder.maxY - remainder.minY > 1e-6 && remainder.maxZ - remainder.minZ > 1e-6
    );
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
   */
  static flatMapOpening(opening) {
    if (!opening.exteriorEntrance) {
      return [{
        ...opening,
        width: opening.width + (opening.frameClearance ?? 0),
      }];
    }
    // The bundled arch closes the shoulders. Clear the full leaf height
    // through the wall so its taller centre can swing past either jamb.
    return [{
      ...opening,
      height: opening.height - 0.05,
    }];
  }

  /**
   * @param {{roomId:string}} door
   */
  static findDoor(door) {
    return door.roomId === "upper-stair-room";
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleOpening} opening
   */
  static findOpening(opening) {
    return opening.roomId === "upper-stair-room" && opening.kind === "door";
  }

  /**
   * @param {(x:number,z:number)=>boolean} covered
   * @param {number} x
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} body
   * @param {(box:{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number})=>void} addBox
   * @param {number} thickness
   * @param {{floorY:number}} terrace
   * @param {number} z
   */
  static addHorizontalBattlement(
    covered,
    x,
    body,
    addBox,
    thickness,
    terrace,
    z,
  ) {
    if (covered(Math.min(x + 0.25, body.maxX), z)) {
      return;
    }
    addBox({
      minX:x,
      maxX:Math.min(x+0.5,body.maxX),
      minZ:z-thickness/2,
      maxZ:z+thickness/2,
      minY:terrace.floorY+0.25,
      maxY:terrace.floorY+0.75,
    });
  }

  /**
   * @param {(x:number,z:number)=>boolean} covered
   * @param {number} z
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} body
   * @param {(box:{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number})=>void} addBox
   * @param {number} thickness
   * @param {{floorY:number}} terrace
   * @param {number} x
   */
  static addVerticalBattlement(
    covered,
    z,
    body,
    addBox,
    thickness,
    terrace,
    x,
  ) {
    if (covered(x, Math.min(z + 0.25, body.maxZ))) {
      return;
    }
    addBox({
      minX:x-thickness/2,
      maxX:x+thickness/2,
      minZ:z,
      maxZ:Math.min(z+0.5,body.maxZ),
      minY:terrace.floorY+0.25,
      maxY:terrace.floorY+0.75,
    });
  }

  /**
   * @param {Record<string, any>} context
   */
  static layout(context) {
    const { authored, baseY, side, position, transverse, inward, adaptedDoors, residential } = context;

    return {
      empty: false,
      basePlanId: authored.basePlanId,
      baseY,
      primarySide: side,
      widthBlocks: position.width * 4,
      depthBlocks: position.depth * 4,
      facadeSpan: transverse * 4,
      castleDepth: inward * 4,
      worldLeft: position.x,
      worldTop: position.z,
      style: {
        id: authored.basePlanId,
        wallHeightBlocks: 15,
        towerSpanBlocks: 6,
      },
      openings: [{
        boundary: "FRONT",
        start: adaptedDoors[0].offset * 4,
        end: (adaptedDoors[0].offset + adaptedDoors[0].width) * 4,
      }],
      roomPlan: residential,
    };
  }

  /**
   * @param {Record<string, any>} context
   */
  static fixture(context) {
    const { item, scale, authored, gate, baseY, world, yaw } = context;
    const fixture = structuredClone(item);
    let x = item.position.x * scale;
    let z = item.position.z * scale;
    let rotation = item.rotation ?? 0;
    if (authored.mirrored) {
      if (gate.axis === "z") {
        x = 2 * gate.center - x;
        rotation = -rotation;
      } else {
        z = 2 * gate.center - z;
        rotation = 180 - rotation;
      }
    }
    if (item.preserveHandedness) {
      rotation = item.rotation ?? 0;
    }
    fixture.position = world(gate.center - x, gate.coordinate - z, baseY + (item.position.y ?? 0) * scale);
    fixture.rotation = yaw - 180 + rotation;
    for (const field of ["Z1", "Z2", "columnTop"]) {
      if (item[field] !== undefined) {
        fixture[field] = baseY + item[field] * scale;
      }
    }

    return fixture;
  }

  /**
   * @param {Record<string, any>} context
   */
  static centers(context) {
    const { position, along } = context;
    const centers = {
      NORTH: {
        x: position.x + along,
        z: position.z,
      },
      SOUTH: {
        x: position.x + along,
        z: position.z + position.depth,
      },
      WEST: {
        x: position.x,
        z: position.z + along,
      },
      EAST: {
        x: position.x + position.width,
        z: position.z + along,
      },
    };

    return centers;
  }

  static structure() {
    return {
      wall: {
        towerSpan: 6,
        wallHeight: 15,
      },
      towers: [],
      gatehouses: [],
      audienceWing: null,
    };
  }

  /**
   * @param {string} side
   */
  static yaw(side) {
    const yaw = {
      NORTH: 0,
      SOUTH: 180,
      WEST: 90,
      EAST: -90,
    }[side];

    return yaw;
  }
}
