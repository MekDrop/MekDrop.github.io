import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { HeroPossessions } from "../../../../../../src/game/objects/characters/hero/HeroPossessions.js";

it("keeps wallet changes local and returns independent snapshots", () => {
  const possessions = new HeroPossessions(null);
  assert.equal(possessions.collectCoin("gold", 3.9), true);
  assert.equal(possessions.collectCoin("gold", -2), true);
  assert.equal(possessions.collectCoin("silver"), true);
  assert.equal(possessions.collectCoin("toString", 10), false);
  assert.equal(possessions.collectCoin("platinum", 10), false);
  const snapshot = possessions.wallet;
  snapshot.gold = 999;
  assert.deepEqual(possessions.wallet, {
    gold: 3,
    silver: 1,
    copper: 0,
  });
  assert.equal(new HeroPossessions(null).wallet.gold, 0);
});

it("reads live persisted inventory without leaking mutable items or caching fullness", () => {
  const store = {
    inventory: {
      capacity: 1,
      items: [{
        id: "flower",
        variant: "red",
        quantity: 2,
        slot: 0,
      }],
    },
  };
  const possessions = new HeroPossessions(store);
  const snapshot = possessions.inventory;
  snapshot.items[0].quantity = 99;
  snapshot.items.push({ id: "extra" });
  snapshot.capacity = 99;
  assert.equal(possessions.inventory.items[0].quantity, 2);
  assert.equal(possessions.inventory.items[0].slot, 0);
  assert.equal(possessions.inventoryFull, true);
  store.inventory = {
    capacity: 2,
    items: store.inventory.items,
  };
  assert.equal(possessions.inventoryFull, false);
  assert.equal(possessions.inventory.capacity, 2);
  assert.equal(snapshot.items.length, 2);
  assert.equal(possessions.inventory.items.length, 1);
  assert.deepEqual(new HeroPossessions(store).inventory, possessions.inventory);
});

it("lets the store decide admission with its own receiver and original item", () => {
  const item = {
    id: "mushroom",
    variant: "brown",
  };
  const store = {
    inventory: {
      capacity: 1,
      items: [],
    },
    accepted: false,
    calls: 0,
    addInventoryItem(candidate) {
      assert.equal(candidate, item);
      this.calls += 1;

      return this.accepted;
    },
  };
  const possessions = new HeroPossessions(store);
  assert.equal(possessions.inventoryFull, false);
  assert.equal(possessions.collectInventoryItem(item), false);
  store.accepted = true;
  assert.equal(possessions.collectInventoryItem(item), true);
  assert.equal(store.calls, 2);
});

// Exercise Hero's real public entry points without bootstrapping a rendered map.
const source = readFileSync(new URL("../../../../../../src/game/objects/characters/hero/Hero.js", import.meta.url), "utf8");
const methods = ["collectCoin", "collectInventoryItem"].map((name) => {
  const start = source.indexOf(`  ${name}(`);

  return source.slice(start, source.indexOf("\n  }", start) + 4);
}).join("\n");
const HeroDriver = new Function("HeroPossessions", `return class {
  #possessions;
  syncs = 0;
  refusals = 0;
  constructor(store) { this.#possessions = new HeroPossessions(store); }
  #syncState() { this.syncs += 1; }
  #showInventoryFull() { this.refusals += 1; }
  ${methods}
}`)(HeroPossessions);

it("preserves Hero pickup results and exactly-once presentation feedback", () => {
  const store = {
    accepted: false,
    addInventoryItem() {
      return this.accepted;
    },
  };
  const hero = new HeroDriver(store);
  const item = {
    id: "flower",
    variant: "red",
  };
  assert.equal(hero.collectInventoryItem(item), false);
  assert.equal(hero.refusals, 1);
  assert.equal(hero.syncs, 0);
  store.accepted = true;
  assert.equal(hero.collectInventoryItem(item), true);
  assert.equal(hero.refusals, 1);
  assert.equal(hero.syncs, 1);
  assert.equal(hero.collectCoin("gold", 2), true);
  assert.equal(hero.syncs, 2);
  assert.equal(hero.collectCoin("invalid"), false);
  assert.equal(hero.syncs, 2);
});
