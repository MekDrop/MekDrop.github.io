import { TERRACE_ACTOR_ANIMATION } from "../../../../enum/TerraceActorAnimation.js";
import { NpcDoorAvoidance } from "../../../shared/NpcDoorAvoidance.js";
import { ServantHeroClearance } from "../../../shared/ServantHeroClearance.js";
import { ResidentFootPlacement } from "../../residents/ResidentFootPlacement.js";
import { ResidentHandContact } from "../../residents/ResidentHandContact.js";

const LOOPING_ANIMATIONS = new Set([
  TERRACE_ACTOR_ANIMATION.IDLE,
  TERRACE_ACTOR_ANIMATION.WALK,
  TERRACE_ACTOR_ANIMATION.CARRY,
  TERRACE_ACTOR_ANIMATION.STAIR_UP,
  TERRACE_ACTOR_ANIMATION.STAIR_DOWN,
  TERRACE_ACTOR_ANIMATION.CARRY_STAIR_UP,
  TERRACE_ACTOR_ANIMATION.CARRY_STAIR_DOWN,
  TERRACE_ACTOR_ANIMATION.DRINK,
  TERRACE_ACTOR_ANIMATION.RECLINE,
  TERRACE_ACTOR_ANIMATION.READ,
]);

/**
 * Low-level model/animation adapter; role objects own choreography and sequences.
 */
