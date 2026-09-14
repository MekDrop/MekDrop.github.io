import { SeatedRoyal } from "../objects/castle/SeatedRoyal.js";

/** Side-by-side playback of the same Cry clips used by the game-over scene. */
export class RoyalAnimationPreview {
  #entity;
  #royals = [];

  constructor({ pc, app, modelLibrary }) {
    this.#entity = new pc.Entity("Royal animation preview");
    const names = ["King", "Queen", "Princess"];
    for (const [index, modelUrl] of SeatedRoyal.modelUrls.entries()) {
      const royal = new SeatedRoyal({ pc, app, modelUrl, modelLibrary });
      const offset = (index - 1) * 1.8;
      royal.entity.name = `${names[index]} crying preview`;
      royal.entity.setLocalPosition(offset, 2.05, -offset);
      royal.entity.setLocalScale(0.72, 0.72, 0.72);
      royal.entity.setLocalEulerAngles(0, 45, 0);
      this.#entity.addChild(royal.entity);
      royal.beginCrying();
      this.#royals.push(royal);
    }
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    for (const royal of this.#royals) {
      royal.destroy();
    }
    this.#royals = [];
    this.#entity.destroy();
  }
}
