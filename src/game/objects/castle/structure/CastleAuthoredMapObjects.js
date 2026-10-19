/**
 * Publishes plan-authored fixtures through the ordinary map object lifecycle.
 */
export class CastleAuthoredMapObjects {
  /**
   * @param {import("../../../GameContracts.js").GameMapData} map
   */
  static prepareMap(map) {
    map.objects = (map.objects ?? []).filter(CastleAuthoredMapObjects.#keepObject);
    for (const castle of [...map.objects]) {
      if (castle.object !== "Castle") {
        continue;
      }
      const position = castle.buildPlan?.input?.position ?? castle.position;
      for (const item of castle.buildPlan?.metadata?.runtime?.authoredObjects ?? []) {
        const id = `${castle.id}-authored-${item.id}`;
        // Older test maps may still author the same fixture explicitly.
        const exists = map.objects.some(/**
         *
         * @param {import("../../ObjectTypes.js").MapObjectDefinition} candidate
         */
          candidate => candidate.id === item.id || candidate.id === id);
        if (exists) {
          continue;
        }
        map.objects.push({
          ...structuredClone(item),
          id,
          generated: true,
          authoredCastleFixture: true,
          sourceCastleId: castle.id,
          tile: {
            col: Math.floor(position.x + map.cols / 2),
            row: Math.floor(position.z + map.rows / 2),
          },
        });
      }
    }
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
   */
  static #keepObject(item) {
    return !item.authoredCastleFixture;
  }
}
