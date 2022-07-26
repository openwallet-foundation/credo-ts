import type { DidDocument, DidType } from './domain'
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
  didType: DidType
}

export interface DIDMetadata {
  label?: string
  logoUrl?: string
}
