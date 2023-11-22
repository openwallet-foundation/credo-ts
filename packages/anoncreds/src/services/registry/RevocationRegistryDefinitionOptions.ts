import type {
  AnonCredsOperationStateWait,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsResolutionMetadata,
  Extensible,
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

export interface RegisterRevocationRegistryDefinitionReturnStateFailed extends AnonCredsOperationStateFailed {
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId?: string
}

export interface RegisterRevocationRegistryDefinitionReturnStateFinished extends AnonCredsOperationStateFinished {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId: string
}

export interface RegisterRevocationRegistryDefinitionReturnState extends AnonCredsOperationStateWait {
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId?: string
}

export interface RegisterRevocationRegistryDefinitionReturn {
  jobId?: string
  revocationRegistryDefinitionState:
    | RegisterRevocationRegistryDefinitionReturnStateFailed
    | RegisterRevocationRegistryDefinitionReturnStateFinished
    | RegisterRevocationRegistryDefinitionReturnState
  revocationRegistryDefinitionMetadata: Extensible
  registrationMetadata: Extensible
}
