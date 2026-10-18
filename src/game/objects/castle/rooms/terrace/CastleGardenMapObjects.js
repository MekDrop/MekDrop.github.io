import { CastleResidentialLayout } from "../../residents/CastleResidentialLayout.js";
import { CASTLE_TERRACE_STYLE } from "../../../../enum/CastleTerraceStyle.js";

/**
 * Castle-owned facade dressing, published as normal independent map objects.
 */
export class CastleGardenMapObjects {
  /**
   * @param {import("../../../../GameContracts.js").GameMapData} map
   */
  static prepareMap(map) {
    const castles = map.objects.filter(CastleGardenMapObjects.#isCastle);
    const ids = new Set(castles.map(CastleGardenMapObjects.#castleId));
    map.objects = map.objects.filter(/**
     * @param {import("../../../ObjectTypes.js").MapObjectDefinition} object
     */
      object => !object.castleGardenDressing || !ids.has(object.sourceCastleId));
    for (const castle of castles) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.terraceStyle) {
        continue;
      }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      const hall = plan.buildings[0];
      const aged = plan.terraceStyle === CASTLE_TERRACE_STYLE.STORYBOOK;
      // Stay clear of every door and window. The entrance is at local X=0;
      // these three solid wall bays are measured from the hall's outer ends.
      for (const [index, x] of [hall.minX + 1.25, hall.maxX - 1.25].entries()) {
        const face = CastleGardenMapObjects.#frontSurface(castle.buildPlan, layout, hall.minZ, x);
        const position = layout.toWorld(x, face - 0.045, 3.35);
        CastleGardenMapObjects.#add(map, castle, `banner-${index}`, "Banner", {
          position,
          variant: "cloth",
          rotation: layout.yaw + 180,
          width: 0.8,
          height: 1.8,
        });
      }
      const count = aged ? 4 : 2;
      for (let index = 0; index < count; index++) {
        const x = hall.minX + 0.55 + index * 1.1;
        const face = CastleGardenMapObjects.#frontSurface(castle.buildPlan, layout, hall.minZ, x);
        const position = layout.toWorld(x, face - 0.035, 3.95);
        CastleGardenMapObjects.#add(map, castle, `ivy-${index}`, "CliffVine", {
          position,
          rotation: layout.yaw + 180,
          height: aged ? 3.7 : 2.4,
          seed: `${castle.seed}:garden-ivy:${index}`,
        });
      }
    }
  }

  /**
   * Mount on the actual generated exterior brick face, including wall thickness.
   * @param {import("../../../../GameContracts.js").CastleBuildPlan} plan
   * @param {CastleResidentialLayout} layout
   * @param {number} nominalZ
   * @param {number} x
   * @returns {number}
   */
  static #frontSurface(plan, layout, nominalZ, x) {
    const crosswise = Math.abs(Math.sin(layout.yaw * Math.PI / 180)) > 0.5;
    let face = nominalZ;
    for (const box of plan.geometry.boxes) {
      if (Math.abs(box.y - (layout.origin.y + 2.5)) > box.sy / 2 + 0.01) {
        continue;
      }
      const point = layout.toLocal(box.x, box.z);
      const halfX = (crosswise ? box.sz : box.sx) / 2;
      const halfZ = (crosswise ? box.sx : box.sz) / 2;
      if (Math.abs(point.x - x) <= halfX + 0.01 && Math.abs(point.z - nominalZ) < 0.6) {
        face = Math.min(face, point.z - halfZ);
      }
    }

    return face;
  }

  /**
   * @param {import("../../../../GameContracts.js").GameMapData} map
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} castle
   * @param {string} suffix
   * @param {string} object
   * @param {Partial<import("../../../ObjectTypes.js").MapObjectDefinition>} properties
   */
  static #add(map, castle, suffix, object, properties) {
    map.objects.push({
      id: `${castle.id}-garden-${suffix}`,
      object,
      ...properties,
      sourceCastleId: castle.id,
      castleGardenDressing: true,
      generated: true,
      tile: {
        col: Math.round(properties.position.x + (map.cols - 1) / 2),
        row: Math.round(properties.position.z + (map.rows - 1) / 2),
      },
    });
  }

  /**
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} object
   * @returns {boolean}
   */
  static #isCastle(object) {
    return object.object === "Castle";
  }

  /**
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} castle
   * @returns {string}
   */
  static #castleId(castle) {
    return castle.id;
  }
}
