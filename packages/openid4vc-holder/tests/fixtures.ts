export const mattrLaunchpadJsonLd_draft_08 = {
  credentialOffer:
    'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential&pre-authorized_code=krBcsBIlye2T-G4-rHHnRZUCah9uzDKwohJK6ABNvL-',
  getMetadataResponse: {
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
    scopes_supported: ['OpenBadgeCredential', 'AcademicAward', 'LearnerProfile', 'PermanentResidentCard'],
    token_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
    credential_endpoint: 'https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/credential',
    credentials_supported: {
      OpenBadgeCredential: {
        formats: {
          ldp_vc: {
            name: 'JFF x vc-edu PlugFest 2',
            description: "MATTR's submission for JFF Plugfest 2",
            types: ['OpenBadgeCredential'],
            binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['Ed25519Signature2018'],
          },
        },
      },
      AcademicAward: {
        formats: {
          ldp_vc: {
            name: 'Example Academic Award',
            description: 'Microcredential from the MyCreds Network.',
            types: ['AcademicAward'],
            binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['Ed25519Signature2018'],
          },
        },
      },
      LearnerProfile: {
        formats: {
          ldp_vc: {
            name: 'Digitary Learner Profile',
            description: 'Example',
            types: ['LearnerProfile'],
            binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['Ed25519Signature2018'],
          },
        },
      },
      PermanentResidentCard: {
        formats: {
          ldp_vc: {
            name: 'Permanent Resident Card',
            description: 'Government of Kakapo',
            types: ['PermanentResidentCard'],
            binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['Ed25519Signature2018'],
          },
        },
      },
    },
  },

  acquireAccessTokenResponse: {
    access_token: '7nikUotMQefxn7oRX56R7MDNE7KJTGfwGjOkHzGaUIG',
    expires_in: 3600,
    scope: 'OpenBadgeCredential',
    token_type: 'Bearer',
  },
  credentialResponse: {
    format: 'ldp_vc',
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
  },
}

