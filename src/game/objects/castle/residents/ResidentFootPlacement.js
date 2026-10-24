/**
 * Adapts authored steps to the actual tread heights. Navigation and Ammo retain
 * ownership of body travel; only the visual leg chains receive contact IK.
 */
export class ResidentFootPlacement {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {Array<{hip: import("playcanvas").Entity, knee: import("playcanvas").Entity, ankle: import("playcanvas").Entity, offset: number}>}
   */
  #feet = [];
  /**
   * @type {Map<import("playcanvas").Entity, import("playcanvas").Quat>}
   */
  #saved = new Map();

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} root
   * @param {import("playcanvas").Entity} model
   */
  constructor(pc, root, model) {
    this.#pc = pc;
    this.#root = root;
    for (const side of ["left", "right"]) {
      const hip = model.findByName(`Royal ${side} leg rig`);
      const knee = model.findByName(`Servant ${side} knee`);
      const ankle = model.findByName(`mixamorig:${side === "left" ? "Left" : "Right"}Foot`);
      if (hip && knee && ankle) {
        this.#feet.push({
          hip,
          knee,
          ankle,
          offset: ankle.getPosition().y - root.getPosition().y,
        });
      }
    }
  }

  restore() {
    for (const [node, rotation] of this.#saved) {
      node.setLocalRotation(rotation);
    }
    this.#saved.clear();
  }

  /**
   * @param {(x: number, z: number, elevation: number) => number|null} surfaceHeight
   */
  apply(surfaceHeight) {
    const { Vec3 } = this.#pc;
    const root = this.#root.getPosition();
    const scale = this.#root.getWorldTransform().getScale().y;
    for (const { hip, knee, ankle, offset } of this.#feet) {
      const foot = ankle.getPosition().clone();
      const height = surfaceHeight(foot.x, foot.z, root.y);
      if (!Number.isFinite(height)) {
        continue;
      }
      const soleOffset = offset * scale;
      const lift = Math.max(0, foot.y - root.y - soleOffset);
      const target = foot.clone();
      target.y = height + soleOffset + lift;
      const rotation = ankle.getRotation().clone();
      const origin = hip.getPosition().clone();
      const upper = origin.distance(knee.getPosition());
      const lower = knee.getPosition().distance(foot);
      const delta = new Vec3().sub2(target, origin);
      const distance = Math.max(Math.abs(upper - lower) + 0.0001,
        Math.min(upper + lower - 0.0001, delta.length()));
      const direction = delta.normalize();
      const along = (upper * upper + distance * distance - lower * lower) / (2 * distance);
      const pole = this.#root.getRotation().transformVector(new Vec3(0, 0, 1));
      const bend = pole.clone().sub(direction.clone().mulScalar(pole.dot(direction))).normalize();
      const joint = origin.clone().add(direction.clone().mulScalar(along))
        .add(bend.mulScalar(Math.sqrt(Math.max(0, upper * upper - along * along))));
      this.#aim(hip, knee, joint);
      this.#aim(knee, ankle, origin.add(direction.mulScalar(distance)));
      this.#remember(ankle);
      ankle.setRotation(rotation);
    }
  }

  /**
   * @param {import("playcanvas").Entity} node
   */
  #remember(node) {
    if (!this.#saved.has(node)) {
      this.#saved.set(node, node.getLocalRotation().clone());
    }
  }

  /**
   * @param {import("playcanvas").Entity} node
   * @param {import("playcanvas").Entity} child
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
