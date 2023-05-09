import type {
  AnonCredsResolutionMetadata,
  Extensible,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsOperationState,
} from './base'
import type { AnonCredsSchema } from '../../models/registry'

// Get Schema
export interface GetSchemaReturn {
  schema?: AnonCredsSchema
  schemaId: string
  // Can contain e.g. the ledger transaction request/response
  resolutionMetadata: AnonCredsResolutionMetadata
  // Can contain additional fields
  schemaMetadata: Extensible
}

//
export interface RegisterSchemaOptions {
  schema: AnonCredsSchema
  options: Extensible
}

export interface RegisterSchemaReturnStateFailed extends AnonCredsOperationStateFailed {
  schema?: AnonCredsSchema
  schemaId?: string
}

export interface RegisterSchemaReturnStateFinished extends AnonCredsOperationStateFinished {
  schema: AnonCredsSchema
  schemaId: string
}

export interface RegisterSchemaReturnState extends AnonCredsOperationState {
  schema?: AnonCredsSchema
  schemaId?: string
}

export interface RegisterSchemaReturn {
  jobId?: string
  schemaState: RegisterSchemaReturnState | RegisterSchemaReturnStateFinished | RegisterSchemaReturnStateFailed
  schemaMetadata: Extensible
  registrationMetadata: Extensible
}
