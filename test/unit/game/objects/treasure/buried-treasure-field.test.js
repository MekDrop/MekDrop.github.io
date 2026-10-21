import assert from "node:assert/strict";
import { it } from "node:test";
import { registerHooks } from "node:module";
import * as pc from "playcanvas";
import { GameMapLoader } from "../../../../../src/game/GameMapLoader.js";
import { MAP_TILE_TYPE } from "../../../../../src/game/enum/MapTileType.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { TerrainBlockDefinitions } from "../../../../../src/game/objects/terrain/TerrainBlockDefinitions.js";
import { CastleMapPreparation } from "../../../../../src/game/objects/castle/ground/CastleMapPreparation.js";
import { TREASURE_TOOL_MIN_DISTANCE, treasureToolBackstep } from "../../../../../src/game/config/treasure.js";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith(".glb?url")) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { BuriedTreasureField } = await import("../../../../../src/game/objects/treasure/BuriedTreasureField.js");
hooks.deregister();

it("offers digging on the exposed castle lawn in mvcoupei_11og30n", async () => {
  const mapData = await MapGenerator.generate({ mapName: "mvcoupei_11og30n" });
  TerrainBlockDefinitions.populate(mapData);
  CastleMapPreparation.prepareMap(mapData);
  assert.equal(mapData.grid[19][38], MAP_TILE_TYPE.CASTLE_WALL);
  assert.equal(mapData.tileMeta[19][38].exposedTerrain, true);
  let update;
  const field = new BuriedTreasureField({
    pc,
    mapData,
    modelLibrary: { instantiate: (url) => new pc.Entity(url) },
    app: {
      on: (event, callback) => {
        update = callback;

        return { off: () => {} };
      },
    },
  });
  field.tool = {};
  const interaction = field.findInteraction({
    hero: {
      position: {
        x: 17.5,
        y: 3.04,
        z: -0.5,
      },
      facingDirection: {
        x: 0,
        z: -1,
      },
    },
  });
  assert.equal(interaction?.description.labelKey, "game.interaction.dig");
  assert.equal(interaction.description.col, 38);
  assert.equal(interaction.description.row, 20);
  const diagonalInteraction = field.findInteraction({
    hero: {
      position: {
        x: 10.01,
        y: 3.04,
        z: -16.01,
      },
      facingDirection: {
        x: -Math.SQRT1_2,
        z: Math.SQRT1_2,
      },
    },
  });
  assert.equal(diagonalInteraction?.description.labelKey, "game.interaction.dig");
  assert.equal(diagonalInteraction.description.col, 30);
  assert.equal(diagonalInteraction.description.row, 5);
  const offsetLandingInteraction = field.findInteraction({
    hero: {
      position: {
        x: 18.258895874023438,
        y: 3.04,
        z: -7.295778274536133,
      },
      facingDirection: {
        x: 0.9535826651341417,
        z: -0.3011313679370973,
      },
    },
  });
  assert.equal(offsetLandingInteraction?.description.labelKey, "game.interaction.dig");
  assert.equal(offsetLandingInteraction.description.col, 39);
  assert.equal(offsetLandingInteraction.description.row, 13);
  const wallHero = {
    position: {
      x: 9.335983276367188,
      y: 2.9999661445617676,
      z: -2.5120742321014404,
    },
    facingDirection: {
      x: 0.9535826651341417,
      z: -0.3011313679370973,
    },
  };
  const closeTarget = field.findInteraction({ hero: wallHero })?.description;
  assert.equal(closeTarget?.labelKey, "game.interaction.dig");
  assert.equal(closeTarget.col, 30);
  assert.equal(closeTarget.row, 18);
  assert.ok(Math.hypot(closeTarget.x - wallHero.position.x, closeTarget.z - wallHero.position.z) < 0.6,
    "the close centered tile is offered for backward positioning");
  wallHero.facingDirection = {
    x: 0.2,
    z: -Math.sqrt(0.96),
  };
  const wallFacingInteraction = field.findInteraction({ hero: wallHero });
  const wallTarget = wallFacingInteraction?.description;
  assert.equal(wallTarget?.labelKey, "game.interaction.dig");
  assert.equal(wallTarget.col, 30, "prefer the nearby tile rather than skipping ahead");
  assert.equal(wallTarget.row, 18);
  const backstep = treasureToolBackstep(wallTarget.x - wallHero.position.x,
    wallTarget.z - wallHero.position.z, wallHero.facingDirection.x,
    wallHero.facingDirection.z, 0.65, 30);
  assert.ok(backstep > 0 && backstep <= 0.85);
  wallHero.position.x -= wallHero.facingDirection.x * backstep;
  wallHero.position.z -= wallHero.facingDirection.z * backstep;
  const dx = wallTarget.x - wallHero.position.x;
  const dz = wallTarget.z - wallHero.position.z;
  assert.equal(wallTarget.x, wallTarget.col - (mapData.cols - 1) / 2);
  assert.equal(wallTarget.z, wallTarget.row - (mapData.rows - 1) / 2);
  assert.ok((dx * wallHero.facingDirection.x + dz * wallHero.facingDirection.z) /
    Math.hypot(dx, dz) >= Math.cos(Math.PI / 6) - 1e-6, "only a small turn is needed after stepping back");
  assert.ok(Math.hypot(dx, dz) >= 0.6, "the hole is clear of the hero's feet");
  assert.ok(wallTarget.x + 0.31 < 10.5, "the entire hole stays outside the castle");
  for (let stroke = 0; stroke < 8; stroke += 1) {
    field.dig(wallTarget);
  }
  for (let frame = 0; frame < 5; frame += 1) {
    update(0.1);
  }
  const fill = field.findInteraction({ hero: wallHero })?.description;
  assert.equal(fill?.labelKey, "game.interaction.fill_hole");
  assert.equal(fill.x, wallTarget.x);
  assert.equal(fill.z, wallTarget.z);
  field.destroy();
});

