import { HERO_ANIMATION } from "../../../src/game/enum/HeroAnimation.js";
import { POINTER_TYPE } from "../../../src/game/enum/PointerType.js";

function pressKey(code, modifiers = {}) {
  cy.window().trigger("keydown", { code, key: code, ...modifiers });
}

function collectItem(expectedCount, animation) {
  pressKey("KeyE");
  cy.window({ timeout: 3000 }).should((window) => {
    expect(window.gameMovementTest.state().animation).to.equal(animation);
  });
  cy.window({ timeout: 3000 }).should((window) => {
    expect(window.gameMovementTest.state().inventory.items).to.have.length(
      expectedCount,
    );
  });
  cy.window({ timeout: 3000 }).should((window) => {
    expect(window.gameMovementTest.state().animation).not.to.equal(animation);
  });
}

function clickInventoryCloseButton() {
  cy.get(".background-canvas__surface").then(($canvas) => {
    const bounds = $canvas[0].getBoundingClientRect();
    const scale = Math.sqrt(
      (bounds.width / 1280) * (bounds.height / 720),
    );
    const x = bounds.width / 2 + 181 * scale;
    const y = bounds.height / 2 - 176 * scale;
    cy.wrap($canvas).trigger("pointermove", {
      pointerId: 1,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    });
    cy.wrap($canvas).should(($element) => {
      expect($element[0].style.cursor).to.equal("pointer");
    });
    cy.wrap($canvas).click(x, y);
  });
}

function inventorySlotPoint(bounds, slot) {
  const scale = Math.sqrt(
    (bounds.width / 1280) * (bounds.height / 720),
  );
  const column = slot % 4;
  const row = Math.floor(slot / 4);
  return {
    clientX:
      bounds.left + bounds.width / 2 + (-147 + column * 98) * scale,
    clientY:
      bounds.top + bounds.height / 2 + (-67 + row * 98) * scale,
  };
}

function dragInventoryItem(fromSlot, target) {
  cy.get(".background-canvas__surface").then(($canvas) => {
    const viewport = $canvas[0].closest(".background-canvas");
    viewport.setPointerCapture = () => {};
    viewport.hasPointerCapture = () => false;
    const bounds = $canvas[0].getBoundingClientRect();
    const start = inventorySlotPoint(bounds, fromSlot);
    const end =
      typeof target === "number"
        ? inventorySlotPoint(bounds, target)
        : target(bounds);
    const pointer = {
      button: 0,
      pointerId: 7,
      pointerType: POINTER_TYPE.MOUSE,
    };
    cy.wrap($canvas)
      .trigger("pointerdown", { ...pointer, ...start, buttons: 1 })
      .trigger("pointermove", { ...pointer, ...end, buttons: 1 })
      .trigger("pointerup", { ...pointer, ...end, buttons: 0 });
  });
}

