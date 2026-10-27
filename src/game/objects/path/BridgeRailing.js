import { BridgeRailingKit } from "./BridgeRailingKit.js";

/**
 * Owns one map-authored railing that can be resized or redirected at runtime.
 */
export class BridgeRailing {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #models;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #visual = null;
  /**
   * @type {import("playcanvas").VertexBuffer[]}
   */
  #buffers = [];

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return BridgeRailingKit.modelUrls;
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions} options
   */
  constructor({ pc, modelLibrary, definition }) {
    this.#pc = pc;
    this.#models = modelLibrary;
    this.definition = definition;
    this.entity = new pc.Entity(definition.id);
    this.regenerate(definition);
  }

  /**
   * Replace the previous run, releasing its GPU instance buffers.
   *
   * @param {{position?: import("../ObjectTypes.js").Point3, length?: number, direction?: import("../ObjectTypes.js").Point3, postSpacing?: number}} options
   * @param {import("../ObjectTypes.js").Point3} [options.position]
   * @param {number} [options.length]
   * @param {import("../ObjectTypes.js").Point3} [options.direction]
   * @param {number} [options.postSpacing]
   */
  regenerate({ position = this.definition.position, length = this.definition.length ?? 1, direction = this.definition.direction ?? {
    x: 0,
    y: 0,
    z: 1,
  }, postSpacing = this.definition.postSpacing ?? 1 }) {
    this.#clear();
    const pc = this.#pc;
    this.entity.setPosition(position?.x ?? 0, position?.y ?? 0, position?.z ?? 0);
    this.#visual = new pc.Entity("Generated timber railing");
    this.entity.addChild(this.#visual);
    const kit = new BridgeRailingKit({
      pc,
      modelLibrary: this.#models,
      root: this.#visual,
    });
    kit.addRailing({
      position: new pc.Vec3(),
      length,
      direction: new pc.Vec3(direction.x, direction.y, direction.z),
      postSpacing,
    });
    this.#buffers = kit.build();
    Object.assign(this.definition, {
      position: {
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        z: position?.z ?? 0,
      },
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z,
      },
      length,
      postSpacing,
    });
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `Length: ${this.definition.length.toFixed(1)} | Direction: ${this.definition.direction.x}, ${this.definition.direction.z}`;
  }

  destroy() {
    this.#clear();
    this.entity.destroy();
  }

  #clear() {
    this.#visual?.destroy();
    this.#visual = null;
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    this.#buffers = [];
  }
}
