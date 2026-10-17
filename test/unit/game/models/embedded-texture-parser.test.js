import assert from "node:assert/strict";
import { test } from "node:test";
import { EmbeddedTextureParser } from "../../../../src/game/models/EmbeddedTextureParser.js";

test("only embedded supported raster images use the fallback parser", () => {
  const parser = new EmbeddedTextureParser({});
  const asset = { file: { contents: new ArrayBuffer(8) } };
  assert.equal(parser.canParse({
    ext: "png",
    asset,
  }), true);
  assert.equal(parser.canParse({
    ext: "ktx2",
    asset,
  }), false);
  assert.equal(parser.canParse({
    ext: "png",
    asset: { file: {} },
  }), false);
});

test("successful bitmap decoding and other failures pass through unchanged", () => {
  const image = {};
  for (const error of [null, new DOMException("failed", "NetworkError")]) {
    const parser = new EmbeddedTextureParser({ load: (url, callback) => callback(error, image) });
    let called = false;
    parser.load({}, (actualError, actualImage) => {
      called = true;
      assert.equal(actualError, error);
      assert.equal(actualImage, image);
    }, {});
    assert.equal(called, true);
  }
});

test("bitmap failures retry once and revoke blob URLs on success or failure", (t) => {
  const original = new DOMException("decode failed", "InvalidStateError");
  const revoked = [];
  let image;
  t.mock.method(URL, "createObjectURL", () => "blob:test");
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const previous = globalThis.Image;
  globalThis.Image = class {
    constructor() {
      image = this;
    }
  };
  try {
    for (const success of [true, false]) {
      const parser = new EmbeddedTextureParser({ load: (url, callback) => callback(original) });
      let calls = 0;
      parser.load({}, (error, decoded) => {
        calls++;
        assert.equal(error, success ? null : original);
        assert.equal(decoded, success ? image : undefined);
      }, { file: { contents: new ArrayBuffer(8) } });
      assert.equal(image.src, "blob:test");
      image[success ? "onload" : "onerror"]();
      assert.equal(calls, 1);
      assert.equal(image.onload, null);
      assert.equal(image.onerror, null);
    }
    assert.deepEqual(revoked, ["blob:test", "blob:test"]);
  } finally {
    if (previous === undefined) {
      delete globalThis.Image;
    } else {
      globalThis.Image = previous;
    }
  }
});
