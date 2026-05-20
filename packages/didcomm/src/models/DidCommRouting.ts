import type { Kms } from '@credo-ts/core'

export interface DidCommRouting {
  endpoints: string[]
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  mediatorId?: string
  /**
   * Mediator DID for v2 (DID-as-endpoint). When set, used as serviceEndpoint URI per DIF spec.
   */
  routingDid?: string
}
