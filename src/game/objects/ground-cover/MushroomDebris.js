import { MeshShatter } from "./MeshShatter.js";

const DEBRIS_FORWARD_SPEED = 0.045;
const DEBRIS_SIDE_SPEED = 0.075;
const DEBRIS_LIFT_SPEED = 0.055;
const DEBRIS_SPIN_SCALE = 0.08;
const MAX_SCATTER_SCALE = 0.15;
const MIN_DEBRIS_MASS = 0.002;
const MASS_PER_TRIANGLE = 0.00045;
const INITIAL_SIDE_SEPARATION = 0.018;
const INITIAL_FORWARD_SEPARATION = 0.009;
const INITIAL_LIFT = 0.006;
const TERRAIN_TAG = "terrain-physics-surface";
const HERO_SURFACE_IGNORE_TAG = "hero-surface-ignore";
const MINIMUM_SETTLE_NORMAL_Y = 0.4;
const GRASS_IMPRESSION_STRENGTH = 0.22;
const DEBRIS_VISIBLE_TIME = 4;
const DEBRIS_FADE_TIME = 1.25;

const FRAGMENT_SPECS = [
  {
    side: -0.9,
    forward: 0.7,
    lift: 1.1,
    rotation: [18, -24, 36],
    spin: [9, -5, 12],
  },
  {
    side: 0.82,
    forward: 0.58,
    lift: 0.92,
    rotation: [-26, 38, -18],
    spin: [-11, 7, -8],
  },
  {
    side: -0.56,
    forward: 1.08,
    lift: 0.72,
    rotation: [42, 12, -34],
    spin: [8, 11, -10],
  },
  {
    side: 0.5,
    forward: 1.2,
    lift: 0.82,
    rotation: [-38, -16, 28],
    spin: [-7, -12, 9],
  },
  {
    side: -0.18,
    forward: 0.42,
    lift: 1.34,
    rotation: [14, 52, 44],
    spin: [13, 6, 7],
  },
  {
    side: 0.24,
    forward: -0.16,
    lift: 0.62,
    rotation: [-20, -46, -40],
    spin: [-10, 9, 13],
  },
  {
    side: -0.7,
    forward: 0.18,
    lift: 1.18,
    rotation: [32, -62, 12],
    spin: [12, -8, -11],
  },
  {
    side: 0.66,
    forward: 0.88,
    lift: 1.04,
    rotation: [-46, 28, 20],
    spin: [-9, 13, 8],
  },
];

export class MushroomDebris {
  #pc;
  #entity;
  #meshShatter;
  #modelUrl;
  #variant;
  #scale;
  #rotation;
  #seed;
  #fragments = [];
  #fragmentOrigins = new Map();
  #collisionHandlers = new Map();
  #pendingSettle = new Set();
  #settledFragments = new Set();
  #meshes = [];
  #materials = [];
  #materialClones = new Map();
  #elapsed = 0;
  #fading = false;
  #expired = false;

  constructor({
    pc,
    app,
    modelLibrary,
    modelUrl,
    variant,
    scale,
    rotation = 0,
    seed = 0,
  }) {
    this.#pc = pc;
    this.#meshShatter = new MeshShatter({ pc, app, modelLibrary });
    this.#modelUrl = modelUrl;
    this.#variant = variant;
    this.#scale = scale;
    this.#rotation = rotation;
    this.#seed = seed;
    this.#entity = new pc.Entity(`${variant} mushroom fragments`);
  }

  get entity() {
    return this.#entity;
  }

  get expired() {
    return this.#expired;
  }

