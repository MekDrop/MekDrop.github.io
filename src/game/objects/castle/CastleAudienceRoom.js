import lanternModelUrl from "../../models/castle/residential/wall-lantern.glb?url";
import carpetModelUrl from "../../models/castle/residential/carpet-panel.glb?url";
import floorModelUrl from "../../models/castle/residential/floor-panel.glb?url";
import authoredModelUrl from "../../models/castle/residential/stone-block.glb?url";
import { CastleThrone } from "./CastleThrone.js";
import { CastleFire } from "./CastleFire.js";
import { GAME_OVER_VIEW_ROTATION_BY_SIDE } from "../../enum/GameOverViewRotation.js";
import { colorFromHex } from "../../helpers/colors.js";

const ROOM_MATERIALS = {
  carpet: { color: 0xffffff, gloss: 0.04 },
  wood: { color: 0x4a281a, gloss: 0.05 },
  woodLight: { color: 0x6b3a22, gloss: 0.06 },
  gold: { color: 0xd8a936, gloss: 0.36, metalness: 0.28 },
  iron: { color: 0x171b1d, gloss: 0.16 },
  banner: { color: 0x234f9b, gloss: 0.05 },
  bannerLight: { color: 0x3974c7, gloss: 0.06 },
};

const EDGE_MARGIN = 0.82;
const MAX_ROOM_DEPTH = 4.1;
const DEFAULT_FRONT_WALL_DEPTH = 0.5;
const VISIBILITY_MARGIN = 0.85;
const CARPET_ENTRANCE_INSET = 0.32;
const CARPET_REAR_CLEARANCE = 0.36;
const THRONE_SCALE = 0.85;
// The authored throne dais extends 0.875 units behind its origin.
const THRONE_REAR_CLEARANCE = 0.9;
const ROYAL_COLLISION_RADIUS = 0.22;
const ROYAL_DOORWAY_INSIDE = 0.35;
const ROYAL_DOORWAY_OUTSIDE = -0.35;

/**
 * Visitor-facing castle audience chamber.
 *
 * `position` is the castle map footprint and `door` is one generated castle
 * door descriptor. Add `entity` to the castle root. `occupant` accepts
 * "king", "queen", or "princess".
 */
