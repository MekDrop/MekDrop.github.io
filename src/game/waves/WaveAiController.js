import { WAVE_CONFIG } from "./wave-config.js";

/**
 * Replaceable local policy; it has no authority to change balances or spawn actors.
 */
export class WaveAiController {
  /**
   * @type {number}
   */
  #nextWave;
  /**
   * @type {number}
   */
  #gateCursor = 0;
  /**
   * @type {number}
   */
  #offerCursor = 0;
  /**
   * @type {typeof WAVE_CONFIG}
   */
  #config;
  /**
   * @param {Partial<typeof WAVE_CONFIG>} config
   */
  constructor(config = {}) {
    this.#config = {
      ...WAVE_CONFIG,
      ...config,
    };
    this.#nextWave = this.#config.firstWaveDelay;
  }
  /**
   * @param {import("./WaveDirectorState.js").WaveDirectorState["snapshot"]} state
   * @param {Array<{creature:string,count:number,gateId:string}>|null} rebuildOrders
   * @returns {Array}
   */
  commands(state, rebuildOrders = null) {
    if (rebuildOrders !== null) {
      return this.#rebuildCommands(state, rebuildOrders);
    }
    if (state.clock < this.#nextWave || !state.gates.length || state.queue.length || state.active >= state.maxActive) {
      return [];
    }
    this.#nextWave = state.clock + this.#config.waveInterval;
    const offer = state.offers[this.#offerCursor++ % state.offers.length];
    const count = Math.min(this.#config.waveSize, Math.floor(state.coins / offer.cost), state.maxQueued, state.maxActive - state.active);

    return Array.from({length: count}, /**
   * @param {undefined} _
   * @param {number} index
     */
      (_, index)=>({
        type: "buy",
        sequence: state.nextSequence + index,
        creature: offer.creature,
        gateId: state.gates[this.#gateCursor++ % state.gates.length],
      }));
  }

  /**
   * @param {import("./WaveDirectorState.js").WaveDirectorState["snapshot"]} state
   * @param {Array<{creature:string,count:number,gateId:string}>} orders
   * @returns {Array}
   */
  #rebuildCommands(state, orders) {
    const commands = [];
    let coins = state.coins;
    const capacity = state.maxQueued - state.queue.length;
    for (const order of orders) {
      const offer = state.offers.find(/**
       *
       * @param {{creature:string,cost:number}} candidate
       */
        (candidate) => candidate.creature === order.creature);
      if (!offer || !state.gates.includes(order.gateId)) {
        continue;
      }
      const count = Math.min(order.count, capacity - commands.length, Math.floor(coins / offer.cost));
      for (let index = 0; index < count; index += 1) {
        commands.push({
          type: "buy",
          sequence: state.nextSequence + commands.length,
          creature: order.creature,
          gateId: order.gateId,
        });
        coins -= offer.cost;
      }
    }

    return commands;
  }
}
