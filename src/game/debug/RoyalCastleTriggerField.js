import {
  GRASS_CANOPY_HEIGHT,
  GRASS_SURFACE_LIFT,
} from "../config/terrain.js";

const TRIGGER_COLORS = [0xd8aa3d, 0x627bd9, 0xe47ea6];
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
const HERO_PRESS_RADIUS = TRIGGER_RADIUS + 0.08;
const HERO_ELEVATION_TOLERANCE = 0.45;
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

/** Development-only floor markers that activate one royal castle apiece. */
export class RoyalCastleTriggerField {
  #entity;
  #materials = [];
  #markers = [];
  #updateHandle = null;

  constructor({
    pc,
    app = null,
    triggers,
    cols,
    rows,
    tileHeightAt,
    getGrassSupportPoints = null,
  }) {
    this.#entity = new pc.Entity("Royal castle trigger tiles");
    triggers.forEach((trigger, index) => {
      const color = new pc.Color();
      color.fromString(`#${(trigger.color ?? TRIGGER_COLORS[index % 3])
        .toString(16)
        .padStart(6, "0")}`);
      const material = new pc.StandardMaterial();
      material.name = `${trigger.royal ?? "Royal"} trigger material`;
      material.diffuse.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity = 0.45;
      material.gloss = 0.18;
      material.update();
      this.#materials.push(material);

      const x = trigger.col - (cols - 1) / 2;
      const z = trigger.row - (rows - 1) / 2;
      const groundY = tileHeightAt(trigger.col, trigger.row);
      const marker = new pc.Entity(`${trigger.royal ?? "Royal"} trigger tile`);
      const visual = new pc.Entity(`${trigger.royal ?? "Royal"} trigger visual`);
      visual.addComponent("render", {
        type: "cylinder",
        castShadows: false,
        receiveShadows: false,
      });
      visual.render.meshInstances[0].material = material;
      visual.setLocalScale(TRIGGER_RADIUS * 2, MARKER_HEIGHT, TRIGGER_RADIUS * 2);
      marker.addChild(visual);
      marker.setLocalPosition(x, groundY + RESTING_CENTER_LIFT, z);
      marker.addComponent("collision", {
        type: "cylinder",
        radius: TRIGGER_RADIUS,
        height: MARKER_HEIGHT,
        axis: 1,
      });
      marker.addComponent("rigidbody", {
        type: pc.BODYTYPE_DYNAMIC,
        mass: MARKER_MASS,
        friction: 0.85,
        restitution: 0,
        linearDamping: 0.72,
        angularDamping: 0.86,
        linearFactor: [0, 1, 0],
        angularFactor: [1, 0, 1],
      });
      this.#entity.addChild(marker);

      const grassRootY = groundY + GRASS_ROOT_LIFT;
      const supportPoints = getGrassSupportPoints?.(
        { x, y: grassRootY, z },
        TRIGGER_RADIUS - 0.025,
      ) ?? this.#fallbackSupportPoints(x, grassRootY, z);
      this.#markers.push({
        entity: marker,
        x,
        y: groundY,
        z,
        restingBottomY: groundY + RESTING_BOTTOM_LIFT,
        restingCenterY: groundY + RESTING_CENTER_LIFT,
        supportPoints:
          supportPoints.length > 0
            ? supportPoints
            : this.#fallbackSupportPoints(x, grassRootY, z),
        heroContact: null,
        normal: new pc.Vec3(0, 1, 0),
        up: new pc.Vec3(0, 1, 0),
      });
    });
    this.#updateHandle = app?.on("update", this.#update) ?? null;
  }

  get entity() {
    return this.#entity;
  }

  grassWeightAt(x, z, elevation) {
    for (const marker of this.#markers) {
      if (Math.abs(marker.y - elevation) > GRASS_ELEVATION_TOLERANCE) {
        continue;
      }
      if (Math.hypot(x - marker.x, z - marker.z) <= TRIGGER_RADIUS) {
        return TRIGGER_GRASS_WEIGHT;
      }
    }
    return 0;
  }

  surfaceHeightAt(x, z, radius = 0) {
    let highest = null;
    for (const marker of this.#markers) {
      if (Math.hypot(x - marker.x, z - marker.z) > TRIGGER_RADIUS + radius) {
        continue;
      }
      const surface = this.#surfaceState(marker);
      const height =
        surface.topCenterY -
        (surface.normal.x * (x - surface.position.x) +
          surface.normal.z * (z - surface.position.z)) /
          surface.normalY;
      highest = highest === null ? height : Math.max(highest, height);
    }
    return highest;
  }

  updateHeroPosition({ x, y, z }) {
    for (const marker of this.#markers) {
      const distance = Math.hypot(x - marker.x, z - marker.z);
      marker.heroContact =
        distance <= HERO_PRESS_RADIUS &&
        Math.abs(y - marker.y) <= HERO_ELEVATION_TOLERANCE
          ? { x, z }
          : null;
    }
  }

  get grassSurfaceContacts() {
    return this.#markers.map((marker) => {
      const surface = this.#surfaceState(marker);
      return {
        x: marker.x,
        y: marker.y + GRASS_ROOT_LIFT,
        z: marker.z,
        radius: TRIGGER_RADIUS,
        compression: Math.max(
          0,
          marker.restingBottomY - surface.bottomCenterY,
        ),
        slopeX: surface.normal.x / surface.normalY,
        slopeZ: surface.normal.z / surface.normalY,
      };
    });
  }

  get physicsState() {
    return this.#markers.map((marker) => {
      const surface = this.#surfaceState(marker);
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
        compression: Math.max(
          0,
          marker.restingBottomY - surface.bottomCenterY,
        ),
        supportCount: marker.supportPoints.length,
      };
    });
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity.destroy();
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#materials = [];
    this.#markers = [];
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

  #surfaceState(marker) {
    const position = marker.entity.getPosition();
    marker.entity.getRotation().transformVector(marker.up, marker.normal);
    return {
      position,
      normal: marker.normal,
      normalY: Math.max(MINIMUM_NORMAL_Y, marker.normal.y),
      bottomCenterY: position.y - marker.normal.y * MARKER_HALF_HEIGHT,
      topCenterY: position.y + marker.normal.y * MARKER_HALF_HEIGHT,
    };
  }

  #update = () => {
    for (const marker of this.#markers) {
      const body = marker.entity.rigidbody;
      const surface = this.#surfaceState(marker);
      const linearVelocity = body.linearVelocity;
      const angularVelocity = body.angularVelocity;
      const supportStiffness =
        TOTAL_SUPPORT_STIFFNESS / marker.supportPoints.length;
      const supportDamping =
        TOTAL_SUPPORT_DAMPING / marker.supportPoints.length;
      const supportForceLimit =
        MAXIMUM_TOTAL_SUPPORT_FORCE / marker.supportPoints.length;
      const centerSpringForce = Math.max(
        -MAXIMUM_CENTER_SPRING_FORCE,
        Math.min(
          MAXIMUM_CENTER_SPRING_FORCE,
          (marker.restingCenterY - surface.position.y) *
            CENTER_SPRING_STIFFNESS -
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
      for (const point of marker.supportPoints) {
        const offsetX = point.x - surface.position.x;
        const offsetZ = point.z - surface.position.z;
        const bottomY =
          surface.bottomCenterY -
          (surface.normal.x * offsetX + surface.normal.z * offsetZ) /
            surface.normalY;
        const offsetY = bottomY - surface.position.y;
        const pointVelocityY =
          linearVelocity.y +
          angularVelocity.z * offsetX -
          angularVelocity.x * offsetZ;
        const compression = Math.min(
          MAXIMUM_SUPPORT_COMPRESSION,
          Math.max(0, marker.restingBottomY - bottomY),
        );
        const force = Math.min(
          supportForceLimit,
          Math.max(
            0,
            compression * supportStiffness -
              pointVelocityY * supportDamping,
          ),
        );
        if (force > 0) {
          body.applyForce(0, force, 0, offsetX, offsetY, offsetZ);
        }
      }
      if (marker.heroContact) {
        body.applyForce(
          0,
          -HERO_PRESS_FORCE,
          0,
          marker.heroContact.x - surface.position.x,
          MARKER_HALF_HEIGHT,
          marker.heroContact.z - surface.position.z,
        );
      }
    }
  };
}
