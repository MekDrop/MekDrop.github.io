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

      it("clicking on header text changes background image", () => {
        cy.get("#main_card .text-h1").dblclick();
      });

      it("other links opening", () => {
        cy.get("#main_card .q-btn:last-child > .q-btn__content").click();
        cy.get('#extra_links_modal input[name="search"]').click();
        cy.get('#extra_links_modal input[name="search"]').type("git");
        cy.get("#extra_links_modal .extra_links_modal__search-results").should(
          "have.class",
          "extra_links_modal__search-results--non-empty",
        );
        cy.get(
          "#extra_links_modal .extra_links_modal__search-results .q-item",
        ).should("have.length", 2);

        cy.get('#extra_links_modal input[name="search"]').type("git-not-found");
        cy.get("#extra_links_modal .extra_links_modal__search-results").should(
          "have.class",
          "extra_links_modal__search-results--empty",
        );

        cy.get('#extra_links_modal input[name="search"]').type("{esc}");
      });

      locales.forEach((locale2) => {
        it(`switching language into ${locale2}`, () => {
          cy.get("#language_switcher .q-icon").click();
          cy.get(`#language_switcher [data-locale="${locale2}"]`).click();
          cy.url().should("match", new RegExp(`\/${locale2}$`));
        });
      });
    });
  });
