import type { Key } from '../dids/domain'

export interface ResolvedDidCommService {
  id: string
  serviceEndpoint: string
  recipientKeys: Key[]
  routingKeys: Key[]
}
