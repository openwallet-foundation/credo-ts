import type { Kms } from '@credo-ts/core'
import type { DidCommV2KeyAgreementJwk } from '../v2/types'

export interface DidCommRoutingBase {
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
  mediatorId?: string
}

/** Coordinate Mediation 1.0 or unmediated: endpoints + Ed25519 routing keys. */
export interface DidCommV1Routing extends DidCommRoutingBase {
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  routingDid?: never
}

/** Coordinate Mediation 2.0: mediator routing DID used as the service endpoint. */
export interface DidCommV2Routing extends DidCommRoutingBase {
  routingDid: string
  routingKeys?: never
}

export type DidCommRouting = DidCommV1Routing | DidCommV2Routing
