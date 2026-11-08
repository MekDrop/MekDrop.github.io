import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { BrowserObjectCache } from "../../../../src/game/cache/BrowserObjectCache.js";

const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
afterEach(() => {
  for (const [key, descriptor] of [["caches", originalCaches], ["location", originalLocation]]) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      delete globalThis[key];
    }
  }
});

test("unchanged content survives a fresh loader, changed hashes fetch fresh data, and consumers are isolated", async () => {
  const records = new Map();
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "https://example.test" },
  });
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      open: async () => ({
        match: async (key) => records.get(key)?.clone(),
        put: async (key, response) => records.set(key, response),
      }),
    },
  });
  let requests = 0;
  const load = async () => {
    requests++;

    return {
      default: {
        version: 1,
        entries: { books: { sample: [requests] } },
      },
    };
  };
  const first = await BrowserObjectCache.load("./generated/books/abcd.json", load);
  first.default.entries.books.sample[0] = 99;
  const second = await BrowserObjectCache.load("./generated/books/abcd.json", load);
  assert.equal(requests, 1);
  assert.deepEqual(second.default.entries.books.sample, [1]);
  await BrowserObjectCache.load("./generated/books/abcd12.json", load);
  assert.equal(requests, 2);
});

test("unavailable storage and write quota errors fall back to loading", async () => {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "https://example.test" },
  });
  const expected = {
    default: {
      version: 1,
      entries: {},
    },
  };
  for (const open of [
    async () => {
      throw new DOMException("Denied", "SecurityError");
    },
    async () => ({
      match: async () => undefined,
      put: async () => {
        throw new DOMException("Full", "QuotaExceededError");
      },
    }),
    async () => ({
      match: async () => new Response("corrupt JSON"),
      put: async () => {},
    }),
  ]) {
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { open },
    });
    assert.equal(await BrowserObjectCache.load("./generated/books/abcd.json", async () => expected), expected);
  }
});
