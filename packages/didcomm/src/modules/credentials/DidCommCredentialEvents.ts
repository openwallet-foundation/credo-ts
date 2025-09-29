import type { BaseEvent } from '@credo-ts/core'
import type { DidCommCredentialState } from './models/DidCommCredentialState'
import type { DidCommCredentialExchangeRecord } from './repository/DidCommCredentialExchangeRecord'

export enum DidCommCredentialEventTypes {
  DidCommCredentialStateChanged = 'DidCommCredentialStateChanged',
  DidCommRevocationNotificationReceived = 'DidCommRevocationNotificationReceived',
}
export interface DidCommCredentialStateChangedEvent extends BaseEvent {
  type: typeof DidCommCredentialEventTypes.DidCommCredentialStateChanged
  payload: {
    credentialExchangeRecord: DidCommCredentialExchangeRecord
    previousState: DidCommCredentialState | null
  }
}

export interface DidCommRevocationNotificationReceivedEvent extends BaseEvent {
  type: typeof DidCommCredentialEventTypes.DidCommRevocationNotificationReceived
  payload: {
    credentialExchangeRecord: DidCommCredentialExchangeRecord
  }
}
