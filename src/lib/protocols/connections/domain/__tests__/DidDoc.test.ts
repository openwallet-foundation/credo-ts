import { DidDoc } from '../DidDoc';

// Test adopted from ACA-Py
// TODO: add more tests
describe('DidDoc', () => {
  test('Basic Test', () => {
    const dd_in = {
      '@context': 'https://w3id.org/did/v1',
      id: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKey: [
        {
          id: '3',
          type: 'RsaVerificationKey2018',
          controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
          publicKeyPem: '-----BEGIN PUBLIC X...',
        },
        {
          id: 'did:sov:LjgpST2rjsoxYegQDRm7EL#4',
          type: 'RsaVerificationKey2018',
          controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
          publicKeyPem: '-----BEGIN PUBLIC 9...',
        },
        {
          id: '6',
          type: 'RsaVerificationKey2018',
          controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
          publicKeyPem: '-----BEGIN PUBLIC A...',
        },
      ],
      authentication: [
        {
          type: 'RsaSignatureAuthentication2018',
          publicKey: 'did:sov:LjgpST2rjsoxYegQDRm7EL#4',
        },
      ],
      service: [
        {
          id: '0',
          type: 'Mediator',
          serviceEndpoint: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
        },
      ],
    };

    const dd = DidDoc.deserialize(JSON.stringify(dd_in));
    expect(dd.publicKey.length).toEqual(dd_in.publicKey.length);

    const dd_out = dd.serialize();

    // Exercise JSON, de/serialization
    const dd_json = dd.toJSON();
    const dd_copy = DidDoc.deserialize(JSON.stringify(dd_json));
    expect(dd_copy.id).toEqual(dd.id);
    expect(JSON.stringify(dd_copy.publicKey)).toEqual(JSON.stringify(dd.publicKey));
    expect(JSON.stringify(dd_copy.service)).toEqual(JSON.stringify(dd.service));
    expect(dd_copy.serialize()).toEqual(dd_out);
  });
});
