import { StoredMapNotFoundError } from "./errors/map/index.js";

export class MapFileLoader {
  static #loaders = new Map(
    Object.entries(
      import.meta.glob("./maps/tests/*.json", { import: "default" }),
    ).map(([filePath, loader]) => {
      const fileName = filePath.substring(
        filePath.lastIndexOf("/") + 1,
        filePath.length - 5,
      );
      return [`test_${fileName}`, loader];
    }),
  );

  static async load(mapName) {
    const loader = this.#loaders.get(mapName);
    if (!loader) {
      throw new StoredMapNotFoundError({ mapName });
    }

    const storedMap = await loader();
    const mapData = JSON.parse(JSON.stringify(storedMap));
    mapData.pipeData = new Map(mapData.pipeData ?? []);
    return mapData;
  }
}
