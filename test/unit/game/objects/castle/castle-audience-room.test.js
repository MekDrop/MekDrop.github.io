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

  setLocalEulerAngles() {}

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

  destroy() {}
}

class FakeMaterial {
  update() {}

  destroy() {}
}

const pc = {
  Entity: FakeEntity,
  StandardMaterial: FakeMaterial,
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

function createRoom(side, occupant = null) {
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
