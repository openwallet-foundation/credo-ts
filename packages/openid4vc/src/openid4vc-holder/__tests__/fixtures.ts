export const matrrLaunchpadDraft11JwtVcJson = {
  credentialOffer:
    'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Flaunchpad.vii.electron.mattrlabs.io%22%2C%22credentials%22%3A%5B%22613ecbbb-0a4c-4041-bb78-c64943139d5f%22%5D%2C%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22Jd6TUmLJct1DNyJpKKmt0i85scznBoJrEe_y_SlMW0j%22%7D%7D%7D',
  getMetadataResponse: {
    issuer: 'https://launchpad.vii.electron.mattrlabs.io',
    authorization_endpoint: 'https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/authorize',
    token_endpoint: 'https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/token',
    jwks_uri: 'https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/jwks',
    token_endpoint_auth_methods_supported: [
      'none',
      'client_secret_basic',
      'client_secret_jwt',
      'client_secret_post',
      'private_key_jwt',
    ],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:pre-authorized_code'],
    response_modes_supported: ['form_post', 'fragment', 'query'],
    response_types_supported: ['code id_token', 'code', 'id_token', 'none'],
    scopes_supported: ['OpenBadgeCredential', 'Passport'],
    token_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
    credential_endpoint: 'https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/credential',
    credentials_supported: [
      {
        id: 'd2662472-891c-413d-b3c6-e2f0109001c5',
        format: 'ldp_vc',
        types: ['VerifiableCredential', 'OpenBadgeCredential'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['Ed25519Signature2018'],
        display: [
          {
            name: 'Example University Degree',
            description: 'JFF Plugfest 3 OpenBadge Credential',
            background_color: '#464c49',
            logo: {},
          },
        ],
      },
      {
        id: 'b4c4cdf5-ccc9-4945-8c19-9334558653b2',
        format: 'ldp_vc',
        types: ['VerifiableCredential', 'Passport'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['Ed25519Signature2018'],
        display: [
          {
            name: 'Passport',
            description: 'Passport of the Kingdom of Kākāpō',
            background_color: '#171717',
            logo: { url: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/logo.svg' },
          },
        ],
      },
      {
        id: '613ecbbb-0a4c-4041-bb78-c64943139d5f',
        format: 'jwt_vc_json',
        types: ['VerifiableCredential', 'OpenBadgeCredential'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'Example University Degree',
            description: 'JFF Plugfest 3 OpenBadge Credential',
            background_color: '#464c49',
            logo: {},
          },
        ],
      },
      {
        id: 'c3db5513-ae2b-46e9-8a0d-fbfd0ce52b6a',
        format: 'jwt_vc_json',
        types: ['VerifiableCredential', 'Passport'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'Passport',
            description: 'Passport of the Kingdom of Kākāpō',
            background_color: '#171717',
            logo: { url: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/logo.svg' },
          },
        ],
      },
    ],
  },

  wellKnownDid: {
    id: 'did:web:launchpad.vii.electron.mattrlabs.io',
    '@context': 'https://w3.org/ns/did/v1',
    // Uses deprecated publicKey, but the did:web resolver transforms
    // it to the newer verificationMethod
    publicKey: [
      {
        id: 'did:web:launchpad.vii.electron.mattrlabs.io#Ck99k8Rd75',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:web:launchpad.vii.electron.mattrlabs.io',
        publicKeyBase58: 'Ck99k8Rd75V3THNexmMYYA6McqUJi9QgcPh4B1BBUTX7',
      },
    ],
    keyAgreement: [
      {
        id: 'did:web:launchpad.vii.electron.mattrlabs.io#Dd3FUiBvRy',
        type: 'X25519KeyAgreementKey2019',
        controller: 'did:web:launchpad.vii.electron.mattrlabs.io',
        publicKeyBase58: 'Dd3FUiBvRyBcAbcywjGy99BtPaV2DXnvjbYPCu8MYs68',
      },
    ],
    authentication: ['did:web:launchpad.vii.electron.mattrlabs.io#Ck99k8Rd75'],
    assertionMethod: ['did:web:launchpad.vii.electron.mattrlabs.io#Ck99k8Rd75'],
    capabilityDelegation: ['did:web:launchpad.vii.electron.mattrlabs.io#Ck99k8Rd75'],
    capabilityInvocation: ['did:web:launchpad.vii.electron.mattrlabs.io#Ck99k8Rd75'],
  },

  acquireAccessTokenResponse: {
    access_token: 'i3iOTQe5TOskOOUnkIDX29M8AuygT7Lfv3MkaHprL4p',
    expires_in: 3600,
    scope: 'OpenBadgeCredential',
    token_type: 'Bearer',
  },

  credentialResponse: {
    credential:
      'eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6bGF1bmNocGFkLnZpaS5lbGVjdHJvbi5tYXR0cmxhYnMuaW8jQ2s5OWs4UmQ3NSJ9.eyJpc3MiOiJkaWQ6d2ViOmxhdW5jaHBhZC52aWkuZWxlY3Ryb24ubWF0dHJsYWJzLmlvIiwic3ViIjoiZGlkOmtleTp6Nk1rcEdSNGdzNFJjM1pwaDR2ajh3Um5qbkF4Z0FQU3hjUjhNQVZLdXRXc3BRemMiLCJuYmYiOjE3MDU4NDAzMDksImV4cCI6MTczNzQ2MjcwOSwidmMiOnsibmFtZSI6IkV4YW1wbGUgVW5pdmVyc2l0eSBEZWdyZWUiLCJkZXNjcmlwdGlvbiI6IkpGRiBQbHVnZmVzdCAzIE9wZW5CYWRnZSBDcmVkZW50aWFsIiwiY3JlZGVudGlhbEJyYW5kaW5nIjp7ImJhY2tncm91bmRDb2xvciI6IiM0NjRjNDkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL21hdHRyLmdsb2JhbC9jb250ZXh0cy92Yy1leHRlbnNpb25zL3YyIiwiaHR0cHM6Ly9wdXJsLmltc2dsb2JhbC5vcmcvc3BlYy9vYi92M3AwL2NvbnRleHQtMy4wLjIuanNvbiIsImh0dHBzOi8vcHVybC5pbXNnbG9iYWwub3JnL3NwZWMvb2IvdjNwMC9leHRlbnNpb25zLmpzb24iLCJodHRwczovL3czaWQub3JnL3ZjLXJldm9jYXRpb24tbGlzdC0yMDIwL3YxIiwiaHR0cHM6Ly93M2lkLm9yZy92Yy1yZXZvY2F0aW9uLWxpc3QtMjAyMC92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiT3BlbkJhZGdlQ3JlZGVudGlhbCJdLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDprZXk6ejZNa3BHUjRnczRSYzNacGg0dmo4d1Juam5BeGdBUFN4Y1I4TUFWS3V0V3NwUXpjIiwidHlwZSI6WyJBY2hpZXZlbWVudFN1YmplY3QiXSwiYWNoaWV2ZW1lbnQiOnsiaWQiOiJodHRwczovL2V4YW1wbGUuY29tL2FjaGlldmVtZW50cy8yMXN0LWNlbnR1cnktc2tpbGxzL3RlYW13b3JrIiwibmFtZSI6IlRlYW13b3JrIiwidHlwZSI6WyJBY2hpZXZlbWVudCJdLCJpbWFnZSI6eyJpZCI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMy0yMDIzL2ltYWdlcy9KRkYtVkMtRURVLVBMVUdGRVNUMy1iYWRnZS1pbWFnZS5wbmciLCJ0eXBlIjoiSW1hZ2UifSwiY3JpdGVyaWEiOnsibmFycmF0aXZlIjoiVGVhbSBtZW1iZXJzIGFyZSBub21pbmF0ZWQgZm9yIHRoaXMgYmFkZ2UgYnkgdGhlaXIgcGVlcnMgYW5kIHJlY29nbml6ZWQgdXBvbiByZXZpZXcgYnkgRXhhbXBsZSBDb3JwIG1hbmFnZW1lbnQuIn0sImRlc2NyaXB0aW9uIjoiVGhpcyBiYWRnZSByZWNvZ25pemVzIHRoZSBkZXZlbG9wbWVudCBvZiB0aGUgY2FwYWNpdHkgdG8gY29sbGFib3JhdGUgd2l0aGluIGEgZ3JvdXAgZW52aXJvbm1lbnQuIn19LCJpc3N1ZXIiOnsiaWQiOiJkaWQ6d2ViOmxhdW5jaHBhZC52aWkuZWxlY3Ryb24ubWF0dHJsYWJzLmlvIiwibmFtZSI6IkV4YW1wbGUgVW5pdmVyc2l0eSIsImljb25VcmwiOiJodHRwczovL3czYy1jY2cuZ2l0aHViLmlvL3ZjLWVkL3BsdWdmZXN0LTEtMjAyMi9pbWFnZXMvSkZGX0xvZ29Mb2NrdXAucG5nIiwiaW1hZ2UiOiJodHRwczovL3czYy1jY2cuZ2l0aHViLmlvL3ZjLWVkL3BsdWdmZXN0LTEtMjAyMi9pbWFnZXMvSkZGX0xvZ29Mb2NrdXAucG5nIn19fQ.u33C1y8qwlKQSIq5NjgjXq-fG_u5-bP87HAZPiaTtXhUzd5hxToyrEUb3GAEa4dkLY2TVQA1LtC6sNSUmGevBQ',
    format: 'jwt_vc_json',
  },
}

export const waltIdDraft11JwtVcJson = {
  credentialOffer:
    'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fissuer.portal.walt.id%22%2C%22credentials%22%3A%5B%22UniversityDegree%22%5D%2C%22grants%22%3A%7B%22authorization_code%22%3A%7B%22issuer_state%22%3A%22efc2f5dd-0f44-4f38-a902-3204e732c391%22%7D%2C%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJlZmMyZjVkZC0wZjQ0LTRmMzgtYTkwMi0zMjA0ZTczMmMzOTEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.OHzYTP_u6I95hHBmjF3RchydGidq3nsT0QHdgJ1AXyR5AFkrTfJwsW4FQIdOdda93uS7FOh_vSVGY0Qngzm7Ag%22%2C%22user_pin_required%22%3Afalse%7D%7D%7D',
  getMetadataResponse: {
    issuer: 'https://issuer.portal.walt.id',
    authorization_endpoint: 'https://issuer.portal.walt.id/authorize',
    pushed_authorization_request_endpoint: 'https://issuer.portal.walt.id/par',
    token_endpoint: 'https://issuer.portal.walt.id/token',
    jwks_uri: 'https://issuer.portal.walt.id/jwks',
    scopes_supported: ['openid'],
    response_modes_supported: ['query', 'fragment'],
    grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:pre-authorized_code'],
    subject_types_supported: ['public'],
    credential_issuer: 'https://issuer.portal.walt.id/.well-known/openid-credential-issuer',
    credential_endpoint: 'https://issuer.portal.walt.id/credential',
    credentials_supported: [
      {
        format: 'jwt_vc_json',
        id: 'BankId',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'BankId'],
      },
      {
        format: 'jwt_vc_json',
        id: 'KycChecksCredential',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'KycChecksCredential'],
      },
      {
        format: 'jwt_vc_json',
        id: 'KycDataCredential',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'KycDataCredential'],
      },
      {
        format: 'jwt_vc_json',
        id: 'PassportCh',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableId', 'PassportCh'],
      },
      {
        format: 'jwt_vc_json',
        id: 'PND91Credential',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'PND91Credential'],
      },
      {
        format: 'jwt_vc_json',
        id: 'MortgageEligibility',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableId', 'MortgageEligibility'],
      },
      {
        format: 'jwt_vc_json',
        id: 'PortableDocumentA1',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'PortableDocumentA1'],
      },
      {
        format: 'jwt_vc_json',
        id: 'OpenBadgeCredential',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'OpenBadgeCredential'],
      },
      {
        format: 'jwt_vc_json',
        id: 'VaccinationCertificate',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'VaccinationCertificate'],
      },
      {
        format: 'jwt_vc_json',
        id: 'WalletHolderCredential',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'WalletHolderCredential'],
      },
      {
        format: 'jwt_vc_json',
        id: 'UniversityDegree',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'UniversityDegree'],
      },
      {
        format: 'jwt_vc_json',
        id: 'VerifiableId',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256', 'ES256K', 'RSA'],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableId'],
      },
    ],
    batch_credential_endpoint: 'https://issuer.portal.walt.id/batch_credential',
    deferred_credential_endpoint: 'https://issuer.portal.walt.id/credential_deferred',
  },

  acquireAccessTokenResponse: {
    access_token:
      'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJjMDQyMmUxMy1kNTU0LTQwMmUtOTQ0OS0yZjA0ZjAyNjMzNTMiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IkFDQ0VTUyJ9.pkNF05uUy72QAoZwdf1Uz1XRc4aGs1hhnim-x1qIeMe17TMUYV2D6BOATQtDItxnnhQz2MBfqUSQKYi7CFirDA',
    token_type: 'bearer',
    c_nonce: 'd4364dac-f026-4380-a4c3-2bfe2d2df52a',
    c_nonce_expires_in: 27,
  },

  authorizationCode:
    'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJkZDYyOGQxYy1kYzg4LTQ2OGItYjI5Yi05ODQwMzFlNzg3OWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.86LfW1y7QwNObIhJej40E4Ea8PGjBbIeq1KBkOWOLNnOs5rRvtDkazA52npsKrBKqfoqCPmOHcVAvPZPWJhKAA',

  par: {
    request_uri: 'urn:ietf:params:oauth:request_uri:738f2ac2-18ac-4162-b0a8-5e0e6ba2270b',
    expires_in: 'PT3M46.132011234S',
  },

  credentialResponse: {
    credential:
      'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDpqd2s6ZXlKcmRIa2lPaUpQUzFBaUxDSmpjbllpT2lKRlpESTFOVEU1SWl3aWEybGtJam9pUTBaUkxVNXlZVFY1Ym5sQ2MyWjRkM2szWVU1bU9HUjFRVVZWUTAxc1RVbHlVa2x5UkdjMlJFbDVOQ0lzSW5naU9pSm9OVzVpZHpaWU9VcHRTVEJDZG5WUk5VMHdTbGhtZWs4NGN6SmxSV0pRWkZZeU9YZHpTRlJNT1hCckluMCJ9.eyJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKUFMxQWlMQ0pqY25ZaU9pSkZaREkxTlRFNUlpd2lhMmxrSWpvaVEwWlJMVTV5WVRWNWJubENjMlo0ZDNrM1lVNW1PR1IxUVVWVlEwMXNUVWx5VWtseVJHYzJSRWw1TkNJc0luZ2lPaUpvTlc1aWR6WllPVXB0U1RCQ2RuVlJOVTB3U2xobWVrODRjekpsUldKUVpGWXlPWGR6U0ZSTU9YQnJJbjAiLCJzdWIiOiJkaWQ6a2V5Ono2TWtwR1I0Z3M0UmMzWnBoNHZqOHdSbmpuQXhnQVBTeGNSOE1BVkt1dFdzcFF6YyN6Nk1rcEdSNGdzNFJjM1pwaDR2ajh3Um5qbkF4Z0FQU3hjUjhNQVZLdXRXc3BRemMiLCJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL2V4YW1wbGVzL3YxIl0sImlkIjoidXJuOnV1aWQ6NmU2ODVlOGUtNmRmNS00NzhkLTlkNWQtNDk2ZTcxMDJkYmFhIiwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIlVuaXZlcnNpdHlEZWdyZWUiXSwiaXNzdWVyIjp7ImlkIjoiZGlkOmp3azpleUpyZEhraU9pSlBTMUFpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpYTJsa0lqb2lRMFpSTFU1eVlUVjVibmxDYzJaNGQzazNZVTVtT0dSMVFVVlZRMDFzVFVseVVrbHlSR2MyUkVsNU5DSXNJbmdpT2lKb05XNWlkelpZT1VwdFNUQkNkblZSTlUwd1NsaG1lazg0Y3pKbFJXSlFaRll5T1hkelNGUk1PWEJySW4wIn0sImlzc3VhbmNlRGF0ZSI6IjIwMjQtMDEtMjFUMTI6NDU6NDYuOTU1MjU0MDg3WiIsImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6Nk1rcEdSNGdzNFJjM1pwaDR2ajh3Um5qbkF4Z0FQU3hjUjhNQVZLdXRXc3BRemMjejZNa3BHUjRnczRSYzNacGg0dmo4d1Juam5BeGdBUFN4Y1I4TUFWS3V0V3NwUXpjIiwiZGVncmVlIjp7InR5cGUiOiJCYWNoZWxvckRlZ3JlZSIsIm5hbWUiOiJCYWNoZWxvciBvZiBTY2llbmNlIGFuZCBBcnRzIn19fSwianRpIjoidXJuOnV1aWQ6NmU2ODVlOGUtNmRmNS00NzhkLTlkNWQtNDk2ZTcxMDJkYmFhIiwiaWF0IjoxNzA1ODQxMTQ2LCJuYmYiOjE3MDU4NDEwNTZ9.sEudi9lL4YSvMdfjRaeDoRl2_p6dpfuxw_qkPXeBx8FRIQ41t-fyH_S_CDTVYH7wwL-RDbVMK1cza2FQH65hCg',
    format: 'jwt_vc_json',
  },
}

