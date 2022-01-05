import type { DidDocument } from './domain'
import type { DIDResolutionOptions, ParsedDID, DIDDocumentMetadata, DIDResolutionMetadata } from 'did-resolver'

export type ParsedDid = ParsedDID
export type DidResolutionOptions = DIDResolutionOptions
export type DidDocumentMetadata = DIDDocumentMetadata
export type DidResolutionMetadata = DIDResolutionMetadata

export interface DidResolutionResult {
  didResolutionMetadata: DidResolutionMetadata
  didDocument: DidDocument | null
  didDocumentMetadata: DidDocumentMetadata
}
