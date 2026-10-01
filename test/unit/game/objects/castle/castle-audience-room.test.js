import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

class FakeEntity {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.enabled = true;
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }

  addChild(child) {
    this.children.push(child);
  }

  addComponent(type) {
    if (type === "render") {
      this.render = { meshInstances: [{ material: null }] };
    }
  }

  setLocalPosition(x, y, z) {
    this.position = { x, y, z };
  }

  setLocalEulerAngles(x, y, z) { this.euler = { x, y, z }; }

  setLocalScale(x, y, z) {
    this.scale = { x, y, z };
  }

  getLocalPosition() {
    return this.position;
  }

  getLocalScale() {
    return this.scale;
  }

  getPosition() {
    return this.position;
  }

  getWorldTransform() {
    return {
      transformPoint: (point) => point,
    };
  }

  findComponents() { this.render ??= { meshInstances: [{ material: null }] }; return [this.render]; }
  destroy() {}
}

class FakeMaterial {
  update() {}

  findComponents() { this.render ??= { meshInstances: [{ material: null }] }; return [this.render]; }
  destroy() {}
}

const pc = {
  Entity: FakeEntity,
  StandardMaterial: FakeMaterial,
  ADDRESS_REPEAT: 0,
  Vec2: class Vec2 { constructor(x, y) { this.x = x; this.y = y; } },
  Vec3: class Vec3 {
    constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  },
};
globalThis.__castleAudienceTestPc = pc;

const audienceRoomSource = readFileSync(
  new URL(
    "../../../../../src/game/objects/castle/CastleAudienceRoom.js",
    import.meta.url,
  ),
  "utf8",
).replace(/^import[^;]+;\r?\n/gm, "");
const dependencies = `
  const pc = globalThis.__castleAudienceTestPc;
  const authoredModelUrl = "stone-block";
  const floorModelUrl = "floor-panel";
  const rugModelUrl = "rug";
  const lanternModelUrl = "wall-lantern";
  const SeatedRoyal = { modelUrls: [] };
  class CastleThrone {
    static modelUrl = "throne";
    constructor() { this.entity = new pc.Entity("Throne"); }
    destroy() {}
  }
  class CastleFire {
    constructor() { this.entity = new pc.Entity("Castle fires"); }
    add() {}
    destroy() {}
  }
  const GAME_OVER_VIEW_ROTATION_BY_SIDE = {};
  const colorFromHex = (_pc, color) => color;
`;
const { CastleAudienceRoom } = await import(
  `data:text/javascript;base64,${Buffer.from(
    `${dependencies}\n${audienceRoomSource}`,
  ).toString("base64")}`
);
delete globalThis.__castleAudienceTestPc;

const app = {
  on: () => ({ off() {} }),
};
const modelLibrary = {
  instantiate: () => new FakeEntity("Model"),
};

const layouts = {
  WEST: {
    center: { x: 0, z: 4 },
    inward: { x: 1, z: 0 },
  },
  EAST: {
    center: { x: 8, z: 4 },
    inward: { x: -1, z: 0 },
  },
  NORTH: {
    center: { x: 4, z: 0 },
    inward: { x: 0, z: 1 },
  },
  SOUTH: {
    center: { x: 4, z: 8 },
    inward: { x: 0, z: -1 },
  },
};

function createRoom(side, occupant = null, options = {}) {
  return new CastleAudienceRoom({
    pc,
    app,
    position: { x: 0, z: 0, width: 8, depth: 8, elevation: 2 },
    door: { side, offset: 3, width: 2 },
    occupant: occupant ?? {
      entity: new FakeEntity("Royal"),
      update() {},
      destroy() {},
    },
    availableDepth: 4.1,
    availableWidth: 6.4,
    frontWallDepth: 0.5,
    modelLibrary,
    ...options,
  });
}

function forwardPosition(entity, side) {
  const { center, inward } = layouts[side];
  return (
    (entity.position.x - center.x) * inward.x +
    (entity.position.z - center.z) * inward.z
  );
}

for (const side of Object.keys(layouts)) {
  it(`${side} audience floor narrows to the doorway through the front wall`, () => {
    const room = createRoom(side);
    const woodenFloor = room.entity.children.find(
      ({ name }) => name === "Audience wooden floor",
    );
    const entranceFloor = room.entity.children.find(
      ({ name }) => name === "Audience entrance floor",
    );
    const borders = room.entity.children.filter(
      ({ name }) => name === "Audience floor border",
    );
    const carpetParts = room.entity.children.filter(({ name }) =>
      name.startsWith("Audience carpet"),
    );

    assert.ok(woodenFloor);
    assert.ok(entranceFloor);
    assert.equal(borders.length, 2);
    assert.deepEqual(
      carpetParts.map(({ name }) => name),
      ["Audience carpet runner"],
    );
    assert.equal(
      forwardPosition(woodenFloor, side) - woodenFloor.scale.z / 2,
      0.5,
    );
    assert.equal(entranceFloor.scale.x, 2);
    assert.equal(
      forwardPosition(entranceFloor, side) - entranceFloor.scale.z / 2,
      0,
    );
    for (const border of borders) {
      assert.equal(
        forwardPosition(border, side) - border.scale.z / 2,
        0.5,
      );
    }

    room.destroy();
  });
}

