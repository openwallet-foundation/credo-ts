import type { ShareContactState } from './ShareContactState'

export interface ShareContactRequest {
  contactDid: string
  state: ShareContactState
  threadId: string
  label?: string
}
