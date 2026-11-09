import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec2, Vec4, Color } from "playcanvas";

const source = readFileSync(new URL("../../../../src/game/ui/InventoryFullReactionHud.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replace("export class InventoryFullReactionHud", "class InventoryFullReactionHud");
const InventoryFullReactionHud = new Function("Vec2", "fullInventoryEffectModelUrl", `${source}\nreturn InventoryFullReactionHud;`)(Vec2, "effect.glb");

class Entity {
  children = [];
  addComponent(type, options) {
    this[type] = {
      ...options,
      syncDrawOrder: () => {},
    };
  }
  addChild(child) {
    this.children.push(child);
  }
  setLocalPosition(...value) {
    this.position = value;
  }
  setLocalScale(...value) {
    this.scale = value;
  }
  setLocalEulerAngles(...value) {
    this.rotation = value;
  }
  destroy() {
    this.destroyCount = (this.destroyCount ?? 0) + 1;
  }
}
class Texture {
  setSource() {}
  destroy() {
    this.destroyCount = (this.destroyCount ?? 0) + 1;
  }
}

it("anchors, replays and expires feedback while disposing only owned resources", () => {
  const previousDocument = globalThis.document;
  const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    let width = 1280;
    const canvas = {
      clientWidth: 1280,
      clientHeight: 720,
      getBoundingClientRect: () => ({
        width,
        height: 720,
      }),
    };
    const parent = new Entity();
    const borrowedTexture = new Texture();
    const requests = [];
    const options = {
      pc: {
        Entity,
        Texture,
        Vec2,
        Vec4,
        Color,
      },
      app: { graphicsDevice: { canvas } },
      parent,
      itemProjector: {
        textureFor: (url) => {
          requests.push(url);

          return borrowedTexture;
        },
      },
    };
    const hud = new InventoryFullReactionHud(options);
    const effect = parent.children[0];
    const ownedTexture = effect.children[0].element.texture;
    assert.equal(hud.visible, false);
    hud.update(1);
    assert.equal(hud.show(new Vec2(740, 260)), true);
    assert.deepEqual(effect.position, [100, 100, 0]);
    assert.deepEqual(effect.scale, [0.01, 0.01, 1]);
    assert.equal(effect.children[1].element.texture, borrowedTexture);
    assert.equal(effect.children[2].element.texture, borrowedTexture);
    hud.update(0.2, new Vec2(840, 160));
    assert.deepEqual(effect.position, [200, 200, 0]);
    width = 320;
    hud.update(0, new Vec2(740, 260));
    assert.deepEqual(effect.position, [200, 200, 0]);
    hud.show();
    assert.deepEqual(effect.position, [200, 200, 0]);
    assert.deepEqual(requests, ["effect.glb"]);
    hud.update(1);
    assert.ok(effect.element.opacity > 0 && effect.element.opacity < 1);
    hud.update(1);
    assert.equal(hud.visible, false);
    hud.show();
    assert.equal(hud.visible, true);
    assert.equal(effect.element.opacity, 1);
    hud.destroy();
    hud.destroy();
    hud.update(1);
    assert.equal(hud.show(), false);
    assert.equal(hud.visible, false);
    assert.equal(effect.destroyCount, 1);
    assert.equal(ownedTexture.destroyCount, 1);
    assert.equal(borrowedTexture.destroyCount, undefined);
    const replacement = new InventoryFullReactionHud(options);
    assert.equal(replacement.visible, false);
    replacement.show();
    assert.deepEqual(parent.children[1].position, [0, 0, 0]);
    replacement.destroy();
  } finally {
    globalThis.document = previousDocument;
  }
});

const inventorySource = readFileSync(new URL("../../../../src/game/ui/InventoryHud.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replace("export class InventoryHud", "class InventoryHud");
class Projector {
  textureFor() {
    return null;
  }
  destroy() {
    this.destroyed = true;
  }
}
const theme = new Proxy({}, { get: () => () => "#000000" });
const painterSource = readFileSync(new URL("../../../../src/game/ui/InventoryPanelPainter.js", import.meta.url), "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replaceAll("export ", "");
const InventoryHud = new Function("Vec2", "InventoryItemProjector", "gameUiTheme", "inventoryMushroomPart", "InventoryFullReactionHud", `${painterSource}\n${inventorySource}\nreturn InventoryHud;`)(Vec2, Projector, theme, () => "", InventoryFullReactionHud);

it("preserves inventory gating, modal independence and public teardown contracts", () => {
  const previousDocument = globalThis.document;
  const context = new Proxy({}, {
    get: (target, key) => target[key] ?? (() => ({
      addColorStop: () => {},
      width: 0,
    })),
  });
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const parent = new Entity();
    const canvas = {
      style: {},
      clientWidth: 1280,
      clientHeight: 720,
      getBoundingClientRect: () => ({
        width: 1280,
        height: 720,
      }),
    };
    const hud = new InventoryHud({
      pc: {
        Entity,
        Texture,
        Vec2,
        Vec4,
        Color,
      },
      app: {
        root: parent,
        graphicsDevice: { canvas },
      },
      modelLibrary: {},
    });
    hud.attach();
    assert.equal(InventoryHud.modelUrl, InventoryFullReactionHud.modelUrl);
    assert.equal(hud.showFullReaction(), false);
    hud.setInventory({
      capacity: 1,
      items: [{
        id: "item",
        slot: 0,
      }],
    });
    assert.equal(hud.showFullReaction(new Vec2(740, 260)), true);
    assert.equal(hud.fullReactionVisible, true);
    assert.equal(hud.visible, false);
    hud.visible = true;
    hud.visible = false;
    assert.equal(hud.fullReactionVisible, true);
    hud.update(1.3);
    assert.equal(hud.fullReactionVisible, false);
    hud.destroy();
    assert.equal(hud.showFullReaction(), false);
    assert.equal(hud.fullReactionVisible, false);
    hud.update(1);
  } finally {
    globalThis.document = previousDocument;
  }
});
