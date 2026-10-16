import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as pc from "playcanvas";
import { BookCover } from "../../../../../../src/game/objects/castle-props/book/BookCover.js";

test("equal bindings share materials until the last book is removed", () => {
  const source = new pc.StandardMaterial();
  source.name = "Book leather";
  const models = [new pc.Entity("first"), new pc.Entity("second"), new pc.Entity("different color")];
  const meshes = models.map(model => {
    const mesh = { material: source };
    model.findComponents = () => [{ meshInstances: [mesh] }];

    return mesh;
  });
  BookCover.apply(models[0], [0.2, 0.3, 0.4]);
  BookCover.apply(models[1], [0.2, 0.3, 0.4]);
  BookCover.apply(models[2], [0.4, 0.3, 0.2]);
  assert.equal(meshes[0].material, meshes[1].material);
  assert.notEqual(meshes[0].material, meshes[2].material);
  let destroyed = 0;
  const shared = meshes[0].material;
  const destroy = shared.destroy.bind(shared);
  shared.destroy = () => {
    destroyed++; destroy();
  };
  models[0].destroy();
  assert.equal(destroyed, 0);
  models[1].destroy();
  assert.equal(destroyed, 1);
  models[2].destroy();
  source.destroy();
});

test("book state is independent of placement and artwork, with matching visual and collision assets", async () => {
  const sourceUrl = new URL("../../../../../../src/game/objects/castle-props/book/Book.js", import.meta.url);
  const source = (await readFile(sourceUrl, "utf8"))
    .replace(/import (\w+) from [^;]+;/g, 'const $1 = "$1.glb";')
    .replace(/from "(\.\.?\/[^\"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, sourceUrl).href)}`);
  const { Book } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const components = [];
  class Entity extends pc.Entity {
    addComponent(type) {
      components.push(type);
    }
  }
  const leather = new pc.StandardMaterial();
  leather.name = "Book leather 1";
  const parchment = new pc.StandardMaterial();
  parchment.name = "Book parchment and brass";
  assert.equal(Book.modelUrls.length, 4);
  for (const [properties, expected] of [
    [{}, "closedUrl.glb"],
    [{ isOpen: false }, "closedUrl.glb"],
    [{ isOpen: true }, "openUrl.glb"],
    [{
      isOpen: true,
      pose: "upright",
    }, "openUrl.glb"],
    [{
      isOpen: true,
      style: "classic",
    }, "classicOpenUrl.glb"],
    [{
      isOpen: false,
      pose: "upright",
      sourceShelfId: "cabinet",
    }, "uprightClosedUrl.glb"],
    [{
      isOpen: false,
      pose: "upright",
    }, "uprightClosedUrl.glb"],
  ]) {
    const loaded = [];
    const renders = [];
    components.length = 0;
    const book = new Book({
      pc: {
        ...pc,
        Entity,
      },
      definition: {
        id: "book",
        object: "Book",
        ...properties,
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
        coverColor: [0.2, 0.38, 0.62],
      },
      modelLibrary: {
        instantiate: (url) => {
          loaded.push(url);
          const model = new pc.Entity("model");
          const render = { meshInstances: [{ material: leather }, { material: parchment }] };
          renders.push(render);
          model.findComponents = () => [render];

          return model;
        },
      },
    });
    assert.equal(book.modelUrl, expected);
    assert.equal(book.definition.isOpen, properties.isOpen);
    assert.equal(Object.hasOwn(book.definition, "state"), false);
    assert.equal(Object.hasOwn(book.definition, "variant"), false);
    assert.ok(loaded.every(url => url === expected));
    assert.equal(loaded.length, properties.sourceShelfId ? 1 : 2);
    assert.deepEqual(components, properties.sourceShelfId ? [] : ["collision", "rigidbody"]);
    const tinted = renders[0].meshInstances[0].material;
    assert.notEqual(tinted, leather);
    assert.equal(renders[0].meshInstances[1].material, parchment);
    assert.equal(leather.diffuse.toString(), "#ffffff");
    let destroyed = 0;
    tinted.destroy = () => {
      destroyed++;
    };
    book.setIslandOffsets(1, 2);
    book.destroy();
    assert.equal(destroyed, 1);
  }
  leather.destroy();
  parchment.destroy();
});
