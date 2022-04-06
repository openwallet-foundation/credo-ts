export const BbsBlsSignature2020Fixtures = {
  signedCredential: {
    context: [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/citizenship/v1',
      'https://w3id.org/security/bbs/v1',
    ],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer:
      'did:key:zUC7Cpr1Tv6P6h9qwnawyMhTFg76izDLgC7Uh4v1oQjGhtbYFKUvdtosW3P9nw1M2ysvV2SNdNcc7qQZGzX6Ajn8yECxeSkgdurSAnnDtV18gu8uvyQ321pNuVHPqea7PxBugMs',
    identifier: '83627465',
    name: 'Permanent Resident Card',
    description: 'Government of Example Permanent Resident Card.',
    issuanceDate: '2019-12-03T12:19:52Z',
    expirationDate: '2029-12-03T12:19:52Z',
    credentialSubject: {
      id: 'did:example:b34ca6cd37bbf23',
      type: ['PermanentResident', 'Person'],
      givenName: 'JOHN',
      familyName: 'SMITH',
      gender: 'Male',
      image: 'data:image/png;base64,iVBORw0KGgokJggg==',
      residentSince: '2015-01-01',
      lprCategory: 'C09',
      lprNumber: '999-999-999',
      commuterClassification: 'C1',
      birthCountry: 'Bahamas',
      birthDate: '1958-07-17',
    },
    proof: {
      '@context': 'https://w3id.org/security/v2',
      type: 'sec:BbsBlsSignature2020',
      created: '2022-04-04T10:34:35Z',
      verificationMethod:
        'did:key:zUC7Cpr1Tv6P6h9qwnawyMhTFg76izDLgC7Uh4v1oQjGhtbYFKUvdtosW3P9nw1M2ysvV2SNdNcc7qQZGzX6Ajn8yECxeSkgdurSAnnDtV18gu8uvyQ321pNuVHPqea7PxBugMs#zUC7Cpr1Tv6P6h9qwnawyMhTFg76izDLgC7Uh4v1oQjGhtbYFKUvdtosW3P9nw1M2ysvV2SNdNcc7qQZGzX6Ajn8yECxeSkgdurSAnnDtV18gu8uvyQ321pNuVHPqea7PxBugMs',
      proofPurpose: 'assertionMethod',
      proofValue:
        'qQbo46wfGPENagOa3iqF3ahRJhlRDT/MNgnIHsGY0aPDuIcLorigglNQ04kQR/jSYUHlKfzccE4m7waZyoLEkBLFiK2g54Q2i+CdtYBgDdkUDsoULSBMcH1MwGHwdjfXpldFNFrHFx/IAvLVniyeMQ==',
    },
  },
}

