describe("Riftcap production model and embedded playback", () => {
  it("binds all clips, samples real joint motion, and captures a transparent production preview", () => {
    cy.visit("/map/test_enemy-riftcap", { timeout: 120000 });
    cy.get('.background-canvas[data-game-ready="true"]', { timeout: 180000 }).should("be.visible");
    cy.window().its("riftcapTest", { timeout: 30000 }).should("exist");
    cy.window().then({ timeout: 120000 }, async (window) => {
      const actor = window.riftcapTest;
      const playback = await actor.checks.verifyClips({ download: false });
      expect(playback.results).to.have.length(32);
      for (const clip of playback.results) {
        expect(clip.samples.length, `${clip.name} rendered samples`).to.be.greaterThan(2);
        expect(clip.samples.every(sample => Number.isFinite(sample.time) && Number.isFinite(sample.speed))).to.equal(true);
        const changed = clip.samples[0].joints.filter((joint, index) => joint.name !== "Root" &&
          clip.samples.some(sample => sample.joints[index].rotation.some((value, component) =>
            Math.abs(value - joint.rotation[component]) > 0.00001)));
        expect(changed.length, `${clip.name} bound non-root joints`).to.be.at.least(2);
      }
      actor.testPlayClip("idle");
      const preview = await actor.capturePreview({ download: false });
      expect(preview.visible).to.be.greaterThan(1000);
      expect(preview.transparent).to.be.greaterThan(1000);

      return {
        playback,
        preview,
      };
    }).then(({ playback, preview }) => {
      cy.writeFile("tmp/riftcap-asset/runtime-playback.json", playback);
      cy.writeFile("src/game/objects/enemies/riftcap/preview.png", preview.dataUrl.split(",")[1], "base64");
    });
    cy.screenshot("riftcap-production-scene");
  });
});
