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
  #pc;
  #entity;
  #rigidbodySystem;
  #debrisFeet = [];
  #mushrooms = [];
  #mushroomsByEntity = new Map();

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
      entity,
      onDestroy,
    };
    this.#entity.addChild(entity);
    this.#mushrooms.push(mushroom);
    this.#mushroomsByEntity.set(entity, mushroom);
    return mushroom;
  }

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

  hide(mushroom) {
    if (!mushroom || mushroom.destroyed) {
      return;
    }
    mushroom.destroyed = true;
    mushroom.entity.enabled = false;
  }

  destroy() {
    this.#entity.destroy();
    this.#mushrooms = [];
    this.#debrisFeet = [];
    this.#mushroomsByEntity.clear();
    this.#entity = null;
    this.#rigidbodySystem = null;
  }

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

  #probeFoot(x, y, z, directionX, directionZ) {
    const hits = this.#rigidbodySystem.raycastAll(
      new this.#pc.Vec3(x, y + FOOT_PROBE_UP, z),
      new this.#pc.Vec3(x, y - FOOT_PROBE_DOWN, z),
      {
        sort: true,
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