it("finds diagonal grass after corner landings without digging beneath the hero", () => {
  const mapData = {
    cols: 5,
    rows: 5,
    grid: Array.from({ length: 5 }, () => Array(5).fill(MAP_TILE_TYPE.GRASS)),
    heightmap: Array.from({ length: 5 }, () => Array(5).fill(0)),
    objects: [],
  };
  const field = new BuriedTreasureField({
    pc,
    mapData,
    modelLibrary: {},
    app: { on: () => ({ off: () => {} }) },
  });
  field.tool = {};
  for (const signX of [-1, 1]) {
    for (const signZ of [-1, 1]) {
      const hero = {
        position: {
          x: signX * 0.49,
          y: 0.04,
          z: signZ * 0.49,
        },
        facingDirection: {
          x: signX * Math.SQRT1_2,
          z: signZ * Math.SQRT1_2,
        },
      };
      const target = field.findInteraction({ hero })?.description;
      assert.equal(target?.labelKey, "game.interaction.dig");
      assert.equal(target.x, signX);
      assert.equal(target.z, signZ);
      assert.ok(Math.abs((target.x - hero.position.x) * hero.facingDirection.z -
        (target.z - hero.position.z) * hero.facingDirection.x) < 1e-6);
      hero.facingDirection.x *= -1;
      hero.facingDirection.z *= -1;
      const inward = field.findInteraction({ hero })?.description;
      assert.ok(inward, "safe grass ahead within the current tile is usable");
      assert.ok(Math.abs((inward.x - hero.position.x) * hero.facingDirection.z -
        (inward.z - hero.position.z) * hero.facingDirection.x) < 1e-6);
      assert.ok(Math.hypot(inward.x - hero.position.x, inward.z - hero.position.z) >= 0.6);
    }
  }
  for (const row of mapData.grid) {
    row.fill(MAP_TILE_TYPE.PATH);
  }
  mapData.grid[2][3] = MAP_TILE_TYPE.GRASS;
  const hero = {
    position: {
      x: -0.4,
      y: 0.04,
      z: 0,
    },
    facingDirection: {
      x: 1,
      z: 0,
    },
  };
  assert.equal(field.findInteraction({ hero })?.description.labelKey,
    "game.interaction.dig", "the hole edge is within reach");
  hero.position.x = -0.9;
  assert.equal(field.findInteraction({ hero }), null,
    "the hole edge is beyond reach");
});

