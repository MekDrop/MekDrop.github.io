import { NpcDoorAvoidance } from "../../shared/NpcDoorAvoidance.js";
import { DoorLeafQueries } from "./DoorLeafQueries.js";
import { DoorJam } from "./DoorJam.js";

const SWING_SAMPLE_STEP = 1 / 360;
const OPEN_DISTANCE = 1.8;
const INTERIOR_OPEN_DISTANCE = 2.5;
const APPROACH_SPEED = 6.3;
const CLOSE_INSIDE_DISTANCE = 0.9;
const CLICK_OPEN_SECONDS = 1;

/**
 * Animated door behavior configured independently of its building and model.
 */
export class Door {
  /**
   * @type {number}
   */
  #health = 48;
  /**
   * @type {boolean}
   */
  #broken = false;

  /**
   * @returns {number}
   */
  get health() {
    return this.#health;
  }

  /**
   * @returns {number}
   */
  get maxHealth() {
    return 48;
  }

  /**
   * @returns {boolean}
   */
  get broken() {
    return this.#broken;
  }

  /**
   * @returns {number}
   */
  get clearWidth() {
    return this.#width;
  }

  /**
   * Remove only moving leaves; the frame and its Ammo bodies stay castle-owned.
   * @param {number} amount
   * @returns {number}
   */
  receiveDamage(amount) {
    if (!this.#entity || this.#broken || !Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    const applied = Math.min(amount, this.#health);
    this.#health -= applied;
    if (this.#health === 0) {
      this.#broken = true;
      this.clearGlue?.();
      this.#operator = null;
      this.#collision.syncFrameBodies?.();
      if (this.#collision.breakLeaves) {
        this.#collision.breakLeaves();
      } else if (this.#hinge) {
        this.#hinge.enabled = false;
      } else if (this.#animationEntity !== this.#entity) {
        this.#animationEntity.enabled = false;
      }
    }
    return applied;
  }

  /**
   * @type {DoorJam}
   */
  #jam = new DoorJam();

  /**
   * @returns {boolean}
   */
  get jammed() {
    return this.#jam.active;
  }

  /**
   * @param {{clear: Function}} source
   */
  jamShut(source) {
    return !this.#broken && this.#jam.attach(this.#openAmount, source);
  }

  /**
   * @param {{clear: Function}} source
   */
  releaseJam(source) {
    return this.#jam.release(source);
  }

  clearGlue() {
    this.#jam.clear();
  }
  /**
   * @type {import("playcanvas").Material[]}
   */
  #ownedMaterials;
  /**
   *
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #animationEntity;
  /**
   * @type {number}
   */
  #openSpeed;
  /**
   * @type {boolean}
   */
  #automatic;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #hinge;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #insideHandle;
  /**
   *
   * @type {import("playcanvas").AnimController}
   */
  #animationLayer;
  /**
   *
   * @type {number}
   */
  #animationDuration;
  /**
   *
   * @type {{x: number, y: number, z: number}}
   */
  #center;
  /**
   *
   * @type {{x: number, z: number}}
   */
  #inward;
  /**
   *
   * @type {{x: number, z: number}}
   */
  #tangent;
  /**
   *
   * @type {number}
   */
  #width;
  /**
   * @type {number}
   */
  #height;
  /**
   * @type {import("./DoorTypes.js").DoorCollision}
   */
  #collision;
  /**
   * @type {boolean}
   */
  #upperFloor = false;
  /**
   * @type {boolean}
   */
  #elevated = false;
  /**
   *
   * @type {boolean}
   */
  #targetOpen = false;
  /**
   *
   * @type {number}
   */
  #openAmount = 0;

  /**
   * @type {number|null}
   */
  #sequenceOpenAmount = null;
  /**
   * @type {number|null}
   */
  #testOpenAmount = null;
  /**
   * @type {boolean}
   */
  #exteriorEntrance = false;

  get exteriorEntrance() {
    return this.#exteriorEntrance;
  }

  /**
   * A test override changes the destination, preserving collision-aware movement.
   * @param {number|null} value
   */
  set testOpenAmount(value) {
    this.#testOpenAmount = value;
  }

  /**
   * @type {(() => boolean)|null}
   */
  #onOpen = null;

  /**
   * @type {import("playcanvas").Entity|null}
   */
  #operator = null;

  /**
   * @returns {import("playcanvas").Entity|null}
   */
  get operator() {
    return this.#operator;
  }

  /**
   * @param {import("playcanvas").Entity|null} actor
   */
  set operator(actor) {
    this.#operator = actor;
  }

  /**
   * @returns {number}
   */
  get openAmount() {
    return this.#broken ? 1 : this.#openAmount;
  }

  /**
   * The existing collision-aware update still owns the animated leaf.
   * @param {number|null} value
   */
  set sequenceOpenAmount(value) {
    this.#sequenceOpenAmount = value;
  }

  /**
   * @param {(() => boolean)|null} callback
   */
  set onOpen(callback) {
    this.#onOpen = callback;
  }

  /**
   *
   * @type {number}
   */
  #manualOpenRemaining = 0;
  /**
   * @type {((point: import("yuka").Vector3) => boolean)|null}
   */
  #canNpcMove = null;

  /**
   * @param {(point: import("yuka").Vector3) => boolean} query
   */
  set npcNavigation(query) {
    this.#canNpcMove = query;
  }

  /**
   * @param {import("yuka").Vector3} point
   * @type {(point: import("yuka").Vector3) => boolean}
   */
  #inNpcSwing = (point) => {
    // Reserve ahead of the actual leaf, rather than the whole doorway room.
    // Ammo still checks every swing increment and waits while occupants yield.
    return this.#collision.blocksAt(point.x, point.y + 0.6, point.z, 0.6) ||
      this.#collision.blocksAt(point.x, point.y + 1.5, point.z, 0.6);
  };

