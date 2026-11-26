import type { Kms } from '@credo-ts/core'
import type { DidCommV2KeyAgreementJwk } from '../v2/types'

export interface DidCommRouting {
  endpoints: string[]
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /**
   * Ed25519 routing keys for Coordinate Mediation 1.0 or for unmediated routing. Empty with
   * Coordinate Mediation 2.0, where `routingDid` carries the route to the mediator.
   */
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  mediatorId?: string
  /**
   * Separate keyAgreement key for DIDComm v2 (X25519, P-256 or P-384), stored independently in the KMS.
   * Used as the `keyAgreement` verification method in the DID document and for ECDH-ES / ECDH-1PU.
   * Only set when the agent supports DIDComm v2.
   */
  keyAgreementKey?: DidCommV2KeyAgreementJwk
  /**
   * Routing DID of a Coordinate Mediation 2.0 mediator. DIDComm v2 services use it as their
   * service endpoint, and DIDComm v1 services resolve it to the mediator endpoint and routing keys.
   */
  routingDid?: string
  /**
   * Record the routing keys as created for the connection or out-of-band record that uses this routing, so deleting
   * that record with `deleteAssociatedKeys` deletes them, also when another record still uses the keys. Only set it on
   * routing you use for one record.
   *
   * @default false
   */
  deleteWithRecord?: boolean
}