export const waltIdJffJwt_draft_08 = {
  credentialOffer:
    'openid-initiate-issuance://?issuer=https%3A%2F%2Fjff.walt.id%2Fissuer-api%2Fdefault%2Foidc%2F&credential_type=VerifiableId&pre-authorized_code=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI4YmI0NWZiNC0zNDc1LTQ5YzItODVjNy0wYjkxZjY4N2RhNDQiLCJwcmUtYXV0aG9yaXplZCI6dHJ1ZX0.R8nHseZJvU3uVL3Ox-97i1HUnvjZH6wKSWDO_i8D12I&user_pin_required=false',
  getMetadataResponse: {
    authorization_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/fulfillPAR',
    token_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/token',
    pushed_authorization_request_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/par',
    issuer: 'https://jff.walt.id/issuer-api/default',
    jwks_uri: 'https://jff.walt.id/issuer-api/default/oidc',
    grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:pre-authorized_code'],
    request_uri_parameter_supported: true,
    credentials_supported: {
      VerifiableId: {
        display: [{ name: 'VerifiableId' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableId'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableId'],
          },
        },
      },
      VerifiableDiploma: {
        display: [{ name: 'VerifiableDiploma' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableDiploma'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableDiploma'],
          },
        },
      },
      VerifiableVaccinationCertificate: {
        display: [{ name: 'VerifiableVaccinationCertificate' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableVaccinationCertificate'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableVaccinationCertificate'],
          },
        },
      },
      ProofOfResidence: {
        display: [{ name: 'ProofOfResidence' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'ProofOfResidence'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'ProofOfResidence'],
          },
        },
      },
      ParticipantCredential: {
        display: [{ name: 'ParticipantCredential' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'ParticipantCredential'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'ParticipantCredential'],
          },
        },
      },
      Europass: {
        display: [{ name: 'Europass' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'Europass'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'VerifiableAttestation', 'Europass'],
          },
        },
      },
      OpenBadgeCredential: {
        display: [{ name: 'OpenBadgeCredential' }],
        formats: {
          ldp_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: [
              'Ed25519Signature2018',
              'Ed25519Signature2020',
              'EcdsaSecp256k1Signature2019',
              'RsaSignature2018',
              'JsonWebSignature2020',
              'JcsEd25519Signature2020',
            ],
            types: ['VerifiableCredential', 'OpenBadgeCredential'],
          },
          jwt_vc: {
            cryptographic_binding_methods_supported: ['did'],
            cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
            types: ['VerifiableCredential', 'OpenBadgeCredential'],
          },
        },
      },
    },
    credential_issuer: {
      display: [{ locale: null, name: 'https://jff.walt.id/issuer-api/default' }],
    },
    credential_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/credential',
    subject_types_supported: ['public'],
  },

  acquireAccessTokenResponse: {
    access_token: '8bb45fb4-3475-49c2-85c7-0b91f687da44',
    refresh_token: 'WEjORX8NZccRGtRN4yvXFdYE8MeAOaLLmmGlcRbutq4',
    c_nonce: 'cbad6376-f882-44c5-ae88-19bccc0de124',
    id_token:
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI4YmI0NWZiNC0zNDc1LTQ5YzItODVjNy0wYjkxZjY4N2RhNDQifQ.Mca0Ln1AvNlxBJftYc1PZKQBlGdBmrHsFRQSBDoCgD0',
    token_type: 'Bearer',
    expires_in: 300,
  },

  credentialResponse: {
    credential:
      'eyJraWQiOiJkaWQ6andrOmV5SnJkSGtpT2lKUFMxQWlMQ0oxYzJVaU9pSnphV2NpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpYTJsa0lqb2lOMlEyWTJKbU1qUTRPV0l6TkRJM05tSXhOekl4T1RBMU5EbGtNak01TVRnaUxDSjRJam9pUm01RlZWVmhkV1J0T1RsT016QmlPREJxY3poV2REUkJiazk0ZGxKM1dIUm5VbU5MY1ROblFrbDFPQ0lzSW1Gc1p5STZJa1ZrUkZOQkluMCMwIiwidHlwIjoiSldUIiwiYWxnIjoiRWREU0EifQ.eyJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKUFMxQWlMQ0oxYzJVaU9pSnphV2NpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpYTJsa0lqb2lOMlEyWTJKbU1qUTRPV0l6TkRJM05tSXhOekl4T1RBMU5EbGtNak01TVRnaUxDSjRJam9pUm01RlZWVmhkV1J0T1RsT016QmlPREJxY3poV2REUkJiazk0ZGxKM1dIUm5VbU5MY1ROblFrbDFPQ0lzSW1Gc1p5STZJa1ZrUkZOQkluMCIsInN1YiI6ImRpZDprZXk6ekRuYWVpcFdnOURNWFB0OWpjbUFCcWFZUlZLYzE5dFgxeGZCUldGc0pTUG9VZE1udiIsIm5iZiI6MTY4NTM1MDc4OSwiaWF0IjoxNjg1MzUwNzg5LCJ2YyI6eyJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiVmVyaWZpYWJsZUF0dGVzdGF0aW9uIiwiVmVyaWZpYWJsZUlkIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIl0sImlkIjoidXJuOnV1aWQ6NTljZTRhYzItZWM2NS00YjhmLThmOTYtZWE3ODUxMmRmOWQzIiwiaXNzdWVyIjoiZGlkOmp3azpleUpyZEhraU9pSlBTMUFpTENKMWMyVWlPaUp6YVdjaUxDSmpjbllpT2lKRlpESTFOVEU1SWl3aWEybGtJam9pTjJRMlkySm1NalE0T1dJek5ESTNObUl4TnpJeE9UQTFORGxrTWpNNU1UZ2lMQ0o0SWpvaVJtNUZWVlZoZFdSdE9UbE9NekJpT0RCcWN6aFdkRFJCYms5NGRsSjNXSFJuVW1OTGNUTm5Ra2wxT0NJc0ltRnNaeUk2SWtWa1JGTkJJbjAiLCJpc3N1YW5jZURhdGUiOiIyMDIzLTA1LTI5VDA4OjU5OjQ5WiIsImlzc3VlZCI6IjIwMjMtMDUtMjlUMDg6NTk6NDlaIiwidmFsaWRGcm9tIjoiMjAyMy0wNS0yOVQwODo1OTo0OVoiLCJjcmVkZW50aWFsU2NoZW1hIjp7ImlkIjoiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3dhbHQtaWQvd2FsdGlkLXNzaWtpdC12Y2xpYi9tYXN0ZXIvc3JjL3Rlc3QvcmVzb3VyY2VzL3NjaGVtYXMvVmVyaWZpYWJsZUlkLmpzb24iLCJ0eXBlIjoiRnVsbEpzb25TY2hlbWFWYWxpZGF0b3IyMDIxIn0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6RG5hZWlwV2c5RE1YUHQ5amNtQUJxYVlSVktjMTl0WDF4ZkJSV0ZzSlNQb1VkTW52IiwiY3VycmVudEFkZHJlc3MiOlsiMSBCb3VsZXZhcmQgZGUgbGEgTGliZXJ0w6ksIDU5ODAwIExpbGxlIl0sImRhdGVPZkJpcnRoIjoiMTk5My0wNC0wOCIsImZhbWlseU5hbWUiOiJET0UiLCJmaXJzdE5hbWUiOiJKYW5lIiwiZ2VuZGVyIjoiRkVNQUxFIiwibmFtZUFuZEZhbWlseU5hbWVBdEJpcnRoIjoiSmFuZSBET0UiLCJwZXJzb25hbElkZW50aWZpZXIiOiIwOTA0MDA4MDg0SCIsInBsYWNlT2ZCaXJ0aCI6IkxJTExFLCBGUkFOQ0UifSwiZXZpZGVuY2UiOlt7ImRvY3VtZW50UHJlc2VuY2UiOlsiUGh5c2ljYWwiXSwiZXZpZGVuY2VEb2N1bWVudCI6WyJQYXNzcG9ydCJdLCJzdWJqZWN0UHJlc2VuY2UiOiJQaHlzaWNhbCIsInR5cGUiOlsiRG9jdW1lbnRWZXJpZmljYXRpb24iXSwidmVyaWZpZXIiOiJkaWQ6ZWJzaToyQTlCWjlTVWU2QmF0YWNTcHZzMVY1Q2RqSHZMcFE3YkVzaTJKYjZMZEhLblF4YU4ifV19LCJqdGkiOiJ1cm46dXVpZDo1OWNlNGFjMi1lYzY1LTRiOGYtOGY5Ni1lYTc4NTEyZGY5ZDMifQ.6Wn8X2tEQJ9CmX3-meCxDuGmevRdtivnjVkGPXzfnJ-1M6AU4SFxxon0JmMjdmO_h4P9sCEe9RTtyTJou2yeCA',
    format: 'jwt_vc',
  },
}

