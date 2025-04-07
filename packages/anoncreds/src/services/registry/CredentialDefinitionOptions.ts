import type { AnonCredsCredentialDefinition } from '../../models/registry'
import type {
  AnonCredsOperationStateAction,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsOperationStateWait,
  AnonCredsResolutionMetadata,
  Extensible,
} from './base'

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

export interface RegisterCredentialDefinitionReturnStateWait extends AnonCredsOperationStateWait {
  credentialDefinition?: AnonCredsCredentialDefinition
  credentialDefinitionId?: string
}

export interface RegisterCredentialDefinitionReturnStateAction extends AnonCredsOperationStateAction {
  credentialDefinitionId: string
  credentialDefinition: AnonCredsCredentialDefinition
}

export interface RegisterCredentialDefinitionReturn {
  jobId?: string
  credentialDefinitionState:
    | RegisterCredentialDefinitionReturnStateWait
    | RegisterCredentialDefinitionReturnStateAction
    | RegisterCredentialDefinitionReturnStateFinished
    | RegisterCredentialDefinitionReturnStateFailed
  credentialDefinitionMetadata: Extensible
  registrationMetadata: Extensible
}
