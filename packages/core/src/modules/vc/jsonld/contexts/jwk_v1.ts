export const JWK_V1 = {
  '@context': {
    id: '@id',
    type: '@type',
    '@protected': true,
    JsonWebKey: {
      '@id': 'https://w3id.org/security#JsonWebKey',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        controller: {
          '@id': 'https://w3id.org/security#controller',
          '@type': '@id',
        },
        revoked: {
          '@id': 'https://w3id.org/security#revoked',
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
        },
        expires: {
          '@id': 'https://w3id.org/security#expiration',
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
        },
        publicKeyJwk: {
          '@id': 'https://w3id.org/security#publicKeyJwk',
          '@type': '@json',
        },
        secretKeyJwk: {
          '@id': 'https://w3id.org/security#secretKeyJwk',
          '@type': '@json',
        },
      },
    },
  },
}
