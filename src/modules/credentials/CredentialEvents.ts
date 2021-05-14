import { CredentialState } from './CredentialState'
import { CredentialRecord } from './repository/CredentialRecord'

export interface CredentialStateChangedEvent {
  type: 'CredentialStateChanged'
  credentialRecord: CredentialRecord
  previousState: CredentialState | null
}
