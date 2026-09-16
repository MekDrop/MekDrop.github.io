/** A small terrace performer, with +Z forward and its standing feet at Y=0. */
export class TerraceActor {
  #entity;
  #body;
  #model;
  #kind;
  #joints = new Map();
  #rest = new Map();
  #height = 2.2;
  #rightHand;
  #leftHand;
  #rotation;
  #blendedRotation;

  constructor({ pc, modelLibrary, modelUrl, kind }) {
    this.#kind = kind;
    this.#entity = new pc.Entity(`Terrace ${kind}`);
    this.#body = new pc.Entity("Terrace posture");
    this.#model = modelLibrary.instantiate(modelUrl);
    this.#entity.addChild(this.#body);
    this.#body.addChild(this.#model);
    this.#rotation = new pc.Quat();
    this.#blendedRotation = new pc.Quat();

    // These clones deliberately do not play the throne's WalkOut/Cry tracks.
    for (const component of this.#model.findComponents("anim")) {
      component.enabled = false;
    }
    for (const name of [
      "Royal tear left",
      "Royal tear right",
      "Princess handkerchief grip",
    ]) {
      const node = this.#model.findByName(name);
      if (node) {
        node.enabled = false;
      }
    }

    const jointNames = [
      ["body", "Royal animation rig"],
      ["head", "Royal head rig"],
      ["leftArm", "Royal left arm rig"],
      ["rightArm", "Royal right arm rig"],
      ["leftLeg", "Royal left leg rig"],
      ["rightLeg", "Royal right leg rig"],
      ["leftHand", "Royal left hand"],
      ["leftElbow", "Princess left elbow", "Servant left elbow"],
      ["rightElbow", "Princess right elbow", "Servant right elbow"],
      ["leftWrist", "Princess left wrist", "Servant left wrist"],
      ["rightWrist", "Princess right wrist", "Servant right wrist"],
    ];
    for (const [key, ...names] of jointNames) {
      const node = names.map((name) => this.#model.findByName(name)).find(Boolean);
      if (!node) {
        continue;
      }
      this.#joints.set(key, node);
      this.#rest.set(key, {
        position: node.getLocalPosition().clone(),
        rotation: node.getLocalRotation().clone(),
      });
    }
    this.#rightHand = this.#model.findByName("Royal right hand");
    this.#leftHand = this.#model.findByName("Royal left hand");
    this.pose("idle", 0);
    this.#normalize();
  }

  get entity() {
    return this.#entity;
  }

  get rightHand() {
    return this.#rightHand;
  }

  get leftHand() {
    return this.#leftHand;
  }

  get height() {
    return this.#height;
  }

  /**
   * Time is seconds within the action. Blend interpolates from standing idle
   * to this pose, allowing the scene to ease sitting down and standing up.
   * The outer entity's placement, rotation and scale remain owned by the scene.
   */
  pose(action, time = 0, blend = 1) {
    const weight = Math.max(0, Math.min(1, blend));
    const previous = new Map();
    // The princess file can be saved on a crying frame. Neutralize the complete
    // articulated chain, rather than rotating her already folded crying arms.
    for (const [key, node] of this.#joints) {
      node.setLocalPosition(this.#rest.get(key).position);
      node.setLocalEulerAngles(0, 0, 0);
    }
    this.#rotate("leftArm", -8, 0, -7);
    this.#rotate("rightArm", -8, 0, 7);
    this.#rotate("leftElbow", -14, 0, 0);
    this.#rotate("rightElbow", -14, 0, 0);
    this.#rotate("head", 0, Math.sin(time * 0.6) * 3, 0);
    if (this.#kind === "king") {
      this.#rotate("leftHand", 180, 0, 0);
    }

    if (weight < 1) {
      for (const [key, node] of this.#joints) {
        previous.set(key, {
          position: node.getLocalPosition().clone(),
          rotation: node.getLocalRotation().clone(),
        });
      }
    }

    const walking = action === "walk" || action === "carry";
    if (walking) {
      const step = Math.sin(time * 6.5);
      this.#rotate("leftLeg", step * 24, 0, -2);
      this.#rotate("rightLeg", -step * 24, 0, 2);
      this.#rotate("leftArm", -8 - step * 14, 0, -7);
      this.#rotate("rightArm", -8 + step * 14, 0, 7);
      this.#offset("body", 0, Math.abs(step) * 0.025, 0);
      this.#rotate("body", 0, step * 3, step * 1.5);
    }

    if (action === "carry" || action === "pour") {
      this.#rotate("leftArm", -68, 0, -12);
      this.#rotate("rightArm", -68, 0, 12);
      this.#rotate("leftElbow", -12, 0, 0);
      this.#rotate("rightElbow", -12, 0, 0);
      this.#rotate("head", 8, 0, 0);
      if (action === "pour") {
        const tilt = Math.sin(Math.min(1, Math.max(0, time / 2)) * Math.PI);
        this.#rotate("rightArm", -78, -12, 18 + tilt * 22);
        this.#rotate("rightWrist", 0, 0, tilt * 35);
        this.#rotate("body", 5, 0, 0);
      }
    }

    if (action === "place") {
      // A reversible two-second set-down: carry, reach, release, stand upright.
      // Legs stay planted instead of reusing the walking carry cycle.
      const progress = Math.max(0, Math.min(1, time / 2));
      const reach = Math.sin(progress * Math.PI) ** 2;
      const holding = 1 - this.#smooth((progress - 0.6) / 0.4);
      this.#rotate("body", reach * 16, 0, 0);
      this.#rotate("leftArm", -8 - holding * 60 - reach * 12, 0, -7 - holding * 5);
      this.#rotate("rightArm", -8 - holding * 60 - reach * 12, 0, 7 + holding * 5);
      this.#rotate("leftElbow", -14 + holding * 2 + reach * 8, 0, 0);
      this.#rotate("rightElbow", -14 + holding * 2 + reach * 8, 0, 0);
      this.#rotate("head", reach * 10, Math.sin(time * 0.6) * 3 * (1 - holding), 0);
    }

    if (action === "sit" || action === "drink") {
      this.#offset("body", 0, 0.18, 0);
      this.#rotate("leftLeg", -16, 0, -5);
      this.#rotate("rightLeg", -16, 0, 5);
      this.#rotate("leftArm", -32, 0, -9);
      this.#rotate("leftElbow", -50, 0, 0);
      this.#rotate("rightArm", -34, 0, 8);
      this.#rotate("rightElbow", -52, 0, 0);
      if (action === "drink") {
        // A leisurely lift, held sip, and return to the lap every eight seconds.
        const phase = ((time % 8) + 8) % 8;
        const sip = this.#smooth(Math.min(phase / 1.7, (6.4 - phase) / 1.8));
        this.#rotate("rightArm", -34 - sip * 30, -sip * 40, 8 - sip * 23);
        this.#rotate("rightElbow", -52 - sip * 18, 0, 0);
        this.#rotate("rightWrist", 86 * sip, 0, -sip * 12);
        this.#rotate("head", -sip * 7, -sip * 5, 0);
      }
    }

    if (action === "recline" || action === "read") {
      // Tilt around the hip, keeping the seat near its standing hip height.
      this.#rotate("body", -62, 0, 0);
      this.#offset("body", 0, 0.41, 0.57);
      this.#rotate("leftLeg", -20, 0, -3);
      this.#rotate("rightLeg", -20, 0, 3);
      this.#rotate("head", 23, Math.sin(time * 0.4) * 3, 0);
      this.#rotate("leftArm", -66, 0, -17);
      this.#rotate("rightArm", -66, 0, 17);
      this.#rotate("leftElbow", -20, 0, 0);
      this.#rotate("rightElbow", -20, 0, 0);
      if (action === "read") {
        const page = Math.max(0, Math.sin(time * 0.45)) ** 12;
        this.#rotate("rightArm", -66 - page * 12, -page * 18, 17 - page * 13);
        this.#rotate("head", 23 + Math.sin(time * 0.8) * 2, 0, 0);
      }
    }

    if (action === "sword") {
      this.#swordPose(time);
    }

    if (weight < 1) {
      for (const [key, node] of this.#joints) {
        const start = previous.get(key);
        const end = node.getLocalPosition();
        node.setLocalPosition(
          start.position.x + (end.x - start.position.x) * weight,
          start.position.y + (end.y - start.position.y) * weight,
          start.position.z + (end.z - start.position.z) * weight,
        );
        this.#blendedRotation.slerp(start.rotation, node.getLocalRotation(), weight);
        node.setLocalRotation(this.#blendedRotation);
      }
    }
  }

  destroy() {
    this.#entity.destroy();
    this.#joints.clear();
    this.#rest.clear();
  }

  #swordPose(time) {
    // Deliberately theatrical: low sweeping lunge, crane balance, overhead arc.
    // The authored sword is already parented to the king's left hand.
    const phase = time * 0.52;
    const sweep = Math.sin(phase);
    const crane = this.#smooth((Math.sin(phase - 0.8) - 0.25) / 0.65);
    this.#rotate("body", 8 - crane * 10, sweep * 29, Math.cos(phase) * 8);
    this.#offset("body", sweep * 0.07, -0.06 * (1 - crane), 0);
    this.#rotate("leftArm", -45 + Math.sin(phase + 0.7) * 25, sweep * 10, -85 + Math.cos(phase) * 12);
    // An outward grip keeps the blade beyond the cape throughout the sweep.
    this.#rotate("leftHand", 0, 0, 0);
    this.#rotate("rightArm", -30 - crane * 73, -sweep * 24, 53 + sweep * 32);
    this.#rotate("leftLeg", -10 + sweep * 16, 0, -15 * (1 - crane));
    this.#rotate("rightLeg", -12 - crane * 79, 0, 15 + crane * 18);
    this.#rotate("head", -4, -sweep * 23, -Math.cos(phase) * 6);
  }

  #rotate(key, x, y, z) {
    const node = this.#joints.get(key);
    if (node) {
      this.#rotation.setFromEulerAngles(x, y, z);
      node.setLocalRotation(this.#rotation);
    }
  }

  #offset(key, x, y, z) {
    const node = this.#joints.get(key);
    const rest = this.#rest.get(key)?.position;
    if (node && rest) {
      node.setLocalPosition(rest.x + x, rest.y + y, rest.z + z);
    }
  }

  #smooth(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  }

  #normalize() {
    let bottom = Number.POSITIVE_INFINITY;
    let top = Number.NEGATIVE_INFINITY;
    for (const render of this.#model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        // The blade projects below a hand; it is not a character's foot.
        if (/sword|tear|handkerchief/i.test(mesh.node.name)) {
          continue;
        }
        const bounds = mesh.aabb;
        bottom = Math.min(bottom, bounds.center.y - bounds.halfExtents.y);
        top = Math.max(top, bounds.center.y + bounds.halfExtents.y);
      }
    }
    if (!Number.isFinite(bottom) || top - bottom < 0.01) {
      return;
    }
    const scale = this.#height / (top - bottom);
    this.#body.setLocalScale(scale, scale, scale);
    this.#body.setLocalPosition(0, -bottom * scale, 0);
  }
}
