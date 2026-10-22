import { FuseEffects } from "./FuseEffects.js";
import { FuseChecks } from "./FuseChecks.js";
import { FuseAnimationPlayback } from "./FuseAnimationPlayback.js";
import { FusePreview } from "./FusePreview.js";
import { FuseRecoveryState } from "./states/FuseRecoveryState.js";
import { FusePlaybackState } from "./states/FusePlaybackState.js";
import { Enemy } from "../shared/Enemy.js";
import { FusePursuitState } from "./states/FusePursuitState.js";
import { FuseWarningState } from "./states/FuseWarningState.js";
import { FuseStoppedState } from "./states/FuseStoppedState.js";
import { FusePassengerState } from "./states/FusePassengerState.js";
import { FuseTerminalState } from "./states/FuseTerminalState.js";

/**
 * Royal bomber with a Tripo-based mechanical rig and an uninterrupted fuse clock.
 */
export class FuseHopper extends Enemy {
  /**
   * @type {string|null}
   */
  static modelUrl = null;
  /**
   * @type {string}
   */
  reactionClip = "recover";
  /**
   * @type {number}
   */
  reactionDuration = 0.25;
  /**
   * @type {number}
   */
  reactionUntil = 0;
  /**
   * @type {number}
   */
  fuseDuration = 1.1;
  /**
   * @type {number|null}
   */
  fuseRemaining = null;
  /**
   * @type {boolean}
   */
  exploded = false;
  /**
   * @type {number}
   */
  nextHopAt = 0;
  /**
   * @type {number}
   */
  cleanupAt = Infinity;
  /**
   * @type {string|null}
   */
  animationName = null;
  /**
   * @type {{play: (name: string) => void}|null}
   */
  animationPlayer = null;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super({
      ...options,
      definition: {
        ...options.definition,
        maxHealth: options.definition.maxHealth ?? 24,
        height: 0.85,
        radius: 0.27,
      },
    });

