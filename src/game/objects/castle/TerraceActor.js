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
      ["gown", "Panelled bell gown"],
      ["gownTrim", "Royal animation rig - Dynasty antique gold"],
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

  get head() {
    return this.#joints.get("head");
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
      // Fold the bell gown around its waist as the knees move forward. Without
      // this, lowering the hips merely makes the standing dress clip the chair.
      this.#offset("body", 0, -0.075, 0.2);
      this.#rotateAround("gown", -58, 0.75);
      this.#rotateAround("gownTrim", -58, 0.75);
      this.#rotate("leftLeg", -68, 0, -5);
      this.#rotate("rightLeg", -68, 0, 5);
      this.#offset("leftLeg", 0, -0.22, 0.06);
      this.#offset("rightLeg", 0, -0.22, 0.06);
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

    if (action === "mountSunbed") {
      this.#sunbedMountPose(time);
    }

    if (action === "recline" || action === "read") {
      // Match the chaise's forty-degree back while the hips rest on its
      // cushion. Fold the legs farther so they extend along the mattress.
      this.#rotate("body", -40, 0, 0);
      this.#offset("body", 0, -0.1, 0.2);
      this.#rotateAround("gown", -35, 0.75);
      this.#rotateAround("gownTrim", -35, 0.75);
      this.#rotate("leftLeg", -45, 0, -3);
      this.#rotate("rightLeg", -45, 0, 3);
      this.#rotate("head", 18, Math.sin(time * 0.4) * 3, 0);
      this.#rotate("leftArm", -55, 0, -17);
      this.#rotate("rightArm", -55, 0, 17);
      this.#rotate("leftElbow", -35, 0, 0);
      this.#rotate("rightElbow", -35, 0, 0);
      if (action === "read") {
        const page = this.#pageTurn(time);
        this.#rotate("rightArm", -55 - page * 12, -page * 18, 17 - page * 13);
        this.#rotate("head", 18 + Math.sin(time * 0.8) * 2, 0, 0);
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

  #sunbedMountPose(progress) {
    const phase = Math.max(0, Math.min(1, progress));
    const sit = this.#smooth(phase / 0.28);
    const feetUp = this.#smooth((phase - 0.28) / 0.34);
    const recline = this.#smooth((phase - 0.62) / 0.38);
    const raiseBook = this.#smooth((phase - 0.58) / 0.32);
    const seatedBodyY = -0.075 + (-0.1 + 0.075) * feetUp;
    const gownAngle = -58 + 23 * feetUp;
    const legAngle = -68 + 23 * feetUp;

    this.#rotate("body", -40 * recline, 0, 0);
    this.#offset("body", 0, seatedBodyY * sit, 0.2 * sit);
    this.#rotateAround("gown", gownAngle * sit, 0.75);
    this.#rotateAround("gownTrim", gownAngle * sit, 0.75);
    this.#rotate("leftLeg", legAngle * sit, 0, -3 * sit);
    this.#rotate("rightLeg", legAngle * sit, 0, 3 * sit);
    this.#offset("leftLeg", 0, -0.22 * sit * (1 - feetUp),
      0.06 * sit * (1 - feetUp));
    this.#offset("rightLeg", 0, -0.22 * sit * (1 - feetUp),
      0.06 * sit * (1 - feetUp));
    this.#rotate("leftArm", -8 - 47 * raiseBook, 0,
      -7 - 10 * raiseBook);
    this.#rotate("rightArm", -8 - 47 * raiseBook, 0,
      7 + 10 * raiseBook);
    this.#rotate("leftElbow", -14 - 21 * raiseBook, 0, 0);
    this.#rotate("rightElbow", -14 - 21 * raiseBook, 0, 0);
    this.#rotate("head", 18 * recline, 0, 0);
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

  #rotateAround(key, angle, pivotY) {
    const node = this.#joints.get(key);
    const rest = this.#rest.get(key);
    if (!node || !rest) {
      return;
    }
    const radians = angle * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const relativeY = rest.position.y - pivotY;
    const relativeZ = rest.position.z;
    node.setLocalPosition(
      rest.position.x,
      pivotY + relativeY * cosine - relativeZ * sine,
      relativeY * sine + relativeZ * cosine,
    );
    this.#rotation.setFromEulerAngles(angle, 0, 0);
    node.setLocalRotation(this.#rotation);
  }

  #smooth(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  }

  #pageTurn(time) {
    let start = 0;
    for (let index = 0; index < 1000; index += 1) {
      const noise = Math.sin((index + 1) * 12.9898) * 43758.5453;
      start += 5 + 2 * (noise - Math.floor(noise));
      if (time < start) {
        return 0;
      }
      if (time < start + 1.1) {
        return Math.sin(((time - start) / 1.1) * Math.PI) ** 2;
      }
    }
    return 0;
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