export class TerraceActor {
  /**
   * @type {ResidentHandContact|null}
   */
  #handContact;
  /**
   * @type {ResidentFootPlacement|null}
   */
  #footPlacement = null;
  /**
   * @type {ServantHeroClearance|null}
   */
  #heroClearance = null;
  /**
   * @type {NpcDoorAvoidance}
   */
  #doorAvoidance;
  /**
   * @type {{action: string, time: number, blend: number}}
   */
  #authoredPose = {
    action: "idle",
    time: 0,
    blend: 1,
  };
  /**
   * @type {boolean}
   */
  #applyingDoorPose = false;
  /**
   *
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
   * @type {import("playcanvas").Entity}
   */
  #body;
  /**
   *
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   *
   * @type {string}
   */
  #kind;
  /**
   *
   * @type {Map<string, import("playcanvas").Entity>}
   */
  #joints = new Map();
  /**
   *
   * @type {number}
   */
  #height = 2.2;
  /**
   *
   * @type {import("playcanvas").Entity|null}
   */
  #rightHand;
  /**
   *
   * @type {import("playcanvas").Entity|null}
   */
  #leftHand;
  /**
   *
   * @type {import("playcanvas").AnimController|null}
   */
  #animationLayer;
  /**
   *
   * @type {string}
   */
  #animationName;
  /**
   *
   * @type {Map<string, number>}
   */
  #animationDurations = new Map();

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, modelUrl: string, kind: string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {string} options.modelUrl
   * @param {string} options.kind
   */
  constructor({ pc, modelLibrary, modelUrl, kind }) {
    this.#kind = kind;
    this.#entity = new pc.Entity(`Terrace ${kind}`);
    this.#body = new pc.Entity("Terrace posture");
    this.#model = modelLibrary.instantiate(modelUrl);
    const avoidanceRoot = new pc.Entity("NPC doorway reaction");
    this.#entity.addChild(avoidanceRoot);
    avoidanceRoot.addChild(this.#body);
    this.#body.addChild(this.#model);

    // The role controller chooses the current animation on this resident model.
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
      const node = names.map(this.#mapName.bind(this)).find(Boolean);
      if (!node) {
        continue;
      }
      this.#joints.set(key, node);
    }
    this.#rightHand = this.#model.findByName("Servant right grip") ??
      this.#model.findByName("Royal right hand");
    this.#leftHand = this.#model.findByName("Servant left grip") ??
      this.#model.findByName("Royal left hand");
    this.#normalize();
    if (kind === "servant") {
      this.#footPlacement = new ResidentFootPlacement(pc, this.#entity, this.#model);
      this.#handContact = new ResidentHandContact(pc, this.#model);
    }
    if (kind !== "king" && typeof modelLibrary.getAnimationTracks === "function") {
      this.#setupAnimations(modelLibrary, modelUrl);
      this.pose("idle", 0);
    }
    this.#doorAvoidance = new NpcDoorAvoidance(
      avoidanceRoot,
      pc.Application?.getApplication(),
      this.#NpcDoorAvoidance.bind(this),
    );
    const app = pc.Application?.getApplication();
    if (kind === "servant" && app?.systems.rigidbody) {
      this.#heroClearance = new ServantHeroClearance(avoidanceRoot, app);
    }
  }

  get entity() {
    return this.#entity;
  }

  /**
   * @returns {import("../../../shared/NpcStateMachine.js").NpcStateMachine}
   */
  get behavior() {
    return this.#doorAvoidance.behavior;
  }

  /**
   * @param {import("../../../shared/NpcStateMachine.js").NpcStateMachine} behavior
   */
  set behavior(behavior) {
    this.#doorAvoidance.behavior = behavior;
  }

  get model() {
    return this.#model;
  }

  /**
   * Resume navigation at a safe doorway sidestep without moving the visible body.
   * @returns {boolean}
   */
  settleNavigationOffset() {
    const reactionRoot = this.#body.parent;
    if (this.behavior.reacting && !this.#doorAvoidance.resumeFromSafePosition()) {
      return false;
    }
    if (reactionRoot.getLocalPosition().lengthSq() < 0.000001) {
      return false;
    }
    const position = reactionRoot.getPosition().clone();
    this.#entity.setPosition(position);
    reactionRoot.setLocalPosition(0, 0, 0);

    return true;
  }

  get rightHand() {
    return this.#rightHand;
  }

  get leftHand() {
    return this.#leftHand;
  }

  /**
   *
   * @returns {import("playcanvas").Entity|undefined}
   */
  get head() {
    return this.#joints.get("head");
  }

  get height() {
    return this.#height;
  }

  /**
   * @returns {boolean}
   */
  get supportsStairAnimation() {
    return this.#animationDurations.has(TERRACE_ACTOR_ANIMATION.STAIR_UP);
  }

  /**
   * @returns {number}
   */
  get locomotionStride() {
    return this.supportsStairAnimation
      ? (5 / 6) * this.#body.getWorldTransform().getScale().y
      : 1.2;
  }

  /**
   * Plays model-authored local animation while the scene owns world placement.
   *
   * @param {string} action
   * @param {number} [time=0]
   * @param {number} [blend=1]
   */
  pose(action, time = 0, blend = 1) {
    this.#handContact?.restore();
    this.#footPlacement?.restore();
    if (!this.#applyingDoorPose) {
      this.#authoredPose = {
        action,
        time,
        blend,
      };
    }
    if (!this.#animationLayer) {
      return;
    }
    const weight = Math.max(0, Math.min(1, blend));
    switch (action) {
      case "stairUp":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.STAIR_UP, time);
        break;
      case "stairDown":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.STAIR_DOWN, time);
        break;
      case "carryStairUp":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.CARRY_STAIR_UP, time);
        break;
      case "carryStairDown":
        this.#sampleLoop(TERRACE_ACTOR_ANIMATION.CARRY_STAIR_DOWN, time);
        break;
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

  /**
   * @param {string} action
   * @param {number} time
   */
  #applyDoorPose(action, time) {
    this.#applyingDoorPose = true;
    try {
      const pose = action === "resume" ? this.#authoredPose : {
        action,
        time,
        blend: 1,
      };
      this.pose(pose.action, pose.time, pose.blend);
      this.evaluatePose();
    } finally {
      this.#applyingDoorPose = false;
    }
  }

  evaluatePose() {
    this.#model.anim?.update(0);
  }

  /**
   * @param {string} side
   * @param {import("playcanvas").Vec3} target
   */
  alignHand(side, target) {
    this.#handContact?.apply(side, target);
  }

  resetHandContacts() {
    this.#handContact?.restore();
  }

  /**
   * @param {(x: number, z: number, elevation: number) => number|null} surfaceHeight
   */
  alignFeet(surfaceHeight) {
    this.evaluatePose();
    this.#footPlacement?.apply(surfaceHeight);
  }

  destroy() {
    this.#heroClearance?.destroy();
    this.#doorAvoidance.destroy();
    this.#entity.destroy();
    this.#joints.clear();
    this.#animationDurations.clear();
    this.#animationLayer = null;
  }

  /**
   *
   * @param {string} modelLibrary
   * @param {string} modelUrl
   */
  #setupAnimations(modelLibrary, modelUrl) {
    const names = this.#animationNames;
    const tracks = modelLibrary.getAnimationTracks(modelUrl, names);
    for (const name of [TERRACE_ACTOR_ANIMATION.CLOSE_DOOR, TERRACE_ACTOR_ANIMATION.TURN,
      TERRACE_ACTOR_ANIMATION.STAIR_UP, TERRACE_ACTOR_ANIMATION.STAIR_DOWN,
      TERRACE_ACTOR_ANIMATION.CARRY_STAIR_UP, TERRACE_ACTOR_ANIMATION.CARRY_STAIR_DOWN]) {
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

  /**
   *
   * @returns {Array<string>}
   */
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

  /**
   *
   * @param {string} name
   * @param {number} time
   */
  #sampleLoop(name, time) {
    const duration = this.#animationDurations.get(name);
    if (!duration) {
      return;
    }
    const elapsed = ((time % duration) + duration) % duration;
    this.#sampleTime(name, elapsed);
  }

  /**
   *
   * @param {string} name
   * @param {number} progress
   */
  #sampleProgress(name, progress) {
    const duration = this.#animationDurations.get(name);
    if (!duration) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, progress));
    this.#sampleTime(name, duration * clamped);
  }

  /**
   *
   * @param {string} name
   * @param {number} time
   */
  #sampleTime(name, time) {
    const duration = this.#animationDurations.get(name);
    if (!duration) {
      return;
    }
    if (this.#animationName !== name || this.#animationLayer.activeState !== name) {
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

  /**
   *
   * @param {string} name
   */
  #mapName(name) {
    return this.#model.findByName(name);
  }

  /**
   * @param {string} action
   * @param {number} time
   */
  #NpcDoorAvoidance(action, time) {
    return this.#applyDoorPose(action, time);
  }
}
