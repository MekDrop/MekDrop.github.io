import terraceDoorUrl from "../../models/castle/leisure/terrace-door.glb?url";
import terraceStairheadUrl from "../../models/castle/leisure/terrace-stairhead.glb?url";
import { CASTLE_DOOR_ANIMATION } from "../../enum/CastleDoorAnimation.js";

/** A roof stairhead with a single rectangular door opening onto the terrace. */
export class TerraceDoor {
  static get modelUrls() {
    return [terraceDoorUrl, terraceStairheadUrl];
  }

  #entity;
  #door;
  #layer;
  #duration;
  #amount = 0;

  constructor({ modelLibrary, wallMaterial }) {
    this.#entity = modelLibrary.instantiate(terraceStairheadUrl);
    this.#entity.name = "Terrace stairhead";
    this.#applyWallMaterial(wallMaterial);
    this.#door = modelLibrary.instantiate(terraceDoorUrl);
    this.#door.name = "Terrace outward-opening door";
    this.#entity.addChild(this.#door);
    const track = modelLibrary.getAnimationTracks(terraceDoorUrl, [
      CASTLE_DOOR_ANIMATION.OPEN,
    ]).get(CASTLE_DOOR_ANIMATION.OPEN);
    this.#door.addComponent("anim", { activate: true });
    this.#door.anim.addAnimationState(CASTLE_DOOR_ANIMATION.OPEN, track, 1, false);
    this.#layer = this.#door.anim.baseLayer;
    this.#layer.play(CASTLE_DOOR_ANIMATION.OPEN);
    this.#door.anim.speed = 0;
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
    this.#door = null;
  }

  #applyWallMaterial(wallMaterial) {
    if (!wallMaterial) {
      return;
    }

    const pending = [this.#entity];
    while (pending.length) {
      const entity = pending.pop();
      const isFramePiece =
        entity.name.startsWith("Terrace stairhead side wall") ||
        entity.name.startsWith("Terrace jamb block") ||
        entity.name === "Terrace lintel face" ||
        entity.name === "Terrace rectangular lintel";
      if (isFramePiece) {
        for (const meshInstance of entity.render?.meshInstances ?? []) {
          meshInstance.material = wallMaterial;
        }
      }
      pending.push(...entity.children);
    }
  }
}
