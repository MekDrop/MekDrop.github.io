import { TREASURE_DIG_STROKES, TREASURE_FILL_SCOOPS, TREASURE_FILL_STROKES, TREASURE_TOOL_MAX_TURN, TREASURE_TOOL_MIN_DISTANCE, treasureToolBackstep } from "../../config/treasure.js";
import { TileType } from "../../generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { COIN_TYPE } from "../../enum/CoinType.js";
import { MOVEMENT_REFUSAL } from "../../enum/MovementRefusal.js";
import { TREASURE_CHEST_ANIMATION } from "../../enum/TreasureChestAnimation.js";
import { TREASURE_HOLE_ANIMATION } from "../../enum/TreasureHoleAnimation.js";
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
 * @property {number} digStrokes
 * @property {number} fillProgress
 * @property {number} [fillStrokes]
 * @property {number} [fillStartProgress]
 * @property {number} [fillTargetProgress]
 * @property {number} [fillElapsed]
 * @property {number} [fillRemovedProgress]
 * @property {boolean} [leveling]
 * @property {number} [rimElapsed]
 * @property {number} [rimAnimationDuration]
 * @property {import("playcanvas").AnimComponentLayer} [rimAnimationLayer]
 * @property {import("playcanvas").Vec2|null} pileOffset
 * @property {number} [facingYaw]
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


