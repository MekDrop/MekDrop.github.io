export class CastleGenerationContext {
  #cleanupCallbacks = [];

  constructor(options, scheduler) {
    this.input = Object.freeze({
      position: options.position ? Object.freeze({ ...options.position }) : null,
      doors: Object.freeze(
        (options.doors ?? []).map((door) => Object.freeze({ ...door })),
      ),
      style: options.style ?? null,
    });
    this.scheduler = scheduler;
    this.yieldState = { lastYield: scheduler.now() };
    this.layout = {};
    this.structure = {
      wall: null,
      audienceWing: null,
      towers: [],
      gatehouses: [],
    };
    this.metadata = {
      collision: {},
      runtime: {},
    };
    this.geometry = {
      boxes: [],
      decorations: { flames: [], banners: [], flags: [], roofs: [] },
      collision: { groundColumns: [], cameraBlocks: [] },
    };
    this.planning = {
      writer: null,
      geometryPlanner: null,
    };
    this.output = {};
  }

  registerCleanup(callback) {
    this.#cleanupCallbacks.push(callback);
  }

  cleanup() {
    for (const callback of this.#cleanupCallbacks.splice(0).reverse()) {
      callback();
    }
  }
}
