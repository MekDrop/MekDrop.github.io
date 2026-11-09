import { COIN_TYPE } from "../../enum/CoinType.js";
import { colorFromHex } from "../../helpers/colors.js";
import coinModelUrl from "../../models/treasure/coin.glb?url";

/**
 * @typedef {import("../ObjectTypes.js").Point3} Point3
 */

/**
 * @typedef {object} TreasureCoin
 * @property {import("playcanvas").Entity} entity
 * @property {{id: string, remaining: number}} batch
 * @property {string} type
 * @property {string} state
 * @property {Point3} position
 * @property {Point3} skyStart
 * @property {Point3} skyControlA
 * @property {Point3} skyOffset
 * @property {number} skyDelay
 * @property {number} elapsed
 * @property {number} flightSide
 * @property {Point3|null} collectStart
 * @property {Point3|null} collectControlA
 * @property {Point3|null} collectControlBOffset
 * @property {number} rotation
 */

const COIN_COLLECTION_DURATION = 0.68;
const COIN_SKY_FLIGHT_DURATION = 0.72;
const COIN_SKY_STAGGER = 0.035;
const COIN_SKY_HEIGHT = 1.75;
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

/**
 * Owns coin entities, shared materials and flight/reward lifecycle.
 * Reports completed batches; excavation and chest state belong to the field.
 */
export class TreasureCoins {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {TreasureCoin[]}
   */
  #coins = [];
  /**
   * @type {Map<string, import("playcanvas").StandardMaterial>}
   */
  #materials = new Map();
  /**
   * @type {Point3|null}
   */
  #heroPosition = null;
  /**
   * @type {((type: string, amount: number) => void)|null}
   */
  #onCollectCoin;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [coinModelUrl];
  }

  /**
   * Borrows the field root and model library; owns only spawned entities and materials.
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {import("playcanvas").Entity} parent
   * @param {((type: string, amount: number) => void)|null} onCollectCoin
   */
  constructor(pc, modelLibrary, parent, onCollectCoin = null) {
    this.#pc = pc;
    this.#modelLibrary = modelLibrary;
    this.#entity = parent;
    this.#onCollectCoin = onCollectCoin;
    this.#createMaterials();
  }

  /**
   * @param {Point3} position
   */
  applyHeroPosition(position) {
    this.#heroPosition = { ...position };
  }

  /**
   * Advance after sites, including coins spawned in this frame.
   * Arrival rewards remain deferred to the frame after the collection flight ends.
   * @param {number} deltaTime Clamped field frame time.
   * @returns {string[]} Completed batch IDs.
   */
  update(deltaTime) {
    const completed = [];
    for (let index = this.#coins.length - 1; index >= 0; index -= 1) {
      const coin = this.#coins[index];
      if (this.#advanceCoin(coin, deltaTime)) {
        this.#coins.splice(index, 1);
        if (coin.batch.remaining === 0) {
          completed.push(coin.batch.id);
        }
      }
    }

    return completed;
  }

  destroy() {
    for (const coin of this.#coins) {
      coin.entity.destroy();
    }
    this.#coins = [];
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
    this.#heroPosition = null;
    this.#onCollectCoin = null;
    this.#entity = null;
    this.#modelLibrary = null;
    this.#pc = null;
  }

  /**
   *
   * Spawn in field-local coordinates, independently of moving island roots.
   * @param {string} id
   * @param {string[]} contents
   * @param {Point3} origin
   */
  spawn(id, contents, origin) {
    const amount = contents.length;
    const batch = {
      id,
      remaining: amount,
    };
    for (let index = 0; index < amount; index += 1) {
      const type = contents[index];
      const angle = (index / amount) * Math.PI * 2 + Math.random() * 0.45;
      const coinEntity = this.#modelLibrary.instantiate(coinModelUrl);
      coinEntity.name = `${type} treasure coin`;
      coinEntity.setLocalScale(0.68, 0.68, 0.68);
      coinEntity.setLocalEulerAngles(90, 0, 0);
      const position = {
        x: origin.x,
        y: origin.y + 0.48,
        z: origin.z,
      };
      const skyRadius = 0.14 + (index % 4) * 0.055;
      coinEntity.setLocalPosition(position.x, position.y, position.z);
      this.#applyCoinMaterial(coinEntity, type);
      this.#entity.addChild(coinEntity);
      this.#coins.push({
        entity: coinEntity,
        batch,
        type,
        state: "skyborne",
        position,
        skyStart: { ...position },
        skyControlA: {
          x: origin.x + Math.cos(angle) * 0.12,
          y: origin.y + 1.45 + Math.random() * 0.25,
          z: origin.z + Math.sin(angle) * 0.12,
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
   * @param {TreasureCoin} coin
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
      coin.batch.remaining -= 1;
      this.#onCollectCoin?.(coin.type, 1);
      coin.entity.destroy();

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
   * @param {TreasureCoin} coin
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
   * @param {Point3} controlA
   * @param {Point3} controlB
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
}
