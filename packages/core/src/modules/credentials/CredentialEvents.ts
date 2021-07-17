import type { BaseEvent } from '../../agent/Events'
import type { CredentialState } from './CredentialState'
import type { CredentialRecord } from './repository/CredentialRecord'

export enum CredentialEventTypes {
  CredentialStateChanged = 'CredentialStateChanged',
}
export interface CredentialStateChangedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.CredentialStateChanged
  payload: {
    credentialRecord: CredentialRecord
    previousState: CredentialState | null
  }
}
