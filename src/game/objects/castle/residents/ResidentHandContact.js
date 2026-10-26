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
   * @type {Map<import("playcanvas").GraphNode, import("playcanvas").Vec3>}
   */
  #sockets = new Map();
  /**
   * @type {Map<import("playcanvas").GraphNode, import("playcanvas").Quat>}
   */
  #fingerRest = new Map();

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} model
   */
  constructor(pc, model) {
    this.#pc = pc;
    this.#model = model;
    for (const node of model.find(ResidentHandContact.#isFinger)) {
      this.#fingerRest.set(node, node.getLocalRotation().clone());
    }
  }

  restore() {
    for (const [node, rotation] of this.#saved) {
      node.setLocalRotation(rotation);
    }
    this.#saved.clear();
    for (const [node, position] of this.#sockets) {
      node.setLocalPosition(position);
    }
    this.#sockets.clear();
  }

  /**
   * Fit a grasp to the scaled rail thickness and attach at the space enclosed
   * by the fingers and opposing thumb, rather than at the heel of the palm.
   * @param {string} side
   * @param {number} radius World-space radius of the gripped rim or handle.
   */
  grasp(side, radius) {
    const { Vec3, Quat } = this.#pc;
    const prefix = `mixamorig:${side === "left" ? "Left" : "Right"}Hand`;
    const middle = this.#model.findByName(prefix + "Middle2");
    const tip = this.#model.findByName(prefix + "Middle3");
    const thumb = this.#model.findByName(prefix + "Thumb3");
    const socket = this.#model.findByName(`Servant ${side} grip`);
    if (!middle || !tip || !thumb || !socket) {
      return;
    }
    const segment = middle.getPosition().distance(tip.getPosition());
    const curl = Math.max(0.45, Math.min(1.15, segment / Math.max(radius, 0.008)));
    for (const finger of ["Index", "Middle", "Ring", "Pinky", "Thumb"]) {
      for (let joint = 1; joint <= 3; joint++) {
        const node = this.#model.findByName(prefix + finger + joint);
        if (!node) {
          continue;
        }
        this.#remember(node);
        const angle = curl * (finger === "Thumb" ? 0.55 : 1);
        node.setLocalRotation(this.#fingerRest.get(node).clone()
          .mul(new Quat().setFromAxisAngle(Vec3.RIGHT, angle * 180 / Math.PI)));
      }
    }
    if (!this.#sockets.has(socket)) {
      this.#sockets.set(socket, socket.getLocalPosition().clone());
    }
    const center = middle.getPosition().clone().lerp(middle.getPosition(), tip.getPosition(), 0.5);
    center.lerp(center, thumb.getPosition(), 0.5);
    socket.setPosition(center);
  }

  /**
   * @param {import("playcanvas").GraphNode} node
   * @returns {boolean}
   */
  static #isFinger(node) {
    return /mixamorig:(Left|Right)Hand(Index|Middle|Ring|Pinky|Thumb)[123]$/.test(node.name);
  }

  /**
   * @param {string} side
   * @param {import("playcanvas").Vec3} target
   * @param {import("playcanvas").Vec3|null} gripAxis
   */
  apply(side, target, gripAxis = null) {
    const { Vec3 } = this.#pc;
    const shoulder = this.#model.findByName(`Royal ${side} arm rig`);
    const elbow = this.#model.findByName(`Servant ${side} elbow`);
    const wrist = this.#model.findByName(`Royal ${side} hand`);
    const palm = this.#model.findByName(`Servant ${side} grip`);
    if (!shoulder || !elbow || !wrist || !palm) {
      return;
    }
    const rotation = wrist.getRotation().clone();
    if (gripAxis) {
      const finger = this.#model.findByName(`mixamorig:${side === "left" ? "Left" : "Right"}HandMiddle1`);
      const axis = (finger ?? wrist).getRotation().transformVector(Vec3.RIGHT).normalize();
      const desired = gripAxis.clone().normalize();
      if (axis.dot(desired) < 0) {
        desired.mulScalar(-1);
      }
      this.#remember(wrist);
      rotation.copy(new this.#pc.Quat().setFromDirections(axis, desired).mul(rotation));
      wrist.setRotation(rotation);
    }
    const destination = target.clone().sub(palm.getPosition().clone().sub(wrist.getPosition()));
    const upper = shoulder.getPosition().distance(elbow.getPosition());
    const lower = elbow.getPosition().distance(wrist.getPosition());
    const clavicle = shoulder.parent;
    if (clavicle?.name === `mixamorig:${side === "left" ? "Left" : "Right"}Shoulder` &&
      destination.distance(shoulder.getPosition()) > upper + lower - 0.00002) {
      // The authored rig has a clavicle as well as two arm segments. Let the
      // shoulder protract naturally before clamping an otherwise reachable
      // grasp. Bone lengths and the torso/head placement remain unchanged.
      const pivot = clavicle.getPosition().clone();
      const offset = shoulder.getPosition().clone().sub(pivot);
      const from = offset.clone().normalize();
      const to = destination.clone().sub(pivot).normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, from.dot(to)))) * 180 / Math.PI;
      const turn = new this.#pc.Quat().setFromDirections(from, to);
      let low = 0;
      let high = Math.min(1, 25 / Math.max(angle, 0.0001));
      for (let iteration = 0; iteration < 12; iteration++) {
        const middle = (low + high) / 2;
        const rotation = new this.#pc.Quat().slerp(this.#pc.Quat.IDENTITY, turn, middle);
        const candidate = rotation.transformVector(offset).add(pivot);
        if (candidate.distance(destination) > upper + lower - 0.00002) {
          low = middle;
        } else {
          high = middle;
        }
      }
      this.#remember(clavicle);
      clavicle.setRotation(new this.#pc.Quat().slerp(this.#pc.Quat.IDENTITY, turn, high)
        .mul(clavicle.getRotation()));
    }
    const origin = shoulder.getPosition().clone();
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
