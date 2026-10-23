import { CastleAtticAccess } from "../../../../../../src/game/generator/castle/CastleAtticAccess.js";
import { FireplaceChimneyFootprint } from "../../../../../../src/game/objects/castle-props/fireplace/FireplaceChimneyFootprint.js";
import { HeroLadderClimb } from "../../../../../../src/game/objects/characters/hero/HeroLadderClimb.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import assert from "node:assert/strict";
import { it } from "node:test";
import { HatchInteraction } from "../../../../../../src/game/objects/architecture/hatch/HatchInteraction.js";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleLadderMapObjects } from "../../../../../../src/game/objects/castle/stairs/CastleLadderMapObjects.js";

it("opens a standalone hatch, reports its lock, and refuses locked or distant use", () => {
  let opened = 0;
  const hatch = {
    definition: { id: "standalone" },
    visualRoots: [{
      getPosition: () => ({
        x: 0,
        y: 3,
        z: 0,
      }),
    }],
    locked: true,
    open: () => {
      if (hatch.locked) {
        return false;
      } opened++;

      return true;
    },
  };
  const hero = {
    position: {
      x: 0,
      y: 3,
      z: 0,
    },
  };
  const action = new HatchInteraction(hatch, hero);
  assert.equal(action.description.labelKey, "game.interaction.locked_hatch");
  assert.equal(action.interact(), false);
  hatch.locked = false;
  assert.equal(action.interact(), true);
  assert.equal(opened, 1);
  hero.position.x = 4;
  assert.equal(action.interact(), false);
});

it("places independent locked attic access below blue roofs across mirrored castle entrances", async () => {
  for (const seed of [4, 5]) {
    for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
      const buildPlan = await CastleGenerator.generate({
        position: {
          x: -14,
          z: -14,
          width: 28,
          depth: 28,
          elevation: 3,
        },
        doors: [{
          side,
          offset: 13,
          width: 2,
        }],
        seed,
        basePlanId: "castle-demo-compact",
      });
      const plan = buildPlan.metadata.runtime.residential;
      assert.equal(plan.atticAccesses.length, 1);
      const access = plan.atticAccesses[0];
      assert.equal(access.locked, true);
      const layout = new CastleResidentialLayout(buildPlan);
      const local = layout.toLocal(access.position.x, access.position.z);
      const room = plan.spaces.find(room => room.floorY === access.bottom.y && local.x >= room.minX && local.x <= room.maxX && local.z >= room.minZ && local.z <= room.maxZ);
      const wallDistance = Math.min(local.x - room.minX, room.maxX - local.x, local.z - room.minZ, room.maxZ - local.z);
      assert.ok(Math.abs(wallDistance - 0.18) < 0.001, "ladder stays beside a wall");
      assert.equal(access.top.y - access.bottom.y, 3);
      const desk = plan.furniture.find(item => item.object === "Table" && item.roomId === room.id);
      if (desk) {
        assert.equal(desk.placementIssue, undefined);
        const gap = Math.min(desk.x - desk.width * desk.scale / 2 - room.minX, room.maxX - desk.x - desk.width * desk.scale / 2, desk.z - desk.depth * desk.scale / 2 - room.minZ, room.maxZ - desk.z - desk.depth * desk.scale / 2);
        assert.ok(Math.abs(gap - 0.01) < 0.001, "desk back stays close to the room's wall face");
      }
      const hole = access.hole;
      for (const item of plan.furniture.filter(item => item.object === "Fireplace")) {
        const flue = FireplaceChimneyFootprint.bounds(item, plan.spaces);
        if (flue.bottom >= access.top.y + 0.3 || flue.top <= access.bottom.y) {
          continue;
        }
        const area = access.clearance;
        assert.ok(area.maxX <= flue.minX || area.minX >= flue.maxX || area.maxZ <= flue.minZ || area.minZ >= flue.maxZ, "final chimney clears ladder and approach");
        assert.ok(hole.maxX + 0.08 <= flue.minX || hole.minX - 0.08 >= flue.maxX || hole.maxZ + 0.08 <= flue.minZ || hole.minZ - 0.08 >= flue.maxZ, "final chimney clears hatch frame");
      }
      assert.ok(!plan.walkableAreas.some(area => area.floorY === access.top.y &&
        area.minX < hole.maxX && area.maxX > hole.minX && area.minZ < hole.maxZ && area.maxZ > hole.minZ));
      const map = {
        cols: 64,
        rows: 64,
        objects: [{
          id: "castle",
          object: "Castle",
          buildPlan,
        }],
      };
      CastleLadderMapObjects.prepareMap(map);
      CastleLadderMapObjects.prepareMap(map);
      const ladder = map.objects.find(item => item.object === "Ladder");
      const hatch = map.objects.find(item => item.id === ladder.hatchId);
      assert.equal(hatch.object, "Hatch");
      assert.equal(hatch.locked, true);
      assert.equal(hatch.position.y, access.top.y);
      assert.equal(map.objects.filter(item => item.object === "Hatch").length, 1);
    }
  }
});

