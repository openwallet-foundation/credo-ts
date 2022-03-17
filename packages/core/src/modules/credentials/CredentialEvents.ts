import type { BaseEvent } from '../../agent/Events'
import type { CredentialState } from './CredentialState'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'

export enum CredentialEventTypes {
  CredentialStateChanged = 'CredentialStateChanged',
}
export interface CredentialStateChangedEvent extends BaseEvent {
  type: typeof CredentialEventTypes.CredentialStateChanged
  payload: {
    credentialRecord: CredentialExchangeRecord
    previousState: CredentialState | null
  }
}
