import type { Kms } from '@credo-ts/core'
import type { DidCommV2KeyAgreementJwk } from '../v2/types'

export interface DidCommRouting {
  endpoints: string[]
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /**
   * Separate keyAgreement key for DIDComm V2 (X25519 or P-256). Stored independently in the KMS
   * (not derived from recipientKey at runtime). Used as the `keyAgreement` verification
   * method in the DID document and for ECDH-ES / ECDH-1PU encryption.
   *
   * When not set, an X25519 key is derived from `recipientKey` at runtime via the Ed25519
   * birational map (X25519 only; no P-256 fallback).
   */
  keyAgreementKey?: DidCommV2KeyAgreementJwk
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  mediatorId?: string
  /**
   * Mediator DID for v2 (DID-as-endpoint). When set, used as serviceEndpoint URI per DIF spec.
   */
  routingDid?: string
}
