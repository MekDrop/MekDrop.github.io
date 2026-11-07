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
   * @returns {Array}
   */
  commands(state) {
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
}
