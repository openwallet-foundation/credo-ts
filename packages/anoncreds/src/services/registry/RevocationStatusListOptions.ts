import type {
  AnonCredsOperationStateWait,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsResolutionMetadata,
  Extensible,
} from './base'
import type { AnonCredsRevocationStatusList } from '../../models/registry'

export interface GetRevocationStatusListReturn {
  revocationStatusList?: AnonCredsRevocationStatusList
  resolutionMetadata: AnonCredsResolutionMetadata
  revocationStatusListMetadata: Extensible
}

export interface RegisterRevocationStatusListOptions {
  // Timestamp is often calculated by the ledger, otherwise method should just take current time
  // Return type does include the timestamp.
  revocationStatusList: Omit<AnonCredsRevocationStatusList, 'timestamp'>
  options: Extensible
}

export interface RegisterRevocationStatusListReturnStateFailed extends AnonCredsOperationStateFailed {
  revocationStatusList?: AnonCredsRevocationStatusList
  timestamp?: string
}

export interface RegisterRevocationStatusListReturnStateFinished extends AnonCredsOperationStateFinished {
  revocationStatusList: AnonCredsRevocationStatusList
  timestamp: string
}

export interface RegisterRevocationStatusListReturnState extends AnonCredsOperationStateWait {
  revocationStatusList?: AnonCredsRevocationStatusList
  timestamp?: string
}

export interface RegisterRevocationStatusListReturn {
  jobId?: string
  revocationStatusListState:
    | RegisterRevocationStatusListReturnStateFailed
    | RegisterRevocationStatusListReturnStateFinished
    | RegisterRevocationStatusListReturnState
  revocationStatusListMetadata: Extensible
  registrationMetadata: Extensible
}
