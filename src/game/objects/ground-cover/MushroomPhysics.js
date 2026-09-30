const COLLIDER_HEIGHT = 0.12;
const COLLIDER_RADIUS_SCALE = 0.82;
const FOOT_FORWARD_OFFSET = 0.1;
const FOOT_SIDE_OFFSET = 0.13;
const FOOT_PROBE_UP = 0.2;
const FOOT_PROBE_DOWN = 0.02;
const MINIMUM_CRUSH_SPEED = 0.35;
const DEBRIS_FOOT_RADIUS = 0.17;
const DEBRIS_FOOT_CENTER_HEIGHT = 0.16;
const HERO_SURFACE_IGNORE_TAG = "hero-surface-ignore";

export class MushroomPhysics {
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {number}
   */
  #rigidbodySystem;
  /**
   *
    * @type {Array<{entity: import("playcanvas").Entity, body: import("playcanvas").RigidBodyComponent}>}
   */
  #debrisFeet = [];
  /**
   *
    * @type {Array<{entity: import("playcanvas").Entity, item: GroundCoverItem}>}
   */
  #mushrooms = [];
  /**
   *
    * @type {Map}
   */
  #mushroomsByEntity = new Map();

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   */
  constructor({ pc, app }) {

    this.#pc = pc;

    this.#entity = new pc.Entity("Mushroom physics");

    this.#rigidbodySystem = app.systems.rigidbody;

    this.#debrisFeet = [
      this.#createDebrisFoot("left"),
      this.#createDebrisFoot("right"),
    ];
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @param {{variant: string, position: {x: number, y: number, z: number}, interactionRadius: number, scale: number, onDestroy: () => void}} options
   * @param {string} options.variant
   * @param {{x: number, y: number, z: number}} options.position
   * @param {number} options.interactionRadius
   * @param {number} options.scale
   * @param {() => void} options.onDestroy
   */
  addMushroom({
    variant,
    position,
    interactionRadius,
    scale,
    onDestroy = () => {},
  }) {
    const height = COLLIDER_HEIGHT * scale;
    const entity = new this.#pc.Entity(`${variant} physics body`);
    entity.tags.add(HERO_SURFACE_IGNORE_TAG);
    entity.setLocalPosition(position.x, position.y + height / 2, position.z);
    entity.addComponent("collision", {
      type: "cylinder",
      axis: 1,
      radius: interactionRadius * COLLIDER_RADIUS_SCALE,
      height,
    });

    const mushroom = {
      destroyed: false,
      baseY: position.y + height / 2,
      entity,
      onDestroy,
    };
    this.#entity.addChild(entity);
    this.#mushrooms.push(mushroom);
    this.#mushroomsByEntity.set(entity, mushroom);
    return mushroom;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} config0
   * @param {{x: number, y: number, z: number}} config0.direction
   * @param {number} config0.speed
   */
  updateHeroPosition(
    { x, y, z },
    { direction = { x: 0, z: 1 }, speed = 0 } = {},
  ) {
    const directionLength = Math.hypot(direction.x, direction.z) || 1;
    const forwardX = direction.x / directionLength;
    const forwardZ = direction.z / directionLength;
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const centerX = x + forwardX * FOOT_FORWARD_OFFSET;
    const centerZ = z + forwardZ * FOOT_FORWARD_OFFSET;
    const centerY = y + DEBRIS_FOOT_CENTER_HEIGHT;

    this.#debrisFeet[0].setPosition(
      centerX - rightX * FOOT_SIDE_OFFSET,
      centerY,
      centerZ - rightZ * FOOT_SIDE_OFFSET,
    );
    this.#debrisFeet[1].setPosition(
      centerX + rightX * FOOT_SIDE_OFFSET,
      centerY,
      centerZ + rightZ * FOOT_SIDE_OFFSET,
    );

    if (speed < MINIMUM_CRUSH_SPEED) {
      return;
    }

    this.#probeFoot(
      centerX - rightX * FOOT_SIDE_OFFSET,
      y,
      centerZ - rightZ * FOOT_SIDE_OFFSET,
      forwardX,
      forwardZ,
    );
    this.#probeFoot(
      centerX + rightX * FOOT_SIDE_OFFSET,
      y,
      centerZ + rightZ * FOOT_SIDE_OFFSET,
      forwardX,
      forwardZ,
    );
  }

  /**
   *
   * @param {{entity: import("playcanvas").Entity, body: import("playcanvas").RigidBodyComponent}} mushroom
   */
  hide(mushroom) {
    if (!mushroom || mushroom.destroyed) {
      return;
    }
    mushroom.destroyed = true;
    mushroom.entity.enabled = false;
  }

  /**
   * @param {ReturnType<MushroomPhysics["addMushroom"]>} mushroom
   * @param {number} offset
   */
  setOffset(mushroom, offset) {
    if (mushroom.destroyed) {
      return;
    }
    const position = mushroom.entity.getLocalPosition();
    mushroom.entity.setLocalPosition(
      position.x,
      mushroom.baseY + offset,
      position.z,
    );
  }

  destroy() {
    this.#entity.destroy();
    this.#mushrooms = [];
    this.#debrisFeet = [];
    this.#mushroomsByEntity.clear();
    this.#entity = null;
    this.#rigidbodySystem = null;
  }

  /**
   *
   * @param {{normal: import("src/game/objects/ObjectTypes.js").Point3}} side
   */
  #createDebrisFoot(side) {
    const foot = new this.#pc.Entity(`Hero ${side} mushroom debris collider`);
    foot.tags.add(HERO_SURFACE_IGNORE_TAG);
    foot.setLocalPosition(0, -1000, 0);
    foot.addComponent("collision", {
      type: "sphere",
      radius: DEBRIS_FOOT_RADIUS,
    });
    foot.addComponent("rigidbody", {
      type: this.#pc.BODYTYPE_KINEMATIC,
      friction: 0.22,
      restitution: 0,
      group: this.#pc.BODYGROUP_USER_6,
      mask: this.#pc.BODYGROUP_USER_5,
    });
    this.#entity.addChild(foot);
    return foot;
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} directionX
   * @param {number} directionZ
   */
  #probeFoot(x, y, z, directionX, directionZ) {
    const hits = this.#rigidbodySystem.raycastAll(
      new this.#pc.Vec3(x, y + FOOT_PROBE_UP, z),
      new this.#pc.Vec3(x, y - FOOT_PROBE_DOWN, z),
      {
        sort: true,
        /**
         *
         * @param {import("playcanvas").Entity} entity
         */
        filterCallback: (entity) => this.#mushroomsByEntity.has(entity),
      },
    );
    for (const { entity } of hits) {
      const mushroom = this.#mushroomsByEntity.get(entity);
      if (!mushroom || mushroom.destroyed) {
        continue;
      }
      mushroom.destroyed = true;
      mushroom.entity.enabled = false;
      mushroom.onDestroy({ directionX, directionZ });
    }
  }
}
