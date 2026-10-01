/**
 * @typedef {object} CastleGenerationInput
 * @property {import("src/game/GameContracts.js").GridPoint|null} [position]
 * @property {Array<{side: string, offset: number, width: number, cells?: import("src/game/GameContracts.js").GridPoint[]}>} [doors]
 * @property {string|null} [style]
 * @property {string|number} [seed]
 */

/**
 * @typedef {object} CastleStructureSegment
 * @property {number} [start]
 * @property {number} [end]
 * @property {number} [height]
 * @property {string} [boundary]
 */

/**
 * @typedef {object} CastleStructureState
 * @property {CastleStructureSegment|null} wall
 * @property {CastleStructureSegment|null} audienceWing
 * @property {CastleStructureSegment[]} towers
 * @property {CastleStructureSegment[]} gatehouses
 */

/**
 * @typedef {object} CastleGeometryElement
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [depth]
 * @property {string} [role]
 */

/**
 * @typedef {object} CastleGeometryState
 * @property {CastleGeometryElement[]} boxes
 * @property {{flames: CastleGeometryElement[], banners: CastleGeometryElement[], flags: CastleGeometryElement[], roofs: CastleGeometryElement[]}} decorations
 * @property {{groundColumns: CastleGeometryElement[], cameraBlocks: CastleGeometryElement[]}} collision
 */

export class CastleGenerationContext {
  /**
   *
   * @type {Array}
   */
  #cleanupCallbacks = [];

  /**
   *
   * @param {CastleGenerationInput} options
   * @param {{now: () => number, yieldToMainThread: () => Promise<void>, yieldIfNeeded: (state: {lastYield: number}) => Promise<void>, throwIfAborted?: () => void}} scheduler
   */
  constructor(options, scheduler) {
    /**
     *
     * @type {Readonly<CastleGenerationInput>}
     */
    this.input = Object.freeze({
      position: options.position ? Object.freeze({ ...options.position }) : null,
      doors: Object.freeze(
        (options.doors ?? []).map(/**
         *
         * @param {{side: string, offset: number, width: number, cells?: import("src/game/GameContracts.js").GridPoint[]}} door
         */
        (door) => Object.freeze({ ...door })),
      ),
      style: options.style ?? null,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
    });
    /**
     *
     * @type {{now: () => number, yieldToMainThread: () => Promise<void>, yieldIfNeeded: (state: {lastYield: number}) => Promise<void>, throwIfAborted?: () => void}}
     */
    this.scheduler = scheduler;
    /**
     *
     * @type {{lastYield: number}}
     */
    this.yieldState = { lastYield: scheduler.now() };
    /**
     *
     * @type {import("src/game/GameContracts.js").CastleLayout}
     */
    this.layout = {};
    /**
     *
     * @type {CastleStructureState}
     */
    this.structure = {
      wall: null,
      audienceWing: null,
      towers: [],
      gatehouses: [],
    };
    /**
     *
     * @type {{collision: {[key: string]: string|number|boolean}, runtime: {[key: string]: string|number|boolean}}}
     */
    this.metadata = {
      collision: {},
      runtime: {},
    };
    /**
     *
     * @type {CastleGeometryState}
     */
    this.geometry = {
      boxes: [],
      decorations: { flames: [], banners: [], flags: [], roofs: [] },
      collision: { groundColumns: [], cameraBlocks: [] },
    };
    /**
     *
     * @type {{writer: import("./CastleBuildPlanWriter.js").CastleBuildPlanWriter|null, geometryPlanner: import("./CastleGeometryPlanner.js").CastleGeometryPlanner|null}}
     */
    this.planning = {
      writer: null,
      geometryPlanner: null,
    };
    /**
     *
     * @type {import("src/game/GameContracts.js").MapGenerationOutput}
     */
    this.output = {};
  }

  /**
   *
   * @param {() => void} callback
   */
  registerCleanup(callback) {
    this.#cleanupCallbacks.push(callback);
  }

  cleanup() {
    for (const callback of this.#cleanupCallbacks.splice(0).reverse()) {
      callback();
    }
  }
}
