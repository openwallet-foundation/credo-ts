import type { BaseEvent } from '../../agent/Events'
import type { CredentialState } from './CredentialState'
import type { CredentialRecord } from './repository/CredentialRecord'

export enum CredentialEventTypes {
  CredentialStateChanged = 'CredentialStateChanged',
  CredentialDeleted = 'CredentialDeleted',
  RevocationNotificationReceived = 'RevocationNotificationReceived',
}

export interface CredentialStateChangedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.CredentialStateChanged
  payload: {
    credentialRecord: CredentialRecord
    previousState: CredentialState | null
  }
}
export interface CredentialDeletedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.CredentialDeleted
  payload: {
    credentialRecord: CredentialRecord
  }
}
export interface RevocationNotificationReceivedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.RevocationNotificationReceived
  payload: {
    credentialRecord: CredentialRecord
  }
}
