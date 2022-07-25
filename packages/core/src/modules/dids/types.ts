import type { DidDocument } from './domain'
import type { DIDResolutionOptions, ParsedDID, DIDDocumentMetadata, DIDResolutionMetadata } from 'did-resolver'

export type ParsedDid = ParsedDID
export type DidResolutionOptions = DIDResolutionOptions
export type DidDocumentMetadata = DIDDocumentMetadata

export interface DidResolutionMetadata extends DIDResolutionMetadata {
  message?: string
}

export interface DidResolutionResult {
  didResolutionMetadata: DidResolutionMetadata
  didDocument: DidDocument | null
  didDocumentMetadata: DidDocumentMetadata
}

// Based on https://identity.foundation/did-registration
export type DidRegistrationExtraOptions = Record<string, unknown>
export type DidRegistrationSecretOptions = Record<string, unknown>
export type DidRegistrationMetadata = Record<string, unknown>
export type DidDocumentOperation = 'setDidDocument' | 'addToDidDocument' | 'removeFromDidDocument'

export interface DidOperationStateFinished {
  state: 'finished'
  did: string
  secret?: DidRegistrationSecretOptions
  didDocument: DidDocument
}

export interface DidOperationStateFailed {
  state: 'failed'
  did?: string
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocument
  reason: string
}

export interface DidOperationState {
  state: 'action' | 'wait'
  did?: string
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocument
}

export interface DidCreateOptions {
  method?: string
  did?: string
  options?: DidRegistrationExtraOptions
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocument
}

export interface DidCreateResult {
  jobId?: string
  didState: DidOperationState | DidOperationStateFinished | DidOperationStateFailed
  didRegistrationMetadata: DidRegistrationMetadata
  didDocumentMetadata: DidResolutionMetadata
}

export interface DidUpdateOptions {
  did: string
  options?: DidRegistrationExtraOptions
  secret?: DidRegistrationSecretOptions
  didDocumentOperation?: DidDocumentOperation
  didDocument: DidDocument | Partial<DidDocument>
}

export interface DidUpdateResult {
  jobId?: string
  didState: DidOperationState | DidOperationStateFinished | DidOperationStateFailed
  didRegistrationMetadata: DidRegistrationMetadata
  didDocumentMetadata: DidResolutionMetadata
}

export interface DidDeactivateOptions {
  did: string
  options?: DidRegistrationExtraOptions
  secret?: DidRegistrationSecretOptions
}

export interface DidDeactivateResult {
  jobId?: string
  didState: DidOperationState | DidOperationStateFinished | DidOperationStateFailed
  didRegistrationMetadata: DidRegistrationMetadata
  didDocumentMetadata: DidResolutionMetadata
}
