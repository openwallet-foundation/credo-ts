export const PRE_AUTHORIZED_OPENID_CREDENTIAL_OFFER =
  'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Flaunchpad.vii.electron.mattrlabs.io%22%2C%22credentials%22%3A%5B%7B%22credentialDefinition%22%3A%7B%22%40context%22%3A%5B%22some_context%22%5D%2C%22types%22%3A%5B%22type_one%22%5D%7D%7D%5D%2C%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22ABC%22%7D%7D%7D'

export const AUTHORIZED_OPENID_CREDENTIAL_OFFER =
  'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Flaunchpad.vii.electron.mattrlabs.io%22%2C%22credentials%22%3A%5B%7B%22credentialDefinition%22%3A%7B%22%40context%22%3A%5B%22some_context%22%5D%2C%22types%22%3A%5B%22type_one%22%5D%7D%7D%5D%2C%22grants%22%3A%7B%22authorization-code%22%3A%7B%7D%7D%7D'

export const CREDENTIAL_ISSUER_METADATA = {
  credential_issuer: 'https://launchpad.vii.electron.mattrlabs.io',
  authorization_endpoint: 'https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/authorize',
  credential_endpoint: 'https://launchpad.vii.electron.mattrlabs.io/credential',
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
  scopes_supported: ['OpenBadgeCredential', 'AcademicAward', 'LearnerProfile', 'PermanentResidentCard'],
  token_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
  credentials_supported: [
    {
      format: 'ldp_vc',
      id: 'OpenBadgeCredential',
      name: 'JFF x vc-edu PlugFest 2',
      types: ['OpenBadgeCredential'],
      cryptographic_binding_methods_supported: ['did:key', 'did:web', 'did:jwk'],
      cryptographic_suites_supported: ['Ed25519Signature2018'],
    },
    {
      format: 'ldp_vc',
      id: 'AcademicAward',
      name: 'Example Academic Award',
      types: ['AcademicAward'],
      cryptographic_binding_methods_supported: ['did:key', 'did:web', 'did:jwk'],
      cryptographic_suites_supported: ['Ed25519Signature2018'],
    },
    {
      format: 'ldp_vc',
      id: 'LearnerProfile',
      name: 'Digitary Learner Profile',
      types: ['LearnerProfile'],
      cryptographic_binding_methods_supported: ['did:key', 'did:web', 'did:jwk'],
      cryptographic_suites_supported: ['Ed25519Signature2018'],
    },
    {
      format: 'ldp_vc',
      id: 'PermanentResidentCard',
      name: 'Permanent Resident Card',
      types: ['PermanentResidentCard'],
      cryptographic_binding_methods_supported: ['did:key', 'did:web', 'did:jwk'],
      cryptographic_suites_supported: ['Ed25519Signature2018'],
    },
  ],
}

export const ACCESS_TOKEN_RESPONSE = {
  access_token: '7nikUotMQefxn7oRX56R7MDNE7KJTGfwGjOkHzGaUIG',
  expires_in: 3600,
  scope: 'OpenBadgeCredential',
  token_type: 'Bearer',
}

export const CREDENTIAL_REQUEST_RESPONSE = {
  format: 'w3cvc-jsonld',
  credential: {
    type: ['VerifiableCredential', 'VerifiableCredentialExtension', 'OpenBadgeCredential'],
    issuer: {
      id: 'did:web:launchpad.vii.electron.mattrlabs.io',
      name: 'Jobs for the Future (JFF)',
      iconUrl: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/JFF_LogoLockup.png',
      image: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/JFF_LogoLockup.png',
    },
    name: 'JFF x vc-edu PlugFest 2',
    description: "MATTR's submission for JFF Plugfest 2",
    credentialBranding: {
      backgroundColor: '#464c49',
    },
    issuanceDate: '2023-01-25T16:58:06.292Z',
    credentialSubject: {
      id: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
      type: ['AchievementSubject'],
      achievement: {
        id: 'urn:uuid:bd6d9316-f7ae-4073-a1e5-2f7f5bd22922',
        name: 'JFF x vc-edu PlugFest 2 Interoperability',
        type: ['Achievement'],
        image: {
          id: 'https://w3c-ccg.github.io/vc-ed/plugfest-2-2022/images/JFF-VC-EDU-PLUGFEST2-badge-image.png',
          type: 'Image',
        },
        criteria: {
          type: 'Criteria',
          narrative:
            'Solutions providers earned this badge by demonstrating interoperability between multiple providers based on the OBv3 candidate final standard, with some additional required fields. Credential issuers earning this badge successfully issued a credential into at least two wallets.  Wallet implementers earning this badge successfully displayed credentials issued by at least two different credential issuers.',
        },
        description:
          'This credential solution supports the use of OBv3 and w3c Verifiable Credentials and is interoperable with at least two other solutions.  This was demonstrated successfully during JFF x vc-edu PlugFest 2.',
      },
    },
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      {
        '@vocab': 'https://w3id.org/security/undefinedTerm#',
      },
      'https://mattr.global/contexts/vc-extensions/v1',
      'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
      'https://w3c-ccg.github.io/vc-status-rl-2020/contexts/vc-revocation-list-2020/v1.jsonld',
    ],
    credentialStatus: {
      id: 'https://launchpad.vii.electron.mattrlabs.io/core/v1/revocation-lists/b4aa46a0-5539-4a6b-aa03-8f6791c22ce3#49',
      type: 'RevocationList2020Status',
      revocationListIndex: '49',
      revocationListCredential:
        'https://launchpad.vii.electron.mattrlabs.io/core/v1/revocation-lists/b4aa46a0-5539-4a6b-aa03-8f6791c22ce3',
    },
    proof: {
      type: 'Ed25519Signature2018',
      created: '2023-01-25T16:58:07Z',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..PrpRKt60yXOzMNiQY5bELX40F6Svwm-FyQ-Jv02VJDfTTH8GPPByjtOb_n3YfWidQVgySfGQ_H7VmCGjvsU6Aw',
      proofPurpose: 'assertionMethod',
      verificationMethod: 'did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg',
    },
  },
}
