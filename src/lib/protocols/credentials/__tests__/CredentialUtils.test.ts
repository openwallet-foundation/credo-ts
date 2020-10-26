import { CredentialUtils } from '../CredentialUtils';
import { CredentialPreview, CredentialPreviewAttribute } from '../messages/CredentialOfferMessage';

describe('CredentialUtils', () => {
  describe('convertPreviewToValues', () => {
    test('returns object with raw and encoded attributes', () => {
      const credentialPreview = new CredentialPreview({
        attributes: [
          new CredentialPreviewAttribute({
            name: 'name',
            mimeType: 'text/plain',
            value: '101 Wilson Lane',
          }),
          new CredentialPreviewAttribute({
            name: 'age',
            mimeType: 'text/plain',
            value: '1234',
          }),
        ],
      });

      expect(CredentialUtils.convertPreviewToValues(credentialPreview)).toEqual({
        name: {
          raw: '101 Wilson Lane',
          encoded: '68086943237164982734333428280784300550565381723532936263016368251445461241953',
        },
        age: { raw: '1234', encoded: '1234' },
      });
    });
  });
});
