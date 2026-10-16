import assert from "node:assert/strict";
import { it } from "node:test";
import { RiverFlowMap } from "../../../../../src/game/objects/water/RiverFlowMap.js";
import { RiverImpactFlow } from "../../../../../src/game/objects/water/RiverImpactFlow.js";

it("marks the three open basin outlets without introducing banks between branches", () => {
  const inlet = {
    col: 2,
    row: 1,
    direction: "SOUTH",
    elevation: 1,
  };
  const basin = {
    col: 2,
    row: 2,
    direction: "SOUTH",
    elevation: 1,
  };
  const root = {
    id: "river",
    cells: [inlet, basin, {
      col: 2,
      row: 3,
      direction: "SOUTH",
      elevation: 1,
    }],
    cascades: [],
  };
  const branches = [
    {
      id: "left",
      sourceId: "river",
      branchStart: 2,
      cells: [inlet, {
        ...basin,
        direction: "WEST",
      }, {
        col: 1,
        row: 2,
        direction: "WEST",
        elevation: 1,
      }],
      cascades: [],
    },
    {
      id: "right",
      sourceId: "river",
      branchStart: 2,
      cells: [inlet, {
        ...basin,
        direction: "EAST",
      }, {
        col: 3,
        row: 2,
        direction: "EAST",
        elevation: 1,
      }],
      cascades: [],
    },
  ];
  const riverData = [root, ...branches];
  const flow = new RiverImpactFlow(riverData);
  assert.deepEqual(flow.bankMask(2, 2), [0, 0, 0, 0]);
  const textures = [];
  class Texture {
    constructor(_device, options) {
      this.name = options.name;
      this.data = options.format === "float" ? new Float32Array(options.width * options.height * 4) : new Uint8Array(options.width * options.height * 4);
      textures.push(this);
    }
    lock() {
      return this.data;
    }
    unlock() {}
    destroy() {
      this.destroyed = true;
    }
  }
  const map = new RiverFlowMap({
    Texture,
    PIXELFORMAT_RGBA32F: "float",
  }, null, {
    cols: 5,
    rows: 5,
    riverData,
  });
  const forks = textures.find(texture => texture.name === "River fork outlets");
  assert.deepEqual([...forks.data.slice((2 * 5 + 2) * 4, (2 * 5 + 2) * 4 + 4)], [2, 2, 8, 11]);
  assert.deepEqual([...forks.data.slice((0 * 5 + 0) * 4, (0 * 5 + 0) * 4 + 4)], [0, 0, 0, 0]);
  const parameters = new Map();
  map.apply({ setParameter: (name, value) => parameters.set(name, value) });
  assert.equal(parameters.get("uRiverForkMap"), forks);
  map.destroy();
  assert.ok(textures.every(texture => texture.destroyed));
});
