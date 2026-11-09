import { BellBugScoopFoot } from "./BellBugScoopFoot.js";

/**
 * One shared surface contact drives the toe, body indentation and peeled gel.
 */
export class BellBugScoopPose {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.owner = owner;
    this.model = model;
    this.feet = new Map();
    this.poseHandle = owner.app.on("prerender", this.#pose, this);
    this.restoreHandle = owner.app.on("postrender", this.#restore, this);
  }

  /**
   * @param {number} side
   * @returns {BellBugScoopFoot}
   */
  foot(side) {
    if (!this.feet.has(side)) {
      this.feet.set(side, new BellBugScoopFoot(this.owner, this.model, side));
    }
    return this.feet.get(side);
  }

  #restore() {
    for (const foot of this.feet.values()) {
      foot.restore();
    }
  }

  #pose() {
    this.#restore();
    if (this.owner.fleshScratch?.stroke) {
      this.owner.fleshScratch.pose();

      return;
    }
    const scoop = this.owner.scoop;
    if (!scoop?.target) {
      return;
    }
    scoop.contact ??= scoop.target.beginScoop?.(this.owner, scoop.side);
    if (!scoop.contact?.active) {
      return;
    }
    const foot = this.foot(scoop.side);
    if (!foot.source) {
      return;
    }
    const t = scoop.time;
    const home = foot.point;
    const point = scoop.contact.point;
    const reach = Math.min(1, t / 0.45);
    const goal = home.clone().lerp(home, point, reach * reach * (3 - 2 * reach));
    if (t >= 0.45) {
      const head = this.model.findByName("head");
      const mouth = head.getPosition().clone().add(this.owner.entity.forward.clone().mulScalar(0.08));
      const taste = Math.min(1, (t - 0.45) / 0.47);
      goal.lerp(point, mouth, taste * taste * (3 - 2 * taste));
    }
    scoop.contact.pose(t, goal);
    foot.pose(goal);
  }

  destroy() {
    this.#restore();
    this.poseHandle.off();
    this.restoreHandle.off();
    for (const foot of this.feet.values()) {
      foot.destroy();
    }
  }
}
