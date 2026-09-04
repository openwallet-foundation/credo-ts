import type { JsonObject, SingleOrArray } from '../../../../types'
import type { W3cV2JsonCredential } from '../credential/W3cV2JsonCredential'

export interface W3cV2JsonEnvelopedVerifiableCredentialEntry {
  '@context': string | Array<string | JsonObject>
  id: string
  type: string | Array<string>
  [key: string]: unknown
}

export interface W3cV2JsonEnvelopedVerifiablePresentationEntry {
  '@context': string | Array<string | JsonObject>
  id: string
  type: string | Array<string>
  [key: string]: unknown
}

export interface W3cV2JsonDataIntegrityPresentationEntry {
  '@context': string | Array<string | JsonObject>
  type: string | Array<string>
  proof: unknown
  verifiableCredential?: SingleOrArray<W3cV2JsonPresentationCredentialEntry>
  [key: string]: unknown
}

export type W3cV2JsonPresentationCredentialEntry =
  | W3cV2JsonCredential
  | W3cV2JsonDataIntegrityPresentationEntry
  | W3cV2JsonEnvelopedVerifiableCredentialEntry
  | W3cV2JsonEnvelopedVerifiablePresentationEntry
  | string

export interface W3cV2JsonPresentation {
  '@context': string | Array<string | JsonObject>
  id?: string
  type: string | Array<string>
  holder?: string | { id: string; [property: string]: unknown }
  verifiableCredential: SingleOrArray<W3cV2JsonPresentationCredentialEntry>
  [key: string]: unknown
}
