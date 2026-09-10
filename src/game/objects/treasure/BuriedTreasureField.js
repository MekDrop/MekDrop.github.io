import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { COIN_TYPE } from "../../enum/CoinType.js";
import { MOVEMENT_REFUSAL } from "../../enum/MovementRefusal.js";
import coinModelUrl from "../../models/treasure/coin.glb?url";
import chestModelUrl from "../../models/treasure/treasure-chest.glb?url";
import earthModelUrl from "../../models/treasure/excavated-earth.glb?url";
import filledEarthModelUrl from "../../models/treasure/filled-earth.glb?url";
import holeModelUrl from "../../models/treasure/hole.glb?url";
import { DigInteraction } from "./DigInteraction.js";
import { FillHoleInteraction } from "./FillHoleInteraction.js";
import { TreasureChestInteraction } from "./TreasureChestInteraction.js";

const TREASURE_CHANCE = 0.6;
const HARVESTED_FLOWER_REWARD_MULTIPLIER = 5;
const HARVESTED_MUSHROOM_REWARD_MULTIPLIER = 0.8;
const FELLED_TREE_TREASURE_CHANCE = 0.02;
const FELLED_TREE_REWARD_MULTIPLIER = 3.5;
const MINIMUM_FACING_DOT = Math.cos((50 * Math.PI) / 180);
const INTERACTION_REACH = 1.18;
const HOLE_INITIAL_SCALE = 0.42;
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

export class BuriedTreasureField {
  static get modelUrls() {
    return [
      chestModelUrl,
      coinModelUrl,
      holeModelUrl,
      earthModelUrl,
      filledEarthModelUrl,
    ];
  }

  #pc;
  #mapData;
  #modelLibrary;
  #entity;
  #tool = null;
  #dugTiles = new Set();
  #vegetationTileCounts = new Map();
  #groundCoverTileCounts = new Map();
  #harvestedFlowerTiles = new Set();
  #harvestedMushroomTiles = new Set();
  #felledTreeTiles = new Set();
  #sites = [];
  #coins = [];
  #fillClods = [];
  #materials = new Map();
  #soilMaterial;
  #heroPosition = null;
  #onCollectCoin;
  #onInteractionChange;
  #updateHandle = null;

  constructor({
    pc,
    app,
    mapData,
    modelLibrary,
    onCollectCoin = null,
    onInteractionChange = null,
  }) {
    this.#pc = pc;
    this.#mapData = mapData;
    this.#modelLibrary = modelLibrary;
    this.#onCollectCoin = onCollectCoin;
    this.#onInteractionChange = onInteractionChange;
    this.#entity = new pc.Entity("Buried treasure field");
    for (const { col, row } of mapData.vegetationData ?? []) {
      const key = this.#tileKey(col, row);
      this.#vegetationTileCounts.set(
        key,
        (this.#vegetationTileCounts.get(key) ?? 0) + 1,
      );
    }
    for (const { col, row } of mapData.groundCoverData ?? []) {
      const key = this.#tileKey(col, row);
      this.#groundCoverTileCounts.set(
        key,
        (this.#groundCoverTileCounts.get(key) ?? 0) + 1,
      );
    }
    this.#createMaterials();
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  set tool(tool) {
    this.#tool = tool;
  }

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

  canDig(id) {
    if (!id) {
      return false;
    }
    const site = this.#sites.find((candidate) => candidate.id === id);
    return site?.state === "digging" || !this.#dugTiles.has(id);
  }

  canOpen(id) {
    return this.#sites.some(
      (site) => site.id === id && site.state === "closed",
    );
  }

