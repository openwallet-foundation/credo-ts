export * from './DcqlCredentialsForRequest'
import type {
  DcqlCredential as _DcqlCredential,
  DcqlMdocCredential as _DcqlMdocCredential,
  DcqlPresentation as _DcqlPresentation,
  DcqlPresentationResult as _DcqlPresentationResult,
  DcqlQuery as _DcqlQuery,
  DcqlQueryResult as _DcqlQueryResult,
  DcqlSdJwtVcCredential as _DcqlSdJwtVcCredential,
  DcqlW3cVcCredential as _DcqlW3cVcCredential,
} from 'dcql'
import type { VerifiablePresentation } from '../../dif-presentation-exchange'
import type { MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { W3cCredentialRecord } from '../../vc'

export type DcqlQuery = _DcqlQuery.Input | _DcqlQuery.Output
export type DcqlCredential = _DcqlCredential.Model['Input']
export type DcqlMdocCredential = _DcqlMdocCredential.Model['Input']
export type DcqlSdJwtVcCredential = _DcqlSdJwtVcCredential.Model['Input']
export type DcqlW3cVcCredential = _DcqlW3cVcCredential.Model['Input']

type DcqlEntrySuccess = _DcqlQueryResult['credential_matches'][string]['all'][number][number] & {
  success: true
  record: MdocRecord | SdJwtVcRecord | W3cCredentialRecord
}

type DcqlEntryNoSuccess = _DcqlQueryResult['credential_matches'][string]['all'][number][number] & {
  success: false
  record?: undefined
}

export type DcqlMatchWithRecord =
  | (_DcqlQueryResult['credential_matches'][string] & {
      success: true
      record: MdocRecord | SdJwtVcRecord | W3cCredentialRecord
      all: Array<Array<DcqlEntrySuccess | DcqlEntryNoSuccess>>
    })
  | (_DcqlQueryResult['credential_matches'][string] & {
      success: false
    })

export type DcqlQueryResult = Omit<_DcqlQueryResult.Input, 'credential_matches'> & {
  credential_matches: Record<string, DcqlMatchWithRecord>
}

export type DcqlEncodedPresentations = _DcqlPresentation.Input
export type DcqlPresentation = Record<string, VerifiablePresentation>

export type DcqlPresentationResult = _DcqlPresentationResult.Input
