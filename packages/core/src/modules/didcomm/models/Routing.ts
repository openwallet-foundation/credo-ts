import type { Key } from '../../../crypto'

export interface Routing {
  endpoints: string[]
  recipientKey: Key
  routingKeys: Key[]
  mediatorId?: string
}
