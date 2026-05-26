import type { Kms } from '@credo-ts/core'

export interface DidCommRouting {
  endpoints: string[]
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /**
   * Separate X25519 key for DIDComm V2 key agreement. Stored independently in the KMS
   * (not derived from recipientKey at runtime). Used as the `keyAgreement` verification
   * method in the DID document and for ECDH-ES / ECDH-1PU encryption.
   *
   * When not set, the X25519 key will be derived from `recipientKey` at runtime (legacy behavior).
   */
  keyAgreementKey?: Kms.PublicJwk<Kms.X25519PublicJwk>
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  mediatorId?: string
  /**
   * Mediator DID for v2 (DID-as-endpoint). When set, used as serviceEndpoint URI per DIF spec.
   */
  routingDid?: string
}
