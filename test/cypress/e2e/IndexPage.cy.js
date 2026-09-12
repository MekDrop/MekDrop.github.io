// todo: make locales dynamically filled
const locales = ["en-US", "lt"];

locales
  .concat([""])
  .sort((a, b) => a.length - b.length)
  .forEach((locale) => {
    describe("IndexPage (/" + locale + ")", () => {
      beforeEach(() => {
        const localePath = locale ? `/${locale}` : "";
        cy.visit(`${localePath}/map/test_flat`);
      });

      it("left toolbar is visible", () => {
        cy.get("#side_toolbar").should("be.visible");
      });

      it("other links opening", () => {
        cy.get('#other_links_panel input[name="search"]').click();
        cy.get('#other_links_panel input[name="search"]').type("git");
        cy.get("#other_links_panel .extra_links_modal__search-results").should(
          "have.class",
          "extra_links_modal__search-results--non-empty",
        );
        cy.get(
          "#other_links_panel .extra_links_modal__search-results .q-item",
        ).should("have.length", 3);

        cy.get('#other_links_panel input[name="search"]').type("git-not-found");
        cy.get("#other_links_panel .extra_links_modal__search-results").should(
          "have.class",
          "extra_links_modal__search-results--empty",
        );
      });

      locales.forEach((locale2) => {
        it(`switching language into ${locale2}`, () => {
          cy.get(`#language_switcher [data-locale="${locale2}"]`).click();
          cy.location("pathname").should(
            "match",
            new RegExp(`\/${locale2}\/map\/[^/]+$`),
          );
        });
      });
    });
  });

describe("Map routing", () => {
  it("recreates a generated map from its URL name", () => {
    cy.visit("/map/routing-check");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    })
      .should("have.attr", "data-map-name", "routing-check")
      .invoke("attr", "data-map-signature")
      .then((signature) => {
        cy.reload();
        cy.get('.background-canvas[data-game-ready="true"]', {
          timeout: 30000,
        }).should("have.attr", "data-map-signature", signature);
      });
  });

  it("loads test maps by their prefixed map names", () => {
    cy.visit("/map/test_flat");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    }).should("have.attr", "data-map-name", "test_flat");
  });

  it("lazy-loads another stored map through the game router", () => {
    cy.visit("/map/test_flat");
    cy.get('.background-canvas[data-game-ready="true"]', {
      timeout: 30000,
    });
    cy.window().then((window) => {
      return window.gameMovementTest.loadScenario("inventory");
    });
    cy.get(".background-canvas")
      .should("have.attr", "data-map-name", "test_inventory")
      .and("have.attr", "data-map-signature", "test_inventory");
    cy.location("pathname").should("match", /\/map\/test_inventory$/);
  });
});
