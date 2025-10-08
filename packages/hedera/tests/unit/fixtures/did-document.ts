import { type ParsedDid, parseDid } from '@credo-ts/core'
import { type DIDResolutionMetadata, type JsonLdDIDDocument } from '@hiero-did-sdk/core'

export const did = 'did:hedera:testnet:4BGybF4yCeYNi8RFVowK3zHc1xs2psYdkbiEvETrp3HL_0.0.1000001'
export const parsedDid: ParsedDid = parseDid(did)

export const didDocument: Required<Pick<JsonLdDIDDocument, 'service'>> & JsonLdDIDDocument = {
  '@context': [
    'https://w3.org/ns/did/v1',
    'https://w3id.org/security/suites/ed25519-2018/v1',
    'https://w3id.org/security/suites/ed25519-2020/v1',
  ],
  id: did,
  controller: did,
  service: [{ id: 'mock-service', type: 'MockService', serviceEndpoint: 'https://example.com/mock-service/' }],
  verificationMethod: [
    {
      id: `${did}#did-root-key`,
      controller: did,
      type: 'Ed25519VerificationKey2020' as const,
      publicKeyMultibase: 'z6MkhdY2BVKQYC2qpdFxBNu9u5qbqY8tEknzScdAkWRsjG4i',
    },
  ],
}

export const didResolutionMetadata: DIDResolutionMetadata = {
  contentType: 'application/ld+json;profile="https://w3id.org/did-resolution"',
}
