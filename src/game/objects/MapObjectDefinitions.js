/**
 * Exposes derived runtime views of canonical map object records.
 * Views are non-enumerable: saved maps have only one source of authored data.
 */
export class MapObjectDefinitions {
  /**
   * @param {import("../GameContracts.js").GameMapData} map
   */
  static prepare(map) {
    map.objects ??= [];
    /**
     * @param {string} object
     * @param {string} id
     * @param {Partial<import("./ObjectTypes.js").MapObjectDefinition>} properties
     */
    const add = (object, id, properties) => {
      let uniqueId = id;
      while (map.objects.some(/**
       *
       * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
       */
        (definition) => definition.id === uniqueId)) {
        uniqueId += "-duplicate";
      }
      map.objects.push({
        id: uniqueId,
        object,
        ...properties,
      });
    };
    let indexedObjects;
    let indexedLength = -1;
    const byClass = new Map();
    /**
     * @param {string} object
     * @returns {import("./ObjectTypes.js").MapObjectDefinition|undefined}
     */
    const first = (object) => {
      if (indexedObjects !== map.objects || indexedLength !== map.objects.length) {
        indexedObjects = map.objects;
        indexedLength = map.objects.length;
        byClass.clear();
        for (const definition of map.objects) {
          if (!byClass.has(definition.object)) {
            byClass.set(definition.object, definition);
          }
        }
      }
      return byClass.get(object);
    };
    /**
     * @param {string} object
     * @param {string} field
     * @param {import("./ObjectTypes.js").MapObjectDefinition[keyof import("./ObjectTypes.js").MapObjectDefinition]} value
     */
    const write = (object, field, value) => {
      const record = first(object);
      if (value == null) {
        map.objects = map.objects.filter(/**
         * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
         */
          (definition) => definition.object !== object);
      } else if (record) {
        record[field] = value;
      } else {
        add(object, object.toLowerCase(), { [field]: value });
      }
    };
    /**
     * @param {string} field
     * @param {() => import("./ObjectTypes.js").MapObjectDefinition[keyof import("./ObjectTypes.js").MapObjectDefinition]} get
     * @param {(value: import("./ObjectTypes.js").MapObjectDefinition[keyof import("./ObjectTypes.js").MapObjectDefinition]) => void} [set]
     */
    const view = (field, get, set) => {
      Object.defineProperty(map, field, {
        configurable: true,
        enumerable: false,
        get,
        set,
      });
    };
    view("entries", () =>
      map.objects
        .filter(MapObjectDefinitions.#filterDefinition3)
        .map(MapObjectDefinitions.#mapDefinition),
    );
    view("riverData", () => first("Rivers")?.rivers ?? [], /**
     * @param {import("./ObjectTypes.js").MapObjectDefinition["rivers"]} rivers
     */
      (rivers) => write("Rivers", "rivers", rivers));
    view(
      "groundCoverData",
      () => first("GroundCover")?.placements ?? [] /**
       *
       * @param {import("../generator/map/MapGenerationTypes.js").GroundCoverData} placements
       */,
      /**
       *
       * @param {import("../generator/map/MapGenerationTypes.js").GroundCoverData} placements
       */
      (placements) => {
        map.objects = map.objects.filter(
          MapObjectDefinitions.#filterDefinition4,
        );
        map.objects.push({
          id: "ground-cover",
          object: "GroundCover",
          placements,
        });
      },
    );
    view("overpassData", () => first("Overpass")?.layout ?? null, /**
     * @param {import("./ObjectTypes.js").PathOverpass} layout
     */
      (layout) => write("Overpass", "layout", layout));
    view("heroSpawn", () => first("SpawnPoint")?.position, /**
     *
     * @param {import("./ObjectTypes.js").Point3} position
     */
      (position) => {
        const spawn = first("SpawnPoint");
        if (spawn) {
          spawn.position = position;
        } else {
          add("SpawnPoint", "hero-spawn", { position });
        }
      });
    view("islandConnectorData", () => first("IslandConnector")?.topology, /**
     * @param {import("./ObjectTypes.js").MapObjectDefinition["topology"]} topology
     */
      (topology) => write("IslandConnector", "topology", topology));
    view("castle", () => first("Castle")?.navigation ?? null);
  }

  /**
   *
   * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition3(definition) {
    return definition.object === "Gateway";
  }

  /**
   *
   * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
   */
  static #mapDefinition(definition) {
    return definition.entry;
  }

  /**
   *
   * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition4(definition) {
    return definition.object !== "GroundCover";
  }
}
