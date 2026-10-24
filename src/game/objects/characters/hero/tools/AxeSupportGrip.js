import { Quat, Vec3 } from "playcanvas";

/**
 * Maintains the authored support contact when two axe poses are blended.
 */
export class AxeSupportGrip {
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #arm;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #elbow;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #hand;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #rightHand;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #rightArm;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #rightElbow;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #stanceFrame;

  /**
   * @param {import("playcanvas").Entity} root
   */
  constructor(root) {
    while (root.parent && !root.findByName("Left arm")) {
      root = root.parent;
    }
    this.#arm = root.findByName("Left arm");
    this.#elbow = root.findByName("Left elbow");
    this.#hand = root.findByName("Left white glove");
    this.#rightHand = root.findByName("Right white glove");
    this.#rightArm = root.findByName("Right arm");
    this.#rightElbow = root.findByName("Right elbow");
    this.#stanceFrame = this.#arm;
    while (this.#stanceFrame?.parent && !this.#stanceFrame.anim) {
      this.#stanceFrame = this.#stanceFrame.parent;
    }
  }

  /**
   * @param {import("playcanvas").Entity} tool
   * @param {boolean} [attachSupport]
   * @param {number} [stanceClearance]
   */
  update(tool, attachSupport = true, stanceClearance = 0) {
    const head = tool.findByName("Axe head");
    if (!head) {
      return;
    }
    const scale = tool.getWorldTransform().getScale().x;
    const direction = head.getPosition().clone().sub(tool.getPosition()).normalize();
    if (this.#rightHand) {
      const palm = this.#rightHand.getWorldTransform().transformPoint(new Vec3(0, -0.08, 0.095));
      palm.sub(direction.clone().mulScalar(0.08 * scale));
      tool.setPosition(palm.x, palm.y, palm.z);
    }
    if (stanceClearance > 0 && this.#stanceFrame) {
      const clearance = this.#stanceFrame.getWorldTransform().transformVector(new Vec3(1, 0, 0));
      clearance.y = 0;
      this.#moveGrip(tool, clearance.normalize().mulScalar(stanceClearance));
    }
    if (!attachSupport || !this.#arm || !this.#elbow || !this.#hand) {
      return;
    }
    const palm = tool.getPosition().clone().add(direction.clone().mulScalar(-0.06 * scale));
    const handRotation = this.#hand.getRotation().clone();
    const handAxis = handRotation.transformVector(new Vec3(-1, 0, 0));
    const goalRotation = new Quat().mul2(new Quat().setFromDirections(handAxis, direction), handRotation);
    const target = palm.sub(goalRotation.transformVector(new Vec3(0, -0.08, 0.095).mulScalar(scale)));
    const base = this.#arm.getPosition().clone();
    const reach = this.#elbow.getPosition().distance(base)
      + this.#hand.getPosition().distance(this.#elbow.getPosition()) - 0.001;
    const toward = target.clone().sub(base);
    if (toward.length() > reach && this.#rightArm && this.#rightElbow && this.#rightHand) {
      const shift = toward.clone().normalize().mulScalar(reach).sub(toward);
      this.#moveGrip(tool, shift);
      target.add(shift);
    }
    AxeSupportGrip.#solve(this.#arm, this.#elbow, this.#hand, target, goalRotation);
  }

  /**
   * Keep both grips attached when a blended stance needs extra clearance.
   * @param {import("playcanvas").Entity} tool
   * @param {Vec3} shift
   */
  #moveGrip(tool, shift) {
    if (!this.#rightArm || !this.#rightElbow || !this.#rightHand) {
      return;
    }
    const position = tool.getPosition().clone().add(shift);
    const rotation = tool.getRotation().clone();
    const rightRotation = this.#rightHand.getRotation().clone();
    const wrist = this.#rightHand.getPosition().clone().add(shift);
    AxeSupportGrip.#solve(this.#rightArm, this.#rightElbow, this.#rightHand, wrist, rightRotation);
    tool.setPosition(position.x, position.y, position.z);
    tool.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  /**
   * @param {import("playcanvas").Entity} arm
   * @param {import("playcanvas").Entity} elbow
   * @param {import("playcanvas").Entity} hand
   * @param {Vec3} target
   * @param {Quat} goalRotation
   */
  static #solve(arm, elbow, hand, target, goalRotation) {
    const base = arm.getPosition().clone();
    const upper = elbow.getPosition().clone().sub(base);
    const lower = hand.getPosition().clone().sub(elbow.getPosition());
    const axis = target.clone().sub(base);
    const length = Math.min(axis.length(), upper.length() + lower.length() - 0.00001);
    axis.normalize();
    const along = (upper.lengthSq() - lower.lengthSq() + length * length) / (2 * length);
    let pole = upper.clone().sub(axis.clone().mulScalar(upper.dot(axis)));
    if (pole.lengthSq() < 0.000001) {
      pole = new Vec3(0, -1, 0).sub(axis.clone().mulScalar(-axis.y));
    }
    pole.normalize();
    const joint = base.add(axis.mulScalar(along))
      .add(pole.mulScalar(Math.sqrt(Math.max(0, upper.lengthSq() - along * along))));
    AxeSupportGrip.#aim(arm, elbow, joint);
    AxeSupportGrip.#aim(elbow, hand, target);
    hand.setRotation(goalRotation.x, goalRotation.y, goalRotation.z, goalRotation.w);
  }

  /**
   * @param {import("playcanvas").Entity} joint
   * @param {import("playcanvas").Entity} child
   * @param {Vec3} target
   */
  static #aim(joint, child, target) {
    const position = joint.getPosition();
    const before = child.getPosition().clone().sub(position).normalize();
    const after = target.clone().sub(position).normalize();
    const correction = new Quat().setFromDirections(before, after);
    const rotation = new Quat().mul2(correction, joint.getRotation());
    joint.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}
