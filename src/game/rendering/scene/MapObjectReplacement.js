import { MapObjectDefinitions } from "../../objects/MapObjectDefinitions.js";

/**
 * Keeps pre-excavation terrain so changing an authored object cannot retain cuts
 * from its previous layout. Runtime state of other authored objects is retained.
 */
export class MapObjectReplacement {
  /**
   * @type {import("../../GameContracts.js").GameMapData}
   */
  #template;

  /**
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  constructor(mapData) {
    this.#template = structuredClone(mapData);
  }

  /**
   * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} definition
   * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition[]} currentDefinitions
   * @param {{x:number,y:number,z:number}} heroPosition
   * @returns {import("../../GameContracts.js").GameMapData|null}
   */
  replace(definition, currentDefinitions, heroPosition) {
    /**
     *
     * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
     */
    const matchesDefinitionId = (entry) => entry.id === definition.id;
    if (!this.#template.objects.some(matchesDefinitionId)) {
      return null;
    }
    const map = structuredClone(this.#template);
    const current = new Map(
      currentDefinitions
        .filter(MapObjectReplacement.#filterEntry)
        .map(MapObjectReplacement.#mapEntry),
    );
    current.set(definition.id, definition);
    map.objects = map.objects.map(/**
     *
     * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
     */
      (entry) => structuredClone(current.get(entry.id) ?? entry));
    MapObjectDefinitions.prepare(map);
    map.heroSpawn = { ...heroPosition };

    return map;
  }

  /**
   *
   * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
   */
  static #filterEntry(entry) {
    return !entry.generated;
  }

  /**
   *
   * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
   */
  static #mapEntry(entry) {
    return [entry.id, entry];
  }
}
