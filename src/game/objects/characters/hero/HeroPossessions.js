import { COIN_TYPE } from "../../../enum/CoinType.js";

/**
 * @typedef {{capacity: number, items: Array<{id: string, variant: string, quantity?: number}>}} HeroInventory
 * @typedef {{inventory: HeroInventory, addInventoryItem: (item: {id: string, variant: string, quantity?: number}) => boolean}} HeroConfigurationStore
 */

/**
 * Owns per-hero coins and access to persisted inventory. Recreating a hero starts
 * a fresh wallet while keeping the supplied store's inventory. No scene resources
 * or subscriptions are owned here; respawning the same hero preserves both.
 */
export class HeroPossessions {
  /**
   * @type {Record<string, number>}
   */
  #wallet = {
    [COIN_TYPE.GOLD]: 0,
    [COIN_TYPE.SILVER]: 0,
    [COIN_TYPE.COPPER]: 0,
  };

  /**
   * @type {HeroConfigurationStore}
   */
  #store;

  /**
   * @param {HeroConfigurationStore} store
   */
  constructor(store) {
    this.#store = store;
  }

  /**
   * @returns {Record<string, number>}
   */
  get wallet() {
    return { ...this.#wallet };
  }

  /**
   * @returns {HeroInventory}
   */
  get inventory() {
    return {
      capacity: this.#store.inventory.capacity,
      items: this.#store.inventory.items.map(HeroPossessions.#copyInventoryItem),
    };
  }

  /**
   * @returns {boolean}
   */
  get inventoryFull() {
    return this.#store.inventory.items.length >= this.#store.inventory.capacity;
  }

  /**
   * @param {string} type
   * @param {number} amount
   * @returns {boolean}
   */
  collectCoin(type, amount = 1) {
    if (!Object.hasOwn(this.#wallet, type)) {
      return false;
    }
    this.#wallet[type] += Math.max(0, Math.floor(amount));

    return true;
  }

  /**
   * The store owns admission, slot allocation and persistence. Its result is
   * authoritative even when a previously read capacity snapshot is stale.
   * @param {{id: string, variant: string, quantity?: number}} item
   * @returns {boolean}
   */
  collectInventoryItem(item) {
    return this.#store.addInventoryItem(item);
  }

  /**
   * @param {{id: string, variant: string, quantity?: number}} item
   */
  static #copyInventoryItem(item) {
    return { ...item };
  }
}
