const DOOR_HEIGHT = 2.25;
const DOOR_THICKNESS = 0.16;
const DOOR_INSET = 0.28;
const DOOR_ARCH_SEGMENTS = 6;
const DOOR_SPRING_HEIGHT = 1.25;
const DOOR_ARCH_RISE = DOOR_HEIGHT - DOOR_SPRING_HEIGHT;
const OPEN_ANGLE = 92;
const OPEN_SPEED = 3.4;
const OPEN_DISTANCE = 1.8;
const CLOSE_INSIDE_DISTANCE = 0.9;
const PASSABLE_OPEN_AMOUNT = 0.72;

export class CastleDoor {
  #pc;
  #app;
  #entity;
  #leftHinge;
  #rightHinge;
  #center;
  #inward;
  #tangent;
  #width;
  #baseYaw;
  #materials = [];
  #meshes = [];
  #targetOpen = false;
  #openAmount = 0;

  constructor({ pc, app, castlePosition, door, materials }) {
    this.#pc = pc;
    this.#app = app;
    this.#width = door.width;
    this.#entity = new pc.Entity(`Castle ${door.side.toLowerCase()} doors`);

    const geometry = this.#doorGeometry(castlePosition, door);
    this.#center = geometry.center;
    this.#inward = geometry.inward;
    this.#tangent = geometry.tangent;
    this.#baseYaw = geometry.baseYaw;

    const doorMaterial = this.#twoSidedMaterial(
      materials.get("castleDoor"),
      "Castle door two-sided",
    );
    const ironMaterial = this.#twoSidedMaterial(
      materials.get("castleIron"),
      "Castle door iron two-sided",
    );

    const leafWidth = this.#width / 2;
    this.#leftHinge = this.#createLeaf(
      "Left castle door",
      -1,
      leafWidth,
      doorMaterial,
      ironMaterial,
    );
    this.#rightHinge = this.#createLeaf(
      "Right castle door",
      1,
      leafWidth,
      doorMaterial,
      ironMaterial,
    );
    this.#setDoorAngles();
  }

  get entity() {
    return this.#entity;
  }

  updateHeroPosition({ x, z }) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const insideDistance =
      deltaX * this.#inward.x + deltaZ * this.#inward.z;
    const lateralDistance = Math.abs(
      deltaX * this.#tangent.x + deltaZ * this.#tangent.z,
    );
    const alignedWithDoor = lateralDistance <= this.#width / 2 + 0.8;

    if (insideDistance > CLOSE_INSIDE_DISTANCE) {
      this.#targetOpen = false;
    } else {
      this.#targetOpen =
        alignedWithDoor && Math.abs(insideDistance) <= OPEN_DISTANCE;
    }
  }

  update(deltaTime) {
    const target = Number(this.#targetOpen);
    const amount = OPEN_SPEED * deltaTime;
    if (this.#openAmount < target) {
      this.#openAmount = Math.min(target, this.#openAmount + amount);
    } else if (this.#openAmount > target) {
      this.#openAmount = Math.max(target, this.#openAmount - amount);
    }
    this.#setDoorAngles();
  }

  intersectsFootprint(x, z, radius) {
    if (this.#openAmount >= PASSABLE_OPEN_AMOUNT) return false;
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const normalDistance = Math.abs(
      deltaX * this.#inward.x + deltaZ * this.#inward.z,
    );
    const lateralDistance = Math.abs(
      deltaX * this.#tangent.x + deltaZ * this.#tangent.z,
    );
    return (
      normalDistance <= DOOR_THICKNESS / 2 + radius &&
      lateralDistance <= this.#width / 2 + radius
    );
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#leftHinge = null;
    this.#rightHinge = null;
    for (const material of this.#materials) material.destroy();
    this.#materials = [];
    for (const mesh of this.#meshes) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#meshes = [];
  }

  #doorGeometry(castlePosition, door) {
    const geometryBySide = {
      WEST: {
        center: {
          x: castlePosition.x + DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: { x: 1, z: 0 },
        tangent: { x: 0, z: 1 },
        baseYaw: -90,
      },
      EAST: {
        center: {
          x: castlePosition.x + castlePosition.width - DOOR_INSET,
          y: castlePosition.elevation,
          z: castlePosition.z + door.offset + door.width / 2,
        },
        inward: { x: -1, z: 0 },
        tangent: { x: 0, z: 1 },
        baseYaw: -90,
      },
      NORTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + DOOR_INSET,
        },
        inward: { x: 0, z: 1 },
        tangent: { x: 1, z: 0 },
        baseYaw: 0,
      },
      SOUTH: {
        center: {
          x: castlePosition.x + door.offset + door.width / 2,
          y: castlePosition.elevation,
          z: castlePosition.z + castlePosition.depth - DOOR_INSET,
        },
        inward: { x: 0, z: -1 },
        tangent: { x: 1, z: 0 },
        baseYaw: 0,
      },
    };
    return geometryBySide[door.side];
  }

  #createLeaf(name, side, leafWidth, doorMaterial, ironMaterial) {
    const hinge = new this.#pc.Entity(`${name} hinge`);
    hinge.setLocalPosition(
      this.#center.x + this.#tangent.x * side * (this.#width / 2),
      this.#center.y,
      this.#center.z + this.#tangent.z * side * (this.#width / 2),
    );
    this.#entity.addChild(hinge);

    hinge.addChild(this.#archedPanel(name, side, leafWidth, doorMaterial));

    const bandWidth = leafWidth * 0.68;
    const bandCenter = bandWidth / 2 + leafWidth * 0.04;
    for (const y of [0.48, 1.12]) {
      for (const face of [-1, 1]) {
        hinge.addChild(
          this.#box(
            `${name} iron band`,
            ironMaterial,
            [
              -side * bandCenter,
              y,
              face * DOOR_THICKNESS * 0.58,
            ],
            [bandWidth, 0.065, DOOR_THICKNESS * 0.22],
          ),
        );
        for (const distance of [leafWidth * 0.12, leafWidth * 0.56]) {
          hinge.addChild(
            this.#box(
              `${name} iron rivet`,
              ironMaterial,
              [
                -side * distance,
                y,
                face * DOOR_THICKNESS * 0.7,
              ],
              [0.07, 0.085, DOOR_THICKNESS * 0.12],
            ),
          );
        }
      }
    }

    for (const face of [-1, 1]) {
      hinge.addChild(
        this.#box(
          `${name} outer iron hinge`,
          ironMaterial,
          [-side * 0.08, 0.65, face * DOOR_THICKNESS * 0.6],
          [0.1, 1.18, DOOR_THICKNESS * 0.18],
        ),
      );
    }
    return hinge;
  }

  #archedPanel(name, side, leafWidth, material) {
    const direction = -side;
    const outline = [
      [0, 0],
      [direction * leafWidth, 0],
    ];
    for (let segment = DOOR_ARCH_SEGMENTS; segment >= 0; segment -= 1) {
      const distanceFromHinge =
        (leafWidth * segment) / DOOR_ARCH_SEGMENTS;
      const distanceFromCenter = leafWidth - distanceFromHinge;
      const height =
        DOOR_SPRING_HEIGHT +
        DOOR_ARCH_RISE *
          Math.sqrt(
          Math.max(
            0,
            1 - (distanceFromCenter / leafWidth) ** 2,
          ),
        );
      outline.push([direction * distanceFromHinge, height]);
    }

    const positions = [];
    const uvs = [];
    const indices = [];
    const appendFace = (points, faceUvs) => {
      const start = positions.length / 3;
      for (let index = 0; index < points.length; index += 1) {
        positions.push(...points[index]);
        uvs.push(...faceUvs[index]);
      }
      for (let index = 1; index < points.length - 1; index += 1) {
        indices.push(start, start + index, start + index + 1);
      }
    };
    const faceUvs = outline.map(([x, y]) => [
      Math.abs(x) / leafWidth,
      y / DOOR_HEIGHT,
    ]);
    const front = outline.map(([x, y]) => [x, y, DOOR_THICKNESS / 2]);
    const back = outline
      .map(([x, y]) => [x, y, -DOOR_THICKNESS / 2])
      .reverse();
    const orientedFront = direction > 0 ? front : [...front].reverse();
    const orientedFrontUvs =
      direction > 0 ? faceUvs : [...faceUvs].reverse();
    const orientedBack = direction > 0 ? back : [...back].reverse();
    const orientedBackUvs =
      direction > 0 ? [...faceUvs].reverse() : faceUvs;
    appendFace(orientedFront, orientedFrontUvs);
    appendFace(orientedBack, orientedBackUvs);

    for (let index = 0; index < outline.length; index += 1) {
      const next = (index + 1) % outline.length;
      const [x1, y1] = outline[index];
      const [x2, y2] = outline[next];
      const sidePoints = [
        [x1, y1, -DOOR_THICKNESS / 2],
        [x2, y2, -DOOR_THICKNESS / 2],
        [x2, y2, DOOR_THICKNESS / 2],
        [x1, y1, DOOR_THICKNESS / 2],
      ];
      appendFace(sidePoints, [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]);
    }

    const geometry = new this.#pc.Geometry();
    geometry.positions = positions;
    geometry.indices = indices;
    geometry.normals = this.#pc.calculateNormals(positions, indices);
    geometry.uvs = uvs;
    const mesh = this.#pc.Mesh.fromGeometry(
      this.#app.graphicsDevice,
      geometry,
    );
    mesh.incRefCount();
    this.#meshes.push(mesh);

    const panel = new this.#pc.Entity(name);
    panel.addComponent("render", {
      meshInstances: [new this.#pc.MeshInstance(mesh, material)],
      castShadows: false,
      receiveShadows: true,
    });
    return panel;
  }

  #twoSidedMaterial(source, name) {
    const material = source.clone();
    material.name = name;
    material.cull = this.#pc.CULLFACE_NONE;
    material.update();
    this.#materials.push(material);
    return material;
  }

  #box(name, material, position, scale) {
    const entity = new this.#pc.Entity(name);
    entity.addComponent("render", {
      type: "box",
      castShadows: false,
      receiveShadows: true,
    });
    for (const meshInstance of entity.render.meshInstances) {
      meshInstance.material = material;
    }
    entity.setLocalPosition(...position);
    entity.setLocalScale(...scale);
    return entity;
  }

  #setDoorAngles() {
    const swing = OPEN_ANGLE * this.#openAmount;
    this.#leftHinge.setLocalEulerAngles(0, this.#baseYaw + swing, 0);
    this.#rightHinge.setLocalEulerAngles(0, this.#baseYaw - swing, 0);
  }
}
