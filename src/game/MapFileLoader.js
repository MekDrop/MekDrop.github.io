import { TerrainBlockDefinitions } from "./objects/terrain/TerrainBlockDefinitions.js";
import { StoredMapNotFoundError } from "./errors/map/index.js";

export class MapFileLoader {
  /**
   *
   * @type {Map}
   */
  static #loaders = new Map(
    Object.entries(
      import.meta.glob("./maps/tests/*.json", { import: "default" }),
    ).map(/**
     *
     * @param {{"0": number, "1": number}} options
     * @param {number} options."0"
     * @param {number} options."1"
     */
    ([filePath, loader]) => {
      const fileName = filePath.substring(
        filePath.lastIndexOf("/") + 1,
        filePath.length - 5,
      );
      return [`test_${fileName}`, loader];
    }),
  );

  /**
   *
   * @param {string} mapName
   */
  static async load(mapName) {
    const loader = this.#loaders.get(mapName);
    if (!loader) {
      throw new StoredMapNotFoundError({ mapName });
    }

    const storedMap = await loader();
    const mapData = JSON.parse(JSON.stringify(storedMap));
    mapData.pipeData = new Map(mapData.pipeData ?? []);
    mapData.mapName = mapName;
    TerrainBlockDefinitions.populate(mapData);
    return mapData;
  }
}
