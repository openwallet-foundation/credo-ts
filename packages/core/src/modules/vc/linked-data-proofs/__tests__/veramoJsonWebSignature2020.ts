/**
 * Credentials signed by Veramo (@veramo/credential-ld 6.x, VeramoJsonWebSignature2020, an Ed25519 key published as a
 * JsonWebKey2020 method of a did:jwk). This is what Studio produces for JSON-LD credentials with JsonWebKey2020 keys.
 *
 * `definedTerms`: the claim `name` is defined by an inline context.
 * `undefinedTerms`: the claim `name` is not defined by any context. Veramo verifies this credential even after the
 * claim is changed, because an undefined term is dropped from the signed data, so the claim is not signed at all.
 */
export const VERAMO_JSON_WEB_SIGNATURE_2020 = {
  did: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ',
  verificationMethodId:
    'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
  didDocument: {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
    id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ',
    verificationMethod: [
      {
        id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
        type: 'JsonWebKey2020',
        controller:
          'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ',
        publicKeyJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'W4-pNpegNw5yyOVImVub6Fy2bdx4qfp280BQbi-n6l4',
        },
      },
    ],
    assertionMethod: [
      'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
    ],
    authentication: [
      'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
    ],
    capabilityInvocation: [
      'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
    ],
    capabilityDelegation: [
      'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
    ],
    keyAgreement: [],
  },
  definedTerms: {
    type: ['VerifiableCredential'],
    issuer: {
      id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ',
    },
    issuanceDate: '2026-01-01T00:00:00Z',
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      {
        name: 'https://schema.org/name',
      },
      'https://w3id.org/security/suites/jws-2020/v1',
    ],
    credentialSubject: {
      id: 'did:example:subject',
      name: 'Alice',
    },
    proof: {
      type: 'JsonWebSignature2020',
      created: '2026-11-12T09:03:57Z',
      verificationMethod:
        'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..qkzWL_v0wI_G2G5laOijhVig7KT0CZsoOBLuG7auyZmVkPaVQmoOMHCvo0o15krZKKEmiV-_RxSIVaOFW1bcBw',
    },
  },
  undefinedTerms: {
    type: ['VerifiableCredential'],
    issuer: {
      id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ',
    },
    issuanceDate: '2026-01-01T00:00:00Z',
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
    credentialSubject: {
      id: 'did:example:subject',
      name: 'Alice',
    },
    proof: {
      type: 'JsonWebSignature2020',
      created: '2026-11-12T09:03:57Z',
      verificationMethod:
        'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Ilc0LXBOcGVnTnc1eXlPVkltVnViNkZ5MmJkeDRxZnAyODBCUWJpLW42bDQifQ#0',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..FrXAoV1lKo-sOjfH97u98FoUjI49OfqfvS4N2pDqaIwajGkFoki4kdcZTvQ3iXXbDoDrsFMSQLnwrPHh28FDBQ',
    },
  },
}
