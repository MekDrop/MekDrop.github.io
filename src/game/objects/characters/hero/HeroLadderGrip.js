/**
 * @param {number} value
 * @returns {number}
 */
function smoothHandReach(value) {
  const t = Math.max(0, Math.min(1, value));

  return t * t * (3 - 2 * t);
}

/**
 * Release in place, clear the plank, reach, then close on the next handhold.
 * @param {number} amount
 * @returns {{lift:number,withdraw:number,open:number}}
 */
export function ladderHandReach(amount) {
  const release = smoothHandReach(amount / 0.2);
  const close = smoothHandReach((amount - 0.8) / 0.2);

  return {
    lift: smoothHandReach((amount - 0.2) / 0.6),
    withdraw: release * (1 - close),
    open: release * (1 - close),
  };
}

/**
 * Contact correction for map-scaled rungs. Ammo owns body travel; these two-bone
 * visual adjustments keep hands and boot soles on their current rungs.
 */
export class HeroLadderGrip {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {Map<import("playcanvas").Entity, import("playcanvas").Quat>}
   */
  #saved = new Map();
  /**
   * @type {Map<import("playcanvas").Entity, import("playcanvas").Quat>}
   */
  #lastPose = new Map();
  /**
   * @type {number}
   */
  #weight = 0;
  /**
   * @type {Map<string, number>}
   */
  #contactPhases = new Map();
  /**
   * @type {number}
   */
  #travelDirection = 1;

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#weight > 0;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} root
   */
  constructor(pc, root) {
    this.#pc = pc;
    this.#root = root;
  }

  restore() {
    for (const [node, rotation] of this.#saved) {
      node.setLocalRotation(rotation);
    }
    this.#saved.clear();
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

  /**
   * Solve a visual limb with fixed bone lengths; Ammo owns body travel.
   * @param {import("playcanvas").Entity} start
   * @param {import("playcanvas").Entity} joint
   * @param {import("playcanvas").Entity} end
   * @param {import("playcanvas").Vec3} target
   * @param {import("playcanvas").Vec3} pole
   */
  #poseLimb(start, joint, end, target, pole) {
    const { Vec3 } = this.#pc;
    const origin = start.getPosition().clone();
    const upper = origin.distance(joint.getPosition());
    const lower = joint.getPosition().distance(end.getPosition());
    const delta = new Vec3().sub2(target, origin);
    const distance = Math.min(upper + lower - 0.0001, Math.max(Math.abs(upper - lower) + 0.0001, delta.length()));
    const direction = delta.normalize();
    const along = (upper * upper + distance * distance - lower * lower) / (2 * distance);
    const bend = pole.clone().sub(direction.clone().mulScalar(pole.dot(direction))).normalize();
    const desiredJoint = origin.clone().add(direction.clone().mulScalar(along))
      .add(bend.mulScalar(Math.sqrt(Math.max(0, upper * upper - along * along))));
    this.#aim(start, joint, desiredJoint);
    this.#aim(joint, end, origin.add(direction.mulScalar(distance)));
  }

  /**
   * Finish a reach when paused and retain that contact as body travel resumes.
   * @param {string} name
   * @param {number} bodyPhase
   * @param {boolean} moving
   * @param {number} deltaTime
   * @returns {number}
   */
  #contactPhase(name, bodyPhase, moving, deltaTime) {
    const previous = this.#contactPhases.get(name) ?? bodyPhase;
    let goal = this.#travelDirection > 0 ? Math.max(bodyPhase, previous) : Math.min(bodyPhase, previous);
    if (!moving && goal - Math.floor(goal) > 0.55) {
      goal = this.#travelDirection > 0 ? Math.ceil(goal) : Math.floor(goal) + 0.55;
    }
    const phase = previous + Math.max(-4 * deltaTime, Math.min(4 * deltaTime, goal - previous));
    this.#contactPhases.set(name, phase);

