/**
 * Credentials and presentations created by Veramo (@veramo/credential-w3c and @veramo/credential-ld 6.x, with the
 * Veramo Ed25519Signature2018 and Ed25519Signature2020 suites), the stack Studio runs, plus the DID documents of the
 * issuers and holders. The JSON-LD ones define the claim they carry with an inline context, as Credo's strict
 * verification requires. Veramo verifies all of them, and rejects the ones with a changed claim.
 */
export const VERAMO_INTEROP_VECTORS = {
  didDocuments: {
    'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ':
      {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
        id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ',
        verificationMethod: [
          {
            id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ#0',
            type: 'JsonWebKey2020',
            controller:
              'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ',
            publicKeyJwk: {
              kty: 'OKP',
              crv: 'Ed25519',
              x: 'RRzbG7B7904pG8fTVBZgm8UzThdyzpDuoNyILBifvWo',
            },
          },
        ],
        authentication: [
          'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ#0',
        ],
        assertionMethod: [
          'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ#0',
        ],
        capabilityInvocation: [
          'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ#0',
        ],
        capabilityDelegation: [
          'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ#0',
        ],
        keyAgreement: [],
      },
    'did:example:ed201866c15ed3': {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
      id: 'did:example:ed201866c15ed3',
      verificationMethod: [
        {
          id: 'did:example:ed201866c15ed3#key-1',
          type: 'Ed25519VerificationKey2018',
          controller: 'did:example:ed201866c15ed3',
          publicKeyBase58: 'Fda2z6KmTzGkGnAAjJPow43taysFz22GT7AistEfBVcD',
        },
      ],
      authentication: ['did:example:ed201866c15ed3#key-1'],
      assertionMethod: ['did:example:ed201866c15ed3#key-1'],
      capabilityInvocation: ['did:example:ed201866c15ed3#key-1'],
      capabilityDelegation: ['did:example:ed201866c15ed3#key-1'],
      keyAgreement: [],
    },
    'did:example:ed20203409d762': {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
      id: 'did:example:ed20203409d762',
      verificationMethod: [
        {
          id: 'did:example:ed20203409d762#key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:example:ed20203409d762',
          publicKeyMultibase: 'z6MkfTWtTTSySbvYymyRDbC4LdYmWSNY9qyPx8yzUduuTrMy',
          '@context': 'https://w3id.org/security/suites/ed25519-2020/v1',
        },
      ],
      authentication: ['did:example:ed20203409d762#key-1'],
      assertionMethod: ['did:example:ed20203409d762#key-1'],
      capabilityInvocation: ['did:example:ed20203409d762#key-1'],
      capabilityDelegation: ['did:example:ed20203409d762#key-1'],
      keyAgreement: [],
    },
  },
  cases: {
    jwtVc: {
      credentialSubject: {
        name: 'Alice',
        id: 'did:example:subject',
      },
      issuer: {
        id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ',
      },
      type: ['VerifiableCredential'],
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      issuanceDate: '2026-01-01T00:00:00.000Z',
      proof: {
        type: 'JwtProof2020',
        jwt: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOiJBbGljZSJ9fSwic3ViIjoiZGlkOmV4YW1wbGU6c3ViamVjdCIsIm5iZiI6MTc2NzIyNTYwMCwiaXNzIjoiZGlkOmp3azpleUpyZEhraU9pSlBTMUFpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpZUNJNklsSlNlbUpITjBJM09UQTBjRWM0WmxSV1FscG5iVGhWZWxSb1pIbDZjRVIxYjA1NVNVeENhV1oyVjI4aWZRIn0.JAOr7ctebVLZXGBzJHHJeZdqt7OcweTzNDJfW_SUQULnzp72Oxn5Z6rjayZx6v-pKzjONGE3fL7tGYhmtiuGBA',
      },
    },
    jwtVp: {
      challenge: 'challenge-1',
      domain: 'example.com',
      presentation: {
        nonce: 'challenge-1',
        verifiableCredential: [
          {
            credentialSubject: {
              name: 'Alice',
              id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ',
            },
            issuer: {
              id: 'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ',
            },
            type: ['VerifiableCredential'],
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            issuanceDate: '2026-01-01T00:00:00.000Z',
            proof: {
              type: 'JwtProof2020',
              jwt: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOiJBbGljZSJ9fSwic3ViIjoiZGlkOmp3azpleUpyZEhraU9pSlBTMUFpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpZUNJNklsSlNlbUpITjBJM09UQTBjRWM0WmxSV1FscG5iVGhWZWxSb1pIbDZjRVIxYjA1NVNVeENhV1oyVjI4aWZRIiwibmJmIjoxNzY3MjI1NjAwLCJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKUFMxQWlMQ0pqY25ZaU9pSkZaREkxTlRFNUlpd2llQ0k2SWxKU2VtSkhOMEkzT1RBMGNFYzRabFJXUWxwbmJUaFZlbFJvWkhsNmNFUjFiMDU1U1V4Q2FXWjJWMjhpZlEifQ.bh0V_7hr0fu3EzWaVi_2R2ceGnYUJbIepZLL-h1XvnViSFd83X7ftmJoapl3VGOdbn0sMqSv6z8_fEmT1m1gDQ',
            },
          },
        ],
        holder:
          'did:jwk:eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlJSemJHN0I3OTA0cEc4ZlRWQlpnbThVelRoZHl6cER1b055SUxCaWZ2V28ifQ',
        verifier: ['example.com'],
        type: ['VerifiablePresentation'],
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        issuanceDate: '2026-11-12T09:39:51.000Z',
        proof: {
          type: 'JwtProof2020',
          jwt: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2cCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVQcmVzZW50YXRpb24iXSwidmVyaWZpYWJsZUNyZWRlbnRpYWwiOlsiZXlKaGJHY2lPaUpGWkVSVFFTSXNJblI1Y0NJNklrcFhWQ0o5LmV5SjJZeUk2ZXlKQVkyOXVkR1Y0ZENJNld5Sm9kSFJ3Y3pvdkwzZDNkeTUzTXk1dmNtY3ZNakF4T0M5amNtVmtaVzUwYVdGc2N5OTJNU0pkTENKMGVYQmxJanBiSWxabGNtbG1hV0ZpYkdWRGNtVmtaVzUwYVdGc0lsMHNJbU55WldSbGJuUnBZV3hUZFdKcVpXTjBJanA3SW01aGJXVWlPaUpCYkdsalpTSjlmU3dpYzNWaUlqb2laR2xrT21wM2F6cGxlVXB5WkVocmFVOXBTbEJUTVVGcFRFTkthbU51V1dsUGFVcEdXa1JKTVU1VVJUVkphWGRwWlVOSk5rbHNTbE5sYlVwSVRqQkpNMDlVUVRCalJXTTBXbXhTVjFGc2NHNWlWR2hXWld4U2IxcEliRFpqUlZJeFlqQTFOVk5WZUVOaFYxb3lWakk0YVdaUklpd2libUptSWpveE56WTNNakkxTmpBd0xDSnBjM01pT2lKa2FXUTZhbmRyT21WNVNuSmtTR3RwVDJsS1VGTXhRV2xNUTBwcVkyNVphVTlwU2taYVJFa3hUbFJGTlVscGQybGxRMGsyU1d4S1UyVnRTa2hPTUVrelQxUkJNR05GWXpSYWJGSlhVV3h3Ym1KVWFGWmxiRkp2V2toc05tTkZVakZpTURVMVUxVjRRMkZYV2pKV01qaHBabEVpZlEuYmgwVl83aHIwZnUzRXpXYVZpXzJSMmNlR25ZVUpiSWVwWkxMLWgxWHZuVmlTRmQ4M1g3ZnRtSm9hcGwzVkdPZGJuMHNNcVN2Nno4X2ZFbVQxbTFnRFEiXX0sIm5iZiI6MTc5NDQ3NjM5MSwiaXNzIjoiZGlkOmp3azpleUpyZEhraU9pSlBTMUFpTENKamNuWWlPaUpGWkRJMU5URTVJaXdpZUNJNklsSlNlbUpITjBJM09UQTBjRWM0WmxSV1FscG5iVGhWZWxSb1pIbDZjRVIxYjA1NVNVeENhV1oyVjI4aWZRIiwibm9uY2UiOiJjaGFsbGVuZ2UtMSIsImF1ZCI6WyJleGFtcGxlLmNvbSJdfQ.Gdi1xT4aoycMEBWJ57K1UHsEnHt7eEhP_eGJ4RftSPePhvkrravwT792NlRoA-xjNrJBxZGmWLWuxv3bimCiBQ',
        },
      },
    },
    ldp2018Vc: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        {
          name: 'https://schema.org/name',
        },
      ],
      type: ['VerifiableCredential'],
      issuer: {
        id: 'did:example:ed201866c15ed3',
      },
      issuanceDate: '2026-01-01T00:00:00Z',
      credentialSubject: {
        id: 'did:example:subject',
        name: 'Alice',
      },
      proof: {
        type: 'Ed25519Signature2018',
        created: '2026-11-12T09:39:51Z',
        verificationMethod: 'did:example:ed201866c15ed3#key-1',
        proofPurpose: 'assertionMethod',
        jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..8pYDBUmVz2HRikJlR6-Ad-jGbLgP8oInFkmsU3PTyMMSUOJkEXXWmGKLFa9_T7OwD-ytjLn47pw3UtN0aCw_Ag',
      },
    },
    ldp2020Vc: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        {
          name: 'https://schema.org/name',
        },
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      type: ['VerifiableCredential'],
      issuer: {
        id: 'did:example:ed20203409d762',
      },
      issuanceDate: '2026-01-01T00:00:00Z',
      credentialSubject: {
        id: 'did:example:subject',
        name: 'Alice',
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: '2026-11-12T09:39:51Z',
        verificationMethod: 'did:example:ed20203409d762#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z5sS8QbM3gLXr15kt5Fkx8TpQTFr1R5sMzUiiupqY71NWnffh1caQDPVBcA6NmVBxbWAAE57Wi5y9yZVfdJR1wNZc',
      },
    },
    ldp2018Vp: {
      challenge: 'challenge-2',
      domain: 'example.com',
      presentation: {
        holder: 'did:example:ed201866c15ed3',
        verifiableCredential: [
          {
            '@context': [
              'https://www.w3.org/2018/credentials/v1',
              {
                name: 'https://schema.org/name',
              },
            ],
            type: ['VerifiableCredential'],
            issuer: {
              id: 'did:example:ed201866c15ed3',
            },
            issuanceDate: '2026-01-01T00:00:00Z',
            credentialSubject: {
              id: 'did:example:ed201866c15ed3',
              name: 'Alice',
            },
            proof: {
              type: 'Ed25519Signature2018',
              created: '2026-11-12T09:39:51Z',
              verificationMethod: 'did:example:ed201866c15ed3#key-1',
              proofPurpose: 'assertionMethod',
              jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..ZGlJWlJJSXBn7nD7gW_Gs2O1llwazhUzDWe6q57V4C4LMgDiM1IrG7H4nu4X8nbAMZjG3n7-_XejW9vqmQ-iCA',
            },
          },
        ],
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        proof: {
          type: 'Ed25519Signature2018',
          created: '2026-11-12T09:39:51Z',
          verificationMethod: 'did:example:ed201866c15ed3#key-1',
          proofPurpose: 'authentication',
          challenge: 'challenge-2',
          domain: 'example.com',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..rn-sQvCP4hN9nWoIA5KPmYMkDgctjH-eA5AXqcMrbN7VW7BcoShoAuUBtiZtiVxUIQPEoVHgwCMX6bHNeA_5AQ',
        },
      },
    },
  },
}
