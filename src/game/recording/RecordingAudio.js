import { RecordingAudioUnavailableError } from "../errors/recording/index.js";

/** Taps PlayCanvas sound instances after their effects without muting playback. */
export class RecordingAudio {
  #app;
  #context;
  #destination;
  #silence;
  #connections = new Map();

  constructor(app) {
    this.#app = app;
    this.#context = app.soundManager.context;
    if (!this.#context) {
      throw new RecordingAudioUnavailableError();
    }
    this.#destination = this.#context.createMediaStreamDestination();
    // Keep an audio clock even on maps without sounds, including the galleries.
    this.#silence = this.#context.createConstantSource();
    this.#silence.offset.value = 0;
    this.#silence.connect(this.#destination);
    this.#silence.start();
    this.sync();
  }

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

  #disconnect(instance, { node, owned }) {
    if (![...this.#connections.values()].some((connection) => connection.node === node)) {
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
