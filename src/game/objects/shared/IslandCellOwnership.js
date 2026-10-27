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
    this.#groups = (connector.islands ?? [connector.nearIsland, connector.farIsland]).map(IslandCellOwnership.#mapCells);
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
    const connectorCells = new Set(
      (connector.cells ?? []).map(IslandCellOwnership.#mapCell),
    );
    const spans = (mapData.objects ?? []).filter(IslandCellOwnership.#isBridge).map(IslandCellOwnership.#bridgeSpan);
    for (const command of mapData.renderCommands ?? []) {
      if (command.method === "addSpan") {
        spans.push(command.args[0]);
      }
    }
    for (const span of spans) {
      const keys = span.cells.map(IslandCellOwnership.#mapCell2);
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
      if (owner < 0) {
        continue;
      }
      for (const key of keys) {
        for (const cells of this.#groups) {
          cells.delete(key);
        }
        this.#groups[owner].add(key);
      }
    }
  }

  get groups() {
    return this.#groups;
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {boolean}
   */
  static #isBridge(definition) {
    return definition.object === "Bridge";
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {import("../path/BridgeRailingKit.js").BridgeSpan}
   */
  static #bridgeSpan(definition) {
    return definition.span;
  }

  /**
   * @param {string[]} cells
   */
  static #mapCells(cells) {
    return new Set(cells);
  }

  /**
   * @param {{col: number, row: number}} cell
   */
  static #mapCell(cell) {
    return `${cell.col},${cell.row}`;
  }

  /**
   * @param {{col: number, row: number}} cell
   */
  static #mapCell2(cell) {
    return `${cell.col},${cell.row}`;
  }
}
