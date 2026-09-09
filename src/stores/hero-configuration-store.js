import { defineStore } from "pinia";
import { HERO_INVENTORY_CAPACITY } from "src/game/config/inventory.js";
import { sessionStorageDriver } from "src/stores/drivers/SessionStorageDriver.js";

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
      addInventoryItem(item) {
        if (this.inventory.items.length >= this.inventory.capacity) {
          return false;
        }

        this.inventory.items.push({ ...item });
        this.$persist();
        return true;
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
