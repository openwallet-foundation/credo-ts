import type { Kms } from '@credo-ts/core'

export interface Routing {
  endpoints: string[]
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  mediatorId?: string
}
