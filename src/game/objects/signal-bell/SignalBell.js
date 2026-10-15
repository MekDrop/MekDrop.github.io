import modelUrl from "../../models/signal-bell/signal-bell.glb?url";
import soundUrl from "../../models/signal-bell/signal-bell.wav?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { SignalBellInteraction } from "./SignalBellInteraction.js";
import { SignalBellRope } from "./SignalBellRope.js";

/**
 * Map-owned alarm bell with an authored strike clip and an audible, repeatable E action.
 */
export class SignalBell extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("playcanvas").Asset}
   */
  #sound;
  /**
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   * @type {boolean}
   */
  #ringing = false;
  /**
   * @type {number}
   */
  #ringCount = 0;
  /**
   * @type {((error:Error)=>void)|undefined}
   */
  #onRuntimeError;
  /**
   * @type {SignalBellRope|null}
   */
  #rope = null;
  /**
   * @type {import("../hero/Hero.js").Hero|null}
   */
  #pullingHero = null;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Keep collision on the stationary frame while the bowl swings above it.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (collision) {
      model.findByName("Signal bell axle")?.destroy();
      model.findByName("Bell pull rope")?.destroy();
      model.findByName("Bell rope tail")?.destroy();
    }
  }

  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0] & {app:import("playcanvas").Application}} options
   */
  constructor(options) {
    super(options);
    const { pc, app, modelLibrary, definition } = options;
    this.#app = app;
    this.#pc = pc;
    this.#onRuntimeError = options.runtime?.onRuntimeError;
    this.#model = this.visualRoots[0].children[0];
    const track = modelLibrary.getAnimationTracks(modelUrl, ["Ring"]).get("Ring");
    this.#model.addComponent("anim", { activate: true });
    this.#model.anim.addAnimationState("Ring", track, 1, false);
    this.#model.anim.baseLayer.play("Ring");
    this.#model.anim.speed = 0;
    this.#model.anim.update(0);
    this.#sound = new pc.Asset(`${definition.id} bell strike`, "audio", { url: soundUrl });
    app.assets.add(this.#sound);
    app.assets.load(this.#sound);
    this.visualRoots[0].addComponent("sound", {
      positional: false,
      slots: {
        ring: {
          name: "ring",
          asset: this.#sound.id,
          volume: 0.65,
          overlap: false,
          loop: false,
        },
      },
    });
  }

  /**
   * @returns {import("playcanvas").Vec3}
   */
  get position() { return this.visualRoots[0].getPosition(); }

  /**
   * @returns {boolean}
   */
  get canRing() { return !this.#ringing; }

  /**
   * @returns {string}
   */
  get testStatus() { return `Bell: ${this.#ringCount} rings${this.canRing ? " · ready" : " · ringing"}`; }

  /**
   * Reserve the bell during the approach and unlock audio in the E gesture.
   */
  beginRinging() {
    this.#ringing = true;
    // Resuming inside the E key gesture also works with browser autoplay rules.
    this.#app.soundManager.resume();
    const context = this.#app.soundManager.context;
    if (context?.state === "suspended") {
      context.resume().catch(
        /**
         * @param {Error} error
         */
        error => this.#onRuntimeError?.(error),
      );
    }
  }

  /**
   * Begin the bell timeline; the rope follows Ammo and the hero's actual glove.
   * @param {import("../hero/Hero.js").Hero} hero
   */
  startPull(hero) {
    this.#pullingHero = hero;
    const layer = this.#model.anim.baseLayer;
    layer.play("Ring");
    layer.activeStateCurrentTime = 0;
    this.#model.anim.speed = 0;
  }

  /**
   * Sample both authored performances on the hero action clock, including slow frames.
   * @param {number} time
   */
  setPullTime(time) {
    if (this.#rope && time >= 0.5 && time < 1.2) {
      this.#rope.hand = () => this.#pullingHero?.bellGripPosition ?? null;
    } else { this.#rope?.release(); }
    this.#model.anim.baseLayer.activeStateCurrentTime = time;
    this.#model.anim.update(0);
  }

  /**
   * Strike only at the downward pull's contact frame.
   */
  strike() {
    this.#ringCount++;
    this.visualRoots[0].sound.play("ring");
  }

  /**
   * Release reservations after completion or interruption.
   */
  endRinging() {
    this.#ringing = false;
    this.#pullingHero = null;
    this.#rope?.release();
    if (this.#model.anim) { this.setPullTime(0); }
  }

  /**
   * Position matching the baked right-hand contact in RingBell.
   * @returns {{position:{x:number,y:number,z:number},facing:{x:number,z:number}}}
   */
  get ringingPose() {
    const yaw = (this.definition.rotation ?? 0) * Math.PI / 180;
    const center = this.position;
    return {
      position: {
        x: center.x + Math.cos(yaw) * 0.205 + Math.sin(yaw) * 0.5,
        y: center.y,
        z: center.z - Math.sin(yaw) * 0.205 + Math.cos(yaw) * 0.5,
      },
      facing: {
        x: -Math.sin(yaw),
        z: -Math.cos(yaw),
      },
    };
  }

  /**
   * @param {{hero:import("../hero/Hero.js").Hero,onComplete?:()=>void}} options
   * @returns {SignalBellInteraction|null}
   */
  findInteraction({ hero, onComplete }) {
    const interaction = new SignalBellInteraction(this, hero, onComplete);
    return interaction.canInteract ? interaction : null;
  }

  // The fixed frame and animated bell share a model; do not bake it into a batch.
  onSceneReady() {
    this.#rope ??= new SignalBellRope(this.#pc, this.#app, this.#model);
  }

  destroy() {
    this.#ringing = false;
    this.#rope?.destroy();
    this.#rope = null;
    this.visualRoots[0].sound.stop();
    super.destroy();
    this.#sound.unload();
    this.#app.assets.remove(this.#sound);
  }
}