export const Ed25519Signature2018Fixtures = {
  TEST_LD_DOCUMENT: {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
    // id: 'http://example.edu/credentials/temporary/28934792387492384',
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: '',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
  },
  TEST_VALID_VERIFIABLE_CREDENTIAL: {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
    proof: {
      verificationMethod:
        'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
      type: 'Ed25519Signature2018',
      created: '2022-03-28T15:54:59Z',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..b0MD_c-8EyGATDuCda1A72qbjD3o8MfiipicmhnYmcdqoIyZzE9MlZ9FZn5sxsIJ3LPqPQj7y1jLlINwCwNSDg',
    },
  },
  TEST_INVALID_VERIFIABLE_CREDENTIAL: {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
    proof: {
      verificationMethod:
        'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
      type: 'Ed25519Signature2018',
      created: '2022-03-28T15:54:59Z',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..Ej5aEUBTgeNm3_a4uO_AuNnisldnYTMMGMom4xLb-_TmoYe7467Yo046Bw2QqdfdBja6y-HBbBj4SonOlwswAg',
    },
  },
  TEST_VALID_PRESENTATION: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    verifiableCredential: [
      {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
        issuanceDate: '2017-10-22T12:23:48Z',
        credentialSubject: {
          degree: {
            type: 'BachelorDegree',
            name: 'Bachelor of Science and Arts',
          },
        },
        proof: {
          verificationMethod:
            'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
          type: 'Ed25519Signature2018',
          created: '2022-03-28T15:54:59Z',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..b0MD_c-8EyGATDuCda1A72qbjD3o8MfiipicmhnYmcdqoIyZzE9MlZ9FZn5sxsIJ3LPqPQj7y1jLlINwCwNSDg',
        },
      },
    ],
  },
  TEST_VALID_VERIFIABLE_PRESENTATION: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    verifiableCredential: [
      {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
        issuanceDate: '2017-10-22T12:23:48Z',
        credentialSubject: {
          degree: {
            type: 'BachelorDegree',
            name: 'Bachelor of Science and Arts',
          },
        },
        proof: {
          verificationMethod:
            'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
          type: 'Ed25519Signature2018',
          created: '2022-03-28T15:54:59Z',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..b0MD_c-8EyGATDuCda1A72qbjD3o8MfiipicmhnYmcdqoIyZzE9MlZ9FZn5sxsIJ3LPqPQj7y1jLlINwCwNSDg',
        },
      },
    ],
    proof: {
      verificationMethod:
        'did:key:z6MktpMAZxz5MrBeXHwN15fyfYbSz5dZ7B1FNqv7UrZqDxYa#z6MktpMAZxz5MrBeXHwN15fyfYbSz5dZ7B1FNqv7UrZqDxYa',
      type: 'Ed25519Signature2018',
      created: '2022-04-05T12:53:48Z',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..AH0V9x5AIoeskvfbxoei-UKKPMtbgeoNJf_sAq_F2lxzsZg_es8xkaJ9hBv45itYN2pMgVuOZ618r8gjlc7NDA',
    },
  },
}

// export const validEd25519Signature2018VerifiableCredentialJson = {
//   '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
//   type: ['VerifiableCredential', 'UniversityDegreeCredential'],
//   issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
//   issuanceDate: '2017-10-22T12:23:48Z',
//   credentialSubject: {
//     degree: {
//       type: 'BachelorDegree',
//       name: 'Bachelor of Science and Arts',
//     },
//   },
//   proof: {
//     verificationMethod:
//       'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
//     type: 'Ed25519Signature2018',
//     created: '2022-03-28T15:54:59Z',
//     proofPurpose: 'assertionMethod',
//     jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..b0MD_c-8EyGATDuCda1A72qbjD3o8MfiipicmhnYmcdqoIyZzE9MlZ9FZn5sxsIJ3LPqPQj7y1jLlINwCwNSDg',
//   },
// }

// export const validEd25519Signature2018VerifiablePresentationJson = {
//   '@context': ['https://www.w3.org/2018/credentials/v1'],
//   type: ['VerifiablePresentation'],
//   verifiableCredential: [
//     {
//       '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
//       type: ['VerifiableCredential', 'UniversityDegreeCredential'],
//       issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
//       issuanceDate: '2017-10-22T12:23:48Z',
//       credentialSubject: {
//         degree: {
//           type: 'BachelorDegree',
//           name: 'Bachelor of Science and Arts',
//         },
//       },
//       proof: {
//         verificationMethod:
//           'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
//         type: 'Ed25519Signature2018',
//         created: '2022-03-28T15:54:59Z',
//         proofPurpose: 'assertionMethod',
//         jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..b0MD_c-8EyGATDuCda1A72qbjD3o8MfiipicmhnYmcdqoIyZzE9MlZ9FZn5sxsIJ3LPqPQj7y1jLlINwCwNSDg',
//       },
//     },
//   ],
//   proof: {
//     verificationMethod:
//       'did:key:z6Mkrm5US7qdz5uL9FXhtpv2zSHPbH9HQSF9qbnbE46JSan8#z6Mkrm5US7qdz5uL9FXhtpv2zSHPbH9HQSF9qbnbE46JSan8',
//     type: 'Ed25519Signature2018',
//     created: '2022-04-01T21:08:14Z',
//     proofPurpose: 'assertionMethod',
//     jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..hgeWAFdwrFx7zgbhVP8GXhcct2kVRWYyPFCmXCWyiX4ChywSI4Zx85JLqfNMgAdkXbukI3788KIcRO_fayInAg',
//   },
// }
