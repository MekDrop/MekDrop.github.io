import { defineStore } from "pinia";
import { HERO_INVENTORY_CAPACITY } from "src/game/config/inventory.js";
import { sessionStorageDriver } from "src/stores/drivers/SessionStorageDriver.js";

function normalizeInventorySlots(inventory) {
  const occupiedSlots = new Set();
  let changed = false;

  for (const [index, item] of inventory.items.entries()) {
    let slot = item.slot;
    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= inventory.capacity ||
      occupiedSlots.has(slot)
    ) {
      slot = 0;
      while (occupiedSlots.has(slot) && slot < inventory.capacity) {
        slot += 1;
      }
    }
    occupiedSlots.add(slot);
    if (item.slot !== slot) {
      inventory.items[index] = { ...item, slot };
      changed = true;
    }
  }

  return changed;
}

export const useHeroConfigurationStore = defineStore(
  "hero-configuration",
  {
    state: () => ({
      inventory: {
        capacity: HERO_INVENTORY_CAPACITY,
        items: [],
        visible: false,
      },
    }),
    actions: {
      normalizeInventorySlots() {
        if (normalizeInventorySlots(this.inventory)) {
          this.$persist();
        }
      },
      addInventoryItem(item) {
        this.normalizeInventorySlots();
        if (this.inventory.items.length >= this.inventory.capacity) {
          return false;
        }

        const occupiedSlots = new Set(
          this.inventory.items.map(({ slot }) => slot),
        );
        let slot = 0;
        while (occupiedSlots.has(slot)) {
          slot += 1;
        }
        this.inventory.items.push({ ...item, slot });
        this.$persist();
        return true;
      },
      moveInventoryItem(fromSlot, toSlot) {
        this.normalizeInventorySlots();
        if (
          !Number.isInteger(fromSlot) ||
          !Number.isInteger(toSlot) ||
          toSlot < 0 ||
          toSlot >= this.inventory.capacity ||
          this.inventory.items.some(({ slot }) => slot === toSlot)
        ) {
          return false;
        }
        const item = this.inventory.items.find(({ slot }) => slot === fromSlot);
        if (!item) {
          return false;
        }

        item.slot = toSlot;
        this.$persist();
        return true;
      },
      dropInventoryItem(slot) {
        this.normalizeInventorySlots();
        const itemIndex = this.inventory.items.findIndex(
          (item) => item.slot === slot,
        );
        if (itemIndex < 0) {
          return null;
        }

        const [item] = this.inventory.items.splice(itemIndex, 1);
        this.$persist();
        return { ...item };
      },
      setInventoryVisible(visible) {
        this.inventory.visible = Boolean(visible);
        this.$persist();
      },
    },
    persist: {
      key: "hero-configuration",
      pick: ["inventory"],
      storage: sessionStorageDriver,
    },
  },
);
