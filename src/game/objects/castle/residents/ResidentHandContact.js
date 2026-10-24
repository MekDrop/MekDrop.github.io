/**
 * Fits the authored arm pose to a moving prop or door handle.
 */
export class ResidentHandContact {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   * @type {Map<import("playcanvas").GraphNode, import("playcanvas").Quat>}
   */
  #saved = new Map();

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} model
   */
  constructor(pc, model) {
    this.#pc = pc;
    this.#model = model;
  }

  restore() {
    for (const [node, rotation] of this.#saved) {
      node.setLocalRotation(rotation);
    }
    this.#saved.clear();
  }

  /**
   * @param {string} side
   * @param {import("playcanvas").Vec3} target
   */
  apply(side, target) {
    const { Vec3 } = this.#pc;
    const shoulder = this.#model.findByName(`Royal ${side} arm rig`);
    const elbow = this.#model.findByName(`Servant ${side} elbow`);
    const wrist = this.#model.findByName(`Royal ${side} hand`);
    const palm = this.#model.findByName(`Servant ${side} grip`);
    if (!shoulder || !elbow || !wrist || !palm) {
      return;
    }
    const rotation = wrist.getRotation().clone();
    const destination = target.clone().sub(palm.getPosition().clone().sub(wrist.getPosition()));
    const origin = shoulder.getPosition().clone();
    const upper = origin.distance(elbow.getPosition());
    const lower = elbow.getPosition().distance(wrist.getPosition());
    const delta = destination.sub(origin);
    const distance = Math.max(Math.abs(upper - lower) + 0.00001,
      Math.min(upper + lower - 0.00001, delta.length()));
    const direction = delta.normalize();
    const along = (upper * upper + distance * distance - lower * lower) / (2 * distance);
    const bend = elbow.getPosition().clone().sub(origin);
    bend.sub(direction.clone().mulScalar(bend.dot(direction)));
    if (bend.lengthSq() < 0.000001) {
      bend.copy(this.#model.getRotation().transformVector(new Vec3(0, 0, -1)));
      bend.sub(direction.clone().mulScalar(bend.dot(direction)));
    }
    bend.normalize();
    const joint = origin.clone().add(direction.clone().mulScalar(along))
      .add(bend.mulScalar(Math.sqrt(Math.max(0, upper * upper - along * along))));
    this.#aim(shoulder, elbow, joint);
    this.#aim(elbow, wrist, origin.add(direction.mulScalar(distance)));
    this.#remember(wrist);
    wrist.setRotation(rotation);
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   */
  #remember(node) {
    if (!this.#saved.has(node)) {
      this.#saved.set(node, node.getLocalRotation().clone());
    }
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   * @param {import("playcanvas").GraphNode} child
   * @param {import("playcanvas").Vec3} target
   */
  #aim(node, child, target) {
    const { Vec3, Quat } = this.#pc;
    this.#remember(node);
    const origin = node.getPosition();
    const from = new Vec3().sub2(child.getPosition(), origin).normalize();
    const to = new Vec3().sub2(target, origin).normalize();
    node.setRotation(new Quat().setFromDirections(from, to).mul(node.getRotation()));
  }
}