  /**
   * @param {import("./DoorTypes.js").DoorOptions} options
   */
  constructor({
    modelLibrary,
    modelUrl,
    frameModelUrl = null,
    entity = modelLibrary.instantiate(frameModelUrl ?? modelUrl),
    animationEntity = frameModelUrl ? modelLibrary.instantiate(modelUrl) : entity,
    pc,
    name = null,
    materialBindings = [],
    materials = {},
    ownedMaterials = [],
    leafBounds = null,
    animationName,
    collision,
    center = entity.getLocalPosition().clone(),
    inward = {
      x: 0,
      z: 1,
    },
    tangent = {
      x: 1,
      z: 0,
    },
    width = 1,
    height = 1.25,
    upperFloor = false,
    elevated = false,
    exteriorEntrance = false,
    openSpeed = 1.7,
    automatic = true,
    onOpen = null,
    hingeName = null,
    handleName = null,
  }) {
    this.#entity = entity;
    this.#ownedMaterials = ownedMaterials;
    this.#animationEntity = animationEntity;
    if (name) {
      entity.name = name;
    }
    if (animationEntity !== entity) {
      entity.addChild(animationEntity);
    }
    this.#applyMaterials(materialBindings, materials);
    this.#center = center;
    this.#inward = inward;
    this.#tangent = tangent;
    this.#width = width;
    this.#height = height;
    this.#upperFloor = upperFloor;
    this.#elevated = elevated;
    this.#exteriorEntrance = exteriorEntrance;
    this.#openSpeed = openSpeed;
    this.#automatic = automatic;
    this.#onOpen = onOpen;
    this.#hinge = hingeName ? entity.findByName(hingeName) : null;
    this.#insideHandle = handleName ? entity.findByName(handleName) : null;
    const track = modelLibrary.getAnimationTracks(modelUrl, [animationName]).get(animationName);
    animationEntity.addComponent("anim", { activate: true });
    animationEntity.anim.addAnimationState(animationName, track, 1, false);
    this.#animationLayer = animationEntity.anim.baseLayer;
    this.#animationDuration = track.duration;
    this.#animationLayer.play(animationName);
    animationEntity.anim.speed = 0;
    animationEntity.anim.playing = false;
    this.#syncAnimation();
    this.#collision = (typeof collision === "function" ? collision() : collision) ?? new DoorLeafQueries({
      pc,
      hinge: this.#hinge,
      ...leafBounds,
    });
  }

  get insideHandle() {
    return this.#insideHandle;
  }

  /**
   * The moving leaf's frame, independent of collision-query hinge configuration.
   * @returns {import("playcanvas").Quat|null}
   */
  get handleRotation() {
    return this.#insideHandle?.parent?.getRotation() ?? null;
  }

  /**
   * @returns {import("playcanvas").Quat|null}
   */
  get hingeRotation() {
    return this.#hinge?.getRotation() ?? null;
  }

  /**
   * Direct pose control is reserved for doors without a physical swing probe.
   * @param {number} value
   */
  set openAmount(value) {
    if (this.#broken || this.jammed) {
      return;
    }
    if (this.#collision.swing) {
      this.#sequenceOpenAmount = Math.max(0, Math.min(1, value));

      return;
    }
    this.#openAmount = Math.max(0, Math.min(1, value));
    this.#syncAnimation();
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @returns {boolean}
   */
  get revealsInterior() {
    return this.#broken || this.#shouldOpen() || this.#openAmount > 0.001;
  }

  /**
   *
   * @param {number} duration
   */
  openTemporarily(duration = CLICK_OPEN_SECONDS) {
    this.#manualOpenRemaining = Math.max(
      this.#manualOpenRemaining,
      duration,
    );
  }

  /**
   *
   * @param {import("playcanvas").Vec3} rayStart
   * @param {import("playcanvas").Vec3} rayEnd
   */
  getHit(rayStart, rayEnd) {
    if (!this.#entity || this.#broken) {
      return null;
    }
    const distance = this.#collision.raycast(rayStart, rayEnd);
    if (distance === null) {
      return null;
    }
    return {
      distance,
      door: this,
    };
  }

  /**
   *
   * @param {import("playcanvas").Vec3} rayStart
   * @param {import("playcanvas").Vec3} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    const hit = this.getHit(rayStart, rayEnd);

    return hit ? {
      ...hit,
      pointerTarget: this,
    } : null;
  }

  handlePointerDown() {
    if (this.#broken) {
      return false;
    }
    this.#testOpenAmount = null;
    if (this.#onOpen) {
      return this.#onOpen();
    }
    this.openTemporarily();

    return true;
  }

  /**
   *
   * @param {{x: number, y?: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.z
   */
  updateHeroPosition({ x, y, z }) {
    if (this.#broken || !this.#automatic) {
      return;
    }
    if (this.#upperFloor && (y === undefined || Math.abs(y - this.#center.y) > 0.7)) {
      this.#targetOpen = false;

      return;
    }
    const wasOpen = this.#targetOpen;
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const insideDistance = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    const lateralDistance = Math.abs(
      deltaX * this.#tangent.x + deltaZ * this.#tangent.z,
    );
    const openingLead = this.#exteriorEntrance ? APPROACH_SPEED / this.#openSpeed : 0;
    const lateralAllowance = this.#exteriorEntrance ? 0.8 + openingLead : 0.4;
    const alignedWithDoor = lateralDistance <= this.#width / 2 + lateralAllowance;
    const approachDistance = this.#exteriorEntrance
      ? Math.max(OPEN_DISTANCE, this.#width + 0.6 + openingLead)
      : INTERIOR_OPEN_DISTANCE;

    if (!this.#upperFloor && insideDistance > CLOSE_INSIDE_DISTANCE) {
      this.#targetOpen = false;
    } else {
      this.#targetOpen =
        // Interior doors respond only to visitors approaching their own doorway.
        alignedWithDoor &&
        Math.abs(insideDistance) <= approachDistance;
    }
    if (this.#targetOpen && !wasOpen) {
      this.#onOpen?.();
    }
  }

  /**
   *
   * @param {number} deltaTime
   * @param {boolean} [open] Explicit opening target for scripted doors.
   * @param {number} [speed] Opening speed override.
   */
  update(deltaTime, open, speed = this.#openSpeed) {
    if (this.#broken) {
      this.#collision.syncFrameBodies?.();

      return;
    }
    this.#manualOpenRemaining = Math.max(
      0,
      this.#manualOpenRemaining - deltaTime,
    );
    // Keep the existing leaf pose and Ammo collision bodies together while held.
    if (this.jammed) {
      return;
    }
    const target = this.#testOpenAmount ?? Math.max(Number(open ?? this.#shouldOpen()), this.#sequenceOpenAmount ?? 0);
    if (Math.abs(target - this.#openAmount) > 0.000001 && this.#canNpcMove) {
      NpcDoorAvoidance.requestClearance(this.#entity, this.#inNpcSwing, this.#canNpcMove, null, this.#operator);
    }
    const amount = speed * Math.max(0, deltaTime);
    const destination = this.#openAmount < target
      ? Math.min(target, this.#openAmount + amount)
      : Math.max(target, this.#openAmount - amount);
    if (destination === this.#openAmount) {
      return;
    }
    if (!this.#collision.swing) {
      this.#openAmount = destination;
      this.#syncAnimation();

      return;
    }
    // Existing hinge/support contacts may clear, but must not deepen as the leaf swings.
    this.#collision.syncFrameBodies();
    const initialContacts = this.#collision.swing.contacts();
    const direction = Math.sign(destination - this.#openAmount);
    // Sample the entire arc, including when a delayed frame spans both sides of a wall.
    while (Math.abs(destination - this.#openAmount) > 0.000001) {
      const previous = this.#openAmount;
      this.#openAmount += direction * Math.min(SWING_SAMPLE_STEP, Math.abs(destination - previous));
      this.#syncAnimation();
      const contacts = this.#collision.swing.contacts();
      const obstructed = [...contacts].some(/**
       *
       * @param {number[]} entry
       */
        (entry) =>
          entry[1] > Math.max(0.002, initialContacts.get(entry[0]) ?? 0) + 0.000001);
      const npcObstructed = NpcDoorAvoidance.occupied(
        this.#entity,
        this.#occupied.bind(this),
        this.#operator,
      );
      if (obstructed || npcObstructed) {
        this.#openAmount = previous;
        break;
      }
    }
    this.#syncAnimation();
    this.#collision.swing.syncBodies();
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsFootprint(x, z, radius) {
    // Ground navigation must not inherit a bedroom door several metres above it.
    if (this.#broken || this.#elevated) {
      return false;
    }
    return this.#collision.blocksAt(x, this.#center.y + 0.4, z, radius);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
    return !this.#broken && this.#collision.blocksAt(x, y, z, radius);
  }

  destroy() {
    this.clearGlue();
    this.#collision?.destroy();
    this.#entity?.destroy();
    for (const material of this.#ownedMaterials) {
      material.destroy();
    }
    this.#ownedMaterials = [];
    this.#hinge = null;
    this.#insideHandle = null;
    this.#entity = null;
    this.#animationEntity = null;
    this.#animationLayer = null;
    this.#onOpen = null;
    this.#operator = null;
    this.#sequenceOpenAmount = null;
  }

  #syncAnimation() {
    this.#animationLayer.activeStateCurrentTime =
      this.#animationDuration * this.#openAmount;
    this.#animationEntity.anim.update(0);
  }

  /**
   * @param {import("./DoorTypes.js").DoorMaterialBinding[]} bindings
   * @param {Record<string, import("playcanvas").Material>} materials
   */
  #applyMaterials(bindings, materials) {
    const pending = [this.#entity];
    while (pending.length) {
      const entity = pending.pop();
      for (const instance of entity.render?.meshInstances ?? []) {
        for (const binding of bindings) {
          const material = materials[binding.material];
          const names = [entity.name, instance.node?.name ?? ""];
          const matches = names.some(/**
           *
           * @param {string} name
           */
            (name) =>
              binding.names?.includes(name) || binding.prefixes?.some(/**
             *
             * @param {string} prefix
             */
                (prefix) => name.startsWith(prefix)));
          if (material && matches) {
            instance.material = material;
          }
        }
      }
      pending.push(...entity.children);
    }
  }

  #shouldOpen() {
    return this.#targetOpen || this.#manualOpenRemaining > 0;
  }

  /**
   *
   * @param {import("yuka").Vector3} point
   */
  #occupied(point) {
    return (
      this.#collision.blocksAt(point.x, point.y + 0.6, point.z, 0.5) ||
        this.#collision.blocksAt(point.x, point.y + 1.5, point.z, 0.5)
    );
  }
}
