import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";

const cloudVoxels = JSON.parse(readFileSync(new URL("../../../../../src/game/objects/scenery/CloudVoxelVariants.json", import.meta.url), "utf8"));
const skySettings = JSON.parse(readFileSync(new URL("../../../../../src/game/objects/scenery/CloudSkySettings.json", import.meta.url), "utf8"));

const source = readFileSync(new URL("../../../../../src/game/objects/scenery/SkyboxCloudField.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export class", "class");
const CloudField = new Function("getAmbientWind", "fragmentGLSL", "vertexGLSL", "PROJECTION_PERSPECTIVE", "cloudVoxels", "CloudShadows", "skySettings", `${source}; return SkyboxCloudField;`)(
  () => ({
    direction: {
      x: 1,
      y: 0,
      z: 0,
    },
    speed: 0.2,
  }), "", "", pc.PROJECTION_PERSPECTIVE, cloudVoxels, class {
    update = () => {};
    destroy = () => {};
  },
  skySettings,
);

/**
 * @returns {{field: CloudField, camera: pc.CameraComponent, parameters: Map<string, number[]>, render: Function, disposed: () => boolean}}
 */
function fixture() {
  const parameters = new Map();
  let render;
  let disposed = false;
  const camera = {
    projection: pc.PROJECTION_PERSPECTIVE,
    fov: 70,
    horizontalFov: false,
    aspectRatio: 2,
  };
  const field = new CloudField({
    pc: {
      ...pc,
      ShaderMaterial: class {
        setParameter = (name, value) => parameters.set(name, value);
        destroy = () => {};
      },
      Texture: class {
        pixels = new Uint8Array(32 * 20 * 4);
        destroyed = false;
        lock = () => this.pixels;
        unlock = () => {};
        destroy = () => {
          this.destroyed = true;
        };
      },
      Mesh: { fromGeometry: () => ({ incRefCount: () => {} }) },
      MeshInstance: class {},
      Entity: class {
        addComponent = () => {};
        destroy = () => {};
      },
    },
    app: {
      graphicsDevice: {},
      on: (event, callback, scope) => {
        assert.equal(event, "prerender");
        render = callback.bind(scope);

        return {
          off: () => {
            disposed = true;
          },
        };
      },
    },
    camera,
    layerId: 100,
  });

  return {
    field,
    camera,
    parameters,
    render,
    disposed: () => disposed,
  };
}

it("matches vertical and horizontal perspective FOV without camera translation", () => {
  const { field, camera, parameters, render } = fixture();
  const tangent = Math.tan(70 * Math.PI / 360);
  assert.deepEqual(parameters.get("uSkyLens"), [tangent * 2, tangent]);
  camera.horizontalFov = true;
  render();
  assert.deepEqual(parameters.get("uSkyLens"), [tangent, tangent / 2]);
  field.destroy();
});

it("keeps the orthographic sky lens fixed across map zoom changes", () => {
  const { field, camera, parameters, render } = fixture();
  camera.projection = pc.PROJECTION_ORTHOGRAPHIC;
  camera.orthoHeight = 10;
  render();
  const lens = parameters.get("uSkyLens");
  camera.orthoHeight = 80;
  render();
  assert.deepEqual(parameters.get("uSkyLens"), lens);
  field.destroy();
});

it("advects clouds with ambient wind and removes its render listener", () => {
  const { field, parameters, render, disposed } = fixture();
  const before = [...parameters.get("uCloudTravel")];
  field.update(0.1);
  render();
  assert.ok(parameters.get("uCloudTravel")[0] > before[0]);
  assert.equal(parameters.get("uCloudTravel")[1], before[1]);
  assert.equal(field.windSpeed, 0.2);
  field.destroy();
  assert.equal(disposed(), true);
});

it("retains all 20 original cloud recipes and overlapping cube proportions", () => {
  assert.equal(cloudVoxels.cubeSize, 1.08);
  assert.equal(cloudVoxels.cubeStep, 0.9);
  assert.deepEqual(cloudVoxels.variants.map((variant) => variant.length),
    [14, 16, 18, 17, 15, 16, 17, 17, 16, 15, 18, 17, 14, 17, 18, 16, 15, 16, 18, 17]);
  for (const variant of cloudVoxels.variants) {
    assert.equal(new Set(variant.map((voxel) => voxel.join(":"))).size, variant.length);
  }
});

it("uploads the original cube coordinates without filtering and releases the atlas", () => {
  const { field, parameters } = fixture();
  const texture = parameters.get("uCloudVoxels");
  assert.deepEqual(parameters.get("uCloudCube"), [0.9, 1.08]);
  for (const [variant, voxels] of cloudVoxels.variants.entries()) {
    for (const [index, voxel] of voxels.entries()) {
      const offset = (variant * 32 + index) * 4;
      assert.deepEqual([...texture.pixels.slice(offset, offset + 4)], [...voxel.map((coordinate) => coordinate + 8), 255]);
    }
    assert.equal(texture.pixels[(variant * 32 + voxels.length) * 4 + 3], 0);
  }
  field.destroy();
  assert.equal(texture.destroyed, true);
});
