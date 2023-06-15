export const mattrLaunchpadJsonLd = {
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

export const waltIdJffJwt = {
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
    credential_issuer: { display: [{ locale: null, name: 'https://jff.walt.id/issuer-api/default' }] },
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
