import { GamePanelHud } from "./GamePanelHud.js";

/**
 * Read-only view of the authoritative enemy economy.
 */
export class WaveDirectorHud extends GamePanelHud {
  /**
   * @type {{context:CanvasRenderingContext2D,texture:import("playcanvas").Texture}}
   */
  #record;
  /**
   * @type {import("playcanvas").Entity}
   */
  #image;
  /**
   * @type {string}
   */
  #last = "";
  /**
   * @param {import("../objects/wave-director/EnemyWaveDirector.js").EnemyWaveDirector} owner
   */
  constructor(owner) {
    super({
      pc: owner.pc,
      app: owner.app,
      name: "Enemy wave director HUD",
      priority: 102,
    });

    this.#record = this.createTextureRecord("Enemy director budget", 640, 128);
    this.#image = new owner.pc.Entity("Enemy director budget panel");
    this.#image.addComponent("element", {
      type: owner.pc.ELEMENTTYPE_IMAGE,
      anchor: new owner.pc.Vec4(1, 1, 1, 1),
      pivot: new owner.pc.Vec2(1, 1),
      width: 320,
      height: 64,
      texture: this.#record.texture,
      useInput: false,
    });
    this.#image.setLocalPosition(-18, -18, 0);
    this.entity.addChild(this.#image);
    this.attach();
    this.syncDrawOrder();
  }
  /**
   * @param {import("../waves/WaveDirectorState.js").WaveDirectorState["snapshot"]} state
   */
  update(state) {
    const text = `Enemy waves · ${state.controllerId}\n${state.coins} coins  |  Wave ${state.wave}  |  ${state.active} active · ${state.queue.length} queued`;
    if (text === this.#last) {
      return;
    }
    this.#last = text;
    const c = this.#record.context;
    c.clearRect(0, 0, 640, 128);
    c.fillStyle = "#211d29ee";
    c.beginPath();
    c.roundRect(2, 2, 636, 124, 14);
    c.fill();
    c.strokeStyle = "#d6b47c";
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = "#ffcf8e";
    c.font = "bold 27px sans-serif";
    c.fillText(text.split("\n")[0], 20, 43);
    c.fillStyle = "#fff1dd";
    c.font = "22px sans-serif";
    c.fillText(text.split("\n")[1], 20, 88);
    this.#record.texture.upload();
  }
}
