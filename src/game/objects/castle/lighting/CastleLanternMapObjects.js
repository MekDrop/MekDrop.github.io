import { CastleResidentialLayout } from "../residents/CastleResidentialLayout.js";
import { LanternWallPlacement } from "./LanternWallPlacement.js";

/**
 * Publishes formerly castle-owned lanterns through normal map object lifecycles.
 */
export class CastleLanternMapObjects {
  /**
   * @param {import("../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const castles = (mapData.objects ?? []).filter(
      CastleLanternMapObjects.#filterItem,
    );
    const ids = new Set(castles.map(CastleLanternMapObjects.#mapCastle));
    mapData.objects = (mapData.objects ?? []).filter(
      /**
       * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
       */
      item => !item.castleLantern || !ids.has(item.sourceCastleId));
    for (const castle of castles) {
      const plan = castle.buildPlan;
      const residential = plan.metadata.runtime.residential;
      const layout = residential ? new CastleResidentialLayout(plan) : null;
      let index = 0;
      /**
       * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
       */
      const add = item => {
        const position = item.position;
        // Castle parts share the footprint's island even when a wall projects
        // beyond the terrain cell which owns the facade.
        const { x, z } = plan.input.position;
        mapData.objects.push({
          ...item,
          id: `${castle.id}-lantern-${index++}`,
          generated: true,
          castleLantern: true,
          sourceCastleId: castle.id,
          tile: {
            col: Math.floor(x + mapData.cols / 2),
            row: Math.floor(z + mapData.rows / 2),
          },
          position,
        });
      };
      const wallCollision = {
        halfExtents: {
          x: 0.0799,
          y: 0.3,
          z: 0.13,
        },
        offset: {
          x: 0,
          y: 0.3,
          z: 0,
        },
      };
      if (layout && plan.layout.basePlanId && plan.input.doors?.length) {
        const entrance = residential.openings.find(
          CastleLanternMapObjects.#findOpening,
        );
        if (entrance) {
          CastleLanternMapObjects.#addEntranceLantern(add, layout, entrance, -1);
          CastleLanternMapObjects.#addEntranceLantern(add, layout, entrance, 1);
        }
      }

      const door = plan.input.doors?.[0];
      if (!door) {
        continue;
      }
      const { x, z, width, depth, elevation = 0 } = plan.input.position;
      const offset = (door.offset ?? 0) + (door.width ?? 2) / 2;
      const directions = {
        NORTH: {
          x: x + offset,
          z,
          yaw: 0,
          span: width,
          capacity: depth,
        },
        SOUTH: {
          x: x + offset,
          z: z + depth,
          yaw: 180,
          span: width,
          capacity: depth,
        },
        WEST: {
          x,
          z: z + offset,
          yaw: 90,
          span: depth,
          capacity: width,
        },
        EAST: {
          x: x + width,
          z: z + offset,
          yaw: -90,
          span: depth,
          capacity: width,
        },
      };
      const direction = directions[door.side] ?? directions.NORTH;
      const room = layout && (layout.audienceFloorBounds ?? layout.rooms.work);
      const roomWidth = room ? room.maxX - room.minX : Math.max(0,
        Math.min(direction.span - 1.64, plan.metadata.runtime.interiorWidth, 6.4));
      const floorDepth = room ? room.maxZ : Math.min(Math.max(0, direction.capacity - 0.5),
        Math.max(0, plan.metadata.runtime.interiorDepth));
      const throne = layout?.reservations.find(
        CastleLanternMapObjects.#findZone,
      );
      const clearance = layout?.throneRearWindow ? 0.35 : 0.65;
      const forward = throne ? throne.maxZ - clearance : Math.max(0, floorDepth - clearance);
      const yaw = layout?.yaw ?? direction.yaw;
      const angle = yaw * Math.PI / 180;
      // Audience rooms use a positive map-axis tangent on both opposing
      // facades; planned residential rooms use their rotated local X axis.
      const tangentX = room ? Math.cos(angle) : ["NORTH", "SOUTH"].includes(door.side) ? 1 : 0;
      const tangentZ = room ? -Math.sin(angle) : ["WEST", "EAST"].includes(door.side) ? 1 : 0;
      CastleLanternMapObjects.#addWallLantern(
        roomWidth,
        room,
        layout,
        direction,
        add,
        tangentX,
        angle,
        forward,
        elevation,
        tangentZ,
        yaw,
        wallCollision,
        -1,
      );
      CastleLanternMapObjects.#addWallLantern(
        roomWidth,
        room,
        layout,
        direction,
        add,
        tangentX,
        angle,
        forward,
        elevation,
        tangentZ,
        yaw,
        wallCollision,
        1,
      );
    }
    LanternWallPlacement.prepareMap(mapData);
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
   */
  static #filterItem(item) {
    return item.object === "Castle" && item.buildPlan?.input?.position;
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} castle
   */
  static #mapCastle(castle) {
    return castle.id;
  }

  /**
   * @param {{exteriorEntrance:boolean}} opening
   */
  static #findOpening(opening) {
    return opening.exteriorEntrance;
  }

  /**
   * @param {{role:string}} zone
   */
  static #findZone(zone) {
    return zone.role === "throne";
  }

  /**
   * @param {(item:import("../../ObjectTypes.js").MapObjectDefinition)=>void} add
   * @param {CastleResidentialLayout} layout
   * @param {{width:number}} entrance
   * @param {number} flank
   */
  static #addEntranceLantern(add, layout, entrance, flank) {
    add({
      object: "Lantern",
      type: "entrance",
      // Seed the doorway flanks; the masonry pass seats each bracket on its
      // nearest actual wall face, including recessed and asymmetric facades.
      position: layout.toWorld(flank * (entrance.width / 2 + 0.54), -0.68, 1.3),
      rotation: layout.yaw + 180,
      scale: 1.6,
      stretch: {
        x: 0.8633,
        y: 1,
        z: 0.8633,
      },
      collisionBox: {
        halfExtents: {
          x: 0.0935,
          y: 0.225,
          z: 0.1284,
        },
        offset: {
          x: 0,
          y: 0.225,
          z: 0,
        },
      },
      lighting: {
        position: {
          x: 0,
          y: 0.17,
          z: 0.1,
        },
        modelSpace: true,
        color: [1, 0.38, 0.06],
        intensity: 0.85,
        range: 2.2,
      },
    });
  }

  /**
   * @param {number} roomWidth
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} room
   * @param {CastleResidentialLayout} layout
   * @param {{x:number,z:number,yaw:number,span:number,capacity:number}} direction
   * @param {(item:import("../../ObjectTypes.js").MapObjectDefinition)=>void} add
   * @param {number} tangentX
   * @param {number} angle
   * @param {number} forward
   * @param {number} elevation
   * @param {number} tangentZ
   * @param {number} yaw
   * @param {{halfExtents:{x:number,y:number,z:number},offset:{x:number,y:number,z:number}}} wallCollision
   * @param {number} side
   */
  static #addWallLantern(
    roomWidth,
    room,
    layout,
    direction,
    add,
    tangentX,
    angle,
    forward,
    elevation,
    tangentZ,
    yaw,
    wallCollision,
    side,
  ) {
    const lateral = side * Math.min(2.8, roomWidth / 2 - 0.1);
    const center = room ? layout.toWorld((room.minX + room.maxX) / 2, 0, 0) : direction;
    // The authored backplate ends 13 cm behind the origin, scaled to 85%.
    const mountForward = room ? room.maxZ - 0.13 * 0.85 + 0.003 : forward + 0.6;
    add({
      object: "Lantern",
      type: "wall",
      position: {
        x: center.x + tangentX * lateral + Math.sin(angle) * mountForward,
        y: elevation + 0.85,
        z: center.z + tangentZ * lateral + Math.cos(angle) * mountForward,
      },
      rotation: yaw + 180,
      scale: 0.85,
      collisionBox: wallCollision,
      lighting: {
        position: {
          x: 0,
          y: 0.27,
          z: 0.25,
        },
        flicker: true,
        intensity: 0.6,
        range: 0.78,
        phase: (side === 1 ? 1.713 : 0) +
          (center.x + tangentX * lateral + Math.sin(angle) * (forward + 0.35)) * 0.37 +
          (center.z + tangentZ * lateral + Math.cos(angle) * (forward + 0.35)) * 0.53,
      },
    });
  }
}