export const animoOpenIdPlaygroundDraft11SdJwtVc = {
  credentialOffer:
    'openid-credential-offer://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221076398228999891821960009%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22AnimoOpenId4VcPlaygroundSdJwtVcJwk%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc.animo.id%2Foid4vci%2F0bbfb1c0-9f45-478c-a139-08f6ed610a37%22%7D',
  getMetadataResponse: {
    credential_issuer: 'https://openid4vc.animo.id/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37',
    token_endpoint: 'https://openid4vc.animo.id/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37/token',
    credential_endpoint: 'https://openid4vc.animo.id/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37/credential',
    notification_endpoint: 'https://openid4vc.animo.id/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37/notification',
    credentials_supported: [
      {
        id: 'AnimoOpenId4VcPlaygroundSdJwtVcDid',
        format: 'vc+sd-jwt',
        vct: 'AnimoOpenId4VcPlayground',
        cryptographic_binding_methods_supported: ['did:key', 'did:jwk'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'Animo OpenID4VC Playground - SD-JWT-VC (did holder binding)',
            description: "Issued using Animo's OpenID4VC Playground",
            background_color: '#FFFFFF',
            locale: 'en',
            text_color: '#E17471',
          },
        ],
      },
      {
        id: 'AnimoOpenId4VcPlaygroundSdJwtVcJwk',
        format: 'vc+sd-jwt',
        vct: 'AnimoOpenId4VcPlayground',
        cryptographic_binding_methods_supported: ['jwk'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'Animo OpenID4VC Playground - SD-JWT-VC (jwk holder binding)',
            description: "Issued using Animo's OpenID4VC Playground",
            background_color: '#FFFFFF',
            locale: 'en',
            text_color: '#E17471',
          },
        ],
      },
      {
        id: 'AnimoOpenId4VcPlaygroundJwtVc',
        format: 'jwt_vc_json',
        types: ['AnimoOpenId4VcPlayground'],
        cryptographic_binding_methods_supported: ['did:key', 'did:jwk'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'Animo OpenID4VC Playground - JWT VC',
            description: "Issued using Animo's OpenID4VC Playground",
            background_color: '#FFFFFF',
            locale: 'en',
            text_color: '#E17471',
          },
        ],
      },
    ],
    display: [
      {
        background_color: '#FFFFFF',
        description: 'Animo OpenID4VC Playground',
        name: 'Animo OpenID4VC Playground',
        locale: 'en',
        logo: { alt_text: 'Animo logo', url: 'https://i.imgur.com/8B37E4a.png' },
        text_color: '#E17471',
      },
    ],
  },

  acquireAccessTokenResponse: {
    access_token:
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSIsImp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im5fQ05IM3c1dWpQaDNsTmVaR05Ta0hiT2pSTnNudkJpNXIzcXhINGZwd1UifX0.eyJpc3MiOiJodHRwczovL29wZW5pZDR2Yy5hbmltby5pZC9vaWQ0dmNpLzBiYmZiMWMwLTlmNDUtNDc4Yy1hMTM5LTA4ZjZlZDYxMGEzNyIsImV4cCI6MTgwMDAwLCJpYXQiOjE3MDU4NDM1NzM1ODh9.3JC_R4zXK0GLMG6MS7ClVWm9bK-9v7mA2iS_0hqYdmZRwXJI3ME6TAslPZNNdxCTp5ZYzzsFuLd2L3l7kULmBQ',
    token_type: 'bearer',
    expires_in: 180000,
    c_nonce: '725150697872293881791236',
    c_nonce_expires_in: 300000,
    authorization_pending: false,
  },

  credentialResponse: {
    credential:
      'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6IiN6Nk1raDVITlBDQ0pXWm42V1JMalJQdHR5dllaQnNrWlVkU0pmVGlad2NVU2llcXgifQ.eyJ2Y3QiOiJBbmltb09wZW5JZDRWY1BsYXlncm91bmQiLCJwbGF5Z3JvdW5kIjp7ImZyYW1ld29yayI6IkFyaWVzIEZyYW1ld29yayBKYXZhU2NyaXB0IiwiY3JlYXRlZEJ5IjoiQW5pbW8gU29sdXRpb25zIiwiX3NkIjpbImZZM0ZqUHpZSEZOcHlZZnRnVl9kX25DMlRHSVh4UnZocE00VHdrMk1yMDQiLCJwTnNqdmZJeVBZOEQwTks1c1l0alR2Nkc2R0FNVDNLTjdaZDNVNDAwZ1pZIl19LCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4Ijoia2MydGxwaGNadzFBSUt5a3pNNnBjY2k2UXNLQW9jWXpGTC01RmUzNmg2RSJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1raDVITlBDQ0pXWm42V1JMalJQdHR5dllaQnNrWlVkU0pmVGlad2NVU2llcXgiLCJpYXQiOjE3MDU4NDM1NzQsIl9zZF9hbGciOiJzaGEtMjU2In0.2iAjaCFcuiHXTfQsrxXo6BghtwzqTrfDmhmarAAJAhY8r9yKXY3d10JY1dry2KnaEYWpq2R786thjdA5BXlPAQ~WyI5MzM3MTM0NzU4NDM3MjYyODY3NTE4NzkiLCJsYW5ndWFnZSIsIlR5cGVTY3JpcHQiXQ~WyIxMTQ3MDA5ODk2Nzc2MDYzOTc1MDUwOTMxIiwidmVyc2lvbiIsIjEuMCJd~',
    format: 'vc+sd-jwt',
    c_nonce: '98b487cb-f6e5-4f9b-b963-ad69b8fe5e29',
    c_nonce_expires_in: 300000,
    notification_id: '1234',
  },
}
