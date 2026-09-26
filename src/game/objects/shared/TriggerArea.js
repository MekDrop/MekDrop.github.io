import {
  GRASS_CANOPY_HEIGHT,
  GRASS_SURFACE_LIFT,
} from "../../config/terrain.js";

const TRIGGER_RADIUS = 0.36;
const TRIGGER_GRASS_WEIGHT = 0.01;
const MARKER_MASS = TRIGGER_GRASS_WEIGHT;
const GRASS_ELEVATION_TOLERANCE = 0.08;
const MARKER_HEIGHT = 0.035;
const MARKER_HALF_HEIGHT = MARKER_HEIGHT / 2;
const GRASS_ROOT_LIFT = GRASS_SURFACE_LIFT - 0.002;
const GRASS_SUPPORT_CLEARANCE = 0.004;
const RESTING_BOTTOM_LIFT =
  GRASS_ROOT_LIFT + GRASS_CANOPY_HEIGHT + GRASS_SUPPORT_CLEARANCE;
const RESTING_CENTER_LIFT = RESTING_BOTTOM_LIFT + MARKER_HALF_HEIGHT;
const HERO_PRESS_RADIUS = TRIGGER_RADIUS + 0.56;
const HERO_ELEVATION_TOLERANCE = 0.45;
const ACTIVATION_RADIUS = HERO_PRESS_RADIUS;
const ACTIVATION_ELEVATION_TOLERANCE = 2;
const HERO_PRESS_FORCE = 0.005;
const GRAVITY_COMPENSATION = MARKER_MASS * 9.81;
const CENTER_SPRING_STIFFNESS = 0.2;
const CENTER_SPRING_DAMPING = 0.09;
const MAXIMUM_CENTER_SPRING_FORCE = 0.02;
const ANGULAR_SPRING_STIFFNESS = 0.02;
const ANGULAR_SPRING_DAMPING = 0.005;
const TOTAL_SUPPORT_STIFFNESS = 0.15;
const TOTAL_SUPPORT_DAMPING = 0.02;
const MAXIMUM_SUPPORT_COMPRESSION = 0.1;
const MAXIMUM_TOTAL_SUPPORT_FORCE = 0.02;
const MINIMUM_NORMAL_Y = 0.2;

/**
 * A map-authored pressure plate that runs JavaScript when its active state changes.
 */
export class TriggerArea {
  #active = false;
  #definition;
  #entity;
  #executeScript;
  #heroContact = null;
  #material;
  #normal;
  #objects;
  #onRuntimeError;
  #restingBottomY;
  #restingCenterY;
  #supportPoints;
  #updateHandle = null;
  #up;

  constructor({ pc, app, definition, runtime = {} }) {
    const { id, color, position, script } = definition;
    this.#definition = definition;
    this.#objects = runtime.objects;
    this.#onRuntimeError = runtime.onRuntimeError;
    this.#executeScript = Function(
      "active",
      "objects",
      "trigger",
      `"use strict";\n${script}`,
    );

    const parsedColor = new pc.Color();
    const colorText = typeof color === "number"
      ? `#${color.toString(16).padStart(6, "0")}`
      : color.startsWith("#") ? color : `#${color}`;
    parsedColor.fromString(colorText);
    this.#material = new pc.StandardMaterial();
    this.#material.name = `${id} trigger material`;
    this.#material.diffuse.copy(parsedColor);
    this.#material.emissive.copy(parsedColor);
    this.#material.emissiveIntensity = 0.45;
    this.#material.gloss = 0.18;
    this.#material.update();

