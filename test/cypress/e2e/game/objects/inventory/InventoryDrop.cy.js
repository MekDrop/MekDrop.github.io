import { POINTER_TYPE } from "../../../../../../src/game/enum/PointerType.js";

function pressKey(code, modifiers = {}) {
  cy.window().trigger("keydown", {
    code,
    key: code,
    ...modifiers,
  });
}

function inventorySlotPoint(bounds, slot) {
  const scale = Math.sqrt((bounds.width / 1280) * (bounds.height / 720));
  const column = slot % 4;
  const row = Math.floor(slot / 4);

  return {
    clientX: bounds.left + bounds.width / 2 + (-147 + column * 98) * scale,
    clientY: bounds.top + bounds.height / 2 + (-67 + row * 98) * scale,
  };
}

function inventoryDialogPoint(bounds, panelX, panelY) {
  const scale = Math.sqrt((bounds.width / 1280) * (bounds.height / 720));

  return {
    clientX: bounds.left + bounds.width / 2 + (panelX - 215) * scale,
    clientY: bounds.top + bounds.height / 2 + (panelY - 210) * scale,
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
      .trigger("pointerdown", {
        ...pointer,
        ...start,
        buttons: 1,
      })
      .trigger("pointermove", {
        ...pointer,
        ...end,
        buttons: 1,
      })
      .trigger("pointerup", {
        ...pointer,
        ...end,
        buttons: 0,
      });
  });
}

describe("Isolated inventory drop placement", () => {
  it("moves, drops, persists and fades seeded inventory through the actual HUD", () => {
    cy.request("/src/game/models/ground-cover/blue-flower-patch.glb?url&import").then(({ body }) => {
      const modelUrl = JSON.parse(body.match(/export default ("[^"\n]+");/)[1]);
      cy.visit("/map/test_inventory", {
        onBeforeLoad: (window) => {
          const items = [0, 1].map((slot) => ({
            id: 'drop-check-' + slot,
            slot,
            variant: 'blue-flower-patch',
            category: 'flower',
            labelKey: 'game.inventory.items.blue_flower_patch',
            icon: 'flower',
            modelUrl,
          }));
          window.sessionStorage.setItem('hero-configuration', JSON.stringify({
            inventory: {
              capacity: 12,
              items,
              visible: false,
            },
          }));
        },
      });
    });
    cy.get('.background-canvas[data-game-ready="true"]', {timeout: 30000}).should('be.visible');
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

    dragInventoryItem(1, (bounds) => inventoryDialogPoint(bounds, 48, 48));
    cy.window().should((window) => {
      const inventory = window.gameMovementTest.state().inventory;
      expect(inventory.items).to.have.length(2);
      expect(inventory.items[1].slot).to.equal(1);
      expect(window.gameMovementTest.droppedInventoryItemCount()).to.equal(0);
    });

    dragInventoryItem(1, (bounds) => inventoryDialogPoint(bounds, -40, 210));
    cy.window().should((window) => {
      const inventory = window.gameMovementTest.state().inventory;
      expect(inventory.items).to.have.length(1);
      expect(inventory.items[0].slot).to.equal(5);
      const persistedState = JSON.parse(
        window.sessionStorage.getItem("hero-configuration"),
      );
      expect(persistedState.inventory.items).to.have.length(1);
      expect(window.gameMovementTest.droppedInventoryItemCount()).to.equal(1);
      const [droppedItem] = window.gameMovementTest.droppedInventoryItems();
      const heroPosition = window.gameMovementTest.state().position;
      expect(
        Math.hypot(
          droppedItem.position.x - heroPosition.x,
          droppedItem.position.z - heroPosition.z,
        ),
      ).to.be.greaterThan(2);
      expect(droppedItem.position.y).to.be.lessThan(heroPosition.y + 13);
    });

    pressKey("Escape");
    cy.window().should((window) => {
      expect(window.gameMovementTest.state().inventory.visible).to.equal(false);
    });
    cy.window().should((window) => {
      expect(window.gameMovementTest.droppedInventoryItemCount()).to.equal(0);
    });
  });

});
