describe("Level worker loading", () => {
  it("prepares a generated level in a real worker before rendering", () => {
    let preparedMap;
    cy.visit("/map/routing-check", {
      onBeforeLoad(window) {
        const BrowserWorker = window.Worker;
        window.Worker = class extends BrowserWorker {
          constructor(url, options) {
            super(url, options);
            if (String(url).includes("LevelLoader.worker.js")) {
              this.addEventListener("message", ({ data }) => {
                preparedMap = data.map;
              });
            }
          }
        };
      },
    });
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 60000,
    }).should("have.attr", "data-map-name", "routing-check");
    cy.then(() => {
      expect(preparedMap?.mapName).to.equal("routing-check");
      expect(preparedMap.objects.some((object) => object.object === "Castle")).to.equal(true);
      expect(preparedMap.paths.length).to.be.greaterThan(0);
    });
  });
});
