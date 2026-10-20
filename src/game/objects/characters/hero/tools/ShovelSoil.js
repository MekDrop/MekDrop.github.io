import { BODYGROUP_USER_6, BODYGROUP_USER_5, BODYTYPE_DYNAMIC, BODYTYPE_STATIC, Entity, Vec3 } from "playcanvas";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { SHOVEL_FILL_SCOOP_TIME, SHOVEL_FILL_RELEASE_TIME } from "../../../../config/treasure.js";

const LOAD_TIME = 0.64;
const RELEASE_TIME = 1.23;
const CLOD_LIFETIME = 2;

/**
 * @typedef {{root: import("playcanvas").Entity, visual: import("playcanvas").Entity, source: import("playcanvas").Entity, scale: Vec3, remaining: number, islandPosition: Vec3, islandOffset: number}} ShovelClod
 */

/**
 * Carries authored soil on the blade, then releases pooled Ammo bodies.
 */
export class ShovelSoil {
  /**
   * @type {import("playcanvas").Entity}
   */
  #owner;
  /**
   * @type {import("playcanvas").Entity}
   */
  #load;
  /**
   * @type {import("playcanvas").Entity}
   */
  #ground;
  /**
   * @type {ShovelClod[]}
   */
  #pool = [];
  /**
   * @type {number}
   */
  #cycle = -1;
  /**
   * @type {number}
   */
  #lastElapsed = -1;
  /**
   * @type {Map<import("playcanvas").Entity, Vec3>}
   */
  #sourceScales = new Map();
  /**
   * @type {boolean}
   */
  #released = false;
  /**
   * @type {boolean}
   */
  #filling = false;
  /**
   * @type {{x: number, y: number, z: number}|undefined}
   */
  #target;
  /**
   * @type {(x: number, z: number) => number}
   */
  #islandOffsetAt;
  /**
   * @type {Vec3|null}
   */
  #landingPosition = null;
  /**
   * @type {number}
   */
  #landingOffset = 0;

