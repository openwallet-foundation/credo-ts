export * from './DcqlCredentialsForRequest'

import type {
  DcqlCredential as _DcqlCredential,
  DcqlMdocCredential as _DcqlMdocCredential,
  DcqlPresentationResult as _DcqlPresentationResult,
  DcqlQuery as _DcqlQuery,
  DcqlQueryResult as _DcqlQueryResult,
  DcqlSdJwtVcCredential as _DcqlSdJwtVcCredential,
  DcqlW3cVcCredential as _DcqlW3cVcCredential,
} from 'dcql'
import type { VerifiablePresentation } from '../../dif-presentation-exchange'
import type { MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { W3cCredentialRecord, W3cV2CredentialRecord } from '../../vc'

export type DcqlQuery = _DcqlQuery.Input | _DcqlQuery.Output
export type DcqlCredential = _DcqlCredential.Model['Input']
export type DcqlMdocCredential = _DcqlMdocCredential.Model['Input']
export type DcqlSdJwtVcCredential = _DcqlSdJwtVcCredential.Model['Input']
export type DcqlW3cVcCredential = _DcqlW3cVcCredential.Model['Input']

export type DcqlFailedCredential = NonNullable<
  _DcqlQueryResult['credential_matches'][string]['failed_credentials']
>[number] & {
  record: MdocRecord | SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord
}

export type DcqlValidCredential = NonNullable<
  _DcqlQueryResult['credential_matches'][string]['valid_credentials']
>[number] & {
  record: MdocRecord | SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord
}

export type DcqlMatchWithRecord =
  | (Omit<_DcqlQueryResult['credential_matches'][string], 'success'> & {
      success: true
      valid_credentials: [DcqlValidCredential, ...DcqlValidCredential[]]
      failed_credentials?: [DcqlFailedCredential, ...DcqlFailedCredential[]]
    })
  | (Omit<_DcqlQueryResult['credential_matches'][string], 'success'> & {
      success: false
      failed_credentials?: [DcqlFailedCredential, ...DcqlFailedCredential[]]
    })

export type DcqlQueryResult = Omit<_DcqlQueryResult.Output, 'credential_matches'> & {
  credential_matches: Record<string, DcqlMatchWithRecord>
}

export type DcqlEncodedPresentationsEntry = string | Record<string, unknown>
export type DcqlEncodedPresentations = Record<
  string,
  [DcqlEncodedPresentationsEntry, ...DcqlEncodedPresentationsEntry[]]
>
export type DcqlPresentation = Record<string, [VerifiablePresentation, ...VerifiablePresentation[]]>

export type DcqlPresentationResult = _DcqlPresentationResult.Input