it("keeps digging out of castle cutouts while preserving outdoor grass", () => {
  const mapData = {
    cols: 3,
    rows: 3,
    grid: Array.from({ length: 3 }, () => Array(3).fill(MAP_TILE_TYPE.PATH)),
    heightmap: Array.from({ length: 3 }, () => [0, 0, 0]),
    tileMeta: Array.from({ length: 3 }, () => [{}, {}, {}]),
    objects: [],
  };
  mapData.grid[1][2] = MAP_TILE_TYPE.GRASS;
  const field = new BuriedTreasureField({
    pc,
    mapData,
    modelLibrary: {},
    app: { on: () => ({ off: () => {} }) },
  });
  field.tool = {};
  const hero = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    facingDirection: {
      x: 1,
      z: 0,
    },
  };
  const interaction = () => field.findInteraction({ hero });
  assert.equal(interaction()?.description.labelKey, "game.interaction.dig");
  for (const type of [MAP_TILE_TYPE.CASTLE_WALL, MAP_TILE_TYPE.CASTLE_TOWER]) {
    mapData.grid[1][2] = type;
    assert.equal(interaction(), null, "unprepared castle foundations are not diggable");
    mapData.tileMeta[1][2] = { exposedTerrain: true };
    assert.equal(interaction()?.description.labelKey, "game.interaction.dig",
      "surviving foundation lawn is diggable");
    mapData.tileMeta[1][2] = {};
  }
  mapData.grid[1][2] = MAP_TILE_TYPE.CASTLE_WALL;
  mapData.tileMeta[1][2] = { exposedTerrain: false };
  assert.equal(interaction(), null, "removed turf cannot be dug through a floor");
  mapData.tileMeta[1][2] = {
    exposedTerrain: true,
    terrainCutouts: [{
      minX: 1.2,
      maxX: 2,
      minZ: -0.5,
      maxZ: 0.5,
      minY: -1,
      maxY: 10,
    }],
  };
  assert.equal(interaction(), null, "the centered hole would intersect the room");
  mapData.tileMeta[1][2].terrainCutouts[0].minX = 0.8;
  assert.equal(interaction(), null, "a strip narrower than the hole cannot be excavated");
  mapData.tileMeta[1][2].terrainCutouts[0].minX = 1.5;
  assert.ok(interaction(), "grass outside the cutout remains diggable");
  field.destroy();
});

