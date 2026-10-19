import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Asset } from "playcanvas";
import { GameAudioLibrary } from "../../../../src/game/audio/GameAudioLibrary.js";
import { audioSources } from "../../../../src/game/audio/audio-sources.js";

/**
 * Resolve audio on demand without requiring a browser audio context.
 */
class AudioRegistry {
  started = [];
  _loader = { clearCache: () => {} };
  /**
   * @param {Asset} asset
   */
  add(asset) {
    asset.registry = this;
  }
  fire() {}
  remove() {}
  /**
   * @param {Asset} asset
   */
  load(asset) {
    this.started.push(asset);
  }
  /**
   * @param {Asset} asset
   */
  succeed(asset) {
    asset.loaded = true;
    asset.resource = { destroy: () => {} };
    asset.fire("load", asset);
  }
}

test("Vorbis capability detection accepts probably/maybe and rejects missing support", () => {
  const previous = globalThis.document;
  try {
    for (const response of ["probably", "maybe", "", "no"]) {
      globalThis.document = {
        createElement: (tag) => {
          assert.equal(tag, "audio");

          return {
            canPlayType: (mime) => {
              assert.equal(mime, 'audio/ogg; codecs="vorbis"');

              return response;
            },
          };
        },
      };
      assert.equal(GameAudioLibrary.oggSupported, response === "probably" || response === "maybe");
    }
    delete globalThis.document;
    assert.equal(GameAudioLibrary.oggSupported, false);
  } finally {
    globalThis.document = previous;
  }
});

for (const supportsOgg of [true, false]) {
  test(`audio prefers ${supportsOgg ? "Ogg" : "WAV"} while retaining the caller's key and shared asset`, async () => {
    const assets = new AudioRegistry();
    const library = new GameAudioLibrary({
      pc: { Asset },
      app: { assets },
      supportsOgg,
    });
    const { wavUrl, oggUrl } = audioSources[0];
    const progress = [];
    const first = library.load([wavUrl, wavUrl], (url, completed, total) => progress.push({
      url,
      completed,
      total,
    }));
    const second = library.load([wavUrl]);
    assert.equal(assets.started.length, 1);
    const asset = assets.started[0];
    assert.equal(asset.file.url, supportsOgg ? oggUrl : wavUrl);
    assets.succeed(asset);
    await Promise.all([first, second]);
    await library.load([wavUrl]);
    assert.equal(library.get(wavUrl), asset);
    assert.equal(assets.started.length, 1);
    assert.deepEqual(progress.at(-1), {
      url: supportsOgg ? oggUrl : wavUrl,
      completed: 1,
      total: 1,
    });
    library.destroy();
  });
}

test("a failed Ogg load falls back to WAV once and reuses that decoded fallback", async () => {
  const assets = new AudioRegistry();
  const library = new GameAudioLibrary({
    pc: { Asset },
    app: { assets },
    supportsOgg: true,
  });
  const { wavUrl, oggUrl } = audioSources[0];
  const first = library.load([wavUrl]);
  const second = library.load([wavUrl]);
  assert.equal(assets.started[0].file.url, oggUrl);
  assets.started[0].fire("error", "Decoder rejected Ogg");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(assets.started.length, 2);
  assert.equal(assets.started[1].file.url, wavUrl);
  assets.succeed(assets.started[1]);
  await Promise.all([first, second]);
  await library.load([wavUrl]);
  assert.equal(library.get(wavUrl), assets.started[1]);
  assert.equal(assets.started.length, 2);
  library.destroy();
});

test("bundled Ogg is a nonempty Vorbis stream with nominal 192 kbps", () => {
  for (const { oggUrl, wavUrl } of audioSources) {
    const data = readFileSync(new URL(oggUrl));
    assert.equal(data.toString("ascii", 0, 4), "OggS");
    const header = data.indexOf(Buffer.from("\x01vorbis"));
    assert.ok(header >= 0);
    assert.equal(data.readInt32LE(header + 20), 192000);
    assert.ok(data.length < readFileSync(new URL(wavUrl)).length);
  }
});
