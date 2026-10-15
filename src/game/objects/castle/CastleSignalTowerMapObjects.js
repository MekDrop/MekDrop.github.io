import { CastleSignalTowerLayout } from "./CastleSignalTowerLayout.js";

/**
 * Publishes crown props as ordinary map objects; the castle retains its cloth banner.
 */
export class CastleSignalTowerMapObjects {
  /**
   * @param {import("../ObjectTypes.js").GameMapData} map
   */
  static prepareMap(map) {
    map.objects = (map.objects ?? []).filter(
      /**
       * @param {import("../ObjectTypes.js").MapObjectDefinition} item
       */
      item => !(item.generated && item.id.startsWith(`${item.sourceCastleId}-signal-`)),
    );
    for (const castle of [...map.objects]) {
      if (castle.object !== "Castle") { continue; }
      const station = CastleSignalTowerLayout.describe(castle.buildPlan);
      if (!station) { continue; }
      const decorations = castle.buildPlan.geometry.decorations;
      decorations.banners = decorations.banners.filter(
        /**
         * @param {{signalTower?:boolean}} banner
         */
        banner => !banner.signalTower,
      );
      decorations.banners.push(station.banner);
      for (const [suffix, object, placement] of [
        ["bell", "SignalBell", station.bell], ["flag", "Flag", station.flag],
      ]) {
        const { position } = placement;
        map.objects.push({ id: `${castle.id}-signal-${suffix}`, object, ...placement,
          generated: true, sourceCastleId: castle.id, sourceCastleSeed: castle.seed,
          tile: { col: Math.round(position.x + (map.cols - 1) / 2), row: Math.round(position.z + (map.rows - 1) / 2) } });
      }
    }
  }
}
