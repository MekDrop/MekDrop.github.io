import { TileType } from "../../generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { COIN_TYPE } from "../../enum/CoinType.js";
import { MOVEMENT_REFUSAL } from "../../enum/MovementRefusal.js";
import { TREASURE_CHEST_ANIMATION } from "../../enum/TreasureChestAnimation.js";
import { colorFromHex } from "../../helpers/colors.js";
import coinModelUrl from "../../models/treasure/coin.glb?url";
import chestModelUrl from "../../models/treasure/treasure-chest.glb?url";
import earthModelUrl from "../../models/treasure/excavated-earth.glb?url";
import filledEarthModelUrl from "../../models/treasure/filled-earth.glb?url";
import holeModelUrl from "../../models/treasure/hole.glb?url";
import riverStoneAngularModelUrl from "../../models/water/river-stone-angular.glb?url";
import riverStoneFlatModelUrl from "../../models/water/river-stone-flat.glb?url";
import riverStoneModelUrl from "../../models/water/river-stone.glb?url";
import { DigInteraction } from "./DigInteraction.js";
import { FillHoleInteraction } from "./FillHoleInteraction.js";
import { TreasureChestInteraction } from "./TreasureChestInteraction.js";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";

/**
 * @typedef {{x: number, y: number, z: number}} Point3
 */

/**
 * @typedef {object} TreasureSite
 * @property {string} id
 * @property {number} col
 * @property {number} row
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} state
 * @property {number} elapsed
 * @property {import("playcanvas").Entity|null} hole
 * @property {import("playcanvas").Entity|null} earthPile
 * @property {import("playcanvas").Entity|null} filledPatch
 * @property {import("playcanvas").Entity|null} chest
 * @property {Array<import("playcanvas").Material>} chestMaterials
 * @property {Array<string>} contents
 * @property {Array<import("playcanvas").Entity>} rocks
 */

/**
 * @typedef {object} TreasureCoin
 * @property {import("playcanvas").Entity} entity
 * @property {TreasureSite} site
 * @property {string} type
 * @property {string} state
 * @property {Point3} position
 * @property {Point3} skyStart
 * @property {Point3} skyControlA
 * @property {Point3} skyOffset
 * @property {number} skyDelay
 * @property {number} elapsed
 * @property {number} flightSide
 * @property {number} rotation
 */

/**
 * @typedef {object} FillClod
 * @property {import("playcanvas").Entity} entity
 * @property {Point3} start
 * @property {Point3} end
 * @property {Point3} control
 * @property {number} delay
 * @property {number} elapsed
 * @property {number} scale
 */

const MINIMUM_FACING_DOT = Math.cos((50 * Math.PI) / 180);
const INTERACTION_REACH = 1.18;
const HOLE_INITIAL_SCALE = 0.42;
const BLOCKED_DIG_HOLE_SCALE = 0.36;
const HOLE_EXPAND_DURATION = 0.36;
const CHEST_EMERGE_DURATION = 0.72;
const CHEST_OPEN_DURATION = 0.62;
const CHEST_FADE_DURATION = 0.82;
const CHEST_COLLISION_RADIUS = 0.3;
const HOLE_COLLISION_RADIUS = 0.3;
const COIN_COLLECTION_DURATION = 0.68;
const COIN_SKY_FLIGHT_DURATION = 0.72;
const COIN_SKY_STAGGER = 0.035;
const COIN_SKY_HEIGHT = 1.75;
const FILL_CLOD_COUNT = 9;
const FILL_CLOD_DURATION = 0.52;
const FILL_CLOD_STAGGER = 0.035;
const COIN_DEFINITIONS = new Map([
  [COIN_TYPE.GOLD, { color: 0xffc84a, weight: 12 }],
  [COIN_TYPE.SILVER, { color: 0xd8e2ea, weight: 30 }],
  [COIN_TYPE.COPPER, { color: 0xd7793d, weight: 58 }],
]);
const BLOCKED_DIG_ROCKS = [
  {
    modelUrl: riverStoneFlatModelUrl,
    burialDepth: 0,
    offsetX: -0.055,
    offsetZ: -0.025,
    rotation: 18,
    scale: 0.3,
  },
  {
    modelUrl: riverStoneAngularModelUrl,
    burialDepth: 0.012,
    offsetX: 0.05,
    offsetZ: 0.035,
    rotation: 112,
    scale: 0.25,
  },
  {
    modelUrl: riverStoneModelUrl,
    burialDepth: 0.003,
    offsetX: 0.01,
    offsetZ: -0.06,
    rotation: 236,
    scale: 0.21,
  },
];

