import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as pc from "playcanvas";
import { colorFromHex } from "../../../../src/game/helpers/colors.js";

// Keep real Engine materials; substitute browser-only factory and asset imports.
const source = readFileSync(new URL("../../../../src/game/rendering/SceneMaterialLibrary.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replace("export class SceneMaterialLibrary", "class SceneMaterialLibrary");
const registrations = [];
const factory = {
  registerMaterials: (materials, create, transforms) => {
    registrations.push(transforms.length);
    materials.set("object", create("object", {
      color: 0x123456,
      texture: "object",
      scaleU: 0.5,
      flipU: true,
      emissive: 0xabcdef,
      opacity: 0.4,
    }));
  },
  configureTexture: (engine, name, texture, mipmaps) => {
    texture.objectConfigured = mipmaps;
  },
};
const paths = {
  register: (materials, create) => materials.set("path", create("path", {
    color: 0xffffff,
    texture: "path",
  })),
};
const SceneMaterialLibrary = new Function("woodTexture", "MapObjectFactory", "PathSurfaceMaterials", "colorFromHex", `${source}\nreturn SceneMaterialLibrary;`)(
  { url: "/wood" }, factory, paths, colorFromHex,
);

function fixture() {
  const assets = new Map();
  const settings = {
    mipmaps: true,
    anisotropy: 8,
  };
  let failure = null;
  const calls = [];
  const library = {
    loadNamed: async (urls, progress) => {
      calls.push(urls);
      if (failure) {
        throw failure;
      }
      for (const [name, url] of Object.entries(urls)) {
        if (!assets.has(name)) {
          assets.set(name, {
            resource: { url },
            unload: () => assert.fail("Materials cannot unload borrowed assets"),
          });
        }
      }
      progress?.("last", Object.keys(urls).length, Object.keys(urls).length);
    },
    get: (url, name) => assets.get(name),
    destroy: () => assert.fail("Materials cannot destroy the texture library"),
  };

  return {
    owner: new SceneMaterialLibrary({
      pc,
      textureLibrary: library,
      graphicsSettings: settings,
    }),
    assets,
    settings,
    calls,
    fail: (error) => {
      failure = error;
    },
  };
}

test("loads named samplers with progress and preserves the authored material properties", async () => {
  const { owner, assets } = fixture();
  const progress = [];
  await owner.load({
    water: "/water",
    waterSide: "/water",
    castleStone: "/stone",
    castleDoor: "/wood",
    object: "/object",
  }, (...args) => progress.push(args));
  assert.deepEqual(progress, [["last", 5, 5]]);
  const water = owner.materials.get("water");
  assert.equal(water.diffuseMap, assets.get("water").resource);
  assert.equal(water.gloss, 0.22);
  assert.equal(water.diffuse.toString(), new pc.Color(0xd8 / 255, 0xf2 / 255, 1).toString());
  const side = owner.materials.get("waterSide-1");
  assert.equal(side.diffuseMap, assets.get("waterSide").resource);
  assert.equal(side.diffuseMapTiling.x, -0.72);
  assert.equal(side.diffuseMapOffset.x, 0.86);
  assert.equal(owner.sideVariantCount, 6);
  assert.equal(registrations.at(-1), 6);
  const object = owner.materials.get("object");
  assert.equal(object.diffuseMapTiling.x, -0.5);
  assert.equal(object.emissiveIntensity, 0.45);
  assert.equal(object.opacity, 0.4);
  assert.equal(object.blendType, pc.BLEND_NORMAL);
  assert.equal(object.depthWrite, false);
  const stone = assets.get("castleStone").resource;
  assert.equal(stone.magFilter, pc.FILTER_NEAREST);
  assert.equal(stone.minFilter, pc.FILTER_LINEAR_MIPMAP_LINEAR);
  assert.equal(stone.anisotropy, 8);
  assert.equal(stone.addressU, pc.ADDRESS_CLAMP_TO_EDGE);
  const wood = assets.get("castleDoor").resource;
  assert.equal(wood.addressU, pc.ADDRESS_REPEAT);
  assert.equal(wood.addressV, pc.ADDRESS_REPEAT);
  assert.equal(wood.objectConfigured, true);
  owner.destroy();
});

test("map changes and development registration reuse materials and previously loaded textures", async () => {
  const { owner, assets, settings } = fixture();
  await owner.load({ water: "/water" });
  const materials = owner.materials;
  const textures = owner.textureAssets;
  const water = materials.get("water");
  const object = materials.get("object");
  const waterTexture = water.diffuseMap;
  assert.equal(object.diffuseMap, null);
  settings.mipmaps = false;
  settings.anisotropy = 2;
  await owner.load({
    object: "/object",
    water: "/water",
  });
  assert.equal(owner.materials, materials);
  assert.equal(owner.textureAssets, textures);
  assert.equal(materials.get("water"), water);
  assert.equal(materials.get("object"), object);
  assert.equal(water.diffuseMap, waterTexture);
  assert.equal(waterTexture.minFilter, pc.FILTER_LINEAR);
  assert.equal(waterTexture.anisotropy, 2);
  assert.equal(object.diffuseMap, assets.get("object").resource);
  await owner.load({ path: "/path" });
  assert.equal(water.diffuseMap, waterTexture);
  assert.equal(object.diffuseMap, assets.get("object").resource);
  let destroyed = 0;
  for (const material of materials.values()) {
    const original = material.destroy.bind(material);
    material.destroy = () => {
      destroyed++;
      original();
    };
  }
  const count = materials.size;
  owner.destroy();
  owner.destroy();
  assert.equal(destroyed, count);
  assert.equal(materials.size, 0);
  assert.equal(textures.size, 0);
  assert.equal(assets.size, 3);
});

test("failed loads leave shared materials intact and can retry", async () => {
  const { owner, fail, assets } = fixture();
  await owner.load({ water: "/water" });
  const water = owner.materials.get("water");
  const failure = new TypeError("Failed texture request");
  fail(failure);
  await assert.rejects(owner.load({ object: "/broken" }), (error) => error === failure);
  assert.equal(owner.materials.get("water"), water);
  assert.equal(owner.textureAssets.has("object"), false);
  fail(null);
  await owner.load({ object: "/fixed" });
  assert.equal(owner.materials.get("object").diffuseMap, assets.get("object").resource);
  owner.destroy();
});
