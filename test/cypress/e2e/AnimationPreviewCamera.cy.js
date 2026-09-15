// Gallery models at the island's edges must remain reachable with normal limits.
describe("Animation preview camera", () => {
  it("reaches the top and bottom preview rows at 2.42x zoom in every rotation", () => {
    cy.visit("/map/test_hero-animations?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 })
      .should("be.visible");
    cy.window().its("gameCameraTest").should("exist");

    for (const rotation of [0, 1, 2, 3]) {
      for (const direction of [1, -1]) {
        cy.window().then((window) => {
          const driver = window.gameCameraTest;
          driver.setZoom(2.42);
          driver.setRotation(rotation);
          const initial = driver.state();
          expect(initial.panLimitsEnabled).to.equal(true);
          const stations = Object.entries(initial.visibility.visualGroups)
            .filter(([name]) => name.startsWith("animation-preview-"));
          expect(stations.length).to.equal(33);
          stations.sort((a, b) => direction * (a[1].top - b[1].top));
          const target = stations[0][0];
          cy.get(".background-canvas").then(($viewport) => {
            const rect = $viewport[0].getBoundingClientRect();
            const pointer = {
              pointerId: 1, pointerType: "mouse", button: 2, buttons: 2,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            };
            cy.wrap($viewport)
              .trigger("pointerdown", pointer)
              .trigger("pointermove", { ...pointer, clientY: pointer.clientY + direction * 100000 })
              .trigger("pointerup", { ...pointer, buttons: 0 });
          });
          cy.window().then(() => {
            const state = driver.state();
            const bounds = state.visibility.visualGroups[target];
            expect(state.viewport.zoom).to.be.closeTo(2.42, 0.000001);
            expect(state.panLimitsEnabled).to.equal(true);
            expect(state.visibility.panWithinBounds).to.equal(true);
            expect(bounds.top, `${target} top at rotation ${rotation}`).to.be.at.least(32);
            expect(bounds.bottom, `${target} bottom at rotation ${rotation}`)
              .to.be.at.most(state.visibility.viewportHeight - 32);
          });
        });
      }
    }
  });
});
