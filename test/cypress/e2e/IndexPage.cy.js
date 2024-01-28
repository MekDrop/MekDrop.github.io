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
          "extra_links_modal__search-results--non-empty"
        );
        cy.get(
          "#extra_links_modal .extra_links_modal__search-results .q-item"
        ).should("have.length", 2);

        cy.get('#extra_links_modal input[name="search"]').type("git-not-found");
        cy.get("#extra_links_modal .extra_links_modal__search-results").should(
          "have.class",
          "extra_links_modal__search-results--empty"
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

/*cy.visit('http://localhost:9100/');

cy.visit('http://localhost:9100/en-US');
cy.get('#f_eaa58fbc-b613-49dd-8120-4e34ecfded13').click();;

cy.get('.q-btn--standard:nth-child(2) > .q-btn__content').click();
cy.get('.q-page').click();
cy.get('#f_740cf067-e05d-4f10-9978-db6691274f0c').type('git');
cy.get('.q-pt-none').click();
cy.get('.block').click();
cy.get('.q-btn--fab').click();
cy.get('.disabled:nth-child(1) > .q-btn__content').click();
cy.get('.q-btn--outline:nth-child(2) > .q-btn__content').click();
cy.get('#f_56f30064-a097-474f-bc3f-672e4c9f9679').click();
cy.get('#f_56f30064-a097-474f-bc3f-672e4c9f9679').type('git');
cy.get('.block').click();*/

// ** The following code is an example to show you how to write some tests for your home page **
//
// describe('Home page tests', () => {
//   beforeEach(() => {
//     cy.visit('/');
//   });
//   it('has pretty background', () => {
//     cy.dataCy('landing-wrapper')
//       .should('have.css', 'background').and('match', /(".+(\/img\/background).+\.png)/);
//   });
//   it('has pretty logo', () => {
//     cy.dataCy('landing-wrapper img')
//       .should('have.class', 'logo-main')
//       .and('have.attr', 'src')
//       .and('match', /^(data:image\/svg\+xml).+/);
//   });
//   it('has very important information', () => {
//     cy.dataCy('instruction-wrapper')
//       .should('contain', 'SETUP INSTRUCTIONS')
//       .and('contain', 'Configure Authentication')
//       .and('contain', 'Database Configuration and CRUD operations')
//       .and('contain', 'Continuous Integration & Continuous Deployment CI/CD');
//   });
// });
