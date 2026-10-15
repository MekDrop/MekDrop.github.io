describe("Recorded ladder exit contact review", () => {
  it("records both side exits in third person with the full hero visible", () => {
    cy.visit("/map/test_ladder-castle?camera-test");
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 90000 }).should("be.visible");
    let access, forward, right;
    cy.window().then(window => {
      access = window.gameMovementTest.mapObjects().find(o => o.object === "Castle").buildPlan.metadata.runtime.residential.roofAccess;
      const dx = access.position.x - access.bottom.x, dz = access.position.z - access.bottom.z, length = Math.hypot(dx, dz);
      forward = { x: dx / length, z: dz / length };right = { x: forward.z, z: -forward.x };
      window.gameCameraTest.firstPerson(false);
    });
    for (const side of [-1, 1]) {
      cy.window().then(window => window.gameMovementTest.teleport(access.bottom));
      cy.wait(1600);
      cy.window().then(window => {
        const camera = window.gameCameraTest.firstPerson(true).firstPersonCamera;
        const yaw = Math.atan2(forward.x, forward.z);
        window.gameCameraTest.lookFirstPersonBy((yaw - Math.atan2(camera.direction.x, camera.direction.z)) * 180 / Math.PI, 0);
        window.gameMovementTest.move(0, 1);
      });
      cy.window({ timeout: 15000 }).should(window => {
        const state = window.gameMovementTest.state();
        expect(state.position.y, JSON.stringify(state)).to.be.greaterThan(access.top.y - 0.06);
      });
      cy.window().then(window => {
        window.gameCameraTest.firstPerson(false);
        window.gameCameraTest.setZoom(18);
        window.gameCameraTest.setRotation(3);
        const canvas = window.document.querySelector('.background-canvas__surface');
        const head = window.gameMovementTest.state().patScreenPosition;
        window.gameCameraTest.panBy(canvas.clientWidth / 2 - head.x, canvas.clientHeight * 0.45 - head.y);
        const yaw = Math.PI / 4 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
        window.gameMovementTest.move(side * (Math.cos(yaw) * right.x - Math.sin(yaw) * right.z), side * (-Math.sin(yaw) * right.x - Math.cos(yaw) * right.z));
      });
      cy.wait(150);
      cy.window().then(window => window.gameMovementTest.move(0, 0));
      cy.window().then({ timeout: 12000 }, window => new Cypress.Promise(resolve => {
        const samples = [], started = window.performance.now();
        let sawTransfer = false;
        /**
         * @returns {void}
         */
        function sample() {
          samples.push({ elapsed: window.performance.now() - started, body: window.gameMovementTest.state().position,
            ...window.gameMovementTest.animationPose(["Left ankle", "Right ankle", "Left white glove", "Right white glove"]) });
          const latest = samples[samples.length - 1];
          sawTransfer ||= latest.clip?.startsWith("ClimbTop");
          if (latest.elapsed > 9000 || (sawTransfer && !latest.clip?.startsWith("ClimbTop") && latest.elapsed > 400)) resolve(samples);
          else window.requestAnimationFrame(sample);
        }
        window.requestAnimationFrame(sample);
      })).then(samples => {
        return cy.writeFile(`tmp/ladder-remake/contact-pose-${side}.json`, samples).then(() => {
        const leading = side > 0 ? "Right ankle" : "Left ankle";
        const planted = samples.filter(sample => {
          const phase = (sample.time / 4 - 0.4) / 0.6;
          return sample.clip?.startsWith("ClimbTop") && phase > 0.56 && phase < 0.69;
        });
        expect(planted.length, "recorded planted-foot frames").to.be.greaterThan(4);
        for (const axis of ["x", "y", "z"]) {
          const points = planted.map(sample => sample.joints[leading][axis]);
          expect(Math.max(...points) - Math.min(...points), `${leading} planted ${axis} drift`).to.be.lessThan(0.04);
        }
        const bracingHand = side > 0 ? "Right white glove" : "Left white glove";
        const braced = samples.filter(sample => {
          const phase = (sample.time / 4 - 0.4) / 0.6;
          return sample.clip?.startsWith("ClimbTop") && phase > 0.42 && phase < 0.68;
        });
        expect(braced.length, "recorded bracing-hand frames").to.be.greaterThan(4);
        for (const axis of ["x", "y", "z"]) {
          const points = braced.map(sample => sample.joints[bracingHand][axis]);
          expect(Math.max(...points) - Math.min(...points), `${bracingHand} contact ${axis} drift`).to.be.lessThan(0.04);
        }
        const trailing = side > 0 ? "Left ankle" : "Right ankle";
        const plantedTrailing = samples.filter(sample => {
          const phase = (sample.time / 4 - 0.4) / 0.6;
          return sample.clip?.startsWith("ClimbTop") && phase > 0.72 && phase < 0.83;
        });
        expect(plantedTrailing.length, "trailing-foot frames during the turn").to.be.greaterThan(3);
        for (const axis of ["x", "y", "z"]) {
          const points = plantedTrailing.map(sample => sample.joints[trailing][axis]);
          expect(Math.max(...points) - Math.min(...points), `${trailing} turn ${axis} drift`).to.be.lessThan(0.04);
        }
        });
      });
      cy.window({ timeout: 15000 }).should(window => {
        const state = window.gameMovementTest.state();
        expect(state.grounded, JSON.stringify(state)).to.equal(true);
        expect(state.animation).not.to.match(/^Climb/);
        expect(state.position.y).to.be.greaterThan(access.top.y - 0.1);
      });
      cy.wait(1800);
      cy.window().then(window => {
        const position = window.gameMovementTest.state().position;
        const dx = access.position.x - position.x, dz = access.position.z - position.z;
        const length = Math.hypot(dx, dz);
        const yaw = Math.PI / 4 + window.gameCameraTest.state().viewport.rotation * Math.PI / 2;
        window.gameMovementTest.move((Math.cos(yaw) * dx - Math.sin(yaw) * dz) / length, (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / length);
      });
      cy.window({ timeout: 15000 }).should(window => {
        expect(window.gameMovementTest.state().position.y).to.be.lessThan(access.top.y - 0.25);
      });
      cy.window().then(window => window.gameMovementTest.move(0, 0));
      cy.window({ timeout: 15000 }).should(window => {
        expect(window.gameMovementTest.state().position.y).to.be.lessThan(access.top.y - 1.55);
      });
      cy.wait(1200);
    }
  });
});