export class CastleAudienceRoom {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [CastleThrone.modelUrl, authoredModelUrl, floorModelUrl, carpetModelUrl, lanternModelUrl, ...CastleFire.modelUrls];
  }

  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Application}
   */
  #app;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {TerraceDoor}
   */
  #door;
  /**
   *
    * @type {SeatedRoyal|null}
   */
  #occupant;
  /**
   *
    * @type {Map<string, import("playcanvas").Material>}
   */
  #sharedMaterials;
  /**
   *
    * @type {string}
   */
  #modelLibrary;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {Map<string, import("playcanvas").StandardMaterial>}
   */
  #materials = new Map();
  /**
   *
    * @type {CastleFire|null}
   */
  #fire = null;
  /**
   *
    * @type {{x: number, y: number, z: number}|null}
   */
  #royalPosition = null;
  /**
   *
    * @type {CastleThrone|null}
   */
  #throne = null;
  /**
   *
    * @type {{x: number, z: number}}
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
  #forwardCapacity;
  /**
   *
    * @type {number}
   */
  #roomWidth;
  /**
   * @type {number}
   */
  #floorWidth;
  /**
   * @type {number}
   */
  #floorLateral;
  /**
   * @type {number}
   */
  #floorDepth;
  /**
   *
    * @type {number}
   */
  #baseY;
  /**
   *
    * @type {number}
   */
  #availableDepth;
  /**
   *
    * @type {number}
   */
  #availableWidth;
  /**
   *
    * @type {number}
   */
  #frontWallDepth;
  /**
   *
    * @type {Array<{lateral: number, forward: number, width: number, depth: number}>}
   */
  #obstacles = [];
  /**
   *
    * @type {Array<{lateral: number, forward: number, width: number, depth: number, height: number}>}
   */
  #floorSurfaces = [];
  /**
   * @type {{x: number, z: number, radius: number}|null}
   */
  #serviceOpening = null;
  /**
   * @type {import("./CastleResidentialLayout.js").CastleResidentialLayout|null}
   */
  #residentialLayout = null;
  /**
   *
    * @type {boolean}
   */
  #heroWithinVisibility = false;
  /**
   *
    * @type {boolean}
   */
  #entranceVisible = true;
  /**
   *
    * @type {boolean}
   */
  #gameOverPerformance = false;
  /**
   *
    * @type {boolean}
   */
  #gameOverPerformanceStarted = false;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #gameOverEndPosition = null;
  /**
   *
    * @type {{waypoints: Array<{x: number, y: number, z: number}>, collisionRadius: number, isBlocked: (x: number, z: number, radius: number) => boolean}|null}
   */
  #gameOverRoute = null;
  /**
   *
    * @type {(() => {x: number, y: number, z: number})|null}
   */
  #getGameOverCameraPosition = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, position: {x: number, y: number, z: number}, door: import("src/game/objects/ObjectTypes.js").CastleDoorDefinition, occupant: SeatedRoyal, materials: Map<string, import("playcanvas").Material>, availableDepth: number, availableWidth: number, frontWallDepth: number, modelLibrary: string, fireParticleTexture: import("playcanvas").Texture, carpetTexture: import("playcanvas").Texture}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {{x: number, y: number, z: number}} options.position
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} options.door
   * @param {SeatedRoyal} options.occupant
   * @param {Map<string, import("playcanvas").Material>} options.materials
   * @param {number} options.availableDepth
   * @param {number} options.availableWidth
   * @param {number} options.frontWallDepth
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Texture} options.carpetTexture
   * @param {import("./CastleResidentialLayout.js").CastleResidentialLayout|null} options.residentialLayout
   * @param {{x: number, z: number, radius: number}|null} options.serviceOpening
   * @param {import("playcanvas").Texture} options.fireParticleTexture
   */
  constructor({
    pc,
    app,
    position,
    door,
    occupant,
    materials = new Map(),
    availableDepth = MAX_ROOM_DEPTH,
    availableWidth = Number.POSITIVE_INFINITY,
    frontWallDepth = DEFAULT_FRONT_WALL_DEPTH,
    modelLibrary,
    fireParticleTexture,
    carpetTexture,
    serviceOpening = null,
    residentialLayout = null,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#position = position;
    this.#door = door;
    this.#occupant = occupant;
    this.#sharedMaterials = materials;
    this.#modelLibrary = modelLibrary;
    this.#availableDepth = availableDepth;
    this.#availableWidth = availableWidth;
    this.#frontWallDepth = frontWallDepth;
    this.#residentialLayout = residentialLayout;
    this.#entity = new pc.Entity("Castle audience chamber");
    this.#baseY = position.elevation ?? 0;
    this.#fire = new CastleFire({
      pc,
      app,
      particleTexture: fireParticleTexture,
      modelLibrary,
    });
    this.#entity.addChild(this.#fire.entity);

    this.#resolveLayout();
    if (serviceOpening) {
      const dx = serviceOpening.x - this.#center.x;
      const dz = serviceOpening.z - this.#center.z;
      this.#serviceOpening = {
        x: dx * this.#tangent.x + dz * this.#tangent.z,
        z: dx * this.#inward.x + dz * this.#inward.z,
        radius: serviceOpening.radius,
      };
    }
    this.#createMaterials();
    this.#materials.get("carpet").diffuseMap = carpetTexture ?? null;
    this.#materials.get("carpet").update();
    this.#build();
    this.#entity.enabled = true;
  }

  get entity() {
    return this.#entity;
  }

  set occupant(occupant) {
    this.#occupant = occupant;
    if (this.#occupant && this.#royalPosition) {
      this.#placeOccupant();
    }
  }

  /**
   *
   * @param {{x: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.z
   */
  updateHeroPosition({ x, z }) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const lateral = deltaX * this.#tangent.x + deltaZ * this.#tangent.z;
    const forward = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    this.#heroWithinVisibility =
      Math.abs(lateral) <= this.#roomWidth / 2 + VISIBILITY_MARGIN &&
      forward >= -VISIBILITY_MARGIN &&
      forward <= this.#forwardCapacity + VISIBILITY_MARGIN;
    this.#syncVisibility();
  }

  set entranceVisible(visible) {
    this.#entranceVisible = visible;
    this.#syncVisibility();
  }

  set royalVisible(visible) {
    if (this.#occupant) {
      this.#occupant.entity.enabled = visible || this.#gameOverPerformance;
    }
  }

  /**
   *
   * @param {() => {x: number, y: number, z: number}} getCameraPosition
   * @param {(x: number, z: number, radius: number) => boolean} isBlocked
   */
  beginGameOver(getCameraPosition, isBlocked = () => false) {
    if (this.#gameOverPerformance || !this.#occupant || !this.#royalPosition) {
      return null;
    }
    this.#gameOverPerformance = true;
    const destination = this.#occupant.gameOverDestination ?? {
      lateral: 0,
      forward: -1.15,
      elevation: 0.05,
    };
    const endPosition = this.#point(
      destination.lateral,
      destination.forward,
      destination.elevation,
    );
    this.#gameOverEndPosition = endPosition;
    // The presentation is scripted rather than rigid-body driven, so route it
    // through the known doorway corridor and query the castle's real wall
    // collision columns before accepting each animated step.
    this.#gameOverRoute = {
      waypoints: [
        { ...this.#royalPosition },
        this.#point(0, ROYAL_DOORWAY_INSIDE, destination.elevation),
        this.#point(0, ROYAL_DOORWAY_OUTSIDE, destination.elevation),
        { ...endPosition },
      ],
      collisionRadius: ROYAL_COLLISION_RADIUS,
      isBlocked,
    };
    this.#getGameOverCameraPosition = getCameraPosition;
    this.#syncVisibility();
    const visualBounds = this.#occupant.visualBounds;
    const currentPosition = this.#occupant.entity.getPosition();
    const endWorldPosition = this.#entity
      .getWorldTransform()
      .transformPoint(
        new this.#pc.Vec3(endPosition.x, endPosition.y, endPosition.z),
      );
    return {
      focus: {
        x: endWorldPosition.x + visualBounds.center.x - currentPosition.x,
        y: endWorldPosition.y + visualBounds.center.y - currentPosition.y,
        z: endWorldPosition.z + visualBounds.center.z - currentPosition.z,
      },
      visualSize: visualBounds.size,
      viewRotation: GAME_OVER_VIEW_ROTATION_BY_SIDE[this.#door.side] ?? 0,
    };
  }

  startGameOverPerformance() {
    if (
      !this.#gameOverPerformance ||
      this.#gameOverPerformanceStarted ||
      !this.#occupant ||
      !this.#royalPosition ||
      !this.#gameOverEndPosition ||
      !this.#gameOverRoute
    ) {
      return;
    }
    this.#gameOverPerformanceStarted = true;
    this.#occupant.beginGameOver({
      route: this.#gameOverRoute,
      getCameraPosition: this.#getGameOverCameraPosition,
    });
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   */
  surfaceHeightAt(x, z) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const lateral = deltaX * this.#tangent.x + deltaZ * this.#tangent.z;
    const forward = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    const insideFloor =
      Math.abs(lateral - this.#floorLateral) <= this.#floorWidth / 2 &&
      forward >= -0.08 &&
      forward <= this.#floorDepth;
    if (!insideFloor) {
      return null;
    }
    let height = null;
    for (const surface of this.#floorSurfaces) {
      if (
        Math.abs(lateral - surface.lateral) <= surface.width / 2 &&
        Math.abs(forward - surface.forward) <= surface.depth / 2
      ) {
        height = Math.max(height ?? this.#baseY, surface.height);
      }
    }
    return height;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsFootprint(x, z, radius = 0) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const lateral = deltaX * this.#tangent.x + deltaZ * this.#tangent.z;
    const forward = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    return this.#obstacles.some(/**
     *
     * @param {{x: number, z: number, radius: number}} obstacle
     */
    (obstacle) => {
      const distanceLateral = Math.max(
        Math.abs(lateral - obstacle.lateral) - obstacle.width / 2,
        0,
      );
      const distanceForward = Math.max(
        Math.abs(forward - obstacle.forward) - obstacle.depth / 2,
        0,
      );
      return (
        distanceLateral * distanceLateral + distanceForward * distanceForward <=
        radius * radius
      );
    });
  }

  destroy() {
    this.#fire?.destroy();
    this.#fire = null;
    this.#occupant = null;
    this.#throne?.destroy();
    this.#throne = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    this.#obstacles = [];
    this.#floorSurfaces = [];
  }

  #resolveLayout() {
    const { x, z, width, depth } = this.#position;
    const doorWidth = this.#door.width ?? 2;
    const offset = this.#door.offset ?? 0;
    const definitions = {
      WEST: {
        center: { x, z: z + offset + doorWidth / 2 },
        inward: { x: 1, z: 0 },
        tangent: { x: 0, z: 1 },
        capacity: width,
        span: depth,
      },
      EAST: {
        center: { x: x + width, z: z + offset + doorWidth / 2 },
        inward: { x: -1, z: 0 },
        tangent: { x: 0, z: 1 },
        capacity: width,
        span: depth,
      },
      NORTH: {
        center: { x: x + offset + doorWidth / 2, z },
        inward: { x: 0, z: 1 },
        tangent: { x: 1, z: 0 },
        capacity: depth,
        span: width,
      },
      SOUTH: {
        center: { x: x + offset + doorWidth / 2, z: z + depth },
        inward: { x: 0, z: -1 },
        tangent: { x: 1, z: 0 },
        capacity: depth,
        span: width,
      },
    };
    const layout = definitions[this.#door.side] ?? definitions.NORTH;
    this.#center = layout.center;
    this.#inward = layout.inward;
    this.#tangent = layout.tangent;
    const footprintCapacity = Math.max(0, layout.capacity - EDGE_MARGIN * 2);
    const castleCapacity = Math.max(0, this.#availableDepth);
    this.#forwardCapacity = Math.min(
      MAX_ROOM_DEPTH,
      footprintCapacity,
      castleCapacity,
    );
    // Coverage follows the masonry, independently of the furnished area and
    // its doorway-centred width. Off-centre doors leave unequal side strips.
    const wallDepth = Math.max(0, this.#frontWallDepth);
    this.#floorWidth = Math.max(0, layout.span - wallDepth * 2);
    this.#floorLateral = layout.span / 2 - offset - doorWidth / 2;
    this.#floorDepth = Math.min(
      Math.max(0, layout.capacity - wallDepth),
      castleCapacity,
    );
    this.#roomWidth = Math.max(
      0,
      Math.min(layout.span - EDGE_MARGIN * 2, this.#availableWidth, 6.4),
    );
    if (this.#residentialLayout) {
      const shared = this.#residentialLayout;
      const room = shared.rooms.work;
      const angle = shared.yaw * Math.PI / 180;
      const lateral = (room.minX + room.maxX) / 2;
      this.#center = { x: shared.origin.x + Math.cos(angle) * lateral, z: shared.origin.z - Math.sin(angle) * lateral };
      this.#inward = { x: Math.sin(angle), z: Math.cos(angle) };
      this.#tangent = { x: Math.cos(angle), z: -Math.sin(angle) };
      this.#floorWidth = room.maxX - room.minX;
      this.#floorLateral = 0;
      this.#floorDepth = room.maxZ;
      this.#frontWallDepth = room.minZ;
      this.#roomWidth = this.#floorWidth;
      this.#forwardCapacity = room.maxZ;
    }
  }

  #createMaterials() {
    for (const [name, definition] of Object.entries(ROOM_MATERIALS)) {
      const sharedName = {
        wood: "castleDoor",
        woodLight: "castleDoorLight",
        iron: "castleIron",
      }[name];
      const shared = sharedName ? this.#sharedMaterials.get(sharedName) : null;
      if (shared) continue;

      const material = new this.#pc.StandardMaterial();
      material.name = `Audience room ${name}`;
      material.diffuse = colorFromHex(this.#pc, definition.color);
      material.gloss = definition.gloss ?? 0.08;
      material.metalness = definition.metalness ?? 0;
      material.useMetalness = true;
      if (definition.emissive) {
        material.emissive = colorFromHex(this.#pc, definition.emissive);
        material.emissiveIntensity = 1.5;
      }
      material.update();
      this.#materials.set(name, material);
    }
  }

  #build() {
    const throneZone = this.#residentialLayout?.reservations.find(/**
     * @param {{role: string, maxZ: number}} zone
     */ (zone) => zone.role === "throne");
    const throneForward = throneZone ? throneZone.maxZ - THRONE_REAR_CLEARANCE : Math.max(0, this.#floorDepth - THRONE_REAR_CLEARANCE);
    this.#buildFloor(throneForward);
    this.#buildThrone(throneForward);
    this.#buildColumns(throneForward);
    this.#buildBraziers(throneForward);
    this.#buildRearBanners(throneForward);
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} throneForward
   */
  #buildFloor(throneForward) {
    const firstFloorPart = this.#entity.children.length;
    // Keep the wide room slab behind the facade. Only the doorway-width
    // threshold may cross the front wall, otherwise opening the doors exposes
    // the slab through the masonry on oblique castle views.
    const floorInset = Math.min(
      Math.max(0, this.#frontWallDepth),
      this.#floorDepth,
    );
    // Timber meets the interior wall faces; the gate threshold remains stone.
    const finishInset = 0;
    const finishStart = floorInset + finishInset;
    const roomFloorDepth = Math.max(0, this.#floorDepth - finishStart - finishInset);
    const roomFloorCenter = finishStart + roomFloorDepth / 2;
    const entranceFloorWidth = Math.min(
      this.#roomWidth,
      Math.max(0, this.#door.width ?? 2),
    );
    if (roomFloorDepth > 0) {
      this.#boxAt(
        "Audience wooden floor",
        "woodLight",
        this.#floorLateral,
        roomFloorCenter,
        0.025,
        [this.#floorWidth - finishInset * 2, 0.05, roomFloorDepth],
      );
    }
    if (!this.#residentialLayout && floorInset > 0 && entranceFloorWidth > 0) {
      this.#boxAt(
        "Audience entrance floor",
        "woodLight",
        0,
        floorInset / 2,
        0.025,
        [entranceFloorWidth, 0.05, floorInset],
      );
    }
    for (const lateral of [
      this.#floorLateral - this.#floorWidth / 2 + 0.05 + finishInset,
      this.#floorLateral + this.#floorWidth / 2 - 0.05 - finishInset,
    ]) {
      if (roomFloorDepth <= 0) {
        continue;
      }
      this.#boxAt(
        "Audience floor border",
        "wood",
        lateral,
        roomFloorCenter,
        0.057,
        [0.1, 0.025, roomFloorDepth],
      );
    }
    for (
      let forward = Math.max(0.75, finishStart);
      forward < this.#floorDepth - finishInset;
      forward += 0.75
    ) {
      this.#boxAt(
        "Audience floor plank seam",
        "wood",
        this.#floorLateral,
        forward,
        0.057,
        [Math.max(0, this.#floorWidth - finishInset * 2 - 0.22), 0.025, 0.035],
      );
    }

    const runnerStart = Math.max(CARPET_ENTRANCE_INSET, floorInset + 0.1);
    const runnerEnd = Math.min(
      throneForward - 0.07,
      this.#floorDepth - CARPET_REAR_CLEARANCE,
    );
    const runnerLength = Math.max(0, runnerEnd - runnerStart);
    const runnerCenter = runnerStart + runnerLength / 2;
    const runnerWidth = Math.min(1.2, this.#roomWidth - 0.36);
    const carpetMaterial = this.#materials.get("carpet");
    const texture = carpetMaterial.diffuseMap;
    // The texture border belongs to the complete runner, never each floor tile.
    carpetMaterial.diffuseMapTiling = new this.#pc.Vec2(1, 1);
    if (texture) texture.addressV = this.#pc.ADDRESS_CLAMP_TO_EDGE;
    carpetMaterial.update();
    this.#boxAt("Audience carpet runner", "carpet", 0, runnerCenter, 0.055, [
      runnerWidth,
      0.06,
      runnerLength,
    ]);
    // The same authored floor boxes define foot support, including the carpet
    // and plank borders, so boots cannot sink into the visuals.
    for (const part of this.#entity.children.slice(firstFloorPart)) {
      const position = part.getLocalPosition();
      const scale = part.getLocalScale();
      const dx = position.x - this.#center.x;
      const dz = position.z - this.#center.z;
      this.#floorSurfaces.push({
        lateral: dx * this.#tangent.x + dz * this.#tangent.z,
        forward: dx * this.#inward.x + dz * this.#inward.z,
        width: scale.x,
        depth: scale.z,
        height: position.y + scale.y / 2,
      });
    }
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} throneForward
   */
  #buildThrone(throneForward) {
    this.#throne = new CastleThrone({ modelLibrary: this.#modelLibrary });
    const throne = this.#throne.entity;
    const thronePosition = this.#point(0, throneForward, 0);
    throne.setLocalPosition(
      thronePosition.x,
      thronePosition.y,
      thronePosition.z,
    );
    throne.setLocalEulerAngles(0, this.#roomYaw(), 0);
    throne.setLocalScale(THRONE_SCALE, THRONE_SCALE, THRONE_SCALE);
    this.#entity.addChild(throne);
    this.#obstacles.push({
      lateral: 0,
      forward: throneForward + 0.1 * THRONE_SCALE,
      width: 2.6 * THRONE_SCALE,
      depth: 1.55 * THRONE_SCALE,
    });

    const royalPosition = this.#point(
      0,
      throneForward - 0.07 * THRONE_SCALE,
      0.37 * THRONE_SCALE,
    );
    this.#royalPosition = royalPosition;
    this.#placeOccupant();
  }

  #placeOccupant() {
    if (!this.#occupant || !this.#royalPosition) {
      return;
    }
    const royalPosition = this.#royalPosition;
    this.#occupant.entity.setLocalPosition(
      royalPosition.x,
      royalPosition.y,
      royalPosition.z,
    );
    this.#occupant.entity.setLocalEulerAngles(0, this.#visitorFacingYaw(), 0);
    const scale = (0.72 + this.#occupant.terraceScale) / 2;
    this.#occupant.entity.setLocalScale(scale, scale, scale);
  }
  /**
   *
   * @param {{x: number, y: number, z: number}} throneForward
   */
  #buildColumns(throneForward) {
    // Room-first castles supply their supports through the structural shell.
    // Extra audience columns must not occupy reserved furniture or walking space.
    if (this.#residentialLayout) return;
    const lateral = Math.max(1.35, this.#roomWidth / 2 - 0.76);
    const rows = [Math.min(1.72, throneForward * 0.38), throneForward * 0.72];
    for (const forward of rows) {
      for (const side of [-1, 1]) {
        this.#boxAt(
          "Audience column plinth",
          "wood",
          side * lateral,
          forward,
          0.14,
          [0.62, 0.28, 0.62],
          true,
        );
        this.#boxAt(
          "Audience square column",
          "woodLight",
          side * lateral,
          forward,
          0.93,
          [0.38, 1.58, 0.38],
        );
        this.#boxAt(
          "Audience column capital",
          "gold",
          side * lateral,
          forward,
          1.78,
          [0.58, 0.14, 0.58],
        );
      }
    }
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} throneForward
   */
  #buildBenches(throneForward) {
    const lateral = Math.max(1.35, this.#roomWidth / 2 - 0.78);
    for (const side of [-1, 1]) {
      for (const forward of [2.35, Math.min(3.8, throneForward - 1.35)]) {
        if (forward >= throneForward - 0.65) continue;
        this.#boxAt(
          "Court visitor bench",
          "woodLight",
          side * lateral,
          forward,
          0.34,
          [0.54, 0.24, 1.05],
          true,
        );
        this.#boxAt(
          "Court visitor bench back",
          "wood",
          side * (lateral + 0.22),
          forward,
          0.66,
          [0.16, 0.68, 1.05],
        );
      }
    }
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} throneForward
   */
  #buildBraziers(throneForward) {
    const lateral = Math.min(2.8, this.#roomWidth / 2 - 0.1);
    for (const side of [-1, 1]) {
      const position = this.#point(side * lateral, throneForward + 0.6, 0.85);
      const lantern = this.#modelLibrary.instantiate(lanternModelUrl);
      lantern.name = "Royal chamber wall lantern";
      lantern.setLocalPosition(position.x, position.y, position.z);
      lantern.setLocalEulerAngles(0, this.#roomYaw() + 180, 0);
      lantern.setLocalScale(0.85, 0.85, 0.85);
      this.#entity.addChild(lantern);
      const glow = this.#point(side * lateral, throneForward + 0.35, 1.12);
      this.#fire.add({ ...glow, scale: 0.065, brazier: false, intensity: 0.6, flame: false });
    }
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} throneForward
   */
  #buildRearBanners(throneForward) {
    const lateral = Math.min(1.68, this.#roomWidth / 2 - 0.48);
    for (const side of [-1, 1]) {
      this.#boxAt(
        "Audience chamber banner",
        "banner",
        side * lateral,
        throneForward + 0.56,
        1.62,
        [0.78, 1.38, 0.08],
      );
      this.#boxAt(
        "Audience banner stripe",
        "bannerLight",
        side * lateral,
        throneForward + 0.51,
        1.65,
        [0.18, 1.18, 0.035],
      );
      this.#boxAt(
        "Audience banner rail",
        "gold",
        side * lateral,
        throneForward + 0.58,
        2.35,
        [0.98, 0.09, 0.11],
      );
    }
  }

  /**
   *
   * @param {string} name
   * @param {string} materialName
   * @param {number} lateral
   * @param {number} forward
   * @param {number} y
   * @param {number} scale
   * @param {boolean} blocksMovement
   */
  #boxAt(
    name,
    materialName,
    lateral,
    forward,
    y,
    scale,
    blocksMovement = false,
  ) {
    const hole = this.#serviceOpening;
    if (hole && y <= 0.1 && !blocksMovement) {
      const left = lateral - scale[0] / 2;
      const right = lateral + scale[0] / 2;
      const front = forward - scale[2] / 2;
      const back = forward + scale[2] / 2;
      const cutLeft = Math.max(left, hole.x - hole.radius);
      const cutRight = Math.min(right, hole.x + hole.radius);
      const cutFront = Math.max(front, hole.z - hole.radius);
      const cutBack = Math.min(back, hole.z + hole.radius);
      if (cutRight - cutLeft > 0.0001 && cutBack - cutFront > 0.0001) {
        for (const [minX, maxX, minZ, maxZ] of [
          [left, cutLeft, front, back],
          [cutRight, right, front, back],
          [cutLeft, cutRight, front, cutFront],
          [cutLeft, cutRight, cutBack, back],
        ]) {
          if (maxX - minX > 0.0001 && maxZ - minZ > 0.0001) {
            this.#boxAt(name, materialName, (minX + maxX) / 2,
              (minZ + maxZ) / 2, y, [maxX - minX, scale[1], maxZ - minZ]);
          }
        }
        return null;
      }
    }
    const position = this.#point(lateral, forward, y);
    const entity = new this.#pc.Entity(name);
    const floor = name.toLowerCase().includes("floor");
    const carpet = materialName === "carpet";
    const model = this.#modelLibrary.instantiate(carpet ? carpetModelUrl : floor ? floorModelUrl : authoredModelUrl);
    const authoredHeight = floor || carpet ? 0.06 : 1;
    model.setLocalScale(1, 1 / authoredHeight, 1);
    model.setLocalPosition(0, -0.5, 0);
    if (!floor || carpet) {
      for (const meshInstance of model.findComponents("render").flatMap(/**
       * @param {import("playcanvas").RenderComponent} render
       */ (render) => render.meshInstances)) {
        meshInstance.material = this.#material(materialName);
      }
    }
    entity.addChild(model);
    entity.setLocalPosition(position.x, position.y, position.z);
    entity.setLocalEulerAngles(0, this.#roomYaw(), 0);
    entity.setLocalScale(...scale);
    this.#entity.addChild(entity);
    if (blocksMovement) {
      this.#obstacles.push({
        lateral,
        forward,
        width: scale[0],
        depth: scale[2],
      });
    }
    return entity;
  }

  /**
   *
   * @param {number} lateral
   * @param {number} forward
   * @param {number} y
   */
  #point(lateral, forward, y) {
    return {
      x: this.#center.x + this.#tangent.x * lateral + this.#inward.x * forward,
      y: this.#baseY + y,
      z: this.#center.z + this.#tangent.z * lateral + this.#inward.z * forward,
    };
  }

  #roomYaw() {
    return Math.round(Math.atan2(this.#inward.x, this.#inward.z) * 180 / Math.PI / 90) * 90;
  }

  #visitorFacingYaw() {
    return this.#roomYaw() + 180;
  }

  #syncVisibility() {
    this.#entity.enabled = true;
  }

  /**
   *
   * @param {string} name
   */
  #material(name) {
    const sharedName = {
      wood: "castleDoor",
      woodLight: "castleDoorLight",
      iron: "castleIron",
      stone: "castleStoneMid",
      stoneLight: "castleStoneLight",
    }[name];
    return this.#materials.get(name) ?? this.#sharedMaterials.get(sharedName);
  }
}
