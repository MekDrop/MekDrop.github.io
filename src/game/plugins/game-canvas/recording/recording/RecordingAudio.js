import { RecordingAudioUnavailableError } from "../../../../errors/recording/index.js";

/**
 * Taps PlayCanvas sound instances after their effects without muting playback.
 */
export class RecordingAudio {
  /**
   *
   * @type {pc.Application}
   */
  #app;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {MediaStreamAudioDestinationNode}
   */
  #destination;
  /**
   *
   * @type {ConstantSourceNode}
   */
  #silence;
  /**
   *
   * @type {Map}
   */
  #connections = new Map();

  /**
   *
   * @param {pc.Application} app
   */
  constructor(app) {
    /**
     *
     * @type {pc.Application}
     */
    this.#app = app;
    /**
     *
     * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
     */
    this.#context = app.soundManager.context;
    if (!this.#context) {
      throw new RecordingAudioUnavailableError();
    }
    /**
     *
     * @type {MediaStreamAudioDestinationNode}
     */
    this.#destination = this.#context.createMediaStreamDestination();
    // Keep an audio clock even on maps without sounds, including the galleries.
    /**
     *
     * @type {ConstantSourceNode}
     */
    this.#silence = this.#context.createConstantSource();
    this.#silence.offset.value = 0;
    this.#silence.connect(this.#destination);
    this.#silence.start();
    this.sync();
  }

  /**
   *
   * @returns {MediaStream}
   */
  get stream() {
    return this.#destination.stream;
  }

  async resume() {
    await this.#context.resume();
  }

  sync() {
    const active = new Set();
    for (const component of this.#app.root.findComponents("sound")) {
      for (const slot of Object.values(component.slots)) {
        for (const instance of slot.instances) {
          active.add(instance);
          if (this.#connections.has(instance)) {
            continue;
          }
          const [first, last] = instance.getExternalNodes();
          const node = last ?? this.#context.createGain();
          node.connect(this.#destination);
          if (!first) {
            instance.setExternalNodes(node, node);
          }
          this.#connections.set(instance, { node, owned: !first });
        }
      }
    }
    for (const [instance, connection] of this.#connections) {
      if (!active.has(instance)) {
        this.#connections.delete(instance);
        this.#disconnect(instance, connection);
      }
    }
  }

  /**
   *
   * @param {pc.Entity|pc.MeshInstance} instance
   * @param {{node: pc.GraphNode, owned: boolean}} options
   * @param {pc.GraphNode} options.node
   * @param {boolean} options.owned
   */
  #disconnect(instance, { node, owned }) {
    if (![...this.#connections.values()].some(/**
     *
     * @param {{firstPathIndex: number, secondPathIndex: number, col: number, row: number}} connection
     */
    (connection) => connection.node === node)) {
      node.disconnect(this.#destination);
    }
    if (owned && instance.getExternalNodes()[0] === node) {
      instance.clearExternalNodes();
    }
  }

  destroy() {
    for (const [instance, connection] of this.#connections) {
      this.#connections.delete(instance);
      this.#disconnect(instance, connection);
    }
    this.#connections.clear();
    this.#silence.stop();
    this.#silence.disconnect();
    for (const track of this.stream.getTracks()) {
      track.stop();
    }
  }
}
