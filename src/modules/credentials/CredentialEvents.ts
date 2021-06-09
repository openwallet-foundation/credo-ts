import { BaseEvent } from '../../agent/Events'

import { CredentialState } from './CredentialState'
import { CredentialRecord } from './repository/CredentialRecord'

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
