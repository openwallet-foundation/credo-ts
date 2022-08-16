import type { BaseEvent } from '../../agent/Events'
import type { DidInfo } from '../well-known'
import type { OutOfBandInvitationMessage } from './messages'

export enum OutOfBandEventTypes {
  OutOfBandInvitationReceived = 'OutOfBandInvitationReceived',
}
export interface OutOfBandEvent extends BaseEvent {
  type: typeof OutOfBandEventTypes.OutOfBandInvitationReceived
  payload: {
    message: OutOfBandInvitationMessage
    senderInfo: DidInfo
  }
}
