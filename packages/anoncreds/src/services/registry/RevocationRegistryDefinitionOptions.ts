import type {
  AnonCredsOperationStateWait,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsResolutionMetadata,
  Extensible,
  AnonCredsOperationStateAction,
} from './base'
import type { AnonCredsRevocationRegistryDefinition } from '../../models/registry'

export interface GetRevocationRegistryDefinitionReturn {
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId: string
  resolutionMetadata: AnonCredsResolutionMetadata
  revocationRegistryDefinitionMetadata: Extensible
}

export interface RegisterRevocationRegistryDefinitionOptions {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  options: Extensible
}

export interface RegisterRevocationRegistryDefinitionReturnStateAction extends AnonCredsOperationStateAction {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId: string
}

export interface RegisterRevocationRegistryDefinitionReturnStateFailed extends AnonCredsOperationStateFailed {
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId?: string
}

export interface RegisterRevocationRegistryDefinitionReturnStateWait extends AnonCredsOperationStateWait {
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId?: string
}

export interface RegisterRevocationRegistryDefinitionReturnStateFinished extends AnonCredsOperationStateFinished {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId: string
}

export interface RegisterRevocationRegistryDefinitionReturn {
  jobId?: string
  revocationRegistryDefinitionState:
    | RegisterRevocationRegistryDefinitionReturnStateWait
    | RegisterRevocationRegistryDefinitionReturnStateAction
    | RegisterRevocationRegistryDefinitionReturnStateFailed
    | RegisterRevocationRegistryDefinitionReturnStateFinished
  revocationRegistryDefinitionMetadata: Extensible
  registrationMetadata: Extensible
}
