import type { Kms } from '@credo-ts/core'

export interface DidCommRouting {
  endpoints: string[]
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  mediatorId?: string
}
