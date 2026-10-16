import { CastleResidentialLayout } from "../residents/CastleResidentialLayout.js";

/**
 * Places the signal station on an accessible crown, clear of the ladder hatch.
 */
export class CastleSignalTowerLayout {
  /**
   * @param {import("../../../GameContracts.js").CastleBuildPlan} buildPlan
   * @returns {{bell:{position:{x:number,y:number,z:number},rotation:number},flag:{position:{x:number,y:number,z:number},rotation:number,width:number,height:number,poleHeight:number},banner:{x:number,y:number,z:number,yaw:number,width:number,height:number,signalTower:boolean}}|null}
   */
  static describe(buildPlan) {
    const plan = buildPlan?.metadata?.runtime?.residential;
    if (!plan?.roofAccess) {
      return null;
    }
    const room = plan.placedRooms.find(CastleSignalTowerLayout.#findRoom);
    if (!room || room.maxX - room.minX < 3 || room.maxZ - room.minZ < 2.5) {
      return null;
    }
    const layout = new CastleResidentialLayout(buildPlan);
    const floorY = plan.roofAccess.top.y;
    const hole = plan.roofAccess.hole;
    // Pick the crown corner furthest from the hatch. The bell's calibrated
    // 1.405 x 0.482 m footprint remains entirely inside the supporting room walls.
    const x = (hole.minX + hole.maxX) / 2 < (room.minX + room.maxX) / 2
      ? room.maxX - 0.85 : room.minX + 0.85;
    const z = (hole.minZ + hole.maxZ) / 2 < (room.minZ + room.maxZ) / 2
      ? room.maxZ - 0.65 : room.minZ + 0.65;
    const position = layout.toWorld(x, z, floorY - layout.origin.y);
    const flagX = x < (room.minX + room.maxX) / 2 ? room.maxX - 0.45 : room.minX + 0.45;
    const flag = layout.toWorld(flagX, z, floorY - layout.origin.y);
    const wall = room.wallBounds ?? room;
    const banner = layout.toWorld((room.minX + room.maxX) / 2, wall.minZ - 0.275,
      room.floorY + 2.4 - layout.origin.y);

    return {
      bell: {
        position,
        rotation: layout.yaw,
      },
      flag: {
        position: flag,
        rotation: layout.yaw,
        width: 1.2,
        height: 0.7,
        poleHeight: 2.8,
      },
      banner: {
        ...banner,
        yaw: layout.yaw + 180,
        width: 0.65,
        height: 1.7,
        signalTower: true,
      },
    };
  }

  /**
   * @param {import("../residents/CastleResidentialLayout.js").ResidentialRoom} room
   */
  static #findRoom(room) {
    return room.id === "watchtower";
  }
}