it("keeps stop, resume, and fill available after digging from an offset landing", () => {
  class HeadlessEntity extends pc.Entity {
    /**
     * @param {string} type
     */
    addComponent(type) {
      if (type === "anim") {
        this.anim = {
          baseLayer: {
            activeStateCurrentTime: 0,
            play: () => {},
          },
          addAnimationState: () => {},
          update: () => {},
        };
      }
      return null;
    }
  }
  for (const x of [-0.4, 2]) {
    let update;
    const field = new BuriedTreasureField({
      pc: {
        ...pc,
        Entity: HeadlessEntity,
      },
      mapData: {
        cols: 5,
        rows: 5,
        grid: Array.from({ length: 5 }, () => Array(5).fill(MAP_TILE_TYPE.GRASS)),
        heightmap: Array.from({ length: 5 }, () => Array(5).fill(0)),
        objects: [],
      },
      modelLibrary: {
        instantiate: (url) => new HeadlessEntity(url),
        getAnimationTracks: () => new Map([["LevelHole", { duration: 1 }]]),
      },
      app: {
        on: (event, callback) => {
          update = callback;

          return { off: () => {} };
        },
      },
    });
    const tool = {};
    field.tool = tool;
    const hero = {
      position: {
        x,
        y: 0.04,
        z: 0,
      },
      facingDirection: {
        x: x < 1 ? 1 : -1,
        z: 0,
      },
      useTool: (selectedTool, options) => {
        assert.equal(selectedTool, tool);
        assert.equal(options.maxFacingAdjustment, 30);
        assert.equal(options.minimumTargetDistance, TREASURE_TOOL_MIN_DISTANCE);

        return true;
      },
    };
    const target = {
      kind: "dig",
      id: "2:3",
      col: 3,
      row: 2,
      x: 1,
      y: 0.004,
      z: 0,
    };
    field.dig(target);
    assert.equal(field.findInteraction({ hero })?.description.labelKey, "game.interaction.dig");
    assert.equal(field.findInteraction({ hero }).interact(), true);
    hero.tool = tool;
    assert.equal(field.findInteraction({ hero })?.description.labelKey, "game.interaction.stop_digging");
    hero.tool = null;
    for (let stroke = 1; stroke < 8; stroke += 1) {
      field.dig(target);
    }
    for (let frame = 0; frame < 5; frame += 1) {
      update(0.1);
    }
    const fill = field.findInteraction({ hero });
    assert.equal(fill?.description.labelKey, "game.interaction.fill_hole");
    assert.equal(fill.description.id, target.id);
    assert.equal(fill.interact(), true);
    hero.facingDirection.x *= -1;
    assert.notEqual(field.findInteraction({ hero })?.description.id, target.id,
      "a hole behind the hero is not selected");
    hero.facingDirection.x *= -1;
    hero.tool = tool;
    assert.equal(field.findInteraction({ hero })?.description.labelKey, "game.interaction.stop_filling");
    hero.tool = null;
    field.scoopFillSoil(fill.description);
    field.returnFillSoil(fill.description);
    const restoredPile = field.entity.findByName(`Excavated earth pile ${target.id}`);
    assert.equal(restoredPile.getLocalScale().x, 1, "cancelled pickup restores its soil");
    field.scoopFillSoil(fill.description);
    assert.equal(field.fill(fill.description), false);
    assert.equal(field.findInteraction({ hero })?.description.labelKey, "game.interaction.fill_hole");
    const hole = field.entity.findByName(`Excavated treasure hole ${target.id}`);
    const pile = field.entity.findByName(`Excavated earth pile ${target.id}`);
    const patch = field.entity.findByName(`Filled earth patch ${target.id}`);
    // These entities have no Application root in this headless fixture.
    field.entity._notifyHierarchyStateChanged(field.entity, true);
    assert.equal(patch.enabled, false, "soil has not reached the hole at launch");
    assert.equal(hole.getLocalScale().x, 1, "preserve the cavity footprint");
    update(0.1);
    assert.ok(pile.getLocalScale().x < 1, "the source pile loses departing soil");
    assert.equal(patch.enabled, false, "soil must travel before filling the cavity");
    for (let frame = 0; frame < 8; frame += 1) {
      update(0.1);
    }
    assert.equal(patch.enabled, true);
    assert.equal(hole.enabled, true, "the first stroke fills one third of the hole");
    assert.ok(Math.abs(patch.getLocalPosition().y - target.y - 0.014 + 0.2) < 1e-6);
    field.scoopFillSoil(fill.description);
    assert.equal(field.fill(fill.description), false, "a second stroke still needs one more scoop");
    for (let frame = 0; frame < 9; frame += 1) {
      update(0.1);
    }
    assert.equal(hole.enabled, true, "the hole stays open after two scoops");
    assert.equal(pile.enabled, false, "two scoops empty the source pile");
    assert.ok(Math.abs(patch.getLocalPosition().y - target.y - 0.014 + 0.1) < 1e-6);
    assert.equal(field.isFillRimStage(target.id), true);
    field.levelFillRim(fill.description);
    update(0.1);
    update(0.1);
    const rimTime = hole.anim.baseLayer.activeStateCurrentTime;
    assert.ok(rimTime > 0 && rimTime < 1, "the authored rim moves while the blade pushes");
    assert.ok(patch.getLocalPosition().y > target.y - 0.086, "the rim adds soil to the cavity");
    field.returnFillSoil(fill.description);
    update(0.1);
    assert.equal(hole.anim.baseLayer.activeStateCurrentTime, rimTime, "interrupting stops rim movement");
    field.levelFillRim(fill.description);
    update(0.1);
    assert.ok(hole.anim.baseLayer.activeStateCurrentTime > rimTime, "resume keeps the previous rim pose");
    update(0.1);
    const settledAfterFirstScrape = patch.getLocalPosition().y;
    update(0.2);
    assert.equal(patch.getLocalPosition().y, settledAfterFirstScrape,
      "soil holds while the blade lifts between edge scrapes");
    assert.equal(field.fill(fill.description), true);
    assert.equal(field.canFill(target.id), true, "keep the hole until the last soil lands");
    for (let frame = 0; frame < 9; frame += 1) {
      update(0.1);
    }
    assert.equal(field.canFill(target.id), false);
    assert.equal(hole.enabled, false);
    assert.equal(pile.enabled, false);
    assert.ok(Math.abs(patch.getLocalPosition().y - target.y - 0.014) < 1e-6);
    const neighbor = {
      kind: "dig",
      id: "1:3",
      col: 3,
      row: 1,
      x: 1,
      y: 0.004,
      z: -1,
    };
    field.dig(neighbor);
    field.entity._notifyHierarchyStateChanged(field.entity, true);
    const neighboringPile = field.entity.findByName(`Excavated earth pile ${neighbor.id}`);
    assert.equal(neighboringPile.enabled, true,
      "filled ground supports the next excavation's spoil without allowing another dig");
    assert.equal(field.canDig(target.id), false);
    field.destroy();
  }
});