  get grassImpressionContacts() {
    return [...this.#settledFragments].map((fragment) => {
      const position = fragment.getPosition();
      const radius = fragment.collision.radius;
      return {
        id: fragment,
        x: position.x,
        y: position.y - radius * 0.6,
        z: position.z,
        radius: Math.max(0.025, radius * 0.9),
        strength: GRASS_IMPRESSION_STRENGTH,
      };
    });
  }

  burst({ directionX = 0, directionZ = 1 } = {}) {
    if (this.#fragments.length) {
      return false;
    }
    const pieces = this.#meshShatter.shatter({
      modelUrl: this.#modelUrl,
      scale: this.#scale,
      seed: this.#seed,
      shardCountForMesh: () => 2,
    });
    if (!pieces.length) {
      return false;
    }

    const directionLength = Math.hypot(directionX, directionZ) || 1;
    const forwardX = directionX / directionLength;
    const forwardZ = directionZ / directionLength;
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const rotationRadians = (this.#rotation * Math.PI) / 180;
    const rotationCosine = Math.cos(rotationRadians);
    const rotationSine = Math.sin(rotationRadians);

    pieces.forEach((piece, index) => {
      const spec = FRAGMENT_SPECS[index % FRAGMENT_SPECS.length];
      const centroidX =
        piece.centroid.x * rotationCosine + piece.centroid.z * rotationSine;
      const centroidZ =
        -piece.centroid.x * rotationSine + piece.centroid.z * rotationCosine;
      const fragment = new this.#pc.Entity(
        `${this.#variant} mushroom shard ${index + 1}`,
      );
      fragment.tags.add(HERO_SURFACE_IGNORE_TAG);
      fragment.setLocalPosition(
        centroidX +
          rightX * spec.side * INITIAL_SIDE_SEPARATION +
          forwardX * spec.forward * INITIAL_FORWARD_SEPARATION,
        piece.centroid.y + INITIAL_LIFT,
        centroidZ +
          rightZ * spec.side * INITIAL_SIDE_SEPARATION +
          forwardZ * spec.forward * INITIAL_FORWARD_SEPARATION,
      );
      fragment.setLocalEulerAngles(
        spec.rotation[0],
        this.#rotation + spec.rotation[1],
        spec.rotation[2],
      );
      this.#entity.addChild(fragment);

      const meshInstance = new this.#pc.MeshInstance(
        piece.mesh,
        this.#cloneMaterial(piece.material),
        fragment,
      );
      meshInstance.castShadow = true;
      meshInstance.receiveShadow = true;
      fragment.addComponent("render", { meshInstances: [meshInstance] });
      fragment.addComponent("collision", {
        type: "sphere",
        radius: Math.max(piece.radius * 0.62, 0.01),
      });
      fragment.addComponent("rigidbody", {
        type: this.#pc.BODYTYPE_DYNAMIC,
        mass: Math.max(
          MIN_DEBRIS_MASS,
          piece.triangleCount * MASS_PER_TRIANGLE,
        ),
        friction: 0.22,
        rollingFriction: 0.3,
        restitution: 0.02,
        linearDamping: 0.82,
        angularDamping: 0.88,
        group: this.#pc.BODYGROUP_USER_5,
        mask: this.#pc.BODYGROUP_STATIC | this.#pc.BODYGROUP_USER_6,
      });
      fragment.rigidbody.linearVelocity = new this.#pc.Vec3(
        forwardX * DEBRIS_FORWARD_SPEED * spec.forward +
          rightX * DEBRIS_SIDE_SPEED * spec.side,
        DEBRIS_LIFT_SPEED * spec.lift,
        forwardZ * DEBRIS_FORWARD_SPEED * spec.forward +
          rightZ * DEBRIS_SIDE_SPEED * spec.side,
      );
      fragment.rigidbody.angularVelocity = new this.#pc.Vec3(
        spec.spin[0] * DEBRIS_SPIN_SCALE,
        spec.spin[1] * DEBRIS_SPIN_SCALE,
        spec.spin[2] * DEBRIS_SPIN_SCALE,
      );
      const handleCollisionStart = (result) => {
        const touchesTerrain = result.other?.tags?.has(TERRAIN_TAG);
        const restsOnSurface = result.contacts?.some(
          (contact) => contact.normal.y >= MINIMUM_SETTLE_NORMAL_Y,
        );
        if (touchesTerrain && restsOnSurface) {
          this.#pendingSettle.add(fragment);
        }
      };
      fragment.rigidbody.on("collisionstart", handleCollisionStart);
      this.#collisionHandlers.set(fragment, handleCollisionStart);
      fragment.rigidbody.activate();
      const initialPosition = fragment.getLocalPosition();
      this.#fragmentOrigins.set(fragment, {
        x: initialPosition.x,
        z: initialPosition.z,
      });
      this.#meshes.push(piece.mesh);
      this.#fragments.push(fragment);
    });
    return true;
  }

  advance(deltaTime) {
    if (!this.#fragments.length || this.#expired) {
      return;
    }
    this.#elapsed += deltaTime;
    this.#settleTerrainContacts();
    this.#constrainScatter();
    this.#advanceFade();
  }

  destroy() {
    for (const [fragment, handler] of this.#collisionHandlers) {
      fragment.rigidbody?.off("collisionstart", handler);
    }
    this.#entity?.destroy();
    this.#entity = null;
    for (const mesh of this.#meshes) {
      mesh.destroy();
    }
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#meshes = [];
    this.#materials = [];
    this.#fragments = [];
    this.#fragmentOrigins.clear();
    this.#collisionHandlers.clear();
    this.#pendingSettle.clear();
    this.#settledFragments.clear();
    this.#materialClones.clear();
  }

  #settleTerrainContacts() {
    for (const fragment of this.#pendingSettle) {
      if (fragment.rigidbody?.type !== this.#pc.BODYTYPE_DYNAMIC) {
        continue;
      }
      const handler = this.#collisionHandlers.get(fragment);
      fragment.rigidbody.off("collisionstart", handler);
      fragment.rigidbody.linearVelocity = new this.#pc.Vec3(0, 0, 0);
      fragment.rigidbody.angularVelocity = new this.#pc.Vec3(0, 0, 0);
      this.#collisionHandlers.delete(fragment);
      this.#settledFragments.add(fragment);
    }
    this.#pendingSettle.clear();
  }

  #constrainScatter() {
    const maximumDistance = this.#scale * MAX_SCATTER_SCALE;
    for (const fragment of this.#fragments) {
      if (fragment.rigidbody?.type !== this.#pc.BODYTYPE_DYNAMIC) {
        continue;
      }
      const origin = this.#fragmentOrigins.get(fragment);
      const position = fragment.getLocalPosition();
      const offsetX = position.x - origin.x;
      const offsetZ = position.z - origin.z;
      const distance = Math.hypot(offsetX, offsetZ);
      if (distance <= maximumDistance) {
        continue;
      }
      const ratio = maximumDistance / distance;
      fragment.setLocalPosition(
        origin.x + offsetX * ratio,
        position.y,
        origin.z + offsetZ * ratio,
      );
      fragment.rigidbody.linearVelocity = new this.#pc.Vec3(
        0,
        fragment.rigidbody.linearVelocity.y,
        0,
      );
      fragment.rigidbody.teleport(
        fragment.getPosition(),
        fragment.getRotation(),
      );
    }
  }

  #cloneMaterial(sourceMaterial) {
    if (this.#materialClones.has(sourceMaterial)) {
      return this.#materialClones.get(sourceMaterial);
    }
    const material = sourceMaterial.clone();
    material.name = `${sourceMaterial.name} mushroom debris`;
    this.#materialClones.set(sourceMaterial, material);
    this.#materials.push(material);
    return material;
  }

  #advanceFade() {
    if (this.#elapsed < DEBRIS_VISIBLE_TIME) {
      return;
    }
    if (!this.#fading) {
      this.#beginFade();
    }
    const progress = Math.min(
      1,
      (this.#elapsed - DEBRIS_VISIBLE_TIME) / DEBRIS_FADE_TIME,
    );
    for (const material of this.#materials) {
      material.opacity = 1 - progress;
      material.update();
    }
    this.#expired = progress >= 1;
  }

  #beginFade() {
    this.#fading = true;
    for (const fragment of this.#fragments) {
      const handler = this.#collisionHandlers.get(fragment);
      if (handler) {
        fragment.rigidbody?.off("collisionstart", handler);
      }
      if (fragment.rigidbody) {
        fragment.removeComponent("rigidbody");
      }
      if (fragment.collision) {
        fragment.removeComponent("collision");
      }
    }
    this.#collisionHandlers.clear();
    this.#pendingSettle.clear();
    this.#settledFragments.clear();
    for (const material of this.#materials) {
      material.blendType = this.#pc.BLEND_NORMAL;
      material.depthWrite = false;
      material.update();
    }
  }
}
