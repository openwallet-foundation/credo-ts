import type {
  AnonCredsResolutionMetadata,
  Extensible,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsOperationState,
} from './base'
import type { AnonCredsCredentialDefinition } from '../../models/registry'

export interface GetCredentialDefinitionReturn {
  credentialDefinition?: AnonCredsCredentialDefinition
  credentialDefinitionId: string
  resolutionMetadata: AnonCredsResolutionMetadata
  credentialDefinitionMetadata: Extensible
}

export interface RegisterCredentialDefinitionOptions {
  credentialDefinition: AnonCredsCredentialDefinition
  options: Extensible
}

export interface RegisterCredentialDefinitionReturnStateFailed extends AnonCredsOperationStateFailed {
  credentialDefinition?: AnonCredsCredentialDefinition
  credentialDefinitionId?: string
}

export interface RegisterCredentialDefinitionReturnStateFinished extends AnonCredsOperationStateFinished {
  credentialDefinition: AnonCredsCredentialDefinition
  credentialDefinitionId: string
}

export interface RegisterCredentialDefinitionReturnState extends AnonCredsOperationState {
  credentialDefinition?: AnonCredsCredentialDefinition
  credentialDefinitionId?: string
}

export interface RegisterCredentialDefinitionReturn {
  jobId?: string
  credentialDefinitionState:
    | RegisterCredentialDefinitionReturnState
    | RegisterCredentialDefinitionReturnStateFinished
    | RegisterCredentialDefinitionReturnStateFailed
  credentialDefinitionMetadata: Extensible
  registrationMetadata: AnonCredsResolutionMetadata
}