for (const surface of ["path", "decorated grass"]) {
  it(`keeps spoil on its throw side beside ${surface}`, () => {
    const grid = Array.from({ length: 5 }, () => Array(5).fill(MAP_TILE_TYPE.GRASS));
    if (surface === "path") {
      grid[2][3] = MAP_TILE_TYPE.PATH;
    }
    const field = new BuriedTreasureField({
      pc,
      mapData: {
        cols: 5,
        rows: 5,
        grid,
        heightmap: Array.from({ length: 5 }, () => Array(5).fill(0)),
        objects: [],
        groundCoverData: surface === "decorated grass" ? [{
          col: 3,
          row: 2,
        }] : [],
      },
      modelLibrary: { instantiate: (url) => new pc.Entity(url) },
      app: { on: () => ({ off: () => {} }) },
    });
    field.dig({
      kind: "dig",
      id: "2:2",
      col: 2,
      row: 2,
      x: 0,
      y: 0.004,
      z: 0,
    });
    field.entity._notifyHierarchyStateChanged(field.entity, true);
    const pile = field.entity.findByName("Excavated earth pile 2:2");
    assert.equal(pile.enabled, true);
    assert.equal(pile.getLocalPosition().x, 0.42);
    assert.equal(pile.getLocalPosition().z, 0.3);
    field.destroy();
  });
}

it("moves the spoil pile away from a lower neighboring terrace", () => {
  const models = [];
  const field = new BuriedTreasureField({
    pc,
    mapData: {
      cols: 5,
      rows: 5,
      grid: Array.from({ length: 5 }, () => Array(5).fill(MAP_TILE_TYPE.GRASS)),
      heightmap: Array.from({ length: 5 }, (_, row) => Array(5).fill(row > 2 ? -1 : 0)),
      objects: [],
    },
    modelLibrary: {
      instantiate: (url) => {
        const entity = new pc.Entity(url);
        models.push(entity);

        return entity;
      },
    },
    app: { on: () => ({ off: () => {} }) },
  });
  field.dig({
    kind: "dig",
    id: "2:2",
    col: 2,
    row: 2,
    x: 0,
    y: 0.004,
    z: 0,
  }, {
    x: 0,
    z: 1,
  });
  const pile = models.find((entity) => entity.name.startsWith("Excavated earth pile"));
  field.entity._notifyHierarchyStateChanged(field.entity, true);
  assert.equal(pile.enabled, true,
    "an unsupported throw places the mound on the opposite side");
  assert.equal(pile.getLocalPosition().x, -0.42);
  assert.equal(pile.getLocalPosition().z, -0.3);
  assert.ok(pile.getLocalPosition().z + 0.34 <= 0.5,
    "the complete mound remains on the supported terrace");
  field.dig({
    kind: "dig",
    id: "2:2",
  }, {
    x: 0,
    z: -1,
  });
  assert.ok(pile.getLocalPosition().x < 0 && pile.getLocalPosition().z < 0,
    "resuming from the opposite side updates the pile to match the new throw");
  assert.ok(Math.abs(Math.hypot(pile.getLocalPosition().x, pile.getLocalPosition().z) - Math.hypot(0.42, 0.3)) < 1e-6,
    "supported piles retain their full separation from the cavity");
  field.destroy();
});

