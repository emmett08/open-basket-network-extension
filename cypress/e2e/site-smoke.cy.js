describe('OBN test site (smoke)', () => {
  it('loads the test page', () => {
    cy.visit('http://127.0.0.1:4173/');
    cy.contains('h1', 'OBN Cypress Test Page');
  });
});