    return phase;
  }

  /**
   * @param {import("../../architecture/ladder/Ladder.js").Ladder} ladder
   * @param {{x:number,y:number,z:number}} position
   * @param {boolean} moving
   * @param {number} deltaTime
   */
  #poseFeet(ladder, position, moving, deltaTime) {
    if (!ladder.foothold) {
      return;
    }
    const { Vec3, Quat } = this.#pc;
    const first = ladder.foothold(0, 0);
    const spacing = ladder.foothold(1, 0).y - first.y;
    const facing = ladder.climbFacing;
    const yaw = Math.atan2(facing.x, facing.z) * 180 / Math.PI;
    for (const [name, side, offset, suffix] of [["Left", -1, 0.25, ""], ["Right", 1, 0.75, ".001"]]) {
      const hip = this.#root.findByName(`${name} leg`);
      const knee = this.#root.findByName(`${name} knee`);
      const ankle = this.#root.findByName(`${name} ankle`);
      const sole = this.#root.findByName(`Boot sole${suffix}`);
      const bounds = sole?.render?.meshInstances?.[0]?.mesh?.aabb;
      if (!hip || !knee || !ankle || !bounds) {
        continue;
      }
      const phase = this.#contactPhase(`${name} foot`, (position.y + 0.14 - first.y) / spacing + offset, moving, deltaTime);
      const index = Math.floor(phase);
      const swing = Math.max(0, Math.min(1, (phase - index - 0.55) / 0.45));
      const lift = smoothHandReach(swing);
      const target = ladder.foothold(index, side).lerp(ladder.foothold(index, side), ladder.foothold(index + 1, side), lift);
      // Lift off the plank and draw the toe clear before stepping to the next.
      const clearance = Math.sin(Math.PI * swing);
      target.add(new Vec3(-facing.x * 0.1, 0.045, -facing.z * 0.1).mulScalar(clearance));
      this.#remember(ankle);
      const rotation = new Quat().setFromEulerAngles(0, yaw, 0);
      ankle.setRotation(rotation);
      const ball = new Vec3(bounds.center.x, bounds.center.y - bounds.halfExtents.y,
        bounds.center.z + bounds.halfExtents.z * 0.45);
      const soleOffset = sole.getWorldTransform().transformPoint(ball).sub(ankle.getPosition());
      this.#poseLimb(hip, knee, ankle, target.sub(soleOffset), new Vec3(facing.x, 0.1, facing.z));
      ankle.setRotation(rotation);
    }
  }

  /**
   * @param {{ladder: import("../../architecture/ladder/Ladder.js").Ladder, transferring: boolean, topProgress?: number, gripBlend?:number, velocity?:{y:number}}|null} motion
   * @param {{x:number,y:number,z:number}} position
   * @param {number} deltaTime
   */
  update(motion, position, deltaTime = 1 / 60) {
    if (!motion || motion.transferring || motion.topProgress > 0 || motion.gripBlend === 0 || !motion.ladder.handhold) {
      this.#weight = Math.max(0, this.#weight - deltaTime / 0.12);
      for (const [node, rotation] of this.#lastPose) {
        this.#remember(node);
        node.setLocalRotation(new this.#pc.Quat().slerp(this.#saved.get(node), rotation, this.#weight));
      }
      if (this.#weight === 0) {
        this.#lastPose.clear();
        this.#contactPhases.clear();
      }

      return;
    }
    this.#weight = motion.gripBlend ?? 1;
    const { Vec3, Quat } = this.#pc;
    const ladder = motion.ladder;
    const first = ladder.handhold(0, 0);
    const spacing = ladder.handhold(1, 0).y - first.y;
    const moving = Math.abs(motion.velocity?.y ?? 1) > 0.01;
    if (moving) {
      this.#travelDirection = Math.sign(motion.velocity?.y ?? 1);
    }
    for (const [name, side, offset] of [["Left", -1, 0], ["Right", 1, 0.5]]) {
      const arm = this.#root.findByName(`${name} arm`);
      const elbow = this.#root.findByName(`${name} elbow`);
      const hand = this.#root.findByName(`${name} white glove`);
      if (!arm || !elbow || !hand) {
        continue;
      }
      const bodyPhase = (position.y + 0.62 - first.y) / spacing + offset;
      const phase = this.#contactPhase(name, bodyPhase, moving, deltaTime);
      const index = Math.floor(phase);
      const swing = Math.max(0, Math.min(1, (phase - index - 0.55) / 0.45));
      const reach = ladderHandReach(swing);
      const target = ladder.handhold(index, side).lerp(ladder.handhold(index, side), ladder.handhold(index + 1, side), reach.lift);
      const facing = ladder.climbFacing;
      target.add(new Vec3(-facing.x, 0, -facing.z).mulScalar(0.12 * reach.withdraw));
      this.#poseLimb(arm, elbow, hand, target, new Vec3(side * facing.z, -0.35, -side * facing.x));
      this.#remember(hand);
      const yaw = Math.atan2(facing.x, facing.z) * 180 / Math.PI;
      // Overhand grip: fingers reach toward the wall, with the palm down.
      // Keeping the old upright palm made the hand close beside the rung.
      hand.setRotation(new Quat().setFromEulerAngles(0, yaw, 0)
        .mul(new Quat().setFromEulerAngles(90, 0, 0))
        .mul(new Quat().setFromEulerAngles(0, 0, 180)));
      // Fingers close around the plank during support and release on the reach.
      for (const digit of ["index", "middle", "ring", "little"]) {
        for (let segment = 1; segment <= 3; segment++) {
          const node = this.#root.findByName(`${name} ${digit} ${segment}`);
          if (node) {
            this.#remember(node);
            node.setLocalEulerAngles(-(1 - reach.open * 0.85) * [20, 75, 55][segment - 1], 0, 0);
          }
        }
      }
      for (let segment = 1; segment <= 2; segment++) {
        const thumb = this.#root.findByName(`${name} thumb ${segment}`);
        if (thumb) {
          this.#remember(thumb);
          // Oppose the fingers around the near edge instead of a thumbs-up.
          const closed = segment === 1 ? -70 : -30;
          const open = segment === 1 ? 15 : 10;
          thumb.setLocalEulerAngles(closed + (open - closed) * reach.open, 0, segment === 1 ? -side * 20 : 0);
        }
      }
    }
    this.#poseFeet(ladder, position, moving, deltaTime);
    for (const [node, rotation] of this.#saved) {
      const pose = node.getLocalRotation().clone();
      this.#lastPose.set(node, pose);
      node.setLocalRotation(new Quat().slerp(rotation, pose, this.#weight));
    }
  }
}