it("climbs up to a locked hatch, pauses safely below it, and reverses down the ladder", () => {
  const controller = new HeroLadderClimb();
  const ladder = {
    passageBlocked: true,
    landing: end => ({
      x: 0,
      y: end === "top" ? 3 : 0,
      z: 0,
    }),
    climbFacing: {
      x: 0,
      z: 1,
    },
    openHatch: () => true,
  };
  controller.register(ladder);
  const options = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    input: {
      x: 0,
      y: 1,
    },
    movement: {
      x: 0,
      z: 1,
    },
    allowed: true,
    jump: false,
  };
  for (let frame = 0; frame < 180; frame++) {
    const motion = controller.update(1 / 60, options);
    assert.ok(motion, "locked hatch does not disable the ladder");
    options.position.y += motion.velocity.y / 60;
    assert.ok(options.position.y <= 1.15 + 0.001, "head stays clear of lid and frame");
  }
  assert.ok(Math.abs(options.position.y - 1.15) < 0.001);
  const stopped = controller.update(1 / 60, options);
  assert.equal(stopped.velocity.y, 0);
  assert.equal(stopped.speed, 0);
  options.movement.z = -1;
  assert.ok(controller.update(1 / 60, options).velocity.y < 0);
  options.movement.z = 1;
  ladder.passageBlocked = false;
  assert.ok(controller.update(1 / 60, options).velocity.y > 0, "unlocking permits continued ascent");
});

it("keeps the ladder, approach and hatch clear of a chimney rising from a lower room", () => {
  const room = {
    id: "upper",
    kind: "room",
    minX: 0,
    maxX: 8,
    minZ: 0,
    maxZ: 8,
    floorY: 3,
    height: 3,
  };
  const fireplace = {
    object: "Fireplace",
    x: 0.5,
    z: -0.0273,
    floorY: 0,
    rotation: 0,
    scale: 1,
  };
  const plan = {
    spaces: [{
      ...room,
      id: "lower",
      floorY: 0,
    }, room],
    furniture: [fireplace],
    openings: [],
    authoredStairs: [],
    walkableAreas: [],
  };
  const roof = {
    id: "blue",
    minX: 0,
    maxX: 8,
    minZ: 0,
    maxZ: 8,
    y: 6,
    shape: "pyramid",
  };
  CastleAtticAccess.prepare(plan, [roof], (x, z, y) => ({
    x,
    y,
    z,
  }), 0);
  const access = plan.atticAccesses[0];
  const flue = FireplaceChimneyFootprint.bounds(fireplace, plan.spaces);
  assert.ok(flue.bottom < access.bottom.y && flue.top > access.top.y, "fixture flue spans the whole ladder storey");
  const { position, bottom, hole } = access;
  const reserved = {
    minX: Math.min(position.x - 0.5, bottom.x - 0.35, hole.minX - 0.08),
    maxX: Math.max(position.x + 0.5, bottom.x + 0.35, hole.maxX + 0.08),
    minZ: Math.min(position.z - 0.5, bottom.z - 0.35, hole.minZ - 0.08),
    maxZ: Math.max(position.z + 0.5, bottom.z + 0.35, hole.maxZ + 0.08),
  };
  assert.ok(reserved.maxX <= flue.minX || reserved.minX >= flue.maxX || reserved.maxZ <= flue.minZ || reserved.minZ >= flue.maxZ);
  assert.ok(Math.abs(position.z - room.minZ - 0.18) < 0.001, "replacement remains near the wall");
});

it("replaces a library bookshelf and its contents while preserving the desk's original wall slot", () => {
  const room = {
    id: "library",
    kind: "room",
    minX: 0,
    maxX: 8,
    minZ: 0,
    maxZ: 8,
    floorY: 3,
    height: 3,
  };
  const shelf = {
    object: "Shelf",
    role: "libraryProp",
    roomId: "library",
    floorY: 3,
    x: 2,
    z: 7.82,
    width: 0.85,
    depth: 0.36,
    scale: 1,
    rotation: 0,
  };
  const desk = {
    object: "Table",
    role: "libraryProp",
    roomId: "library",
    floorY: 3,
    x: 4,
    z: 7.6,
    width: 0.9,
    depth: 0.55,
    scale: 1,
    rotation: 0,
  };
  const shelfBook = {
    ...shelf,
    object: "Book",
    y: 2.5,
  };
  const deskBook = {
    ...desk,
    object: "Book",
    y: 0.65,
  };
  const plan = {
    spaces: [room],
    furniture: [shelf, shelfBook, desk, deskBook],
    openings: [],
    authoredStairs: [],
    walkableAreas: [],
  };
  CastleAtticAccess.prepare(plan, [{
    id: "blue",
    ...room,
    y: 6,
    shape: "pyramid",
  }], (x, z, y) => ({
    x,
    y,
    z,
  }), 0);
  assert.equal(plan.atticAccesses[0].position.x, shelf.x);
  assert.ok(Math.abs(plan.atticAccesses[0].position.z - shelf.z) < 0.001);
  assert.deepEqual(plan.furniture, [desk, deskBook]);
  assert.equal(desk.x, 4);
  assert.equal(desk.z, 7.6);
  assert.equal(desk.wallMountBack, -0.41);
});