  /**
   * @param {{app: import("playcanvas").Application, owner: import("playcanvas").Entity, shovel: import("playcanvas").Entity, islandOffsetAt?: (x: number, z: number) => number}} options
   */
  constructor({ app, owner, shovel, islandOffsetAt = () => 0 }) {
    this.#owner = owner;
    this.#islandOffsetAt = islandOffsetAt;
    this.#load = shovel.findByName("Shovel soil load");
    this.#load.enabled = false;
    this.#ground = new Entity("Shovel soil landing surface", app);
    this.#ground.enabled = false;
    app.root.addChild(this.#ground);
    // Dig sites require flat terrain. This private Ammo contact patch matches
    // that surface without letting the tiny clods push the hero or other props.
    this.#ground.addComponent("collision", {
      type: "box",
      halfExtents: [1.2, 0.2, 0.9],
    });
    this.#ground.addComponent("rigidbody", {
      type: BODYTYPE_STATIC,
      friction: 0.9,
      group: BODYGROUP_USER_5,
      mask: BODYGROUP_USER_6,
    });
    const sources = this.#load.children.filter(/**
     *
     * @param {import("playcanvas").Entity} child
     */
      (child) => child.render);
    for (const source of sources) {
      this.#sourceScales.set(source, source.getLocalScale().clone());
    }
    for (let index = 0; index < sources.length * 2; index += 1) {
      const source = sources[index % sources.length];
      const root = new Entity(`Shovel soil clod ${index}`, app);
      root.tags.add("shovel-soil");
      root.enabled = false;
      app.root.addChild(root);
      const visual = source.clone();
      visual.name = "Thrown shovel soil visual";
      visual.setLocalPosition(0, 0, 0);
      visual.setLocalEulerAngles(0, 0, 0);
      const scale = source.getWorldTransform().getScale();
      visual.setLocalScale(scale);
      root.addChild(visual);
      const radius = Math.max(0.008, source.render.meshInstances[0].aabb.halfExtents.length() * 0.55);
      root.addComponent("collision", {
        type: "sphere",
        radius,
      });
      root.addComponent("rigidbody", {
        type: BODYTYPE_DYNAMIC,
        mass: 0.015,
        friction: 0.9,
        restitution: 0.08,
        linearDamping: 0.08,
        angularDamping: 0.55,
        group: BODYGROUP_USER_6,
        mask: BODYGROUP_USER_5,
      });
      this.#pool.push({
        root,
        visual,
        source,
        scale,
        remaining: 0,
        islandPosition: new Vec3(),
        islandOffset: 0,
      });
    }
  }

  /**
   * @param {number} deltaTime
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null} action
   */
  update(deltaTime, action) {
    this.syncIslandOffsets();
    for (const clod of this.#pool) {
      if (clod.remaining <= 0) {
        continue;
      }
      clod.remaining = Math.max(0, clod.remaining - deltaTime);
      clod.visual.setLocalScale(clod.scale.clone().mulScalar(Math.min(1, clod.remaining / 0.35)));
      clod.root.enabled = clod.remaining > 0;
    }
    const digging = action?.phase === "use" && action.useAnimation === HERO_ANIMATION.DIG &&
      action.toolContext?.action !== "blocked-dig";
    const filling = action?.phase === "use" && action.useAnimation === HERO_ANIMATION.FILL_HOLE;
    const leveling = action?.phase === "use" && action.useAnimation === HERO_ANIMATION.LEVEL_HOLE;
    if (!digging && !filling && !leveling) {
      if (this.#load.enabled && !this.#filling) {
        this.#release(this.#target, true);
      }
      this.#load.enabled = false;
      this.#cycle = -1;
      this.#lastElapsed = -1;
    } else {
      this.#filling = filling;
      this.#target = action.targetPosition;
      const strokeDuration = action.strokeDuration ?? action.tool.useDuration;
      const cycle = Math.floor(action.elapsed / strokeDuration);
      const time = action.elapsed - cycle * strokeDuration;
      if (cycle !== this.#cycle || action.elapsed < this.#lastElapsed) {
        this.#cycle = cycle;
        this.#released = false;
        this.#load.enabled = false;
      }
      this.#lastElapsed = action.elapsed;
      if (leveling) {
        this.#load.enabled = false;
        if (!this.#released && time >= SHOVEL_FILL_SCOOP_TIME) {
          action.onScoop?.();
          this.#released = true;
        }
      }
      const loadTime = filling ? SHOVEL_FILL_SCOOP_TIME : LOAD_TIME;
      const releaseTime = filling ? SHOVEL_FILL_RELEASE_TIME : RELEASE_TIME;
      if (!leveling && !this.#released && time >= loadTime && time < releaseTime) {
        if (filling && !this.#load.enabled) {
          action.onScoop?.();
        }
        this.#load.enabled = true;
        const scale = filling ? Math.min(1, (time - loadTime) / 0.07) : 1;
        this.#setLoadAmount(scale);
      }
      if (!this.#released && time >= releaseTime && this.#load.enabled) {
        this.#setLoadAmount(1);
        this.#release(action.targetPosition, false, filling);
        this.#load.enabled = false;
        this.#released = true;
      }
    }
    this.#ground.enabled = this.#pool.some(/**
     *
     * @param {ShovelClod} clod
     */
      (clod) => clod.remaining > 0);
  }

  /**
   * Grow each clod at its blade anchor, without moving it along the shaft.
   * @param {number} amount
   */
  #setLoadAmount(amount) {
    for (const [source, scale] of this.#sourceScales) {
      source.setLocalScale(scale.clone().mulScalar(amount));
    }
  }

  syncIslandOffsets() {
    if (this.#landingPosition && this.#ground.enabled) {
      const offset = this.#islandOffsetAt(this.#landingPosition.x, this.#landingPosition.z);
      ShovelSoil.#translateBody(this.#ground, offset - this.#landingOffset);
      this.#landingOffset = offset;
    }
    for (const clod of this.#pool) {
      if (clod.remaining <= 0) {
        continue;
      }
      const offset = this.#islandOffsetAt(clod.islandPosition.x, clod.islandPosition.z);
      ShovelSoil.#translateBody(clod.root, offset - clod.islandOffset);
      clod.islandOffset = offset;
    }
  }

  /**
   * Translate the physics body without adding island motion to its throw velocity.
   * @param {import("playcanvas").Entity} entity
   * @param {number} delta
   */
  static #translateBody(entity, delta) {
    if (delta === 0) {
      return;
    }
    const position = entity.getPosition();
    entity.rigidbody.teleport(position.x, position.y + delta, position.z);
  }

  /**
   * @param {{x: number, y: number, z: number}|undefined} target
   * @param {boolean} [drop]
   * @param {boolean} [filling]
   */
  #release(target, drop = false, filling = false) {
    const right = this.#owner.getWorldTransform().transformVector(new Vec3(1, 0, 0)).normalize();
    const forward = this.#owner.getWorldTransform().transformVector(new Vec3(0, 0, 1)).normalize();
    const surface = target ?? this.#owner.getPosition();
    this.#landingPosition = new Vec3(surface.x, surface.y, surface.z);
    this.#landingOffset = this.#islandOffsetAt(surface.x, surface.z);
    this.#ground.setPosition(surface.x + (filling ? 0 : right.x * 0.42 + forward.x * 0.3),
      surface.y - (filling ? 0.3 : 0.2) + (target ? this.#landingOffset : 0),
      surface.z + (filling ? 0 : right.z * 0.42 + forward.z * 0.3));
    const rotation = this.#owner.getRotation();
    this.#ground.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
    this.#ground.enabled = true;
    const groundPosition = this.#ground.getPosition();
    this.#ground.rigidbody.teleport(groundPosition.x, groundPosition.y, groundPosition.z);
    for (const source of this.#load.children.filter(/**
     *
     * @param {import("playcanvas").Entity} child
     */
      (child) => child.render)) {
      const clod = this.#pool.find(/**
       *
       * @param {ShovelClod} entry
       */
        (entry) => entry.remaining <= 0 && entry.source === source);
      if (!clod) {
        continue;
      }
      clod.remaining = filling ? 0.36 : CLOD_LIFETIME;
      clod.islandPosition.copy(this.#landingPosition);
      clod.islandOffset = this.#landingOffset;
      clod.visual.setLocalScale(clod.scale);
      clod.root.enabled = true;
      // The game's gravity can move these small clods through a contact surface
      // between physics steps; sweep their collision spheres as well.
      clod.root.rigidbody.body.setCcdMotionThreshold(clod.root.collision.radius * 0.5);
      clod.root.rigidbody.body.setCcdSweptSphereRadius(clod.root.collision.radius * 0.8);
      const position = source.getPosition();
      const orientation = source.getRotation();
      clod.root.setRotation(orientation.x, orientation.y, orientation.z, orientation.w);
      clod.root.rigidbody.teleport(position.x, position.y, position.z);
      const spread = this.#load.children.indexOf(source) - 3;
      clod.root.rigidbody.linearVelocity = filling
        ? new Vec3((surface.x - position.x) * 3, -0.3, (surface.z - position.z) * 3)
        : drop ? new Vec3(0, 0, 0)
          : right.clone().mulScalar(0.7 + spread * 0.025)
            .add(forward.clone().mulScalar(0.35)).add(new Vec3(0, 0.45 + Math.abs(spread) * 0.02, 0));
      clod.root.rigidbody.angularVelocity = new Vec3(2 + spread, 3 - spread, 2);
    }
  }

  destroy() {
    this.#load.enabled = false;
    for (const clod of this.#pool) {
      clod.root.destroy();
    }
    this.#pool.length = 0;
    this.#ground.destroy();
  }
}