  canFill(id) {
    return this.#sites.some(
      (site) =>
        site.id === id &&
        ["empty", "vanished", "filling"].includes(site.state),
    );
  }

  dig(target) {
    if (target?.kind !== "dig") {
      return true;
    }
    const existingSite = this.#sites.find((site) => site.id === target.id);
    if (existingSite) {
      if (existingSite.state !== "digging") {
        return true;
      }
      existingSite.state = "expanding";
      existingSite.elapsed = 0;
      existingSite.hasTreasure =
        Math.random() < existingSite.treasureChance;
      return true;
    }
    if (this.#dugTiles.has(target.id)) {
      return true;
    }

    this.#dugTiles.add(target.id);
    const rewardProfile = this.#rewardProfileFor(target.id);
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
      lid: null,
      chestMaterials: [],
      lootSpawned: false,
      hasTreasure: false,
      coinsRemaining: 0,
      fillProgress: 0,
      treasureChance: rewardProfile.treasureChance,
      rewardMultiplier: rewardProfile.rewardMultiplier,
    };
    this.#createHole(site);
    this.#sites.push(site);
    return false;
  }

  fill(target) {
    const site = this.#sites.find(
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
      return true;
    }
    site.state = "filling";
    return false;
  }

  open(target) {
    const site = this.#sites.find(
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

  applyHeroPosition(position) {
    this.#heroPosition = { ...position };
  }

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

  collisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    let depth = 0;
    for (const site of this.#sites) {
      if (
        this.#holeBlocks(site) &&
        Math.abs(site.y - elevation) <= 0.85
      ) {
        depth = Math.max(
          depth,
          HOLE_COLLISION_RADIUS +
            radius -
            Math.hypot(x - site.x, z - site.z),
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

  movementRefusalAt(x, z, radius = 0, elevation = -Infinity) {
    const blocksHole = this.#sites.some(
      (site) =>
        this.#holeBlocks(site) &&
        Math.abs(site.y - elevation) <= 0.85 &&
        Math.hypot(x - site.x, z - site.z) <
          HOLE_COLLISION_RADIUS + radius,
    );
    return blocksHole ? MOVEMENT_REFUSAL.HOLE : null;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    for (const site of this.#sites) {
      for (const material of site.chestMaterials) {
        material.destroy();
      }
    }
    this.#entity?.destroy();
    this.#entity = null;
    this.#sites = [];
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
      const x = candidate.col - (this.#mapData.cols - 1) / 2;
      const z = candidate.row - (this.#mapData.rows - 1) / 2;
      const distance = Math.hypot(x - position.x, z - position.z);
      if (distance > INTERACTION_REACH || distance <= 0.001) {
        continue;
      }
      const facingDot =
        ((x - position.x) * facingDirection.x +
          (z - position.z) * facingDirection.z) /
        distance;
      const y =
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
      kind: "dig",
      col: nearest.col,
      row: nearest.row,
      x: nearest.x,
      y: nearest.y,
      z: nearest.z,
    };
  }

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
    const unfinished = this.#sites.some(
      (site) => site.id === key && site.state === "digging",
    );
    return (
      this.#mapData.grid[row][col] === TileType.GRASS &&
      (this.#mapData.tileMeta?.[row]?.[col]?.shape ?? "FLAT") === "FLAT" &&
      Number.isFinite(this.#mapData.heightmap[row][col]) &&
      (unfinished || !this.#dugTiles.has(key)) &&
      !this.#vegetationTileCounts.has(key) &&
      !this.#groundCoverTileCounts.has(key)
    );
  }

  #rewardProfileFor(key) {
    if (this.#felledTreeTiles.has(key)) {
      return {
        treasureChance: FELLED_TREE_TREASURE_CHANCE,
        rewardMultiplier: FELLED_TREE_REWARD_MULTIPLIER,
      };
    }
    if (this.#harvestedFlowerTiles.has(key)) {
      return {
        treasureChance:
          TREASURE_CHANCE / HARVESTED_FLOWER_REWARD_MULTIPLIER,
        rewardMultiplier: HARVESTED_FLOWER_REWARD_MULTIPLIER,
      };
    }
    if (this.#harvestedMushroomTiles.has(key)) {
      return {
        treasureChance: TREASURE_CHANCE,
        rewardMultiplier: HARVESTED_MUSHROOM_REWARD_MULTIPLIER,
      };
    }
    return {
      treasureChance: TREASURE_CHANCE,
      rewardMultiplier: 1,
    };
  }

  #createHole(site) {
    site.hole = this.#modelLibrary.instantiate(holeModelUrl);
    site.hole.name = `Excavated treasure hole ${site.id}`;
    site.hole.setLocalScale(
      HOLE_INITIAL_SCALE,
      HOLE_INITIAL_SCALE,
      HOLE_INITIAL_SCALE,
    );
    site.hole.setLocalPosition(site.x, site.y + 0.008, site.z);
    this.#entity.addChild(site.hole);
    site.earthPile = this.#modelLibrary.instantiate(earthModelUrl);
    site.earthPile.name = `Excavated earth pile ${site.id}`;
    site.earthPile.setLocalPosition(site.x + 0.42, site.y + 0.012, site.z + 0.3);
    this.#entity.addChild(site.earthPile);
    site.filledPatch = this.#modelLibrary.instantiate(filledEarthModelUrl);
    site.filledPatch.name = `Filled earth patch ${site.id}`;
    site.filledPatch.setLocalPosition(site.x, site.y + 0.014, site.z);
    site.filledPatch.enabled = false;
    this.#entity.addChild(site.filledPatch);
    this.#setExcavationScale(site, HOLE_INITIAL_SCALE);
  }

  #setExcavationScale(site, scale) {
    site.hole.setLocalScale(scale, scale, scale);
    site.earthPile.setLocalScale(scale, scale, scale);
  }

  #applyFillProgress(site) {
    const remaining = 1 - site.fillProgress;
    const holeScale = HOLE_INITIAL_SCALE +
      (1 - HOLE_INITIAL_SCALE) * remaining;
    const pileScale = Math.max(0.12, remaining);
    const patchScale = 0.45 + site.fillProgress * 0.55;
    site.hole.setLocalScale(holeScale, holeScale, holeScale);
    site.earthPile.setLocalScale(pileScale, pileScale, pileScale);
    site.filledPatch.enabled = true;
    site.filledPatch.setLocalScale(patchScale, patchScale, patchScale);
  }

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
      this.#entity.addChild(entity);
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

  #createChest(site) {
    site.chest = this.#modelLibrary.instantiate(chestModelUrl);
    site.chest.name = `Buried treasure chest ${site.id}`;
    site.chest.setLocalScale(0.86, 0.86, 0.86);
    site.chest.setLocalPosition(site.x, site.y - 0.58, site.z);
    site.lid = this.#findNamedEntity(site.chest, "Treasure chest lid");
    this.#createChestMaterialCopies(site);
    this.#entity.addChild(site.chest);
  }

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

  #spawnCoins(site) {
    const amount = Math.round(
      (5 + Math.floor(Math.random() * 8)) * site.rewardMultiplier,
    );
    site.coinsRemaining = amount;
    for (let index = 0; index < amount; index += 1) {
      const type = this.#rollCoinType();
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
        flightSide:
          (index % 2 === 0 ? 1 : -1) * (0.16 + (index % 3) * 0.05),
        rotation: Math.random() * 360,
      });
    }
  }

  #rollCoinType() {
    let roll = Math.random() * 100;
    for (const [type, definition] of COIN_DEFINITIONS) {
      roll -= definition.weight;
      if (roll < 0) {
        return type;
      }
    }
    return COIN_TYPE.COPPER;
  }

  #applyCoinMaterial(entity, type) {
    const material = this.#materials.get(type);
    for (const render of entity.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        meshInstance.material = material;
      }
    }
  }

  #createMaterials() {
    this.#soilMaterial = this.#createMaterial(
      "Flying fill soil",
      0x6f3214,
      0,
    );
    for (const [type, definition] of COIN_DEFINITIONS) {
      const material = this.#createMaterial(
        `${type} treasure coin`,
        definition.color,
        0.82,
      );
      this.#materials.set(type, material);
    }
  }

  #createMaterial(name, color, metalness) {
    const material = new this.#pc.StandardMaterial();
    material.name = name;
    material.diffuse = new this.#pc.Color(
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    );
    material.metalness = metalness;
    material.useMetalness = true;
    material.gloss = metalness > 0.5 ? 0.7 : 0.05;
    material.update();
    return material;
  }

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
          this.#createChest(site);
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
      site.chest.setLocalPosition(
        site.x,
        site.y - 0.58 + eased * 0.58,
        site.z,
      );
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
    site.lid?.setLocalEulerAngles(-105 * eased, 0, 0);
    if (!site.lootSpawned && progress >= 0.38) {
      site.lootSpawned = true;
      this.#spawnCoins(site);
    }
    if (progress >= 1) {
      site.state = "opened";
    }
  }

  #advanceCoin(coin, deltaTime) {
    coin.elapsed += deltaTime;
    coin.rotation += deltaTime * 720;
    if (coin.state === "skyborne") {
      const flightElapsed = coin.elapsed - coin.skyDelay;
      if (flightElapsed >= 0) {
        const progress = Math.min(
          1,
          flightElapsed / COIN_SKY_FLIGHT_DURATION,
        );
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
      coin.site.coinsRemaining = Math.max(
        0,
        coin.site.coinsRemaining - 1,
      );
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

  #chestBlocks(site) {
    return [
      "emerging",
      "closed",
      "opening",
      "opened",
      "vanishing",
    ].includes(site.state);
  }

  #holeBlocks(site) {
    return site.hole?.enabled && site.state !== "filled";
  }

  #beginChestVanish(site) {
    if (!site.chest || site.state === "vanishing" || site.state === "vanished") {
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
    site.lid = null;
    site.state = "vanished";
    this.#onInteractionChange?.();
  }

  #findNamedEntity(root, name) {
    const pending = [root];
    while (pending.length) {
      const entity = pending.pop();
      if (entity.name === name) {
        return entity;
      }
      pending.push(...entity.children);
    }
    return null;
  }

  #tileKey(col, row) {
    return `${row}:${col}`;
  }
}
