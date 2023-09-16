import type { Feature } from '../../../../../agent/models'

export interface V2DisclosuresMessageOptions {
  id?: string
  threadId?: string
  features?: Feature[]
}
