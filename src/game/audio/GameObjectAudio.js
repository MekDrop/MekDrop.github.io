/**
 * Entity-owned playback of borrowed, preloaded assets. Entity teardown stops it.
 */
export class GameObjectAudio {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Application} app
   * @param {import("./GameAudioLibrary.js").GameAudioLibrary} library
   * @param {Record<string,{wavUrl:string,oggUrl:string}>} clips
   * @param {number} [volume]
   */
  constructor(entity, app, library, clips, volume = 0.4) {
    this.#entity = entity;
    this.#app = app;
    entity.addComponent("sound", { positional: false });
    for (const [name, source] of Object.entries(clips)) {
      entity.sound.addSlot(name, {
        asset: library.get(source.wavUrl).id,
        volume,
        overlap: false,
      });
    }
  }

  /**
   * @param {string} name
   * @param {number} [pitch]
   */
  play(name, pitch = 1) {
    const sound = this.#entity.sound;
    if (!sound?.enabled || !this.#entity.enabled) {
      return;
    }
    const slot = sound.slot(name);
    slot.pitch = pitch;
    sound.play(name);
  }

  /**
   * Resume inside an actual input gesture; PlayCanvas retries on browser gestures.
   */
  resume() {
    this.#app.soundManager.resume();
  }

  /**
   * Attenuate against the actor instead of the distant isometric camera.
   * @param {() => {x:number,y:number,z:number}|null} listener
   * @param {number} [range]
   */
  follow(listener, range = 12) {
    const update = () => {
      const position = listener();
      const origin = this.#entity.getPosition();
      const distance = position ? Math.hypot(position.x - origin.x, position.y - origin.y, position.z - origin.z) : range;
      this.#entity.sound.volume = Math.max(0, 1 - distance / range) ** 2;
    };
    const handle = this.#app.on("update", update);
    this.#entity.once("destroy", () => handle.off());
    update();
  }
}
