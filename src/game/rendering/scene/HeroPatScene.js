import { HeroPatHand } from "../../objects/characters/hero/HeroPatHand.js";
import { HeroPatGesture } from "../../controls/HeroPatGesture.js";

/**
 * Owns the pat gesture and hand for one hero's scene lifetime.
 */
export class HeroPatScene {
  /**
   * @type {import("../../objects/characters/hero/Hero.js").Hero}
   */
  #hero;
  /**
   * @type {import("../../camera/GameCamera.js").GameCamera}
   */
  #camera;
  /**
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   * @type {() => boolean}
   */
  #isInventoryVisible;
  /**
   * @type {HeroPatHand}
   */
  #hand;
  /**
   * @type {HeroPatGesture}
   */
  #gesture;

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, hero: import("../../objects/characters/hero/Hero.js").Hero, camera: import("../../camera/GameCamera.js").GameCamera, canvas: HTMLCanvasElement, mapRoot: import("playcanvas").Entity, isInventoryVisible: () => boolean}} options
   */
  constructor({
    pc,
    modelLibrary,
    hero,
    camera,
    canvas,
    mapRoot,
    isInventoryVisible,
  }) {
    this.#hero = hero;
    this.#camera = camera;
    this.#canvas = canvas;
    this.#isInventoryVisible = isInventoryVisible;
    this.#hand = new HeroPatHand({
      pc,
      modelLibrary,
      getPatPosition: this.#getPatPosition.bind(this),
      getViewRotation: this.#getViewRotation.bind(this),
      onContact: this.#onContact.bind(this),
    });
    mapRoot.addChild(this.#hand.entity);
    this.#gesture = new HeroPatGesture(canvas, {
      hitTest: this.#hitTest.bind(this),
      pat: this.pat.bind(this),
    });
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [HeroPatHand.modelUrl];
  }

  pat() {
    return this.#hero.canBePatted ? this.#hand.pat() : false;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.#hand.update(deltaTime);
  }

  destroy() {
    this.#gesture.destroy();
    this.#hand.destroy();
  }

  /**
   * @param {number} heightOffset World-space height above the hair contact point.
   */
  screenPosition(heightOffset = 0) {
    const hero = this.#hero;
    const position = hero?.patPosition;
    if (!position || !this.#camera?.camera) {
      return null;
    }
    position.y += heightOffset;
    const center = this.#camera.camera.worldToScreen(position);
    const edge = this.#camera.camera.worldToScreen(
      position.clone().add(this.#camera.right.clone().mulScalar(0.42)),
    );

    return {
      x: center.x,
      y: center.y,
      radius: Math.max(5, Math.abs(edge.x - center.x)),
    };
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").CameraPointer} event
   */
  #hitTest(event) {
    const hero = this.#hero;
    if (
      this.#isInventoryVisible() ||
      this.#camera.firstPersonEnabled ||
      !hero?.canBePatted
    ) {
      return false;
    }
    const head = this.screenPosition();
    const rect = this.#canvas.getBoundingClientRect();
    if (
      !head ||
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return false;
    }
    return (
      Math.hypot(
        event.clientX - rect.left - head.x,
        (event.clientY - rect.top - head.y) / 0.85,
      ) <= head.radius
    );
  }

  #getPatPosition() {
    return this.#hero.patPosition;
  }

  #getViewRotation() {
    return this.#camera.rotation;
  }

  #onContact() {
    return this.#hero.pat();
  }
}
