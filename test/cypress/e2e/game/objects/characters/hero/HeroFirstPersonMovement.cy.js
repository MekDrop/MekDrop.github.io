describe("First-person hero presentation", () => {
  it("keeps the eye anchor steady through reversals, pitch limits and body turns", () => {
    cy.visit("/map/test_flat?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 60000 })
      .should("be.visible");
    cy.window().its("gameCameraTest").should("exist");
    cy.window().then({ timeout: 20000 }, (window) => {
      const driver = window.gameCameraTest;
      driver.firstPerson(true);
      const initial = driver.state();
      const eyeHeight = initial.firstPersonCamera.position.y - initial.hero.position.y;
      const radius = Math.hypot(
        initial.firstPersonCamera.position.x - initial.hero.position.x,
        initial.firstPersonCamera.position.z - initial.hero.position.z,
      );
      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      let startedAt;
      let frames = 0;
      let previousLook = 0;
      let previousPitch = 0;
      let moved = false;
      const animations = new Set();

      return new Cypress.Promise((resolve, reject) => {
        const inspect = (time) => {
          startedAt ??= time;
          const elapsed = time - startedAt;
          const state = driver.state();
          const camera = state.firstPersonCamera;
          try {
            const horizontal = Math.hypot(camera.direction.x, camera.direction.z);
            expect(state.hero.facing.x, "body turns with FPS view immediately")
              .to.be.closeTo(camera.direction.x / horizontal, 0.0001);
            expect(state.hero.facing.z, "no sideways shoulder free-look")
              .to.be.closeTo(camera.direction.z / horizontal, 0.0001);
            expect(camera.position.y - state.hero.position.y, "eye height ignores gait and neck pitch")
              .to.be.closeTo(eyeHeight, 0.003);
            expect(Math.hypot(
              camera.position.x - state.hero.position.x,
              camera.position.z - state.hero.position.z,
            ), "eye distance ignores animation sway").to.be.closeTo(radius, 0.003);
          } catch (cause) {
            driver.moveHero(0, 0);
            reject(cause);

            return;
          }
          frames++;
          animations.add(state.hero.animation);
          moved ||= Math.hypot(state.hero.position.x - initial.hero.position.x,
            state.hero.position.z - initial.hero.position.z) > 0.05;
          if (elapsed >= 5000) {
            driver.moveHero(0, 0);
            expect(frames).to.be.greaterThan(30);
            expect(moved, "hero actually moved").to.equal(true);
            expect(animations.size, "exercise locomotion transitions").to.be.greaterThan(1);
            driver.firstPerson(false);
            expect(driver.state().firstPersonCameraEnabled).to.equal(false);
            resolve();

            return;
          }
          const direction = directions[Math.floor(elapsed / 200) % directions.length];
          driver.moveHero(direction[0], direction[1], elapsed > 2500);
          const look = elapsed / 5000 * 720;
          const pitch = 70 * Math.sin(elapsed / 5000 * Math.PI * 2);
          driver.lookFirstPersonBy(look - previousLook, pitch - previousPitch);
          previousLook = look;
          previousPitch = pitch;
          window.requestAnimationFrame(inspect);
        };
        window.requestAnimationFrame(inspect);
      });
    });
  });
});
