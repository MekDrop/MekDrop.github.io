// todo: make locales dynamically filled
const locales = ["en-US", "lt"];

locales
  .concat([""])
  .sort((a, b) => a.length - b.length)
  .forEach((locale) => {
    describe("IndexPage (/" + locale + ")", () => {
      beforeEach(() => {
        cy.visit("/" + locale);
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
          cy.url().should("match", new RegExp(`\/${locale2}$`));
        });
      });
    });
  });
