function extensionUrl(pathname) {
  const id = Cypress.env('EXTENSION_ID');
  expect(id, 'EXTENSION_ID').to.be.a('string').and.have.length(32);
  return `chrome-extension://${id}${pathname}`;
}

function storageSet(storageArea, data) {
  return new Cypress.Promise((resolve, reject) => {
    try {
      storageArea.set(data, () => resolve());
    } catch (err) {
      reject(err);
    }
  });
}

describe.skip('Open Basket Network (extension)', () => {
  it('configures settings and publishes a BasketSnapshot (records video)', () => {
    const basketKey = 'obn_basket_v1';
    const settingsKey = 'obn_settings_v1';

    const baseUrl = 'http://127.0.0.1:4173';
    const brokerEndpoint = `${baseUrl}/publish`;

    const basket = {
      basketId: 'local_test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          basketItemId: 'item_test_1',
          addedAt: new Date().toISOString(),
          quantity: 2,
          schemaType: 'Product',
          extractedFrom: 'json-ld',
          source: { url: `${baseUrl}/`, pageTitle: 'OBN Cypress Test Page', detectedId: 'urn:obn:test:product-1' },
          title: 'Test Product',
          image: 'https://example.com/image.jpg',
          entity: { '@type': 'Product', name: 'Test Product' }
        }
      ]
    };

    cy.visit(extensionUrl('/options.html'));
    cy.get('#brokerEndpoint').clear().type(brokerEndpoint);
    cy.get('#publishPayload').select('snapshot');
    cy.get('#save').click();
    cy.contains('#status', 'Saved');

    cy.visit(extensionUrl('/basket.html'));
    cy.window().then(win =>
      storageSet(win.chrome.storage.local, { [basketKey]: basket })
        .then(() => storageSet(win.chrome.storage.sync, { [settingsKey]: { brokerEndpoint, publishPayload: 'snapshot' } }))
    );
    cy.reload();

    cy.contains('#itemCount', '1');
    cy.contains('.item-title', 'Test Product');

    cy.intercept('POST', brokerEndpoint).as('publish');
    cy.get('#publish').click();

    cy.wait('@publish')
      .its('request.body')
      .should(body => {
        expect(body).to.have.property('type', 'BasketSnapshot');
        expect(body).to.have.property('items');
        expect(body.items).to.have.length(1);
        expect(body.items[0]).to.have.property('schemaType', 'Product');
      });

    cy.contains('#toast', 'Published');
    cy.get('#lastPublish').should('contain.text', '"ok": true');
  });
});
