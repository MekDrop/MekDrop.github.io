import { CastleSignalTowerLayout } from "./CastleSignalTowerLayout.js";

/**
 * Publishes crown props as ordinary map objects; the castle retains its cloth banner.
 */
export class CastleSignalTowerMapObjects {
  /**
   * @param {import("../../ObjectTypes.js").GameMapData} map
   */
  static prepareMap(map) {
    map.objects = (map.objects ?? []).filter(
      CastleSignalTowerMapObjects.#filterItem,
    );
    for (const castle of [...map.objects]) {
      if (castle.object !== "Castle") { continue; }
      const station = CastleSignalTowerLayout.describe(castle.buildPlan);
      if (!station) {
        continue;
      }
      const decorations = castle.buildPlan.geometry.decorations;
      decorations.banners = decorations.banners.filter(
        CastleSignalTowerMapObjects.#filterBanner,
      );
      decorations.banners.push(station.banner);
      CastleSignalTowerMapObjects.#addStationObject(map, castle, "bell", "SignalBell", station.bell);
      CastleSignalTowerMapObjects.#addStationObject(map, castle, "flag", "Flag", station.flag);
    }
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
   */
  static #filterItem(item) {
    return !(item.generated && item.id.startsWith(`${item.sourceCastleId}-signal-`));
  }

  /**
   * @param {{signalTower?:boolean}} banner
   */
  static #filterBanner(banner) {
    return !banner.signalTower;
  }

  /**
   * @param {import("../../ObjectTypes.js").GameMapData} map
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} castle
   * @param {string} suffix
   * @param {string} object
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} placement
   */
  static #addStationObject(map, castle, suffix, object, placement) {
    const { position } = placement;
    map.objects.push({
      id: `${castle.id}-signal-${suffix}`,
      object,
      ...placement,
      generated: true,
      sourceCastleId: castle.id,
      sourceCastleSeed: castle.seed,
      tile: {
        col: Math.round(position.x + (map.cols - 1) / 2),
        row: Math.round(position.z + (map.rows - 1) / 2),
      },
    });
  }
}