const MINIMUM_FACING_DOT = Math.cos((50 * Math.PI) / 180);
const MINIMUM_TOOL_FACING_DOT = Math.cos(TREASURE_TOOL_MAX_TURN * Math.PI / 180);
const INTERACTION_REACH = 1.18;
const HOLE_INITIAL_SCALE = 0.42;
const BLOCKED_DIG_HOLE_SCALE = 0.36;
const HOLE_EXPAND_DURATION = 0.36;
const CHEST_EMERGE_DURATION = 0.72;
const CHEST_BURIAL_DEPTH = 0.58;
// Cover the cavity's uneven upper edge (up to 0.324 m), beneath the soil rim.
const HOLE_SURFACE_CUT_RADIUS = 0.335;
const CHEST_OPEN_DURATION = 0.62;
const CHEST_FADE_DURATION = 0.82;
const CHEST_COLLISION_RADIUS = 0.3;
const HOLE_COLLISION_RADIUS = 0.3;
const COIN_COLLECTION_DURATION = 0.68;
const COIN_SKY_FLIGHT_DURATION = 0.72;
const COIN_SKY_STAGGER = 0.035;
const COIN_SKY_HEIGHT = 1.75;
const FILL_SETTLE_DELAY = 0.12;
const FILL_SETTLE_DURATION = 0.24;
const RIM_LEVEL_DURATION = 2;
const COIN_DEFINITIONS = new Map([
  [COIN_TYPE.GOLD, {
    color: 0xffc84a,
    weight: 12,
  }],
  [COIN_TYPE.SILVER, {
    color: 0xd8e2ea,
    weight: 30,
  }],
  [COIN_TYPE.COPPER, {
    color: 0xd7793d,
    weight: 58,
  }],
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
   * @type {import("../characters/hero/tools/HeroTool.js").HeroTool|null}
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
   * @type {Map}
   */
  #materials = new Map();
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
    for (const {
      tile: { col, row },
    } of (mapData.objects ?? []).filter(BuriedTreasureField.#filter)) {
      const key = this.#tileKey(col, row);
      this.#vegetationTileCounts.set(
        key,
        (this.#vegetationTileCounts.get(key) ?? 0) + 1,
      );
    }
    for (const {
      tile: { col, row },
    } of (mapData.objects ?? []).filter(BuriedTreasureField.#filter2)) {
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
        id: this.#tileKey(col, row),
        col,
        row,
        x: cube.position.x,
        y: mapData.heightmap[row][col] + GRASS_SURFACE_LIFT,
        z: cube.position.z,
        contents: cube.buriedTreasure.contents,
      };
      this.#createChest(site);
      // Buried models must leave the render and animation systems until exposed.
      site.chest.enabled = false;
      this.#buriedChests.set(site.id, site);
    }

    this.#updateHandle = app.on("update", this.#update);
  }

  /**
   * Buried contents and excavations stay within the terrain's camera bounds.
   * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() {
    return [];
  }

  get entity() {
    return this.#entity;
  }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandRoots.setOffsets(near, far, offsets);
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
   * @param {{x: number, z: number}|null} [facing]
   */
  dig(target, facing = null) {
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
      if (facing) {
        existingSite.hole.setLocalEulerAngles(0, Math.atan2(facing.x, facing.z) * 180 / Math.PI, 0);
        existingSite.pileOffset = this.#supportedPileOffset(existingSite, facing.x, facing.z);
        existingSite.earthPile.enabled = existingSite.pileOffset !== null;
        existingSite.earthPile.setLocalPosition(
          existingSite.x + (existingSite.pileOffset?.x ?? 0),
          existingSite.y + 0.012,
          existingSite.z + (existingSite.pileOffset?.y ?? 0),
        );
      }
      existingSite.digStrokes += 1;
      if (existingSite.digStrokes < TREASURE_DIG_STROKES) {
        const progress = (existingSite.digStrokes - 1) / (TREASURE_DIG_STROKES - 1);
        this.#setExcavationScale(existingSite, HOLE_INITIAL_SCALE + (1 - HOLE_INITIAL_SCALE) * progress);

        return false;
      }
      existingSite.expansionStartScale = existingSite.hole.getLocalScale().x;
      existingSite.state = "expanding";
      existingSite.elapsed = 0;

      // Treasure and contents were assigned when this map was loaded.
      return true;
    }
    if (this.#dugTiles.has(target.id)) {
      return true;
    }

    const buriedChest = this.#buriedChests.get(target.id);
    const forwardX = facing?.x ?? 0;
    const forwardZ = facing?.z ?? 1;
    const site = {
      id: target.id,
      col: target.col,
      row: target.row,
      x: target.x,
      y: target.y,
      z: target.z,
      state: "digging",
      digStrokes: 1,
      pileOffset: this.#supportedPileOffset(target, forwardX, forwardZ),
      facingYaw: Math.atan2(forwardX, forwardZ) * 180 / Math.PI,
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
    this.#dugTiles.add(target.id);
    if (buriedChest) {
      Object.assign(site, buriedChest, {
        x: target.x,
        y: target.y,
        z: target.z,
      });
      site.chest.setLocalPosition(site.x, site.y - CHEST_BURIAL_DEPTH, site.z);
      site.chest.enabled = true;
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
    if ((site.fillTargetProgress ?? 0) > site.fillProgress) {
      return site.fillTargetProgress >= 1;
    }
    site.fillStartProgress = site.fillProgress;
    site.fillStrokes = Math.min(TREASURE_FILL_STROKES, (site.fillStrokes ?? 0) + 1);
    site.fillTargetProgress = site.fillStrokes / TREASURE_FILL_STROKES;
    site.fillElapsed = 0;
    site.state = "filling";

    return site.fillTargetProgress >= 1;
  }

  /**
   * Remove soil only while the blade is inside the source mound.
   * @param {Point3 & {id: string}} target
   */
  scoopFillSoil(target) {
    const site = this.#sites.find(/**
     *
     * @param {TreasureSite} candidate
     */
      (candidate) => candidate.id === target.id);
    if (!site || !this.canFill(target.id)) {
      return;
    }
    site.fillRemovedProgress = Math.min(1, ((site.fillStrokes ?? 0) + 1) / TREASURE_FILL_SCOOPS);
    this.#applyPileProgress(site);
  }

  /**
   * Restore a carried scoop when filling is interrupted before release.
   * @param {Point3 & {id: string}} target
   */
  returnFillSoil(target) {
    const site = this.#sites.find(/**
     *
     * @param {TreasureSite} candidate
     */
      (candidate) => candidate.id === target.id);
    if (!site) {
      return;
    }
    site.fillRemovedProgress = Math.min(1, (site.fillStrokes ?? 0) / TREASURE_FILL_SCOOPS);
    site.leveling = false;
    this.#applyPileProgress(site);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isFillRimStage(id) {
    return this.#sites.some(/**
     * @param {TreasureSite} site
     */
      (site) => site.id === id && site.fillStrokes === TREASURE_FILL_SCOOPS);
  }

  /**
   * Play the authored rim collapse while the blade pushes soil inward.
   * @param {Point3 & {id: string}} target
   */
  levelFillRim(target) {
    const site = this.#sites.find(/**
     * @param {TreasureSite} candidate
     */
      (candidate) => candidate.id === target.id);
    if (!site || !this.isFillRimStage(target.id)) {
      return;
    }
    if (!site.rimAnimationLayer) {
      const track = this.#modelLibrary.getAnimationTracks(holeModelUrl, [TREASURE_HOLE_ANIMATION.LEVEL])
        .get(TREASURE_HOLE_ANIMATION.LEVEL);
      site.hole.addComponent("anim", { activate: true });
      site.hole.anim.addAnimationState(TREASURE_HOLE_ANIMATION.LEVEL, track, 1, false);
      site.hole.anim.baseLayer.play(TREASURE_HOLE_ANIMATION.LEVEL);
      site.hole.anim.speed = 0;
      site.rimAnimationLayer = site.hole.anim.baseLayer;
      site.rimAnimationDuration = track.duration;
      site.rimElapsed = 0;
      site.rimAnimationLayer.activeStateCurrentTime = 0;
      site.hole.anim.update(0);
    }
    site.leveling = true;
  }

  /**
   * @param {TreasureSite} site
   * @param {number} deltaTime
   */
  #advanceRimLeveling(site, deltaTime) {
    if (!site.leveling) {
      return;
    }
    site.rimElapsed = Math.min(RIM_LEVEL_DURATION, site.rimElapsed + deltaTime);
    const progress = site.rimElapsed / RIM_LEVEL_DURATION;
    site.rimAnimationLayer.activeStateCurrentTime = progress * site.rimAnimationDuration;
    site.hole.anim.update(0);
    if (site.fillStrokes === TREASURE_FILL_SCOOPS) {
      // Soil arrives during blade contact, and holds while the shovel lifts
      // and reaches for the next edge. Match the authored rim's three scrapes.
      let transferred = 0;
      for (const [start, end] of [[0, 0.34], [0.82, 1.2], [1.66, 2]]) {
        const amount = Math.min(1, Math.max(0, (site.rimElapsed - start) / (end - start)));
        transferred += amount * amount * (3 - 2 * amount) / 3;
      }
      site.fillProgress = (TREASURE_FILL_SCOOPS + 0.88 * transferred) / TREASURE_FILL_STROKES;
      this.#applyFillProgress(site);
    }
    site.leveling = progress < 1;
  }

  /**
   * @param {TreasureSite} site
   */
  #applyPileProgress(site) {
    const remaining = Math.max(0, 1 - site.fillRemovedProgress);
    const scale = Math.cbrt(remaining);
    site.earthPile.setLocalScale(scale, scale, scale);
    site.earthPile.enabled = remaining > 0 && site.pileOffset !== null;
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
      this.removeVegetation({
        ...tile,
        kind,
      });
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
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
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
      if (distance - CHEST_COLLISION_RADIUS > INTERACTION_REACH || distance <= 0.001) {
        continue;
      }
      const facingDot =
        ((site.x - position.x) * facingDirection.x +
          (site.z - position.z) * facingDirection.z) /
        distance;
      if (
        Math.abs(position.y - site.y) > 0.6 ||
        facingDot < MINIMUM_FACING_DOT ||
        (nearest && distance >= nearest.distance)
      ) {
        continue;
      }
      nearest = {
        site,
        distance,
      };
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
      if (distance - HOLE_COLLISION_RADIUS > INTERACTION_REACH || distance <= 0.001) {
        continue;
      }
      const facingDot =
        ((site.x - position.x) * facingDirection.x +
          (site.z - position.z) * facingDirection.z) /
        distance;
      if (
        Math.abs(position.y - site.y) > 0.6 ||
        facingDot < MINIMUM_TOOL_FACING_DOT ||
        (nearest && distance >= nearest.distance)
      ) {
        continue;
      }
      nearest = {
        site,
        distance,
      };
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
    const direction = new this.#pc.Vec2(facingDirection.x, facingDirection.z);
    if (direction.lengthSq() < 0.000001) {
      return null;
    }
    direction.normalize();
    const colOffset = (this.#mapData.cols - 1) / 2;
    const rowOffset = (this.#mapData.rows - 1) / 2;
    const originCol = Math.round(position.x + colOffset);
    const originRow = Math.round(position.z + rowOffset);
    let nearest = null;
    for (let row = originRow - 1; row <= originRow + 1; row += 1) {
      for (let col = originCol - 1; col <= originCol + 1; col += 1) {
        const x = col - colOffset;
        const z = row - rowOffset;
        const dx = x - position.x;
        const dz = z - position.z;
        const distance = Math.hypot(dx, dz);
        if (distance - HOLE_COLLISION_RADIUS > INTERACTION_REACH) {
          continue;
        }
        const facingDot = distance > 0.001 ? (dx * direction.x + dz * direction.y) / distance : 0;
        const backstep = treasureToolBackstep(dx, dz, direction.x, direction.y,
          TREASURE_TOOL_MIN_DISTANCE, TREASURE_TOOL_MAX_TURN);
        const sourceCover = this.#riverSourceCovers.get(this.#tileKey(col, row));
        const y = sourceCover?.y ?? this.#mapData.heightmap[row]?.[col] + GRASS_SURFACE_LIFT;
        if ((facingDot + 0.000001 < MINIMUM_TOOL_FACING_DOT && backstep === null) ||
          !Number.isFinite(y) || Math.abs(position.y - y) > 0.6 ||
          !this.#canExcavateAt(x, y, z) ||
          (nearest && distance >= nearest.distance)) {
          continue;
        }
        nearest = {
          id: this.#tileKey(col, row),
          kind: sourceCover ? "blocked-dig" : "dig",
          col,
          row,
          x,
          y,
          z,
          distance,
        };
      }
    }
    if (!nearest) {
      return null;
    }
    const { distance, ...target } = nearest;

    return target;
  }

  /**
   * Require support for the complete footprint, including adjacent tile fragments.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} [radius]
   * @param {boolean} [forPile] Allow solid surfaces that cannot be excavated.
   * @returns {boolean}
   */
  #canExcavateAt(x, y, z, radius = HOLE_COLLISION_RADIUS + 0.01, forPile = false) {
    const colOffset = (this.#mapData.cols - 1) / 2;
    const rowOffset = (this.#mapData.rows - 1) / 2;
    for (let row = Math.round(z - radius + rowOffset); row <= Math.round(z + radius + rowOffset); row += 1) {
      for (let col = Math.round(x - radius + colOffset); col <= Math.round(x + radius + colOffset); col += 1) {
        const centerX = col - colOffset;
        const centerZ = row - rowOffset;
        const dx = Math.max(0, Math.abs(x - centerX) - 0.5);
        const dz = Math.max(0, Math.abs(z - centerZ) - 0.5);
        if (dx * dx + dz * dz >= radius * radius) {
          continue;
        }
        const cover = this.#riverSourceCovers.get(this.#tileKey(col, row));
        const height = cover?.y ?? this.#mapData.heightmap[row]?.[col] + GRASS_SURFACE_LIFT;
        if (!Number.isFinite(height) || Math.abs(height - y) > 0.05 ||
          !this.#isDiggable(col, row, x, z, forPile)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Keep the complete spoil mound on the same terrace as the excavation.
   * @param {Point3} target
   * @param {number} forwardX
   * @param {number} forwardZ
   * @returns {import("playcanvas").Vec2|null}
   */
  #supportedPileOffset(target, forwardX, forwardZ) {
    const offset = new this.#pc.Vec2(
      forwardZ * 0.42 + forwardX * 0.3,
      -forwardX * 0.42 + forwardZ * 0.3,
    );
    if (this.#canExcavateAt(target.x + offset.x, target.y,
      target.z + offset.y, 0.34, true)) {
      return offset;
    }

    // Keep the same separation from the cavity on the opposite side.
    offset.mulScalar(-1);
    if (this.#canExcavateAt(target.x + offset.x, target.y,
      target.z + offset.y, 0.34, true)) {
      return offset;
    }

    // Neither side supports the mound; do not place it inside the cavity.
    return null;
  }

  /**
   *
   * @param {number} col
   * @param {number} row
   * @param {number} x
   * @param {number} z
   * @param {boolean} [forPile]
   */
  #isDiggable(col, row, x, z, forPile = false) {
    if (
      row < 0 ||
      row >= this.#mapData.rows ||
      col < 0 ||
      col >= this.#mapData.cols
    ) {
      return false;
    }
    const key = this.#tileKey(col, row);
    const metadata = this.#mapData.tileMeta?.[row]?.[col];
    // Test the actual hole footprint against occupied building space.
    /**
     * @param {import("../castle/ground/CastleGroundCuts.js").GroundCut} cut
     */
    const overlapsTerrainCutout = (cut) => {
      const dx = Math.max(cut.minX - x, 0, x - cut.maxX);
      const dz = Math.max(cut.minZ - z, 0, z - cut.maxZ);

      return dx * dx + dz * dz < (HOLE_COLLISION_RADIUS + 0.01) ** 2;
    };
    if (
      metadata?.exposedTerrain === false ||
      metadata?.terrainCutouts?.some(overlapsTerrainCutout)
    ) {
      return false;
    }
    if (this.#riverSourceCovers.has(key)) {
      return !this.#dugTiles.has(key);
    }
    const unfinished = this.#sites.some(
      /**
       * @param {TreasureSite} site
       */
      (site) => site.id === key && site.state === "digging",
    );

    /**
     * @param {TreasureSite} site
     */
    const filledSupport = (site) => site.id === key && site.state === "filled";

    // Spoil can rest on filled excavations and decorative ground cover even
    // though those tiles cannot be selected for another excavation.
    return (
      (this.#mapData.grid[row][col] === TileType.GRASS ||
        (forPile && this.#mapData.grid[row][col] === TileType.PATH) ||
        (metadata?.exposedTerrain === true &&
          [TileType.CASTLE_WALL, TileType.CASTLE_TOWER].includes(this.#mapData.grid[row][col]))) &&
      (this.#mapData.tileMeta?.[row]?.[col]?.shape ?? "FLAT") === "FLAT" &&
      Number.isFinite(this.#mapData.heightmap[row][col]) &&
      (unfinished || !this.#dugTiles.has(key) || (forPile && this.#sites.some(filledSupport))) &&
      !this.#vegetationTileCounts.has(key) &&
      (forPile || !this.#groundCoverTileCounts.has(key)) &&
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
    site.hole.setLocalEulerAngles(0, site.facingYaw ?? 0, 0);
    site.hole.setLocalScale(
      HOLE_INITIAL_SCALE,
      HOLE_INITIAL_SCALE,
      HOLE_INITIAL_SCALE,
    );
    site.hole.setLocalPosition(site.x, site.y + 0.008, site.z);
    this.#islandRoots.addChild(site.hole, site);
    site.earthPile = this.#modelLibrary.instantiate(earthModelUrl);
    site.earthPile.name = `Excavated earth pile ${site.id}`;
    site.earthPile.enabled = site.pileOffset !== null;
    site.earthPile.setLocalPosition(
      site.x + (site.pileOffset?.x ?? 0),
      site.y + 0.012,
      site.z + (site.pileOffset?.y ?? 0),
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
    this.#onTerrainExcavated?.(site, HOLE_SURFACE_CUT_RADIUS * scale);
  }

  /**
   *
   * @param {TreasureSite} site
   */
  #applyFillProgress(site) {
    // The two scoops fill the cavity; the final stroke only levels its rim.
    const soilProgress = Math.min(1, site.fillProgress * TREASURE_FILL_STROKES / TREASURE_FILL_SCOOPS);
    site.filledPatch.enabled = site.fillProgress > 0;
    site.filledPatch.setLocalPosition(site.x, site.y + 0.014 - 0.3 * (1 - soilProgress), site.z);
    site.filledPatch.setLocalScale(1, 1, 1);
    const cavity = site.hole.findByName("Excavated cavity");
    if (cavity) {
      cavity.enabled = soilProgress < 1;
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
    site.chest.setLocalPosition(site.x, site.y - CHEST_BURIAL_DEPTH, site.z);
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
    site.chest.anim.update(0);
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
  };

  /**
   *
   * @param {TreasureSite} site
   * @param {number} deltaTime
   */
  #advanceSite(site, deltaTime) {
    this.#advanceRimLeveling(site, deltaTime);
    if (site.state === "filling" && site.fillProgress < site.fillTargetProgress) {
      site.fillElapsed += deltaTime;
      // The shovel releases Ammo clods over the cavity. Raise the surface
      // after their short fall, independently of the hero dismissing the tool.
      const arrival = Math.min(1, Math.max(0,
        (site.fillElapsed - FILL_SETTLE_DELAY) / FILL_SETTLE_DURATION));
      site.fillProgress = site.fillStartProgress +
        (site.fillTargetProgress - site.fillStartProgress) * arrival;
      this.#applyFillProgress(site);
      if (site.fillProgress >= 1) {
        site.hole.enabled = false;
        site.earthPile.enabled = false;
        site.state = "filled";
        this.#onTerrainExcavated?.(site, 0);
        this.#onInteractionChange?.();
      }
    }
    if (site.chest && this.#heroPosition) {
      const dx = this.#heroPosition.x - site.x;
      const dz = this.#heroPosition.z - site.z;
      if (Math.hypot(dx, dz) > 0.001) {
        // The authored lock faces +Z; keep that side toward the hero.
        site.chest.setLocalEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
      }
    }
    if (site.state === "vanishing") {
      this.#advanceChestVanish(site, deltaTime);

      return;
    }
    if (site.state === "expanding") {
      site.elapsed = Math.min(HOLE_EXPAND_DURATION, site.elapsed + deltaTime);
      const progress = site.elapsed / HOLE_EXPAND_DURATION;
      const eased = progress * progress * (3 - 2 * progress);
      const startScale = site.expansionStartScale ?? HOLE_INITIAL_SCALE;
      const scale = startScale + (1 - startScale) * eased;
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
      site.chest.setLocalPosition(site.x, site.y - CHEST_BURIAL_DEPTH * (1 - eased), site.z);
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
    site.chest.anim.update(0);
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

  /**
   *
   * @param {{object: string}} options
   * @param {string} options.object
   */
  static #filter({ object }) {
    return object === "Vegetation";
  }

  /**
   *
   * @param {{object: string}} options
   * @param {string} options.object
   */
  static #filter2({ object }) {
    return object === "StoneCluster";
  }
}
