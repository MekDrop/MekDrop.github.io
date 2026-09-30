/**
 * Includes river-owned terrain in the same motion group as its banks.
 */
export class IslandCellOwnership {
  /**
   * @type {Set<string>[]}
   */
  #groups = [];

  /**
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  constructor(mapData) {
    const connector = mapData?.islandConnectorData;
    if (!connector) {
      return;
    }
    this.#groups = [connector.nearIsland, connector.farIsland].map(
      /**
       * @param {string[]} cells
       */
      (cells) => new Set(cells),
    );
    for (const river of mapData.riverData ?? []) {
      let owner = -1;
      for (const { col, row } of river.cells) {
        for (const [dc, dr] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
          owner = this.#groups.findIndex(
            /**
             * @param {Set<string>} cells
             */
            (cells) => cells.has(`${col + dc},${row + dr}`),
          );
          if (owner >= 0) {
            break;
          }
        }
        if (owner >= 0) {
          break;
        }
      }
      if (owner >= 0) {
        for (const { col, row } of river.cells) {
          this.#groups[owner].add(`${col},${row}`);
        }
      }
    }
  }

  get groups() {
    return this.#groups;
  }
}
