import type { Key } from '../../crypto'
import type { DidDocument } from '../dids/domain/DidDocument'

export interface ResolvedDidCommService {
  id: string
  serviceEndpoint: string
  recipientKeys: Key[]
  routingKeys: Key[]
  routingDidDocuments?: DidDocument[]
}
