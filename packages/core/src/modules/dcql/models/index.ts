export * from './DcqlCredentialsForRequest'
import type { VerifiablePresentation } from '../../dif-presentation-exchange'
import type { MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { W3cCredentialRecord } from '../../vc'
import type {
  DcqlQueryResult as InternalDcqlQueryResult,
  DcqlPresentationRecord as _DcqlPresentationRecord,
} from 'dcql'

export type { DcqlQuery, DcqlCredentialRepresentation, DcqlMdocRepresentation, DcqlSdJwtVcRepresentation } from 'dcql'

export type DcqlMatchWithRecord = InternalDcqlQueryResult.CredentialMatch & {
  record: W3cCredentialRecord | SdJwtVcRecord | MdocRecord
}

export type DcqlQueryResult = Omit<InternalDcqlQueryResult, 'credential_matches'> & {
  credential_matches: Record<string, DcqlMatchWithRecord>
}

export type DcqlEncodedPresentationRecord = _DcqlPresentationRecord
export type DcqlPresentationRecord = Record<string, VerifiablePresentation>
