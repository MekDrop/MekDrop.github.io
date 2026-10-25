describe("Hero lava death presentation", () => {
  it("raises a thumb for returning lives and collapses on the final life", () => {
    cy.visit("/map/test_lava-river?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 60000,
    }).should("be.visible");

    for (let lives = 3; lives > 0; lives -= 1) {
      const animation = lives > 1 ? "LavaFarewell" : "FallDeath";
      cy.window().then((window) => {
        window.gameMovementTest.teleport({
          x: 0,
          y: 2.2,
          z: 0,
        });
      });
      cy.window().should((window) => {
        expect(window.gameMovementTest.state().animation).to.equal(animation);
      });
      if (lives > 1) {
        cy.window().should((window) => {
          const pose = window.gameMovementTest.animationPose([
            "Right white glove",
            "Right thumb 2",
            "Hero head",
          ]);
          expect(pose.time).to.be.greaterThan(2.1);
          expect(pose.time).to.be.lessThan(3.2);
          expect(pose.joints["Hero head"].y).to.be.lessThan(1.5);
          expect(pose.joints["Right thumb 2"].y).to.be.greaterThan(1.5);
          expect(pose.joints["Right white glove"].y).to.be.greaterThan(
            pose.joints["Hero head"].y,
          );
          expect(pose.joints["Right thumb 2"].y).to.be.greaterThan(
            pose.joints["Right white glove"].y + 0.04,
          );
        });
        cy.window().should((window) => {
          const pose = window.gameMovementTest.animationPose([
            "Right thumb 1",
            "Right thumb 2",
          ]);
          expect(pose.clip).to.equal("LavaFarewell");
          expect(pose.time).to.be.greaterThan(3.5);
          expect(pose.joints["Right thumb 2"].y - pose.joints["Right thumb 1"].y)
            .to.be.greaterThan(0.03);
          expect(Math.abs(pose.joints["Right thumb 2"].x - pose.joints["Right thumb 1"].x))
            .to.be.lessThan(0.003);
          expect(Math.abs(pose.joints["Right thumb 2"].z - pose.joints["Right thumb 1"].z))
            .to.be.lessThan(0.003);
        });
      }
      cy.window().should((window) => {
        expect(window.gameMovementTest.state().action.action).not.to.equal("burning");
      });
      cy.window().should((window) => {
        expect(window.gameMovementTest.state().respawning).to.equal(false);
      });
    }
    cy.window().should((window) => {
      expect(window.gameMovementTest.isGameOver()).to.equal(true);
    });
  });
});
