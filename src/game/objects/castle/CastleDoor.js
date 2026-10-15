import { createCastleDoorCollision } from "./CastleDoorCollision.js";
import interiorDoorUrl from "../../models/castle/doors/interior-doors.glb?url";
import castleDoorsModelUrl from "../../models/castle/doors/castle-doors.glb?url";
import roundedEntranceUrl from "../../models/castle/doors/entrance-rounded.glb?url";
import { CASTLE_DOOR_ANIMATION } from "../../enum/CastleDoorAnimation.js";
import { NpcDoorAvoidance } from "../shared/NpcDoorAvoidance.js";
import entranceMasonryShader from "./CastleEntranceMasonry.frag?raw";
import entranceMasonryWgsl from "./CastleEntranceMasonry.wgsl?raw";

const DOOR_INSET = -0.18;
const OPEN_SPEED = 1.7;
const SWING_SAMPLE_STEP = 1 / 360;
const OPEN_DISTANCE = 1.8;
const CLOSE_INSIDE_DISTANCE = 0.9;
const CLICK_OPEN_SECONDS = 1;
const DOOR_HEIGHT = 2.3;


export class CastleDoor {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return castleDoorsModelUrl;
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [castleDoorsModelUrl, interiorDoorUrl, roundedEntranceUrl]; }

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
   * @type {import("playcanvas").StandardMaterial|null}
   */
  #archMaterial = null;
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
  #height = DOOR_HEIGHT;
  /**
   * @type {ReturnType<typeof createCastleDoorCollision>}
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

  get exteriorEntrance() { return this.#exteriorEntrance; }

  /**
   * A test override changes the destination, preserving collision-aware movement.
   * @param {number|null} value
   */
  set testOpenAmount(value) { this.#testOpenAmount = value; }

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
  get operator() { return this.#operator; }

  /**
   * @param {import("playcanvas").Entity|null} actor
   */
  set operator(actor) { this.#operator = actor; }

  get openAmount() { return this.#openAmount; }

  /**
   * The existing collision-aware update still owns the animated leaf.
   * @param {number|null} value
   */
  set sequenceOpenAmount(value) { this.#sequenceOpenAmount = value; }

  /**
   * @param {(() => boolean)|null} callback
   */
  set onOpen(callback) { this.#onOpen = callback; }

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
  set npcNavigation(query) { this.#canNpcMove = query; }

  /**
   * @param {import("yuka").Vector3} point
   * @type {(point: import("yuka").Vector3) => boolean}
   */
  #inNpcSwing = (point) => {
    const dx = point.x - this.#center.x;
    const dz = point.z - this.#center.z;

    return point.y < this.#center.y + this.#height && point.y + 2.2 > this.#center.y &&
      Math.abs(dx * this.#tangent.x + dz * this.#tangent.z) < this.#width / 2 + 0.6 &&
      Math.abs(dx * this.#inward.x + dz * this.#inward.z) < this.#width + 0.6;
  };

  /**
   *
   * @param {{pc: typeof import("playcanvas"), castlePosition: {x: number, z: number, width: number, depth: number, elevation: number}, door: import("src/game/objects/ObjectTypes.js").CastleDoorDefinition, modelLibrary: string, woodMaterial: import("playcanvas").Material}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} options.castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} options.door
   * @param {string} options.modelLibrary
   * @param {{x: number, y: number, z: number, yaw: number, height: number, arched?: boolean, mirrored?: boolean, frameOffset?:number}|null} options.placement
   * @param {import("playcanvas").Material} options.woodMaterial
   * @param {boolean} options.bundledEntrance Use the complete stone-and-timber entrance.
   * @param {Map<string, import("playcanvas").Material>|null} options.masonryMaterials
   */
  constructor({ pc, castlePosition, door, modelLibrary, placement = null, bundledEntrance = false, masonryMaterials = null }) {
    this.#exteriorEntrance = bundledEntrance || !placement;

    this.#pc = pc;

    this.#width = door.width;
    const framedInterior = Boolean(placement && !placement.arched);
    this.#height = framedInterior ? placement.height * DOOR_HEIGHT / 2.4 : placement?.height ?? DOOR_HEIGHT;
    this.#upperFloor = Boolean(placement);
    this.#elevated = Boolean(placement && placement.y > castlePosition.elevation + 0.24);
    const angle = (placement?.yaw ?? 0) * Math.PI / 180;
    const geometry = placement ? {
      center: {
        x: placement.x,
        y: placement.y,
        z: placement.z,
      },
      inward: {
        x: Math.sin(angle),
        z: Math.cos(angle),
      },
      tangent: {
        x: Math.cos(angle),
        z: -Math.sin(angle),
      },
      baseYaw: placement.yaw,
    } : this.#doorGeometry(castlePosition, door);

    if (placement?.openingInset) {
      geometry.center.x -= geometry.inward.x * placement.openingInset;
      geometry.center.z -= geometry.inward.z * placement.openingInset;
    }
    if (framedInterior) {
      // The frame extends behind the leaf into the quarter-metre wall.
      // Seat the inset leaf and its edge hinge within the wall depth.
      geometry.center.x += geometry.inward.x * (placement.frameOffset ?? 0.155);
      geometry.center.z += geometry.inward.z * (placement.frameOffset ?? 0.155);
    }
    if (bundledEntrance) {
      // Seat the complete reveal in the outer wall; its threshold top is floor zero.
      geometry.center.x -= geometry.inward.x * 0.15;
      geometry.center.z -= geometry.inward.z * 0.15;
    }
    this.#center = geometry.center;

    this.#inward = geometry.inward;

    this.#tangent = geometry.tangent;


    const modelUrl = bundledEntrance ? roundedEntranceUrl : placement && !placement.arched ? interiorDoorUrl : castleDoorsModelUrl;
    this.#entity = modelLibrary.instantiate(modelUrl);
    if (bundledEntrance && masonryMaterials) {
      const stone = masonryMaterials.get("castleStoneMid");
      // Radial stone joints are authored in the arch mesh, rather than wall courses.
      this.#archMaterial = new pc.StandardMaterial();
      this.#archMaterial.diffuse.copy(stone.diffuse);
      this.#archMaterial.diffuseVertexColor = true;
      this.#archMaterial.gloss = stone.gloss;
      this.#archMaterial.useMetalness = true;
      this.#archMaterial.metalness = 0;
      this.#archMaterial.forceUv1 = true;
      this.#archMaterial.shaderChunksVersion = pc.version.split(".").slice(0, 2).join(".");
      this.#archMaterial.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("diffusePS", entranceMasonryShader);
      this.#archMaterial.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set("diffusePS", entranceMasonryWgsl);
      this.#archMaterial.update();
      for (const render of this.#entity.findComponents("render")) {
        if (!render.entity.name.startsWith("Entrance masonry")) continue;
        const material = render.entity.name.startsWith("Entrance masonry arch") ||
            render.entity.name.startsWith("Entrance masonry course")
          ? this.#archMaterial : stone;
        for (const instance of render.meshInstances) {
          instance.material = material;
          if (material === this.#archMaterial) {
            instance.setParameter("uStoneFaceSize", render.entity.name.startsWith("Entrance masonry arch")
              ? [Math.PI * 0.97 / 11, 0.28] : [0.28, 1.704 / 7]);
          }
        }
      }
    }
    this.#entity.name = `Castle ${door.side.toLowerCase()} doors`;
    // Preserve the oak and iron materials authored with the entrance model.
    this.#entity.setLocalPosition(
      this.#center.x,
      this.#center.y + (bundledEntrance || framedInterior ? 0 : 0.025 * this.#height / DOOR_HEIGHT),
      this.#center.z,
    );
    this.#entity.setLocalEulerAngles(0, geometry.baseYaw + (!bundledEntrance && placement?.arched && placement.swing === "inward" ? 180 : 0), 0);
    if (placement) {
      // The authored frame is 0.5 m deep. At half scale both casing faces
      // coincide with the 0.25 m wall. Give each face physical clearance,
      // including the back casing; moving the frame only fixes one side.
      this.#entity.setLocalScale((placement.mirrored ? -1 : 1) * this.#width / 2, this.#height / DOOR_HEIGHT, framedInterior ? 0.54 : this.#width / 2);
    }
    if (framedInterior) {
      // Raise only the moving leaf: jambs meet the floor, while the leaf clears
      // the floor finish throughout its swing.
      const hinge = this.#entity.findByName("Right interior door hinge");
      const position = hinge.getLocalPosition().clone();
      position.y += 0.03;
      hinge.setLocalPosition(position);
    }
    const animationName = CASTLE_DOOR_ANIMATION.OPEN_WIDE;
    const animationTrack = modelLibrary
      .getAnimationTracks(modelUrl, [
        animationName,
      ])
      .get(animationName);
    this.#entity.addComponent("anim", { activate: true });
    this.#entity.anim.addAnimationState(
      animationName,
      animationTrack,
      1,
      false,
    );

    this.#animationLayer = this.#entity.anim.baseLayer;

    this.#animationDuration = animationTrack.duration;
    this.#animationLayer.play(animationName);
    this.#entity.anim.speed = 0;
    // Door motion samples the authored animation explicitly in #syncAnimation.
    // Avoid evaluating every stationary door again in the global animation tick.
    this.#entity.anim.playing = false;
    this.#syncAnimation();
    this.#collision = createCastleDoorCollision(pc, this.#entity);

  }

  get entity() {
    return this.#entity;
  }

  /**
   *
    * @returns {boolean}
   */
  get revealsInterior() {
    return this.#shouldOpen() || this.#openAmount > 0.001;
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
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getHit(rayStart, rayEnd) {
    if (!this.#entity) {
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
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    const hit = this.getHit(rayStart, rayEnd);

    return hit ? {
      ...hit,
      pointerTarget: this,
    } : null;
  }

  handlePointerDown() {
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
    const alignedWithDoor = lateralDistance <= this.#width / 2 + 0.8;

    if (!this.#upperFloor && insideDistance > CLOSE_INSIDE_DISTANCE) {
      this.#targetOpen = false;
    } else {
      this.#targetOpen =
        // Leave time for a full leaf to swing clear before a running visitor reaches it.
        alignedWithDoor && Math.abs(insideDistance) <= Math.max(OPEN_DISTANCE, this.#width + 1.3);
    }
    if (this.#targetOpen && !wasOpen) { this.#onOpen?.(); }
  }

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.#manualOpenRemaining = Math.max(
      0,
      this.#manualOpenRemaining - deltaTime,
    );
    const target = this.#testOpenAmount ?? Math.max(Number(this.#shouldOpen()), this.#sequenceOpenAmount ?? 0);
    if (Math.abs(target - this.#openAmount) > 0.000001 && this.#canNpcMove) {
      NpcDoorAvoidance.requestClearance(this.#entity, this.#inNpcSwing, this.#canNpcMove, null, this.#operator);
    }
    const amount = OPEN_SPEED * Math.max(0, deltaTime);
    const destination = this.#openAmount < target
      ? Math.min(target, this.#openAmount + amount)
      : Math.max(target, this.#openAmount - amount);
    if (destination === this.#openAmount) return;
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
      const npcObstructed = NpcDoorAvoidance.occupied(this.#entity, /**
       *
       * @param {import("yuka").Vector3} point
       */
        (point) =>
          this.#collision.blocksAt(point.x, point.y + 0.6, point.z, 0.5) ||
        this.#collision.blocksAt(point.x, point.y + 1.5, point.z, 0.5), this.#operator);
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
    if (this.#elevated) return false;
    return this.#collision.blocksAt(x, this.#center.y + 0.4, z, radius);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
    return this.#collision.blocksAt(x, y, z, radius);
  }

  destroy() {
    this.#collision?.destroy();
    this.#entity?.destroy();
    this.#archMaterial?.destroy();
    this.#archMaterial = null;
    this.#entity = null;
    this.#animationLayer = null;
    this.#onOpen = null;
    this.#operator = null;
    this.#sequenceOpenAmount = null;
  }

  /**
   *
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
   */
  #doorGeometry(castlePosition, door) {
    const geometryBySide = {
      WEST: {
        center: {
          x: castlePosition.x + DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: {
          x: 1,
          z: 0,
        },
        tangent: {
          x: 0,
          z: 1,
        },
        baseYaw: 90,
      },
      EAST: {
        center: {
          x: castlePosition.x + castlePosition.width - DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: {
          x: -1,
          z: 0,
        },
        tangent: {
          x: 0,
          z: 1,
        },
        baseYaw: -90,
      },
      NORTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + DOOR_INSET,
        },
        inward: {
          x: 0,
          z: 1,
        },
        tangent: {
          x: 1,
          z: 0,
        },
        baseYaw: 0,
      },
      SOUTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + castlePosition.depth - DOOR_INSET,
        },
        inward: {
          x: 0,
          z: -1,
        },
        tangent: {
          x: 1,
          z: 0,
        },
        baseYaw: 180,
      },
    };

    return geometryBySide[door.side];
  }

  #syncAnimation() {
    this.#animationLayer.activeStateCurrentTime =
      this.#animationDuration * this.#openAmount;
    this.#entity.anim.update(0);
  }

  #shouldOpen() {
    return this.#targetOpen || this.#manualOpenRemaining > 0;
  }
}
