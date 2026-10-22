import { everyFiniteNumber } from "../../../helpers/collections.js";
import { HeroStairGait } from "./HeroStairGait.js";
const CONTACT_EPSILON = 0.006;
const CONTACT_REACH = 0.14;
const MAXIMUM_FOOT_LIFT = 0.32;
const MAXIMUM_FOOT_TILT = 30;
const RELEASE_RESPONSE = 18;
const TILT_RESPONSE = 20;

export class HeroFootPlacement {
  /**
   *
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
   * @type {typeof import("playcanvas")}
   */
  #surfaceAt;
  /**
   *
   * @type {() => {x: number, y: number, z: number}}
   */
  #getHeroPosition;
  /**
   * @type {(x: number, z: number) => number}
   */
  #visualOffsetAt;
  /**
   *
   * @type {typeof import("playcanvas")}
   */
  #feet;
  /**
   *
   * @type {boolean}
   */
  #enabled = false;
  /**
   * @type {number}
   */
  #visualOffset = 0;
  /**
   * @type {HeroStairGait}
   */
  #stairGait = new HeroStairGait();
  /**
   * @type {number|null}
   */
  #stairBodyHeight = null;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #modelRoot;
  /**
   * @type {number}
   */
  #stairExitRemaining = 0;

  /**
   * @returns {{swing: number|null, support: number, progress: number}}
   */
  get stairState() {
    return this.#stairGait.state;
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), surfaceAt: (...args: number[]) => import("src/game/objects/ObjectTypes.js").SurfaceSample|null, getHeroPosition: () => {x: number, y: number, z: number}, visualOffsetAt?: (x: number, z: number) => number, modelRoot?: import("playcanvas").Entity|null, left: import("src/game/objects/ObjectTypes.js").HeroFootRig, right: import("src/game/objects/ObjectTypes.js").HeroFootRig}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {(...args: number[]) => Array<number>} options.surfaceAt
   * @param {() => {x: number, y: number, z: number}} options.getHeroPosition
   * @param {(x: number, z: number) => number} [options.visualOffsetAt]
   * @param {import("playcanvas").Entity|null} [options.modelRoot]
   * @param {boolean} options.left
   * @param {number} options.right
   */
  constructor({
    pc,
    surfaceAt,
    getHeroPosition,
    visualOffsetAt = () => 0,
    modelRoot = null,
    left,
    right,
  }) {
    this.#pc = pc;
    this.#surfaceAt = surfaceAt;
    this.#getHeroPosition = getHeroPosition;
    this.#visualOffsetAt = visualOffsetAt;
    this.#modelRoot = modelRoot;
    this.#feet = [
      this.#createFoot("Left leg surface adjustment", left),
      this.#createFoot("Right leg surface adjustment", right),
    ];
  }

  /**
   *
   * @returns {boolean}
   */
  get state() {
    return Object.fromEntries(this.#feet.map(HeroFootPlacement.#mapFoot));
  }

  /**
   *
   * @returns {Array<{minX: number, maxX: number, minZ: number, maxZ: number}>}
   */
  get grassContacts() {
    if (!this.#enabled) {
      return [];
    }
    return this.#feet.flatMap(this.#flatMapFoot.bind(this));
  }

  /**
   *
   * @param {number} deltaTime
   * @param {boolean} enabled
   * @param {number} [visualOffset] Island displacement already inherited by the whole model.
   * @param {{onStairs: boolean, velocity: import("playcanvas").Vec3, forward: import("playcanvas").Vec3}|null} [stairs]
   */
  update(deltaTime, enabled, visualOffset = 0, stairs = null) {
    this.#enabled = enabled;
    this.#visualOffset = visualOffset;
    const maximumSurfaceHeight =
      this.#getHeroPosition().y + MAXIMUM_FOOT_LIFT;
    for (const foot of this.#feet) {
      this.#resetWrapper(foot);
    }
    const soles = this.#feet.map(this.#solePosition.bind(this));
    this.#stairExitRemaining = stairs?.onStairs ? 0.35 : Math.max(0, this.#stairExitRemaining - deltaTime);
    const targets = this.#stairGait.update(
      deltaTime,
      enabled && this.#stairExitRemaining > 0 && this.#feet.every(HeroFootPlacement.#hasKnee),
      new this.#pc.Vec3().copy(this.#getHeroPosition()),
      stairs?.velocity ?? new this.#pc.Vec3(),
      soles,
      this.#surfaceAt,
    );
    if (targets) {
      if (this.#modelRoot) {
        // Carry weight over the planted boot before lifting the trailing one.
        // The capsule can clear a riser earlier than this visible transfer.
        const root = this.#modelRoot.getPosition().clone();
        const support = targets[this.#stairGait.state.support].y - CONTACT_EPSILON;
        this.#stairBodyHeight ??= root.y;
        this.#stairBodyHeight += (support - this.#stairBodyHeight) * (1 - Math.exp(-14 * deltaTime));
        this.#modelRoot.setPosition(root.x, this.#stairBodyHeight, root.z);
      }
      for (const [index, foot] of this.#feet.entries()) {
        const bootRotation = foot.tilt.getRotation().clone();
        HeroStairGait.pose(foot.leg, foot.knee, foot.ankle, foot.wrapper,
          foot.kneeCorrection, this.#solePosition(foot), targets[index], stairs.forward);
        foot.tilt.setRotation(bootRotation.x, bootRotation.y, bootRotation.z, bootRotation.w);
      }
    } else {
      this.#stairBodyHeight = null;
    }
    for (const foot of this.#feet) {
      if (!enabled) {
        foot.appliedLift = 0;
        foot.minimumClearance = null;
        foot.tiltWeight = 0;
        foot.tiltDegrees = 0;
        continue;
      }

      const unadjustedContacts = this.#contacts(foot, maximumSurfaceHeight);
      this.#alignBootToSurface(
        foot,
        unadjustedContacts,
        deltaTime,
      );
      const contacts = this.#contacts(foot, maximumSurfaceHeight);
      const targetLift = Math.min(
        MAXIMUM_FOOT_LIFT,
        Math.max(0, ...contacts.map(HeroFootPlacement.#map)),
      );
      if (targetLift >= foot.appliedLift) {
        foot.appliedLift = targetLift;
      } else {
        const releaseBlend = 1 - Math.exp(-RELEASE_RESPONSE * deltaTime);
        foot.appliedLift +=
          (targetLift - foot.appliedLift) * releaseBlend;
      }

      const wrapperPosition = foot.wrapper.getPosition().clone();
      const solePosition = foot.sole.getPosition();
      foot.wrapper.setPosition(
        wrapperPosition.x,
        wrapperPosition.y + foot.appliedLift +
          this.#visualOffsetAt(solePosition.x, solePosition.z) - this.#visualOffset,
        wrapperPosition.z,
      );
      foot.minimumClearance = contacts.length
        ? Math.min(
          ...contacts.map(
            /**
               *
               * @param {{solePoint: {x: number, y: number, z: number}, surface: import("src/game/objects/ObjectTypes.js").SurfaceSample}} options
               * @param {{x: number, y: number, z: number}} options.solePoint
               * @param {import("src/game/objects/ObjectTypes.js").SurfaceSample} options.surface
               */
            ({ solePoint, surface }) =>
              solePoint.y + foot.appliedLift - surface.height,
          ),
        )
        : null;
    }
  }

  destroy() {
    for (const foot of this.#feet) {
      this.#resetWrapper(foot);
    }
    this.#feet = [];
  }

  /**
   *
   * @param {string} name
   * @param {{side: string, leg: import("playcanvas").Entity, sole: import("playcanvas").Entity}} options
   * @param {string} options.side
   * @param {import("playcanvas").Entity} options.leg
   * @param {import("playcanvas").Entity} options.sole
   */
  #createFoot(name, { side, leg, sole }) {
    const visualChildren = [...leg.children];
    const wrapper = new this.#pc.Entity(name);
    leg.addChild(wrapper);
    for (const child of visualChildren) {
      wrapper.addChild(child);
    }
    const knee = leg.findByName(side === "left" ? "Left knee" : "Right knee");
    const ankle = leg.findByName(side === "left" ? "Left ankle" : "Right ankle");
    let kneeCorrection = null;
    if (knee && ankle) {
      const children = [...knee.children];
      kneeCorrection = new this.#pc.Entity(`${side} knee stair correction`);
      knee.addChild(kneeCorrection);
      for (const child of children) {
        kneeCorrection.addChild(child);
      }
    }
    // Keep authored ankle positions and rotations in the animation hierarchy.
    // Surface alignment may rotate the boot meshes, never the joint's lever arm.
    const bootParent = sole.parent;
    const bootParts = [...bootParent.children];
    const tilt = new this.#pc.Entity(`${side} boot surface tilt`);
    bootParent.addChild(tilt);
    for (const part of bootParts) {
      tilt.addChild(part);
    }

    return {
      side,
      leg,
      knee,
      ankle,
      kneeCorrection,
      sole,
      wrapper,
      tilt,
      appliedLift: 0,
      minimumClearance: null,
      surfaceNormal: new this.#pc.Vec3(0, 1, 0),
      tiltWeight: 0,
      tiltDegrees: 0,
    };
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   */
  #resetWrapper(foot) {
    foot.wrapper.setLocalPosition(0, 0, 0);
    foot.wrapper.setLocalRotation(0, 0, 0, 1);
    foot.kneeCorrection?.setLocalRotation(0, 0, 0, 1);
    foot.tilt.setLocalRotation(0, 0, 0, 1);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   */
  static #hasKnee(foot) {
    return Boolean(foot.knee && foot.ankle);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   * @returns {import("playcanvas").Vec3}
   */
  #solePosition(foot) {
    const bounds = foot.sole.render?.meshInstances?.[0]?.mesh?.aabb;
    const point = bounds ? new this.#pc.Vec3(bounds.center.x,
      bounds.center.y - bounds.halfExtents.y, bounds.center.z) : new this.#pc.Vec3();
    const world = foot.sole.getWorldTransform().transformPoint(point);
    world.y -= this.#visualOffset;

    return world;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   * @param {number} contacts
   * @param {number} deltaTime
   */
  #alignBootToSurface(
    foot,
    contacts,
    deltaTime,
  ) {
    const normal = this.#contactNormal(contacts);
    const targetWeight = normal ? 1 : 0;
    if (normal) {
      foot.surfaceNormal.copy(normal);
    }
    const tiltBlend = 1 - Math.exp(-TILT_RESPONSE * deltaTime);
    foot.tiltWeight += (targetWeight - foot.tiltWeight) * tiltBlend;
    if (foot.tiltWeight < 0.001) {
      foot.tiltWeight = 0;
      foot.tiltDegrees = 0;

      return;
    }

    const baseRotation = foot.tilt.getRotation().clone();
    const baseUp = baseRotation
      .transformVector(new this.#pc.Vec3(0, 1, 0))
      .normalize();
    const deltaRotation = new this.#pc.Quat().setFromDirections(
      baseUp,
      foot.surfaceNormal,
    );
    const targetRotation = new this.#pc.Quat().mul2(
      deltaRotation,
      baseRotation,
    );
    const adjustedRotation = new this.#pc.Quat().slerp(
      baseRotation,
      targetRotation,
      foot.tiltWeight,
    );
    foot.tilt.setRotation(adjustedRotation);
    foot.tiltDegrees =
      (Math.acos(
        Math.max(-1, Math.min(1, baseUp.dot(foot.surfaceNormal))),
      ) *
        180 *
        foot.tiltWeight) /
      Math.PI;
  }

  /**
   *
   * @param {number} contacts
   */
  #contactNormal(contacts) {
    let x = 0;
    let y = 0;
    let z = 0;
    let totalWeight = 0;
    for (const { solePoint, surface } of contacts) {
      const distance = Math.abs(solePoint.y - surface.height);
      const weight = Math.max(0, 1 - distance / CONTACT_REACH);
      const normal = surface.normal;
      if (
        weight <= 0 ||
        !normal ||
        !everyFiniteNumber([normal.x, normal.y, normal.z]) ||
        normal.y <= 0
      ) {
        continue;
      }
      x += normal.x * weight;
      y += normal.y * weight;
      z += normal.z * weight;
      totalWeight += weight;
    }
    if (totalWeight <= 0) {
      return null;
    }

    const normal = new this.#pc.Vec3(
      x / totalWeight,
      y / totalWeight,
      z / totalWeight,
    ).normalize();
    const horizontalLength = Math.hypot(normal.x, normal.z);
    const maximumTilt = (MAXIMUM_FOOT_TILT * Math.PI) / 180;
    if (horizontalLength <= Math.sin(maximumTilt)) {
      return normal;
    }
    const horizontalScale = Math.sin(maximumTilt) / horizontalLength;

    return new this.#pc.Vec3(
      normal.x * horizontalScale,
      Math.cos(maximumTilt),
      normal.z * horizontalScale,
    );
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   * @param {number} maximumSurfaceHeight
   */
  #contacts(foot, maximumSurfaceHeight) {
    const bounds = foot.sole.render?.meshInstances?.[0]?.mesh?.aabb;
    if (!bounds) {
      return [];
    }

    const minimumX = bounds.center.x - bounds.halfExtents.x;
    const maximumX = bounds.center.x + bounds.halfExtents.x;
    const minimumY = bounds.center.y - bounds.halfExtents.y;
    const minimumZ = bounds.center.z - bounds.halfExtents.z;
    const maximumZ = bounds.center.z + bounds.halfExtents.z;
    const contactCoordinates = [
      [minimumX, minimumY, minimumZ],
      [maximumX, minimumY, minimumZ],
      [bounds.center.x, minimumY, bounds.center.z],
      [minimumX, minimumY, maximumZ],
      [maximumX, minimumY, maximumZ],
    ];
    const transform = foot.sole.getWorldTransform();

    return contactCoordinates.flatMap(/**
     *
     * @param {Array<number>} options
     * @param {number} options."0"
     * @param {number} options."1"
     * @param {number} options."2"
     */
      ([x, y, z]) => {
        const solePoint = transform.transformPoint(new this.#pc.Vec3(x, y, z));
        // Raycasts remain in the stationary physics world, below the visual island motion.
        solePoint.y -= this.#visualOffset;
        const surface = this.#surfaceAt(
          solePoint.x,
          solePoint.z,
          maximumSurfaceHeight,
        );

        return surface &&
        Number.isFinite(surface.height) &&
        surface.normal &&
        surface.point
          ? [{
            solePoint,
            surface,
          }]
          : [];
      });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   */
  static #mapFoot(foot) {
    return [
      foot.side,
      {
        appliedLift: foot.appliedLift,
        minimumClearance: foot.minimumClearance,
        tiltDegrees: foot.tiltDegrees,
      },
    ];
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} foot
   */
  #flatMapFoot(foot) {
    const bounds = foot.sole.render?.meshInstances?.[0]?.mesh?.aabb;
    if (!bounds || foot.minimumClearance === null) {
      return [];
    }
    const transform = foot.sole.getWorldTransform();
    const center = transform.transformPoint(new this.#pc.Vec3(
      bounds.center.x, bounds.center.y - bounds.halfExtents.y, bounds.center.z,
    ));
    const across = transform.transformVector(new this.#pc.Vec3(bounds.halfExtents.x, 0, 0));
    const along = transform.transformVector(new this.#pc.Vec3(0, 0, bounds.halfExtents.z));
    const length = Math.hypot(along.x, along.z);
    const pressure = Math.max(0, 1 - Math.max(0, foot.minimumClearance - CONTACT_EPSILON) / 0.075);

    return [{
      id: `hero-${foot.side}`,
      side: foot.side,
      x: center.x,
      y: center.y,
      z: center.z,
      directionX: along.x / Math.max(length, 0.001),
      directionZ: along.z / Math.max(length, 0.001),
      halfWidth: Math.hypot(across.x, across.z) + 0.025,
      halfLength: length + 0.035,
      pressure,
    }];
  }

  /**
   *
   * @param {{solePoint: {x: number, y: number, z: number}, surface: import("src/game/objects/ObjectTypes.js").SurfaceSample}} options
   * @param {{x: number, y: number, z: number}} options.solePoint
   * @param {import("src/game/objects/ObjectTypes.js").SurfaceSample} options.surface
   */
  static #map({ solePoint, surface }) {
    return surface.height - solePoint.y + CONTACT_EPSILON;
  }
}
