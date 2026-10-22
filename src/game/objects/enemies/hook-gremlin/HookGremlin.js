import { Enemy } from "../shared/Enemy.js";
import { HookClimbBehavior } from "./HookClimbBehavior.js";
import { hookGremlinClips } from "./HookGremlinClips.js";
import { HookGremlinPreview } from "./HookGremlinPreview.js";
import { HookGremlinPlaybackCheck } from "./HookGremlinPlaybackCheck.js";

/**
 * Blue hook-clawed infiltrator; Ammo and Yuka lifecycle belong to Enemy.
 */
export class HookGremlin extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = new URL("../../../models/enemies/hook-gremlin/hook-gremlin.glb", import.meta.url).href;
  /**
   * @type {string[]}
   */
  static modelUrls = [HookGremlin.modelUrl];
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {HookClimbBehavior}
   */
  #climb;
  /**
   * @type {string}
   */
  #clip = "idle";
  /**
   * @type {number}
   */
  #overrideUntil = 0;
  /**
   * @type {number}
   */
  #deathAt = Infinity;
  /**
   * @type {Set<import("../shared/Enemy.js").EnemyActor>}
   */
  #reached = new Set();
  /**
   * @type {string}
   */
  #captureStatus = "";
  /**
   * @type {HookGremlinPlaybackCheck|null}
   */
  #playbackCheck = null;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.radius = 0.23;
    this.height = 0.8;
    if (this.modelLibrary) {
      this.#model = this.modelLibrary.instantiate(HookGremlin.modelUrl);
      this.#model.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.#model);
      const tracks = this.modelLibrary.getAnimationTracks(HookGremlin.modelUrl,
        hookGremlinClips.map(HookGremlin.#clipName));
      this.#model.addComponent("anim", { activate: true });
      for (const clip of hookGremlinClips) {
        this.#model.anim.addAnimationState(clip.name, tracks.get(clip.name), 1, clip.loop);
      }
      this.#model.anim.baseLayer.play("idle");
    }
    this.#climb = new HookClimbBehavior(this, this.playClip.bind(this));
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}\nClip: ${this.#clip}; hooks: ${this.#climb.grip.attached ? "attached" : "free"}; royal encounters: ${this.#reached.size}\n${this.#captureStatus}\n${this.#playbackCheck?.status ?? ""}`;
  }

  async testCapturePreview() {
    this.testPlayClip("idle");
    const counts = await HookGremlinPreview.capture(this);
    this.#captureStatus = `PNG: ${counts.visible} visible, ${counts.transparent} transparent pixels`;
  }

  testVerifyClips() {
    if (this.#model) {
      this.#playbackCheck?.destroy();
      this.#playbackCheck = new HookGremlinPlaybackCheck(this, this.#model);
      this.#playbackCheck.start();
    }
  }

  /**
   * @param {string} clip
   */
  playClip(clip) {
    if (this.elapsed < this.#overrideUntil || clip === this.#clip) {
      return;
    }
    this.#clip = clip;
    this.#model?.anim.baseLayer.transition(clip, 0.12);
  }

  /**
   * @param {string|null} name
   */
  testPlayClip(name) {
    this.#overrideUntil = 0;
    if (name === null) {
      this.#climb.resume();

      return;
    }
    const clip = hookGremlinClips.find(/**
                                        * @param {{name:string}} entry
                                        */ (entry) => entry.name === name);
    if (!clip) {
      return;
    }
    this.#clip = "";
    this.playClip(name);
    this.#climb.inspect();
    this.#overrideUntil = this.elapsed + Math.max(2, clip.duration * 2);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    if (this.elapsed > this.#deathAt + 1.7) {
      this.destroy();
    }
  }

  onCarried() {
    this.#overrideUntil = 0;
    this.#climb.onCarried();
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} carrier
   * @returns {boolean}
   */
  isWillingToBeThrownBy(carrier) {
    return this.canBeCarriedBy(carrier) && !this.statuses.has("stun");
  }

  /**
   * @param {Parameters<Enemy["launch"]>[0]} options
   * @returns {boolean}
   */
  launch(options) {
    const velocity = options?.velocity;
    if (!this.alive || !velocity || ![velocity.x, velocity.y, velocity.z].every(Number.isFinite) || !this.entity.rigidbody) {
      return false;
    }
    this.#climb.beforeLaunch();

    return super.launch(options);
  }

  onLaunched() {
    this.#overrideUntil = 0;
    this.#climb.onLaunched();
  }

  /**
   * @param {{other?:import("playcanvas").Entity}} contact
   */
  onLanded(contact) {
    this.#overrideUntil = 0;
    this.#climb.onLanded(contact);
  }

  onStatusApplied() {
    this.#overrideUntil = 0;
    this.#climb?.interrupt();
  }

  onDamaged() {
    if (this.alive) {
      this.#overrideUntil = 0;
      this.playClip("hit");
      this.#overrideUntil = this.elapsed + 0.25;
    }
  }

  onDeath() {
    this.#overrideUntil = 0;
    this.#deathAt = this.elapsed;
    this.#climb.onDeath();
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} royal
   * @returns {boolean}
   */
  canReachRoyal(royal) {
    if (!royal || royal.alive === false || this.distanceTo(royal) > 1.1) {
      return false;
    }
    const from = this.position.clone();
    from.y += 0.5;
    const to = this.targetPosition(royal).clone();
    to.y += 0.4;
    const hits = this.app.systems.rigidbody.raycastAll(from, to);
    const obstruction = hits.some(/**
                                   * @param {import("playcanvas").RaycastResult} hit
                                   */ (hit) =>
        hit.entity !== this.entity && hit.entity !== royal.entity &&
      !hit.entity.isDescendantOf(this.entity) && !hit.entity.isDescendantOf(royal.entity));

    return !obstruction;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} royal
   */
  strikeRoyal(royal) {
    if (!this.canReachRoyal(royal)) {
      return;
    }
    if (typeof royal.receiveDamage === "function") {
      royal.receiveDamage(14, this, "hook");
    } else if (typeof royal.beginGameOver === "function" && !this.#reached.has(royal)) {
      this.#reached.add(royal);
      royal.beginGameOver(() => this.position.clone());
    }
  }

  destroy() {
    this.#playbackCheck?.destroy();
    this.#climb.destroy();
    this.#model = null;
    super.destroy();
  }

  /**
   * @param {{name:string}} clip
   * @returns {string}
   */
  static #clipName(clip) {
    return clip.name;
  }
}