    this.#entity = new pc.Entity(`${id} trigger area`);
    this.#entity.tags.add("map-object", id, this.constructor.name);
    const visual = new pc.Entity(`${id} trigger visual`);
    visual.addComponent("render", {
      type: "cylinder",
      castShadows: false,
      receiveShadows: false,
    });
    visual.render.meshInstances[0].material = this.#material;
    visual.setLocalScale(TRIGGER_RADIUS * 2, MARKER_HEIGHT, TRIGGER_RADIUS * 2);
    this.#entity.addChild(visual);
    this.#entity.setLocalPosition(
      position.x,
      position.y + RESTING_CENTER_LIFT,
      position.z,
    );
    this.#entity.addComponent("collision", {
      type: "cylinder",
      radius: TRIGGER_RADIUS,
      height: MARKER_HEIGHT,
      axis: 1,
    });
    this.#entity.addComponent("rigidbody", {
      type: pc.BODYTYPE_DYNAMIC,
      mass: MARKER_MASS,
      friction: 0.85,
      restitution: 0,
      linearDamping: 0.72,
      angularDamping: 0.86,
      linearFactor: [0, 1, 0],
      angularFactor: [1, 0, 1],
    });

    const grassRootY = position.y + GRASS_ROOT_LIFT;
    this.#supportPoints = runtime.getGrassSupportPoints?.(
      { x: position.x, y: grassRootY, z: position.z },
      TRIGGER_RADIUS - 0.025,
    ) ?? this.#fallbackSupportPoints(position.x, grassRootY, position.z);
    if (!this.#supportPoints.length) {
      this.#supportPoints = this.#fallbackSupportPoints(
        position.x,
        grassRootY,
        position.z,
      );
    }
    this.#restingBottomY = position.y + RESTING_BOTTOM_LIFT;
    this.#restingCenterY = position.y + RESTING_CENTER_LIFT;
    this.#normal = new pc.Vec3(0, 1, 0);
    this.#up = new pc.Vec3(0, 1, 0);
    this.#updateHandle = app?.on("update", this.#update) ?? null;
  }

  get entity() {
    return this.#entity;
  }

  get definition() {
    return this.#definition;
  }

  get isGroundCollider() {
    return true;
  }

  get visualRoots() {
    return [this.#entity];
  }

  grassWeightAt(x, z, elevation) {
    const { position } = this.#definition;
    if (Math.abs(position.y - elevation) > GRASS_ELEVATION_TOLERANCE) {
      return 0;
    }
    return Math.hypot(x - position.x, z - position.z) <= TRIGGER_RADIUS
      ? TRIGGER_GRASS_WEIGHT
      : 0;
  }

  surfaceHeightAt(x, z, radius = 0) {
    const { position } = this.#definition;
    if (Math.hypot(x - position.x, z - position.z) > TRIGGER_RADIUS + radius) {
      return null;
    }
    const surface = this.#surfaceState();
    return surface.topCenterY -
      (surface.normal.x * (x - surface.position.x) +
        surface.normal.z * (z - surface.position.z)) /
        surface.normalY;
  }

  updateHeroPosition({ x, y, z }) {
    const { position } = this.#definition;
    const distance = Math.hypot(x - position.x, z - position.z);
    this.#heroContact =
      distance <= HERO_PRESS_RADIUS &&
      Math.abs(y - position.y) <= HERO_ELEVATION_TOLERANCE
        ? { x, z }
        : null;
    const active =
      Math.abs(x - position.x) <= ACTIVATION_RADIUS &&
      Math.abs(z - position.z) <= ACTIVATION_RADIUS &&
      Math.abs(y - position.y) < ACTIVATION_ELEVATION_TOLERANCE;
    if (active === this.#active) {
      return;
    }
    this.#active = active;
    try {
      this.#executeScript(active, this.#objects, this.#definition);
    } catch (error) {
      if (this.#onRuntimeError) {
        this.#onRuntimeError(error);
        return;
      }
      throw error;
    }
  }

  get grassSurfaceContacts() {
    const { position } = this.#definition;
    const surface = this.#surfaceState();
    return [{
      x: position.x,
      y: position.y + GRASS_ROOT_LIFT,
      z: position.z,
      radius: TRIGGER_RADIUS,
      compression: Math.max(0, this.#restingBottomY - surface.bottomCenterY),
      slopeX: surface.normal.x / surface.normalY,
      slopeZ: surface.normal.z / surface.normalY,
    }];
  }

  get physicsState() {
    const surface = this.#surfaceState();
    return {
      position: {
        x: surface.position.x,
        y: surface.position.y,
        z: surface.position.z,
      },
      normal: {
        x: surface.normal.x,
        y: surface.normal.y,
        z: surface.normal.z,
      },
      compression: Math.max(0, this.#restingBottomY - surface.bottomCenterY),
      supportCount: this.#supportPoints.length,
    };
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity.destroy();
    this.#material.destroy();
    this.#supportPoints = [];
  }

  #fallbackSupportPoints(x, y, z) {
    const points = [{ x, y, z }];
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6;
      points.push({
        x: x + Math.cos(angle) * TRIGGER_RADIUS * 0.72,
        y,
        z: z + Math.sin(angle) * TRIGGER_RADIUS * 0.72,
      });
    }
    return points;
  }

  #surfaceState() {
    const position = this.#entity.getPosition();
    this.#entity.getRotation().transformVector(this.#up, this.#normal);
    return {
      position,
      normal: this.#normal,
      normalY: Math.max(MINIMUM_NORMAL_Y, this.#normal.y),
      bottomCenterY: position.y - this.#normal.y * MARKER_HALF_HEIGHT,
      topCenterY: position.y + this.#normal.y * MARKER_HALF_HEIGHT,
    };
  }

  #update = () => {
    const body = this.#entity.rigidbody;
    const surface = this.#surfaceState();
    const linearVelocity = body.linearVelocity;
    const angularVelocity = body.angularVelocity;
    const supportStiffness = TOTAL_SUPPORT_STIFFNESS / this.#supportPoints.length;
    const supportDamping = TOTAL_SUPPORT_DAMPING / this.#supportPoints.length;
    const supportForceLimit =
      MAXIMUM_TOTAL_SUPPORT_FORCE / this.#supportPoints.length;
    const centerSpringForce = Math.max(
      -MAXIMUM_CENTER_SPRING_FORCE,
      Math.min(
        MAXIMUM_CENTER_SPRING_FORCE,
        (this.#restingCenterY - surface.position.y) * CENTER_SPRING_STIFFNESS -
          linearVelocity.y * CENTER_SPRING_DAMPING,
      ),
    );
    body.applyForce(0, GRAVITY_COMPENSATION + centerSpringForce, 0);
    body.applyTorque(
      -surface.normal.z * ANGULAR_SPRING_STIFFNESS -
        angularVelocity.x * ANGULAR_SPRING_DAMPING,
      0,
      surface.normal.x * ANGULAR_SPRING_STIFFNESS -
        angularVelocity.z * ANGULAR_SPRING_DAMPING,
    );
    for (const point of this.#supportPoints) {
      const offsetX = point.x - surface.position.x;
      const offsetZ = point.z - surface.position.z;
      const bottomY = surface.bottomCenterY -
        (surface.normal.x * offsetX + surface.normal.z * offsetZ) /
          surface.normalY;
      const offsetY = bottomY - surface.position.y;
      const pointVelocityY = linearVelocity.y +
        angularVelocity.z * offsetX - angularVelocity.x * offsetZ;
      const compression = Math.min(
        MAXIMUM_SUPPORT_COMPRESSION,
        Math.max(0, this.#restingBottomY - bottomY),
      );
      const force = Math.min(
        supportForceLimit,
        Math.max(0, compression * supportStiffness - pointVelocityY * supportDamping),
      );
      if (force > 0) {
        body.applyForce(0, force, 0, offsetX, offsetY, offsetZ);
      }
    }
    if (this.#heroContact) {
      body.applyForce(
        0,
        -HERO_PRESS_FORCE,
        0,
        this.#heroContact.x - surface.position.x,
        MARKER_HALF_HEIGHT,
        this.#heroContact.z - surface.position.z,
      );
    }
  };
}
