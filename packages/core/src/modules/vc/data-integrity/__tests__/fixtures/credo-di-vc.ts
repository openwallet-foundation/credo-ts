export const CredoDidKeyDiVc = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  id: 'urn:uuid:ea52d95f-31a7-4c3b-a965-1f4f4f2b05f1',
  type: ['VerifiableCredential', 'ExampleCredential'],
  issuer: 'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1',
  validFrom: '2025-01-01T00:00:00Z',
  credentialSubject: {
    id: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
    name: 'Jane Doe',
  },
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod:
      'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1#z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1',
    proofPurpose: 'assertionMethod',
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    proofValue: 'z99eUso3aSbE9tqGSTXzo3TLfKb9RkMTURrHKQ1K7Zh3BbeqPevr5E1iCbpTjqHuTFLtfxTTD5ekfVuZFzQyEQf8',
  },
} as const

// Mirror compact JWT fixture style with a canonical encoded DI VC payload.
export const CredoDidKeyDiVcEncoded = JSON.stringify(CredoDidKeyDiVc)

export const CredoDidKeyDiVp = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiablePresentation'],
  id: 'urn:fixture:nested-di-vp-leaf',
  holder: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
  verifiableCredential: [
    {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: 'urn:uuid:ea52d95f-31a7-4c3b-a965-1f4f4f2b05f1',
      type: ['VerifiableCredential', 'ExampleCredential'],
      issuer: 'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1',
      validFrom: '2025-01-01T00:00:00Z',
      credentialSubject: {
        id: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
        name: 'Jane Doe',
      },
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod:
          'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1#z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1',
        proofPurpose: 'assertionMethod',
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        proofValue: 'z99eUso3aSbE9tqGSTXzo3TLfKb9RkMTURrHKQ1K7Zh3BbeqPevr5E1iCbpTjqHuTFLtfxTTD5ekfVuZFzQyEQf8',
      },
    },
  ],
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod:
      'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1#z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1',
    proofPurpose: 'authentication',
    challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
    domain: 'example.com',
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    proofValue: 'z99eUso3aSbE9tqGSTXzo3TLfKb9RkMTURrHKQ1K7Zh3BbeqPevr5E1iCbpTjqHuTFLtfxTTD5ekfVuZFzQyEQf8',
  },
} as const

export const CredoDidKeyDiExampleCredentialToSign = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiableCredential', 'ExampleCredential'],
  issuer: 'https://example.org/issuer',
  credentialSubject: {
    id: 'did:example:subject',
    name: 'Jane Doe',
  },
} as const