it("keeps the throne room rendered while its entrance is closed", () => {
  const room = createRoom("NORTH");

  room.entranceVisible = false;
  room.updateHeroPosition({ x: -100, z: -100 });

  assert.equal(room.entity.enabled, true);
  room.destroy();
});

it("routes a royal through the doorway with castle collision knowledge", () => {
  let gameOverOptions = null;
  const occupant = {
    entity: new FakeEntity("Royal"),
    gameOverDestination: { lateral: 1.15, forward: -1, elevation: 0.05 },
    visualBounds: {
      center: { x: 4, y: 3, z: 3 },
      size: { x: 1, y: 2, z: 1 },
    },
    beginGameOver(options) {
      gameOverOptions = options;
    },
    update() {},
    destroy() {},
  };
  const isBlocked = () => false;
  const room = createRoom("NORTH", occupant);

  room.beginGameOver(() => ({ x: 0, y: 0, z: 0 }), isBlocked);
  room.startGameOverPerformance();

  assert.equal(gameOverOptions.route.isBlocked, isBlocked);
  assert.equal(gameOverOptions.route.collisionRadius, 0.22);
  assert.deepEqual(
    gameOverOptions.route.waypoints.slice(1).map(({ x, z }) => ({ x, z })),
    [
      { x: 4, z: 0.35 },
      { x: 4, z: -0.35 },
      { x: 5.15, z: -1 },
    ],
  );
  room.destroy();
});

for (const side of Object.keys(layouts)) {
  it(`${side} covers the full off-centre chamber through the rear wall`, () => {
    const room = createRoom(side, null, {
      availableDepth: 6.5,
      availableWidth: 5,
      door: { side, offset: 2, width: 2 },
    });
    // The room is 8 units wide with half-unit walls. Its doorway is at 3,
    // so the former 5-unit furnished floor left a wider uncovered side strip.
    const inward = layouts[side].inward;
    const tangent = inward.x ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const center = {
      WEST: { x: 0, z: 3 },
      EAST: { x: 8, z: 3 },
      NORTH: { x: 3, z: 0 },
      SOUTH: { x: 3, z: 8 },
    }[side];
    for (const lateral of [-2.49, 4.49]) {
      for (const forward of [0.51, 4.2, 6.49]) {
        const x = center.x + tangent.x * lateral + inward.x * forward;
        const z = center.z + tangent.z * lateral + inward.z * forward;
        assert.ok(room.surfaceHeightAt(x, z) >= 2.05);
      }
    }
    const floor = room.entity.children.find(
      ({ name }) => name === "Audience wooden floor",
    );
    assert.equal(floor.scale.x, 7);
    assert.equal(floor.scale.z, 6);
    room.destroy();
  });
}

it("uses the original carpet texture on a centered authored floor panel", () => {
  const carpetTexture = { name: "Castle carpet" };
  const room = createRoom("NORTH", null, { carpetTexture });
  const runner = room.entity.children.find(
    ({ name }) => name === "Audience carpet runner",
  );
  assert.equal(runner.children.length, 1);
  assert.equal(runner.children[0].position.y, -0.5);
  assert.equal(runner.position.y, 2.055);
  assert.equal(runner.children[0].render.meshInstances[0].material.diffuseMap, carpetTexture);
  room.destroy();
});


it("cuts a service stair opening from the visible floor and support surfaces", () => {
  for (const side of Object.keys(layouts)) {
    const { center, inward } = layouts[side];
    const tangent = { x: -inward.z, z: inward.x };
    const opening = {
      x: center.x + inward.x * 2.7 + tangent.x * 1.1,
      z: center.z + inward.z * 2.7 + tangent.z * 1.1,
      radius: 0.45,
    };
    const room = createRoom(side, null, { serviceOpening: opening });
    try {
      assert.equal(room.surfaceHeightAt(opening.x, opening.z), null, side);
      assert.ok(room.surfaceHeightAt(opening.x + inward.x * 0.7, opening.z + inward.z * 0.7) !== null);
    } finally {
      room.destroy();
    }
  }
});

