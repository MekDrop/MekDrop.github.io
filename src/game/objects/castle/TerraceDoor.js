import { CastleDoor } from "./CastleDoor.js";
import { CASTLE_DOOR_ANIMATION } from "../../enum/CastleDoorAnimation.js";

/** A miniature instance of the authored doors, independent of the ground entrance. */
export class TerraceDoor {
  #entity;
  #layer;
  #duration;
  #amount = 0;

  constructor({ modelLibrary }) {
    this.#entity = modelLibrary.instantiate(CastleDoor.modelUrl);
    this.#entity.name = "Terrace doors";
    this.#entity.setLocalScale(0.5, 1.25 / 2.3, 0.5);
    const track = modelLibrary.getAnimationTracks(CastleDoor.modelUrl, [
      CASTLE_DOOR_ANIMATION.OPEN,
    ]).get(CASTLE_DOOR_ANIMATION.OPEN);
    this.#entity.addComponent("anim", { activate: true });
    this.#entity.anim.addAnimationState(CASTLE_DOOR_ANIMATION.OPEN, track, 1, false);
    this.#layer = this.#entity.anim.baseLayer;
    this.#layer.play(CASTLE_DOOR_ANIMATION.OPEN);
    this.#entity.anim.speed = 0;
    this.#duration = track.duration;
    this.#layer.activeStateCurrentTime = 0;
  }

  get entity() {
    return this.#entity;
  }

  update(deltaTime, open) {
    const step = Math.max(0, deltaTime) * 3;
    this.#amount = open
      ? Math.min(1, this.#amount + step)
      : Math.max(0, this.#amount - step);
    this.#layer.activeStateCurrentTime = this.#amount * this.#duration;
  }

  destroy() {
    this.#entity.destroy();
  }
}