describe("Collectible inventory", () => {
  beforeEach(() => {
    cy.visit("/map/test_inventory", {
      onBeforeLoad(window) {
        window.sessionStorage.removeItem("hero-configuration");
      },
    });
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
  });

  it("restores an open inventory on the normal game route", () => {
    cy.visit("/", {
      onBeforeLoad(window) {
        window.sessionStorage.removeItem("hero-configuration");
      },
    });
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    pressKey("KeyI");
    cy.window().should((window) => {
      const state = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(state.inventory.visible).to.equal(true);
    });
    cy.reload();
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().should((window) => {
      const state = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(state.inventory.visible).to.equal(true);
    });
    clickInventoryCloseButton();
    cy.window().should((window) => {
      const state = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(state.inventory.visible).to.equal(false);
    });
  });

  it("ignores inventory and interaction keys with keyboard modifiers", () => {
    const modifiers = [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
    ];

    for (const modifier of modifiers) {
      pressKey("KeyI", modifier);
      pressKey("KeyE", modifier);
    }

    cy.window().should((window) => {
      const { inventory } = window.gameMovementTest.state();
      expect(inventory.visible).to.equal(false);
      expect(inventory.items).to.have.length(0);
    });

    pressKey("KeyI");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.visible).to.equal(true);
    });
  });

  it("collects flowers and mushrooms into a twelve-slot inventory", () => {
    cy.get(".interaction-prompt").should("contain.text", "Collect flowers");

    collectItem(1, HERO_ANIMATION.PICK_FLOWER);
    cy.window().should((window) => {
      const [flower] = window.gameMovementTest.state().inventory.items;
      expect(flower.modelUrl).to.include(`${flower.variant}.glb`);
      expect(window.gameMovementTest.state().position.z).to.be.lessThan(-0.1);
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect");

    pressKey("KeyI");
    cy.get(".interaction-prompt").should("not.exist");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory).to.deep.include({
        capacity: 12,
        visible: true,
      });
      expect(window.gameMovementTest.state().inventory.items).to.have.length(1);
    });
    pressKey("KeyE");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.items).to.have.length(1);
    });
    pressKey("Escape");
    cy.get(".interaction-prompt")
      .invoke("text")
      .then((label) => {
        const animation = label.includes("mushroom")
          ? HERO_ANIMATION.PICK_MUSHROOM
          : HERO_ANIMATION.PICK_FLOWER;
        collectItem(2, animation);
      });
    for (let expectedCount = 3; expectedCount <= 12; expectedCount += 1) {
      cy.get(".interaction-prompt")
        .invoke("text")
        .then((label) => {
          const animation = label.includes("mushroom")
            ? HERO_ANIMATION.PICK_MUSHROOM
            : HERO_ANIMATION.PICK_FLOWER;
          collectItem(expectedCount, animation);
        });
    }

    pressKey("KeyI");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory).to.deep.include({
        capacity: 12,
        visible: true,
      });
      expect(window.gameMovementTest.state().inventory.items).to.have.length(12);
    });
    clickInventoryCloseButton();

    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-on-flower");
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect flowers");

    pressKey("KeyE");
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.WALK,
      );
      expect(window.gameMovementTest.inventoryFullReactionVisible()).to.equal(
        false,
      );
    });
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.INVENTORY_FULL_COLLAPSE,
      );
    });
    cy.window({ timeout: 1500 }).should((window) => {
      expect(window.gameMovementTest.inventoryFullReactionVisible()).to.equal(
        true,
      );
      const { position } = window.gameMovementTest.state();
      expect(Math.hypot(position.x, position.z)).to.be.greaterThan(0.5);
    });
    cy.window({ timeout: 3500 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.IDLE,
      );
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect");
    pressKey("KeyE");
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().animation).to.equal(
        HERO_ANIMATION.INVENTORY_FULL_COLLAPSE,
      );
    });
    cy.get(".q-notification").should("not.exist");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.items).to.have.length(12);
      expect(window.gameMovementTest.state().inventory.visible).to.equal(false);
    });
  });

  it("moves items to empty cells and drops them beyond the inventory", () => {
    collectItem(1, HERO_ANIMATION.PICK_FLOWER);
    cy.get(".interaction-prompt")
      .invoke("text")
      .then((label) => {
        const animation = label.includes("mushroom")
          ? HERO_ANIMATION.PICK_MUSHROOM
          : HERO_ANIMATION.PICK_FLOWER;
        collectItem(2, animation);
      });
    cy.window().then((window) => {
      const [firstItem, secondItem] =
        window.gameMovementTest.state().inventory.items;
      expect(firstItem.slot).to.equal(0);
      expect(secondItem.slot).to.equal(1);
    });

    pressKey("KeyI");
    dragInventoryItem(0, 5);
    cy.window().should((window) => {
      const [firstItem, secondItem] =
        window.gameMovementTest.state().inventory.items;
      expect(firstItem.slot).to.equal(5);
      expect(secondItem.slot).to.equal(1);
      const persistedState = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(persistedState.inventory.items[0].slot).to.equal(5);
    });

    dragInventoryItem(1, 5);
    cy.window().should((window) => {
      const [, secondItem] = window.gameMovementTest.state().inventory.items;
      expect(secondItem.slot).to.equal(1);
    });

    dragInventoryItem(1, (bounds) => ({
      clientX: bounds.right - 8,
      clientY: bounds.top + bounds.height / 2,
    }));
    cy.window().should((window) => {
      const inventory = window.gameMovementTest.state().inventory;
      expect(inventory.items).to.have.length(1);
      expect(inventory.items[0].slot).to.equal(5);
      const persistedState = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(persistedState.inventory.items).to.have.length(1);
      expect(window.gameMovementTest.droppedInventoryItemCount()).to.equal(1);
    });

    pressKey("Escape");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.visible).to.equal(false);
    });
    cy.wait(350);
    cy.window().should((window) => {
      expect(window.gameMovementTest.droppedInventoryItemCount()).to.equal(0);
    });
  });

  it("collects a flower when the hero overlaps its visible footprint", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-overlap");
    });
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().grounded).to.equal(true);
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect flowers");
    cy.window().then((window) => {
      expect(window.gameMovementTest.interact()).to.equal(true);
    });
    cy.window({ timeout: 3000 }).should((window) => {
      expect(window.gameMovementTest.state().inventory.items).to.have.length(1);
      expect(window.gameMovementTest.state().position.z).to.be.greaterThan(
        0.1,
      );
    });
    cy.get(".interaction-prompt", { timeout: 3000 }).should(
      "contain.text",
      "Dig for treasure",
    );
  });

  it("steps fully back before collecting a flower beneath the hero", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-on-flower");
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect flowers");
    cy.window().then((window) => {
      expect(window.gameMovementTest.interact()).to.equal(true);
    });
    cy.window({ timeout: 3000 }).should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.inventory.items).to.have.length(1);
      expect(Math.hypot(state.position.x, state.position.z)).to.be.greaterThan(
        0.5,
      );
    });
  });

  it("collects only the overlapping flower in front of the hero", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-direction");
    });
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().grounded).to.equal(true);
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect flowers");
    cy.window().then((window) => {
      expect(window.gameMovementTest.interact()).to.equal(true);
    });
    cy.window({ timeout: 3000 }).should((window) => {
      const [flower] = window.gameMovementTest.state().inventory.items;
      expect(flower.variant).to.equal("daisy-patch");
    });
  });

  it("steps into knife range before collecting a mushroom", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-mushroom");
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect mushroom");
    cy.window().then((window) => {
      expect(window.gameMovementTest.interact()).to.equal(true);
    });
    cy.window({ timeout: 3000 }).should((window) => {
      const state = window.gameMovementTest.state();
      expect(state.inventory.items).to.have.length(1);
      expect(state.position.z).to.be.greaterThan(0.2);
    });
  });

  it("allows digging after collecting a mushroom", () => {
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-mushroom-dig");
    });
    cy.get(".interaction-prompt").should("contain.text", "Collect mushroom");
    collectItem(1, HERO_ANIMATION.PICK_MUSHROOM);
    cy.get(".interaction-prompt", { timeout: 3000 }).should(
      "contain.text",
      "Dig for treasure",
    );
  });

  it("keeps collected items when the hero is recreated and the page reloads", () => {
    collectItem(1, HERO_ANIMATION.PICK_FLOWER);
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory-overlap");
    });
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.items).to.have.length(1);
    });
    pressKey("KeyI");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.visible).to.equal(true);
      const persistedState = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(persistedState.inventory.visible).to.equal(true);
    });

    cy.reload();
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("be.visible");
    cy.window().should((window) => {
      const [flower] = window.gameMovementTest.state().inventory.items;
      expect(flower.variant).to.equal("daisy-patch");
      expect(window.gameMovementTest.state().inventory).to.deep.include({
        capacity: 12,
        visible: true,
      });
    });
    cy.get(".interaction-prompt").should("not.exist");
  });
});