export class BuriedTreasureField {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      chestModelUrl,
      coinModelUrl,
      holeModelUrl,
      earthModelUrl,
      filledEarthModelUrl,
      riverStoneModelUrl,
      riverStoneFlatModelUrl,
      riverStoneAngularModelUrl,
    ];
  }

  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").GameMapData}
   */
  #mapData;
  /**
   *
    * @type {import("src/game/models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   *
    * @type {import("../hero/tools/HeroTool.js").HeroTool|null}
   */
  #tool = null;
  /**
   *
    * @type {Set}
   */
  #dugTiles = new Set();
  /**
   *
    * @type {Map}
   */
  #vegetationTileCounts = new Map();
  /**
   *
    * @type {Map}
   */
  #groundCoverTileCounts = new Map();
  /**
   *
    * @type {Set}
   */
  #stoneTiles = new Set();
  /**
   *
    * @type {Set}
   */
  #harvestedFlowerTiles = new Set();
  /**
   *
    * @type {Set}
   */
  #harvestedMushroomTiles = new Set();
  /**
   *
    * @type {Set}
   */
  #felledTreeTiles = new Set();
  /**
   *
    * @type {Map}
   */
  #riverSourceCovers = new Map();
  /**
   *
    * @type {Array<TreasureSite>}
   */
  #sites = [];
  /**
   * @type {Map<string, TreasureSite>}
   */
  #buriedChests = new Map();
  /**
   *
    * @type {Array<TreasureCoin>}
   */
  #coins = [];
  /**
   *
    * @type {Array<FillClod>}
   */
  #fillClods = [];
  /**
   *
    * @type {Map}
   */
  #materials = new Map();
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #soilMaterial;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #heroPosition = null;
  /**
   *
    * @type {(coinType: string, amount: number) => void}
   */
  #onCollectCoin;
  /**
   *
    * @type {(interaction: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void}
   */
  #onInteractionChange;
  /**
   *
    * @type {(position: {x: number, y: number, z: number}, radius: number) => void}
   */
  #onTerrainExcavated;
  /**
   *
    * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, mapData: import("src/game/objects/ObjectTypes.js").GameMapData, modelLibrary: string, onCollectCoin: (coinType: string, amount: number) => void, onInteractionChange: (interaction: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onTerrainExcavated: (position: {x: number, y: number, z: number}, radius: number) => void}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {string} options.modelLibrary
   * @param {(coinType: string, amount: number) => void} options.onCollectCoin
   * @param {(interaction: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void} options.onInteractionChange
   * @param {(position: {x: number, y: number, z: number}, radius: number) => void} options.onTerrainExcavated
   */
  constructor({
    pc,
    app,
    mapData,
    modelLibrary,
    onCollectCoin = null,
    onInteractionChange = null,
    onTerrainExcavated = null,
  }) {

    this.#pc = pc;

    this.#mapData = mapData;

    this.#modelLibrary = modelLibrary;

    this.#onCollectCoin = onCollectCoin;

    this.#onInteractionChange = onInteractionChange;

    this.#onTerrainExcavated = onTerrainExcavated;

    this.#entity = new pc.Entity("Buried treasure field");
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, mapData);
    this.#registerRiverSourceCovers();
    for (const { tile: { col, row } } of (mapData.objects ?? [])
      .filter(/**
       *
       * @param {{object: string}} options
       * @param {string} options.object
       */
      ({ object }) => object === "Vegetation")) {
      const key = this.#tileKey(col, row);
      this.#vegetationTileCounts.set(
        key,
        (this.#vegetationTileCounts.get(key) ?? 0) + 1,
      );
    }
    for (const { tile: { col, row } } of (mapData.objects ?? [])
      .filter(/**
       *
       * @param {{object: string}} options
       * @param {string} options.object
       */
      ({ object }) => object === "StoneCluster")) {
      this.#stoneTiles.add(this.#tileKey(col, row));
    }
    for (const { col, row } of mapData.groundCoverData ?? []) {
      const key = this.#tileKey(col, row);
      this.#groundCoverTileCounts.set(
        key,
        (this.#groundCoverTileCounts.get(key) ?? 0) + 1,
      );
    }
    this.#createMaterials();
    for (const cube of mapData.objects ?? []) {
      if (!cube.buriedTreasure) {
        continue;
      }
      const { col, row } = cube.tile;
      const site = {
        id: this.#tileKey(col, row), col, row,
        x: cube.position.x, y: mapData.heightmap[row][col] + GRASS_SURFACE_LIFT,
        z: cube.position.z, contents: cube.buriedTreasure.contents,
      };
      this.#createChest(site);
      this.#buriedChests.set(site.id, site);
    }

    this.#updateHandle = app.on("update", this.#update);
  }

  /**
   * Buried contents and excavations stay within the terrain's camera bounds.
   * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() { return []; }

  get entity() {
    return this.#entity;
  }

  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    this.#islandRoots.setOffsets(near, far);
  }

  set tool(tool) {
    this.#tool = tool;
  }

  /**
   *
   * @param {{hero: import("src/game/objects/ObjectTypes.js").HeroLike, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {(value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void} options.onChange
   * @param {() => void} options.onComplete
   */
  findInteraction({ hero, onChange = null, onComplete = null }) {
    if (!hero || !this.#tool) {
      return null;
    }
    const position = hero.position;
    const facingDirection = hero.facingDirection;
    const chest = this.#findChestTarget(position, facingDirection);
    if (chest) {
      return new TreasureChestInteraction({
        field: this,
        target: chest,
        hero,
        onComplete,
      });
    }
    const unfinishedDig = this.#findSiteTarget(
      position,
      facingDirection,
      ["digging"],
      "dig",
    );
    if (unfinishedDig) {
      return new DigInteraction({
        field: this,
        target: unfinishedDig,
        hero,
        tool: this.#tool,
        onChange,
        onComplete,
      });
    }
    const fillTarget = this.#findSiteTarget(
      position,
      facingDirection,
      ["empty", "vanished", "filling"],
      "fill-hole",
    );
    if (fillTarget) {
      return new FillHoleInteraction({
        field: this,
        target: fillTarget,
        hero,
        tool: this.#tool,
        onChange,
        onComplete,
      });
    }
    const digTarget = this.#findDigTarget(position, facingDirection);
    return digTarget
      ? new DigInteraction({
          field: this,
          target: digTarget,
          hero,
          tool: this.#tool,
          onChange,
          onComplete,
        })
      : null;
  }

  /**
   *
   * @param {string} id
   */
  canDig(id) {
    if (!id) {
      return false;
    }
    const site = this.#sites.find(/**
     *
     * @param {boolean} candidate
     */
    (candidate) => candidate.id === id);
    return site?.state === "digging" || !this.#dugTiles.has(id);
  }

  /**
   *
   * @param {string} id
   */
  canOpen(id) {
    return this.#sites.some(
      /**
       *
       * @param {TreasureSite} site
       */
      (site) => site.id === id && site.state === "closed",
    );
  }

  /**
   *
   * @param {string} id
   */
  canFill(id) {
    return this.#sites.some(
      /**
       *
       * @param {TreasureSite} site
       */
      (site) =>
        site.id === id && ["empty", "vanished", "filling"].includes(site.state),
    );
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} target
   */
  dig(target) {
    if (target?.kind === "blocked-dig") {
      return this.#revealBlockedDig(target);
    }
    if (target?.kind !== "dig") {
      return true;
    }
    const existingSite = this.#sites.find(/**
     *
     * @param {TreasureSite} site
     */
    (site) => site.id === target.id);
    if (existingSite) {
      if (existingSite.state !== "digging") {
        return true;
      }
      existingSite.state = "expanding";
      existingSite.elapsed = 0;
      // Treasure and contents were assigned when this map was loaded.
      return true;
    }
    if (this.#dugTiles.has(target.id)) {
      return true;
    }

    this.#dugTiles.add(target.id);
    const buriedChest = this.#buriedChests.get(target.id);
    const site = {
      id: target.id,
      col: target.col,
      row: target.row,
      x: target.x,
      y: target.y,
      z: target.z,
      state: "digging",
      elapsed: 0,
      hole: null,
      earthPile: null,
      filledPatch: null,
      chest: null,
      chestAnimationLayer: null,
      chestAnimationDuration: 0,
      chestMaterials: [],
      lootSpawned: false,
      hasTreasure: Boolean(buriedChest),
      coinsRemaining: 0,
      fillProgress: 0,
      contents: buriedChest?.contents ?? [],
    };
    if (buriedChest) {
      Object.assign(site, buriedChest);
      this.#buriedChests.delete(target.id);
    }
    this.#createHole(site);

    this.#sites.push(site);
    return false;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} target
   */
  fill(target) {
    const site = this.#sites.find(
      /**
       *
       * @param {boolean} candidate
       */
      (candidate) => candidate.id === target?.id && this.canFill(candidate.id),
    );
    if (!site) {
      return true;
    }
    this.#spawnFillClods(site);
    site.fillProgress = Math.min(1, site.fillProgress + 0.5);
    this.#applyFillProgress(site);
    if (site.fillProgress >= 1) {
      site.hole.enabled = false;
      site.earthPile.enabled = false;
      site.state = "filled";
      this.#onTerrainExcavated?.(site, 0);
      return true;
    }
    site.state = "filling";
    return false;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} target
   */
  open(target) {
    const site = this.#sites.find(
      /**
       *
       * @param {boolean} candidate
       */
      (candidate) =>
        candidate.id === target?.id && candidate.state === "closed",
    );
    if (!site) {
      return false;
    }
    site.state = "opening";
    site.elapsed = 0;
    return true;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   */
  applyHeroPosition(position) {
    this.#heroPosition = { ...position };
  }

  /**
   *
   * @param {{col: number, row: number, category: number}} options
   * @param {number} options.col
   * @param {number} options.row
   * @param {number} options.category
   */
  removeGroundCover({ col, row, category }) {
    const key = this.#tileKey(col, row);
    const remaining = this.#groundCoverTileCounts.get(key) ?? 0;
    if (remaining <= 1) {
      this.#groundCoverTileCounts.delete(key);
    } else {
      this.#groundCoverTileCounts.set(key, remaining - 1);
    }
    if (category === "flower") {
      this.#harvestedFlowerTiles.add(key);
    } else if (category === "mushroom") {
      this.#harvestedMushroomTiles.add(key);
    }
  }

  /**
   *
   * @param {{col: number, row: number, kind: string}} options
   * @param {number} options.col
   * @param {number} options.row
   * @param {string} options.kind
   */
  removeVegetation({ col, row, kind }) {
    const key = this.#tileKey(col, row);
    const remaining = this.#vegetationTileCounts.get(key) ?? 0;
    if (remaining <= 1) {
      this.#vegetationTileCounts.delete(key);
    } else {
      this.#vegetationTileCounts.set(key, remaining - 1);
    }
    if (kind === "tree") {
      this.#felledTreeTiles.add(key);
    }
  }

  /**
   *
   * @param {{object: string, tile: import("src/game/objects/ObjectTypes.js").GridPoint, kind: string}} options
   * @param {string} options.object
   * @param {import("src/game/objects/ObjectTypes.js").GridPoint} options.tile
   * @param {string} options.kind
   */
  removeMapObject({ object, tile, kind }) {
    if (object === "Vegetation") {
      this.removeVegetation({ ...tile, kind });
    }
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  collisionDepthAt(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    let depth = 0;
    for (const site of this.#sites) {
      if (this.#holeBlocks(site) && Math.abs(site.y - elevation) <= 0.85) {
        depth = Math.max(
          depth,
          HOLE_COLLISION_RADIUS + radius - Math.hypot(x - site.x, z - site.z),
        );
      }
      if (!this.#chestBlocks(site)) {
        continue;
      }
      if (site.y + 0.58 <= elevation + stepClearance) {
        continue;
      }
      depth = Math.max(
        depth,
        CHEST_COLLISION_RADIUS + radius - Math.hypot(x - site.x, z - site.z),
      );
    }
    return Math.max(0, depth);
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   */
  movementRefusalAt(x, z, radius = 0, elevation = -Infinity) {
    const blocksHole = this.#sites.some(
      /**
       *
       * @param {TreasureSite} site
       */
      (site) =>
        this.#holeBlocks(site) &&
        Math.abs(site.y - elevation) <= 0.85 &&
        Math.hypot(x - site.x, z - site.z) < HOLE_COLLISION_RADIUS + radius,
    );
    return blocksHole ? MOVEMENT_REFUSAL.HOLE : null;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    for (const site of [...this.#sites, ...this.#buriedChests.values()]) {
      for (const material of site.chestMaterials) {
        material.destroy();
      }
    }
    this.#entity?.destroy();
    this.#entity = null;
    this.#sites = [];
    this.#buriedChests.clear();
    this.#coins = [];
    this.#fillClods = [];
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#soilMaterial?.destroy();
    this.#materials.clear();
    this.#soilMaterial = null;
    this.#pc = null;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} facingDirection
   */
  #findChestTarget(position, facingDirection) {
    let nearest = null;
    for (const site of this.#sites) {
      if (site.state !== "closed") {
        continue;
      }
      const distance = Math.hypot(site.x - position.x, site.z - position.z);
      if (distance > INTERACTION_REACH || distance <= 0.001) {
        continue;
      }
      const facingDot =
        ((site.x - position.x) * facingDirection.x +
          (site.z - position.z) * facingDirection.z) /
        distance;
      if (
        facingDot < MINIMUM_FACING_DOT ||
        (nearest && distance >= nearest.distance)
      ) {
        continue;
      }
      nearest = { site, distance };
    }
    if (!nearest) {
      return null;
    }
    return {
      id: nearest.site.id,
      kind: "treasure-chest",
      x: nearest.site.x,
      y: nearest.site.y,
      z: nearest.site.z,
    };
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} facingDirection
   * @param {string} states
   * @param {string} kind
   */
  #findSiteTarget(position, facingDirection, states, kind) {
    let nearest = null;
    for (const site of this.#sites) {
      if (!states.includes(site.state)) {
        continue;
      }
      const distance = Math.hypot(site.x - position.x, site.z - position.z);
      if (distance > INTERACTION_REACH || distance <= 0.001) {
        continue;
      }
      const facingDot =
        ((site.x - position.x) * facingDirection.x +
          (site.z - position.z) * facingDirection.z) /
        distance;
      if (
        facingDot < MINIMUM_FACING_DOT ||
        (nearest && distance >= nearest.distance)
      ) {
        continue;
      }
      nearest = { site, distance };
    }
    return nearest
      ? {
          id: nearest.site.id,
          kind,
          col: nearest.site.col,
          row: nearest.site.row,
          x: nearest.site.x,
          y: nearest.site.y,
          z: nearest.site.z,
        }
      : null;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} facingDirection
   */
  #findDigTarget(position, facingDirection) {
    const centerCol = position.x + (this.#mapData.cols - 1) / 2;
    const centerRow = position.z + (this.#mapData.rows - 1) / 2;
    const originCol = Math.round(centerCol);
    const originRow = Math.round(centerRow);
    const candidates = [
      { col: originCol + 1, row: originRow },
      { col: originCol - 1, row: originRow },
      { col: originCol, row: originRow + 1 },
      { col: originCol, row: originRow - 1 },
    ];
    let nearest = null;
    for (const candidate of candidates) {
      if (!this.#isDiggable(candidate.col, candidate.row)) {
        continue;
      }
      const key = this.#tileKey(candidate.col, candidate.row);
      const sourceCover = this.#riverSourceCovers.get(key);
      const x = sourceCover?.x ?? candidate.col - (this.#mapData.cols - 1) / 2;
      const z = sourceCover?.z ?? candidate.row - (this.#mapData.rows - 1) / 2;
      const distance = Math.hypot(x - position.x, z - position.z);
      if (distance > INTERACTION_REACH || distance <= 0.001) {
        continue;
      }
      const facingDot =
        ((x - position.x) * facingDirection.x +
          (z - position.z) * facingDirection.z) /
        distance;
      const y =
        sourceCover?.y ??
        this.#mapData.heightmap[candidate.row][candidate.col] +
          GRASS_SURFACE_LIFT;
      if (
        facingDot < MINIMUM_FACING_DOT ||
        Math.abs(position.y - y) > 0.6 ||
        (nearest && distance >= nearest.distance)
      ) {
        continue;
      }
      nearest = { ...candidate, x, y, z, distance };
    }
    if (!nearest) {
      return null;
    }
    return {
      id: this.#tileKey(nearest.col, nearest.row),
      kind: this.#riverSourceCovers.has(this.#tileKey(nearest.col, nearest.row))
        ? "blocked-dig"
        : "dig",
      col: nearest.col,
      row: nearest.row,
      x: nearest.x,
      y: nearest.y,
      z: nearest.z,
    };
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   */
  #isDiggable(col, row) {
    if (
      row < 0 ||
      row >= this.#mapData.rows ||
      col < 0 ||
      col >= this.#mapData.cols
    ) {
      return false;
    }
    const key = this.#tileKey(col, row);
    if (this.#riverSourceCovers.has(key)) {
      return !this.#dugTiles.has(key);
    }
    const unfinished = this.#sites.some(
      /**
       * @param {TreasureSite} site
       */
      (site) => site.id === key && site.state === "digging",
    );
    return (
      this.#mapData.grid[row][col] === TileType.GRASS &&
      (this.#mapData.tileMeta?.[row]?.[col]?.shape ?? "FLAT") === "FLAT" &&
      Number.isFinite(this.#mapData.heightmap[row][col]) &&
      (unfinished || !this.#dugTiles.has(key)) &&
      !this.#vegetationTileCounts.has(key) &&
      !this.#groundCoverTileCounts.has(key) &&
      !this.#stoneTiles.has(key)
    );
  }

  #registerRiverSourceCovers() {
    for (const river of this.#mapData.riverData ?? []) {
      const source = river.cells[0];
      if (!source) {
        continue;
      }
      this.#riverSourceCovers.set(this.#tileKey(source.col, source.row), {
        x: source.col - (this.#mapData.cols - 1) / 2,
        y: source.terrainHeight + GRASS_SURFACE_LIFT,
        z: source.row - (this.#mapData.rows - 1) / 2,
      });
    }
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} target
   */
  #revealBlockedDig(target) {
    if (this.#dugTiles.has(target.id)) {
      return true;
    }
    this.#dugTiles.add(target.id);
    const site = {
      id: target.id,
      col: target.col,
      row: target.row,
      x: target.x,
      y: target.y,
      z: target.z,
      state: "blocked",
      elapsed: 0,
      hole: this.#modelLibrary.instantiate(holeModelUrl),
      earthPile: null,
      filledPatch: null,
      chest: null,
      chestAnimationLayer: null,
      chestAnimationDuration: 0,
      chestMaterials: [],
      rocks: [],
    };
    site.hole.name = `Rock-blocked shallow hole ${site.id}`;
    this.#onTerrainExcavated?.(site, 0.3);
    site.hole.setLocalScale(
      BLOCKED_DIG_HOLE_SCALE,
      BLOCKED_DIG_HOLE_SCALE,
      BLOCKED_DIG_HOLE_SCALE,
    );
    site.hole.setLocalPosition(site.x, site.y + 0.008, site.z);
    this.#islandRoots.addChild(site.hole, site);
    for (const definition of BLOCKED_DIG_ROCKS) {
      const rock = this.#modelLibrary.instantiate(definition.modelUrl);
      rock.name = `Embedded source rock ${site.id}`;
      rock.setLocalPosition(
        site.x + definition.offsetX,
        site.y - definition.burialDepth,
        site.z + definition.offsetZ,
      );
      rock.setLocalEulerAngles(0, definition.rotation, 0);
      rock.setLocalScale(
        definition.scale,
        definition.scale * 0.72,
        definition.scale,
      );
      this.#islandRoots.addChild(rock, site);
      site.rocks.push(rock);
    }
    this.#sites.push(site);
    this.#onInteractionChange?.();
    return true;
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #createHole(site) {
    site.hole = this.#modelLibrary.instantiate(holeModelUrl);
    site.hole.name = `Excavated treasure hole ${site.id}`;
    site.hole.setLocalScale(
      HOLE_INITIAL_SCALE,
      HOLE_INITIAL_SCALE,
      HOLE_INITIAL_SCALE,
    );
    site.hole.setLocalPosition(site.x, site.y + 0.008, site.z);
    this.#islandRoots.addChild(site.hole, site);
    site.earthPile = this.#modelLibrary.instantiate(earthModelUrl);
    site.earthPile.name = `Excavated earth pile ${site.id}`;
    site.earthPile.setLocalPosition(
      site.x + 0.42,
      site.y + 0.012,
      site.z + 0.3,
    );
    this.#islandRoots.addChild(site.earthPile, site);
    site.filledPatch = this.#modelLibrary.instantiate(filledEarthModelUrl);
    site.filledPatch.name = `Filled earth patch ${site.id}`;
    site.filledPatch.setLocalPosition(site.x, site.y + 0.014, site.z);
    site.filledPatch.enabled = false;
    this.#islandRoots.addChild(site.filledPatch, site);
    this.#setExcavationScale(site, HOLE_INITIAL_SCALE);
  }

  /**
   *
   * @param {TreasureSite} site
   * @param {number} scale
   */
  #setExcavationScale(site, scale) {
    site.hole.setLocalScale(scale, scale, scale);
    site.earthPile.setLocalScale(scale, scale, scale);
    this.#onTerrainExcavated?.(site, 0.31 * scale);
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #applyFillProgress(site) {
    const remaining = 1 - site.fillProgress;
    const holeScale = HOLE_INITIAL_SCALE + (1 - HOLE_INITIAL_SCALE) * remaining;
    const pileScale = Math.max(0.12, remaining);
    const patchScale = 0.45 + site.fillProgress * 0.55;
    site.hole.setLocalScale(holeScale, holeScale, holeScale);
    site.earthPile.setLocalScale(pileScale, pileScale, pileScale);
    site.filledPatch.enabled = true;
    site.filledPatch.setLocalScale(patchScale, patchScale, patchScale);
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #spawnFillClods(site) {
    for (let index = 0; index < FILL_CLOD_COUNT; index += 1) {
      const entity = new this.#pc.Entity(
        `Filling soil clod ${site.id}:${index}`,
      );
      entity.addComponent("render", {
        type: "sphere",
        material: this.#soilMaterial,
        castShadows: true,
        receiveShadows: false,
      });
      const start = {
        x: site.x + 0.42 + (Math.random() - 0.5) * 0.22,
        y: site.y + 0.15 + Math.random() * 0.1,
        z: site.z + 0.3 + (Math.random() - 0.5) * 0.18,
      };
      const end = {
        x: site.x + (Math.random() - 0.5) * 0.3,
        y: site.y + 0.035,
        z: site.z + (Math.random() - 0.5) * 0.24,
      };
      const scale = 0.045 + Math.random() * 0.035;
      entity.setLocalPosition(start.x, start.y, start.z);
      entity.setLocalScale(scale, scale * 0.72, scale);
      this.#islandRoots.addChild(entity, site);
      this.#fillClods.push({
        entity,
        start,
        end,
        control: {
          x: (start.x + end.x) / 2,
          y: site.y + 0.46 + Math.random() * 0.2,
          z: (start.z + end.z) / 2,
        },
        delay: index * FILL_CLOD_STAGGER,
        elapsed: 0,
        scale,
      });
    }
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #createChest(site) {
    site.chest = this.#modelLibrary.instantiate(chestModelUrl);
    site.chest.name = `Buried treasure chest ${site.id}`;
    site.chest.setLocalScale(0.72, 0.72, 0.72);
    site.chest.setLocalPosition(site.x, site.y - 0.58, site.z);
    const openTrack = this.#modelLibrary
      .getAnimationTracks(chestModelUrl, [TREASURE_CHEST_ANIMATION.OPEN])
      .get(TREASURE_CHEST_ANIMATION.OPEN);
    site.chest.addComponent("anim", { activate: true });
    site.chest.anim.addAnimationState(
      TREASURE_CHEST_ANIMATION.OPEN,
      openTrack,
      1,
      false,
    );
    site.chest.anim.baseLayer.play(TREASURE_CHEST_ANIMATION.OPEN);
    site.chest.anim.speed = 0;
    site.chestAnimationLayer = site.chest.anim.baseLayer;
    site.chestAnimationDuration = openTrack.duration;
    site.chestAnimationLayer.activeStateCurrentTime = 0;
    this.#createChestMaterialCopies(site);
    this.#islandRoots.addChild(site.chest, site);
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #createChestMaterialCopies(site) {
    const copies = new Map();
    for (const render of site.chest.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        const source = meshInstance.material;
        if (!copies.has(source)) {
          const copy = source.clone();
          copy.name = `${source.name} fade copy`;
          copies.set(source, copy);
        }
        meshInstance.material = copies.get(source);
      }
    }
    site.chestMaterials = [...copies.values()];
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #spawnCoins(site) {
    const amount = site.contents.length;
    site.coinsRemaining = amount;
    for (let index = 0; index < amount; index += 1) {
      const type = site.contents[index];
      const angle = (index / amount) * Math.PI * 2 + Math.random() * 0.45;
      const coinEntity = this.#modelLibrary.instantiate(coinModelUrl);
      coinEntity.name = `${type} treasure coin`;
      coinEntity.setLocalScale(0.68, 0.68, 0.68);
      coinEntity.setLocalEulerAngles(90, 0, 0);
      const position = {
        x: site.x,
        y: site.y + 0.48,
        z: site.z,
      };
      const skyRadius = 0.14 + (index % 4) * 0.055;
      coinEntity.setLocalPosition(position.x, position.y, position.z);
      this.#applyCoinMaterial(coinEntity, type);
      this.#entity.addChild(coinEntity);
      this.#coins.push({
        entity: coinEntity,
        site,
        type,
        state: "skyborne",
        position,
        skyStart: { ...position },
        skyControlA: {
          x: site.x + Math.cos(angle) * 0.12,
          y: site.y + 1.45 + Math.random() * 0.25,
          z: site.z + Math.sin(angle) * 0.12,
        },
        skyOffset: {
          x: Math.cos(angle) * skyRadius,
          y: COIN_SKY_HEIGHT + (index % 3) * 0.08,
          z: Math.sin(angle) * skyRadius,
        },
        skyDelay: index * COIN_SKY_STAGGER,
        elapsed: 0,
        collectStart: null,
        collectControlA: null,
        collectControlBOffset: null,
        flightSide: (index % 2 === 0 ? 1 : -1) * (0.16 + (index % 3) * 0.05),
        rotation: Math.random() * 360,
      });
    }
  }

  /**
   *
   * @param {import("playcanvas").Entity} entity
   * @param {string} type
   */
  #applyCoinMaterial(entity, type) {
    const material = this.#materials.get(type);
    for (const render of entity.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        meshInstance.material = material;
      }
    }
  }

  #createMaterials() {
    this.#soilMaterial = this.#createMaterial("Flying fill soil", 0x6f3214, 0);
    for (const [type, definition] of COIN_DEFINITIONS) {
      const material = this.#createMaterial(
        `${type} treasure coin`,
        definition.color,
        0.82,
      );
      this.#materials.set(type, material);
    }
  }

  /**
   *
   * @param {string} name
   * @param {import("playcanvas").Color|number} color
   * @param {number} metalness
   */
  #createMaterial(name, color, metalness) {
    const material = new this.#pc.StandardMaterial();
    material.name = name;
    material.diffuse = colorFromHex(this.#pc, color);
    material.metalness = metalness;
    material.useMetalness = true;
    material.gloss = metalness > 0.5 ? 0.7 : 0.05;
    material.update();
    return material;
  }

  /**
   *
   * @param {number} deltaTime
    * @type {(deltaTime: number) => void}
   */
  #update = (deltaTime) => {
    const frameTime = Math.min(0.1, Math.max(0, deltaTime));
    for (const site of this.#sites) {
      this.#advanceSite(site, frameTime);
    }
    for (let index = this.#coins.length - 1; index >= 0; index -= 1) {
      if (this.#advanceCoin(this.#coins[index], frameTime)) {
        this.#coins.splice(index, 1);
      }
    }
    for (let index = this.#fillClods.length - 1; index >= 0; index -= 1) {
      if (this.#advanceFillClod(this.#fillClods[index], frameTime)) {
        this.#fillClods.splice(index, 1);
      }
    }
  };

  /**
   *
   * @param {number} clod
   * @param {number} deltaTime
   */
  #advanceFillClod(clod, deltaTime) {
    clod.elapsed += deltaTime;
    if (clod.elapsed < clod.delay) {
      return false;
    }
    const progress = Math.min(
      1,
      (clod.elapsed - clod.delay) / FILL_CLOD_DURATION,
    );
    const remaining = 1 - progress;
    const position = {
      x:
        clod.start.x * remaining ** 2 +
        clod.control.x * 2 * remaining * progress +
        clod.end.x * progress ** 2,
      y:
        clod.start.y * remaining ** 2 +
        clod.control.y * 2 * remaining * progress +
        clod.end.y * progress ** 2,
      z:
        clod.start.z * remaining ** 2 +
        clod.control.z * 2 * remaining * progress +
        clod.end.z * progress ** 2,
    };
    clod.entity.setLocalPosition(position.x, position.y, position.z);
    const scale = clod.scale * (1 - progress * 0.35);
    clod.entity.setLocalScale(scale, scale * 0.72, scale);
    clod.entity.setLocalEulerAngles(
      progress * 360,
      progress * 540,
      progress * 180,
    );
    if (progress < 1) {
      return false;
    }
    clod.entity.destroy();
    return true;
  }

  /**
   *
   * @param {TreasureSite} site
   * @param {number} deltaTime
   */
  #advanceSite(site, deltaTime) {
    if (site.state === "vanishing") {
      this.#advanceChestVanish(site, deltaTime);
      return;
    }
    if (site.state === "expanding") {
      site.elapsed = Math.min(HOLE_EXPAND_DURATION, site.elapsed + deltaTime);
      const progress = site.elapsed / HOLE_EXPAND_DURATION;
      const eased = progress * progress * (3 - 2 * progress);
      const scale = HOLE_INITIAL_SCALE + (1 - HOLE_INITIAL_SCALE) * eased;
      this.#setExcavationScale(site, scale);
      if (progress >= 1) {
        site.elapsed = 0;
        if (site.hasTreasure) {
          // The chest is already embedded beneath the turf.
          site.state = "emerging";
        } else {
          site.state = "empty";
        }
        this.#onInteractionChange?.();
      }
      return;
    }
    if (site.state === "emerging") {
      site.elapsed = Math.min(CHEST_EMERGE_DURATION, site.elapsed + deltaTime);
      const progress = site.elapsed / CHEST_EMERGE_DURATION;
      const eased = 1 - (1 - progress) ** 3;
      site.chest.setLocalPosition(site.x, site.y - 0.58 + eased * 0.18, site.z);
      if (progress >= 1) {
        site.state = "closed";
        site.elapsed = 0;
        this.#onInteractionChange?.();
      }
      return;
    }
    if (site.state !== "opening") {
      return;
    }
    site.elapsed = Math.min(CHEST_OPEN_DURATION, site.elapsed + deltaTime);
    const progress = site.elapsed / CHEST_OPEN_DURATION;
    const eased = progress * progress * (3 - 2 * progress);
    site.chestAnimationLayer.activeStateCurrentTime =
      site.chestAnimationDuration * eased;
    if (!site.lootSpawned && progress >= 0.38) {
      site.lootSpawned = true;
      this.#spawnCoins(site);
    }
    if (progress >= 1) {
      site.state = "opened";
    }
  }

  /**
   *
   * @param {number} coin
   * @param {number} deltaTime
   */
  #advanceCoin(coin, deltaTime) {
    coin.elapsed += deltaTime;
    coin.rotation += deltaTime * 720;
    if (coin.state === "skyborne") {
      const flightElapsed = coin.elapsed - coin.skyDelay;
      if (flightElapsed >= 0) {
        const progress = Math.min(1, flightElapsed / COIN_SKY_FLIGHT_DURATION);
        const flightProgress = 1 - (1 - progress) ** 3;
        const heroPosition = this.#heroPosition ?? coin.skyStart;
        const target = {
          x: heroPosition.x + coin.skyOffset.x,
          y: heroPosition.y + coin.skyOffset.y,
          z: heroPosition.z + coin.skyOffset.z,
        };
        const controlB = {
          x: target.x + coin.skyOffset.x * 0.35,
          y: target.y + 0.32,
          z: target.z + coin.skyOffset.z * 0.35,
        };
        coin.position = this.#cubicBezier(
          coin.skyStart,
          coin.skyControlA,
          controlB,
          target,
          flightProgress,
        );
        if (progress >= 1) {
          this.#beginCoinCollection(coin);
        }
      }
    } else if (coin.state === "collecting") {
      const progress = Math.min(1, coin.elapsed / COIN_COLLECTION_DURATION);
      const flightProgress = progress * progress * (3 - 2 * progress);
      const targetPosition = this.#heroPosition ?? coin.collectStart;
      const target = {
        x: targetPosition.x,
        y: targetPosition.y + 1.05,
        z: targetPosition.z,
      };
      const controlB = {
        x: target.x + coin.collectControlBOffset.x,
        y: target.y + coin.collectControlBOffset.y,
        z: target.z + coin.collectControlBOffset.z,
      };
      coin.position = this.#cubicBezier(
        coin.collectStart,
        coin.collectControlA,
        controlB,
        target,
        flightProgress,
      );
      const scale = 0.68 * (1 - progress * 0.22);
      coin.entity.setLocalScale(scale, scale, scale);
      if (progress >= 1) {
        coin.state = "arrived";
        coin.elapsed = 0;
      }
    } else if (coin.state === "arrived") {
      coin.site.coinsRemaining = Math.max(0, coin.site.coinsRemaining - 1);
      this.#onCollectCoin?.(coin.type, 1);
      coin.entity.destroy();
      if (coin.site.coinsRemaining === 0) {
        this.#beginChestVanish(coin.site);
      }
      return true;
    }
    coin.entity.setLocalPosition(
      coin.position.x,
      coin.position.y,
      coin.position.z,
    );
    coin.entity.setLocalEulerAngles(90, coin.rotation, coin.rotation * 0.35);
    return false;
  }

  /**
   *
   * @param {number} coin
   */
  #beginCoinCollection(coin) {
    if (!this.#heroPosition || coin.state !== "skyborne") {
      return;
    }
    coin.state = "collecting";
    coin.elapsed = 0;
    coin.collectStart = { ...coin.position };
    const targetX = this.#heroPosition.x - coin.position.x;
    const targetZ = this.#heroPosition.z - coin.position.z;
    const distance = Math.max(0.001, Math.hypot(targetX, targetZ));
    const perpendicularX = -targetZ / distance;
    const perpendicularZ = targetX / distance;
    coin.collectControlA = {
      x: coin.position.x + coin.skyOffset.x * 0.2,
      y: coin.position.y + 0.28,
      z: coin.position.z + coin.skyOffset.z * 0.2,
    };
    coin.collectControlBOffset = {
      x: perpendicularX * coin.flightSide,
      y: 0.68 + Math.abs(coin.flightSide) * 0.5,
      z: perpendicularZ * coin.flightSide,
    };
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").Point3} start
   * @param {number} controlA
   * @param {number} controlB
   * @param {import("src/game/objects/ObjectTypes.js").Point3} end
   * @param {number} progress
   */
  #cubicBezier(start, controlA, controlB, end, progress) {
    const remaining = 1 - progress;
    const startWeight = remaining ** 3;
    const controlAWeight = 3 * remaining ** 2 * progress;
    const controlBWeight = 3 * remaining * progress ** 2;
    const endWeight = progress ** 3;
    return {
      x:
        start.x * startWeight +
        controlA.x * controlAWeight +
        controlB.x * controlBWeight +
        end.x * endWeight,
      y:
        start.y * startWeight +
        controlA.y * controlAWeight +
        controlB.y * controlBWeight +
        end.y * endWeight,
      z:
        start.z * startWeight +
        controlA.z * controlAWeight +
        controlB.z * controlBWeight +
        end.z * endWeight,
    };
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #chestBlocks(site) {
    return ["emerging", "closed", "opening", "opened", "vanishing"].includes(
      site.state,
    );
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #holeBlocks(site) {
    return (
      site.hole?.enabled && site.state !== "filled" && site.state !== "blocked"
    );
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #beginChestVanish(site) {
    if (
      !site.chest ||
      site.state === "vanishing" ||
      site.state === "vanished"
    ) {
      return;
    }
    site.state = "vanishing";
    site.elapsed = 0;
    for (const material of site.chestMaterials) {
      material.opacity = 1;
      material.blendType = this.#pc.BLEND_NORMAL;
      material.update();
    }
  }

  /**
   *
   * @param {TreasureSite} site
   * @param {number} deltaTime
   */
  #advanceChestVanish(site, deltaTime) {
    site.elapsed = Math.min(CHEST_FADE_DURATION, site.elapsed + deltaTime);
    const progress = site.elapsed / CHEST_FADE_DURATION;
    const eased = progress * progress * (3 - 2 * progress);
    for (const material of site.chestMaterials) {
      material.opacity = 1 - eased;
      material.update();
    }
    if (progress < 1) {
      return;
    }
    site.chest.enabled = false;
    site.chestAnimationLayer = null;
    site.state = "vanished";
    this.#onInteractionChange?.();
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   */
  #tileKey(col, row) {
    return `${row}:${col}`;
  }
}
