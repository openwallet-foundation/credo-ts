import type { BaseEvent } from '@credo-ts/core'
import type { CredentialState } from './models/CredentialState'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'

export enum CredentialEventTypes {
  CredentialStateChanged = 'CredentialStateChanged',
  RevocationNotificationReceived = 'RevocationNotificationReceived',
}
export interface CredentialStateChangedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.CredentialStateChanged
  payload: {
    credentialRecord: CredentialExchangeRecord
    previousState: CredentialState | null
  }
}

export interface RevocationNotificationReceivedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.RevocationNotificationReceived
  payload: {
    credentialRecord: CredentialExchangeRecord
  }
}
