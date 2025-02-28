import type { AnonCredsSchema } from '../../models/registry'
import type {
  AnonCredsOperationStateAction,
  AnonCredsOperationStateFailed,
  AnonCredsOperationStateFinished,
  AnonCredsOperationStateWait,
  AnonCredsResolutionMetadata,
  Extensible,
} from './base'

// Get Schema
export interface GetSchemaReturn {
  schema?: AnonCredsSchema
  schemaId: string
  // Can contain e.g. the ledger transaction request/response
  resolutionMetadata: AnonCredsResolutionMetadata
  // Can contain additional fields
  schemaMetadata: Extensible
}

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

export interface RegisterSchemaReturnStateAction extends AnonCredsOperationStateAction {
  schema: AnonCredsSchema
  schemaId: string
}

export interface RegisterSchemaReturnStateWait extends AnonCredsOperationStateWait {
  schema?: AnonCredsSchema
  schemaId?: string
}

export interface RegisterSchemaReturn {
  jobId?: string
  schemaState:
    | RegisterSchemaReturnStateWait
    | RegisterSchemaReturnStateAction
    | RegisterSchemaReturnStateFinished
    | RegisterSchemaReturnStateFailed
  schemaMetadata: Extensible
  registrationMetadata: Extensible
}
