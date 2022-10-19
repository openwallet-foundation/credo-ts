import type { ShareContactState } from './ShareContactState'

export interface ShareContactRequest {
  contactDid: string
  state: ShareContactState
  thid: string
  label?: string
}
