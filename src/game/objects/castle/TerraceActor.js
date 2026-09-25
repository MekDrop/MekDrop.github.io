import { TERRACE_ACTOR_ANIMATION } from "../../enum/TerraceActorAnimation.js";

const LOOPING_ANIMATIONS = new Set([
  TERRACE_ACTOR_ANIMATION.IDLE,
  TERRACE_ACTOR_ANIMATION.WALK,
  TERRACE_ACTOR_ANIMATION.CARRY,
  TERRACE_ACTOR_ANIMATION.DRINK,
  TERRACE_ACTOR_ANIMATION.RECLINE,
  TERRACE_ACTOR_ANIMATION.READ,
]);

/** Low-level model/animation adapter; role objects own choreography and sequences. */
export class TerraceActor {
  #entity;
  #body;
  #model;
  #kind;
  #joints = new Map();
  #height = 2.2;
  #rightHand;
  #leftHand;
  #animationLayer;
  #animationName;
  #animationDurations = new Map();

  constructor({ pc, modelLibrary, modelUrl, kind }) {
    this.#kind = kind;
    this.#entity = new pc.Entity(`Terrace ${kind}`);
    this.#body = new pc.Entity("Terrace posture");
    this.#model = modelLibrary.instantiate(modelUrl);
    this.#entity.addChild(this.#body);
    this.#body.addChild(this.#model);

    // Terrace clones deliberately do not play the throne's WalkOut/Cry tracks.
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
    }
    this.#rightHand = this.#model.findByName("Royal right hand");
    this.#leftHand = this.#model.findByName("Royal left hand");
    this.#normalize();
    if (kind !== "king" && typeof modelLibrary.getAnimationTracks === "function") {
      this.#setupAnimations(modelLibrary, modelUrl);
      this.pose("idle", 0);
    }
  }

  get entity() {
    return this.#entity;
  }

  get model() {
    return this.#model;
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

  /** Plays model-authored local animation while the scene owns world placement. */
  pose(action, time = 0, blend = 1) {
    if (!this.#animationLayer) {
      return;
    }
    const weight = Math.max(0, Math.min(1, blend));
    switch (action) {
      case "turn":
        this.#sampleProgress(TERRACE_ACTOR_ANIMATION.TURN, time);
        break;
      case "walk":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.WALK, time);
        break;
      case "carry":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.CARRY, time);
        break;
      case "place":
        this.#sampleTime(TERRACE_ACTOR_ANIMATION.PLACE, time);
        break;
      case "closeDoor":
        this.#sampleTime(TERRACE_ACTOR_ANIMATION.CLOSE_DOOR, time);
        break;
      case "pour":
        this.#sampleTime(TERRACE_ACTOR_ANIMATION.POUR, time);
        break;
      case "sit":
        this.#sampleProgress(TERRACE_ACTOR_ANIMATION.SIT, weight);
        break;
      case "drink":
        if (weight < 1) {
          this.#sampleProgress(TERRACE_ACTOR_ANIMATION.SIT, weight);
        } else {
          this.#sampleLoop(TERRACE_ACTOR_ANIMATION.DRINK, time);
        }
        break;
      case "mountSunbed":
        this.#sampleProgress(TERRACE_ACTOR_ANIMATION.MOUNT_SUNBED, time);
        break;
      case "recline":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.RECLINE, time);
        break;
      case "read":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.READ, time);
        break;
      default:
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.IDLE, time);
    }
  }

  evaluatePose() {
    this.#model.anim?.update(0);
  }

  destroy() {
    this.#entity.destroy();
    this.#joints.clear();
    this.#animationDurations.clear();
    this.#animationLayer = null;
  }

  #setupAnimations(modelLibrary, modelUrl) {
    const names = this.#animationNames;
    const tracks = modelLibrary.getAnimationTracks(modelUrl, names);
    for (const name of [TERRACE_ACTOR_ANIMATION.CLOSE_DOOR, TERRACE_ACTOR_ANIMATION.TURN]) {
      if (tracks.has(name)) {
        names.push(name);
      }
    }
    this.#model.addComponent("anim", { activate: true });
    for (const name of names) {
      const track = tracks.get(name);
      this.#animationDurations.set(name, track.duration);
      this.#model.anim.addAnimationState(
        name,
        track,
        1,
        LOOPING_ANIMATIONS.has(name),
      );
    }
    this.#animationLayer = this.#model.anim.baseLayer;
  }

  get #animationNames() {
    switch (this.#kind) {
      case "queen":
        return [
          TERRACE_ACTOR_ANIMATION.IDLE,
          TERRACE_ACTOR_ANIMATION.WALK,
          TERRACE_ACTOR_ANIMATION.MOUNT_SUNBED,
          TERRACE_ACTOR_ANIMATION.RECLINE,
          TERRACE_ACTOR_ANIMATION.READ,
        ];
      case "princess":
        return [
          TERRACE_ACTOR_ANIMATION.IDLE,
          TERRACE_ACTOR_ANIMATION.WALK,
          TERRACE_ACTOR_ANIMATION.SIT,
          TERRACE_ACTOR_ANIMATION.DRINK,
        ];
      default:
        return [
          TERRACE_ACTOR_ANIMATION.IDLE,
          TERRACE_ACTOR_ANIMATION.WALK,
          TERRACE_ACTOR_ANIMATION.CARRY,
          TERRACE_ACTOR_ANIMATION.PLACE,
          TERRACE_ACTOR_ANIMATION.POUR,
        ];
    }
  }

  #sampleLoop(name, time) {
    const duration = this.#animationDurations.get(name);
    if (!duration) {
      return;
    }
    const elapsed = ((time % duration) + duration) % duration;
    this.#sampleTime(name, elapsed);
  }

  #sampleProgress(name, progress) {
    const duration = this.#animationDurations.get(name);
    if (!duration) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, progress));
    this.#sampleTime(name, duration * clamped);
  }

  #sampleTime(name, time) {
    const duration = this.#animationDurations.get(name);
    if (!duration) {
      return;
    }
    if (this.#animationName !== name) {
      this.#animationLayer.play(name);
      this.#animationName = name;
    }
    this.#model.anim.speed = 0;
    this.#animationLayer.activeStateCurrentTime = Math.max(
      0,
      Math.min(duration, time),
    );
  }

  #normalize() {
    let bottom = Number.POSITIVE_INFINITY;
    let top = Number.NEGATIVE_INFINITY;
    for (const render of this.#model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
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
