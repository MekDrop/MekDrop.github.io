import { HERO_BUFF } from "../enum/HeroBuff.js";
import { GamePanelHud } from "./GamePanelHud.js";

/**
 * Object-owned view of earned affection, its buildup and nearby pat affordance.
 */
export class LatchAffectionHud extends GamePanelHud {
  /**
   * @param {import("../objects/enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    super({
      pc: owner.pc,
      app: owner.app,
      name: "Slime affection HUD",
      priority: 105,
    });

    this.owner = owner;
    this.labels = new Map();
    for (const text of ["♥ Affection", "♥ Getting closer…", "♥ Loved", "♥ Slime affection  +5% speed"]) {
      const width = text.includes("+5%") ? 476 : 360;
      this.labels.set(text, this.createDrawnTexture(text, width, 56, /**
       *
       * @param {CanvasRenderingContext2D} context
       */
        context => {
          context.fillStyle = "#211d29ee";
          context.beginPath();
          context.roundRect(2, 2, width - 4, 52, 12);
          context.fill();
          context.strokeStyle = "#d6b47c";
          context.lineWidth = 2;
          context.stroke();
          context.font = "bold 28px sans-serif";
          context.fillStyle = "#ffcf8e";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(text, width / 2, 29);
        }));
    }
    this.status = this.#image("Slime affection status", 170, 26);
    this.buff = this.#image("Slime affection buff", 238, 30);
    this.buff.element.pivot = new this.pc.Vec2(0, 1);
    this.buff.setLocalPosition(18, -108, 0);
    this.buff.element.texture = this.labels.get("♥ Slime affection  +5% speed");
    this.entity.addChild(this.status);
    this.entity.addChild(this.buff);
    owner.app.root.addChild(this.entity);
    this.syncDrawOrder();
  }

  /**
   * @param {string} name
   * @param {number} width
   * @param {number} height
   * @returns {import("playcanvas").Entity}
   */
  #image(name, width, height) {
    const e = new this.pc.Entity(name);
    e.addComponent("element", {
      type: this.pc.ELEMENTTYPE_IMAGE,
      anchor: new this.pc.Vec4(0, 1, 0, 1),
      pivot: new this.pc.Vec2(.5, 0),
      width,
      height,
      useInput: false,
    });
    e.enabled = false;

    return e;
  }

  update() {
    const s = this.owner, a = s.affection, canvas = this.app.graphicsDevice.canvas;
    const active = s.statuses.has("affection"), happy = a.happyRemaining > 0;
    const position = s.position.clone().add(new this.pc.Vec3(0, 1.15, 0));
    const point = s.runtime.camera.component.worldToScreen(position);
    const visible = s.alive && !s.gatewayArrival.active && position.clone().sub(s.runtime.camera.entity.getPosition()).dot(s.runtime.camera.entity.forward) > 0 && point.x >= 0 && point.x <= canvas.clientWidth && point.y >= 0 && point.y <= canvas.clientHeight;
    const scale = this.entity.screen.scale * canvas.clientWidth / canvas.width;
    this.status.enabled = Boolean(visible && (active || happy || a.charge > 0));
    this.status.element.texture = this.labels.get(active ? "♥ Affection" : happy ? "♥ Loved" : "♥ Getting closer…");
    this.status.setLocalPosition(point.x / scale, -point.y / scale, 0);
    const hero = s.runtime.getHero?.();
    const buff = hero?.buffs?.find(/**
     *
     * @param {{id:string}} effect
     */
      effect=>effect.id === HERO_BUFF.SLIME_AFFECTION);
    this.buff.enabled = Boolean(buff && a.buffRemaining > 0);
  }
}
