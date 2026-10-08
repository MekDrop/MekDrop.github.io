/**
 * Keeps rivers and complete bridge spans in one visual motion group.
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
    this.#groups = (connector.islands ?? [connector.nearIsland, connector.farIsland]).map(
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
    const connectorCells = new Set((connector.cells ?? []).map(/**
     * @param {{col: number, row: number}} cell
     */
    (cell) => `${cell.col},${cell.row}`));
    for (const command of mapData.renderCommands ?? []) {
      if (command.method !== "addSpan") continue;
      const span = command.args[0];
      const keys = span.cells.map(/**
       * @param {{col: number, row: number}} cell
       */
      (cell) => `${cell.col},${cell.row}`);
      // Prefer the connector's near-island owner, even if the render span starts
      // on the other island. All deck tiles, fascia, and rails share this owner.
      const anchor = keys.find(/**
       * @param {string} key
       */
      (key) => connectorCells.has(key)) ?? keys[0];
      const owner = this.#groups.findIndex(/**
       * @param {Set<string>} cells
       */
      (cells) => cells.has(anchor));
      if (owner < 0) continue;
      for (const key of keys) {
        for (const cells of this.#groups) cells.delete(key);
        this.#groups[owner].add(key);
      }
    }
  }

  get groups() {
    return this.#groups;
  }
}
