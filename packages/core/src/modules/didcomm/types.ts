import type { Key } from '../../crypto'

export interface ResolvedDidCommService {
  id: string
  serviceEndpoint: string
  recipientKeys: Key[]
  routingKeys: Key[]
}
