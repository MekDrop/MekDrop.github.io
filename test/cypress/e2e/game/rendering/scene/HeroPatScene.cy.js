describe("Hero pat scene integration", () => {
  it("pats through the projected head and recreates cleanly after map replacement", () => {
    cy.visit('/map/test_flat', { onBeforeLoad: (win) => win.sessionStorage.clear() });
    cy.get('.background-canvas[data-game-ready="true"]', {timeout: 30000}).should('be.visible');
    const pat = () => {
      cy.window().then((win) => {
        const head = win.gameMovementTest.state().patScreenPosition;
        expect(head).not.to.equal(null);
        const canvas = win.document.querySelector('.background-canvas__surface');
        const rect = canvas.getBoundingClientRect();
        canvas.setPointerCapture = () => {};
        canvas.hasPointerCapture = () => false;
        canvas.dispatchEvent(new win.PointerEvent('pointerdown', {
          bubbles:true,
          pointerId: 51,
          pointerType:'mouse',
          button:0,
          clientX:rect.left+head.x,
          clientY:rect.top+head.y,
        }));
        canvas.dispatchEvent(new win.PointerEvent('pointerup', {
          bubbles:true,
          pointerId: 51,
          pointerType:'mouse',
          button:0,
          clientX:rect.left+head.x,
          clientY:rect.top+head.y,
        }));
      });
      cy.window().should((win) => {
        expect(win.gameMovementTest.state().mood.kind).to.equal('happy');
      });
    };
    pat();
    cy.window().then((win) => win.gameMovementTest.loadScenario('flat'));
    cy.get('.background-canvas[data-game-ready="true"]', {timeout: 30000}).should('be.visible');
    pat();
  });
});
