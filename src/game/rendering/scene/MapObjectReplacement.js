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
    if (!this.#template.objects.some(/**
     *
     * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
     */
    (entry) => entry.id === definition.id)) {
      return null;
    }
    const map = structuredClone(this.#template);
    const current = new Map(currentDefinitions.filter(/**
     *
     * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
     */
    (entry) => !entry.generated).map(/**
     *
     * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
     */
    (entry) => [entry.id, entry]));
    current.set(definition.id, definition);
    map.objects = map.objects.map(/**
     *
     * @param {import("../../objects/ObjectTypes.js").MapObjectDefinition} entry
     */
    (entry) => structuredClone(current.get(entry.id) ?? entry));
    map.heroSpawn = { ...heroPosition };
    return map;
  }
}
