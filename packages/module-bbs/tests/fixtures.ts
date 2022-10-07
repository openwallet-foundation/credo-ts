import { CREDENTIALS_CONTEXT_V1_URL, SECURITY_CONTEXT_BBS_URL } from '@aries-framework/core'

export const BbsBlsSignature2020Fixtures = {
  TEST_LD_DOCUMENT: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://w3id.org/citizenship/v1', SECURITY_CONTEXT_BBS_URL],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer: '',
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
  },

  TEST_LD_DOCUMENT_SIGNED: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://w3id.org/citizenship/v1', SECURITY_CONTEXT_BBS_URL],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer:
      'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
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
      type: 'BbsBlsSignature2020',
      created: '2022-04-13T13:47:47Z',
      verificationMethod:
        'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
      proofPurpose: 'assertionMethod',
      proofValue:
        'hoNNnnRIoEoaY9Fvg3pGVG2eWTAHnR1kIM01nObEL2FdI2IkkpM3246jn3VBD8KBYUHlKfzccE4m7waZyoLEkBLFiK2g54Q2i+CdtYBgDdkUDsoULSBMcH1MwGHwdjfXpldFNFrHFx/IAvLVniyeMQ==',
    },
  },
  TEST_LD_DOCUMENT_BAD_SIGNED: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://w3id.org/citizenship/v1', SECURITY_CONTEXT_BBS_URL],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer:
      'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
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
      type: 'BbsBlsSignature2020',
      created: '2022-04-13T13:47:47Z',
      verificationMethod:
        'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
      proofPurpose: 'assertionMethod',
      proofValue:
        'gU44r/fmvGpkOyMRZX4nwRB6IsbrL7zbVTs+yu6bZGeCNJuiJqS5U6fCPuvGQ+iNYUHlKfzccE4m7waZyoLEkBLFiK2g54Q2i+CdtYBgDdkUDsoULSBMcH1MwGHwdjfXpldFNFrHFx/IAvLVniyeMQ==',
    },
  },

  TEST_VALID_DERIVED: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://w3id.org/citizenship/v1', SECURITY_CONTEXT_BBS_URL],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['PermanentResidentCard', 'VerifiableCredential'],
    description: 'Government of Example Permanent Resident Card.',
    identifier: '83627465',
    name: 'Permanent Resident Card',
    credentialSubject: {
      id: 'did:example:b34ca6cd37bbf23',
      type: ['Person', 'PermanentResident'],
      familyName: 'SMITH',
      gender: 'Male',
      givenName: 'JOHN',
    },
    expirationDate: '2029-12-03T12:19:52Z',
    issuanceDate: '2019-12-03T12:19:52Z',
    issuer:
      'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
    proof: {
      type: 'BbsBlsSignatureProof2020',
      created: '2022-04-13T13:47:47Z',
      nonce: 'GfuRhH8hSAcWm5RWgUQYNQNWjQBsWuVgMCJrhTCD3kSpnHmQOkHcnNAoBsgyMAT4UUI=',
      proofPurpose: 'assertionMethod',
      proofValue:
        'ABkB/wbvkcCcbPRE5vrXc++orru4MsgrS4ESsZ30RNCs3noqLwm94/RZNp62I6Hyf0Kmht0Vog70HDtnNzbnMAj/zD9oT/N53pOADrtn5v+xZgP3cK4N2d6amg6h3LXem29gidW9hMrROPLit5cWEIL4/HOzxPxQQGYiwEXdW++Aja5ZuwJoMsIx7ysn4C4ekN7JXZtnAAAAdJR/oeDShxRdSBlnCSUHkE4Ol+Z3AhXBKkxb4AxiMKOiNmBreMTjJUGwNAPNU2aKnAAAAAIBUuKV0W0YBQZY/mwLmwCcyOWMiaEpjnVhYip4jhBBZw1aPBe8GzsG9zv3Sf9XAyGEAvVFe3OvwvMwYY5nZYdYoLSR4TLl1aLw0oChiPm2zb6ApXypCEEVd8KhJMATyssTlY48bEljDNixAD2rVDaoAAAACWjyrWp3b62M5Onuwo9EItCrBjPD68xC12q1agqgwFTnOI0+MfEwVGNZsA0IqkCGrZmo3AyRpcRm51IYDWYorM4hued5EcVHeCGd6NrnLSxTFPEu8lnmCoMXcxBWDCZFRGb//M5WlncbsYiz01itHbSs1nmpj3o+DYlF2ZyOYphvLo5A9T4rWVwHRK1+LeCDEawOnI03DWLyN8U4ZpbpcdZNK421IwNjseYY+ptvvL3juZ2uQR84maAZYy/OjMuHNyzqHPXNgsLLqtrvPo0kncefp+x1jgA0J/b5xfT72+vhKZAN1R48/uPf+DySC3avwD3T+YHjePn1bBOidhCWMjwzI9LYO8VvhcWXzH7nBWh5MeUch+Wkl777KrsLhrXnCg==',
      verificationMethod:
        'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
    },
  },

  TEST_VP_DOCUMENT: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL],
    type: ['VerifiablePresentation'],
    verifiableCredential: [
      {
        '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://w3id.org/citizenship/v1', SECURITY_CONTEXT_BBS_URL],
        id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
        type: ['PermanentResidentCard', 'VerifiableCredential'],
        description: 'Government of Example Permanent Resident Card.',
        identifier: '83627465',
        name: 'Permanent Resident Card',
        credentialSubject: {
          id: 'did:example:b34ca6cd37bbf23',
          type: ['Person', 'PermanentResident'],
          familyName: 'SMITH',
          gender: 'Male',
          givenName: 'JOHN',
        },
        expirationDate: '2029-12-03T12:19:52Z',
        issuanceDate: '2019-12-03T12:19:52Z',
        issuer:
          'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
        proof: {
          type: 'BbsBlsSignatureProof2020',
          created: '2022-04-13T13:47:47Z',
          nonce: 'GfuRhH8hSAcWm5RWgUQYNQNWjQBsWuVgMCJrhTCD3kSpnHmQOkHcnNAoBsgyMAT4UUI=',
          proofPurpose: 'assertionMethod',
          proofValue:
            'ABkB/wbvkcCcbPRE5vrXc++orru4MsgrS4ESsZ30RNCs3noqLwm94/RZNp62I6Hyf0Kmht0Vog70HDtnNzbnMAj/zD9oT/N53pOADrtn5v+xZgP3cK4N2d6amg6h3LXem29gidW9hMrROPLit5cWEIL4/HOzxPxQQGYiwEXdW++Aja5ZuwJoMsIx7ysn4C4ekN7JXZtnAAAAdJR/oeDShxRdSBlnCSUHkE4Ol+Z3AhXBKkxb4AxiMKOiNmBreMTjJUGwNAPNU2aKnAAAAAIBUuKV0W0YBQZY/mwLmwCcyOWMiaEpjnVhYip4jhBBZw1aPBe8GzsG9zv3Sf9XAyGEAvVFe3OvwvMwYY5nZYdYoLSR4TLl1aLw0oChiPm2zb6ApXypCEEVd8KhJMATyssTlY48bEljDNixAD2rVDaoAAAACWjyrWp3b62M5Onuwo9EItCrBjPD68xC12q1agqgwFTnOI0+MfEwVGNZsA0IqkCGrZmo3AyRpcRm51IYDWYorM4hued5EcVHeCGd6NrnLSxTFPEu8lnmCoMXcxBWDCZFRGb//M5WlncbsYiz01itHbSs1nmpj3o+DYlF2ZyOYphvLo5A9T4rWVwHRK1+LeCDEawOnI03DWLyN8U4ZpbpcdZNK421IwNjseYY+ptvvL3juZ2uQR84maAZYy/OjMuHNyzqHPXNgsLLqtrvPo0kncefp+x1jgA0J/b5xfT72+vhKZAN1R48/uPf+DySC3avwD3T+YHjePn1bBOidhCWMjwzI9LYO8VvhcWXzH7nBWh5MeUch+Wkl777KrsLhrXnCg==',
          verificationMethod:
            'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
        },
      },
    ],
  },
  TEST_VP_DOCUMENT_SIGNED: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL],
    type: ['VerifiablePresentation'],
    verifiableCredential: [
      {
        '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://w3id.org/citizenship/v1', SECURITY_CONTEXT_BBS_URL],
        id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
        type: ['PermanentResidentCard', 'VerifiableCredential'],
        description: 'Government of Example Permanent Resident Card.',
        identifier: '83627465',
        name: 'Permanent Resident Card',
        credentialSubject: {
          id: 'did:example:b34ca6cd37bbf23',
          type: ['Person', 'PermanentResident'],
          familyName: 'SMITH',
          gender: 'Male',
          givenName: 'JOHN',
        },
        expirationDate: '2029-12-03T12:19:52Z',
        issuanceDate: '2019-12-03T12:19:52Z',
        issuer:
          'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
        proof: {
          type: 'BbsBlsSignatureProof2020',
          created: '2022-04-13T13:47:47Z',
          nonce: 'GfuRhH8hSAcWm5RWgUQYNQNWjQBsWuVgMCJrhTCD3kSpnHmQOkHcnNAoBsgyMAT4UUI=',
          proofPurpose: 'assertionMethod',
          proofValue:
            'ABkB/wbvkcCcbPRE5vrXc++orru4MsgrS4ESsZ30RNCs3noqLwm94/RZNp62I6Hyf0Kmht0Vog70HDtnNzbnMAj/zD9oT/N53pOADrtn5v+xZgP3cK4N2d6amg6h3LXem29gidW9hMrROPLit5cWEIL4/HOzxPxQQGYiwEXdW++Aja5ZuwJoMsIx7ysn4C4ekN7JXZtnAAAAdJR/oeDShxRdSBlnCSUHkE4Ol+Z3AhXBKkxb4AxiMKOiNmBreMTjJUGwNAPNU2aKnAAAAAIBUuKV0W0YBQZY/mwLmwCcyOWMiaEpjnVhYip4jhBBZw1aPBe8GzsG9zv3Sf9XAyGEAvVFe3OvwvMwYY5nZYdYoLSR4TLl1aLw0oChiPm2zb6ApXypCEEVd8KhJMATyssTlY48bEljDNixAD2rVDaoAAAACWjyrWp3b62M5Onuwo9EItCrBjPD68xC12q1agqgwFTnOI0+MfEwVGNZsA0IqkCGrZmo3AyRpcRm51IYDWYorM4hued5EcVHeCGd6NrnLSxTFPEu8lnmCoMXcxBWDCZFRGb//M5WlncbsYiz01itHbSs1nmpj3o+DYlF2ZyOYphvLo5A9T4rWVwHRK1+LeCDEawOnI03DWLyN8U4ZpbpcdZNK421IwNjseYY+ptvvL3juZ2uQR84maAZYy/OjMuHNyzqHPXNgsLLqtrvPo0kncefp+x1jgA0J/b5xfT72+vhKZAN1R48/uPf+DySC3avwD3T+YHjePn1bBOidhCWMjwzI9LYO8VvhcWXzH7nBWh5MeUch+Wkl777KrsLhrXnCg==',
          verificationMethod:
            'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN',
        },
      },
    ],
    proof: {
      verificationMethod:
        'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      type: 'Ed25519Signature2018',
      created: '2022-04-21T10:15:38Z',
      proofPurpose: 'authentication',
      challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wGtR9yuTRfhrsvCthUOn-fg_lK0mZIe2IOO2Lv21aOXo5YUAbk50qMBLk4C1iqoOx-Jz6R0g4aa4cuqpdXzkBw',
    },
  },
}