it("reveals the already instantiated chest and spawns its stored contents without rerolling", () => {
  const mapData = GameMapLoader.load({
    cols: 1,
    rows: 1,
    grid: [[1]],
    heightmap: [[2]],
    objects: [],
  }, () => 0.1);
  mapData.islandConnectorData = {
    nearIsland: ["0,0"],
    farIsland: [],
  };
  const cube = mapData.objects.find((item) => item.buriedTreasure);
  cube.buriedTreasure.contents = ["gold", "silver", "copper"];
  let update;
  const models = [];
  const modelLibrary = {
    instantiate: (url) => {
      const entity = new pc.Entity(url);
      // Animation playback normally needs a graphics application; retain real transforms.
      entity.addComponent = () => {
        entity.anim = {
          addAnimationState: () => {},
          update: () => {},
          baseLayer: { play: () => {} },
        };
      };
      models.push({
        url,
        entity,
      });

      return entity;
    },
    getAnimationTracks: () => new Map([["Open", { duration: 1 }], ["open", { duration: 1 }]]),
  };
  let cutRadius = 0;
  const field = new BuriedTreasureField({
    pc,
    mapData,
    modelLibrary,
    onTerrainExcavated: (position, radius) => {
      cutRadius = radius;
    },
    app: {
      on: (event, callback) => {
        update = callback;

        return { off: () => {} };
      },
    },
  });
  // Mirror the live application root for hierarchy-enabled checks.
  const root = new pc.GraphNode();
  root._enabledInHierarchy = true;
  root.addChild(field.entity);
  const chest = models.find(({ url }) => url.includes("treasure-chest")).entity;
  assert.equal(chest.parent.parent, field.entity);
  assert.ok(chest.getLocalPosition().y < mapData.heightmap[0][0]);
  assert.equal(chest.enabled, false, "buried chests do not render or animate");
  const target = {
    kind: "dig",
    id: "0:0",
    col: 0,
    row: 0,
    x: 0.08,
    y: 2,
    z: -0.04,
  };
  field.dig(target, {
    x: 1,
    z: 0,
  });
  assert.equal(chest.enabled, true, "digging exposes the existing chest");
  const pile = models.find(({ url }) => url.includes("excavated-earth.glb")).entity;
  assert.equal(pile.enabled, false, "a cramped single tile cannot put its pile beneath the chest");
  assert.ok(Math.abs(pile.getLocalPosition().x) + 0.34 <= 0.5);
  assert.ok(Math.abs(pile.getLocalPosition().z) + 0.34 <= 0.5,
    "spoil stays supported even when the preferred side extends beyond the only tile");
  assert.ok(Math.abs(chest.getLocalPosition().x - target.x) < 1e-6);
  assert.ok(Math.abs(chest.getLocalPosition().z - target.z) < 1e-6);
  const hole = models.find(({ url }) => url.includes("/hole.glb")).entity;
  const holeY = hole.getPosition().y;
  field.setIslandOffsets(0.2, -0.1);
  assert.ok(Math.abs(hole.getPosition().y - holeY - 0.2) < 1e-6);
  assert.equal(hole.parent, chest.parent);
  for (let stroke = 1; stroke < 8; stroke += 1) {
    assert.equal(field.dig(target), stroke === 7, "finish after working the whole rim");
  }
  for (let frame = 0; frame < 25; frame += 1) {
    update(0.1);
  }
  assert.equal(field.canOpen(target.id), true);
  for (const [x, z] of [[1, 0], [0, -1], [-1, 0], [0, 1]]) {
    field.applyHeroPosition({
      x: target.x + x,
      y: target.y,
      z: target.z + z,
    });
    update(0.016);
    const lockDirection = chest.getRotation().transformVector(new pc.Vec3(0, 0, 1));
    assert.ok(lockDirection.dot(new pc.Vec3(x, 0, z)) > 0.999,
      "the authored lock side faces the hero from every side");
  }
  assert.ok(cutRadius > 0.324 && cutRadius < 0.35,
    "the terrain cut clears the uneven cavity edge while staying beneath its soil rim");
  assert.ok(Math.abs(chest.getLocalPosition().y - target.y) < 1e-6,
    "the chest base rises all the way to the ground surface");
  field.tool = {};
  const chestInteraction = field.findInteraction({
    hero: {
      position: {
        x: 1.4,
        y: 2.04,
        z: 0,
      },
      facingDirection: {
        x: -1,
        z: 0,
      },
    },
  });
  assert.equal(chestInteraction?.description.labelKey, "game.interaction.open_treasure");
  assert.equal(models.filter(({ url }) => url.includes("treasure-chest")).length, 1);
  field.open(target);
  for (let frame = 0; frame < 20; frame += 1) {
    update(0.1);
  }
  assert.deepEqual(models.filter(({ url }) => url.includes("/coin.glb")).map(({ entity }) => entity.name),
    ["gold treasure coin", "silver treasure coin", "copper treasure coin"]);
});
