/**
 * Converts legacy map fields to object records and exposes derived runtime views.
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
        uniqueId += "-legacy";
      }
      map.objects.push({ id: uniqueId, object, ...properties });
    };
    /**
     * @param {string} field
     */
    const authored = (field) => Object.getOwnPropertyDescriptor(map, field)?.enumerable;
    if (authored("entries")) {
      for (const [index, entry] of (map.entries ?? []).entries()) {
        add("Gateway", `gateway-${index}`, { entry });
      }
    }
    if (authored("riverData") && map.riverData?.length) {
      add("Rivers", "rivers", { rivers: map.riverData });
    }
    if (authored("groundCoverData") && map.groundCoverData?.length) {
      add("GroundCover", "ground-cover", { placements: map.groundCoverData });
    }
    if (authored("overpassData") && map.overpassData) {
      add("Overpass", "overpass", { layout: map.overpassData });
    }
    if (authored("heroSpawn") && map.heroSpawn) {
      map.objects = map.objects.filter(/**
       * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => definition.object !== "SpawnPoint");
      add("SpawnPoint", "hero-spawn", { position: map.heroSpawn });
    }
    if (authored("islandConnectorData") && map.islandConnectorData) {
      add("IslandConnector", "island-connector", { topology: map.islandConnectorData });
    }
    if (authored("castle") && map.castle) {
      const castle = map.objects.find(/**
       *
       * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => definition.object === "Castle");
      if (castle) {
        castle.navigation = map.castle;
      }
    }
    if (authored("castles")) {
      const castles = map.objects.filter(/**
       * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => definition.object === "Castle");
      for (const [index, navigation] of (map.castles ?? []).entries()) {
        if (castles[index]) {
          castles[index].navigation ??= navigation;
        }
      }
    }
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
      Object.defineProperty(map, field, { configurable: true, enumerable: false, get, set });
    };
    view("entries", () => map.objects.filter(/**
     *
     * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
     */
    (definition) => definition.object === "Gateway").map(/**
     *
     * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
     */
    (definition) => definition.entry));
    view("riverData", () => first("Rivers")?.rivers ?? [], /**
     * @param {import("./ObjectTypes.js").MapObjectDefinition["rivers"]} rivers
     */
    (rivers) => write("Rivers", "rivers", rivers));
    view("groundCoverData", () => first("GroundCover")?.placements ?? [], /**
     *
     * @param {import("../generator/map/MapGenerationTypes.js").GroundCoverData} placements
     */
    (placements) => {
      map.objects = map.objects.filter(/**
       *
       * @param {import("./ObjectTypes.js").MapObjectDefinition} definition
       */
      (definition) => definition.object !== "GroundCover");
      map.objects.push({ id: "ground-cover", object: "GroundCover", placements });
    });
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
    if (first("Castle") || !map.castle) {
      view("castle", () => first("Castle")?.navigation ?? null);
    }
    delete map.castles;
  }
}