// This object is MANUALLY converted and should be updated when we have actual test vectors
export const waltIdJffJwt_draft_11 = {
  credentialOffer:
    'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fjff.walt.id%2Fissuer-api%2Fdefault%2Foidc%22%2C%22credentials%22%3A%5B%22VerifiableId%22%2C%20%22VerifiableDiploma%22%5D%2C%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22ABC%22%7D%7D%7D',
  getMetadataResponse: {
    authorization_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/fulfillPAR',
    token_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/token',
    pushed_authorization_request_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/par',
    credential_issuer: 'https://jff.walt.id/issuer-api/default',
    jwks_uri: 'https://jff.walt.id/issuer-api/default/oidc',
    credential_endpoint: 'https://jff.walt.id/issuer-api/default/oidc/credential',
    subject_types_supported: ['public'],
    grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:pre-authorized_code'],
    request_uri_parameter_supported: true,
    credentials_supported: [
      {
        id: 'VerifiableId',
        format: 'jwt_vc_json',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['ES256', 'ES256K', 'EdDSA', 'RS256', 'PS256'],
        types: ['VerifiableCredential', 'VerifiableId'],
      },
      {
        id: 'VerifiableDiploma',
        display: [{ name: 'VerifiableDiploma' }],
        format: 'ldp_vc',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: [
          'Ed25519Signature2018',
          'Ed25519Signature2020',
          'EcdsaSecp256k1Signature2019',
          'RsaSignature2018',
          'JsonWebSignature2020',
          'JcsEd25519Signature2020',
        ],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableDiploma'],
      },
      {
        id: 'VerifiableVaccinationCertificate',
        display: [{ name: 'VerifiableVaccinationCertificate' }],
        format: 'ldp_vc',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: [
          'Ed25519Signature2018',
          'Ed25519Signature2020',
          'EcdsaSecp256k1Signature2019',
          'RsaSignature2018',
          'JsonWebSignature2020',
          'JcsEd25519Signature2020',
        ],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'VerifiableVaccinationCertificate'],
      },
      {
        id: 'ProofOfResidence',
        display: [{ name: 'ProofOfResidence' }],
        format: 'ldp_vc',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: [
          'Ed25519Signature2018',
          'Ed25519Signature2020',
          'EcdsaSecp256k1Signature2019',
          'RsaSignature2018',
          'JsonWebSignature2020',
          'JcsEd25519Signature2020',
        ],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'ProofOfResidence'],
      },
      {
        id: 'ParticipantCredential',
        format: 'ldp_vc',
        display: [{ name: 'ParticipantCredential' }],
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: [
          'Ed25519Signature2018',
          'Ed25519Signature2020',
          'EcdsaSecp256k1Signature2019',
          'RsaSignature2018',
          'JsonWebSignature2020',
          'JcsEd25519Signature2020',
        ],
        types: ['VerifiableCredential', 'ParticipantCredential'],
      },
      {
        id: 'Europass',
        display: [{ name: 'Europass' }],
        format: 'ldp_vc',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: [
          'Ed25519Signature2018',
          'Ed25519Signature2020',
          'EcdsaSecp256k1Signature2019',
          'RsaSignature2018',
          'JsonWebSignature2020',
          'JcsEd25519Signature2020',
        ],
        types: ['VerifiableCredential', 'VerifiableAttestation', 'Europass'],
      },
      {
        id: 'OpenBadgeCredential',
        display: [{ name: 'OpenBadgeCredential' }],
        format: 'ldp_vc',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: [
          'Ed25519Signature2018',
          'Ed25519Signature2020',
          'EcdsaSecp256k1Signature2019',
          'RsaSignature2018',
          'JsonWebSignature2020',
          'JcsEd25519Signature2020',
        ],
        types: ['VerifiableCredential', 'OpenBadgeCredential'],
      },
    ],
  },

  acquireAccessTokenResponse: {
    access_token: '8bb45fb4-3475-49c2-85c7-0b91f687da44',
    refresh_token: 'WEjORX8NZccRGtRN4yvXFdYE8MeAOaLLmmGlcRbutq4',
    c_nonce: 'cbad6376-f882-44c5-ae88-19bccc0de124',
    id_token:
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI4YmI0NWZiNC0zNDc1LTQ5YzItODVjNy0wYjkxZjY4N2RhNDQifQ.Mca0Ln1AvNlxBJftYc1PZKQBlGdBmrHsFRQSBDoCgD0',
    token_type: 'Bearer',
    expires_in: 300,
  },

  credentialResponse: {
    credential:
      'eyJraWQiOiJkaWQ6andrOmV5SnJkSGtpT2lKUFMxQWlMQ0oxYzJVaU9pSnphV2NpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpYTJsa0lqb2lOMlEyWTJKbU1qUTRPV0l6TkRJM05tSXhOekl4T1RBMU5EbGtNak01TVRnaUxDSjRJam9pUm01RlZWVmhkV1J0T1RsT016QmlPREJxY3poV2REUkJiazk0ZGxKM1dIUm5VbU5MY1ROblFrbDFPQ0lzSW1Gc1p5STZJa1ZrUkZOQkluMCMwIiwidHlwIjoiSldUIiwiYWxnIjoiRWREU0EifQ.eyJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKUFMxQWlMQ0oxYzJVaU9pSnphV2NpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpYTJsa0lqb2lOMlEyWTJKbU1qUTRPV0l6TkRJM05tSXhOekl4T1RBMU5EbGtNak01TVRnaUxDSjRJam9pUm01RlZWVmhkV1J0T1RsT016QmlPREJxY3poV2REUkJiazk0ZGxKM1dIUm5VbU5MY1ROblFrbDFPQ0lzSW1Gc1p5STZJa1ZrUkZOQkluMCIsInN1YiI6ImRpZDprZXk6ekRuYWVpcFdnOURNWFB0OWpjbUFCcWFZUlZLYzE5dFgxeGZCUldGc0pTUG9VZE1udiIsIm5iZiI6MTY4NTM1MDc4OSwiaWF0IjoxNjg1MzUwNzg5LCJ2YyI6eyJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiVmVyaWZpYWJsZUF0dGVzdGF0aW9uIiwiVmVyaWZpYWJsZUlkIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIl0sImlkIjoidXJuOnV1aWQ6NTljZTRhYzItZWM2NS00YjhmLThmOTYtZWE3ODUxMmRmOWQzIiwiaXNzdWVyIjoiZGlkOmp3azpleUpyZEhraU9pSlBTMUFpTENKMWMyVWlPaUp6YVdjaUxDSmpjbllpT2lKRlpESTFOVEU1SWl3aWEybGtJam9pTjJRMlkySm1NalE0T1dJek5ESTNObUl4TnpJeE9UQTFORGxrTWpNNU1UZ2lMQ0o0SWpvaVJtNUZWVlZoZFdSdE9UbE9NekJpT0RCcWN6aFdkRFJCYms5NGRsSjNXSFJuVW1OTGNUTm5Ra2wxT0NJc0ltRnNaeUk2SWtWa1JGTkJJbjAiLCJpc3N1YW5jZURhdGUiOiIyMDIzLTA1LTI5VDA4OjU5OjQ5WiIsImlzc3VlZCI6IjIwMjMtMDUtMjlUMDg6NTk6NDlaIiwidmFsaWRGcm9tIjoiMjAyMy0wNS0yOVQwODo1OTo0OVoiLCJjcmVkZW50aWFsU2NoZW1hIjp7ImlkIjoiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3dhbHQtaWQvd2FsdGlkLXNzaWtpdC12Y2xpYi9tYXN0ZXIvc3JjL3Rlc3QvcmVzb3VyY2VzL3NjaGVtYXMvVmVyaWZpYWJsZUlkLmpzb24iLCJ0eXBlIjoiRnVsbEpzb25TY2hlbWFWYWxpZGF0b3IyMDIxIn0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6RG5hZWlwV2c5RE1YUHQ5amNtQUJxYVlSVktjMTl0WDF4ZkJSV0ZzSlNQb1VkTW52IiwiY3VycmVudEFkZHJlc3MiOlsiMSBCb3VsZXZhcmQgZGUgbGEgTGliZXJ0w6ksIDU5ODAwIExpbGxlIl0sImRhdGVPZkJpcnRoIjoiMTk5My0wNC0wOCIsImZhbWlseU5hbWUiOiJET0UiLCJmaXJzdE5hbWUiOiJKYW5lIiwiZ2VuZGVyIjoiRkVNQUxFIiwibmFtZUFuZEZhbWlseU5hbWVBdEJpcnRoIjoiSmFuZSBET0UiLCJwZXJzb25hbElkZW50aWZpZXIiOiIwOTA0MDA4MDg0SCIsInBsYWNlT2ZCaXJ0aCI6IkxJTExFLCBGUkFOQ0UifSwiZXZpZGVuY2UiOlt7ImRvY3VtZW50UHJlc2VuY2UiOlsiUGh5c2ljYWwiXSwiZXZpZGVuY2VEb2N1bWVudCI6WyJQYXNzcG9ydCJdLCJzdWJqZWN0UHJlc2VuY2UiOiJQaHlzaWNhbCIsInR5cGUiOlsiRG9jdW1lbnRWZXJpZmljYXRpb24iXSwidmVyaWZpZXIiOiJkaWQ6ZWJzaToyQTlCWjlTVWU2QmF0YWNTcHZzMVY1Q2RqSHZMcFE3YkVzaTJKYjZMZEhLblF4YU4ifV19LCJqdGkiOiJ1cm46dXVpZDo1OWNlNGFjMi1lYzY1LTRiOGYtOGY5Ni1lYTc4NTEyZGY5ZDMifQ.6Wn8X2tEQJ9CmX3-meCxDuGmevRdtivnjVkGPXzfnJ-1M6AU4SFxxon0JmMjdmO_h4P9sCEe9RTtyTJou2yeCA',
    format: 'jwt_vc',
  },

  jsonLdCredentialResponse: {
    format: 'ldp_vc',
    credential: {
      type: ['VerifiableCredential', 'PermanentResidentCard'],
      issuer: {
        id: 'did:web:launchpad.vii.electron.mattrlabs.io',
        name: 'Government of Kakapo',
        logoUrl: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/logo.svg',
        iconUrl: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/icon.svg',
        image: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/icon.svg',
      },
      name: 'Permanent Resident Card',
      description: 'Government of Kakapo',
      credentialBranding: {
        backgroundColor: '#3a2d2d',
        watermarkImageUrl: 'https://static.mattr.global/credential-assets/government-of-kakapo/web/watermark@2x.png',
      },
      issuanceDate: '2023-10-17T14:27:36.909Z',
      credentialSubject: {
        id: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
        type: ['PermanentResident', 'Person'],
        image:
          'data:image/png;base64,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',
        gender: 'Male',
        birthDate: '1958-08-17',
        givenName: 'Louis',
        lprNumber: '1958-08-17',
        familyName: 'Pasteur',
        lprCategory: 'C09',
        birthCountry: 'France',
        residentSince: '2015-01-01',
        commuterClassification: 'C1',
      },
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://mattr.global/contexts/vc-extensions/v2',
        'https://w3id.org/citizenship/v1',
        'https://w3id.org/vc-revocation-list-2020/v1',
      ],
      credentialStatus: {
        id: 'https://launchpad.vii.electron.mattrlabs.io/core/v1/revocation-lists/7bc7c021-56ee-445a-9143-fd79629df2aa#657',
        type: 'RevocationList2020Status',
        revocationListIndex: '657',
        revocationListCredential:
          'https://launchpad.vii.electron.mattrlabs.io/core/v1/revocation-lists/7bc7c021-56ee-445a-9143-fd79629df2aa',
      },
      proof: {
        type: 'Ed25519Signature2018',
        created: '2023-10-17T14:27:38Z',
        jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..BaAHvbYzaFHp5rcqBChGVDd1gBpb9ezD4Rxn-Ev7uP1Jj71OfpcLH-oivuV90OGxgghaRwPe6rnBjwwo-RBjDg',
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg',
      },
    },
  },
}
