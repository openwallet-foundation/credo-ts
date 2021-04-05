import type { Verkey } from 'indy-sdk'

export interface InvitationDetails {
  label: string
  recipientKeys: Verkey[]
  serviceEndpoint: string
  routingKeys: Verkey[]
}