it("uses the shared room plan and keeps the actual throne dais clear of furniture and stair bays", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  const { CastleResidentialLayout } = await import("../../../../../src/game/objects/castle/CastleResidentialLayout.js");
  for (const style of ["twin-tower", "single-tower", "right-angle", "left-angle"]) {
    for (const side of Object.keys(layouts)) {
      const plan = await CastleGenerator.generate({
        position: { x: 0, z: 0, width: 8, depth: 8, elevation: 2 },
        doors: [{ side, offset: 3, width: 2 }], style,
      });
      const shared = new CastleResidentialLayout(plan);
      const room = createRoom(side, null, { residentialLayout: shared });
      const throne = room.entity.children.find((entity) => entity.name === "Throne");
      const seat = shared.toLocal(throne.position.x, throne.position.z);
      const dais = { minX: seat.x - 1.3, maxX: seat.x + 1.3, minZ: seat.z - 0.675, maxZ: seat.z + 0.875 };
      const work = shared.rooms.work;
      assert.ok(dais.minX >= work.minX && dais.maxX <= work.maxX && dais.minZ >= work.minZ && dais.maxZ <= work.maxZ, `${style}/${side} throne bounds`);
      for (const zone of shared.reservations.filter((zone) => ["mainStair", "serviceStair", "workDesk"].includes(zone.role))) {
        assert.ok(dais.maxX <= zone.minX || dais.minX >= zone.maxX || dais.maxZ <= zone.minZ || dais.minZ >= zone.maxZ, `${style}/${side} throne overlaps ${zone.role}`);
      }
      assert.equal(room.entity.children.some((entity) => entity.name.includes("column")), false);
      const aisle = shared.reservations.find((zone) => zone.role === "centralAisle");
      for (let forward = aisle.minZ; forward < aisle.maxZ; forward += 0.2) {
        const point = shared.toWorld(0, forward);
        assert.equal(room.intersectsFootprint(point.x, point.z, 0.22), false, `${style}/${side} aisle`);
      }
      room.destroy();
    }
  }
});
it("keeps all timber floor finishes behind occupied walls and leaves stone-only gate thresholds", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  const { CastleResidentialLayout } = await import("../../../../../src/game/objects/castle/CastleResidentialLayout.js");
  for (const style of ["twin-keeps", "courtyard-keep", "long-hall", "l-courtyard", "terraced-keeps"]) {
    for (const side of Object.keys(layouts)) {
      const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 12, elevation: 2 },
        doors: [{ side, offset: 5, width: 2 }], style });
      const shared = new CastleResidentialLayout(plan);
      const room = createRoom(side, null, { residentialLayout: shared });
      assert.equal(room.entity.children.some((part) => part.name === "Audience entrance floor"), false);
      const work = shared.rooms.work;
      for (const part of room.entity.children.filter((item) => item.name.includes("floor") || item.name === "Audience carpet runner")) {
        const center = shared.toLocal(part.position.x, part.position.z);
        assert.ok(center.x - part.scale.x / 2 >= work.minX + 0.03 && center.x + part.scale.x / 2 <= work.maxX - 0.03,
          `${style}/${side}/${part.name}: side finish remains behind masonry`);
        assert.ok(center.z - part.scale.z / 2 >= work.minZ + 0.03 && center.z + part.scale.z / 2 <= work.maxZ - 0.03,
          `${style}/${side}/${part.name}: finish stays inside work hall`);
      }
      room.destroy();
    }
  }
});

it("faces the royal and runner toward the primary entrance in every orientation", async () => {
  const { CastleGenerator } = await import("../../../../../src/game/generator/castle/CastleGenerator.js");
  const { CastleResidentialLayout } = await import("../../../../../src/game/objects/castle/CastleResidentialLayout.js");
  for (const side of Object.keys(layouts)) {
    const plan = await CastleGenerator.generate({ position: { x: 0, z: 0, width: 12, depth: 12, elevation: 2 },
      doors: [{ side, offset: 5, width: 2 }], style: "courtyard-keep" });
    const shared = new CastleResidentialLayout(plan);
    const occupant = { entity: new FakeEntity("Royal") };
    const room = createRoom(side, occupant, { residentialLayout: shared });
    const runner = room.entity.children.find((part) => part.name === "Audience carpet runner");
    const yaw = runner.euler.y * Math.PI / 180;
    const expected = shared.yaw * Math.PI / 180;
    assert.ok(Math.abs(Math.sin(yaw) - Math.sin(expected)) < 0.000001, side);
    assert.ok(Math.abs(Math.cos(yaw) - Math.cos(expected)) < 0.000001, side);
    const facing = occupant.entity.euler.y * Math.PI / 180;
    assert.ok(Math.abs(Math.sin(facing) + Math.sin(expected)) < 0.000001, side);
    assert.ok(Math.abs(Math.cos(facing) + Math.cos(expected)) < 0.000001, side);
    room.destroy();
  }
});

it("repeats the carpet motif at its pixel aspect across different hall lengths", () => {
  for (const availableDepth of [2.8, 4.1]) {
    const carpetTexture = { width: 512, height: 768 };
    const room = createRoom("NORTH", null, { carpetTexture, availableDepth });
    const runner = room.entity.children.find((part) => part.name === "Audience carpet runner");
    const material = runner.children[0].render.meshInstances[0].material;
    assert.equal(material.diffuseMap, carpetTexture);
    assert.equal(material.diffuseMapTiling.x, 1);
    assert.ok(Math.abs(runner.scale.z / material.diffuseMapTiling.y / runner.scale.x - 768 / 512) < 0.000001);
    assert.equal(carpetTexture.addressV, pc.ADDRESS_REPEAT);
    room.destroy();
  }
});