    for (const StateClass of [FusePursuitState, FuseWarningState, FuseStoppedState,
      FusePassengerState, FuseTerminalState, FuseRecoveryState, FusePlaybackState]) {
      this.behavior.add(StateClass.name, new StateClass());
    }
    this.behavior.changeTo(FusePursuitState.name);
    if (this.constructor.modelUrl) {
      this.modelRoot = options.modelLibrary.instantiate(this.constructor.modelUrl);
      this.entity.addChild(this.modelRoot);
      const loops = new Set(["idle_bounce", "hop_locomotion_loop", "fuse_loop", "carried_ready", "thrown_tumble", "stun"]);
      this.animationPlayer = new FuseAnimationPlayback(this.modelRoot, options.modelLibrary, this.constructor.modelUrl,
        ["idle_bounce", "hop_compress", "hop_takeoff", "hop_air", "hop_land", "hop_locomotion_loop", "turn", "startled_stop", "recover", "fuse_start", "fuse_loop", "carried_ready", "thrown_tumble", "impact_land", "detonate", "hit", "stun", "stun_recover", "death"].map(/**
         *
         * @param {string} name
         */
          (name) => ({
            name,
            looping: loops.has(name),
          })));
      this.animationName = null;
      this.playClip("idle_bounce");
    }
    if (this.definition.inspectClips) {
      this.testPlayClip("idle_bounce");
    }
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return this.modelUrl ? [this.modelUrl] : [];
  }

  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() {
    return [this.modelRoot ?? this.entity];
  }

  /**
   * @param {string} name
   */
  testPlayClip(name) {
    if (!this.alive || this.carrier || this.airborne) {
      return false;
    }
    this.behavior.changeTo(FusePlaybackState.name);
    this.animationName = null;
    this.playClip(name);
    this.animationPlayer?.play(name, true);

    return true;
  }

  onSceneReady() {
    super.onSceneReady();
    this.effects ??= new FuseEffects(this);
  }

  async testVerifyClips() {
    return new FuseChecks(this).verifyClips();
  }

  async testReset() {
    return this.runtime.replaceObjectDefinition?.(this.definition);
  }

  async testCapturePreview() {
    this.testPlayClip("idle_bounce");

    return FusePreview.capture(this);
  }

  /**
   * @param {string} clip
   * @param {number} duration
   */
  react(clip, duration) {
    this.reactionClip = clip;
    this.reactionDuration = duration;
    this.behavior.changeTo(FuseRecoveryState.name);
  }

  destroy() {
    this.effects?.destroy();
    this.effects = null;
    this.animationPlayer?.destroy();
    super.destroy();
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    const fuse = this.fuseRemaining === null ? "unlit" : this.fuseRemaining.toFixed(2);

    return super.testStatus + " fuse: " + fuse;
  }

  /**
   * @param {string} name
   */
  playClip(name) {
    if (this.animationName !== name) {
      this.animationName = name;
      this.animationPlayer?.play(name);
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    // Advance before Yuka so detonation wins over carry/stun transitions.
    if (this.alive && this.fuseRemaining !== null) {
      this.fuseRemaining = Math.max(0, this.fuseRemaining - dt);
      if (this.fuseRemaining === 0) {
        this.detonate();
      }
    }
    super.update(dt);
    this.effects?.update();
  }

  /**
   * Ignition is idempotent, and later fire can only shorten the deadline.
   * @param {number} seconds
   */
  ignite(seconds = this.fuseDuration) {
    if (!this.alive || !Number.isFinite(seconds) || seconds <= 0) {
      return false;
    }
    this.fuseRemaining = Math.min(this.fuseRemaining ?? Infinity, seconds);
    if (!this.carrier && !this.airborne && !this.statuses.has("stun") &&
      !this.statuses.has("confused")) {
      this.behavior.changeTo(FuseWarningState.name);
    }
    return true;
  }

  /**
   * @param {{kind: string}} event
   */
  onDamaged({ kind }) {
    if (kind === "fire" && this.alive) {
      this.ignite(0.45);
    } else if (this.alive && !this.carrier && !this.airborne && this.fuseRemaining === null && !this.statuses.has("stun")) {
      this.react("hit", 0.27);
    }
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "fire" || name === "burning") {
      this.ignite(0.45);
    }
    if ((name === "stun" || name === "confused") && !this.carrier && !this.airborne) {
      this.behavior.changeTo(FuseStoppedState.name);
    }
  }

  /**
   * @param {Parameters<Enemy["onBellRung"]>[0]} event
   */
  onBellRung(event = {}) {
    return super.onBellRung({
      ...event,
      duration: Math.min(event.duration ?? 0.7, 0.7),
    });
  }

  onCarried() {
    this.behavior.changeTo(FusePassengerState.name);
  }

  onLaunched() {
    this.behavior.changeTo(FusePassengerState.name);
  }

  onLanded() {
    this.react("impact_land", 0.25);
  }

  resumeTask() {
    if (!this.alive) {
      return;
    }
    const Next = this.statuses.has("stun") || this.statuses.has("confused")
      ? FuseStoppedState : this.fuseRemaining === null ? FusePursuitState : FuseWarningState;
    this.behavior.changeTo(Next.name);
  }

  /**
   * Probe actual animated door leaves along the short royal-directed segment.
   * @param {Enemy} royal
   * @returns {boolean}
   */
  closedDoorAhead(royal) {
    const point = this.targetPosition(royal);
    if (!point) {
      return false;
    }
    const start = this.position.clone();
    start.y += 0.45;
    const direction = new this.pc.Vec3(point.x - start.x, 0, point.z - start.z);
    const length = direction.length();
    if (length < 0.001) {
      return false;
    }
    const end = start.clone().add(direction.mulScalar(Math.min(0.85, length) / length));
    for (const actor of this.actors) {
      for (const door of actor.entranceDoors ?? []) {
        if (door.openAmount < 0.8 && door.getHit(start, end)) {
          return true;
        }
      }
    }

    return false;
  }

  detonate() {
    if (!this.alive || this.exploded) {
      return false;
    }
    // Set terminal health BEFORE invoking recipients: nearby bombs may respond.
    this.exploded = true;
    this.health = 0;
    this.carrier = null;
    this.statuses.clear();
    this.behavior.changeTo(FuseTerminalState.name);
    this.effects?.explode();
    for (const actor of this.actors) {
      if (actor === this || actor.alive === false || this.distanceTo(actor) > 2.2) {
        continue;
      }
      if (typeof actor.receiveDamage === "function") {
        actor.receiveDamage(48, this, "explosion");
      } else if (typeof actor.beginGameOver === "function") {
        const cameraPosition = () => this.app.root.findComponent("camera")?.entity.getPosition().clone() ?? this.position.clone();
        actor.beginGameOver(cameraPosition);
      }
    }

    return true;
  }

  onDeath() {
    this.behavior.changeTo(FuseTerminalState.name);
  }
}
